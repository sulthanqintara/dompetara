import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { evaluateAdmission } from "./evaluate-admission.ts";
import type { AdmissionLease, LimitBucket, SecurityLimitStore } from "./security-limits.ts";

type QueryExecutor = { execute: (query: SQL) => Promise<{ rows: Record<string, unknown>[] }> };
export type SecurityDatabase = QueryExecutor & {
  transaction: <T>(callback: (transaction: QueryExecutor) => Promise<T>) => Promise<T>;
};

export function createDatabaseSecurityStore(database: SecurityDatabase): SecurityLimitStore {
  return {
    async consume(request) {
      // Cleanup commits independently before admission locks. SKIP LOCKED avoids
      // waiting for live requests; each indexed sweep removes at most 64 rows.
      await database.execute(sql`
        WITH expired_buckets AS (
          SELECT key_hash FROM security_limit_buckets
          WHERE expires_at <= clock_timestamp()
          ORDER BY expires_at LIMIT 64 FOR UPDATE SKIP LOCKED
        ), removed_buckets AS (
          DELETE FROM security_limit_buckets b USING expired_buckets e
          WHERE b.key_hash = e.key_hash RETURNING b.key_hash
        ), expired_leases AS (
          SELECT scope_hash, token FROM security_admission_leases
          WHERE expires_at <= clock_timestamp()
          ORDER BY expires_at LIMIT 64 FOR UPDATE SKIP LOCKED
        ), removed_leases AS (
          DELETE FROM security_admission_leases l USING expired_leases e
          WHERE l.scope_hash = e.scope_hash AND l.token = e.token RETURNING l.token
        ) SELECT (SELECT count(*) FROM removed_buckets) AS buckets,
                 (SELECT count(*) FROM removed_leases) AS leases`);
      return database.transaction(async (tx) => {
        await tx.execute(sql`SELECT set_config('statement_timeout', '5000', true), set_config('lock_timeout', '2000', true)`);
        const scopes = [...request.rules.map((rule) => rule.keyHash), ...request.lease?.rules.map((rule) => rule.scopeHash) ?? []];
        const locks = [...new Set(scopes.map((key) => BigInt.asIntN(64, BigInt(`0x${key.slice(0, 16)}`)).toString()))].sort();
        // All replicas lock the same scopes in one stable order. Advisory locks
        // also protect absent rows, avoiding first-request insertion races.
        for (const lock of locks) await tx.execute(sql`SELECT pg_advisory_xact_lock(${lock}::bigint)`);
        const clock = await tx.execute(sql`SELECT floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint AS now_ms`);
        const now = Number(clock.rows[0].now_ms);
        if (!Number.isSafeInteger(now)) throw new Error("Security limiter clock is unavailable.");
        const selected = await tx.execute(sql`
          SELECT key_hash, count, window_started_at FROM security_limit_buckets
          WHERE key_hash IN (${sql.join(request.rules.map((rule) => sql`${rule.keyHash}`), sql`, `)})
          FOR UPDATE`);
        const buckets: LimitBucket[] = selected.rows.map((row) => ({
          keyHash: String(row.key_hash), count: Number(row.count),
          windowStartedAt: new Date(row.window_started_at as string | Date).getTime(),
        }));
        let leases: AdmissionLease[] = [];
        if (request.lease) {
          const selectedLeases = await tx.execute(sql`
            SELECT scope_hash, expires_at FROM security_admission_leases
            WHERE scope_hash IN (${sql.join(request.lease.rules.map((rule) => sql`${rule.scopeHash}`), sql`, `)})
            AND expires_at > ${new Date(now)}`);
          leases = selectedLeases.rows.map((row) => ({
            scopeHash: String(row.scope_hash), expiresAt: new Date(row.expires_at as string | Date).getTime(),
          }));
        }
        const decision = evaluateAdmission(request, buckets, leases, now);
        // No placeholders, counters, or leases are created when any rule fails.
        if (!decision.allowed) return decision;
        const byKey = new Map(buckets.map((bucket) => [bucket.keyHash, bucket]));
        const values = request.rules.map((rule) => {
          const start = Math.floor(now / rule.windowMs) * rule.windowMs;
          const previous = byKey.get(rule.keyHash);
          const count = (previous?.windowStartedAt === start ? previous.count : 0) + 1;
          return sql`(${rule.keyHash}, ${count}, ${new Date(start)}, ${new Date(start + rule.windowMs)})`;
        });
        await tx.execute(sql`
          INSERT INTO security_limit_buckets (key_hash, count, window_started_at, expires_at)
          VALUES ${sql.join(values, sql`, `)}
          ON CONFLICT (key_hash) DO UPDATE SET count = EXCLUDED.count,
            window_started_at = EXCLUDED.window_started_at, expires_at = EXCLUDED.expires_at`);
        if (request.lease) {
          const lease = request.lease;
          await tx.execute(sql`
            INSERT INTO security_admission_leases (scope_hash, token, expires_at)
            VALUES ${sql.join(lease.rules.map((rule) => sql`(${rule.scopeHash}, ${lease.token}, ${new Date(now + lease.ttlMs)})`), sql`, `)}`);
        }
        return decision;
      });
    },
    async release(token) {
      // Tokens identify one admission only, so repeat/late release is harmless.
      await database.execute(sql`DELETE FROM security_admission_leases WHERE token = ${token}`);
    },
  };
}

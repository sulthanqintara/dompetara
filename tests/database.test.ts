import "dotenv/config";
import assert from "node:assert/strict";
import { createSessionTokenCodec } from "../src/lib/auth-privacy/create-session-token-codec.ts";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, {
  prepare: false,
  connect_timeout: 10,
  max: 1,
});

try {
  assert.equal(
    sql.options.ssl,
    "require",
    "Database connection must require SSL.",
  );
  const tables = await sql`
    select c.relname as name, c.relrowsecurity as rls,
      has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER') as anon_access,
      has_table_privilege('authenticated', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER') as authenticated_access
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname in ('account', 'exchange_rate_cache', 'ledger', 'receipt_images', 'security_admission_leases', 'security_limit_buckets', 'session', 'user', 'user_preferences', 'verification')
    order by c.relname
  `;
  assert.deepEqual(
    tables.map((t) => t.name),
    [
      "account",
      "exchange_rate_cache",
      "ledger",
      "receipt_images",
      "security_admission_leases",
      "security_limit_buckets",
      "session",
      "user",
      "user_preferences",
      "verification",
    ],
  );
  for (const table of tables) {
    assert.equal(
      table.anon_access,
      false,
      `${table.name} must deny anonymous API access.`,
    );
    assert.equal(
      table.authenticated_access,
      false,
      `${table.name} must deny Supabase Auth API access.`,
    );
  }
  for (const name of ["ledger", "exchange_rate_cache", "receipt_images", "user_preferences", "security_limit_buckets", "security_admission_leases"]) {
    assert.equal(tables.find((t) => t.name === name)?.rls, true, `${name} requires RLS`);
  }
  const columns = await sql`
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'session' order by column_name
  `;
  assert.deepEqual(columns.map((column) => column.column_name), [
    "created_at", "expires_at", "id", "ip_address", "token", "token_hash", "updated_at", "user_agent", "user_id",
  ], "Session storage must match the authentication code.");
  const guards = await sql`
    select conname from pg_constraint
    where connamespace = 'public'::regnamespace
      and conname in ('user_no_profile_image', 'account_no_provider_credentials', 'session_private_storage')
    order by conname
  `;
  assert.deepEqual(guards.map((guard) => guard.conname), ["account_no_provider_credentials", "session_private_storage", "user_no_profile_image"]);

  const id = crypto.randomUUID();
  const rollback = new Error("Roll back the database check.");
  await sql
    .begin(async (transaction) => {
      const data = { wallets: [], categories: [], entries: [] };
      await transaction`insert into public."user" (id, name, email) values (${id}, 'Database check', ${id + "@example.invalid"})`;
      const token = crypto.randomUUID();
      const codec = createSessionTokenCodec(process.env.BETTER_AUTH_SECRET);
      await transaction`insert into public.session (id, user_id, token, token_hash, expires_at, updated_at) values (${crypto.randomUUID()}, ${id}, ${await codec.encrypt(token)}, ${codec.hash(token)}, ${new Date(Date.now() + 60_000)}, ${new Date()})`;
      const [session] = await transaction`select token from public.session where user_id = ${id}`;
      assert.equal(await codec.decrypt(session.token), token, "Encrypted sessions can be created and read.");
      await transaction`insert into public.ledger (user_id, data) values (${id}, ${transaction.json(data)})`;
      const [saved] =
        await transaction`select data, version from public.ledger where user_id = ${id}`;
      assert.deepEqual(saved.data, data);
      assert.equal(saved.version, 0);
      const [updated] =
        await transaction`update public.ledger set version = version + 1 where user_id = ${id} and version = 0 returning version`;
      assert.equal(updated.version, 1);
      throw rollback;
    })
    .catch((error: unknown) => {
      if (error !== rollback) throw error;
    });
  const [remaining] =
    await sql`select count(*)::integer as count from public."user" where id = ${id}`;
  assert.equal(
    remaining.count,
    0,
    "Database check must leave no sample records.",
  );
  console.log(
    "Database checks passed: connection, schema/privacy guards, API protection, encrypted sessions, and server reads/writes (rolled back).",
  );
} finally {
  await sql.end({ timeout: 1 });
}

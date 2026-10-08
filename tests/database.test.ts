import "dotenv/config";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
    where n.nspname = 'public' and c.relname in ('account', 'exchange_rate_cache', 'ledger', 'session', 'user', 'user_preferences', 'verification')
    order by c.relname
  `;
  assert.deepEqual(
    tables.map((t) => t.name),
    [
      "account",
      "exchange_rate_cache",
      "ledger",
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
  assert.equal(tables.find((t) => t.name === "ledger")?.rls, true);
  assert.equal(tables.find((t) => t.name === "exchange_rate_cache")?.rls, true);
  const journal = JSON.parse(
    readFileSync(
      new URL("../drizzle/meta/_journal.json", import.meta.url),
      "utf8",
    ),
  );
  const [migration] =
    await sql`select count(*)::integer as count from drizzle.__drizzle_migrations`;
  assert.equal(
    migration.count,
    journal.entries.length,
    "Apply all database migrations.",
  );

  const id = crypto.randomUUID();
  const rollback = new Error("Roll back the database check.");
  await sql
    .begin(async (transaction) => {
      const data = { wallets: [], categories: [], entries: [] };
      await transaction`insert into public."user" (id, name, email) values (${id}, 'Database check', ${id + "@example.invalid"})`;
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
    "Database checks passed: connection, migrations, API protection, and server reads/writes (rolled back).",
  );
} finally {
  await sql.end({ timeout: 1 });
}

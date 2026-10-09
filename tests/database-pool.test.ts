import assert from "node:assert/strict";
import { databasePoolConfig } from "../src/lib/db/pool-config.ts";

const session = "postgresql://postgres.example:private-password@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require";
const transaction = session.replace(":5432/", ":6543/");
const config = databasePoolConfig(transaction, true);
assert.equal(new URL(config.connectionString).port, "6543");
assert.equal(new URL(config.connectionString).searchParams.has("sslmode"), false);
assert.equal(config.ssl?.rejectUnauthorized, true);
const insecureUrl = transaction.replace("sslmode=require", "sslmode=no-verify&sslrootcert=untrusted");
const secureConfig = databasePoolConfig(insecureUrl, true);
assert.equal(secureConfig.ssl?.rejectUnauthorized, true);
assert.equal(new URL(secureConfig.connectionString).search, "");
assert.match(config.ssl?.ca ?? "", /BEGIN CERTIFICATE/);
assert.throws(() => databasePoolConfig(session, true), /transaction pooler/);
assert.equal(new URL(databasePoolConfig(session).connectionString).port, "5432", "Local connections can retain session mode");
assert.equal(databasePoolConfig("postgresql://postgres:password@localhost:5432/ledger").max, 2);
for (const value of [undefined, "not-a-url", "https://example.com"]) {
  assert.throws(() => databasePoolConfig(value), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.ok(!error.message.includes("private-password"));
    return true;
  });
}
console.log("Database pool checks passed: Vercel transaction mode enforcement and local session compatibility.");

import "dotenv/config";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import postgres from "postgres";
import { createSessionTokenCodec } from "../src/lib/auth-privacy/create-session-token-codec.ts";
import { seedLedger } from "./support/seed-ledger.mjs";
import { ledgerUsage } from "../src/features/ledger/usage.ts";
import { LEDGER_LIMITS, ledgerBytes } from "../src/features/ledger/ledger-limits.ts";

const origin = process.env.LEDGER_TEST_URL ?? "http://localhost:3100";
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
const user = randomUUID(), token = randomUUID(), date = new Date().toISOString();
const codec = createSessionTokenCodec(process.env.BETTER_AUTH_SECRET);
const signed = encodeURIComponent(`${token}.${createHmac("sha256", process.env.BETTER_AUTH_SECRET).update(token).digest("base64")}`);
const headers = { Cookie: `better-auth.session_token=${signed}`, Origin: origin, "Content-Type": "application/json" };
const entry = { kind: "expense", date, wallet: "bank", currency: "IDR", amount: 100, title: "Expense", category: "Bills", description: "" };
const fixture = (count = 1000) => ({ wallets: [{ id: "bank", name: "Bank", currencies: ["IDR", "USD"] }, { id: "cash", name: "Cash", currencies: ["USD"] }],
  categories: [{ id: "bills", name: "Bills", kind: "expense" }, { id: "salary", name: "Salary", kind: "income" }],
  entries: Array.from({ length: count }, (_, index) => ({ ...entry, id: `entry-${index}` })) });
const full = async () => { const r = await fetch(origin + "/api/ledger/export", { headers }); assert.equal(r.status, 200); return r.json(); };
const save = async (payload, version, status = 200) => {
  const r = await fetch(origin + "/api/ledger", { method: "POST", headers, body: JSON.stringify({ ...payload, version }) });
  const result = await r.json(); assert.equal(r.status, status, result.error); return result;
};
const edit = (extra = {}) => ({ action: "entry", id: "entry-0", kind: "expense", date, wallet: "bank", currency: "IDR", amount: "1.01", title: "Edited", category: "Bills", description: "", ...extra });
const checkUsage = async () => {
  const state = await full();
  const [row] = await sql`select usage,usage_version from ledger where user_id=${user}`;
  const [position] = await sql`select coalesce(max(position),-1)+1 as next from ledger_transactions where user_id=${user}`;
  assert.ok(row.usage.nextPosition >= position.next, "Ordering allocation stays ahead of every retained row after deletions");
  assert.deepEqual(row.usage, ledgerUsage(state.data, row.usage.nextPosition), "Incremental counts and UTF-8 bytes must match a complete independent read");
  assert.equal(row.usage_version, state.version); return state;
};
try {
  await sql`insert into public."user" (id,name,email) values (${user},'Targeted save test',${user+'@example.invalid'})`;
  await sql`insert into session (id,user_id,token,token_hash,expires_at,updated_at) values (${randomUUID()},${user},${await codec.encrypt(token)},${codec.hash(token)},${new Date(Date.now()+3600000)},${new Date()})`;
  await seedLedger(sql, user, fixture());
  let state = await checkUsage();
  const [original] = await sql`select md5(data::text) as hash from ledger where user_id=${user}`;
  let saved = await save(edit({ description: "Unicode 💰 café" }), state.version);
  assert.equal(saved.changes.before.length, 1); assert.equal(saved.changes.after.length, 1);
  assert.equal(saved.data.entries.length, 0, "A save does not send full history to the browser");
  state = await checkUsage();
  await save(edit({ wallet: "cash", currency: "USD", newCategory: true, category: "Dining" }), state.version);
  state = await checkUsage();
  await save({ action: "wallet", id: "bank", name: "Renamed 💰", currency: "IDR", amount: "42" }, state.version);
  state = await checkUsage();
  assert.equal((await sql`select count(*)::integer as count from ledger_transactions where user_id=${user} and wallet_id='bank' and search_text not like '%Renamed 💰%'`)[0].count, 0);
  await save({ action: "deleteWallet", id: "bank" }, state.version, 400);
  await save({ action: "entry", kind: "transfer", date, wallet: "bank", currency: "IDR", amount: "10", toWallet: "cash", toCurrency: "USD", received: "2", feeAmount: "0.10", feeChargedTo: "destination", description: "" }, state.version);
  state = await checkUsage();
  const transfer = state.data.entries.find((row) => row.kind === "transfer");
  await save({ ...edit(), id: transfer.id, kind: "transfer", amount: "12", toWallet: "cash", toCurrency: "USD", received: "2.5", feeAmount: "0.20", feeChargedTo: "source" }, state.version);
  state = await checkUsage();
  await save({ action: "deleteEntry", id: transfer.id }, state.version);
  state = await checkUsage();
  assert.ok(!state.data.entries.some((row) => row.id === transfer.id || row.transferId === transfer.id));
  for (const fingerprint of ["a".repeat(64), "b".repeat(64)]) {
    const receipt = { importId: randomUUID(), fingerprint, method: "ai", documentKind: "receipt", merchant: null, receiptNumber: null, keepItems: false, paymentConfirmed: false, items: [], adjustments: [] };
    const payload = { ...edit(), action: "receipt", id: undefined, receipt };
    saved = await save(payload, state.version); state = await checkUsage();
    const imported = state.data.entries.find((row) => row.receipt?.fingerprint === fingerprint);
    assert.equal(imported.receipt.merchant, null, "SQL projections must preserve nested receipt nulls");
    await save({ action: "deleteEntry", id: imported.id }, state.version); state = await checkUsage();
    assert.ok((await save(payload, state.version - 1)).notice, "Receipt retries remain harmless after deletion, even with a stale version");
  }
  assert.deepEqual(state.data.receiptImports.map((row) => row.fingerprint), ["a".repeat(64), "b".repeat(64)], "Import ordering remains stable across targeted saves");
  await sql`update ledger_transactions set amount_minor=amount_minor+1 where user_id=${user} and id='entry-1'`;
  await sql`update ledger set version=version+1 where user_id=${user}`;
  state = await full(); await save(edit(), state.version); state = await checkUsage();
  assert.equal((await sql`select md5(data::text) as hash from ledger where user_id=${user}`)[0].hash, original.hash);

  await seedLedger(sql, user, fixture(LEDGER_LIMITS.entries)); state = await full();
  await save(edit({ id: undefined }), state.version, 400);
  await save(edit({ description: "Allowed edit at quota" }), state.version); state = await checkUsage();
  await save({ action: "deleteEntry", id: "entry-1" }, state.version); state = await checkUsage();
  const twoRows = { action: "entry", kind: "transfer", date, wallet: "bank", currency: "IDR", amount: "1", toWallet: "cash", toCurrency: "USD", received: "1", feeAmount: "0.01", feeChargedTo: "source", description: "" };
  await save(twoRows, state.version, 400); assert.equal((await full()).version, state.version, "Failed transfer growth rolls back both rows and metadata");

  const large = fixture(2); large.entries[1].description = "x".repeat(LEDGER_LIMITS.bytes - ledgerBytes(large) - 2 * ',"categoryId":"bills"'.length);
  await seedLedger(sql, user, large); state = await checkUsage();
  await save(edit({ title: "Expense💰" }), state.version, 400);
  await save(edit({ title: "Expense" }), state.version); state = await checkUsage();
  const largeDelete = await save({ action: "deleteEntry", id: "entry-1" }, state.version);
  assert.equal(largeDelete.changes, undefined, "Large legacy details do not inflate save responses beyond a bounded row patch");
  state = await checkUsage();

  const safe = fixture(0);
  safe.entries = [
    { ...entry, id: "max-1", kind: "income", category: "Salary", amount: Number.MAX_SAFE_INTEGER },
    { ...entry, id: "entry-0", amount: Number.MAX_SAFE_INTEGER },
    { ...entry, id: "max-2", kind: "income", category: "Salary", amount: Number.MAX_SAFE_INTEGER },
    { ...entry, id: "last", amount: Number.MAX_SAFE_INTEGER },
  ];
  await seedLedger(sql, user, safe); state = await checkUsage();
  await save(edit({ amount: "1" }), state.version, 400);
  assert.equal((await full()).version, state.version, "Unsafe intermediate balances fail atomically even when the final sum is safe");
  console.log("Targeted saves passed: exact incremental usage, metadata repair, wallet balances/search, transfers/fees, archived ownership, receipt ordering/nulls/retries, growth/UTF-8 quotas, rollback, and safe balance prefixes.");
} finally { await sql`delete from public."user" where id=${user}`; await sql.end(); }

import "dotenv/config";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import postgres from "postgres";
import pg from "pg";
import { createSessionTokenCodec } from "../src/lib/auth-privacy/create-session-token-codec.ts";
import { databasePoolConfig } from "../src/lib/db/pool-config.ts";
import { cutoverLedgers } from "../scripts/ledger-cutover.ts";
import { comparableLedger } from "../src/features/ledger/storage.ts";
import { ledgerQuery, queryParams } from "../src/features/ledger/query.ts";
import { periodEntries, periodTotals, spendByCategory, spendingHistory } from "../src/features/ledger/derive.ts";
import { filterTransactions, transactionFiltersSchema } from "../src/features/ledger/transaction-filters.ts";
import { balance } from "../src/features/ledger/ledger.ts";
import { seedLedger } from "./support/seed-ledger.mjs";

const origin = process.env.LEDGER_TEST_URL ?? "http://localhost:3100";
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
const pool = new pg.Pool({ ...databasePoolConfig(process.env.DATABASE_URL), max: 1 });
const user = randomUUID(), otherUser = randomUUID(), token = randomUUID();
const codec = createSessionTokenCodec(process.env.BETTER_AUTH_SECRET);
const signature = createHmac("sha256", process.env.BETTER_AUTH_SECRET).update(token).digest("base64");
const headers = { Cookie: `better-auth.session_token=${encodeURIComponent(`${token}.${signature}`)}` };
const request = async (path, options = {}) => fetch(origin + path, { ...options, headers: { ...headers, ...options.headers } });
const query = ledgerQuery({ month: "2026-10" }, "Asia/Jakarta", "IDR");
const transactionPath = (values = {}) => `/api/ledger/transactions?${queryParams({ ...query, ...values })}`;
const fullState = async () => { const response = await request("/api/ledger/export"); assert.equal(response.status, 200); return response.json(); };
const save = (payload, version) => request("/api/ledger", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, version }) });
const date = "2026-10-05T00:00:00.123Z";
const entry = { kind: "expense", date, wallet: "bank", currency: "IDR", amount: 100, title: "Lunch", category: "Bills", description: "Friends" };
const data = {
  wallets: [{ id: "bank", name: "Bank", currencies: ["IDR", "USD"] }, { id: "cash", name: "Cash", currencies: ["USD"] }],
  categories: [{ id: "Bills", name: "Bills", kind: "expense" }, { id: "Salary", name: "Salary", kind: "income" }],
  entries: [
    { ...entry, id: "opening", kind: "correction", title: "Opening balance", category: "", amount: 1000000 },
    ...Array.from({ length: 41 }, (_, i) => ({ ...entry, id: `expense-${String(i).padStart(2, "0")}`, title: i ? "Lunch" : "10%_discount", category: i === 40 ? "Archived dining" : "Bills" })),
    { ...entry, id: "income", kind: "income", category: "Salary", amount: 5000 },
    { ...entry, id: "transfer", kind: "transfer", title: "Transfer", category: "", toWallet: "cash", toCurrency: "USD", received: 10 },
    { ...entry, id: "fee", transferId: "transfer", category: "Admin fees", wallet: "cash", currency: "USD", amount: 1 },
    { ...entry, id: "boundary-in", date: "2026-09-30T17:00:00Z" },
    { ...entry, id: "boundary-out", date: "2026-09-30T16:59:59.999Z" },
    { ...entry, id: "last-day", date: "2026-10-31T16:59:59.999Z" },
    { ...entry, id: "next-month", date: "2026-10-31T17:00:00Z" },
  ],
};
try {
  await sql`insert into public."user" (id,name,email) values (${user},'Normalized check',${user + '@example.invalid'}), (${otherUser},'Other check',${otherUser + '@example.invalid'})`;
  await sql`insert into public.session (id,user_id,token,token_hash,expires_at,updated_at) values (${randomUUID()},${user},${await codec.encrypt(token)},${codec.hash(token)},${new Date(Date.now()+3600000)},${new Date()})`;
  const otherToken = randomUUID();
  await sql`insert into public.session (id,user_id,token,token_hash,expires_at,updated_at) values (${randomUUID()},${otherUser},${await codec.encrypt(otherToken)},${codec.hash(otherToken)},${new Date(Date.now()+3600000)},${new Date()})`;
  const otherCookie = `better-auth.session_token=${encodeURIComponent(`${otherToken}.${createHmac("sha256", process.env.BETTER_AUTH_SECRET).update(otherToken).digest("base64")}`)}`;
  for (const path of [transactionPath(), `/api/ledger/overview?${queryParams(query)}`, "/api/ledger"]) {
    const response = await fetch(origin + path, { headers: { Cookie: otherCookie } });
    assert.equal(response.status, 200, "Each read endpoint initializes a first-time account");
    assert.equal((await sql`select normalized from ledger where user_id=${otherUser}`)[0].normalized, true);
    await sql`delete from ledger_categories where user_id=${otherUser}`;
    await sql`delete from ledger where user_id=${otherUser}`;
  }
  // Exercise the explicit cutover on a temporary legacy account only.
  await sql`insert into public.ledger (user_id,data) values (${user},${sql.json(data)})`;
  assert.deepEqual(await cutoverLedgers(pool, false, user), { ledgers: 1, entries: data.entries.length, applied: false });
  assert.equal((await sql`select normalized from public.ledger where user_id=${user}`)[0].normalized, false);
  assert.deepEqual(await cutoverLedgers(pool, true, user), { ledgers: 1, entries: data.entries.length, applied: true });
  assert.equal((await cutoverLedgers(pool, true, user)).ledgers, 0, "Cutover is idempotent");
  assert.deepEqual(comparableLedger((await fullState()).data), comparableLedger(data));
  const snapshot = (await sql`select md5(data::text) as hash from public.ledger where user_id=${user}`)[0].hash;
  await seedLedger(sql, otherUser, { wallets: [{ id: "alien", name: "Private other wallet", currencies: ["IDR"] }], categories: [], entries: [] });

  for (const path of ["/api/ledger/export", transactionPath(), `/api/ledger/overview?${queryParams(query)}`]) assert.equal((await fetch(origin + path)).status, 401);
  const bootstrap = await (await request("/api/ledger")).json();
  assert.equal(bootstrap.data.entries.length, 0, "Bootstrap does not contain transaction history");
  assert.equal(bootstrap.data.receiptImports, undefined);
  assert.ok(bootstrap.data.historicalCategories.some((category) => category.name === "Archived dining"));
  assert.equal(balance(bootstrap.data, "bank", "IDR"), balance(data, "bank", "IDR"));
  assert.equal(balance(bootstrap.data, "cash", "USD"), 9);
  const selected = periodEntries(data, { month: "2026-10" }, "Asia/Jakarta");
  for (const values of [{}, { page: 2 }, { page: 999 }, { search: "FRIENDS" }, { search: "10%_" }, { search: "Cash", type: "transfer" }, { search: "Bills Bank" }, { wallet: "cash", currency: "USD" }, { category: "Archived dining" }, { wallet: "alien" }]) {
    const response = await request(transactionPath(values)); assert.equal(response.status, 200);
    const { result } = await response.json();
    const expected = filterTransactions(selected, data, transactionFiltersSchema.parse(values));
    const page = Math.min(Number(values.page ?? 1), Math.max(1, Math.ceil(expected.length / 20)));
    assert.equal(result.total, expected.length);
    assert.deepEqual(result.rows.map((row) => row.id), expected.slice((page - 1) * 20, page * 20).map((row) => row.id));
    assert.ok(result.rows.length <= 20);
    if (values.wallet === "cash") assert.ok(result.related.some((row) => row.id === "transfer") && result.related.some((row) => row.id === "fee"));
  }
  const overviewResponse = await request(`/api/ledger/overview?${queryParams(query)}`); assert.equal(overviewResponse.status, 200);
  const overview = (await overviewResponse.json()).result;
  assert.deepEqual(overview.totals, periodTotals(selected, "IDR"));
  assert.deepEqual(overview.groups, spendByCategory(selected, "IDR"));
  assert.deepEqual(overview.daily, spendingHistory(selected, "IDR", "daily", "Asia/Jakarta"));
  assert.deepEqual(overview.monthly, spendingHistory(data.entries, "IDR", "monthly", "Asia/Jakarta"));
  assert.equal((await request(transactionPath({ timeZone: "Invalid/Zone" }))).status, 400);
  assert.equal((await save({ action: "category", kind: "expense", name: "New" }, -1)).status, 400);
  assert.equal((await request("/api/ledger", { method: "POST", headers: { Origin: "https://invalid.example", "Content-Type": "application/json" }, body: '{}' })).status, 403);

  const physicalBefore = await sql`select id,xmin::text as version from ledger_transactions where user_id=${user} order by id`;
  const edited = await save({ action: "entry", id: "expense-00", kind: "expense", date, wallet: "bank", currency: "IDR", amount: "1", title: "Changed", category: "Bills", description: "Friends" }, 0);
  assert.equal(edited.status, 200);
  const editedState = await edited.json(); assert.equal(editedState.data.entries.length, 0); assert.equal(editedState.version, 1);
  const physicalAfter = await sql`select id,xmin::text as version from ledger_transactions where user_id=${user} order by id`;
  assert.deepEqual(physicalAfter.filter((row) => row.id !== "expense-00"), physicalBefore.filter((row) => row.id !== "expense-00"), "One edit leaves every unrelated transaction row untouched");
  assert.equal((await fullState()).data.entries.find((entry) => entry.id === "expense-00").date, date);
  assert.equal((await sql`select md5(data::text) as hash from public.ledger where user_id=${user}`)[0].hash, snapshot, "Normalized writes never rewrite legacy JSON");
  const concurrent = await Promise.all([save({ action: "category", kind: "expense", name: "Concurrent A" }, 1), save({ action: "category", kind: "expense", name: "Concurrent B" }, 1)]);
  assert.deepEqual(concurrent.map((response) => response.status).sort(), [200, 409]);
  let state = await fullState();
  assert.equal((await save({ action: "deleteCategory", id: "Bills" }, state.version)).status, 200);
  state = await fullState(); assert.ok(!state.data.categories.some((category) => category.id === "Bills"));
  assert.ok(state.data.entries.find((entry) => entry.id === "expense-00").categoryId === "Bills");
  assert.equal((await sql`select archived from ledger_categories where user_id=${user} and id='Bills'`)[0].archived, true);
  assert.equal((await save({ action: "entry", id: "expense-00", kind: "expense", date, wallet: "bank", currency: "IDR", amount: "1", title: "Archived edit", category: "Bills", description: "" }, state.version)).status, 200);
  state = await fullState();
  const receipt = { importId: randomUUID(), fingerprint: 'a'.repeat(64), method: "ai", documentKind: "receipt", merchant: null, receiptNumber: null, keepItems: false, paymentConfirmed: false, items: [], adjustments: [] };
  const receiptPayload = { action: "receipt", kind: "expense", date, wallet: "bank", currency: "IDR", amount: "2", title: "Receipt", category: "New dining", newCategory: true, description: "", receipt };
  assert.equal((await save(receiptPayload, state.version)).status, 200);
  state = await fullState(); const imported = state.data.entries.find((entry) => entry.receipt);
  assert.equal((await save({ action: "deleteEntry", id: imported.id }, state.version)).status, 200);
  const retry = await save(receiptPayload, state.version); assert.equal(retry.status, 200); assert.ok((await retry.json()).notice);
  assert.equal((await fullState()).data.entries.some((entry) => entry.receipt), false);
  await assert.rejects(sql`update ledger_transactions set wallet_id='alien' where user_id=${user} and id='expense-00'`, { code: '23503' });
  await assert.rejects(sql`update public.ledger set data='{}'::jsonb where user_id=${user}`, { code: 'P0001' });
  state = await fullState(); assert.equal((await save({ action: "deleteEntry", id: "transfer" }, state.version)).status, 200);
  assert.equal((await sql`select count(*)::int as count from ledger_transactions where user_id=${user} and (id='transfer' or transfer_id='transfer')`)[0].count, 0);
  await sql`delete from session where user_id=${user}`;
  assert.equal((await request("/api/ledger")).status, 401, "Joined session reads immediately reject a revoked session");
  console.log("Normalized ledger API checks passed: verified cutover, bounded reads, SQL reports, timezones, literal search, row-level writes, concurrency, archiving, ownership, durable receipt retries, and atomic transfer deletion.");
} finally {
  await sql`delete from public."user" where id in (${user}, ${otherUser})`;
  for (const table of ["ledger", "ledger_wallets", "ledger_categories", "ledger_transactions", "ledger_receipt_imports", "session"]) {
    assert.equal((await sql`select count(*)::int as count from public.${sql(table)} where user_id in (${user}, ${otherUser})`)[0].count, 0);
  }
  await sql.end({ timeout: 1 }); await pool.end();
}

import { ledgerStorageRows } from "../../src/features/ledger/storage.ts";
import { ledgerFromRows } from "../../src/features/ledger/storage.ts";
import { ledgerUsage } from "../../src/features/ledger/usage.ts";

// Test accounts only. Never rewrites the immutable legacy snapshot on fixture resets.
export async function seedLedger(sql, userId, data, version = 0) {
  const rows = ledgerStorageRows(userId, data);
  const write = async (tx) => {
    await tx`insert into public.ledger (user_id, data, version, normalized) values (${userId}, ${tx.json(data)}, ${version}, true)
      on conflict (user_id) do update set version = excluded.version, normalized = true`;
    for (const table of ["ledger_transactions", "ledger_receipt_imports", "ledger_categories", "ledger_wallets"]) await tx`delete from public.${tx(table)} where user_id = ${userId}`;
    const groups = [
      ["ledger_wallets", rows.wallets], ["ledger_categories", rows.categories],
      ["ledger_transactions", rows.entries.filter((entry) => !entry.transferId)],
      ["ledger_transactions", rows.entries.filter((entry) => entry.transferId)],
      ["ledger_receipt_imports", rows.imports],
    ];
    const names = { userId: "user_id", originalDate: "original_date", wallet: "wallet_id", amount: "amount_minor", category: "category_name", categoryId: "category_id", toWallet: "to_wallet_id", toCurrency: "to_currency", received: "received_minor", transferId: "transfer_id", exchangeRate: "exchange_rate", searchText: "search_text", importId: "import_id", entryId: "entry_id" };
    for (const [table, records] of groups) {
      if (!records.length) continue;
      const values = records.map((record) => Object.fromEntries(Object.entries(record).map(([key, value]) => [names[key] ?? key, ["receipt", "details", "exchangeRate"].includes(key) && value !== null ? tx.json(value) : value])));
      // A 10,000-entry fixture must stay below PostgreSQL's bind-parameter limit.
      for (let index = 0; index < values.length; index += 500) {
        await tx`insert into public.${tx(table)} ${tx(values.slice(index, index + 500), ...Object.keys(values[0]))}`;
      }
    }
    const usage = ledgerUsage(ledgerFromRows(rows.wallets, rows.categories, rows.entries, rows.imports));
    await tx`update public.ledger set usage=${tx.json(usage)},usage_version=${version} where user_id=${userId}`;
  };
  return typeof sql.begin === "function" ? sql.begin(write) : write(sql);
}

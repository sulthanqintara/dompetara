export const ledgerTables = {
  wallets: { name: "ledger_wallets", columns: { userId: "user_id", id: "id", name: "name", currencies: "currencies", position: "position" } },
  categories: { name: "ledger_categories", columns: { userId: "user_id", id: "id", name: "name", kind: "kind", system: "system", archived: "archived", position: "position" } },
  entries: { name: "ledger_transactions", columns: { userId: "user_id", id: "id", kind: "kind", date: "date", originalDate: "original_date", wallet: "wallet_id", currency: "currency", amount: "amount_minor", title: "title", category: "category_name", categoryId: "category_id", description: "description", toWallet: "to_wallet_id", toCurrency: "to_currency", received: "received_minor", transferId: "transfer_id", exchangeRate: "exchange_rate", receipt: "receipt", details: "details", searchText: "search_text", position: "position" } },
  imports: { name: "ledger_receipt_imports", columns: { userId: "user_id", importId: "import_id", fingerprint: "fingerprint", entryId: "entry_id", position: "position" } },
} as const;

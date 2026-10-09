import type { Wallet } from "../ledger/ledger.ts";

export const RECEIPT_CONTEXT_LIMITS = {
  categories: 50,
  wallets: 50,
  nameCharacters: 100,
  bytes: 16_000,
  candidates: 200,
} as const;

function shortName(value: string) {
  if (!value || value.length > RECEIPT_CONTEXT_LIMITS.nameCharacters * 2) return false;
  return Array.from(value).length <= RECEIPT_CONTEXT_LIMITS.nameCharacters;
}

export function receiptContext(categories: string[], wallets: Wallet[]) {
  const context: { categories: string[]; wallets: Wallet[] } = { categories: [], wallets: [] };
  const encoder = new TextEncoder();
  const fits = () => encoder.encode(JSON.stringify(context)).byteLength <= RECEIPT_CONTEXT_LIMITS.bytes;
  // Bound selection work for legacy ledgers; never invent shortened names.
  for (const name of categories.slice(0, RECEIPT_CONTEXT_LIMITS.candidates)) {
    if (context.categories.length >= RECEIPT_CONTEXT_LIMITS.categories) break;
    if (!shortName(name)) continue;
    context.categories.push(name);
    if (!fits()) context.categories.pop();
  }
  for (const wallet of wallets.slice(0, RECEIPT_CONTEXT_LIMITS.candidates)) {
    if (context.wallets.length >= RECEIPT_CONTEXT_LIMITS.wallets) break;
    if (!shortName(wallet.name) || !shortName(wallet.id)) continue;
    const value = {
      id: wallet.id,
      name: wallet.name,
      currencies: (["IDR", "USD", "CAD"] as const).filter((currency) => wallet.currencies.includes(currency)),
    };
    context.wallets.push(value);
    if (!fits()) context.wallets.pop();
  }
  return context;
}

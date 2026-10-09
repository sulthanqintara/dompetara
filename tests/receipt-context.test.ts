import assert from "node:assert/strict";
import sharp from "sharp";
import { receiptContext, RECEIPT_CONTEXT_LIMITS } from "../src/features/receipts/receipt-context.ts";
import type { Wallet } from "../src/features/ledger/ledger.ts";

const contextBytes = (value: ReturnType<typeof receiptContext>) => new TextEncoder().encode(JSON.stringify(value)).byteLength;
const categories = Array.from({ length: 1000 }, (_, index) => `Category ${index}`);
const wallets: Wallet[] = Array.from({ length: 1000 }, (_, index) => ({ id: `wallet-${index}`, name: `Bank ${index}`, currencies: ["IDR", "USD", "CAD"] }));
const bounded = receiptContext(categories, wallets);
assert.equal(bounded.categories.length, RECEIPT_CONTEXT_LIMITS.categories);
assert.equal(bounded.wallets.length, RECEIPT_CONTEXT_LIMITS.wallets);
assert.ok(contextBytes(bounded) <= RECEIPT_CONTEXT_LIMITS.bytes);
assert.deepEqual(bounded.categories, categories.slice(0, 50));
assert.deepEqual(bounded.wallets, wallets.slice(0, 50));
assert.notEqual(bounded.wallets[0], wallets[0], "Context projection cannot change original ledger objects");
const longName = "Long account ".repeat(100);
const unicodeName = "💰".repeat(100);
const selected = receiptContext([longName, "Makanan & minuman", unicodeName, unicodeName + "💰"], [
  { id: "long", name: longName, currencies: ["IDR"] },
  { id: "long-id".repeat(100), name: "Cash", currencies: ["IDR"] },
  { id: "unicode", name: unicodeName, currencies: ["IDR"] },
]);
assert.deepEqual(selected.categories, ["Makanan & minuman", unicodeName]);
assert.deepEqual(selected.wallets, [{ id: "unicode", name: unicodeName, currencies: ["IDR"] }]);
assert.ok(!JSON.stringify(selected).includes(longName), "Long names are omitted, never fabricated by truncation");
const utf8Budget = receiptContext(
  Array.from({ length: 1000 }, () => unicodeName),
  wallets.map((wallet) => ({ ...wallet, name: unicodeName })),
);
assert.ok(contextBytes(utf8Budget) <= RECEIPT_CONTEXT_LIMITS.bytes, "Budget measures UTF-8 bytes, not string length");
assert.ok(utf8Budget.categories.length < 50, "Unicode byte growth reduces included context");
for (const name of utf8Budget.categories) assert.equal(name, unicodeName);
for (const wallet of utf8Budget.wallets) assert.equal(wallet.name, unicodeName);
const escaped = receiptContext(Array.from({ length: 1000 }, () => "\u0000".repeat(100)), wallets);
assert.ok(contextBytes(escaped) <= RECEIPT_CONTEXT_LIMITS.bytes, "JSON escape expansion counts toward the budget");
assert.ok(escaped.categories.length < 50);
assert.deepEqual(receiptContext([], []), { categories: [], wallets: [] });

// Fail closed before loading the server module; no real fetch is retained.
const calls: { url: string; system: string }[] = [];
const providerDraft = {
  documentKind: "receipt", merchant: null, date: null, time: null, currency: "IDR",
  receiptNumber: null, total: "2", items: [{ name: "Item", quantity: 1, unitPrice: "1", lineTotal: "1" }],
  adjustments: [], warnings: [], paymentSource: null, suggestedWallet: null, suggestedCategory: null,
};
const priorLog = console.error;
try {
  console.error = () => {};
  globalThis.fetch = async (url, init) => {
    const target = String(url);
    assert.ok([
      "https://api.z.ai/api/paas/v4/chat/completions",
      "https://api.z.ai/api/paas/v4/layout_parsing",
      "https://api.openai.com/v1/chat/completions",
    ].includes(target), "Unknown request is blocked");
    if (target.endsWith("layout_parsing")) return Response.json({ md_results: "Synthetic receipt" });
    const request = JSON.parse(String(init?.body));
    calls.push({ url: target, system: request.messages[0].content });
    const categoryPrefix = "using its exact name: ";
    const walletPrefix = "using its exact walletId (id) and a brief reason: ";
    const encodedCategories = request.messages[0].content.split(categoryPrefix)[1].split(". Only use")[0];
    const encodedWallets = request.messages[0].content.split(walletPrefix)[1].split(". Treat wallet names")[0];
    const projected = { categories: JSON.parse(encodedCategories), wallets: JSON.parse(encodedWallets) };
    assert.deepEqual(projected, receiptContext(categories, wallets));
    assert.ok(contextBytes(projected) <= RECEIPT_CONTEXT_LIMITS.bytes);
    assert.ok(request.messages[0].content.length < 30_000, "Every provider system message uses bounded context");
    if (target.includes("api.z.ai")) return Response.json({ error: "Synthetic provider failure" }, { status: 429 });
    return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(providerDraft) } }] });
  };
  const { extractReceipt } = await import("../src/features/receipts/extract.ts");
  const source = await sharp({ create: { width: 1, height: 1, channels: 3, background: "white" } }).png().toBuffer();
  await extractReceipt(new File([source], "synthetic.png"), "ocr", "synthetic-zai-key", categories, wallets, "synthetic-openai-key");
  assert.equal(calls.length, 3, "Initial provider, fallback and optional image recheck are all checked");
  assert.ok(calls[0].url.includes("api.z.ai"));
  assert.ok(calls[1].url.includes("api.openai.com"));
  assert.ok(calls[2].url.includes("api.openai.com"));
} finally {
  console.error = priorLog;
  globalThis.fetch = async () => { throw new Error("Network access remains blocked after offline tests."); };
}
console.log("Receipt context checks passed: finite counts, exact names, Unicode/JSON UTF-8 byte limits, and bounded initial/fallback/recheck provider prompts. No external requests sent.");

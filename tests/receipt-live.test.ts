import { config } from "dotenv";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { extractReceipt } from "../src/features/receipts/extract.ts";
import { validateReceipt } from "../src/features/receipts/receipts.ts";
import { money } from "../src/features/ledger/money.ts";

config({ path: [".env.local", ".env"], quiet: true });
const key = process.env.ZAI_API_KEY;
assert.ok(key, "Set ZAI_API_KEY before running live receipt checks.");
const samples: { file: string; currency: string; total: string; paymentSource?: string; date?: string; time?: string }[] =
  JSON.parse(await readFile("tests/receipt-images/cases.json", "utf8"));
const requested = process.argv.slice(2);
const selected = samples.filter((sample) => !requested.length || requested.includes(sample.file.replace(/\.png$/, "")));
assert.ok(selected.length, "No matching local samples.");
for (const sample of selected) {
  const bytes = await sharp(`tests/receipt-images/${sample.file}`).rotate()
    .resize({ width: 2500, height: 2500, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 90 }).toBuffer();
  for (const method of ["ocr", "ai"] as const) {
    try {
      const result = await extractReceipt(new File([bytes], sample.file), method, key,
        ["Food & drink", "Shopping", "Software"],
        [{ id: "bca", name: "BCA Main Account", currencies: ["IDR"] },
          { id: "usd", name: "USD wallet", currencies: ["USD"] }]);
      const draft = result.draft;
      assert.equal(draft.currency, sample.currency);
      assert.equal(money(draft.total ?? ""), money(sample.total));
      if (sample.date) assert.equal(draft.date, sample.date, "Expense date must use the payment phase");
      if (sample.time) assert.equal(draft.time, sample.time, "Expense time must use the payment phase");
      if (sample.paymentSource) {
        assert.match(draft.paymentSource ?? "", new RegExp(sample.paymentSource, "i"));
        assert.equal(draft.suggestedWallet?.walletId, "bca");
      }
      let items = "not applicable";
      if (draft.documentKind === "receipt" && draft.items.length) {
        try {
          validateReceipt({ ...result, ...draft, keepItems: true, paymentConfirmed: false }, money(sample.total));
          items = "reconciled";
        } catch { items = "needs correction"; }
      }
      console.log(JSON.stringify({ file: sample.file, method, total: draft.total, currency: draft.currency, date: draft.date, time: draft.time,
        documentKind: draft.documentKind, paymentSource: draft.paymentSource,
        suggestedWallet: draft.suggestedWallet?.walletId ?? null, items, warnings: draft.warnings }));
    } catch (error) {
      process.exitCode = 1;
      console.log(JSON.stringify({ file: sample.file, method,
        error: error instanceof Error && error.name !== "ZodError" ? error.message : "Provider response failed validation." }));
    }
  }
}

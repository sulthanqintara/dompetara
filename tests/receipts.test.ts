import assert from "node:assert/strict";
import {
  draftSchema,
  providerDraftSchema,
  suggestReceiptWallet,
  receiptSchema,
  validateReceipt,
} from "../src/features/receipts/receipts.ts";
import {
  emptyLedger,
  mutateLedger,
  balance,
} from "../src/features/ledger/ledger.ts";
import { ledgerExport } from "../src/features/ledger/export.ts";
const receipt = receiptSchema.parse({
  importId: crypto.randomUUID(),
  fingerprint: "a".repeat(64),
  method: "ocr",
  documentKind: "receipt",
  merchant: "Solaria",
  receiptNumber: "437RC1092026/03626",
  keepItems: true,
  paymentConfirmed: false,
  items: [45455, 45455, 18182, 47273, 9092, 8183].map((value, index) => ({
    name: `Item ${index}`,
    quantity: index === 2 ? 2 : 1,
    unitPrice: null,
    lineTotal: String(value),
  })),
  adjustments: [
    { label: "PB1 10%", amount: "17364" },
    { label: "Rounding", amount: "-4" },
  ],
});
validateReceipt(receipt, 19100000);
assert.throws(() => validateReceipt(receipt, 19100400), /equal/);
assert.throws(
  () =>
    validateReceipt(
      { ...receipt, items: [{ ...receipt.items[0], lineTotal: null }] },
      19100000,
    ),
  /line total/,
);
assert.throws(
  () =>
    validateReceipt(
      {
        ...receipt,
        documentKind: "payment",
        keepItems: false,
        items: [],
        adjustments: [],
      },
      10200000,
    ),
  /Confirm/,
);
validateReceipt(
  {
    ...receipt,
    documentKind: "payment",
    paymentConfirmed: true,
    keepItems: false,
    items: [],
    adjustments: [],
  },
  10200000,
);
assert.equal(draftSchema.safeParse({}).success, false);
const providerDraft = {
  documentKind: "receipt", merchant: null, date: null, time: "18:33:04",
  currency: "IDR", receiptNumber: null, total: "137.445",
  items: [{ name: "Meal", quantity: 1, unitPrice: "119,000", lineTotal: "119.000" }],
  adjustments: [{ label: "Tax", amount: "12.495" }], warnings: [],
};
const normalized = providerDraftSchema.parse(providerDraft);
assert.equal(normalized.total, "137445");
assert.equal(normalized.items[0].unitPrice, "119000");
assert.equal(normalized.items[0].lineTotal, "119000");
assert.equal(normalized.adjustments[0].amount, "12495");
assert.equal(normalized.time, "18:33");
const bcaWallet = { id: "bca", name: "BCA Main Account", currencies: ["IDR"] as const };
const bcaDraft = { ...normalized, paymentSource: "Bank BCA" };
assert.equal(suggestReceiptWallet(bcaDraft, [{ ...bcaWallet, currencies: [...bcaWallet.currencies] }])?.walletId, "bca");
assert.equal(suggestReceiptWallet(bcaDraft, [{ ...bcaWallet, currencies: ["USD"] }]), null);
assert.equal(suggestReceiptWallet(bcaDraft, [
  { ...bcaWallet, currencies: ["IDR"] }, { id: "bca-other", name: "BCA Savings", currencies: ["IDR"] },
]), null, "Multiple matching bank accounts require manual selection");
assert.equal(suggestReceiptWallet({ ...normalized, paymentSource: null }, [{ ...bcaWallet, currencies: [...bcaWallet.currencies] }]), null);
assert.deepEqual(providerDraftSchema.parse({
  ...providerDraft,
  adjustments: [
    { label: "Subtotal", amount: "119.000" },
    { label: "Before Rounding", amount: "137.445" },
    { label: "Service Charge", amount: "5.950" },
    { label: "Rounding", amount: "-4" },
  ],
}).adjustments, [
  { label: "Service Charge", amount: "5950" },
  { label: "Rounding", amount: "-4" },
]);
assert.equal(providerDraftSchema.parse({ ...providerDraft, total: "12.50" }).total, "12.50");
assert.equal(providerDraftSchema.parse({ ...providerDraft, total: "202,177.34" }).total, "202177.34");
assert.equal(providerDraftSchema.parse({ ...providerDraft, total: "202.177,34" }).total, "202177.34");
for (const total of ["1,23", "1.234,567", "Rp137.445", "unknown"])
  assert.equal(providerDraftSchema.safeParse({ ...providerDraft, total }).success, false);
assert.equal(draftSchema.safeParse(providerDraft).success, false);
assert.equal(
  receiptSchema.safeParse({ ...receipt, fingerprint: "invalid" }).success,
  false,
);
assert.equal(
  receiptSchema.safeParse({
    ...receipt,
    items: [{ ...receipt.items[0], lineTotal: "45,455" }],
  }).success,
  false,
);
let data = mutateLedger(emptyLedger(), {
  action: "wallet",
  name: "Bank",
  currency: "IDR",
  amount: "1000000",
});
const wallet = data.wallets[0].id;
const payload = {
  action: "receipt",
  kind: "expense",
  wallet,
  currency: "IDR",
  date: "2026-09-22T11:33:04.000Z",
  amount: "191000",
  title: "Solaria",
  category: "Food & drink",
  receipt,
};
data = mutateLedger(data, payload);
assert.equal(balance(data, wallet, "IDR"), 80900000);
assert.equal(data.entries.length, 2, "Items do not create extra expenses");
assert.deepEqual(
  mutateLedger(data, payload),
  data,
  "Retry cannot duplicate an expense",
);
const entry = data.entries.at(-1)!;
assert.throws(
  () =>
    mutateLedger(data, {
      ...payload,
      action: "entry",
      id: entry.id,
      amount: "190000",
    }),
  /equal/,
);
assert.deepEqual(
  mutateLedger(data, { ...payload, action: "entry", id: entry.id }).entries.at(
    -1,
  )?.receipt,
  receipt,
);
assert.match(
  ledgerExport({ data, version: 1 }, "csv").content,
  /receipt_details/,
);
assert.deepEqual(
  JSON.parse(
    ledgerExport({ data, version: 1 }, "json").content,
  ).data.entries.at(-1).receipt,
  receipt,
);
const deleted = mutateLedger(data, { action: "deleteEntry", id: entry.id });
assert.deepEqual(
  mutateLedger(deleted, payload),
  deleted,
  "Deleting the expense does not permit an accidental retry to recreate it",
);
console.log(
  "Receipt checks passed: exact item reconciliation, nullable fields, payment confirmation, one charge, editing, durable retries and exports.",
);

const giftPayload = {
  ...payload,
  receipt: {
    ...receipt,
    importId: crypto.randomUUID(),
    fingerprint: "c".repeat(64),
  },
  category: "Gifts",
  newCategory: true,
  description: "Birthday gift for a friend",
};
const giftData = mutateLedger(data, giftPayload);
assert.equal(giftData.entries.at(-1)?.category, "Gifts");
assert.equal(
  giftData.entries.at(-1)?.description,
  "Birthday gift for a friend",
);
assert.equal(
  giftData.categories.filter((category) => category.name === "Gifts").length,
  1,
);
assert.deepEqual(
  mutateLedger(giftData, giftPayload),
  giftData,
  "Category and expense retries are atomic",
);
const reused = mutateLedger(giftData, {
  ...giftPayload,
  receipt: {
    ...giftPayload.receipt,
    importId: crypto.randomUUID(),
    fingerprint: "d".repeat(64),
  },
  category: "gIfTs",
});
assert.equal(reused.entries.at(-1)?.category, "Gifts");
assert.equal(
  reused.categories.filter(
    (category) => category.name.toLowerCase() === "gifts",
  ).length,
  1,
);
const original = structuredClone(data);
assert.throws(() =>
  mutateLedger(data, {
    ...giftPayload,
    category: "Must not be created",
    wallet: "not-owned",
  }),
);
assert.deepEqual(data, original, "Rejected expenses never create categories");
assert.equal(
  JSON.parse(
    ledgerExport({ data: giftData, version: 1 }, "json").content,
  ).data.entries.at(-1).description,
  "Birthday gift for a friend",
);
assert.match(
  ledgerExport({ data: giftData, version: 1 }, "csv").content,
  /Birthday gift for a friend/,
);
console.log(
  "Category/note checks passed: atomic creation, case-insensitive reuse, rejected-save isolation, retry safety and exported notes.",
);

// Manual and imported item details share validation and exact money arithmetic.
const detailedLedger = emptyLedger();
detailedLedger.wallets = [{id:"cash",name:"Cash",currencies:["IDR"]}];
const itemDetails = {
  receiptNumber: null, keepItems: true,
  items: [7500,5000,12500,500].map((price,index)=>({name:`Item ${index}`,quantity:1,unitPrice:String(price),lineTotal:String(price)})),
  adjustments: [{label:"Voucher",amount:"-600"},{label:"Discount",amount:"-500"}],
};
const manualPayload = {action:"entry",kind:"expense",date:"2026-10-03T12:59:00Z",wallet:"cash",currency:"IDR",amount:"24400",title:"Indomaret",category:"Food & drink",description:"",details:itemDetails};
const manual = mutateLedger(detailedLedger,manualPayload);
assert.equal(manual.entries[0].amount,2440000);
assert.deepEqual(manual.entries[0].details,itemDetails);
assert.equal(manual.entries[0].receipt,undefined,"Manual details do not invent receipt import provenance");
assert.throws(()=>mutateLedger(detailedLedger,{...manualPayload,amount:"25000"}),/equal/);
const taxedDetails = {...itemDetails,adjustments:[...itemDetails.adjustments,{label:"Tax",amount:"1000"}]};
assert.equal(mutateLedger(detailedLedger,{...manualPayload,amount:"25400",details:taxedDetails}).entries[0].amount,2540000);
const manualEdited = mutateLedger(manual,{...manualPayload,id:manual.entries[0].id,title:"Groceries"});
assert.deepEqual(manualEdited.entries[0].details,itemDetails);
assert.equal(manualEdited.entries[0].title,"Groceries");
assert.match(ledgerExport({data:manual,version:1},"csv").content,/transaction_details/);

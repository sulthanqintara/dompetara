import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { readLimitedBody } from "../src/lib/read-limited-body.ts";
import { extractReceipt } from "../src/features/receipts/extract.ts";
import { draftSchema, validateReceipt } from "../src/features/receipts/receipts.ts";
const source = await sharp({
  create: { width: 100, height: 100, channels: 3, background: "white" },
})
  .png()
  .toBuffer();
const file = new File([source], "receipt.png", { type: "image/png" });
const draft = {
  documentKind: "receipt",
  merchant: "Test",
  date: "2026-09-22",
  time: "18:33",
  currency: "IDR",
  receiptNumber: null,
  total: "191000",
  items: [],
  adjustments: [],
  warnings: [],
  suggestedCategory: { name: "Food & drink", reason: "Restaurant meal" },
  paymentSource: null,
  suggestedWallet: null,
};
const original = globalThis.fetch;
const originalLog = console.error;
const errors: { provider?: string; status?: number; stage?: string; message: string }[] = [];
const calls: { url: string; body: Record<string, unknown> }[] = [];
try {
  console.error = (_label, entry) => errors.push(entry);
  globalThis.fetch = async (input, init) => {
    assert.equal(
      new Headers(init?.headers).get("Authorization"),
      "Bearer test-only-key",
    );
    assert.ok(init?.signal);
    const body = JSON.parse(String(init?.body));
    calls.push({ url: String(input), body });
    return Response.json(
      String(input).endsWith("layout_parsing")
        ? { md_results: "Test receipt" }
        : {
            choices: [
              {
                finish_reason: "stop",
                message: {
                  content: "```json\n" + JSON.stringify(draft) + "\n```",
                },
              },
            ],
          },
    );
  };
  const ocr = await extractReceipt(file, "ocr", "test-only-key", [
    "Food & drink",
    "Shopping",
  ]);
  assert.deepEqual(ocr.draft, draft);
  assert.ok(
    JSON.stringify(calls[1].body).includes("Food & drink"),
    "Existing categories are supplied to the model",
  );
  assert.equal(calls.length, 2);
  assert.equal(calls[0].body.model, "glm-ocr");
  assert.match(String(calls[0].body.file), /^data:image\/jpeg;base64,/);
  assert.equal(calls[1].body.model, "glm-4.6v-flash");
  assert.match(JSON.stringify(calls[1].body.messages), /choose the payment timestamp/);
  assert.match(JSON.stringify(calls[1].body.messages), /Waktu Pembayaran/);
  assert.equal(
    typeof (calls[1].body.messages as { content: unknown }[])[1].content,
    "string",
    "OCR structuring call uses text, not another image",
  );
  await extractReceipt(file, "ocr", "test-only-key", ["Food & drink"], [], undefined, "id");
  assert.match(JSON.stringify(calls.at(-1)?.body.messages), /Write warnings, suggestion reasons and new category suggestions in Bahasa Indonesia/);
  assert.match(JSON.stringify(calls.at(-1)?.body.messages), /Preserve printed merchant names, item names, receipt numbers, payment sources and existing category names exactly/);
  globalThis.fetch = async (input) => Response.json(String(input).endsWith("layout_parsing")
    ? {md_results:"INDOMARET\n03.10.26-19:59/4.5.0/TZXN-3517/RAFFA/01"}
    : {choices:[{finish_reason:"stop",message:{content:JSON.stringify({...draft,date:"2026-03-10",time:"19:59",warnings:["PPN breakdown provided but not included in adjustments as per schema","Total is unclear."]})}}]});
  const indomaret = await extractReceipt(file,"ocr","test-only-key");
  assert.equal(indomaret.draft.date,"2026-10-03");
  assert.equal(indomaret.draft.time,"19:59");
  assert.deepEqual(indomaret.draft.warnings,["Total is unclear."]);
  const food = draftSchema.parse(JSON.parse(readFileSync("tests/fixtures/shopee-food.json", "utf8")));
  const misread = {...food,
    items: food.items.map((item, i) => i === 2 ? {...item, lineTotal: "41000"} : item),
    adjustments: food.adjustments.map(row => row.label === "Biaya Pengiriman" ? {...row, amount: "6500"} : row),
  };
  let repairCalls = 0;
  let repairDraft = food;
  globalThis.fetch = async (input, init) => {
    if (String(input).endsWith("layout_parsing")) return Response.json({md_results: "Subtotal Rp72.000 Voucher -Rp32.400 Delivery Rp6.500 Rp500 Service Rp3.500 Total Rp43.600"});
    repairCalls++;
    const request = JSON.parse(String(init?.body));
    assert.match(request.messages[0].content, /never crossed-out original prices/);
    if (repairCalls === 2) {
      assert.ok(Array.isArray(request.messages[1].content), "Inconsistent OCR is rechecked with the image");
      assert.match(request.messages[1].content[1].image_url.url, /^data:image\/jpeg;base64,/);
    }
    return Response.json({choices:[{finish_reason:"stop",message:{content:JSON.stringify(repairCalls === 1 ? misread : repairDraft)}}]});
  };
  const repaired = await extractReceipt(file, "ocr", "test-only-key");
  assert.equal(repairCalls, 2);
  assert.deepEqual(repaired.draft.items, food.items);
  assert.deepEqual(repaired.draft.adjustments, food.adjustments);
  validateReceipt({...repaired, ...repaired.draft, keepItems: true, paymentConfirmed: false}, 4360000);
  repairCalls = 0;
  repairDraft = {...food, total: "43600.00"};
  assert.deepEqual((await extractReceipt(file, "ocr", "test-only-key")).draft.items, food.items, "Equivalent decimal formatting preserves the final charge");
  repairCalls = 0;
  repairDraft = {...food, total: "90600"};
  const changedTotal = await extractReceipt(file, "ocr", "test-only-key");
  assert.equal(changedTotal.draft.total, "43600", "Recheck cannot change the final expense to make items fit");
  assert.deepEqual(changedTotal.draft.items, misread.items);
  repairCalls = 0;
  repairDraft = misread;
  const unresolved = await extractReceipt(file, "ocr", "test-only-key");
  assert.throws(() => validateReceipt({...unresolved, ...unresolved.draft, keepItems: true, paymentConfirmed: false}, 4360000), /equal/, "Unresolved extraction cannot bypass exact reconciliation");
  repairCalls = 0;
  repairDraft = {...food, items: []};
  assert.deepEqual((await extractReceipt(file, "ocr", "test-only-key")).draft.items, misread.items, "Recheck cannot discard items and force total-only mode");
  globalThis.fetch = async (input) => String(input).endsWith("layout_parsing")
    ? Response.json({md_results: "Order screenshot"})
    : ++repairCalls === 1
    ? Response.json({choices:[{finish_reason:"stop",message:{content:JSON.stringify(misread)}}]})
    : Response.json({}, {status:429});
  repairCalls = 0;
  assert.deepEqual((await extractReceipt(file, "ocr", "test-only-key")).draft.items, misread.items, "Failed optional recheck retains the editable OCR draft");
  globalThis.fetch = async (input,init) => {
    calls.push({url:String(input),body:JSON.parse(String(init?.body))});
    return Response.json({choices:[{finish_reason:"stop",message:{content:JSON.stringify(draft)}}]});
  };
  calls.length = 0;
  const ai = await extractReceipt(file, "ai", "test-only-key");
  assert.equal(calls.length, 1);
  assert.equal(ai.fingerprint, ocr.fingerprint);
  assert.ok(
    Array.isArray(
      (calls[0].body.messages as { content: unknown }[])[1].content,
    ),
  );
  calls.length = 0;
  const largeImage = await sharp({
    create: { width: 2400, height: 1200, channels: 3, background: "white" },
  }).png().toBuffer();
  await extractReceipt(new File([largeImage], "large.png"), "ai", "test-only-key");
  const imageContent = (calls[0].body.messages as { content: { image_url?: { url: string } }[] }[])[1].content;
  const uploadedImage = imageContent.find((part) => part.image_url)?.image_url?.url;
  assert.ok(uploadedImage);
  const resized = await sharp(Buffer.from(uploadedImage.split(",")[1], "base64")).metadata();
  assert.equal(resized.width, 1600, "Provider images are capped at 1600px");
  assert.equal(resized.height, 800, "Resizing preserves aspect ratio");
  const bca = { id: "bca", name: "BCA Main Account", currencies: ["IDR"] as const };
  const screenshot = {
    ...draft, merchant: "Shopee", total: "81200", paymentSource: "Bank BCA",
    suggestedWallet: { walletId: "bca", reason: "Payment method explicitly lists Bank BCA." },
  };
  globalThis.fetch = async (_input, init) => {
    assert.ok(String(init?.body).includes("BCA Main Account"));
    return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(screenshot) } }] });
  };
  const shopee = await extractReceipt(file, "ai", "test-only-key", [], [{ ...bca, currencies: [...bca.currencies] }]);
  assert.equal(shopee.draft.total, "81200");
  assert.equal(shopee.draft.suggestedWallet?.walletId, "bca");
  screenshot.suggestedWallet.walletId = "someone-elses-wallet";
  assert.equal((await extractReceipt(file, "ai", "test-only-key", [], [{ ...bca, currencies: [...bca.currencies] }])).draft.suggestedWallet?.walletId, "bca", "Visible source matches a real wallet even if the model invents an ID");
  screenshot.suggestedWallet.walletId = "bca";
  assert.equal((await extractReceipt(file, "ai", "test-only-key", [], [{ ...bca, currencies: ["USD"] }])).draft.suggestedWallet, null);
  globalThis.fetch = async () => Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({
    ...draft, documentKind: "payment", merchant: "OpenAI", date: null, time: null,
    total: "202,177.34", warnings: ["Pending bank debit; full date is not visible."],
  }) } }] });
  const openai = await extractReceipt(file, "ai", "test-only-key");
  assert.equal(openai.draft.currency, "IDR");
  assert.equal(openai.draft.total, "202177.34");
  assert.equal(openai.draft.suggestedWallet, null);
  assert.deepEqual(openai.draft.items, []);
  globalThis.fetch = async () =>
    Response.json({
      choices: [{ finish_reason: "length", message: { content: "{}" } }],
    });
  await assert.rejects(
    extractReceipt(file, "ai", "test-only-key"),
    /incomplete/,
  );
  globalThis.fetch = async () =>
    Response.json({ error: "secret provider details" }, { status: 429 });
  await assert.rejects(extractReceipt(file, "ai", "test-only-key"), /busy/);
  assert.ok(errors.some((entry) => entry.provider === "z.ai" && entry.status === 429 && entry.message === "secret provider details"));
  globalThis.fetch = async (input) => String(input).includes("api.z.ai")
    ? Response.json({ error: { message: "Provider quota exceeded" } }, { status: 429 })
    : Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(draft) } }] });
  assert.deepEqual((await extractReceipt(file, "ai", "test-only-key", [], [], "openai-test-key")).draft, draft);
  assert.ok(errors.some((entry) => entry.status === 429 && entry.message === "Provider quota exceeded"));
  assert.ok(errors.some((entry) => entry.stage === "OpenAI fallback"));
  await assert.rejects(
    extractReceipt(
      new File(["not an image"], "bad.png"),
      "ai",
      "test-only-key",
    ),
  );
  globalThis.fetch = async () => {
    throw new Error("secret API key in transport error");
  };
  await assert.rejects(
    extractReceipt(file, "ai", "test-only-key"),
    (error: unknown) =>
      error instanceof Error &&
      !error.message.includes("secret") &&
      error.message.includes("receipt service"),
  );
  await assert.rejects(
    readLimitedBody(new Response(new Uint8Array(101)).body, 100),
    /too large/,
  );
} finally {
  globalThis.fetch = original;
  console.error = originalLog;
}
console.log(
  "Provider checks passed: OCR/text and direct-image requests, consistent fingerprints, timeout signal, invalid images, incomplete output and provider failures. No external requests sent.",
);

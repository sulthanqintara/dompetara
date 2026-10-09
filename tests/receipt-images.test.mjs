import { createSessionTokenCodec } from "../src/lib/auth-privacy/create-session-token-codec.ts";
import "dotenv/config";
import assert from "node:assert/strict";
import { createHmac, randomUUID, randomBytes } from "node:crypto";
import { readFile, mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import postgres from "postgres";
import sharp from "sharp";

// Run with the local Storage double and app configured with its test credentials.
// This suite uses synthetic images and temporary accounts only.
const origin = process.env.LEDGER_TEST_URL ?? "http://localhost:3000";
const storage = process.env.RECEIPT_STORAGE_TEST_URL;
assert.ok(
  storage?.startsWith("http://127.0.0.1:"),
  "Set RECEIPT_STORAGE_TEST_URL to the local storage double.",
);
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 2 });
const ids = [randomUUID(), randomUUID()];
const tokens = [randomUUID(), randomUUID()];
const cookies = tokens.map((token) => {
  const signature = createHmac("sha256", process.env.BETTER_AUTH_SECRET)
    .update(token)
    .digest("base64");
  return encodeURIComponent(`${token}.${signature}`);
});
const fixture = await readFile("tests/fixtures/receipt.png");
const date = new Date().toISOString();
const screenshots = process.env.RESPONSIVE_SCREENSHOTS;
const state = async (actor = 0) =>
  (await request("/api/ledger", {}, actor)).json();
function request(path, options = {}, actor = 0) {
  return fetch(`${origin}${path}`, {
    ...options,
    headers: {
      Origin: origin,
      ...(actor !== null
        ? { Cookie: `better-auth.session_token=${cookies[actor]}` }
        : {}),
      ...options.headers,
    },
  });
}
async function control(values) {
  assert.ok(
    (
      await fetch(`${storage}/test-control`, {
        method: "POST",
        body: JSON.stringify(values),
      })
    ).ok,
  );
}
async function objects() {
  return (await (await fetch(`${storage}/test-state`)).json()).ids;
}
async function cleanup() {
  return request("/api/receipts/cleanup", {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
}
function receiptPayload(version, title = "Private receipt") {
  return {
    action: "receipt",
    version,
    kind: "expense",
    title,
    date,
    wallet: "bank",
    currency: "IDR",
    amount: "10",
    category: "Food",
    description: "Synthetic receipt test",
    receipt: {
      importId: randomUUID(),
      fingerprint: randomBytes(32).toString("hex"),
      method: "ocr",
      documentKind: "receipt",
      merchant: title,
      receiptNumber: null,
      paymentConfirmed: true,
      keepItems: false,
      items: [],
      adjustments: [],
    },
  };
}
function save(payload, image, actor = 0) {
  if (image) {
    const form = new FormData();
    form.set("payload", JSON.stringify(payload));
    form.set("image", new Blob([image], { type: "image/png" }), "private.png");
    return request("/api/ledger", { method: "POST", body: form }, actor);
  }
  return request(
    "/api/ledger",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    actor,
  );
}
async function savedImage(image = fixture) {
  const before = await state();
  const payload = receiptPayload(before.version);
  const response = await save(payload, image);
  assert.equal(response.status, 200, await response.text().catch(() => ""));
  const after = await state();
  return { entry: after.data.entries.at(-1), payload, version: after.version };
}
async function checkLayout(page, name, width, height) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter(
          (animation) => animation.effect?.getTiming().iterations !== Infinity,
        )
        .map((animation) => animation.finished.catch(() => {})),
    ),
  );
  await page.evaluate(() => document.fonts.ready);
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    `${name}: no page overflow at ${width}x${height}`,
  );
  const dialog = page.getByRole("dialog").last();
  if (await dialog.count()) {
    const bounds = await dialog.boundingBox();
    assert.ok(
      bounds.x >= -1 &&
        bounds.y >= -1 &&
        bounds.x + bounds.width <= width + 1 &&
        bounds.y + bounds.height <= height + 1,
      `${name}: dialog fits viewport`,
    );
    assert.ok(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      `${name}: no dialog overflow`,
    );
  }
  for (const button of await page.getByRole("button").all()) {
    if (await button.evaluate((element) => element.getRootNode() !== document))
      continue;
    if (!(await button.isVisible())) continue;
    const bounds = await button.boundingBox();
    assert.ok(
      bounds.width >= 43 && bounds.height >= 43,
      `${name}: touch target ${(await button.getAttribute("aria-label")) ?? (await button.innerText())}`,
    );
  }
  if (screenshots)
    await page.screenshot({
      path: `${screenshots}/${name}-${width}x${height}.png`,
    });
}

let browser;
try {
  if (screenshots) await mkdir(screenshots, { recursive: true });
  for (let actor = 0; actor < 2; actor++) {
    await sql`insert into public."user" (id, name, email) values (${ids[actor]}, 'Receipt image test', ${ids[actor] + "@example.invalid"})`;
    await sql`insert into public.user_preferences(user_id,locale,language_prompt_shown_at) values(${ids[actor]},'en',now())`;
    await sql`insert into public.session (id, user_id, token, token_hash, expires_at, updated_at) values (${randomUUID()}, ${ids[actor]}, ${await createSessionTokenCodec(process.env.BETTER_AUTH_SECRET).encrypt(tokens[actor])}, ${createSessionTokenCodec(process.env.BETTER_AUTH_SECRET).hash(tokens[actor])}, ${new Date(Date.now() + 3600000)}, ${new Date()})`;
    await sql`insert into public.ledger (user_id, data) values (${ids[actor]}, ${sql.json({ wallets: [{ id: "bank", name: "Bank", currencies: ["IDR"] }], categories: [{ id: "food", name: "Food", kind: "expense" }], entries: [] })})`;
  }
  const baselineObjects = await objects();
  const [protection] = await sql`select c.relrowsecurity as rls,
    has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE') as anon_access,
    has_table_privilege('authenticated', c.oid, 'SELECT, INSERT, UPDATE, DELETE') as authenticated_access
    from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='receipt_images'`;
  assert.equal(protection.rls, true);
  assert.equal(protection.anon_access, false);
  assert.equal(protection.authenticated_access, false);
  assert.equal(
    (await request("/api/receipts/image?id=" + randomUUID(), {}, null)).status,
    401,
  );
  assert.equal((await request("/api/receipts/cleanup", {}, null)).status, 401);
  let before = await state();
  assert.equal((await save(receiptPayload(before.version))).status, 200);
  assert.equal(
    (await state()).data.entries.at(-1).receipt.imageId,
    undefined,
    "Opt-out never saves an image",
  );
  assert.deepEqual(await objects(), baselineObjects);

  const sourceWithMetadata = await sharp(fixture)
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  assert.ok((await sharp(sourceWithMetadata).metadata()).exif);
  const saved = await savedImage(sourceWithMetadata);
  const imageId = saved.entry.receipt.imageId;
  assert.ok(imageId);
  const downloaded = await request(`/api/receipts/image?id=${imageId}`);
  assert.equal(downloaded.status, 200);
  assert.match(downloaded.headers.get("cache-control"), /private, no-store/);
  assert.equal(downloaded.headers.get("content-type"), "image/jpeg");
  assert.equal(downloaded.headers.get("x-content-type-options"), "nosniff");
  const metadata = await sharp(
    Buffer.from(await downloaded.arrayBuffer()),
  ).metadata();
  assert.equal(metadata.format, "jpeg");
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.icc, undefined);
  assert.equal(
    (await request(`/api/receipts/image?id=${imageId}`, {}, 1)).status,
    404,
    "Other users cannot view images",
  );
  assert.equal(
    (await request(`/api/receipts/image?id=${imageId}`, {}, null)).status,
    401,
  );
  const forged = receiptPayload((await state(1)).version);
  forged.receipt.imageId = imageId;
  assert.equal((await save(forged, undefined, 1)).status, 200);
  assert.equal(
    (await state(1)).data.entries.at(-1).receipt.imageId,
    undefined,
    "Client image IDs cannot attach another user's image",
  );
  assert.equal(
    (
      await save(
        {
          action: "removeReceiptImage",
          id: saved.entry.id,
          version: (await state(1)).version,
        },
        undefined,
        1,
      )
    ).status,
    400,
  );

  // Lost-response retries do not upload twice or charge the wallet twice.
  const count = (await objects()).length;
  assert.equal((await save(saved.payload, fixture)).status, 200);
  assert.equal((await objects()).length, count);
  assert.equal((await state()).version, saved.version);

  // An upload may store bytes before reporting failure. It must still be cleaned.
  before = await state();
  await control({ failUpload: true });
  assert.equal(
    (await save(receiptPayload(before.version), fixture)).status,
    503,
  );
  await control({ failUpload: false });
  assert.equal((await state()).version, before.version);
  assert.equal((await objects()).length, count);
  assert.equal(
    (await save(receiptPayload(before.version), Buffer.from("not an image")))
      .status,
    400,
  );
  assert.equal((await state()).version, before.version);

  // Conflict after upload must roll back the image link and clean the object.
  await control({ uploadDelay: 1000 });
  const conflict = save(receiptPayload(before.version), fixture);
  await new Promise((resolve) => setTimeout(resolve, 500));
  await sql`update public.ledger set version = version + 1 where user_id = ${ids[0]}`;
  assert.equal((await conflict).status, 409);
  await control({ uploadDelay: 0 });
  assert.equal((await objects()).length, count);

  // Removal immediately revokes reads even when physical deletion fails.
  await control({ failDelete: true });
  assert.equal(
    (
      await save({
        action: "removeReceiptImage",
        id: saved.entry.id,
        version: (await state()).version,
      })
    ).status,
    200,
  );
  assert.equal(
    (await request(`/api/receipts/image?id=${imageId}`)).status,
    404,
  );
  const [queued] =
    await sql`select state from public.receipt_images where id = ${imageId}`;
  assert.equal(queued.state, "deleting");
  assert.equal((await cleanup()).status, 503);
  await control({ failDelete: false });
  assert.equal((await cleanup()).status, 200);
  assert.ok(!(await objects()).includes(imageId));

  if (process.env.RECEIPT_IMAGES_API_ONLY !== "1") {
    browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    });
    for (const [width, height] of [
      [320, 568],
      [390, 844],
      [568, 320],
      [768, 1024],
      [844, 390],
      [1024, 768],
      [1200, 800],
      [1440, 900],
    ]) {
      const context = await browser.newContext({ viewport: { width, height }, locale: "en-US" });
      await context.addCookies([
        {
          name: "better-auth.session_token",
          value: cookies[0],
          url: origin,
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${origin}/transactions`);
      await page.addStyleTag({
        content: "nextjs-portal { pointer-events: none; }",
      });
      await page
        .getByRole("button", { name: "Add transaction", exact: true })
        .click();
      await page
        .getByRole("menuitem", { name: "Expense", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Import receipt", exact: true })
        .click();
      const extraction = {
        importId: randomUUID(),
        fingerprint: randomBytes(32).toString("hex"),
        method: "ocr",
        draft: {
          documentKind: "receipt",
          merchant: `Image layout ${width}`,
          date: date.slice(0, 10),
          time: "12:00",
          currency: "IDR",
          receiptNumber: null,
          total: "10",
          items: [],
          adjustments: [],
          warnings: [],
          suggestedCategory: { name: "Food", reason: "Test" },
          paymentSource: null,
          suggestedWallet: null,
        },
      };
      await page.route("**/api/receipts/extract", (route) =>
        route.fulfill({ json: extraction }),
      );
      await page.getByLabel("Receipt image", { exact: true }).setInputFiles({
        name: "receipt.png",
        mimeType: "image/png",
        buffer: fixture,
      });
      await page
        .getByRole("button", { name: "Read receipt", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      const optIn = dialog.getByRole("checkbox", {
        name: "Save receipt image",
        exact: true,
      });
      assert.equal(await optIn.isChecked(), false);
      await optIn.scrollIntoViewIfNeeded();
      await checkLayout(page, "image-opt-in", width, height);
      await optIn.focus();
      await page.keyboard.press("Space");
      assert.equal(await optIn.isChecked(), true);
      const wallet = dialog.getByRole("combobox", {
        name: "Wallet",
        exact: true,
      });
      await wallet.click();
      await page.getByRole("option", { name: "Bank", exact: true }).click();
      const response = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/ledger") &&
          response.request().method() === "POST",
      );
      await dialog.getByRole("button", { name: "Save", exact: true }).click();
      const result = await response;
      assert.equal(result.status(), 200, await result.text());
      const entry = (await result.json()).data.entries.at(-1);
      assert.ok(entry.receipt.imageId);
      await dialog.waitFor({ state: "detached" });
      await page.reload();
      const view = page.getByRole("button", {
        name: `View receipt for Image layout ${width}`,
        exact: true,
      });
      await view.click();
      await page
        .getByRole("img", { name: "Saved receipt image", exact: true })
        .waitFor();
      await checkLayout(page, "image-history-viewer", width, height);
      await page
        .getByRole("button", { name: "Show full-size image", exact: true })
        .click();
      await checkLayout(page, "image-history-full-size", width, height);
      await page
        .getByRole("button", { name: "Fit image", exact: true })
        .click();
      await page.keyboard.press("Escape");
      await page.getByRole("dialog").waitFor({ state: "detached" });
      assert.equal(
        await view.evaluate((element) => element === document.activeElement),
        true,
        "Viewer restores focus",
      );
      // Retry after a failed image fetch, then confirm deletion in the viewer.
      await page.route("**/api/receipts/image?*", (route) =>
        route.fulfill({ status: 503, json: { error: "Test failure" } }),
      );
      await view.click();
      await page
        .getByRole("button", { name: "Retry image", exact: true })
        .waitFor();
      await checkLayout(page, "image-load-error", width, height);
      await page.unroute("**/api/receipts/image?*");
      await page
        .getByRole("button", { name: "Retry image", exact: true })
        .click();
      await page
        .getByRole("img", { name: "Saved receipt image", exact: true })
        .waitFor();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Remove image", exact: true })
        .click();
      await checkLayout(page, "image-removal-confirmation", width, height);
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: "Remove image", exact: true })
        .click();
      await page.getByRole("dialog").waitFor({ state: "detached" });
      assert.equal(await view.count(), 0);
      await page.waitForFunction(
        (title) =>
          document.activeElement?.getAttribute("aria-label") ===
          `Edit ${title}`,
        `Image layout ${width}`,
      );
      await page
        .getByRole("button", {
          name: `Edit Image layout ${width}`,
          exact: true,
        })
        .click();
      await dialog
        .getByLabel("Attach receipt image", { exact: true })
        .setInputFiles({
          name: "receipt.png",
          mimeType: "image/png",
          buffer: fixture,
        });
      await dialog
        .getByRole("checkbox", { name: "Save receipt image", exact: true })
        .check();
      await checkLayout(page, "image-attach-existing", width, height);
      const attached = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/ledger") &&
          response.request().method() === "POST",
      );
      await dialog.getByRole("button", { name: "Save", exact: true }).click();
      assert.equal((await attached).status(), 200);
      await dialog.waitFor({ state: "detached" });
      await page
        .getByRole("button", {
          name: `Edit Image layout ${width}`,
          exact: true,
        })
        .click();
      await dialog
        .getByRole("img", { name: "Saved receipt image", exact: true })
        .waitFor();
      await checkLayout(page, "image-edit-existing", width, height);
      await dialog
        .getByRole("checkbox", {
          name: "Remove saved receipt image",
          exact: true,
        })
        .check();
      const removed = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/ledger") &&
          response.request().method() === "POST",
      );
      await dialog.getByRole("button", { name: "Save", exact: true }).click();
      assert.equal((await removed).status(), 200);
      await dialog.waitFor({ state: "detached" });
      assert.equal(await view.count(), 0);
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`Receipt image UI passed at ${width}x${height}.`);
    }
  }
  const deleted = await savedImage();
  assert.equal(
    (
      await save({
        action: "deleteEntry",
        id: deleted.entry.id,
        version: deleted.version,
      })
    ).status,
    200,
  );
  assert.ok(!(await objects()).includes(deleted.entry.receipt.imageId));
  const accountImage = await savedImage();
  await sql`delete from public."user" where id = ${ids[0]}`;
  const [orphan] =
    await sql`select user_id from public.receipt_images where id = ${accountImage.entry.receipt.imageId}`;
  assert.equal(
    orphan.user_id,
    null,
    "Account deletion retains a cleanup record",
  );
  assert.equal((await cleanup()).status, 200);
  assert.ok(!(await objects()).includes(accountImage.entry.receipt.imageId));
  const stagedId = randomUUID();
  await sql`insert into public.receipt_images(id,user_id,state,created_at) values(${stagedId},${ids[1]},'staged',${new Date(Date.now() - 7200000)})`;
  assert.equal((await cleanup()).status, 200);
  assert.equal(
    (await sql`select id from public.receipt_images where id = ${stagedId}`)
      .length,
    0,
  );
  console.log(
    "Receipt image API checks passed: ownership, metadata stripping, opt-out, retries, failed uploads/deletes, concurrent saves, and account/transaction cleanup.",
  );
  if (process.env.RECEIPT_IMAGES_API_ONLY !== "1")
    console.log(
      "Receipt image browser checks passed at eight responsive layouts.",
    );
} finally {
  await browser?.close();
  await control({ failUpload: false, failDelete: false, uploadDelay: 0 });
  await sql`delete from public."user" where id in ${sql(ids)}`;
  await cleanup();
  await sql.end({ timeout: 1 });
}

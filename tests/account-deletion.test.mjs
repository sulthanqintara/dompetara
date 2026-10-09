import "dotenv/config";
import { createSessionTokenCodec } from "../src/lib/auth-privacy/create-session-token-codec.ts";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import postgres from "postgres";
import { chromium } from "playwright";

const origin = process.env.LEDGER_TEST_URL ?? "http://localhost:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname), "Run only against a local app.");
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
const ids = [], images = [];
const codec = createSessionTokenCodec(process.env.BETTER_AUTH_SECRET);
const directory = process.env.ACCOUNT_DELETION_SCREENSHOTS;
if (directory) await mkdir(directory, { recursive: true });

async function fixture(stale = false) {
  const id = randomUUID(), token = randomUUID(), image = randomUUID();
  ids.push(id);
  images.push(image);
  await sql.begin(async (tx) => {
    await tx`insert into "user" (id, name, email) values (${id}, ${"Long account name ".repeat(8)}, ${id + "@example.invalid"})`;
    await tx`insert into account (id, account_id, provider_id, user_id, updated_at) values (${randomUUID()}, ${id}, 'google', ${id}, now())`;
    for (const sessionToken of [token, randomUUID()]) {
      await tx`insert into session (id, user_id, token, token_hash, expires_at, created_at, updated_at) values (${randomUUID()}, ${id}, ${await codec.encrypt(sessionToken)}, ${codec.hash(sessionToken)}, ${new Date(Date.now() + 3600000)}, ${new Date(Date.now() - (stale ? 172800000 : 0))}, now())`;
    }
    await tx`insert into ledger (user_id, data) values (${id}, ${tx.json({ wallets: [], entries: [], categories: [] })})`;
    await tx`insert into user_preferences (user_id, locale, language_prompt_shown_at) values (${id}, null, now())`;
    // No real storage object: this row verifies deletion queues orphan cleanup.
    await tx`insert into receipt_images (id, user_id, state) values (${image}, ${id}, 'active')`;
  });
  const signature = createHmac("sha256", process.env.BETTER_AUTH_SECRET).update(token).digest("base64");
  return { id, image, cookie: encodeURIComponent(`${token}.${signature}`) };
}

try {
  const anonymous = await fetch(`${origin}/api/auth/delete-user`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: "{}" });
  assert.equal(anonymous.status, 401);
  const untouched = await fixture();
  for (const locale of ["en", "id"]) {
    const messages = JSON.parse(await readFile(new URL(`../messages/${locale}.json`, import.meta.url)));
    const t = messages.UI;
    const current = await fixture();
    const context = await browser.newContext();
    await context.addCookies([
      { name: "better-auth.session_token", value: current.cookie, url: origin },
      { name: "locale", value: locale, url: origin },
    ]);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" && /hydrat/i.test(message.text())) errors.push(message.text());
    });
    await page.goto(`${origin}/settings`);
    for (const [width, height] of [[320,568], [768,1024], [1440,900], [568,320]]) {
      await page.setViewportSize({ width, height });
      const trigger = page.getByRole("button", { name: t.deleteAccount, exact: true });
      await trigger.scrollIntoViewIfNeeded();
      if (directory) await page.screenshot({ path: `${directory}/${locale}-settings-${width}-${height}.png`, fullPage: true, caret: "initial" });
      await trigger.click();
      const dialog = page.getByRole("alertdialog", { name: t.deleteAccountQuestion });
      await dialog.waitFor();
      await dialog.evaluate(async (el) => { await Promise.all(el.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => {}))); });
      assert.ok((await dialog.innerText()).includes(t.deleteAccountDescription));
      const heading = await dialog.getByRole("heading", { name: t.deleteAccountQuestion }).boundingBox();
      assert.ok(heading.y >= 0 && heading.y + heading.height <= height, "Warning heading is visible on open");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      for (const button of await dialog.getByRole("button").all()) {
        const box = await button.boundingBox();
        assert.ok(box.width >= 44 && box.height >= 44, `${await button.innerText()}: ${JSON.stringify(box)}`);
      }
      const box = await dialog.boundingBox();
      assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= height);
      if (directory) await page.screenshot({ path: `${directory}/${locale}-${width}-${height}.png`, caret: "initial" });
      await page.keyboard.press("Tab");
      assert.equal(await dialog.evaluate((el) => el.contains(document.activeElement)), true);
      await dialog.getByRole("button", { name: t.cancel, exact: true }).click();
      await dialog.waitFor({ state: "hidden" });
      assert.equal(await trigger.evaluate((el) => el === document.activeElement), true);
      assert.equal((await sql`select id from "user" where id = ${current.id}`).length, 1, "Cancel preserves account");
    }
    // Failed deletion stays in the dialog and displays only translated safe copy.
    await page.route("**/api/auth/delete-user", (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ code: "INTERNAL_SERVER_ERROR", message: "Private provider error" }) }));
    await page.getByRole("button", { name: t.deleteAccount, exact: true }).click();
    const dialog = page.getByRole("alertdialog");
    await dialog.getByRole("button", { name: t.deleteAccount, exact: true }).click();
    await dialog.getByRole("alert").waitFor();
    assert.ok((await dialog.innerText()).includes(messages.Errors.couldNotDeleteYourAccountPleaseTryAgain));
    assert.ok(!(await dialog.innerText()).includes("Private provider error"));
    await page.unroute("**/api/auth/delete-user");
    await page.route("**/api/auth/delete-user", (route) => route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: "SESSION_EXPIRED", message: "Session expired" }) }));
    await dialog.getByRole("button", { name: t.deleteAccount, exact: true }).click();
    await dialog.getByText(messages.Errors.pleaseSignOutAndSignInAgainBeforeDeletingYourAccount, { exact: true }).waitFor();
    await page.unroute("**/api/auth/delete-user");
    await dialog.getByRole("button", { name: t.deleteAccount, exact: true }).click();
    await page.waitForURL("**/sign-in");
    for (const table of ["user", "session", "account", "ledger", "user_preferences"]) {
      const field = table === "user" ? "id" : "user_id";
      assert.equal((await sql`select * from ${sql(table)} where ${sql(field)} = ${current.id}`).length, 0, `${table} removed`);
    }
    assert.equal((await sql`select user_id from receipt_images where id = ${current.image}`)[0].user_id, null);
    assert.equal((await sql`select id from "user" where id = ${untouched.id}`).length, 1, "Another user's account is preserved");
    assert.equal((await page.request.get(`${origin}/api/ledger`)).status(), 401);
    assert.deepEqual(errors, []);
    await context.close();
  }
  const stale = await fixture(true);
  const response = await fetch(`${origin}/api/auth/delete-user`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", Cookie: `better-auth.session_token=${stale.cookie}` }, body: "{}" });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "SESSION_EXPIRED");
  assert.equal((await sql`select id from "user" where id = ${stale.id}`).length, 1);
  const csrf = await fetch(`${origin}/api/auth/delete-user`, { method: "POST", headers: { Origin: "https://invalid.example", "Content-Type": "application/json", Cookie: `better-auth.session_token=${untouched.cookie}` }, body: "{}" });
  assert.equal(csrf.status, 403);
  assert.equal((await sql`select id from "user" where id = ${untouched.id}`).length, 1);
  console.log("Account deletion passed: both locales, responsive dialog, touch targets, focus restoration, cancel, safe errors, deletion/cascades, queued images, cross-user isolation, stale sessions, unauthenticated access and CSRF.");
} finally {
  if (images.length) await sql`delete from receipt_images where id in ${sql(images)}`;
  if (ids.length) await sql`delete from "user" where id in ${sql(ids)}`;
  await sql.end();
  await browser.close();
}

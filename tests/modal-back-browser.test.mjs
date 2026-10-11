import "dotenv/config";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import postgres from "postgres";
import { chromium } from "playwright";
import { createSessionTokenCodec } from "../src/lib/auth-privacy/create-session-token-codec.ts";

const origin = process.env.LEDGER_TEST_URL ?? "http://localhost:3000";
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
const account = randomUUID(), token = randomUUID();
const date = new Date().toISOString();
const screenshots = process.env.MODAL_SCREENSHOTS;
const errors = [];
let browser;
try {
  if (screenshots) await mkdir(screenshots, { recursive: true });
  await sql`insert into public."user" (id, name, email) values (${account}, 'Modal history test', ${account + "@example.invalid"})`;
  const codec = createSessionTokenCodec(process.env.BETTER_AUTH_SECRET);
  await sql`insert into public.session (id, user_id, token, token_hash, expires_at, updated_at) values (${randomUUID()}, ${account}, ${await codec.encrypt(token)}, ${codec.hash(token)}, ${new Date(Date.now() + 3600000)}, ${new Date()})`;
  await sql`insert into public.ledger (user_id, data) values (${account}, ${sql.json({ wallets: [{ id: "bank", name: "Test wallet", currencies: ["IDR"] }], categories: [{ id: "Bills", name: "Bills", kind: "expense" }], entries: [{ id: "example", kind: "expense", date, wallet: "bank", currency: "IDR", amount: 123456, title: "Modal test", category: "Bills", description: "" }] })})`;
  const signature = createHmac("sha256", process.env.BETTER_AUTH_SECRET).update(token).digest("base64");
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
  for (const language of ["en", "id"]) {
    await sql`insert into public.user_preferences (user_id, locale, language_prompt_shown_at) values (${account}, ${language}, ${new Date()}) on conflict (user_id) do update set locale = ${language}`;
    for (const [width, height] of [[320, 568], [390, 844], [568, 320], [768, 1024], [1440, 900]]) {
      const context = await browser.newContext({ viewport: { width, height } });
      await context.addCookies([{ name: "better-auth.session_token", value: encodeURIComponent(`${token}.${signature}`), url: origin, httpOnly: true, sameSite: "Lax" }, { name: "locale", value: language, url: origin }]);
      const page = await context.newPage();
      await page.addInitScript(() => {
        window.modalTrace = [];
        for (const method of ["pushState", "replaceState"]) {
          const original = history[method].bind(history);
          history[method] = (...args) => { window.modalTrace.push([method, args[0]?.dompetaraModal ?? null, args[2] ?? location.href]); return original(...args); };
        }
        window.addEventListener("popstate", () => window.modalTrace.push(["popstate", history.state?.dompetaraModal ?? null, location.href]));
      });
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${origin}/wallet`);
      await page.goto(`${origin}/transactions`);
      const url = page.url();
      const edit = page.getByRole("button", { name: language === "id" ? "Ubah Modal test" : "Edit Modal test", exact: true });
      await edit.click();
      await page.getByRole("dialog").waitFor();
      await page.waitForFunction(() => Boolean(history.state?.dompetaraModal));
      const editorMarker = await page.evaluate(() => history.state.dompetaraModal);
      await page.getByRole("button", { name: language === "id" ? "Hapus" : "Delete", exact: true }).click();
      const confirmation = page.getByRole("alertdialog");
      await confirmation.waitFor();
      await page.waitForFunction((marker) => history.state.dompetaraModal !== marker, editorMarker);
      await page.locator('[role="dialog"], [role="alertdialog"]').evaluateAll((dialogs) => Promise.all(dialogs.flatMap((dialog) => dialog.getAnimations({ subtree: true }).filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity).map((animation) => animation.finished.catch(() => {})))));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const box = await confirmation.boundingBox();
      assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1, "Confirmation fits the viewport");
      if (screenshots) await page.screenshot({ path: `${screenshots}/${language}-${width}x${height}-nested.png` });
      await page.evaluate(() => history.back());
      await confirmation.waitFor({ state: "detached" });
      assert.equal(await page.getByRole("dialog").count(), 1, "Back closes only the confirmation");
      assert.equal(page.url(), url);
      await page.evaluate(() => history.back());
      await page.getByRole("dialog").waitFor({ state: "detached" });
      assert.equal(page.url(), url);
      await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label")?.includes("Modal test"));

      for (const method of ["X", "Escape", "Cancel", "Nested Cancel"]) {
        await edit.click();
        await page.getByRole("dialog").waitFor();
        if (method === "Nested Cancel") {
          await page.getByRole("button", { name: language === "id" ? "Hapus" : "Delete", exact: true }).click();
          await confirmation.waitFor();
          await confirmation.getByRole("button", { name: language === "id" ? "Batal" : "Cancel", exact: true }).click();
          await confirmation.waitFor({ state: "detached" });
        }
        if (method === "Escape") await page.keyboard.press("Escape");
        else await page.getByRole("dialog").getByRole("button", { name: method === "Cancel" ? (language === "id" ? "Batal" : "Cancel") : (language === "id" ? "Tutup" : "Close"), exact: true }).click();
        await page.getByRole("dialog").waitFor({ state: "detached" });
        await page.waitForFunction(() => !history.state?.dompetaraModal);
      }
      if (width === 320) {
        let release;
        const gate = new Promise((resolve) => { release = resolve; });
        await page.route("**/api/ledger", async (route) => {
          if (route.request().method() === "POST") await gate;
          await route.continue();
        });
        await edit.click();
        await page.getByRole("dialog").waitFor();
        const submitted = page.waitForRequest((request) => request.url().endsWith("/api/ledger") && request.method() === "POST");
        await page.getByRole("button", { name: language === "id" ? "Simpan" : "Save", exact: true }).click();
        await submitted;
        await page.evaluate(() => new Promise((resolve) => { window.addEventListener("popstate", resolve, { once: true }); history.back(); }));
        await page.waitForFunction(() => Boolean(history.state?.dompetaraModal));
        assert.equal(await page.getByRole("dialog").count(), 1, "Pending save rejects Back dismissal");
        assert.equal(page.url(), url);
        release();
        await page.getByRole("dialog").waitFor({ state: "detached" });
        await page.waitForFunction(() => !history.state?.dompetaraModal);
        await page.unroute("**/api/ledger");
      }
      if (width < 768) {
        const filters = page.getByRole("button", { name: language === "id" ? "Filter" : "Filters", exact: true });
        await filters.click();
        await page.getByRole("dialog").waitFor();
        await page.waitForFunction(() => Boolean(history.state?.dompetaraModal));
        await page.evaluate(() => history.back());
        await page.getByRole("dialog").waitFor({ state: "detached" });
        assert.equal(page.url(), url);
        assert.equal(await filters.evaluate((button) => button === document.activeElement), true);
      }
      if (width >= 768 && width < 1024) {
        const navigation = page.locator('[data-slot="sidebar-trigger"]').filter({ visible: true }).first();
        await navigation.click();
        await page.getByRole("dialog").waitFor();
        await page.waitForFunction(() => Boolean(history.state?.dompetaraModal));
        await page.evaluate(() => history.back());
        await page.getByRole("dialog").waitFor({ state: "detached" });
        assert.equal(page.url(), url);
      }
      await page.evaluate(() => history.back());
      try { await page.waitForURL(`${origin}/wallet`); }
      catch (error) { console.error(`History trace ${language} ${width}:`, await page.evaluate(() => window.modalTrace)); throw error; }
      assert.equal(await page.getByRole("dialog").count(), 0);
      await context.close();
      console.log(`Modal Back integration passed: ${language}, ${width}×${height}`);
    }
  }
  assert.deepEqual(errors, []);
} finally {
  await browser?.close();
  await sql`delete from public."user" where id = ${account}`;
  await sql.end();
}

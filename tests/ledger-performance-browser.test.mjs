import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import { mkdir } from "node:fs/promises";
import postgres from "postgres";
import { chromium } from "playwright";
import { seedLedger } from "./support/seed-ledger.mjs";
import { resetTestLimits } from "./support/reset-test-limits.mjs";
import { createSessionTokenCodec } from "../src/lib/auth-privacy/create-session-token-codec.ts";
import { format } from "../src/features/ledger/format.ts";

const origin = process.env.LEDGER_TEST_URL ?? "http://localhost:3100";
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
const user = randomUUID(), token = randomUUID(), date = new Date().toISOString();
const screenshots = process.env.PERFORMANCE_SCREENSHOTS;
const data = { wallets: [{ id: "bank", name: "Bank", currencies: ["IDR", "USD"] }], categories: [{ id: "bills", name: "Bills", kind: "expense" }],
  entries: Array.from({ length: 25 }, (_, index) => ({ id: `e-${index}`, kind: "expense", date, wallet: "bank", currency: "IDR", amount: 100, title: `Expense ${index}`, category: "Bills", description: "" })) };
let browser;
try {
  await sql`insert into public."user" (id,name,email) values (${user},'Performance browser test',${user+'@example.invalid'})`;
  const codec = createSessionTokenCodec(process.env.BETTER_AUTH_SECRET);
  await sql`insert into session (id,user_id,token,token_hash,expires_at,updated_at) values (${randomUUID()},${user},${await codec.encrypt(token)},${codec.hash(token)},${new Date(Date.now()+3600000)},${new Date()})`;
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
  if (screenshots) await mkdir(screenshots, { recursive: true });
  for (const locale of JSON.parse(process.env.PERFORMANCE_LOCALES ?? '["en","id"]')) for (const [width, height] of JSON.parse(process.env.PERFORMANCE_VIEWPORTS ?? '[[320,568],[768,1024],[1440,900],[568,320]]')) {
    await resetTestLimits(sql, user); await seedLedger(sql, user, data);
    await sql`insert into user_preferences (user_id,locale,language_prompt_shown_at) values (${user},${locale},${new Date()}) on conflict(user_id) do update set locale=excluded.locale`;
    const context = await browser.newContext({ viewport: { width, height }, timezoneId: "Asia/Jakarta", locale });
    const signed = encodeURIComponent(`${token}.${createHmac("sha256",process.env.BETTER_AUTH_SECRET).update(token).digest("base64")}`);
    await context.addCookies([{ name: "better-auth.session_token", value: signed, url: origin, httpOnly: true, sameSite: "Lax" }]);
    const page = await context.newPage(); const errors = []; let rateRequests = 0, queryRequests = 0;
    const navigationEvents = [];
    page.on("response", (response) => { const url = new URL(response.url()); if (url.searchParams.has("_rsc")) navigationEvents.push({ path: url.pathname, status: response.status() }); });
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => { const path = new URL(request.url()).pathname;
      if (path === "/api/exchange-rates") rateRequests++;
      if (path === "/api/ledger/overview" || path === "/api/ledger/transactions") queryRequests++;
    });
    await page.route("**/*", async (route) => {
      const request = route.request(), url = new URL(request.url());
      if (url.pathname.startsWith("/_vercel/speed-insights/")) return route.abort();
      if (url.searchParams.has("_rsc") || ["/api/ledger/overview", "/api/ledger/transactions"].includes(url.pathname)) await new Promise((resolve) => setTimeout(resolve, 1000));
      return route.continue();
    });
    await page.addInitScript(() => {
      window.ledgerCls = 0;
      new PerformanceObserver((list) => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.ledgerCls += entry.value; }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto(origin+"/transactions", { waitUntil: "domcontentloaded" });
    await page.addStyleTag({ content: "nextjs-portal { pointer-events: none; }" });
    await page.waitForFunction(() => document.cookie.includes("ledger-timezone"));
    await page.locator('.ledger-query-content[aria-busy="true"]').first().waitFor();
    assert.equal(await page.locator("[data-ledger-loading]").count(), 0, "Timezone refresh retains the server content");
    assert.equal(await page.locator("tbody tr").count(), 20);
    await page.waitForFunction(() => !document.querySelector('.ledger-query-content[aria-busy="true"]'));
    await page.evaluate(() => document.fonts.ready);
    const cls = await page.evaluate(() => window.ledgerCls);
    assert.ok(cls < 0.1, `First-visit layout shift stays below 0.1: ${cls}`);
    assert.equal(rateRequests, 0, "An IDR-only balance fetches no unused USD/CAD rates");

    await page.getByRole("button", { name: locale === "id" ? "Ubah Expense 0" : "Edit Expense 0", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator('[name="title"]').fill("Confirmed edit");
    await dialog.locator('.currency-input input[type="text"]').first().fill("2");
    await dialog.getByRole("button", { name: locale === "id" ? "Simpan" : "Save", exact: true }).click();
    await dialog.waitFor({ state: "detached" });
    await page.getByRole("button", { name: locale === "id" ? "Ubah Confirmed edit" : "Edit Confirmed edit", exact: true }).waitFor();
    assert.equal(await page.locator("[data-ledger-loading]").count(), 0, "Confirmed writes update cached rows during background refresh");
    await page.waitForFunction(() => !document.querySelector('.ledger-query-content[aria-busy="true"]'));
    const next = locale === "id" ? "Bulan berikutnya" : "Next month", previous = locale === "id" ? "Bulan sebelumnya" : "Previous month";
    if (width < 768) {
      await page.getByRole("button", { name: next, exact: true }).click();
      await page.waitForFunction(() => !document.querySelector('.ledger-query-content[aria-busy="true"]'));
      const before = queryRequests;
      await page.getByRole("button", { name: previous, exact: true }).click(); await page.waitForTimeout(100);
      assert.equal(queryRequests, before, "Returning to a fresh cached period makes no API requests");
    }
    for (const [name,path] of [[locale === "id" ? "Dompet" : "Wallet","/wallet"],[locale === "id" ? "Laporan" : "Report","/report"],[locale === "id" ? "Pengaturan" : "Settings","/settings"],[locale === "id" ? "Transaksi" : "Transactions","/transactions"]]) {
      const tab = page.getByRole("tab", { name, exact: true });
      if (!(await tab.isVisible())) await page.getByRole("button", { name: locale === "id" ? "Buka atau tutup navigasi" : "Toggle navigation", exact: true }).click();
      await tab.click();
      // Previously visited routes can commit directly from the Next.js cache.
      const loading = await page.locator("[data-ledger-loading]").first().waitFor({ timeout: 1500 }).then(() => true).catch(() => false);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "The matching route skeleton fits the viewport");
      if (screenshots && loading) await page.screenshot({ path: `${screenshots}/${locale}-${path.slice(1)}-loading-${width}x${height}.png`,
        fullPage: !(await page.getByRole("dialog").count()), animations: "disabled" });
      await page.waitForURL(origin+path, { waitUntil: "domcontentloaded", timeout: 10_000 }).catch(async (error) => {
        console.log(JSON.stringify({ navigationFailed: path, actualPath: new URL(page.url()).pathname, navigationEvents,
          state: await page.evaluate(() => ({ ready: document.readyState, modalMarker: !!history.state?.dompetaraModal, dialogs: document.querySelectorAll('[role="dialog"]').length, loading: document.querySelectorAll('[data-ledger-loading]').length })) }));
        throw error;
      }); await page.waitForFunction(() => !document.querySelector("[data-ledger-loading]"));
      if (path === "/report") assert.ok((await page.locator(".expense-chart-figure figcaption strong").innerText()).includes(format(2600, "IDR", locale)),
        "A report prefetched before the edit must show confirmed totals, not its older server snapshot");
      if (width >= 768 && width < 1200) await page.getByRole("dialog").waitFor({ state: "hidden" });
    }
    assert.deepEqual(errors, []); assert.equal(rateRequests, 0);
    console.log(JSON.stringify({ locale, viewport: `${width}x${height}`, cls, unusedRateRequests: rateRequests, cachedRefresh: true, confirmedSave: true, matchingSkeletons: true }));
    await context.close();
  }
} finally { await browser?.close(); await sql`delete from public."user" where id=${user}`; await sql.end(); }

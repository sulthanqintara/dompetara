import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import { mkdir } from "node:fs/promises";
import postgres from "postgres";
import { chromium } from "playwright";
import { seedLedger } from "./support/seed-ledger.mjs";
import { resetTestLimits } from "./support/reset-test-limits.mjs";
import { createSessionTokenCodec } from "../src/lib/auth-privacy/create-session-token-codec.ts";

const origin = process.env.LEDGER_TEST_URL ?? "http://localhost:3100";
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
const user = randomUUID(), token = randomUUID();
const codec = createSessionTokenCodec(process.env.BETTER_AUTH_SECRET);
const signed = encodeURIComponent(`${token}.${createHmac("sha256", process.env.BETTER_AUTH_SECRET).update(token).digest("base64")}`);
const screenshots = process.env.PERFORMANCE_SCREENSHOTS;
let browser;
try {
  await sql`insert into public."user" (id,name,email) values (${user},'Startup check',${user+'@example.invalid'})`;
  await sql`insert into session (id,user_id,token,token_hash,expires_at,updated_at) values (${randomUUID()},${user},${await codec.encrypt(token)},${codec.hash(token)},${new Date(Date.now()+3600000)},${new Date()})`;
  await seedLedger(sql, user, { wallets: [{ id: "bank", name: "Bank", currencies: ["IDR"] }], categories: [{ id: "bills", name: "Bills", kind: "expense" }],
    entries: [{ id: "expense", kind: "expense", date: new Date().toISOString(), wallet: "bank", currency: "IDR", amount: 100, title: "Startup fixture", category: "Bills", description: "" }] });
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
  if (screenshots) await mkdir(screenshots, { recursive: true });
  for (const locale of ["en", "id"]) for (const [width, height] of [[320,568],[768,1024],[1440,900],[568,320]]) {
    await resetTestLimits(sql, user);
    await sql`insert into user_preferences (user_id,locale,language_prompt_shown_at) values (${user},${locale},${new Date()}) on conflict(user_id) do update set locale=excluded.locale`;
    const context = await browser.newContext({ viewport: { width, height }, timezoneId: "Asia/Jakarta", locale });
    const page = await context.newPage(), errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/_vercel/speed-insights/**", (route) => route.abort());
    const response = await page.goto(origin + "/", { waitUntil: "networkidle" });
    assert.equal(new URL(page.url()).pathname, "/sign-in");
    assert.equal(response.request().redirectedFrom()?.url(), origin + "/", "Anonymous home redirects directly to sign-in");
    const oauth = page.waitForRequest("**/api/auth/sign-in/social");
    await page.route("**/api/auth/sign-in/social", (route) => route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: "UNKNOWN_ERROR", message: "Unable to sign in." }) }));
    const button = page.getByRole("button", { name: locale === "id" ? "Lanjutkan dengan Google" : "Continue with Google" });
    await button.focus();
    assert.equal(await button.evaluate((element) => element === document.activeElement), true);
    await button.press("Enter");
    const request = await oauth;
    assert.equal(request.postDataJSON().callbackURL, "/transactions");
    assert.match(request.headers().cookie, /ledger-timezone=Asia%2FJakarta/, "Timezone is saved before OAuth begins");
    await button.waitFor({ state: "visible" });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    if (screenshots) await page.screenshot({ path: `${screenshots}/${locale}-signin-${width}x${height}.png`, fullPage: true });
    await context.addCookies([{ name: "better-auth.session_token", value: signed, url: origin, httpOnly: true, sameSite: "Lax" }]);
    let queryRequests = 0;
    page.on("request", (request) => { if (/\/api\/ledger\/(transactions|overview)/.test(new URL(request.url()).pathname)) queryRequests++; });
    await page.addInitScript(() => {
      window.startupCls = 0;
      new PerformanceObserver((list) => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.startupCls += entry.value; }).observe({ type: "layout-shift", buffered: true });
    });
    const ledgerResponse = await page.goto(origin + "/transactions", { waitUntil: "networkidle" });
    await page.getByText("Startup fixture", { exact: true }).waitFor();
    assert.equal(queryRequests, 0, "The first post-login render uses the server's timezone query without two redundant API refreshes");
    const html = await ledgerResponse.text();
    assert.ok(html.indexOf("ledger-boot-loading") > 0 && html.indexOf("ledger-boot-loading") < html.indexOf("Startup fixture"), "Loading shell streams before account data");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const cls = await page.evaluate(() => window.startupCls);
    assert.ok(cls < 0.1, `Startup layout shift stays below 0.1: ${cls}`);
    if (screenshots) await page.screenshot({ path: `${screenshots}/${locale}-startup-${width}x${height}.png`, fullPage: true });
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ locale, viewport: `${width}x${height}`, queryRequests, cls, timezoneBeforeOAuth: true, streamedShell: true }));
    await context.close();
  }
} finally {
  await browser?.close();
  await sql`delete from public."user" where id=${user}`;
  assert.equal((await sql`select count(*)::int as count from session where user_id=${user}`)[0].count, 0);
  await sql.end();
}

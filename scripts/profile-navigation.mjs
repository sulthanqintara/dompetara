import { createSessionTokenCodec } from "../src/lib/auth-privacy/create-session-token-codec.ts";
import "dotenv/config";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { chromium } from "playwright";
import postgres from "postgres";
import { mkdir } from "node:fs/promises";

// Run against a local server only. Uses synthetic data; always removes its account.
const origin = process.env.LEDGER_TEST_URL ?? "http://localhost:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname), "Profile a local server only");
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
const id = randomUUID();
const token = randomUUID();
const count = Number(process.env.PROFILE_ENTRIES ?? 100);
assert.ok(Number.isInteger(count) && count >= 0 && count <= 10000);
const repeats = Number(process.env.PROFILE_REPEATS ?? 2);
assert.ok(Number.isInteger(repeats) && repeats >= 1 && repeats <= 20);
const sizes = JSON.parse(process.env.PROFILE_VIEWPORTS ?? "[[390,844],[1440,900]]");
const screenshots = process.env.PROFILE_SCREENSHOTS;
const now = new Date().toISOString();
const data = {
  wallets: [{ id: "profile-wallet", name: "Profile wallet", currencies: ["IDR"] }],
  categories: [{ id: "profile-category", name: "Profile category", kind: "expense" }],
  entries: Array.from({ length: count }, (_, index) => ({
    id: `profile-${index}`, kind: "expense", date: now, wallet: "profile-wallet",
    currency: "IDR", amount: 100, title: `Profile entry ${index}`,
    category: "Profile category", description: "",
  })),
};
const sections = [["Wallet", "/wallet"], ["Report", "/report"], ["Settings", "/settings"], ["Transactions", "/transactions"]];
let browser;
try {
  await sql.begin(async (tx) => {
    await tx`insert into public."user" (id, name, email) values (${id}, 'Navigation profile', ${id + "@example.invalid"})`;
    await tx`insert into public.session (id, user_id, token, token_hash, expires_at, updated_at) values (${randomUUID()}, ${id}, ${await createSessionTokenCodec(process.env.BETTER_AUTH_SECRET).encrypt(token)}, ${createSessionTokenCodec(process.env.BETTER_AUTH_SECRET).hash(token)}, ${new Date(Date.now() + 3600000)}, ${new Date()})`;
    await tx`insert into public.ledger (user_id, data) values (${id}, ${tx.json(data)})`;
  });
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
  if (screenshots) await mkdir(screenshots, { recursive: true });
  const signature = createHmac("sha256", process.env.BETTER_AUTH_SECRET).update(token).digest("base64");
  for (const [width, height] of sizes) {
    const context = await browser.newContext({ viewport: { width, height }, timezoneId: "Asia/Jakarta" });
    await context.addCookies([{ name: "better-auth.session_token", value: encodeURIComponent(`${token}.${signature}`), url: origin, httpOnly: true, sameSite: "Lax" }]);
    const page = await context.newPage();
    const errors = [];
    let rateRequests = 0;
    page.on("request", (request) => { if (new URL(request.url()).pathname === "/api/exchange-rates") rateRequests++; });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      window.profileClicks = [];
      document.addEventListener("click", (event) => {
        if (event.target.closest('[role="tab"]')) window.profileClicks.push(performance.now());
      }, true);
    });
    await page.goto(`${origin}/transactions`);
    await page.locator(".app-shell").waitFor();
    if (width >= 768 && width < 1200) {
      await page.waitForFunction(() => !document.querySelector(".ledger-desktop-sidebar"));
      await page.getByRole("button", { name: "Toggle navigation", exact: true }).waitFor();
    } else {
      await page.getByRole("tab", { name: "Transactions", exact: true }).waitFor();
    }
    await page.addStyleTag({ content: "nextjs-portal { pointer-events: none; }" });
    await page.evaluate(() => {
      window.profileNavigation = document.querySelector('[aria-label="Workspace"]');
      window.profileShell = document.querySelector(".app-shell");
    });
    for (const pass of ["first", ...Array(repeats).fill("repeat")]) {
      for (const [name, path] of sections) {
        const tab = page.getByRole("tab", { name, exact: true });
        if (!(await tab.isVisible())) await page.getByRole("button", { name: "Toggle navigation", exact: true }).click();
        await tab.click();
        await page.locator(`.route-content[aria-label="${name}"]`).waitFor({ state: "visible" });
        const feedbackMs = await page.evaluate(async () => {
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          return Math.round(performance.now() - window.profileClicks.at(-1));
        });
        const loadingVisible = await page.locator("[data-ledger-loading]").isVisible();
        if (process.env.PROFILE_REQUIRE_LOADING === "1") assert.ok(loadingVisible, "Delayed page should show its content loading fallback");
        if (screenshots && loadingVisible) {
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Loading layout must not scroll horizontally");
          await page.screenshot({ path: `${screenshots}/${width}x${height}-${name.toLowerCase()}-loading.png`, fullPage: true, animations: "disabled" });
        }
        await page.waitForURL(`${origin}${path}`);
        await page.waitForFunction((name) => {
          const panel = document.querySelector(`.route-content[aria-label="${name}"]`);
          return panel && !panel.querySelector("[data-ledger-loading]");
        }, name);
        const timing = await page.evaluate(async () => {
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          const start = window.profileClicks.at(-1);
          return {
            clickToPaintMs: Math.round(performance.now() - start),
            shellPreserved: window.profileNavigation === document.querySelector('[aria-label="Workspace"]'),
            layoutPreserved: window.profileShell === document.querySelector(".app-shell"),
            requests: performance.getEntriesByType("resource").filter((entry) => entry.startTime >= start && new URL(entry.name).searchParams.has("_rsc")).map((entry) => ({
              path: new URL(entry.name).pathname,
              ttfbMs: Math.round(entry.responseStart - entry.requestStart),
              durationMs: Math.round(entry.duration),
              bytes: entry.transferSize,
            })),
          };
        });
        assert.ok(timing.shellPreserved, "Shared navigation should stay mounted");
        assert.ok(timing.layoutPreserved, "Shared layout should stay mounted");
        console.log(JSON.stringify({ viewport: `${width}x${height}`, entries: count, pass, path, feedbackMs, loadingVisible, rateRequests, ...timing }));
        if (screenshots && pass === "first") {
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Content must not scroll horizontally");
          await page.screenshot({ path: `${screenshots}/${width}x${height}-${name.toLowerCase()}.png`, fullPage: true, animations: "disabled" });
        }
      }
    }
    if (errors.length) {
      console.log(JSON.stringify({ viewport: `${width}x${height}`, browserErrors: errors.length,
        hydrationMismatch: errors.some((message) => /Hydration|React error #418/.test(message)) }));
      process.exitCode = 1;
    }
    await context.close();
  }
} finally {
  await browser?.close();
  await sql`delete from public."user" where id = ${id}`;
  await sql.end({ timeout: 1 });
}

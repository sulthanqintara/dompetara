import "dotenv/config";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import postgres from "postgres";

const origin = process.env.LEDGER_TEST_URL ?? "http://localhost:3000";
const screenshots = process.env.RESPONSIVE_SCREENSHOTS;
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
const id = randomUUID();
const token = randomUUID();
const date = new Date().toISOString();
const errors = [];
const sizes = [[320, 568], [390, 844], [768, 1024], [844, 390], [1024, 768], [1200, 800], [1440, 900]];
const data = {
  wallets: [
    { id: "bank", name: "BCA Main Account", currencies: ["IDR", "USD"] },
    { id: "gopay", name: "GoPay", currencies: ["IDR"] },
    { id: "long", name: "Long wallet ".repeat(12), currencies: ["IDR"] },
  ],
  categories: [
    { id: "food", name: "Food & drink", kind: "expense" },
    { id: "long", name: "Category".repeat(20), kind: "expense" },
  ],
  entries: [
    { id: "opening", kind: "correction", date, wallet: "bank", currency: "IDR", amount: 1500000000, title: "Opening balance", category: "", description: "" },
    { id: "lunch", kind: "expense", date, wallet: "bank", currency: "IDR", amount: 8750000, title: "Lunch and groceries", category: "Food & drink", description: "Weekly groceries and lunch with friends" },
    { id: "long", kind: "expense", date, wallet: "long", currency: "IDR", amount: 123456789012, title: "LongTransactionTitle".repeat(12), category: "Category".repeat(20), description: "Long receipt description ".repeat(20) },
    { id: "transfer", kind: "transfer", date, wallet: "bank", currency: "IDR", amount: 160000000, toWallet: "bank", toCurrency: "USD", received: 10000, title: "Transfer", category: "", description: "Converted savings" },
  ],
};

async function check(page, name, width, height) {
  const layout = await page.evaluate(() => {
    const scope = document.querySelector("dialog[open]") ?? document;
    const controls = [...scope.querySelectorAll("button, input, select, textarea, a")]
      .filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== "hidden");
    return {
      width: document.documentElement.scrollWidth,
      small: controls.filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.width < 43.5 || rect.height < 43.5;
      }).map(el => el.getAttribute("aria-label") || el.textContent || el.name),
      smallText: controls.filter(el => el.matches("input, select, textarea") && parseFloat(getComputedStyle(el).fontSize) < 16).length,
      overflow: [...document.querySelectorAll(".table-wrap, dialog[open]")].some(el => el.scrollWidth > el.clientWidth + 1),
      narrowTitles: [...document.querySelectorAll(".transaction-detail .transaction-name > span:last-child")]
        .filter(el => el.textContent.length > 40 && el.getBoundingClientRect().width < 120).length,
    };
  });
  assert.ok(layout.width <= width, `${width}×${height} ${name}: page overflow (${layout.width}px)`);
  assert.deepEqual(layout.small, [], `${width}×${height} ${name}: small touch controls`);
  assert.equal(layout.smallText, 0, `${width}×${height} ${name}: small input text`);
  assert.equal(layout.overflow, false, `${width}×${height} ${name}: content overflow`);
  assert.equal(layout.narrowTitles, 0, `${width}×${height} ${name}: transaction titles are squeezed`);
  if (screenshots) await page.screenshot({ path: `${screenshots}/${width}x${height}-${name}.png`, fullPage: true });
}

let browser;
try {
  if (screenshots) await mkdir(screenshots, { recursive: true });
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
  await sql.begin(async tx => {
    await tx`insert into public."user" (id, name, email) values (${id}, 'Responsive check', ${id + "@example.invalid"})`;
    await tx`insert into public.session (id, user_id, token, expires_at, updated_at) values (${randomUUID()}, ${id}, ${token}, ${new Date(Date.now() + 3600000)}, ${new Date()})`;
    await tx`insert into public.ledger (user_id, data) values (${id}, ${tx.json(data)})`;
  });
  const signature = createHmac("sha256", process.env.BETTER_AUTH_SECRET).update(token).digest("base64");
  for (const [width, height] of sizes) {
    const context = await browser.newContext({ viewport: { width, height }, timezoneId: "Asia/Jakarta", isMobile: width < 640, hasTouch: width < 1024 });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${origin}/sign-in`);
    await page.getByRole("button", { name: /Google/ }).waitFor();
    await check(page, "sign-in", width, height);
    await context.addCookies([{ name: "better-auth.session_token", value: encodeURIComponent(`${token}.${signature}`), url: origin, httpOnly: true, sameSite: "Lax" }]);
    await page.goto(origin);
    await page.getByRole("button", { name: "Add transaction", exact: true }).waitFor();
    for (const tab of ["Transactions", "Wallet", "Report", "Settings"]) {
      await page.getByRole("button", { name: tab, exact: true }).click();
      await check(page, tab.toLowerCase(), width, height);
    }
    await page.getByRole("button", { name: "Transactions", exact: true }).click();
    await page.getByRole("button", { name: "Edit Lunch and groceries", exact: true }).click();
    await page.getByRole("dialog").waitFor();
    await check(page, "edit-transaction", width, height);
    assert.equal(await page.evaluate(() => document.body.style.overflow), "hidden");
    await page.getByRole("textbox", { name: /Description/ }).fill("Reviewed on mobile");
    const saved = page.waitForResponse(response => response.url().endsWith("/api/ledger") && response.request().method() === "POST");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    const response = await saved;
    assert.ok(response.ok(), `Save failed: ${await response.text()}`);
    await page.getByRole("dialog").waitFor({ state: "detached" });
    assert.notEqual(await page.evaluate(() => document.body.style.overflow), "hidden");
    await page.getByRole("button", { name: "Add transaction", exact: true }).click();
    await page.getByRole("dialog").waitFor();
    await page.getByRole("button", { name: "transfer", exact: true }).click();
    await page.getByRole("combobox", { name: "Destination currency", exact: true }).selectOption("USD");
    await check(page, "transfer-editor", width, height);
    await page.getByRole("button", { name: "Save", exact: true }).scrollIntoViewIfNeeded();
    const saveRect = await page.getByRole("button", { name: "Save", exact: true }).boundingBox();
    assert.ok(saveRect.y >= 0 && saveRect.y + saveRect.height <= height, "Save must be reachable on short screens");
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "detached" });
    assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), "Add transaction");
    await page.getByRole("button", { name: "Wallet", exact: true }).click();
    await page.getByRole("button", { name: "Add wallet", exact: true }).click();
    await page.getByRole("dialog").waitFor();
    await check(page, "wallet-editor", width, height);
    await page.mouse.click(2, 2);
    await page.getByRole("dialog").waitFor({ state: "detached" });
    await context.close();
  }
  assert.deepEqual(errors, [], "JavaScript page errors");
  console.log("Responsive checks passed: seven viewport sizes, all tabs, long content, touch controls, dialog scrolling, save, and dismissal.");
} finally {
  await browser?.close();
  await sql`delete from public."user" where id = ${id}`;
  const [remaining] = await sql`select count(*)::integer as count from public."user" where id = ${id}`;
  assert.equal(remaining.count, 0, "Temporary account must be removed");
  await sql.end({ timeout: 1 });
}

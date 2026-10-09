import "dotenv/config";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import postgres from "postgres";
import { chromium } from "playwright";

const origin = process.env.LEDGER_TEST_URL ?? "http://localhost:3000";
const screenshots = process.env.THEME_SCREENSHOTS;
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
const account = randomUUID(), token = randomUUID(), date = new Date().toISOString();
const data = {
  wallets: [{ id: "bank", name: "BCA " + "Long wallet name ".repeat(8), currencies: ["IDR", "USD"] }, { id: "cash", name: "Cash", currencies: ["IDR"] }],
  categories: [{ id: "Bills", name: "Bills", kind: "expense" }, { id: "custom", name: "Custom category ".repeat(10), kind: "expense" }, { id: "Salary", name: "Salary", kind: "income" }],
  entries: [
    { id: "opening", kind: "correction", date, wallet: "bank", currency: "IDR", amount: 100000000, title: "Opening balance", category: "", description: "" },
    ...Array.from({ length: 8 }, (_, i) => ({ id: `expense-${i}`, kind: "expense", date, wallet: "bank", currency: "IDR", amount: 123456, title: i ? "Example expense" : "Long transaction title ".repeat(10), category: i % 2 ? "custom" : "Bills", description: "Custom note ".repeat(15) })),
    { id: "income", kind: "income", date, wallet: "bank", currency: "IDR", amount: 5000000, title: "Salary", category: "Salary", description: "" },
  ],
};
let browser;
const errors = [];
async function check(page, name, width, height) {
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name} overflow at ${width}×${height}`);
  await page.getByRole("dialog").evaluateAll((dialogs) => Promise.all(dialogs.flatMap((dialog) => dialog.getAnimations({ subtree: true }).filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity).map((animation) => animation.finished.catch(() => {})))));
  for (const dialog of await page.getByRole("dialog").all()) {
    const box = await dialog.boundingBox();
    if (box) assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1, `${name} dialog must fit`);
  }
  if (screenshots) await page.screenshot({ path: `${screenshots}/${name}-${width}x${height}.png`, fullPage: !(await page.getByRole("dialog").count()) });
}
try {
  if (screenshots) await mkdir(screenshots, { recursive: true });
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
  await sql`insert into public."user" (id, name, email) values (${account}, 'Theme test', ${account + "@example.invalid"})`;
  await sql`insert into public.session (id, user_id, token, expires_at, updated_at) values (${randomUUID()}, ${account}, ${token}, ${new Date(Date.now() + 3600000)}, ${new Date()})`;
  await sql`insert into public.ledger (user_id, data) values (${account}, ${sql.json(data)})`;
  await sql`insert into public.user_preferences (user_id, language_prompt_shown_at) values (${account}, ${new Date()})`;
  for (const language of ["en", "id"]) {
    const context = await browser.newContext({ colorScheme: "dark", locale: language === "id" ? "id-ID" : "en-US" });
    await context.addCookies([{ name: "locale", value: language, url: origin }]);
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error" && !/404 \(Not Found\)|net::ERR_FAILED/.test(message.text())) errors.push(message.text()); });
    await page.goto(`${origin}/sign-in`);
    const lightLabel = language === "id" ? "Beralih ke tema terang" : "Switch to light theme";
    const darkLabel = language === "id" ? "Beralih ke tema gelap" : "Switch to dark theme";
    await page.getByRole("button", { name: lightLabel }).waitFor();
    assert.ok(await page.locator("html").evaluate((html) => html.classList.contains("dark")), "Initial theme follows system");
    for (const [width, height] of [[320, 568], [390, 844], [568, 320], [768, 1024], [1440, 900]]) {
      await page.setViewportSize({ width, height });
      for (const theme of ["dark", "light"]) {
        if ((await page.locator("button.theme-toggle").getAttribute("aria-pressed")) !== String(theme === "dark")) await page.locator("button.theme-toggle").press("Enter");
        await page.waitForFunction((dark) => document.documentElement.classList.contains("dark") === dark, theme === "dark");
        await check(page, `${language}-${theme}-sign-in`, width, height);
      }
    }
    const signature = createHmac("sha256", process.env.BETTER_AUTH_SECRET).update(token).digest("base64");
    await context.addCookies([{ name: "better-auth.session_token", value: encodeURIComponent(`${token}.${signature}`), url: origin, httpOnly: true, sameSite: "Lax" }]);
    for (const [width, height] of [[320, 568], [390, 844], [568, 320], [768, 1024], [1440, 900]]) {
      await page.setViewportSize({ width, height });
      for (const theme of ["dark", "light"]) {
        for (const route of ["transactions", "wallet", "report", "settings", "icon-preview", "missing-page"]) {
          await page.goto(`${origin}/${route}`);
          if (route !== "missing-page") {
            const toggle = page.locator("button.theme-toggle");
            await toggle.waitFor();
            await page.waitForFunction(() => !document.querySelector("button.theme-toggle")?.disabled);
            if ((await toggle.getAttribute("aria-pressed")) !== String(theme === "dark")) await toggle.click();
            await page.waitForFunction((dark) => document.documentElement.classList.contains("dark") === dark, theme === "dark");
            const box = await toggle.boundingBox();
            assert.ok(box.width >= 44 && box.height >= 44, "Header toggle touch target");
          }
          assert.equal(await page.locator("html").getAttribute("lang"), language);
          await check(page, `${language}-${theme}-${route}`, width, height);
          if (route === "report") {
            const ticks = page.locator(".recharts-cartesian-axis-tick-value");
            await ticks.first().waitFor();
            assert.ok(await ticks.evaluateAll((elements) => {
              const sample = document.createElement("span");
              sample.style.color = "var(--muted-foreground)";
              document.body.append(sample);
              const expected = getComputedStyle(sample).color;
              sample.remove();
              return elements.every((element) => getComputedStyle(element).fill === expected);
            }), "Chart axis labels use theme text");
          }
          if (route === "wallet") {
            await page.getByRole("button", { name: language === "id" ? "Tambah dompet" : "Add wallet", exact: true }).first().click();
            await page.getByRole("dialog").waitFor();
            await check(page, `${language}-${theme}-wallet-editor`, width, height);
            await page.keyboard.press("Escape");
            await page.getByRole("dialog").waitFor({ state: "detached" });
          }
          if (route === "transactions") {
            for (const kind of ["income", "expense", "transfer", "receipt"]) {
              await page.getByRole("button", { name: language === "id" ? "Tambah transaksi" : "Add transaction", exact: true }).click();
              const name = kind === "income" ? (language === "id" ? "Pemasukan" : "Income") : kind === "expense" ? (language === "id" ? "Pengeluaran" : "Expense") : kind === "transfer" ? "Transfer" : (language === "id" ? "Impor struk" : "Import receipt");
              await page.getByRole("menuitem", { name, exact: true }).click();
              await page.getByRole("dialog").waitFor();
              await check(page, `${language}-${theme}-${kind}-editor`, width, height);
              await page.keyboard.press("Escape");
              await page.getByRole("dialog").waitFor({ state: "detached" });
            }
          }
        }
      }
    }
    await page.goto(`${origin}/settings`);
    await page.waitForFunction(() => !document.querySelector("button.theme-toggle")?.disabled);
    await page.getByRole("button", { name: darkLabel }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: lightLabel }).waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem("dompetara-theme")), "dark");
    const other = await context.newPage();
    await other.goto(`${origin}/transactions`);
    await other.getByRole("button", { name: lightLabel }).waitFor();
    await page.reload();
    await page.getByRole("button", { name: lightLabel }).waitFor();
    await page.getByRole("button", { name: lightLabel }).click();
    await other.getByRole("button", { name: darkLabel }).waitFor();
    await page.getByRole("combobox", { name: language === "id" ? "Tema warna" : "Color theme", exact: true }).click();
    await page.getByRole("option", { name: language === "id" ? "Pengaturan sistem" : "System setting", exact: true }).click();
    await page.getByRole("button", { name: lightLabel }).waitFor();
    await page.emulateMedia({ colorScheme: "light" });
    await page.getByRole("button", { name: darkLabel }).waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem("dompetara-theme")), "system");
    console.log(`${language}: theme layouts and preference behavior passed`);
    await context.close();
  }
  assert.deepEqual(errors, []);
  console.log("Theme browser checks passed: both locales/themes, responsive pages/editors, system changes, keyboard toggle, saved preference, reload and cross-tab sync.");
} finally {
  await browser?.close();
  await sql`delete from public."user" where id = ${account}`;
  await sql.end({ timeout: 1 });
}

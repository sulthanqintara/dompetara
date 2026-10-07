import "dotenv/config";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { chromium } from "playwright";
import postgres from "postgres";
import { balance } from "../src/features/ledger/ledger.ts";
import { balanceBreakdown } from "../src/features/ledger/balances.ts";
import { crossRate } from "../src/features/exchange-rates/exchange-rates.ts";

const origin = process.env.LEDGER_TEST_URL ?? "http://localhost:3000";
const screenshots = process.env.RESPONSIVE_SCREENSHOTS;
const filtersOnly = process.env.RESPONSIVE_SCOPE === "filters";
const categoriesOnly = process.env.RESPONSIVE_SCOPE === "categories";
const receiptsOnly = process.env.RESPONSIVE_SCOPE === "receipts";
const reportsOnly = process.env.RESPONSIVE_SCOPE === "reports";
const balancesOnly = process.env.RESPONSIVE_SCOPE === "balances";
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
const id = randomUUID();
const token = randomUUID();
const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date()) + "T05:00:00.000Z";
const singleDate = new Date(date);
singleDate.setUTCDate(1);
singleDate.setUTCHours(0, 0, 0, 0);
singleDate.setUTCMonth(singleDate.getUTCMonth() - 1);
const errors = [];
let expectedExportFailure = false;
let expectedLedgerFailure = false;
let expectedPaymentValidationFailure = false;
const sizes = [
  [320, 568],
  [390, 844],
  [568, 320],
  [768, 1024],
  [844, 390],
  [1024, 768],
  [1200, 800],
  [1440, 900],
];
const data = {
  wallets: [
    { id: "bank", name: "BCA Main Account", currencies: ["IDR", "USD", "CAD"] },
    { id: "gopay", name: "GoPay", currencies: ["IDR"] },
    { id: "long", name: "Long wallet ".repeat(12), currencies: ["IDR"] },
  ],
  categories: [
    { id: "food", name: "Food & drink", kind: "expense" },
    { id: "long", name: "Category".repeat(20), kind: "expense" },
    { id: "bills", name: "Bills", kind: "expense" },
  ],
  entries: [
    { id: "cad-opening", kind: "correction", wallet: "bank", currency: "CAD", amount: 13800, date, title: "CAD opening balance", category: "", description: "" },
    {
      id: "opening",
      kind: "correction",
      date,
      wallet: "bank",
      currency: "IDR",
      amount: 1500000000,
      title: "Opening balance",
      category: "",
      description: "",
    },
    {
      id: "lunch",
      kind: "expense",
      date,
      wallet: "bank",
      currency: "IDR",
      amount: 8750000,
      title: "Lunch and groceries",
      category: "Food & drink",
      description: "Weekly groceries and lunch with friends",
    },
    {
      id: "long",
      kind: "expense",
      date,
      wallet: "long",
      currency: "IDR",
      amount: 123456789012,
      title: "LongTransactionTitle".repeat(12),
      category: "Category".repeat(20),
      description: "Long receipt description ".repeat(20),
    },
    {
      id: "transfer",
      kind: "transfer",
      date,
      wallet: "bank",
      currency: "IDR",
      amount: 160000000,
      toWallet: "bank",
      toCurrency: "USD",
      received: 10000,
      title: "Transfer",
      category: "",
      description: "Converted savings",
    },
    {
      id: "previous",
      kind: "expense",
      date: singleDate.toISOString(),
      wallet: "bank",
      currency: "IDR",
      amount: 10000,
      title: "Previous month bill",
      category: "Bills",
      description: "",
    },
  ],
};

async function switchView(page, name) {
  // Keep the development indicator from covering the phone navigation.
  await page.addStyleTag({ content: "nextjs-portal { pointer-events: none; }" });
  const navigation = page.getByRole("tab", { name, exact: true });
  if (page.viewportSize().width < 768) await navigation.waitFor({ state: "visible" });
  if (!(await navigation.isVisible())) {
    await page.getByRole("button", { name: "Toggle navigation", exact: true }).click();
  }
  await navigation.click();
  if (page.viewportSize().width >= 768 && page.viewportSize().width < 1200) {
    await page.getByRole("dialog", { name: "Workspace navigation", exact: true }).waitFor({ state: "detached" });
    assert.equal(await page.getByRole("button", { name: "Toggle navigation", exact: true }).evaluate((el) => el === document.activeElement), true);
  }
  await page.getByRole("heading", { name, exact: true, level: 1 }).waitFor();
  assert.equal(new URL(page.url()).pathname, name === "Transactions" ? "/transactions" : `/${name.toLowerCase()}`);
  if (name === "Transactions" || name === "Report") await page.locator('.balance-stat[aria-busy="false"]').waitFor();
}

async function checkRoutes(page, context, browser) {
  await page.evaluate(() => { window.ledgerNavigation = document.querySelector('[aria-label="Workspace"]'); });
  for (const name of ["Wallet", "Report", "Settings", "Transactions"]) {
    await switchView(page, name);
    assert.equal(await page.evaluate(() => window.ledgerNavigation === document.querySelector('[aria-label="Workspace"]')), true, "Navigation stays mounted across routes");
    const response = await page.request.get(page.url());
    assert.equal(response.status(), 200);
    assert.ok((await response.text()).includes(`<h1>${name}</h1>`), "Route headings are rendered on the server");
  }
  await switchView(page, "Wallet");
  await page.reload();
  await page.getByRole("heading", { name: "Wallet", exact: true, level: 1 }).waitFor();
  assert.equal(new URL(page.url()).pathname, "/wallet");
  await switchView(page, "Report");
  await page.goBack();
  await page.getByRole("heading", { name: "Wallet", exact: true, level: 1 }).waitFor();
  await page.goForward();
  await page.getByRole("heading", { name: "Report", exact: true, level: 1 }).waitFor();
  const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
  try {
    await noJs.addCookies(await context.cookies());
    const serverPage = await noJs.newPage();
    for (const [path, name] of [["transactions", "Transactions"], ["wallet", "Wallet"], ["report", "Report"], ["settings", "Settings"]]) {
      await serverPage.goto(`${origin}/${path}`);
      await serverPage.getByRole("heading", { name, exact: true, level: 1 }).waitFor();
      if (path === "transactions") assert.ok(await serverPage.getByRole("table", { name: "Transaction history", exact: true }).count());
    }
  } finally { await noJs.close(); }
  await switchView(page, "Transactions");
}

async function checkPagination(page, width, height) {
  const before = await (await page.request.get(`${origin}/api/ledger`)).json();
  const extra = Array.from({ length: 41 }, (_, index) => ({ id: `pagination-${index}`, kind: "expense", wallet: "bank", currency: "IDR", amount: 1, date, title: `Pagination transaction ${String(index).padStart(2, "0")}`, category: "Food & drink", description: "Pagination verification" }));
  await sql`update public.ledger set data = ${sql.json({ ...before.data, entries: [...extra, ...before.data.entries] })} where user_id = ${id}`;
  try {
    if (filtersOnly) {
      await page.goto(`${origin}/transactions?search=Pagination&type=expense`);
      await page.getByText("Page 1 of 3", { exact: true }).waitFor();
      await page.getByRole("button", { name: "Next page", exact: true }).click();
      await page.getByText("Page 2 of 3", { exact: true }).waitFor();
      assert.equal(new URL(page.url()).searchParams.get("search"), "Pagination");
      assert.equal(new URL(page.url()).searchParams.get("type"), "expense");
      const search = page.getByRole("form", { name: width < 768 ? "Search transaction history" : "Filter transaction history" });
      await search.getByRole("searchbox").fill("FRIENDS");
      await search.getByRole("button", { name: width < 768 ? "Search transactions" : "Apply filters", exact: true }).click();
      await page.getByText("Page 1 of 1", { exact: true }).waitFor();
      assert.equal(new URL(page.url()).searchParams.has("page"), false);
    }
    await page.goto(`${origin}/transactions`);
    const rows = page.locator('[aria-label="Transaction history"] tbody tr');
    await page.getByText("Page 1 of 3", { exact: true }).waitFor();
    assert.equal(await rows.count(), 20);
    assert.equal(await page.getByRole("button", { name: "Previous page", exact: true }).isDisabled(), true);
    await page.getByRole("button", { name: "Next page", exact: true }).click();
    await page.getByText("Page 2 of 3", { exact: true }).waitFor();
    assert.equal(new URL(page.url()).searchParams.get("page"), "2");
    assert.equal(await rows.count(), 20);
    await check(page, "transactions-page-2", width, height);
    await page.reload();
    if (width < 768) await page.locator(".mobile-navigation").waitFor();
    await page.getByText("Page 2 of 3", { exact: true }).waitFor();
    await rows.first().getByRole("button", { name: /Edit/ }).click();
    await page.getByRole("textbox", { name: "Title", exact: true }).fill("Pagination edited transaction");
    const saved = await saveEditor(page);
    assert.equal(saved.entries.find((entry) => entry.title === "Pagination edited transaction").date, date, "Editing a title must preserve timestamp precision and pagination order");
    await page.getByRole("button", { name: "Edit Pagination edited transaction", exact: true }).waitFor();
    await page.getByRole("button", { name: "Next page", exact: true }).click();
    await page.getByText("Page 3 of 3", { exact: true }).waitFor();
    assert.equal(await rows.count(), before.data.entries.filter((entry) => entry.date.slice(0, 7) === date.slice(0, 7)).length + 41 - 40);
    assert.equal(await page.getByRole("button", { name: "Next page", exact: true }).isDisabled(), true);
    await check(page, "transactions-last-page", width, height);
    await page.goBack();
    await page.getByText("Page 2 of 3", { exact: true }).waitFor();
    await chooseMonth(page, singleDate.toISOString().slice(0, 7));
    await page.getByText("Page 1 of 1", { exact: true }).waitFor();
    await page.waitForURL((url) => !url.searchParams.has("page"));
    assert.equal(new URL(page.url()).searchParams.has("page"), false, "Changing the period resets pagination");
  } finally {
    await sql`update public.ledger set data = ${sql.json(before.data)}, version = ${before.version} where user_id = ${id}`;
    await page.goto(`${origin}/transactions`);
  }
}

async function checkMobileFilters(page, width, height) {
  const heading = page.getByRole("heading", { name: "Transactions", exact: true, level: 1 });
  assert.equal(await heading.count(), 1);
  assert.ok(await heading.evaluate((el) => !!el.closest("header")));
  assert.equal(await page.locator(".account-name").isVisible(), false);
  await check(page, "mobile-compact-summary", width, height);
  const period = page.getByRole("button", { name: /^Change period:/ });
  const original = await period.getAttribute("aria-label");
  await page.getByRole("button", { name: "Previous month", exact: true }).click();
  assert.notEqual(await period.getAttribute("aria-label"), original);
  await page.getByRole("button", { name: "Next month", exact: true }).click();
  assert.equal(await period.getAttribute("aria-label"), original);
  await period.click();
  await choose(page, "Period type", "Custom dates");
  await page.getByLabel("Start date", { exact: true }).and(page.locator("input:visible")).fill("2026-03-02");
  await page.getByLabel("End date", { exact: true }).and(page.locator("input:visible")).fill("2026-03-01");
  assert.equal(await page.getByRole("button", { name: "Apply period", exact: true }).isDisabled(), true);
  await check(page, "mobile-period-invalid", width, height);
  const singleDay = singleDate.toISOString().slice(0, 10);
  await page.getByLabel("Start date", { exact: true }).and(page.locator("input:visible")).fill(singleDay);
  await page.getByLabel("End date", { exact: true }).and(page.locator("input:visible")).fill(singleDay);
  await page.getByRole("button", { name: "Apply period", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  assert.equal(await page.getByRole("button", { name: "Edit Previous month bill", exact: true }).count(), 1);
  await check(page, "mobile-custom-period", width, height);
  await switchView(page, "Report");
  await check(page, "mobile-report-custom-period", width, height);
  await period.click();
  await choose(page, "Period type", "Month");
  await chooseMonth(page, date.slice(0, 7));
  await check(page, "mobile-period-sheet", width, height);
  await page.getByRole("button", { name: "Apply period", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  await check(page, "mobile-report-compact", width, height);
  await switchView(page, "Transactions");
  assert.equal(await period.getAttribute("aria-label"), original);
}

async function checkTransactionFilters(page, width, height) {
  const mobile = width < 768;
  if (mobile) await checkMobileFilters(page, width, height);
  const form = page.getByRole("form", { name: "Filter transaction history" });
  const searchForm = mobile ? page.getByRole("form", { name: "Search transaction history" }) : form;
  const rows = page.locator('[aria-label="Transaction history"] tbody tr');
  await check(page, "transaction-filters", width, height);
  assert.ok(await page.locator('.entry-icon.correction .lucide-scale').count());
  await searchForm.getByRole("searchbox", { name: "Search transactions" }).fill("FRIENDS");
  await searchForm.getByRole("button", { name: mobile ? "Search transactions" : "Apply filters", exact: true }).click();
  await page.waitForURL((url) => url.searchParams.get("search") === "FRIENDS");
  await page.getByText("Showing 1–1 of 1 transactions", { exact: true }).waitFor();
  assert.equal(await rows.count(), 1);
  assert.ok((await rows.innerText()).includes("Lunch and groceries"));
  await page.reload();
  await searchForm.getByRole("searchbox").waitFor();
  assert.equal(await searchForm.getByRole("searchbox").inputValue(), "FRIENDS");
  await searchForm.getByRole("searchbox").fill("");
  if (mobile) await page.getByRole("button", { name: "Filters", exact: true }).click();
  await form.getByRole("combobox", { name: "Transaction type", exact: true }).click();
  await page.getByRole("option", { name: "Opening balances & corrections", exact: true }).click();
  await check(page, "transaction-filters-long-selection", width, height);
  await form.getByRole("button", { name: "Apply filters", exact: true }).click();
  await page.waitForURL((url) => url.searchParams.get("type") === "correction");
  await page.getByText("Showing 1–2 of 2 transactions", { exact: true }).waitFor();
  assert.equal(await rows.count(), 2);
  if (mobile) {
    await page.getByRole("button", { name: "Filters (1)", exact: true }).click();
    await form.getByRole("button", { name: "Reset", exact: true }).click();
    await form.getByRole("button", { name: "Apply filters", exact: true }).click();
  } else await form.getByRole("button", { name: "Clear filters", exact: true }).click();
  await page.waitForURL((url) => url.search === "");
  await page.goto(`${origin}/transactions?wallet=bank&type=transfer&currency=USD`);
  await page.getByText("Showing 1–1 of 1 transactions", { exact: true }).waitFor();
  assert.equal(await rows.count(), 1);
  await check(page, "transaction-filters-transfer", width, height);
  if (mobile) {
    await page.getByRole("button", { name: "Filters (3)", exact: true }).click();
    await choose(page, "Wallet", "Long wallet ".repeat(12).trim());
    await check(page, "mobile-filter-sheet-long", width, height);
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "detached" });
    assert.equal(await page.getByRole("button", { name: "Filters (3)", exact: true }).evaluate((el) => el === document.activeElement), true);
    await page.getByRole("button", { name: "Filters (3)", exact: true }).click();
    assert.match(await form.getByRole("combobox", { name: "Wallet", exact: true }).innerText(), /BCA Main Account/);
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "detached" });
    await page.getByRole("button", { name: "Remove Currency: USD", exact: true }).click();
    await page.waitForURL((url) => !url.searchParams.has("currency"));
    assert.equal(new URL(page.url()).searchParams.get("wallet"), "bank");
    assert.equal(new URL(page.url()).searchParams.get("type"), "transfer");
  }
  await page.goto(`${origin}/transactions?category=missing`);
  await page.getByRole("heading", { name: "No transactions match this period and filters" }).waitFor();
  await check(page, "transaction-filters-empty", width, height);
  await page.goto(`${origin}/transactions`);
  await page.getByRole("button", { name: "Add transaction", exact: true }).click();
  const menu = page.locator('[data-slot="dropdown-menu-content"]');
  await menu.waitFor();
  assert.equal(await menu.evaluate((element) => getComputedStyle(element).animationName), "enter");
  assert.equal(await menu.evaluate((element) => getComputedStyle(element).animationDuration), "0.2s");
  const backdrop = page.locator('[data-slot="dropdown-menu-backdrop"]');
  const addButton = page.getByRole("button", { name: "Add transaction", exact: true });
  if (width < 768) {
    await backdrop.waitFor();
    await check(page, "transaction-add-menu", width, height);
    assert.equal(await addButton.locator("svg").evaluate((element) => getComputedStyle(element).transform), "matrix(0.707107, 0.707107, -0.707107, 0.707107, 0, 0)");
    assert.match(await backdrop.evaluate((element) => getComputedStyle(element).backgroundColor), /(?:\/ |, )0\.25\)$/);
    assert.equal(await addButton.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)?.closest('[aria-label="Add transaction"]') === element;
    }), true, "The plus button stays above the backdrop");
    await addButton.click();
    await menu.waitFor({ state: "detached" });
    await backdrop.waitFor({ state: "detached" });
    await check(page, "transaction-add-menu-closed", width, height);
    assert.equal(await addButton.locator("svg").evaluate((element) => getComputedStyle(element).transform), "none");
    await addButton.click();
    await menu.waitFor();
    await page.keyboard.press("Escape");
    await menu.waitFor({ state: "detached" });
    await backdrop.waitFor({ state: "detached" });
    await addButton.click();
    await menu.waitFor();
    await backdrop.click({ position: { x: 4, y: 4 } });
    await menu.waitFor({ state: "detached" });
    await backdrop.waitFor({ state: "detached" });
    await addButton.click();
    await menu.waitFor();
  } else {
    assert.equal(await backdrop.isVisible(), false, "Tablet and desktop have no dimmed backdrop");
    assert.equal(await addButton.locator("svg").evaluate((element) => getComputedStyle(element).transform), "none");
    await check(page, "transaction-add-menu", width, height);
  }
  await page.getByRole("menuitem", { name: "Expense", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add expense", exact: true });
  await dialog.waitFor();
  await backdrop.waitFor({ state: "detached" });
  const animation = await dialog.evaluate((element) => ({ name: getComputedStyle(element).animationName, duration: getComputedStyle(element).animationDuration }));
  console.log("Editor animation", animation);
  assert.notEqual(animation.name, "none");
  assert.equal(animation.duration, "0.2s");
  await check(page, "transaction-editor-animation", width, height);
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
  assert.equal(await page.getByRole("button", { name: "Add transaction", exact: true }).evaluate((element) => element === document.activeElement), true);
  await page.getByRole("button", { name: "Account menu", exact: true }).click();
  await menu.waitFor();
  assert.equal(await menu.evaluate((element) => getComputedStyle(element).animationName), "enter");
  assert.equal(await menu.evaluate((element) => getComputedStyle(element).animationDuration), "0.2s");
  assert.equal(await backdrop.count(), 0, "The account menu has no dimmed backdrop");
  await check(page, "account-menu-animation", width, height);
  await page.keyboard.press("Escape");
  await menu.waitFor({ state: "detached" });
  assert.equal(await page.getByRole("button", { name: "Account menu", exact: true }).evaluate((element) => element === document.activeElement), true);
  if (width === 320 || width === 1440) {
    await checkPagination(page, width, height);
    await page.goto(`${origin}/transactions`);
  }
}

async function checkBalances(page, width, height) {
  const before = await (await page.request.get(`${origin}/api/ledger`)).json();
  const cacheBefore = await sql`select rate_date, rates, last_checked_at from public.exchange_rate_cache order by rate_date`;
  const snapshot = { IDR: "17800", CAD: "1.38" };
  let mode = "ok";
  const handler = async (route) => {
    const params = new URL(route.request().url()).searchParams;
    const suggestion = mode === "missing" ? null : { rate: crossRate(snapshot, params.get("from"), params.get("to")), rateDate: "2026-10-01", provider: "ecb", lastCheckedAt: "2026-10-01T00:00:00Z", stale: mode === "stale" };
    await route.fulfill({ json: { suggestion } });
  };
  await page.route("**/api/exchange-rates?*", handler);
  try {
    await page.reload();
    await page.locator('.balance-stat[aria-busy="false"]').waitFor();
    assert.equal(await page.getByRole("combobox", { name: "Currency", exact: true }).innerText(), "IDR");
    const toggle = page.getByRole("button", { name: "Show wallet balances", exact: true });
    assert.equal(await toggle.getAttribute("aria-expanded"), "false");
    assert.equal(await page.locator(".balance-breakdown").isVisible(), false);
    await check(page, "balance-collapsed", width, height);
    const collapsedHeight = await page.locator(".stats").evaluate((el) => el.getBoundingClientRect().height);
    await toggle.focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.getByRole("button", { name: "Hide wallet balances", exact: true }).getAttribute("aria-expanded"), "true");
    assert.equal(await page.locator(".balance-breakdown").isVisible(), true);
    assert.ok(await page.locator(".stats").evaluate((el) => el.getBoundingClientRect().height) > collapsedHeight, "Collapsing the breakdown reduces summary height");
    for (const target of ["IDR", "USD", "CAD"]) {
      if (target !== "IDR") await choose(page, "Currency", target);
      await page.locator('.balance-stat[aria-busy="false"]').waitFor();
      const rates = Object.fromEntries(["IDR", "USD", "CAD"].map((source) => [source, { rate: crossRate(snapshot, source, target), rateDate: "2026-10-01", stale: false }]));
      const expected = balanceBreakdown(before.data, target, rates);
      const money = (amount, currency) => new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount / 100);
      assert.equal(await page.locator(".balance-stat h2").innerText(), money(expected.total, target));
      for (const row of expected.rows) {
        const item = page.locator(".balance-breakdown > div").filter({ has: page.getByText(`${row.currency} wallets`, { exact: true }) });
        assert.ok((await item.innerText()).includes(money(row.amount, row.currency)));
        if (row.currency !== target) assert.ok((await item.innerText()).includes(`≈ ${money(row.converted, target)}`));
      }
      await check(page, `balance-${target}`, width, height);
    }
    await page.getByRole("button", { name: "Hide wallet balances", exact: true }).focus();
    await page.keyboard.press("Space");
    assert.equal(await toggle.getAttribute("aria-expanded"), "false");
    assert.equal(await page.locator(".balance-breakdown").isVisible(), false);
    if (width === 320) {
      mode = "missing";
      await choose(page, "Currency", "IDR");
      await page.getByRole("button", { name: "Retry conversion", exact: true }).waitFor();
      assert.equal(await page.locator(".balance-stat h2").innerText(), "—", "Missing rates must not display a partial total");
      await check(page, "balance-missing-rates", width, height);
      mode = "ok";
      await page.getByRole("button", { name: "Retry conversion", exact: true }).click();
      await page.locator('.balance-stat[aria-busy="false"]').waitFor();
      assert.notEqual(await page.locator(".balance-stat h2").innerText(), "—");
      mode = "stale";
      await choose(page, "Currency", "USD");
      await page.getByText(/cached rates may be outdated/).waitFor();
      await check(page, "balance-stale-rates", width, height);
    }
    assert.deepEqual(await (await page.request.get(`${origin}/api/ledger`)).json(), before, "Conversions must not change the ledger or its version");
    assert.deepEqual(await sql`select rate_date, rates, last_checked_at from public.exchange_rate_cache order by rate_date`, cacheBefore, "Balance reads must not refresh shared rates");
  } finally {
    await page.unroute("**/api/exchange-rates?*", handler);
  }
  await page.reload();
  await page.locator('.balance-stat[aria-busy="false"]').waitFor();
}

async function checkNavigation(page, width, height) {
  const toggle = page.locator('[data-sidebar="trigger"]');
  const sheet = page.getByRole("dialog", { name: "Workspace navigation", exact: true });
  if (width < 768) {
    const navigation = page.getByRole("tablist", { name: "Workspace", exact: true });
    await navigation.waitFor();
    assert.equal(await navigation.getAttribute("aria-orientation") ?? "horizontal", "horizontal");
    assert.equal(await navigation.getByRole("tab").count(), 4);
    await page.waitForFunction(() => [...document.querySelectorAll(".mobile-nav-icon")].every((el) => {
      const active = el.closest('[aria-selected="true"]');
      return Math.abs(el.getBoundingClientRect().width - (active ? 18 : 0)) < 0.5;
    }));
    assert.equal(await navigation.evaluate((el) => el.getBoundingClientRect().height), 56, "Phone navigation stays compact");
    assert.equal(await toggle.isVisible(), false);
    await navigation.getByRole("tab", { name: "Transactions", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(() => document.activeElement.getAttribute("aria-label") === "Wallet");
    await page.keyboard.press("Enter");
    await page.getByRole("heading", { name: "Wallet", exact: true, level: 1 }).waitFor();
    assert.equal(await sheet.count(), 0, "Phone navigation switches sections directly");
    await check(page, "navigation-floating", width, height);
    await page.waitForFunction(() => {
      const indicator = document.querySelector(".mobile-nav-indicator").getBoundingClientRect();
      const active = document.querySelector('.mobile-navigation [aria-selected="true"]').getBoundingClientRect();
      const icons = [...document.querySelectorAll(".mobile-nav-icon")];
      return Math.abs(indicator.x - active.x) < 1 && Math.abs(indicator.width - active.width) < 1 && icons.every((el) => Math.abs(el.getBoundingClientRect().width - (el.closest('[aria-selected="true"]') ? 18 : 0)) < 0.5);
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.ok(await page.locator(".mobile-nav-indicator").evaluate((el) => parseFloat(getComputedStyle(el).transitionDuration) < 0.001), "Navigation respects reduced motion");
    assert.ok(await page.locator(".mobile-nav-icon").first().evaluate((el) => parseFloat(getComputedStyle(el).transitionDuration) < 0.001), "Icon animation respects reduced motion");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    if (width === 320) {
      await page.setViewportSize({ width: 768, height: 1024 });
      await toggle.waitFor({ state: "visible" });
      await toggle.click();
      await sheet.waitFor();
      await page.setViewportSize({ width, height });
      await sheet.waitFor({ state: "detached" });
      await navigation.waitFor();
      assert.equal(await navigation.getByRole("tab", { name: "Wallet", exact: true }).getAttribute("aria-selected"), "true");
    }
    await switchView(page, "Transactions");
  } else if (width < 1200) {
    assert.equal(await page.getByRole("tab", { name: "Report", exact: true }).count(), 0, "Mobile navigation stays in the Sheet");
    await toggle.focus();
    await page.keyboard.press("Enter");
    await sheet.waitFor();
    assert.equal(await sheet.getAttribute("aria-modal"), "true");
    assert.equal(await toggle.getAttribute("aria-expanded"), "true");
    assert.equal(await sheet.getByRole("tab").count(), 4);
    assert.equal(await sheet.locator(".profile strong").count(), 1);
    await check(page, "navigation-sheet", width, height);
    await sheet.getByRole("button", { name: "Close", exact: true }).focus();
    await page.keyboard.press("Tab");
    await page.waitForFunction(() => document.querySelector('[role="dialog"][id="workspace-navigation"]')?.contains(document.activeElement));
    assert.equal(await sheet.evaluate((el) => el.contains(document.activeElement)), true, "Sheet traps keyboard focus");
    await sheet.getByRole("tab", { name: "Transactions", exact: true }).focus();
    await page.keyboard.press("ArrowDown");
    assert.equal(await sheet.getByRole("tablist").getAttribute("aria-orientation"), "vertical");
    await page.waitForFunction(() => document.activeElement.textContent.trim() === "Wallet");
    await page.keyboard.press("Enter");
    await sheet.waitFor({ state: "detached" });
    await page.getByRole("heading", { name: "Wallet", exact: true, level: 1 }).waitFor();
    assert.equal(await toggle.evaluate((el) => el === document.activeElement), true);
    await toggle.click();
    await sheet.waitFor();
    await page.keyboard.press("Escape");
    await sheet.waitFor({ state: "detached" });
    assert.equal(await toggle.evaluate((el) => el === document.activeElement), true);
    await toggle.click();
    await sheet.waitFor();
    await sheet.getByRole("button", { name: "Close", exact: true }).click();
    await sheet.waitFor({ state: "detached" });
    assert.equal(await toggle.evaluate((el) => el === document.activeElement), true);
    await toggle.click();
    await sheet.waitFor();
    await page.mouse.click(width - 2, height / 2);
    await sheet.waitFor({ state: "detached" });
    assert.equal(await toggle.evaluate((el) => el === document.activeElement), true);
    assert.equal(await toggle.getAttribute("aria-expanded"), "false");
    if (width === 768) {
      await toggle.click();
      await sheet.waitFor();
      await page.setViewportSize({ width: 1440, height: 900 });
      await sheet.waitFor({ state: "detached" });
      await page.getByRole("tab", { name: "Wallet", exact: true }).waitFor();
      await check(page, "navigation-resized-desktop", 1440, 900);
      await page.setViewportSize({ width, height });
      await page.waitForFunction(() => !document.querySelector('.ledger-desktop-sidebar'));
      assert.equal(await sheet.count(), 0, "Returning to mobile must not reopen a stale Sheet");
      assert.equal(await toggle.getAttribute("aria-expanded"), "false");
    }
    await switchView(page, "Transactions");
  } else {
    assert.equal(await toggle.getAttribute("aria-expanded"), "true");
    await toggle.click();
    assert.equal(await toggle.getAttribute("aria-expanded"), "false");
    assert.equal(await page.getByRole("tab", { name: "Transactions", exact: true }).count(), 1, "Collapsed desktop navigation remains usable");
    await check(page, "navigation-collapsed", width, height);
    assert.equal(await page.locator(".ledger-sidebar-panel").evaluate((el) => el.getBoundingClientRect().width), 72);
    assert.equal(await page.locator(".workspace").evaluate((el) => el.getBoundingClientRect().left), 72, "Collapsing the sidebar leaves an icon rail");
    assert.equal(await page.locator(".ledger-sidebar-panel .nav-text").first().isVisible(), false);
    assert.equal(await toggle.getAttribute("aria-label"), "Expand sidebar");
    assert.equal(await toggle.evaluate((el) => !!el.closest(".ledger-sidebar-panel")), true, "Desktop toggle belongs inside the sidebar");
    await switchView(page, "Report");
    await check(page, "navigation-collapsed-report", width, height);
    await switchView(page, "Transactions");
    await toggle.focus();
    await page.keyboard.press("Enter");
    await check(page, "navigation-expanded", width, height);
    assert.equal(await toggle.getAttribute("aria-label"), "Collapse sidebar");
    assert.equal(await page.locator(".ledger-sidebar-panel .nav-text").first().isVisible(), true);
    assert.equal(await page.getByRole("tab", { name: "Transactions", exact: true }).count(), 1);
  }
}

async function checkNavigationClearance(page, name, width, height) {
  if (width >= 768) return;
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await check(page, `${name}-bottom`, width, height);
  const footerClearance = await page.evaluate(() => [...document.querySelectorAll(".editor-with-body")].map((modal) => {
    const button = [...modal.querySelectorAll('.form-actions button[type="submit"]')].find(el => el.getClientRects().length);
    if (!button) return null;
    const dialog = modal.getBoundingClientRect();
    const action = button.getBoundingClientRect();
    return {inside: action.top >= dialog.top && action.bottom <= dialog.bottom - 9, clearance: dialog.bottom - action.bottom};
  }).filter(Boolean));
  assert.ok(footerClearance.every((footer) => footer.clearance < 33), `${name}: unused space below modal actions: ${JSON.stringify(footerClearance)}`);
  assert.ok(footerClearance.every((footer) => footer.inside), `${name}: modal footer must stay visible with bottom padding: ${JSON.stringify(footerClearance)}`);
  const layout = await page.evaluate(() => {
    const nav = document.querySelector(".mobile-navigation").getBoundingClientRect();
    const footer = document.querySelector(".workspace > footer").getBoundingClientRect();
    const content = document.querySelector(".page-content").getBoundingClientRect();
    const add = document.querySelector(".ledger-add-button");
    return { navTop: nav.top, navBottom: nav.bottom, footerBottom: footer.bottom, contentBottom: content.bottom, addTop: add?.getBoundingClientRect().top };
  });
  assert.ok(layout.navTop >= 0 && layout.navBottom <= height, "Floating navigation stays inside the viewport");
  assert.ok(layout.footerBottom < layout.navTop, `${name}: footer clears the floating navigation`);
  assert.ok(layout.contentBottom < layout.navTop, `${name}: final content clears the floating navigation`);
  if (layout.addTop !== undefined) assert.ok(layout.footerBottom < layout.addTop && layout.contentBottom < layout.addTop, `${name}: content clears the floating plus button`);
  assert.equal(await page.getByRole("dialog", { name: "Workspace navigation", exact: true }).count(), 0);
  await page.getByRole("tab", { name: name === "transactions" ? "Transactions" : name[0].toUpperCase() + name.slice(1), exact: true }).click();
  assert.equal(await page.evaluate(() => window.scrollY), 0, "Phone navigation returns to the top of the section");
}

async function openTransaction(page, kind = "expense") {
  await page.getByRole("button", { name: "Add transaction", exact: true }).click();
  await page.getByRole("menuitem", { name: kind[0].toUpperCase() + kind.slice(1), exact: true }).click();
}

async function choose(page, label, option) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await check(
    page,
    "select-" + label.replaceAll(" ", "-"),
    page.viewportSize().width,
    page.viewportSize().height,
  );
  await page.getByRole("option", { name: option, exact: true }).click();
}

async function chooseMonth(page, value) {
  const needsSheet = page.viewportSize().width < 768 && !(await page.getByRole("dialog", { name: "Period and summary currency", exact: true }).isVisible());
  if (needsSheet) {
    await page.getByRole("button", { name: /^Change period:/ }).click();
    await choose(page, "Period type", "Month");
  }
  await page.getByRole("button", { name: "Month", exact: true }).click();
  await page
    .getByRole("spinbutton", { name: "Year", exact: true })
    .fill(value.slice(0, 4));
  await check(
    page,
    "month-picker",
    page.viewportSize().width,
    page.viewportSize().height,
  );
  const name = new Date(`${value}-01T12:00`).toLocaleDateString("en", {
    month: "short",
  });
  await page
    .getByRole("button", {
      name: `${name} ${Number(value.slice(0, 4))}`,
      exact: true,
    })
    .click();
  if (needsSheet) {
    await page.getByRole("button", { name: "Apply period", exact: true }).click();
    await page.getByRole("dialog").waitFor({ state: "detached" });
  }
}

async function check(page, name, width, height) {
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
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
  const clippedTitles = await page.evaluate(() => [...document.querySelectorAll(".editor-with-body")].filter((modal) => {
    const title = modal.querySelector('[data-slot="dialog-title"]').getBoundingClientRect();
    const bounds = modal.getBoundingClientRect();
    return title.top < bounds.top + 8 || title.bottom > bounds.bottom;
  }).length);
  assert.equal(clippedTitles, 0, `${name}: modal title must stay inside its header`);
  const clippedSheetTitles = await page.evaluate(() => [...document.querySelectorAll(".mobile-filter-sheet")].filter((sheet) => {
    const title = sheet.querySelector('[data-slot="sheet-title"]').getBoundingClientRect();
    const bounds = sheet.getBoundingClientRect();
    return title.top < bounds.top || title.bottom > bounds.bottom;
  }).length);
  assert.equal(clippedSheetTitles, 0, `${name}: filter sheet title must stay visible when fields receive focus`);
  const modalGaps = await page.evaluate(() => [...document.querySelectorAll(".editor-with-body")].map((modal) => {
    const heading = modal.querySelector(".panel-heading");
    const body = [...modal.children].find((child) => child.tagName === "FORM" && child.getClientRects().length);
    return heading && body ? body.getBoundingClientRect().top - heading.getBoundingClientRect().bottom : 0;
  }));
  assert.ok(modalGaps.every((gap) => Math.abs(gap) < 1), `${name}: unexpected modal header gap: ${modalGaps}`);
  const footerClearance = await page.evaluate(() => [...document.querySelectorAll(".editor-with-body")].map((modal) => {
    const button = [...modal.querySelectorAll('.form-actions button[type="submit"]')].find(el => el.getClientRects().length);
    if (!button) return null;
    const dialog = modal.getBoundingClientRect();
    const action = button.getBoundingClientRect();
    return {inside: action.top >= dialog.top && action.bottom <= dialog.bottom - 9, clearance: dialog.bottom - action.bottom};
  }).filter(Boolean));
  assert.ok(footerClearance.every((footer) => footer.clearance < 33), `${name}: unused space below modal actions: ${JSON.stringify(footerClearance)}`);
  assert.ok(footerClearance.every((footer) => footer.inside), `${name}: modal footer must stay visible with bottom padding: ${JSON.stringify(footerClearance)}`);
  const layout = await page.evaluate(() => {
    const scope = document;
    const controls = [
      ...scope.querySelectorAll('button, input, textarea, a, [role="option"]'),
    ].filter(
      (el) =>
        el.getClientRects().length &&
        getComputedStyle(el).visibility !== "hidden" &&
        !el.closest('[aria-hidden="true"]'),
    );
    return {
      width: document.documentElement.scrollWidth,
      stretchedNavigation:
        innerWidth >= 1200
          ? [...document.querySelectorAll(".workspace-tabs .nav-item")].filter(
              (el) => el.getBoundingClientRect().height > 64,
            ).length
          : 0,
      small: controls
        .filter((el) => {
          const rect = el.getBoundingClientRect();
          return rect.width < 43.5 || rect.height < 43.5;
        })
        .map((el) => ({
          tag: el.tagName,
          label: el.getAttribute("aria-label") || el.textContent || el.name,
          style: el.getAttribute("style"),
          ariaHidden: el.getAttribute("aria-hidden"),
          width: el.getBoundingClientRect().width,
          height: el.getBoundingClientRect().height,
        })),
      smallText: controls.filter(
        (el) =>
          el.matches("input, select, textarea") &&
          parseFloat(getComputedStyle(el).fontSize) < 16,
      ).length,
      overflow: [
        ...document.querySelectorAll(
          ".table-wrap, .editor, [data-slot=select-content], [data-slot=popover-content], [data-slot=alert-dialog-content], [data-slot=sheet-content]",
        ),
      ]
        .filter((el) => el.scrollWidth > el.clientWidth + 1)
        .map((el) => ({
          slot: el.getAttribute("data-slot"),
          className: el.className,
          width: el.clientWidth,
          content: el.scrollWidth,
        })),
      clippedPopups: [
        ...document.querySelectorAll(
          '[data-slot="select-content"], [data-slot="popover-content"], [data-slot="alert-dialog-content"], [data-slot="sheet-content"]',
        ),
      ]
        .filter(
          (el) =>
            el.getClientRects().length &&
            getComputedStyle(el).visibility !== "hidden",
        )
        .map((el) => ({
          slot: el.getAttribute("data-slot"),
          rect: el.getBoundingClientRect(),
        }))
        .filter(
          ({ rect }) =>
            rect.x < -1 ||
            rect.right > innerWidth + 1 ||
            rect.y < -1 ||
            rect.bottom > innerHeight + 1,
        )
        .map(({ slot, rect }) => ({
          slot,
          x: rect.x,
          y: rect.y,
          right: rect.right,
          bottom: rect.bottom,
        })),
      narrowTitles: [
        ...document.querySelectorAll(
          ".transaction-detail .transaction-name strong",
        ),
      ].filter(
        (el) =>
          el.textContent.length > 40 && el.getBoundingClientRect().width < (getComputedStyle(el).webkitLineClamp === "2" ? 64 : 120),
      ).length,
    };
  });
  assert.ok(
    layout.width <= width,
    `${width}×${height} ${name}: page overflow (${layout.width}px)`,
  );
  assert.equal(
    layout.stretchedNavigation,
    0,
    `${width}×${height} ${name}: desktop navigation items are stretched`,
  );
  assert.deepEqual(
    layout.small,
    [],
    `${width}×${height} ${name}: small touch controls`,
  );
  assert.equal(
    layout.smallText,
    0,
    `${width}×${height} ${name}: small input text`,
  );
  assert.deepEqual(
    layout.overflow,
    [],
    `${width}×${height} ${name}: content overflow`,
  );
  assert.deepEqual(
    layout.clippedPopups,
    [],
    `${width}×${height} ${name}: popup clipped by viewport`,
  );
  assert.equal(
    layout.narrowTitles,
    0,
    `${width}×${height} ${name}: transaction titles are squeezed`,
  );
  if (screenshots)
    await page.screenshot({
      caret: "initial",
      path: `${screenshots}/${width}x${height}-${name}.png`,
      fullPage: !(
        name.endsWith("-bottom") || name === "navigation-floating" ||
        (await page.getByRole("dialog").count()) ||
        (await page.getByRole("alertdialog").count())
      ),
    });
}

async function saveEditor(page) {
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/ledger") &&
      response.request().method() === "POST",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  const response = await saved;
  assert.ok(response.ok(), await response.text());
  const result = await response.json();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  return result.data;
}

async function removeFeeTransfer(page) {
  await page
    .getByRole("button", { name: "Edit Transfer service fee", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/ledger") &&
      response.request().method() === "POST",
  );
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete transaction", exact: true })
    .click();
  assert.ok((await saved).ok());
  await page.getByRole("dialog").waitFor({ state: "detached" });
}

async function checkTransferFees(page, width, height) {
  await switchView(page, "Transactions");
  const before = (await (await page.request.get(`${origin}/api/ledger`)).json())
    .data;
  const cacheBefore =
    await sql`select rate_date, last_checked_at from public.exchange_rate_cache order by rate_date`;
  await openTransaction(page, "transfer");
  await choose(page, "To wallet", "GoPay");
  await page
    .getByRole("textbox", { name: "Amount sent", exact: true })
    .fill("200000");
  await page
    .getByRole("textbox", { name: "Service fee (IDR)", exact: true })
    .fill("1000");
  assert.match(
    await page.locator(".transfer-summary").textContent(),
    /199,000/,
  );
  await check(page, "same-currency-destination-fee", width, height);
  let saved = await saveEditor(page);
  let fee = saved.entries.findLast((e) => e.transferId);
  const transferId = fee.transferId;
  assert.equal(fee.wallet, "gopay");
  assert.equal(fee.amount, 100000);
  assert.equal(
    balance(saved, "bank", "IDR"),
    balance(before, "bank", "IDR") - 20000000,
  );
  assert.equal(
    balance(saved, "gopay", "IDR"),
    balance(before, "gopay", "IDR") + 19900000,
  );
  assert.match(
    await page
      .getByRole("row")
      .filter({
        has: page.getByRole("button", { name: "Edit Transfer", exact: true }),
      })
      .filter({ hasText: "GoPay" })
      .first()
      .textContent(),
    /199,000/,
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Edit Transfer service fee", exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("textbox", { name: "Service fee (IDR)", exact: true })
      .inputValue(),
    "1.000,00",
  );
  await choose(page, "Fee charged to", "Source · BCA Main Account (IDR)");
  await check(page, "same-currency-source-fee", width, height);
  saved = await saveEditor(page);
  assert.equal(
    saved.entries.filter((e) => e.transferId === transferId).length,
    1,
  );
  assert.equal(
    balance(saved, "bank", "IDR"),
    balance(before, "bank", "IDR") - 20100000,
  );
  assert.equal(
    balance(saved, "gopay", "IDR"),
    balance(before, "gopay", "IDR") + 20000000,
  );
  await switchView(page, "Report");
  const admin = page
    .locator(".expense-category-list .report-row")
    .filter({ hasText: "Admin fees" });
  assert.match(await admin.textContent(), /1,000/);
  await check(page, "admin-fee-report", width, height);
  await switchView(page, "Transactions");
  await removeFeeTransfer(page);
  let restored = (await (await page.request.get(`${origin}/api/ledger`)).json())
    .data;
  assert.deepEqual(
    restored.entries,
    before.entries,
    "Deleting a transfer must remove its fee atomically.",
  );

  await openTransaction(page, "transfer");
  await choose(page, "Source currency", "USD");
  await choose(page, "To wallet", "GoPay");
  const rate = page.getByRole("spinbutton", {
    name: "Exchange rate (1 USD in IDR)",
    exact: true,
  });
  await page.waitForFunction(
    () => Number(document.querySelector('[name="exchangeRate"]')?.value) > 0,
  );
  assert.match(
    await page.getByRole("dialog").textContent(),
    /ECB via Frankfurter/,
  );
  await page
    .getByRole("textbox", { name: "Amount sent", exact: true })
    .fill("100");
  const received = page.getByRole("textbox", {
    name: "Amount received before fee (IDR)",
    exact: true,
  });
  assert.equal(
    Number(await page.locator('input[type="hidden"][name="received"]').inputValue()),
    Number(await rate.inputValue()) * 100,
  );
  const referenceRate = await rate.inputValue();
  await page
    .getByRole("textbox", { name: "Service fee (IDR)", exact: true })
    .fill("1000");
  await check(page, "cross-currency-reference-rate", width, height);
  saved = await saveEditor(page);
  fee = saved.entries.findLast((e) => e.transferId);
  const referenceTransfer = saved.entries.find((e) => e.id === fee.transferId);
  assert.equal(referenceTransfer.exchangeRate.source, "ecb");
  assert.equal(referenceTransfer.exchangeRate.value, referenceRate);
  assert.ok(referenceTransfer.exchangeRate.referenceDate);
  await page
    .getByRole("button", { name: "Edit Transfer service fee", exact: true })
    .click();
  assert.equal(await rate.inputValue(), referenceRate);
  await rate.fill("17800");
  assert.equal(await received.inputValue(), "1.780.000,00");
  await received.fill("1770000");
  assert.equal(await rate.inputValue(), "17700");
  await rate.fill("17800");
  await page
    .getByRole("textbox", { name: "Service fee (IDR)", exact: true })
    .fill("1000");
  assert.match(
    await page.locator(".transfer-summary").textContent(),
    /1,779,000/,
  );
  await check(page, "cross-currency-manual-rate-fee", width, height);
  saved = await saveEditor(page);
  fee = saved.entries.findLast((e) => e.transferId);
  const transfer = saved.entries.find((e) => e.id === fee.transferId);
  assert.equal(transfer.exchangeRate.value, "17800");
  assert.equal(transfer.exchangeRate.source, "manual");
  assert.equal(
    balance(saved, "bank", "USD"),
    balance(before, "bank", "USD") - 10000,
  );
  assert.equal(
    balance(saved, "gopay", "IDR"),
    balance(before, "gopay", "IDR") + 177900000,
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Edit Transfer service fee", exact: true })
    .click();
  assert.equal(
    await rate.inputValue(),
    "17800",
    "Saved manual rate must survive reload and reference-rate suggestions.",
  );
  assert.equal(await received.inputValue(), "1.780.000,00");
  await check(page, "saved-transfer-rate", width, height);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await removeFeeTransfer(page);
  restored = (await (await page.request.get(`${origin}/api/ledger`)).json())
    .data;
  assert.deepEqual(restored.entries, before.entries);

  await page.route("**/api/exchange-rates?*", (route) =>
    route.fulfill({ json: { suggestion: null } }),
  );
  await openTransaction(page, "transfer");
  await choose(page, "Source currency", "USD");
  await choose(page, "To wallet", "GoPay");
  await page
    .getByText(
      "No cached rate for this date. Enter your actual rate or received amount.",
      { exact: true },
    )
    .waitFor();
  await page
    .getByRole("textbox", { name: "Amount sent", exact: true })
    .fill("100");
  await received.fill("1780000");
  assert.equal(await rate.inputValue(), "17800");
  await choose(page, "Fee charged to", "Source · BCA Main Account (USD)");
  await page
    .getByRole("textbox", { name: "Service fee (USD)", exact: true })
    .fill("1");
  await check(page, "manual-rate-without-cache", width, height);
  saved = await saveEditor(page);
  fee = saved.entries.findLast((e) => e.transferId);
  assert.equal(fee.currency, "USD");
  assert.equal(
    balance(saved, "bank", "USD"),
    balance(before, "bank", "USD") - 10100,
  );
  assert.equal(
    balance(saved, "gopay", "IDR"),
    balance(before, "gopay", "IDR") + 178000000,
  );
  await removeFeeTransfer(page);
  await page.unroute("**/api/exchange-rates?*");
  await openTransaction(page, "transfer");
  await choose(page, "Source currency", "CAD");
  await choose(page, "To wallet", "GoPay");
  const sent = page.getByRole("textbox", {
    name: "Amount sent",
    exact: true,
  });
  const cadRate = page.getByRole("spinbutton", {
    name: "Exchange rate (1 CAD in IDR)",
    exact: true,
  });
  await sent.fill("159.33");
  await received.fill("2000000");
  assert.equal(await cadRate.inputValue(), "12552.563861168644");
  await sent.fill("160");
  assert.equal(await received.inputValue(), "2.000.000,00");
  assert.equal(await cadRate.inputValue(), "12500");
  await sent.fill("159.33");
  await choose(page, "Fee charged to", "Source · BCA Main Account (CAD)");
  await page
    .getByRole("textbox", { name: "Service fee (CAD)", exact: true })
    .fill("1");
  await check(page, "manual-cad-to-idr-amounts", width, height);
  saved = await saveEditor(page);
  fee = saved.entries.findLast((e) => e.transferId);
  const cad = saved.entries.find((e) => e.id === fee.transferId);
  assert.equal(cad.amount, 15933);
  assert.equal(cad.received, 200000000);
  assert.equal(cad.exchangeRate.value, "12552.563861168644");
  assert.equal(cad.exchangeRate.source, "received");
  assert.equal(
    balance(saved, "bank", "CAD"),
    balance(before, "bank", "CAD") - 16033,
  );
  assert.equal(
    balance(saved, "gopay", "IDR"),
    balance(before, "gopay", "IDR") + 200000000,
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Edit Transfer service fee", exact: true })
    .click();
  assert.equal(await received.inputValue(), "2.000.000,00");
  assert.equal(await cadRate.inputValue(), "12552.563861168644");
  await sent.fill("160");
  assert.equal(
    await received.inputValue(),
    "2.000.000,00",
    "Editing sent amount must preserve the actual destination amount.",
  );
  assert.equal(await cadRate.inputValue(), "12500");
  saved = await saveEditor(page);
  assert.equal(saved.entries.find((e) => e.id === cad.id).received, 200000000);
  await removeFeeTransfer(page);
  restored = (await (await page.request.get(`${origin}/api/ledger`)).json())
    .data;
  assert.deepEqual(restored.entries, before.entries);
  const cacheAfter =
    await sql`select rate_date, last_checked_at from public.exchange_rate_cache order by rate_date`;
  assert.deepEqual(
    cacheAfter,
    cacheBefore,
    "Opening or saving transfers must not refresh the shared provider cache.",
  );
}

async function checkCategories(page, width, height) {
  const name = `Travel check ${width}`;
  await page
    .getByRole("textbox", { name: "Category name", exact: true })
    .fill(name);
  await choose(page, "Type", "Expense");
  let saved = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/ledger") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Add category", exact: true }).click();
  assert.ok(
    (await saved).ok(),
    "Category form must submit the Select's named value",
  );
  const remove = page.getByRole("button", {
    name: `Remove ${name}`,
    exact: true,
  });
  await remove.click();
  await page.getByRole("alertdialog").waitFor();
  await check(page, "category-confirmation", width, height);
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await page.getByRole("alertdialog").waitFor({ state: "detached" });
  assert.equal(await remove.count(), 1, "Cancel must preserve the category");
  assert.equal(
    await remove.evaluate((el) => el === document.activeElement),
    true,
    "Confirmation must restore focus",
  );
  await remove.click();
  saved = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/ledger") &&
      response.request().method() === "POST",
  );
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Remove category", exact: true })
    .click();
  assert.ok((await saved).ok(), "Confirmed removal must persist");
  await remove.waitFor({ state: "detached" });
}

async function checkConflicts(page, width, height) {
  const initial = await (await page.request.get(`${origin}/api/ledger`)).json();
  const bump = async () => {
    const latest = await (await page.request.get(`${origin}/api/ledger`)).json();
    const response = await page.request.post(`${origin}/api/ledger`, {
      headers: { origin },
      data: { action: "category", kind: "expense", name: `Other tab ${latest.version}`, version: latest.version },
    });
    assert.ok(response.ok(), await response.text());
    return response.json();
  };
  const submit = async (button, status) => {
    const response = page.waitForResponse((r) => r.url().endsWith("/api/ledger") && r.request().method() === "POST");
    await button.click();
    assert.equal((await response).status(), status);
  };
  const snapshot = async (form) => {
    await form.evaluate(() => document.activeElement?.blur());
    return form.evaluate((el) => [...new FormData(el)]);
  };
  expectedLedgerFailure = true;
  await switchView(page, "Transactions");
  await page.getByRole("button", { name: "Edit Lunch and groceries", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Edit expense", exact: true });
  await dialog.getByRole("textbox", { name: "Title", exact: true }).fill("Unsaved groceries A B C");
  await dialog.getByRole("textbox", { name: "Amount", exact: true }).fill("200000");
  await dialog.getByRole("textbox", { name: /Note/ }).fill("Keep my draft after reload");
  const draft = await snapshot(dialog.locator("form:visible"));
  let latest = await bump();
  const save = dialog.getByRole("button", { name: "Save", exact: true });
  await submit(save, 409);
  assert.equal(await save.isDisabled(), true);
  assert.deepEqual(await snapshot(dialog.locator("form:visible")), draft);
  await check(page, "conflict-transaction", width, height);
  await page.route("**/api/ledger", (route) => route.request().method() === "GET"
    ? route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Could not load your ledger. Please try again." }) })
    : route.continue());
  await dialog.getByRole("button", { name: "Reload latest ledger", exact: true }).click();
  await dialog.getByRole("alert").filter({ hasText: "Could not load your ledger" }).waitFor();
  assert.equal(await save.isDisabled(), true);
  assert.deepEqual(await snapshot(dialog.locator("form:visible")), draft);
  await check(page, "conflict-reload-failed", width, height);
  await page.unroute("**/api/ledger");
  await dialog.getByRole("button", { name: "Reload latest ledger", exact: true }).click();
  await dialog.getByRole("status").filter({ hasText: "Latest ledger loaded" }).waitFor();
  assert.equal(await save.isEnabled(), true);
  assert.deepEqual(await snapshot(dialog.locator("form:visible")), draft);
  assert.deepEqual(await (await page.request.get(`${origin}/api/ledger`)).json(), latest, "Reload must not save the draft");
  await check(page, "conflict-draft-kept", width, height);
  latest = await bump();
  await submit(save, 409);
  await dialog.getByRole("button", { name: "Reload latest ledger", exact: true }).click();
  await dialog.getByRole("status").filter({ hasText: "Latest ledger loaded" }).waitFor();
  await submit(save, 200);
  await dialog.waitFor({ state: "detached" });
  const saved = await (await page.request.get(`${origin}/api/ledger`)).json();
  assert.equal(saved.version, latest.version + 1);
  assert.deepEqual(saved.data.categories, latest.data.categories, "Retry preserves the other tab's changes");
  assert.equal(saved.data.entries.find((e) => e.id === "lunch").amount, 20000000);
  assert.equal(saved.data.entries.find((e) => e.id === "lunch").description, "Keep my draft after reload");
  await page.reload();
  await page.getByRole("button", { name: "Edit Unsaved groceries A B C", exact: true }).waitFor();

  await switchView(page, "Wallet");
  await page.getByRole("button", { name: "Add wallet", exact: true }).click();
  const wallet = page.getByRole("dialog", { name: "Add a wallet", exact: true });
  await wallet.getByRole("textbox", { name: "Wallet name", exact: true }).fill("Unsaved wallet");
  const walletDraft = await snapshot(wallet.locator("form:visible"));
  await bump();
  await submit(wallet.getByRole("button", { name: "Save", exact: true }), 409);
  await wallet.getByRole("button", { name: "Reload latest ledger", exact: true }).click();
  await wallet.getByRole("status").filter({ hasText: "Latest ledger loaded" }).waitFor();
  assert.deepEqual(await snapshot(wallet.locator("form:visible")), walletDraft);
  await check(page, "conflict-wallet-draft", width, height);
  await page.keyboard.press("Escape");
  await wallet.waitFor({ state: "detached" });

  await switchView(page, "Transactions");
  await openTransaction(page, "transfer");
  const transfer = page.getByRole("dialog", { name: "Add transfer", exact: true });
  await choose(page, "From wallet", "BCA Main Account");
  await choose(page, "To wallet", "GoPay");
  await transfer.getByRole("textbox", { name: "Amount sent", exact: true }).fill("45");
  await transfer.getByRole("textbox", { name: "Service fee (IDR)", exact: true }).fill("0,5");
  const transferDraft = await snapshot(transfer.locator("form:visible"));
  await bump();
  await submit(transfer.getByRole("button", { name: "Save", exact: true }), 409);
  await transfer.getByRole("button", { name: "Reload latest ledger", exact: true }).click();
  await transfer.getByRole("status").filter({ hasText: "Latest ledger loaded" }).waitFor();
  assert.deepEqual(await snapshot(transfer.locator("form:visible")), transferDraft);
  await check(page, "conflict-transfer-draft", width, height);
  await page.keyboard.press("Escape");
  await transfer.waitFor({ state: "detached" });

  await switchView(page, "Settings");
  await page.getByRole("textbox", { name: "Category name", exact: true }).fill("Unsaved category");
  await bump();
  await submit(page.getByRole("button", { name: "Add category", exact: true }), 409);
  await page.getByRole("button", { name: "Reload latest ledger", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Latest ledger loaded" }).waitFor();
  assert.equal(await page.getByRole("textbox", { name: "Category name", exact: true }).inputValue(), "Unsaved category");
  await check(page, "conflict-category-draft", width, height);
  await page.getByRole("button", { name: "Remove Food & drink", exact: true }).click();
  const confirmation = page.getByRole("alertdialog");
  await bump();
  await submit(confirmation.getByRole("button", { name: "Remove category", exact: true }), 409);
  await check(page, "conflict-delete-confirmation", width, height);
  await confirmation.getByRole("button", { name: "Reload latest ledger", exact: true }).click();
  await confirmation.getByRole("status").filter({ hasText: "Latest ledger loaded" }).waitFor();
  await confirmation.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Remove Food & drink", exact: true }).count(), 1);
  await sql`update public.ledger set data = ${sql.json(initial.data)}, version = version + 1 where user_id = ${id}`;
  await page.reload();
  expectedLedgerFailure = false;
}

async function checkInlineCategories(page, width, height) {
  await switchView(page, "Transactions");
  const before = await (await page.request.get(`${origin}/api/ledger`)).json();
  await openTransaction(page);
  const dialog = page.getByRole("dialog");
  await choose(page, "Category", "Food & drink");
  await check(page, "inline-category-existing", width, height);
  await dialog.getByRole("button", { name: "Add category", exact: true }).click();
  await dialog.getByLabel("New category name", { exact: true }).fill("Long new category ".repeat(8));
  await check(page, "inline-category-new", width, height);
  await dialog.getByRole("button", { name: "Choose an existing category", exact: true }).click();
  assert.equal(await dialog.getByRole("combobox", { name: "Category", exact: true }).innerText(), "Food & drink");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.deepEqual(await (await page.request.get(`${origin}/api/ledger`)).json(), before);
  for (const kind of ["expense", "income"]) {
    await openTransaction(page, kind);
    await choose(page, "Wallet", "BCA Main Account");
    await dialog.getByLabel("Amount", { exact: true }).fill("1");
    await dialog.getByLabel("Title", { exact: true }).fill(`Inline ${kind} ${width}`);
    await dialog.getByLabel("Note optional", { exact: true }).fill("A gift for a friend");
    await dialog.getByRole("button", { name: "Add category", exact: true }).click();
    await dialog.getByLabel("New category name", { exact: true }).fill(`Inline ${kind} category ${width}`);
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    await page.reload();
    const saved = await (await page.request.get(`${origin}/api/ledger`)).json();
    assert.ok(saved.data.categories.some((c) => c.name === `Inline ${kind} category ${width}` && c.kind === kind));
    const entry = saved.data.entries.find((e) => e.title === `Inline ${kind} ${width}`);
    assert.equal(entry.category, `Inline ${kind} category ${width}`);
    assert.equal(entry.description, "A gift for a friend");
  }
}

async function checkReceipts(page, width, height) {
  await page.getByRole("heading", { name: "Transactions", exact: true, level: 1 }).waitFor();
  await check(page, "transactions-receipt-entry", width, height);
  assert.equal(await page.getByRole("button", { name: "Import receipt", exact: true }).count(), 0, "Receipt import belongs inside Add transaction");
  await openTransaction(page);
  const manual = page.getByRole("dialog");
  await check(page, "add-transaction", width, height);
  await manual.getByRole("textbox", { name: "Title", exact: true }).fill("Keep my draft");
  await manual.getByRole("button", { name: "Import receipt", exact: true }).click();
  assert.equal(await page.getByRole("dialog").count(), 1, "Receipt upload uses the same modal");
  await manual.getByRole("button", { name: "Enter manually", exact: true }).click();
  assert.equal(await manual.getByRole("textbox", { name: "Title", exact: true }).inputValue(), "Keep my draft");
  await page.waitForFunction(() => document.activeElement?.textContent.trim() === "Import receipt");
  await page.keyboard.press("Escape");
  await manual.waitFor({ state: "detached" });
  assert.equal(await page.getByRole("button", { name: "Add transaction", exact: true }).evaluate(el => el === document.activeElement), true);
  const image = { name: "receipt.png", mimeType: "image/png", buffer: await readFile("tests/fixtures/receipt.png") };
  await openTransaction(page);
  await page.getByRole("dialog").getByRole("button", { name: "Import receipt", exact: true }).click();
  await check(page, "receipt-upload", width, height);
  const dialog = page.getByRole("dialog");
  if (width === 320) {
    assert.equal((await page.request.post(`${origin}/api/receipts/extract`, { headers: { Origin: "https://example.invalid" } })).status(), 403);
    expectedLedgerFailure = true;
    await page.route("**/api/receipts/extract", (route) => route.fulfill({ status: 503, json: { error: "Receipt import needs ZAI_API_KEY on the server. Add it and restart the app." } }));
    await dialog.getByLabel("Receipt image").setInputFiles(image);
    await dialog.getByRole("button", { name: "Read receipt", exact: true }).click();
    await dialog.getByRole("alert").filter({ hasText: "ZAI_API_KEY" }).waitFor();
    await check(page, "receipt-missing-key", width, height);
    await page.unroute("**/api/receipts/extract");
    expectedLedgerFailure = false;
  }
  const fixture = {
    importId: randomUUID(), fingerprint: String(width).padStart(64, "a"), method: "ai",
    draft: { documentKind: "receipt", merchant: `Receipt check ${width}`, date: date.slice(0,10), time: "18:33", currency: "IDR", receiptNumber: "Receipt 123",
      paymentSource: "Bank BCA", suggestedWallet: { walletId: "bank", reason: "Payment method lists Bank BCA." },
      suggestedCategory: { name: "food & drink", reason: "This is a restaurant receipt." }, total: "191000", items: [45455,45455,18182,47273,9092,8183].map((value, index) => ({ name: index === 0 ? "Nasi + Ayam Goreng Mentega ".repeat(5) : `Item ${index}`, quantity: index === 2 ? 2 : 1, unitPrice: null, lineTotal: String(value) })),
      adjustments: [{ label: "Tax 10%", amount: "17364" }, { label: "Rounding", amount: "-4" }], warnings: ["Verify the quantities and line totals before saving."] },
  };
  await page.route("**/api/receipts/extract", async (route) => {
    assert.ok(route.request().postDataBuffer().length < 4_100_000, "Prepared uploads fit the server limit");
    assert.match(route.request().postData() ?? "", /name="method"\r\n\r\nai/);
    await route.fulfill({ json: fixture });
  });
  await choose(page, "Read with", "AI — image recognition");
  await dialog.getByLabel("Receipt image").setInputFiles(image);
  const before = await (await page.request.get(`${origin}/api/ledger`)).json();
  await dialog.getByRole("button", { name: "Read receipt", exact: true }).click();
  await page.getByRole("heading", { name: "Review receipt", exact: true }).waitFor();
  await dialog.locator(".editor-body:visible").evaluate((body) => body.scrollTop = 0);
  await check(page, "receipt-review-top", width, height);
  assert.equal(await dialog.getByRole("combobox", { name: "Save details", exact: true }).innerText(), "Total only", "Imported receipts default to the printed total");
  assert.equal(await dialog.getByLabel("Line total", { exact: true }).count(), 0, "Item correction is optional");
  assert.equal(await dialog.getByText(fixture.draft.warnings[0], { exact: true }).count(), 0, "Scan warnings do not clutter the review");
  assert.equal(await dialog.getByText(fixture.draft.suggestedCategory.reason, { exact: true }).count(), 0, "Category explanations do not clutter the review");
  assert.equal((await (await page.request.get(`${origin}/api/ledger`)).json()).version, before.version, "Extraction never writes the ledger");
  assert.equal(await dialog.getByRole("combobox", { name: "Category", exact: true }).innerText(), "Food & drink");
  assert.equal(await dialog.getByRole("combobox", { name: "Wallet", exact: true }).innerText(), "BCA Main Account");
  await choose(page, "Wallet", "GoPay");
  assert.equal(await dialog.getByRole("combobox", { name: "Wallet", exact: true }).innerText(), "GoPay", "User can override the suggestion");
  await dialog.getByRole("textbox", { name: /Note/ }).fill("Meal was a gift for a friend");
  await check(page, "receipt-review-total", width, height);
  await choose(page, "Wallet", "BCA Main Account");
  await choose(page, "Category", "Food & drink");
  await choose(page, "Save details", "Total and individual items");
  await check(page, "receipt-review-items", width, height);
  await dialog.getByLabel("Name", { exact: true }).first().evaluate((input) => input.scrollIntoView({ block: "center" }));
  await check(page, "receipt-item-row", width, height);
  await dialog.getByRole("textbox", { name: "Amount", exact: true }).fill("191004");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await dialog.getByRole("alert").filter({ hasText: "equal the final total" }).waitFor();
  assert.equal((await (await page.request.get(`${origin}/api/ledger`)).json()).version, before.version);
  await dialog.getByRole("textbox", { name: "Amount", exact: true }).fill("191000");
  if (width === 320) {
    await sql`update public.ledger set version = version + 1 where user_id = ${id}`;
    expectedLedgerFailure = true;
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await dialog.getByRole("button", { name: "Reload latest ledger", exact: true }).waitFor();
    await dialog.getByRole("button", { name: "Reload latest ledger", exact: true }).click();
    await dialog.getByText("Latest ledger loaded.", { exact: false }).waitFor();
    assert.equal(await dialog.getByLabel("Line total", { exact: true }).nth(2).inputValue(), "18.182,00");
    await check(page, "receipt-conflict-kept", width, height);
    expectedLedgerFailure = false;
  }
  const saved = page.waitForResponse((response) => response.url().endsWith("/api/ledger") && response.request().method() === "POST");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  const response = await saved; assert.ok(response.ok(), await response.text());
  const state = await response.json();
  await dialog.waitFor({ state: "detached" });
  const entry = state.data.entries.at(-1);
  assert.equal(entry.description, "Meal was a gift for a friend");
  assert.equal(entry.amount, 19100000); assert.equal(entry.receipt.items.length, 6);
  assert.equal(balance(state.data, "bank", "IDR"), balance(before.data, "bank", "IDR") - 19100000);
  const retry = await page.request.post(`${origin}/api/ledger`, { headers: { Origin: origin }, data: { action: "receipt", receipt: entry.receipt, version: before.version } });
  assert.ok(retry.ok()); assert.equal((await retry.json()).version, state.version);
  await page.reload();
  await page.getByRole("button", { name: `Edit Receipt check ${width}`, exact: true }).click();
  assert.equal(await dialog.getByLabel("Line total", { exact: true }).nth(2).inputValue(), "18.182,00");
  assert.equal(await dialog.getByRole("textbox", { name: /Note/ }).inputValue(), "Meal was a gift for a friend");
  await check(page, "receipt-saved-items", width, height);
  const deleted = page.waitForResponse((response) => response.url().endsWith("/api/ledger") && response.request().method() === "POST");
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete transaction", exact: true }).click();
  assert.ok((await deleted).ok()); await dialog.waitFor({ state: "detached" });
  fixture.draft.documentKind = "payment";
  fixture.draft.date = null; fixture.draft.time = null;
  fixture.draft.total = "202177.34";
  fixture.draft.paymentSource = null; fixture.draft.suggestedWallet = null;
  fixture.draft.currency = "IDR";
  fixture.draft.warnings = ["Pending OpenAI bank debit; verify before saving."];
  fixture.draft.items = []; fixture.draft.adjustments = [];
  fixture.importId = randomUUID(); fixture.fingerprint = String(width).padStart(64, "b");
  fixture.draft.merchant = `Payment check ${width}`;
  fixture.draft.suggestedCategory = { name: `Gifts ${width}`, reason: "Possible gift expense. Confirm against your own payment context." };
  await openTransaction(page);
  await page.getByRole("dialog").getByRole("button", { name: "Import receipt", exact: true }).click();
  await choose(page, "Read with", "AI — image recognition");
  await dialog.getByLabel("Receipt image").setInputFiles(image);
  await dialog.getByRole("button", { name: "Read receipt", exact: true }).click();
  await page.getByRole("heading", { name: "Review receipt", exact: true }).waitFor();
  await dialog.locator(".editor-body:visible").evaluate((body) => body.scrollTop = 0);
  assert.equal(await dialog.getByLabel("Date", { exact: true }).innerText(), "Choose date");
  await dialog.getByLabel("Date", { exact: true }).evaluate((field) => field.scrollIntoView({ block: "center" }));
  await check(page, "receipt-missing-date", width, height);
  await dialog.getByLabel("Date", { exact: true }).click();
  await page.locator('.calendar-popover button[data-day]').filter({ hasText: /^4$/ }).first().click();
  await dialog.getByLabel("Time", { exact: true }).fill("18:33");
  await choose(page, "Wallet", "BCA Main Account");
  await dialog.getByRole("button", { name: `Add category: Gifts ${width}`, exact: true }).click();
  await dialog.getByLabel("New category name", { exact: true }).fill(`Gifts ${width}`);
  await dialog.getByRole("textbox", { name: /Note/ }).fill("Birthday gift for a friend");
  const unconfirmed = await (await page.request.get(`${origin}/api/ledger`)).json();
  assert.equal(unconfirmed.data.categories.some((category) => category.name === `Gifts ${width}`), false, "A suggested category is never created automatically");
  await check(page, "receipt-new-category-note", width, height);
  expectedPaymentValidationFailure = true;
  const rejectedPayment = page.waitForResponse(response => response.url().endsWith("/api/ledger") && response.request().method() === "POST");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  assert.equal((await rejectedPayment).status(), 400, "Unconfirmed payments must be rejected");
  await dialog.getByRole("alert").filter({ hasText: "Confirm this payment" }).waitFor();
  expectedPaymentValidationFailure = false;
  await choose(page, "This payment represents", "My own wallets — use Add transaction → Transfer");
  await check(page, "receipt-payment-transfer", width, height);
  await choose(page, "This payment represents", "Spending — save as an expense");
  await check(page, "receipt-payment-confirmed", width, height);
  const paymentSaved = page.waitForResponse((response) => response.url().endsWith("/api/ledger") && response.request().method() === "POST");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  const paymentResponse = await paymentSaved; assert.ok(paymentResponse.ok());
  const paymentState = await paymentResponse.json();
  assert.deepEqual(paymentState.data.entries.at(-1).receipt.items, []);
  assert.equal(paymentState.data.entries.at(-1).amount, 20217734);
  assert.equal(paymentState.data.entries.at(-1).currency, "IDR");
  assert.equal(paymentState.data.entries.at(-1).wallet, "bank");
  assert.equal(paymentState.data.entries.at(-1).category, `Gifts ${width}`);
  assert.equal(paymentState.data.entries.at(-1).description, "Birthday gift for a friend");
  assert.equal(paymentState.data.categories.filter((category) => category.name === `Gifts ${width}`).length, 1);
  await dialog.waitFor({ state: "detached" });
  await page.getByRole("button", { name: `Edit Payment check ${width}`, exact: true }).click();
  assert.equal(await dialog.getByRole("textbox", { name: /Note/ }).inputValue(), "Birthday gift for a friend");
  const paymentDeleted = page.waitForResponse((response) => response.url().endsWith("/api/ledger") && response.request().method() === "POST");
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete transaction", exact: true }).click();
  assert.ok((await paymentDeleted).ok()); await dialog.waitFor({ state: "detached" });
  const cleanupState = await (await page.request.get(`${origin}/api/ledger`)).json();
  const createdCategory = cleanupState.data.categories.find((category) => category.name === `Gifts ${width}`);
  assert.ok((await page.request.post(`${origin}/api/ledger`, { headers: { Origin: origin }, data: { action: "deleteCategory", id: createdCategory.id, version: cleanupState.version } })).ok());
  await page.reload();
  await page.getByRole("button", { name: "Edit Lunch and groceries", exact: true }).click();
  await dialog.getByRole("textbox", { name: /Note/ }).fill(`Remember this purchase ${width}`);
  await check(page, "transaction-note-editor", width, height);
  const noted = await saveEditor(page);
  assert.equal(noted.entries.find((entry) => entry.id === "lunch").description, `Remember this purchase ${width}`);
  if (width === 320 && process.env.RECEIPT_TEST_IMAGES) {
    for (const path of JSON.parse(process.env.RECEIPT_TEST_IMAGES)) {
      await openTransaction(page);
      await page.getByRole("dialog").getByRole("button", { name: "Import receipt", exact: true }).click();
      await choose(page, "Read with", "AI — image recognition");
      await dialog.getByLabel("Receipt image").setInputFiles(path);
      await dialog.getByRole("button", { name: "Read receipt", exact: true }).click();
      await page.getByRole("heading", { name: "Review receipt", exact: true }).waitFor();
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      await dialog.waitFor({ state: "detached" });
    }
  }
  await page.unroute("**/api/receipts/extract");
}

async function checkExports(page, width, height) {
  const initial = await (await page.request.get(`${origin}/api/ledger`)).json();
  const beforeBalance = initial.data.wallets.reduce((total, wallet) => total + balance(initial.data, wallet.id, "IDR"), 0);
  const jsonButton = page.getByRole("button", { name: "Download JSON backup", exact: true });
  const csvButton = page.getByRole("button", { name: "Download CSV", exact: true });
  const downloadContent = async (button, extension) => {
    const downloading = page.waitForEvent("download");
    await button.click();
    const download = await downloading;
    assert.ok(download.suggestedFilename().endsWith(`.${extension}`));
    const content = await readFile(await download.path(), "utf8");
    await page.getByRole("status").filter({ hasText: `${extension.toUpperCase()} download started.` }).waitFor();
    return content;
  };
  const exported = JSON.parse(await downloadContent(jsonButton, "json"));
  assert.deepEqual(exported.data, initial.data, "JSON backup must contain the authenticated user's complete ledger");
  assert.equal(exported.ledgerVersion, initial.version);
  await check(page, "json-export", width, height);
  const latest = structuredClone(initial);
  latest.version += 1;
  latest.data.entries[1].title = '=SUM(1,2)';
  latest.data.entries[1].description = 'Fresh saved change, with "quotes"\nSecond line';
  let reads = 0;
  await page.route("**/api/ledger", (route) => {
    reads += 1;
    return route.fulfill({ json: latest });
  });
  const freshJson = JSON.parse(await downloadContent(jsonButton, "json"));
  assert.deepEqual(freshJson.data, latest.data, "Export must refetch data instead of downloading the stale screen snapshot");
  assert.equal(freshJson.ledgerVersion, latest.version);
  const csv = await downloadContent(csvButton, "csv");
  assert.ok(csv.startsWith('\uFEFF"id","kind","date_utc"'));
  assert.ok(csv.includes(`"'=SUM(1,2)"`));
  assert.ok(csv.includes('"Fresh saved change, with ""quotes""\nSecond line"'));
  assert.ok(csv.includes('"previous"'), "Export includes transactions outside the selected month");
  assert.ok(csv.includes('"transfer"'), "Export includes transfers");
  assert.ok(csv.includes('"opening"'), "Export includes balance movements");
  assert.equal(reads, 2, "Each export fetches the latest authenticated ledger once");
  await page.unroute("**/api/ledger");
  await check(page, "csv-export", width, height);
  if (width === 320) {
    const downloadEvents = [];
    const onDownload = (download) => downloadEvents.push(download);
    page.on("download", onDownload);
    expectedExportFailure = true;
    await page.route("**/api/ledger", (route) => route.abort("failed"));
    await jsonButton.click();
    await page.getByRole("alert").filter({ hasText: "Could not export your ledger" }).waitFor();
    assert.equal(downloadEvents.length, 0, "A failed fetch must not produce a partial backup");
    assert.equal(await jsonButton.isEnabled(), true);
    assert.equal(await csvButton.isEnabled(), true);
    await check(page, "export-error", width, height);
    await page.unroute("**/api/ledger");
    await downloadContent(jsonButton, "json");
    page.off("download", onDownload);
    expectedExportFailure = false;
    assert.equal(await page.getByRole("alert").filter({ hasText: "Could not export your ledger" }).count(), 0);
  }
  const after = await (await page.request.get(`${origin}/api/ledger`)).json();
  assert.deepEqual(after, initial, "Downloading must not mutate or increment the ledger version");
  assert.equal(after.data.wallets.reduce((total, wallet) => total + balance(after.data, wallet.id, "IDR"), 0), beforeBalance);
}

async function checkDateRange(page, width, height) {
  const mobile = width < 768;
  const applyDates = async () => {
    await page.getByRole("button", { name: mobile ? "Apply period" : "Apply dates", exact: true }).click();
    if (mobile) await page.getByRole("dialog").waitFor({ state: "detached" });
  };
  const currentBalance = await page.locator(".balance-stat h2").innerText();
  assert.match(await page.locator(".balance-stat").innerText(), /Current balance.*All time/s);
  if (mobile) await page.getByRole("button", { name: /^Change period:/ }).click();
  await choose(page, "Period type", "Custom dates");
  await page.getByLabel("Start date", { exact: true }).and(page.locator("input:visible")).fill(singleDate.toISOString().slice(0, 10));
  await page.getByLabel("End date", { exact: true }).and(page.locator("input:visible")).fill(date.slice(0, 10));
  await applyDates();
  const groups = page.locator(".expense-category-list .report-row");
  assert.equal(await groups.count(), 3, "Custom range includes both months");
  assert.match(await groups.filter({ hasText: "Bills" }).innerText(), /100/);
  const expected = data.entries.filter((e) => e.kind === "expense" && e.currency === "IDR").reduce((n, e) => n + e.amount, 0);
  const totalText = new Intl.NumberFormat("en", { style: "currency", currency: "IDR", maximumFractionDigits: 2 }).format(expected / 100);
  assert.equal(await page.locator(".stats .stat").nth(1).locator("h2").innerText(), totalText);
  await page.getByRole("img", { name: "Daily spending chart", exact: true }).waitFor();
  const daily = page.getByRole("img", { name: "Daily spending chart", exact: true });
  assert.notEqual(await daily.getAttribute("tabindex"), "0");
  assert.equal(await page.locator(".spending-history").first().locator(".report-row").count(), 2);
  await check(page, "report-custom-range", width, height);
  await switchView(page, "Transactions");
  assert.equal(await page.getByRole("button", { name: "Edit Previous month bill", exact: true }).count(), 1);
  if (mobile) await page.getByRole("button", { name: /^Change period:/ }).click();
  assert.equal(await page.getByLabel("Start date", { exact: true }).and(page.locator("input:visible")).inputValue(), singleDate.toISOString().slice(0, 10));
  assert.equal(await page.locator(".balance-stat h2").innerText(), currentBalance, "Changing the period must not change current balances");
  await check(page, "transactions-custom-range", width, height);
  const singleDay = singleDate.toISOString().slice(0, 10);
  await page.getByLabel("Start date", { exact: true }).and(page.locator("input:visible")).fill(singleDay);
  await page.getByLabel("End date", { exact: true }).and(page.locator("input:visible")).fill(singleDay);
  await applyDates();
  assert.match(await page.locator(".stats .stat").nth(1).locator("h2").innerText(), /^IDR\s+100$/);
  assert.equal(await page.getByRole("button", { name: /^Edit / }).count(), 1, "Same-day range includes only that day's entries");
  assert.equal(await page.locator(".balance-stat h2").innerText(), currentBalance);
  await check(page, "transactions-single-day", width, height);
  if (mobile) await page.getByRole("button", { name: /^Change period:/ }).click();
  await page.getByLabel("Start date", { exact: true }).and(page.locator("input:visible")).fill("2026-03-02");
  await page.getByLabel("End date", { exact: true }).and(page.locator("input:visible")).fill("2026-03-01");
  if (mobile) {
    assert.equal(await page.getByRole("button", { name: "Apply period", exact: true }).isDisabled(), true);
    await page.getByRole("status").filter({ hasText: "Enter valid dates" }).waitFor();
  } else {
    await applyDates();
    await page.getByRole("alert").filter({ hasText: "Enter valid dates" }).waitFor();
  }
  assert.equal(await page.locator('[aria-label="Edit Previous month bill"]').count(), 1, "Invalid ranges preserve the applied period");
  await check(page, "invalid-date-range", width, height);
  await choose(page, "Period type", "Month");
  await chooseMonth(page, date.slice(0, 7));
  if (mobile) await applyDates();
  await switchView(page, "Report");
}

async function checkExpenseReport(page, width, height) {
  const chart = page.getByRole("img", { name: "Expense category pie chart" });
  await chart.waitFor();
  await page.getByRole("img", { name: "Daily spending chart", exact: true }).waitFor();
  await page.getByRole("img", { name: "Monthly spending chart", exact: true }).waitFor();
  const dailyRows = page.locator(".spending-history").first().locator(".report-row");
  const monthlyRows = page.locator(".spending-history").nth(1).locator(".report-row");
  assert.equal(await dailyRows.count(), 1);
  assert.equal(await monthlyRows.count(), 2);
  const currentExpense = data.entries.filter((e) => e.kind === "expense" && e.id !== "previous").reduce((n, e) => n + e.amount, 0);
  const amountText = new Intl.NumberFormat("en", { style: "currency", currency: "IDR", maximumFractionDigits: 2 }).format(currentExpense / 100);
  assert.match(await dailyRows.first().innerText(), new RegExp(date.slice(0, 10)));
  assert.ok((await dailyRows.first().innerText()).includes(amountText));
  assert.ok((await monthlyRows.last().innerText()).includes(amountText));
  assert.match(await monthlyRows.first().innerText(), /100/);
  assert.match(await page.getByRole("definition").first().ariaSnapshot(), /IDR/);
  assert.equal(await page.locator(".recharts-pie-sector").count(), 2);
  const rows = page.locator(".expense-category-list .report-row");
  assert.equal(
    await rows.count(),
    2,
    "Only expenses in this period/currency belong in the pie",
  );
  const food = rows.filter({ hasText: "Food & drink" });
  assert.match(await food.innerText(), /IDR\s+87,500/);
  assert.match(
    await food.innerText(),
    /<0\.1% of expenses/,
    "Small nonzero spending must not display as 0%",
  );
  const accessibleText = await page
    .locator(".expense-category-list")
    .ariaSnapshot();
  assert.match(accessibleText, /Food & drink/);
  assert.match(accessibleText, /87,500/);
  assert.match(accessibleText, /<0\.1% of expenses/);
  assert.notEqual(
    await chart.getAttribute("tabindex"),
    "0",
    "A static chart must not create an unnecessary keyboard stop",
  );
  const currency = page.getByRole("combobox", {
    name: "Currency",
    exact: true,
  });
  await currency.focus();
  await page.keyboard.press("Space");
  await page.getByRole("option", { name: "IDR", exact: true }).waitFor();
  await check(page, "select-keyboard", width, height);
  await page.keyboard.press("Home");
  await page
    .getByRole("option", { name: "IDR", exact: true })
    .and(page.locator("[data-highlighted]"))
    .waitFor();
  await page.keyboard.press("ArrowDown");
  await page
    .getByRole("option", { name: "USD", exact: true })
    .and(page.locator("[data-highlighted]"))
    .waitFor();
  await page.keyboard.press("Enter");
  await page
    .getByRole("heading", { name: "No spending to report yet" })
    .waitFor();
  assert.equal(
    await page.locator(".expense-pie-chart").count(),
    0,
    "A transfer into USD must not count as spending",
  );
  assert.equal(await page.getByRole("img", { name: "Daily spending chart", exact: true }).count(), 0);
  assert.equal(await page.getByRole("img", { name: "Monthly spending chart", exact: true }).count(), 0);
  await choose(page, "Currency", "IDR");
  const originalMonth = date.slice(0, 7);
  const currentBalance = await page.locator(".balance-stat h2").innerText();
  await chooseMonth(page, singleDate.toISOString().slice(0, 7));
  await chart.waitFor();
  assert.equal(await page.locator(".recharts-pie-sector").count(), 1);
  assert.match(
    await page.locator(".expense-category-list").innerText(),
    /Bills.*100%/s,
  );
  await check(page, "report-single-category", width, height);
  await chooseMonth(page, "1999-12");
  await page
    .getByRole("heading", { name: "No spending to report yet" })
    .waitFor();
  assert.equal(await page.getByRole("img", { name: "Daily spending chart", exact: true }).count(), 0);
  assert.equal(await page.getByRole("img", { name: "Monthly spending chart", exact: true }).count(), 1, "All-history chart remains independent of the selected period");
  assert.match(await page.locator(".stats .stat").first().locator("h2").innerText(), /^IDR\s+0$/);
  assert.match(await page.locator(".stats .stat").nth(1).locator("h2").innerText(), /^IDR\s+0$/);
  assert.equal(await page.locator(".balance-stat h2").innerText(), currentBalance, "An empty historical period still shows current balances");
  await check(page, "report-empty", width, height);
  await chooseMonth(page, originalMonth);
}

let browser;
try {
  if (screenshots) await mkdir(screenshots, { recursive: true });
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  });
  await sql.begin(async (tx) => {
    await tx`insert into public."user" (id, name, email) values (${id}, 'Responsive check', ${id + "@example.invalid"})`;
    await tx`insert into public.session (id, user_id, token, expires_at, updated_at) values (${randomUUID()}, ${id}, ${token}, ${new Date(Date.now() + 3600000)}, ${new Date()})`;
    await tx`insert into public.ledger (user_id, data) values (${id}, ${tx.json(data)})`;
  });
  const signature = createHmac("sha256", process.env.BETTER_AUTH_SECRET)
    .update(token)
    .digest("base64");
  for (const [width, height] of sizes) {
    const context = await browser.newContext({
      viewport: { width, height },
      timezoneId: "Asia/Jakarta",
      isMobile: width < 640,
      hasTouch: width < 1024,
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" && !(expectedLedgerFailure && /(?:409|503)/.test(message.text())) && !(expectedPaymentValidationFailure && message.text().includes("400 (Bad Request)")) && !(expectedExportFailure && message.text().includes("net::ERR_FAILED"))) errors.push(message.text());
    });
    await page.goto(`${origin}/sign-in`);
    await page.getByRole("button", { name: /Google/ }).waitFor();
    await check(page, "sign-in", width, height);
    if (width === 320) {
      assert.equal((await page.request.get(`${origin}/api/ledger`)).status(), 401);
      assert.equal((await page.request.post(`${origin}/api/receipts/extract`, { headers: { Origin: origin } })).status(), 401);
      assert.equal(
        (
          await page.request.get(
            `${origin}/api/exchange-rates?from=USD&to=IDR&date=2026-10-01`,
          )
        ).status(),
        401,
      );
    }
    await context.addCookies([
      {
        name: "better-auth.session_token",
        value: encodeURIComponent(`${token}.${signature}`),
        url: origin,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    await page.goto(origin);
    if (width === 320)
      assert.equal(
        (
          await page.request.get(
            `${origin}/api/exchange-rates?from=INVALID&to=IDR&date=2026-10-01`,
          )
        ).status(),
        400,
      );
    await page
      .getByRole("button", { name: "Add transaction", exact: true })
      .waitFor();
    if (balancesOnly) {
      await checkBalances(page, width, height);
      await switchView(page, "Report");
      assert.equal(await page.locator(".balance-breakdown").isVisible(), false);
      await check(page, "report-balance-collapsed", width, height);
      await page.getByRole("button", { name: "Show wallet balances", exact: true }).click();
      assert.equal(await page.locator(".balance-breakdown").isVisible(), true);
      await check(page, "report-balance-expanded", width, height);
      await context.close();
      continue;
    }
    if (filtersOnly) { await checkTransactionFilters(page, width, height); await context.close(); continue; }
    await checkReceipts(page, width, height);
    if (categoriesOnly) { await checkInlineCategories(page, width, height); await context.close(); continue; }
    if (receiptsOnly) { await context.close(); continue; }
    await checkConflicts(page, width, height);
    await switchView(page, "Transactions");
    await checkNavigation(page, width, height);
    if (width === 320) await checkRoutes(page, context, browser);
    if (width === 320 || width === 1440) await checkPagination(page, width, height);
    await checkBalances(page, width, height);
    for (const tab of ["Transactions", "Wallet", "Report", "Settings"]) {
      await switchView(page, tab);
      await check(page, tab.toLowerCase(), width, height);
      await checkNavigationClearance(page, tab.toLowerCase(), width, height);
      if (tab === "Report") {
        await checkExpenseReport(page, width, height);
        await checkDateRange(page, width, height);
      }
      if (tab === "Settings" && !reportsOnly) {
        await checkCategories(page, width, height);
        await checkExports(page, width, height);
      }
    }
    if (reportsOnly) {
      await context.close();
      continue;
    }
    await switchView(page, "Transactions");
    await page
      .getByRole("button", { name: "Edit Lunch and groceries", exact: true })
      .click();
    await page.getByRole("dialog").waitFor();
    await check(page, "edit-transaction", width, height);
    await choose(page, "Wallet", "BCA Main Account");
    await choose(page, "Category", "Food & drink");
    assert.equal(
      await page.getByRole("dialog").getAttribute("aria-modal"),
      "true",
    );
    await page.getByLabel("Date", { exact: true }).click();
    await page.locator(".calendar-popover").waitFor();
    await check(page, "date-calendar", width, height);
    const day = page.locator(
      '.calendar-popover button[data-selected-single="true"]',
    );
    const selectedDay = await day.getAttribute("data-day");
    await day.focus();
    await page.keyboard.press("ArrowRight");
    assert.notEqual(
      await page.evaluate(() =>
        document.activeElement.getAttribute("data-day"),
      ),
      selectedDay,
      "Calendar arrow keys must move focus",
    );
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Enter");
    await page.locator(".calendar-popover").waitFor({ state: "detached" });
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByRole("alertdialog").waitFor();
    await check(page, "transaction-confirmation", width, height);
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await page.getByRole("alertdialog").waitFor({ state: "detached" });
    await page
      .getByRole("textbox", { name: /Note/ })
      .fill("Reviewed on mobile");
    const saved = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/ledger") &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Save", exact: true }).click();
    const response = await saved;
    assert.ok(response.ok(), `Save failed: ${await response.text()}`);
    await page.getByRole("dialog").waitFor({ state: "detached" });
    assert.equal(await page.locator("[data-slot=dialog-overlay]").count(), 0);
    await openTransaction(page, "transfer");
    await choose(page, "Destination currency", "USD");
    await check(page, "transfer-editor", width, height);
    if (width === 320 || width === 1440) {
      const dialog = page.getByRole("dialog");
      await dialog
        .getByRole("textbox", { name: "Amount sent", exact: true })
        .fill("10");
      await dialog
        .getByRole("textbox", {
          name: "Amount received before fee (USD)",
          exact: true,
        })
        .fill("0.01");
      assert.equal(
        await dialog.locator("form:visible").evaluate((form) => form.checkValidity()),
        false,
        "Destination wallet is required",
      );
      await choose(page, "To wallet", "BCA Main Account");
      assert.equal(
        await dialog.locator("form:visible").evaluate((form) => form.checkValidity()),
        true,
      );
      const transferSaved = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/ledger") &&
          response.request().method() === "POST",
      );
      await dialog.getByRole("button", { name: "Save", exact: true }).click();
      assert.ok(
        (await transferSaved).ok(),
        "Transfer must save with both Select values",
      );
      await dialog.waitFor({ state: "detached" });
      await openTransaction(page);
      await page.getByRole("dialog").waitFor();
    }
    await page
      .getByRole("button", { name: "Save", exact: true })
      .scrollIntoViewIfNeeded();
    const saveRect = await page
      .getByRole("button", { name: "Save", exact: true })
      .boundingBox();
    assert.ok(
      saveRect.y >= 0 && saveRect.y + saveRect.height <= height,
      "Save must be reachable on short screens",
    );
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "detached" });
    assert.equal(
      await page.evaluate(() => document.activeElement.textContent.trim()),
      "Add transaction",
    );
    await switchView(page, "Wallet");
    await page.getByRole("button", { name: "Add wallet", exact: true }).click();
    await page.getByRole("dialog").waitFor();
    await check(page, "wallet-editor", width, height);
    await page.mouse.click(2, 2);
    await page.getByRole("dialog").waitFor({ state: "detached" });
    if (width === 320 || width === 1440)
      await checkTransferFees(page, width, height);
    await context.close();
  }
  assert.deepEqual(errors, [], "JavaScript page errors");
  console.log(
    balancesOnly ? "Balance checks passed at eight sizes on Transactions and Report: collapsed defaults, keyboard toggles, conversions, retry, and responsive layouts." : filtersOnly ? "Transaction filter and animation checks passed at eight sizes." : categoriesOnly ? "Inline category and receipt checks passed at eight sizes; creation, cancel, income/expense, suggestions and reload persistence verified." : receiptsOnly ? "Receipt browser checks passed: eight sizes, OCR/AI choice, missing API key, editable review, item reconciliation, one wallet charge, conflict recovery, durable retries, reload persistence and deletion." : reportsOnly
      ? "Report browser checks passed: eight sizes, conflict recovery and draft preservation, cached balance conversions and retry, floating navigation and scroll clearance, tablet Sheet, desktop icon rail, all tabs, custom dates, daily/monthly charts, exact amounts, empty periods, currencies, and accessible controls."
      : "Responsive checks passed: eight sizes, conflict recovery and draft preservation, cached balance conversions and retry, floating navigation and scroll clearance, tablet Sheet, desktop icon rail, all tabs, date ranges, daily/monthly reports, JSON/CSV downloads and retry, source/destination fees, cached/manual rates, exact CAD→IDR amounts, reload persistence, and atomic transfer/fee deletion.",
  );
} finally {
  await browser?.close();
  await sql`delete from public."user" where id = ${id}`;
  const [remaining] =
    await sql`select count(*)::integer as count from public."user" where id = ${id}`;
  assert.equal(remaining.count, 0, "Temporary account must be removed");
  await sql.end({ timeout: 1 });
}

import "dotenv/config";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import postgres from "postgres";
import { balance } from "../src/features/ledger/ledger.ts";

const origin = process.env.LEDGER_TEST_URL ?? "http://localhost:3000";
const screenshots = process.env.RESPONSIVE_SCREENSHOTS;
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
const id = randomUUID();
const token = randomUUID();
const date = new Date().toISOString();
const singleDate = new Date(date);
singleDate.setUTCDate(1);
singleDate.setUTCHours(0, 0, 0, 0);
singleDate.setUTCMonth(singleDate.getUTCMonth() - 1);
const errors = [];
const sizes = [
  [320, 568],
  [390, 844],
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
          ".table-wrap, .editor, [data-slot=select-content], [data-slot=popover-content], [data-slot=alert-dialog-content]",
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
          '[data-slot="select-content"], [data-slot="popover-content"], [data-slot="alert-dialog-content"]',
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
          ".transaction-detail .transaction-name > span:last-child",
        ),
      ].filter(
        (el) =>
          el.textContent.length > 40 && el.getBoundingClientRect().width < 120,
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
      path: `${screenshots}/${width}x${height}-${name}.png`,
      fullPage: !(
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
  await page.getByRole("tab", { name: "Transactions", exact: true }).click();
  const before = (await (await page.request.get(`${origin}/api/ledger`)).json())
    .data;
  const cacheBefore =
    await sql`select rate_date, last_checked_at from public.exchange_rate_cache order by rate_date`;
  await page
    .getByRole("button", { name: "Add transaction", exact: true })
    .click();
  await page.getByRole("tab", { name: "transfer", exact: true }).click();
  await choose(page, "To wallet", "GoPay");
  await page
    .getByRole("spinbutton", { name: "Amount sent", exact: true })
    .fill("200000");
  await page
    .getByRole("spinbutton", { name: "Service fee (IDR)", exact: true })
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
      .getByRole("spinbutton", { name: "Service fee (IDR)", exact: true })
      .inputValue(),
    "1000.00",
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
  await page.getByRole("tab", { name: "Report", exact: true }).click();
  const admin = page
    .locator(".expense-category-list .report-row")
    .filter({ hasText: "Admin fees" });
  assert.match(await admin.textContent(), /1,000/);
  await check(page, "admin-fee-report", width, height);
  await page.getByRole("tab", { name: "Transactions", exact: true }).click();
  await removeFeeTransfer(page);
  let restored = (await (await page.request.get(`${origin}/api/ledger`)).json())
    .data;
  assert.deepEqual(
    restored.entries,
    before.entries,
    "Deleting a transfer must remove its fee atomically.",
  );

  await page
    .getByRole("button", { name: "Add transaction", exact: true })
    .click();
  await page.getByRole("tab", { name: "transfer", exact: true }).click();
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
    .getByRole("spinbutton", { name: "Amount sent", exact: true })
    .fill("100");
  const received = page.getByRole("spinbutton", {
    name: "Amount received before fee (IDR)",
    exact: true,
  });
  assert.equal(
    Number(await received.inputValue()),
    Number(await rate.inputValue()) * 100,
  );
  const referenceRate = await rate.inputValue();
  await page
    .getByRole("spinbutton", { name: "Service fee (IDR)", exact: true })
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
  assert.equal(await received.inputValue(), "1780000.00");
  await received.fill("1770000");
  assert.equal(await rate.inputValue(), "17700");
  await rate.fill("17800");
  await page
    .getByRole("spinbutton", { name: "Service fee (IDR)", exact: true })
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
  assert.equal(await received.inputValue(), "1780000.00");
  await check(page, "saved-transfer-rate", width, height);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await removeFeeTransfer(page);
  restored = (await (await page.request.get(`${origin}/api/ledger`)).json())
    .data;
  assert.deepEqual(restored.entries, before.entries);

  await page.route("**/api/exchange-rates?*", (route) =>
    route.fulfill({ json: { suggestion: null } }),
  );
  await page
    .getByRole("button", { name: "Add transaction", exact: true })
    .click();
  await page.getByRole("tab", { name: "transfer", exact: true }).click();
  await choose(page, "Source currency", "USD");
  await choose(page, "To wallet", "GoPay");
  await page
    .getByText(
      "No cached rate for this date. Enter your actual rate or received amount.",
      { exact: true },
    )
    .waitFor();
  await page
    .getByRole("spinbutton", { name: "Amount sent", exact: true })
    .fill("100");
  await received.fill("1780000");
  assert.equal(await rate.inputValue(), "17800");
  await choose(page, "Fee charged to", "Source · BCA Main Account (USD)");
  await page
    .getByRole("spinbutton", { name: "Service fee (USD)", exact: true })
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
  await page
    .getByRole("button", { name: "Add transaction", exact: true })
    .click();
  await page.getByRole("tab", { name: "transfer", exact: true }).click();
  await choose(page, "Source currency", "CAD");
  await choose(page, "To wallet", "GoPay");
  const sent = page.getByRole("spinbutton", {
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
  assert.equal(await received.inputValue(), "2000000");
  assert.equal(await cadRate.inputValue(), "12500");
  await sent.fill("159.33");
  await choose(page, "Fee charged to", "Source · BCA Main Account (CAD)");
  await page
    .getByRole("spinbutton", { name: "Service fee (CAD)", exact: true })
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
  assert.equal(await received.inputValue(), "2000000.00");
  assert.equal(await cadRate.inputValue(), "12552.563861168644");
  await sent.fill("160");
  assert.equal(
    await received.inputValue(),
    "2000000.00",
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

async function checkDateRange(page, width, height) {
  await choose(page, "Period type", "Custom dates");
  await page.getByLabel("Start date", { exact: true }).fill(singleDate.toISOString().slice(0, 10));
  await page.getByLabel("End date", { exact: true }).fill(date.slice(0, 10));
  await page.getByRole("button", { name: "Apply dates", exact: true }).click();
  const groups = page.locator(".expense-category-list .report-row");
  assert.equal(await groups.count(), 3, "Custom range includes both months");
  assert.match(await groups.filter({ hasText: "Bills" }).innerText(), /100/);
  const expected = data.entries.filter((e) => e.kind === "expense" && e.currency === "IDR").reduce((n, e) => n + e.amount, 0);
  const totalText = new Intl.NumberFormat("en", { style: "currency", currency: "IDR", maximumFractionDigits: 2 }).format(expected / 100);
  assert.equal(await page.locator(".stats .stat").nth(1).locator("h2").innerText(), totalText);
  await check(page, "report-custom-range", width, height);
  await page.getByRole("tab", { name: "Transactions", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Edit Previous month bill", exact: true }).count(), 1);
  assert.equal(await page.getByLabel("Start date", { exact: true }).inputValue(), singleDate.toISOString().slice(0, 10));
  await check(page, "transactions-custom-range", width, height);
  await page.getByLabel("Start date", { exact: true }).fill("2026-03-02");
  await page.getByLabel("End date", { exact: true }).fill("2026-03-01");
  await page.getByRole("button", { name: "Apply dates", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Enter valid dates" }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Edit Previous month bill", exact: true }).count(), 1, "Invalid ranges preserve the applied period");
  await check(page, "invalid-date-range", width, height);
  await choose(page, "Period type", "Month");
  await chooseMonth(page, date.slice(0, 7));
  await page.getByRole("tab", { name: "Report", exact: true }).click();
}

async function checkExpenseReport(page, width, height) {
  const chart = page.getByRole("img", { name: "Expense category pie chart" });
  await chart.waitFor();
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
  await choose(page, "Currency", "IDR");
  const originalMonth = date.slice(0, 7);
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
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto(`${origin}/sign-in`);
    await page.getByRole("button", { name: /Google/ }).waitFor();
    await check(page, "sign-in", width, height);
    if (width === 320)
      assert.equal(
        (
          await page.request.get(
            `${origin}/api/exchange-rates?from=USD&to=IDR&date=2026-10-01`,
          )
        ).status(),
        401,
      );
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
    for (const tab of ["Transactions", "Wallet", "Report", "Settings"]) {
      await page.getByRole("tab", { name: tab, exact: true }).click();
      await check(page, tab.toLowerCase(), width, height);
      if (tab === "Report") {
        await checkExpenseReport(page, width, height);
        await checkDateRange(page, width, height);
      }
      if (tab === "Settings") await checkCategories(page, width, height);
    }
    await page.getByRole("tab", { name: "Transactions", exact: true }).click();
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
      .getByRole("textbox", { name: /Description/ })
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
    await page
      .getByRole("button", { name: "Add transaction", exact: true })
      .click();
    await page.getByRole("dialog").waitFor();
    await page.getByRole("tab", { name: "transfer", exact: true }).click();
    await choose(page, "Destination currency", "USD");
    await check(page, "transfer-editor", width, height);
    if (width === 320 || width === 1440) {
      const dialog = page.getByRole("dialog");
      await dialog
        .getByRole("spinbutton", { name: "Amount sent", exact: true })
        .fill("10");
      await dialog
        .getByRole("spinbutton", {
          name: "Amount received before fee (USD)",
          exact: true,
        })
        .fill("0.01");
      assert.equal(
        await dialog.locator("form").evaluate((form) => form.checkValidity()),
        false,
        "Destination wallet is required",
      );
      await choose(page, "To wallet", "BCA Main Account");
      assert.equal(
        await dialog.locator("form").evaluate((form) => form.checkValidity()),
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
      await page
        .getByRole("button", { name: "Add transaction", exact: true })
        .click();
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
    await page.getByRole("tab", { name: "Wallet", exact: true }).click();
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
    "Responsive checks passed: seven sizes, all tabs, accessible controls and reports, source/destination fees, cached/manual rates, exact CAD→IDR amounts, reload persistence, and atomic transfer/fee deletion.",
  );
} finally {
  await browser?.close();
  await sql`delete from public."user" where id = ${id}`;
  const [remaining] =
    await sql`select count(*)::integer as count from public."user" where id = ${id}`;
  assert.equal(remaining.count, 0, "Temporary account must be removed");
  await sql.end({ timeout: 1 });
}

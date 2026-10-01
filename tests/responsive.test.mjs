import "dotenv/config";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { chromium } from "playwright";
import postgres from "postgres";
import { balance } from "../src/features/ledger/ledger.ts";

const origin = process.env.LEDGER_TEST_URL ?? "http://localhost:3000";
const screenshots = process.env.RESPONSIVE_SCREENSHOTS;
const reportsOnly = process.env.RESPONSIVE_SCOPE === "reports";
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
const id = randomUUID();
const token = randomUUID();
const date = new Date().toISOString();
const singleDate = new Date(date);
singleDate.setUTCDate(1);
singleDate.setUTCHours(0, 0, 0, 0);
singleDate.setUTCMonth(singleDate.getUTCMonth() - 1);
const errors = [];
let expectedExportFailure = false;
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
  const navigation = page.getByRole("tab", { name, exact: true });
  if (!(await navigation.isVisible())) {
    await page.getByRole("button", { name: "Toggle navigation", exact: true }).click();
  }
  await navigation.click();
  if (page.viewportSize().width >= 768 && page.viewportSize().width < 1200) {
    await page.getByRole("dialog", { name: "Workspace navigation", exact: true }).waitFor({ state: "detached" });
    assert.equal(await page.getByRole("button", { name: "Toggle navigation", exact: true }).evaluate((el) => el === document.activeElement), true);
  }
  await page.getByRole("heading", { name, exact: true, level: 1 }).waitFor();
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
    assert.equal(await sheet.getByText("Personal account", { exact: true }).count(), 1);
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
    assert.equal(await page.getByRole("tab", { name: "Transactions", exact: true }).count(), 0, "Collapsed desktop navigation is inaccessible to focus");
    await check(page, "navigation-collapsed", width, height);
    assert.ok(await page.locator(".workspace").evaluate((el) => el.getBoundingClientRect().left < 1), "Collapsing the sidebar reclaims its width");
    await toggle.click();
    await check(page, "navigation-expanded", width, height);
    assert.equal(await page.getByRole("tab", { name: "Transactions", exact: true }).count(), 1);
  }
}

async function checkNavigationClearance(page, name, width, height) {
  if (width >= 768) return;
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await check(page, `${name}-bottom`, width, height);
  const layout = await page.evaluate(() => {
    const nav = document.querySelector(".mobile-navigation").getBoundingClientRect();
    const footer = document.querySelector(".workspace > footer").getBoundingClientRect();
    const content = document.querySelector(".page-content").getBoundingClientRect();
    return { navTop: nav.top, navBottom: nav.bottom, footerBottom: footer.bottom, contentBottom: content.bottom };
  });
  assert.ok(layout.navTop >= 0 && layout.navBottom <= height, "Floating navigation stays inside the viewport");
  assert.ok(layout.footerBottom < layout.navTop, `${name}: footer clears the floating navigation`);
  assert.ok(layout.contentBottom < layout.navTop, `${name}: final content clears the floating navigation`);
  assert.equal(await page.getByRole("dialog", { name: "Workspace navigation", exact: true }).count(), 0);
  await page.getByRole("tab", { name: name === "transactions" ? "Transactions" : name[0].toUpperCase() + name.slice(1), exact: true }).click();
  assert.equal(await page.evaluate(() => window.scrollY), 0, "Phone navigation returns to the top of the section");
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
  const currentBalance = await page.locator(".balance-stat h2").innerText();
  assert.match(await page.locator(".balance-stat").innerText(), /Current balance.*all recorded transactions/s);
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
  await page.getByRole("img", { name: "Daily spending chart", exact: true }).waitFor();
  const daily = page.getByRole("img", { name: "Daily spending chart", exact: true });
  assert.notEqual(await daily.getAttribute("tabindex"), "0");
  assert.equal(await page.locator(".spending-history").first().locator(".report-row").count(), 2);
  await check(page, "report-custom-range", width, height);
  await switchView(page, "Transactions");
  assert.equal(await page.getByRole("button", { name: "Edit Previous month bill", exact: true }).count(), 1);
  assert.equal(await page.getByLabel("Start date", { exact: true }).inputValue(), singleDate.toISOString().slice(0, 10));
  assert.equal(await page.locator(".balance-stat h2").innerText(), currentBalance, "Changing the period must not change current balances");
  await check(page, "transactions-custom-range", width, height);
  const singleDay = singleDate.toISOString().slice(0, 10);
  await page.getByLabel("Start date", { exact: true }).fill(singleDay);
  await page.getByLabel("End date", { exact: true }).fill(singleDay);
  await page.getByRole("button", { name: "Apply dates", exact: true }).click();
  assert.match(await page.locator(".stats .stat").nth(1).locator("h2").innerText(), /^IDR\s+100$/);
  assert.equal(await page.getByRole("button", { name: /^Edit / }).count(), 1, "Same-day range includes only that day's entries");
  assert.equal(await page.locator(".balance-stat h2").innerText(), currentBalance);
  await check(page, "transactions-single-day", width, height);
  await page.getByLabel("Start date", { exact: true }).fill("2026-03-02");
  await page.getByLabel("End date", { exact: true }).fill("2026-03-01");
  await page.getByRole("button", { name: "Apply dates", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Enter valid dates" }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Edit Previous month bill", exact: true }).count(), 1, "Invalid ranges preserve the applied period");
  await check(page, "invalid-date-range", width, height);
  await choose(page, "Period type", "Month");
  await chooseMonth(page, date.slice(0, 7));
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
      if (message.type() === "error" && !(expectedExportFailure && message.text().includes("net::ERR_FAILED"))) errors.push(message.text());
    });
    await page.goto(`${origin}/sign-in`);
    await page.getByRole("button", { name: /Google/ }).waitFor();
    await check(page, "sign-in", width, height);
    if (width === 320) {
      assert.equal((await page.request.get(`${origin}/api/ledger`)).status(), 401);
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
    await checkNavigation(page, width, height);
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
    reportsOnly
      ? "Report browser checks passed: eight sizes, floating navigation and scroll clearance, tablet Sheet, desktop sidebar, all tabs, custom dates, daily/monthly charts, exact amounts, empty periods, currencies, and accessible controls."
      : "Responsive checks passed: eight sizes, floating navigation and scroll clearance, tablet Sheet, desktop sidebar, all tabs, date ranges, daily/monthly reports, JSON/CSV downloads and retry, source/destination fees, cached/manual rates, exact CAD→IDR amounts, reload persistence, and atomic transfer/fee deletion.",
  );
} finally {
  await browser?.close();
  await sql`delete from public."user" where id = ${id}`;
  const [remaining] =
    await sql`select count(*)::integer as count from public."user" where id = ${id}`;
  assert.equal(remaining.count, 0, "Temporary account must be removed");
  await sql.end({ timeout: 1 });
}

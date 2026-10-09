import { createSessionTokenCodec } from "../src/lib/auth-privacy/create-session-token-codec.ts";
import "dotenv/config";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import postgres from "postgres";
import { chromium } from "playwright";
import { format } from "../src/features/ledger/format.ts";

const origin = process.env.LEDGER_TEST_URL ?? "http://localhost:3000";
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
const screenshots = process.env.I18N_SCREENSHOTS;
const account = randomUUID(), token = randomUUID();
const date = new Date().toISOString();
const data = {
  wallets: [{ id: "bank", name: "BCA " + "Long wallet name ".repeat(8), currencies: ["IDR", "USD"] }, { id: "cash", name: "Cash", currencies: ["IDR"] }],
  categories: [{ id: "Bills", name: "Bills", kind: "expense" }, { id: "custom", name: "Custom category ".repeat(10), kind: "expense" }, { id: "Salary", name: "Salary", kind: "income" }],
  entries: [
    { id: "opening", kind: "correction", date, wallet: "bank", currency: "IDR", amount: 100000000, title: "Opening balance", category: "", description: "" },
    ...Array.from({ length: 25 }, (_, i) => ({ id: `expense-${i}`, kind: "expense", date, wallet: "bank", currency: "IDR", amount: 123456, title: i ? "Example expense" : "Long transaction title ".repeat(10), category: "Bills", description: "Custom note ".repeat(15) })),
  ],
};
const errors = [];
let browser;
async function check(page, name, width, height) {
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, `${name} must fit ${width}×${height}`);
  await page.getByRole("dialog").evaluateAll((dialogs) => Promise.all(dialogs.flatMap((dialog) => dialog.getAnimations({ subtree: true }).filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity).map((animation) => animation.finished.catch(() => {})))));
  for (const dialog of await page.getByRole("dialog").all()) {
    const box = await dialog.boundingBox();
    if (box) assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1, `${name} dialog must fit the viewport: ${JSON.stringify(box)}`);
  }
  if (screenshots) await page.screenshot({ path: `${screenshots}/${name}-${width}x${height}.png`, fullPage: !(await page.getByRole("dialog").count()) && !(await page.getByRole("alertdialog").count()), caret: "initial" });
}
async function signIn(context) {
  const signature = createHmac("sha256", process.env.BETTER_AUTH_SECRET).update(token).digest("base64");
  await context.addCookies([{ name: "better-auth.session_token", value: encodeURIComponent(`${token}.${signature}`), url: origin, httpOnly: true, sameSite: "Lax" }]);
}
async function choose(page, label, option) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
try {
  if (screenshots) await mkdir(screenshots, { recursive: true });
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
  await sql`insert into public."user" (id, name, email) values (${account}, 'Language test', ${account + "@example.invalid"})`;
  await sql`insert into public.session (id, user_id, token, token_hash, expires_at, updated_at) values (${randomUUID()}, ${account}, ${await createSessionTokenCodec(process.env.BETTER_AUTH_SECRET).encrypt(token)}, ${createSessionTokenCodec(process.env.BETTER_AUTH_SECRET).hash(token)}, ${new Date(Date.now() + 3600000)}, ${new Date()})`;
  await sql`insert into public.ledger (user_id, data) values (${account}, ${sql.json(data)})`;
  const [permissions] = await sql`select c.relrowsecurity as rls,
    has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE') as anon_access,
    has_table_privilege('authenticated', c.oid, 'SELECT, INSERT, UPDATE, DELETE') as authenticated_access
    from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'user_preferences'`;
  assert.equal(permissions.rls, true);
  assert.equal(permissions.anon_access, false);
  assert.equal(permissions.authenticated_access, false);
  for (const [width, height] of [[320, 568], [390, 844], [568, 320], [768, 1024], [1440, 900]]) {
    for (const language of ["en", "id"]) {
      await sql`delete from public.user_preferences where user_id = ${account}`;
      const context = await browser.newContext({ viewport: { width, height }, locale: language === "id" ? "id-ID" : "en-US", timezoneId: "Asia/Jakarta" });
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => { if (message.type() === "error" && !/404 \(Not Found\)|400 \(Bad Request\)|401 \(Unauthorized\)|403 \(Forbidden\)|503 \(Service Unavailable\)|net::ERR_FAILED/.test(message.text())) errors.push(message.text()); });
      await page.goto(`${origin}/sign-in`);
      assert.equal(await page.locator("html").getAttribute("lang"), language);
      await page.getByRole("heading", { name: language === "id" ? "Masuk" : "Sign in", exact: true }).waitFor();
      await check(page, `${language}-sign-in`, width, height);
      assert.equal((await page.request.post(`${origin}/api/preferences`, { headers: { Origin: origin }, data: { locale: "id" } })).status(), 401);
      await signIn(context);
      const shownResponse = page.waitForResponse((response) => response.url().endsWith("/api/preferences") && response.request().postData() === "{}" && response.ok());
      await page.goto(origin);
      await page.getByRole("dialog").filter({ hasText: "Choose your language" }).waitFor();
      await check(page, `${language}-language-prompt`, width, height);
      // The shown marker persists without requiring a choice or dismissal.
      await shownResponse;
      const [shown] = await sql`select * from public.user_preferences where user_id = ${account}`;
      assert.ok(shown.language_prompt_shown_at);
      assert.equal(shown.locale, null);
      if (width === 320) {
        await page.route("**/api/preferences", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Could not save your language. Please try again." }) }));
        await page.getByRole("button", { name: language === "id" ? "Bahasa Indonesia" : "English", exact: true }).click();
        await page.getByRole("alert").filter({ hasText: language === "id" ? "Bahasa tidak dapat disimpan" : "Could not save your language" }).waitFor();
        await check(page, `${language}-language-save-error`, width, height);
        assert.equal((await sql`select locale from public.user_preferences where user_id = ${account}`)[0].locale, null);
        await page.unroute("**/api/preferences");
      }
      if (width === 568) await page.keyboard.press("Escape");
      else if (width === 390) await page.getByRole("button", { name: language === "id" ? "Lanjutkan" : "Continue", exact: true }).click();
      else await page.getByRole("button", { name: language === "id" ? "Bahasa Indonesia" : "English", exact: true }).click();
      await page.getByRole("dialog").waitFor({ state: "detached" });
      await page.reload();
      assert.equal(await page.locator("html").getAttribute("lang"), language);
      assert.equal(await page.getByRole("dialog").count(), 0, "Prompt must not repeat");
      const [saved] = await sql`select locale from public.user_preferences where user_id = ${account}`;
      assert.equal(saved.locale, language);
      assert.equal((await context.cookies()).find((cookie) => cookie.name === "locale").value, language);
      for (const route of ["transactions", "wallet", "report", "settings", "icon-preview", "missing-page"]) {
        await page.goto(`${origin}/${route}`);
        assert.equal(await page.locator("html").getAttribute("lang"), language);
        await check(page, `${language}-${route}`, width, height);
        if (route === "missing-page") await page.getByRole("heading", { name: language === "id" ? "Halaman tidak ditemukan" : "Page not found", exact: true }).waitFor();
        if (route === "transactions") {
          await page.getByRole("heading", { name: language === "id" ? "Transaksi" : "Transactions", exact: true }).waitFor();
          await page.locator(".transaction-metadata").filter({ hasText: language === "id" ? "Tagihan" : "Bills" }).first().waitFor();
          assert.ok((await page.locator(".amount").first().innerText()).includes(format(123456, "IDR", language)));
          if (width < 768) {
            await page.getByRole("button", { name: language === "id" ? "Filter" : "Filters", exact: true }).click();
            await page.getByRole("heading", { name: language === "id" ? "Filter riwayat transaksi" : "Filter transaction history", exact: true }).waitFor();
            await choose(page, language === "id" ? "Kategori" : "Category", language === "id" ? "Tagihan" : "Bills");
            await check(page, `${language}-mobile-transaction-filters`, width, height);
            await page.keyboard.press("Escape");
            await page.getByRole("dialog").waitFor({ state: "detached" });
          }
          await page.getByRole("button", { name: language === "id" ? "Ubah Example expense" : "Edit Example expense", exact: true }).first().click();
          await page.getByRole("dialog").waitFor();
          await choose(page, language === "id" ? "Simpan rincian" : "Save details", language === "id" ? "Total dan rincian barang" : "Total and individual items");
          await page.getByRole("button", { name: language === "id" ? "Tambah barang" : "Add item", exact: true }).click();
          await page.getByRole("button", { name: language === "id" ? "Tambah pajak" : "Add tax", exact: true }).click();
          await check(page, `${language}-expense-items`, width, height);
          await page.getByLabel(language === "id" ? "Tanggal" : "Date", { exact: true }).click();
          await page.locator(".calendar-popover").waitFor();
          if (language === "id") await page.getByRole("button", { name: "Ke bulan berikutnya" }).waitFor();
          await check(page, `${language}-calendar`, width, height);
          await page.keyboard.press("Escape");
          await page.getByRole("button", { name: language === "id" ? "Hapus" : "Delete", exact: true }).click();
          await page.getByRole("alertdialog").waitFor();
          await check(page, `${language}-delete-confirmation`, width, height);
          await page.getByRole("alertdialog").getByRole("button", { name: language === "id" ? "Batal" : "Cancel", exact: true }).click();
          await page.keyboard.press("Escape");
          await page.getByRole("dialog").waitFor({ state: "detached" });
          for (const kind of ["income", "transfer", "receipt"]) {
            await page.getByRole("button", { name: language === "id" ? "Tambah transaksi" : "Add transaction", exact: true }).click();
            const name = kind === "income" ? (language === "id" ? "Pemasukan" : "Income") : kind === "transfer" ? "Transfer" : (language === "id" ? "Impor struk" : "Import receipt");
            await page.getByRole("menuitem", { name, exact: true }).click();
            await page.getByRole("dialog").waitFor();
            if (kind === "transfer") await choose(page, language === "id" ? "Mata uang tujuan" : "Destination currency", "USD");
            await check(page, `${language}-${kind}-editor`, width, height);
            if (kind === "receipt" && width === 320) {
              await page.route("**/api/receipts/extract", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Receipt service is busy. Try again later." }) }));
              await page.getByLabel(language === "id" ? "Gambar struk" : "Receipt image", { exact: true }).setInputFiles("public/icons/icon-192.png");
              await page.getByRole("button", { name: language === "id" ? "Baca struk" : "Read receipt", exact: true }).click();
              await page.getByRole("alert").filter({ hasText: language === "id" ? "Layanan pembaca struk sedang sibuk" : "Receipt service is busy" }).waitFor();
              await check(page, `${language}-receipt-error`, width, height);
              await page.unroute("**/api/receipts/extract");
            }
            await page.keyboard.press("Escape");
            await page.getByRole("dialog").waitFor({ state: "detached" });
          }
        }
        if (route === "wallet") {
          await page.getByRole("button", { name: language === "id" ? "Tambah dompet" : "Add wallet", exact: true }).first().click();
          await page.getByRole("dialog").waitFor();
          await check(page, `${language}-wallet-editor`, width, height);
          await page.keyboard.press("Escape");
        }
        if (route === "report" && width < 768) {
          await page.getByRole("button", { name: language === "id" ? /^Ubah periode:/ : /^Change period:/ }).click();
          await page.getByRole("heading", { name: language === "id" ? "Periode dan mata uang ringkasan" : "Period and summary currency", exact: true }).waitFor();
          await check(page, `${language}-mobile-summary-filters`, width, height);
          await page.keyboard.press("Escape");
          await page.getByRole("dialog").waitFor({ state: "detached" });
        }
        if (route === "settings") {
          if (width === 320) {
            await page.route("**/api/ledger", (route) => route.abort());
            await page.getByRole("button", { name: language === "id" ? "Unduh cadangan JSON" : "Download JSON backup", exact: true }).click();
            await page.getByRole("alert").filter({ hasText: language === "id" ? "Buku keuangan tidak dapat diekspor" : "Could not export your ledger" }).waitFor();
            await check(page, `${language}-export-error`, width, height);
            await page.unroute("**/api/ledger");
          }
          const response = await page.request.post(`${origin}/api/preferences`, { headers: { Origin: origin }, data: { locale: "fr" } });
          assert.equal(response.status(), 400);
          assert.equal((await page.request.post(`${origin}/api/preferences`, { headers: { Origin: "https://example.invalid" }, data: { locale: "id" } })).status(), 403);
          await choose(page, language === "id" ? "Bahasa" : "Language", language === "id" ? "English" : "Bahasa Indonesia");
          await page.getByRole("heading", { name: language === "id" ? "Settings" : "Pengaturan", exact: true }).waitFor();
          await page.reload();
          assert.equal(await page.locator("html").getAttribute("lang"), language === "id" ? "en" : "id");
          // A different device with no locale cookie still uses the account preference.
          const other = await browser.newContext({ locale: language === "id" ? "id-ID" : "en-US" });
          await signIn(other);
          const otherPage = await other.newPage();
          await otherPage.goto(`${origin}/transactions`);
          assert.equal(await otherPage.locator("html").getAttribute("lang"), language === "id" ? "en" : "id");
          assert.equal(await otherPage.getByRole("dialog").count(), 0);
          await other.close();
          // Restore language before visiting the remaining route.
          await page.request.post(`${origin}/api/preferences`, { headers: { Origin: origin }, data: { locale: language } });
        }
      }
      const manifest = await (await page.request.get(`${origin}/manifest.webmanifest`)).json();
      assert.equal(manifest.lang, language);
      assert.ok(manifest.description.startsWith(language === "id" ? "Catat" : "Track"));
      await context.close();
    }
  }
  assert.deepEqual(errors, [], "No missing translations, hydration failures or other browser errors");
  console.log("i18n browser checks passed: both languages at five sizes; sign-in, first prompt, every route/editor/calendar, account persistence, Settings, API validation and manifest.");
} finally {
  await browser?.close();
  await sql`delete from public."user" where id = ${account}`;
  assert.equal((await sql`select count(*)::int as count from public.user_preferences where user_id = ${account}`)[0].count, 0);
  await sql.end({ timeout: 1 });
}

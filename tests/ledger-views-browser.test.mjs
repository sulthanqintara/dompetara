import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { queryResponse, signOutResponse } from './fixtures/ledger-views/responses.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = process.env.LEDGER_COVERAGE_DIR ?? await mkdtemp(join(tmpdir(), 'dompetara-views-'));
await mkdir(output, { recursive: true });
const bundlePath = join(output, 'views-fixture.js');
const bundleUrl = pathToFileURL(bundlePath).href;
await build({ entryPoints: [join(root, 'tests/fixtures/ledger-views.tsx')], outfile: bundlePath, bundle: true,
  sourcemap: 'linked', platform: 'browser', format: 'iife', jsx: 'automatic',
  alias: { '@': join(root, 'src'), 'next/navigation': join(root, 'tests/fixtures/ledger-views/navigation.ts'), 'next/link': join(root, 'tests/fixtures/ledger-views/link.tsx') },
  define: { 'process.env.NODE_ENV': '"test"' } });
const code = await readFile(bundlePath, 'utf8');
const css = `body{font:16px Arial;margin:8px}button,input{font:inherit;min-height:44px}svg{width:16px;height:16px}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
.mobile-history-filters{display:none}.form-field{display:flex;flex-direction:column;margin:8px}.invisible{visibility:hidden}.ledger-add-button{display:flex}.transaction-filter-actions{display:flex;gap:8px}
[role=dialog],[role=alertdialog],[data-slot=sheet-content]{position:fixed;z-index:100;inset:16px;background:white;overflow:auto;padding:16px}[data-slot=sheet-overlay],[data-slot=dialog-overlay]{position:fixed;inset:0;background:#0003;z-index:90}
.isolate.z-50:has([role=listbox]),.isolate.z-50:has([role=menu]){z-index:150}[data-slot=select-content],[data-slot=dropdown-menu-content]{background:white;z-index:150;max-height:60vh;overflow:auto}.chart{width:400px;height:200px}input{max-width:100%}.hidden-balance-dot{display:inline-block;width:4px;height:4px;background:black;margin:1px}
@media(max-width:767px){.desktop-history-filters{display:none}.mobile-history-filters{display:block}}`;
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
try {
  for (const locale of ['en', 'id']) for (const width of [390, 1200]) {
    const t = JSON.parse(await readFile(join(root, `messages/${locale}.json`), 'utf8')).UI;
    const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: 'Asia/Jakarta' });
    context.setDefaultTimeout(10000);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    let failQueries = false, failSignOut = true;
    const requests = [];
    await page.route('http://ledger-views.test/**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/auth/sign-out') {
        await route.fulfill(signOutResponse(failSignOut));
      } else if (url.pathname.startsWith('/api/ledger/')) {
        requests.push(url.pathname + url.search);
        await new Promise((resolve) => setTimeout(resolve, 80));
        await route.fulfill(queryResponse(url, failQueries));
      } else await route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body><div id="root"></div></body></html>' });
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
    await page.goto('http://ledger-views.test/transactions');
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: 'window.process={env:{NODE_ENV:"test"}};' });
    await page.addScriptTag({ content: code + '\n//# sourceURL=' + bundleUrl });
    await page.evaluate((locale) => window.mountLedgerViews(locale), locale);
    await page.getByText('Fixture lunch', { exact: true }).waitFor();
    assert.ok(await page.locator('.hidden-balance').count(), 'Amounts start masked');
    await page.evaluate(() => window.ledgerViews.store.getState().setBalancesVisible(true));
    await page.waitForFunction(() => !document.querySelector('.hidden-balance'));
    const form = width < 768 ? page.getByRole('form', { name: t.searchTransactionHistory }) : page.getByRole('form', { name: t.filterTransactionHistory });
    const search = form.locator('input[name=search]');
    const submit = async (value) => {
      await search.fill(value);
      await search.press('Enter');
      await page.waitForFunction((value) => new URLSearchParams(location.search).get('search') === value, value);
      await page.waitForFunction(() => !document.querySelector('.ledger-query-content[aria-busy=true]'));
    };
    await submit('lunch');
    assert.equal(await page.getByText('Fixture salary', { exact: true }).count(), 0);
    await submit('salary');
    await page.getByText('Fixture salary', { exact: true }).waitFor();
    const beforeCache = requests.length;
    await submit('lunch');
    await page.getByText('Fixture lunch', { exact: true }).waitFor();
    assert.equal(requests.length, beforeCache, 'Returning to a fresh filter uses the query cache');
    await page.goBack();
    await page.getByText('Fixture salary', { exact: true }).waitFor();
    await page.goForward();
    await page.getByText('Fixture lunch', { exact: true }).waitFor();
    if (width < 768) {
      await page.getByRole('button', { name: t.filters, exact: true }).click();
      const sheet = page.getByRole('dialog');
      await sheet.waitFor();
      await sheet.getByRole('combobox', { name: t.wallet, exact: true }).click();
      await page.getByRole('option', { name: 'Fixture Bank', exact: true }).click();
      await sheet.getByRole('button', { name: t.applyFilters, exact: true }).click();
      await sheet.waitFor({ state: 'detached' });
      await page.waitForFunction(() => new URLSearchParams(location.search).get('wallet') === 'bank');
      const chips = page.locator('.mobile-active-filters');
      await chips.getByRole('button').last().click();
      await page.waitForFunction(() => !new URLSearchParams(location.search).has('wallet'));
      await chips.getByRole('button').first().click();
      await page.waitForFunction(() => !location.search);
    } else {
      await form.getByRole('button', { name: t.clearFilters, exact: true }).click();
      await page.waitForFunction(() => !location.search);
    }
    await submit('no matches');
    await page.getByText(t.noTransactionsMatchThisPeriodAndFilters, { exact: true }).waitFor();
    failQueries = true;
    await submit('failure');
    await page.getByRole('alert').first().waitFor();
    failQueries = false;
    await page.getByRole('button', { name: t.reloadLatestLedger, exact: true }).first().click();
    await page.getByRole('alert').waitFor({ state: 'detached' });
    await page.waitForFunction(() => !window.ledgerViews.store.getState().pending);
    await page.evaluate(() => window.ledgerViews.store.setState({ notice: 'Latest ledger loaded. Your unsaved changes are kept.' }));
    await page.getByRole('status').filter({ hasText: locale === 'en' ? 'Latest ledger' : /./ }).first().waitFor();
    await page.evaluate(() => window.ledgerViews.store.setState({ conflict: true, notice: '' }));
    await page.getByRole('alert').first().waitFor();
    await page.getByRole('button', { name: t.reloadLatestLedger, exact: true }).first().click();
    await page.waitForFunction(() => !window.ledgerViews.store.getState().conflict && !window.ledgerViews.store.getState().pending);
    await page.evaluate(() => window.ledgerViews.store.setState({ notice: '', error: '' }));
    // Exercise the real dispatcher for entry kinds, wallets and receipt upload.
    for (const editor of [{ type: 'entry', kind: 'income' }, { type: 'entry', kind: 'expense' }, { type: 'entry', kind: 'transfer' }, { type: 'wallet' }, { type: 'receipt' }]) {
      await page.evaluate((editor) => window.ledgerViews.store.getState().setEditor(editor), editor);
      await page.getByRole('dialog').waitFor();
      await page.getByRole('dialog').getByRole('button', { name: editor.type === 'receipt' ? t.close : t.cancel, exact: true }).click();
      await page.getByRole('dialog').waitFor({ state: 'detached' });
    }
    await page.getByRole('button', { name: t.addTransaction, exact: true }).click();
    await page.getByRole('menuitem', { name: t.income, exact: true }).click();
    await page.getByRole('dialog').waitFor();
    await page.getByRole('dialog').getByRole('button', { name: t.cancel, exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    // Real navigation components use only a synthetic router boundary.
    await page.getByRole('tab', { name: t.wallet, exact: true }).click();
    await page.getByRole('button', { name: t.addWallet, exact: true }).click();
    await page.getByRole('dialog').waitFor();
    await page.getByRole('dialog').getByRole('button', { name: t.cancel, exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    await page.getByRole('tab', { name: t.report, exact: true }).click();
    await page.getByText(t.spendingByCategory, { exact: true }).waitFor();
    await page.getByRole('tab', { name: t.settings, exact: true }).click();
    await page.getByRole('button', { name: t.signOut, exact: true }).click();
    await page.waitForFunction(() => window.ledgerViews.store.getState().error === 'Could not sign out. Please try again.');
    assert.equal(await page.evaluate(() => window.ledgerViews.store.getState().pending), false);
    failSignOut = false;
    await page.getByRole('button', { name: t.accountMenu, exact: true }).click();
    await page.getByRole('menuitem', { name: t.signOut, exact: true }).click();
    await page.locator('#signed-out').waitFor();
    assert.deepEqual(errors, []);
    const result = (await cdp.send('Profiler.takePreciseCoverage')).result.filter((script) => script.url === bundleUrl);
    await writeFile(join(output, `browser-views-${locale}-${width}.json`), JSON.stringify({ result }));
    await context.close();
    console.log('Ledger view browser checks passed:', locale, width);
  }
} finally {
  await browser.close();
  if (!process.env.LEDGER_COVERAGE_DIR) await rm(output, { recursive: true, force: true });
}

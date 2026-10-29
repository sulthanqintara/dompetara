import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const bundle = await build({ entryPoints: [root + 'tests/fixtures/ledger-store.tsx'], bundle: true, write: false,
  platform: 'browser', format: 'iife', jsx: 'automatic', alias: { '@': root + 'src' }, define: { 'process.env.NODE_ENV': '"test"' } });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
try {
  const page = await browser.newPage({ timezoneId: 'Asia/Jakarta' });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('http://ledger-store.test/**', (route) => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
  await page.goto('http://ledger-store.test');
  await page.addScriptTag({ content: 'window.process = { env: { NODE_ENV: "test" } };' });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  try { await page.locator('#balance').waitFor(); } catch (error) { console.error(errors); throw error; }
  await page.waitForTimeout(100);
  const before = await page.evaluate(() => ({ ...window.storeTest.renders }));
  await page.locator('#balance').click();
  assert.equal(await page.locator('#balance').textContent(), 'true');
  const after = await page.evaluate(() => ({ ...window.storeTest.renders }));
  assert.equal(after.name, before.name, 'Changing visibility must not rerender the name subscriber');
  assert.ok(after.balance > before.balance);
  await page.evaluate(() => window.storeTest.mountSecond());
  await page.locator('#other #balance').waitFor();
  assert.equal(await page.locator('#other #balance').textContent(), 'false');
  assert.equal(await page.locator('#root #balance').textContent(), 'true');
  await page.locator('#switch').click();
  assert.equal(await page.locator('#root #name').textContent(), 'second');
  assert.equal(await page.locator('#root #balance').textContent(), 'false');
  assert.deepEqual(await page.evaluate(() => window.storeTest.errors), []);
  assert.deepEqual(errors, []);
  console.log('Ledger browser checks passed: SSR hydration, selector render isolation, simultaneous workspaces and account reset.');
} finally { await browser.close(); }

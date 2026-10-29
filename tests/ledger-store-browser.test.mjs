import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const root = fileURLToPath(new URL('../', import.meta.url));
const outputDirectory = process.env.LEDGER_COVERAGE_DIR ?? await mkdtemp(join(tmpdir(), 'dompetara-store-'));
await mkdir(outputDirectory, { recursive: true });
const bundlePath = join(outputDirectory, 'store-fixture.js');
const bundleUrl = pathToFileURL(bundlePath).href;
await build({ entryPoints: [root + 'tests/fixtures/ledger-store.tsx'], bundle: true, outfile: bundlePath, sourcemap: 'linked',
  platform: 'browser', format: 'iife', jsx: 'automatic', alias: { '@': root + 'src' }, define: { 'process.env.NODE_ENV': '"test"' } });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
try {
  const page = await browser.newPage({ timezoneId: 'Asia/Jakarta' });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('http://ledger-store.test/**', (route) => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
  await page.goto('http://ledger-store.test');
  await page.addScriptTag({ content: 'window.process = { env: { NODE_ENV: "test" } };' });
  await page.addScriptTag({ content: await readFile(bundlePath, 'utf8') + '\n//# sourceURL=' + bundleUrl });
  try { await page.locator('#balance').waitFor(); } catch (error) { console.error(errors); throw error; }
  await page.waitForTimeout(100);
  const initialView = await page.locator('#view').textContent();
  assert.match(initialView, /^IDR:Asia\/Jakarta:\d{4}-\d{2}:0$/);
  const before = await page.evaluate(() => ({ ...window.storeTest.renders }));
  await page.locator('#balance').click();
  assert.equal(await page.locator('#balance').textContent(), 'true');
  const after = await page.evaluate(() => ({ ...window.storeTest.renders }));
  assert.equal(after.name, before.name, 'Changing visibility must not rerender the name subscriber');
  assert.equal(after.view, before.view, 'The shared view selector ignores unrelated visibility changes');
  assert.ok(after.balance > before.balance);
  await page.locator('#view').click();
  assert.equal(await page.locator('#view').textContent(), initialView.replace(/^IDR:/, 'USD:'));
  assert.ok((await page.evaluate(() => window.storeTest.renders.view)) > after.view, 'The view selector responds to currency changes');
  await page.evaluate(() => window.storeTest.mountSecond());
  await page.locator('#other #balance').waitFor();
  assert.equal(await page.locator('#other #balance').textContent(), 'false');
  assert.equal(await page.locator('#root #balance').textContent(), 'true');
  await page.locator('#switch').click();
  assert.equal(await page.locator('#root #name').textContent(), 'second');
  assert.equal(await page.locator('#root #balance').textContent(), 'false');
  assert.equal(await page.locator('#root #view').textContent(), initialView);
  assert.deepEqual(await page.evaluate(() => window.storeTest.errors), []);
  assert.deepEqual(errors, []);
  const result = (await cdp.send('Profiler.takePreciseCoverage')).result.filter((script) => script.url === bundleUrl);
  await writeFile(join(outputDirectory, 'browser-store.json'), JSON.stringify({ result }));
  console.log('Ledger browser checks passed: SSR hydration, selector render isolation, simultaneous workspaces and account reset.');
} finally {
  await browser.close();
  if (!process.env.LEDGER_COVERAGE_DIR) await rm(outputDirectory, { recursive: true, force: true });
}

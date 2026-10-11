import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { chromium } from "playwright";

const source = await readFile(new URL("../src/lib/modal-history/create-modal-history.ts", import.meta.url), "utf8");
const script = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
try {
  for (const browserType of ["desktop", "phone"]) {
    const context = await browser.newContext({ viewport: { width: browserType === "phone" ? 320 : 1440, height: 568 }, isMobile: browserType === "phone" });
    await context.route("http://modal.test/**", (route) => route.fulfill({ contentType: "text/html", body: "<html><body>History test</body></html>" }));
    const page = await context.newPage();
    await page.goto("http://modal.test/prior");
    await page.goto("http://modal.test/current");
    await page.evaluate((script) => {
      const exports = {};
      new Function("exports", script)(exports);
      window.register = exports.createModalHistory().register;
      window.active = {};
      window.closeEvents = [];
      window.openModal = (name, blocked = false) => {
        window.active[name] = window.register(() => {
          window.closeEvents.push(name);
          if (!blocked) { window.active[name](); delete window.active[name]; }
        });
      };
      history.replaceState({ router: "preserved" }, "");
    }, script);
    const settle = () => page.waitForFunction(() => !history.state?.dompetaraModal);
    const guarded = () => page.waitForFunction(() => Boolean(history.state?.dompetaraModal));
    const back = () => page.evaluate(() => history.back());

    await page.evaluate(() => window.openModal("editor"));
    await guarded();
    assert.equal(await page.evaluate(() => history.state.router), "preserved");
    assert.equal(page.url(), "http://modal.test/current");
    await back();
    await settle();
    assert.deepEqual(await page.evaluate(() => window.closeEvents), ["editor"]);
    assert.equal(page.url(), "http://modal.test/current");

    // All ordinary close paths use the same cleanup: X, Cancel, Escape, Save,
    // parent unmount, and backdrop dismissal must not leave an extra Back step.
    for (const method of ["X", "Cancel", "Escape", "Save", "Unmount", "Backdrop"]) {
      await page.evaluate((name) => window.openModal(name), method);
      await guarded();
      await page.evaluate((name) => { window.active[name](); delete window.active[name]; }, method);
      await settle();
    }

    await page.evaluate(() => window.openModal("parent"));
    await guarded();
    const parentMarker = await page.evaluate(() => history.state.dompetaraModal);
    await page.evaluate(() => window.openModal("child"));
    await page.waitForFunction((parent) => history.state.dompetaraModal !== parent, parentMarker);
    await back();
    await page.waitForFunction(() => !window.active.child && Boolean(window.active.parent));
    assert.equal(await page.evaluate(() => history.state.dompetaraModal), parentMarker);
    await back();
    await settle();

    // Closing a whole nested stack drains only its modal entries.
    await page.evaluate(() => window.openModal("parent"));
    await guarded();
    const wholeStackParent = await page.evaluate(() => history.state.dompetaraModal);
    await page.evaluate(() => window.openModal("child"));
    await page.waitForFunction((parent) => history.state.dompetaraModal !== parent, wholeStackParent);
    await page.evaluate(() => { window.active.parent(); window.active.child(); window.active = {}; });
    await settle();
    assert.equal(page.url(), "http://modal.test/current");

    // Removing the underlying modal while its child stays open must not
    // leave the removed parent's entry in the next Back navigation.
    await page.evaluate(() => window.openModal("removed-parent"));
    await guarded();
    const removedParentMarker = await page.evaluate(() => history.state.dompetaraModal);
    await page.evaluate(() => window.openModal("remaining-child"));
    await page.waitForFunction((marker) => history.state.dompetaraModal !== marker, removedParentMarker);
    await page.evaluate(() => { window.active["removed-parent"](); delete window.active["removed-parent"]; });
    await back();
    await settle();
    assert.equal(page.url(), "http://modal.test/current");

    // A controlled root can reject Back while a save is pending.
    await page.evaluate(() => window.openModal("pending", true));
    await guarded();
    await back();
    await page.waitForFunction(() => window.closeEvents.includes("pending") && Boolean(history.state?.dompetaraModal));
    assert.equal(page.url(), "http://modal.test/current");
    await page.evaluate(() => { window.active.pending(); delete window.active.pending; });
    await settle();

    // Strict Mode replay and immediate close/reopen must not create phantom guards.
    await page.evaluate(() => { const remove = window.register(() => {}); remove(); window.openModal("replayed"); });
    await guarded();
    await page.evaluate(() => { window.active.replayed(); delete window.active.replayed; window.openModal("replacement"); });
    await page.waitForFunction(() => Boolean(history.state?.dompetaraModal));
    await back();
    await settle();
    await back();
    await page.waitForURL("http://modal.test/prior");
    await context.close();
  }
  console.log("Modal history passed: Back, normal close cleanup, nested stacks, blocked dismissal, Strict Mode, immediate reopen, router state, and ordinary navigation on phone/desktop.");
} finally { await browser.close(); }

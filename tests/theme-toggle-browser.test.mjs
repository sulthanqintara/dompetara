import assert from "node:assert/strict";
import { chromium } from "playwright";

const origin = process.env.LEDGER_TEST_URL ?? "http://localhost:3000";
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
try {
  for (const language of ["en", "id"]) for (const reducedMotion of ["no-preference", "reduce"]) {
    const context = await browser.newContext({ colorScheme: "light", reducedMotion, viewport: { width: 320, height: 568 } });
    await context.addCookies([{ name: "locale", value: language, url: origin }]);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${origin}/sign-in`);
    const toggle = page.locator("button.theme-toggle");
    await page.waitForFunction(() => !document.querySelector("button.theme-toggle")?.disabled);
    assert.equal(await toggle.locator("svg").getAttribute("data-theme"), "light", "Sun indicates the current light theme");
    assert.ok(await toggle.locator("svg").evaluate((icon) => icon.classList.contains("lucide-sun")));
    assert.equal(await toggle.locator("svg").evaluate((icon) => icon.getAnimations().length), 0, "No animation on initial load");
    for (const theme of ["dark", "light"]) {
      await toggle.click();
      await page.waitForFunction((theme) => document.querySelector("button.theme-toggle svg")?.getAttribute("data-theme") === theme, theme);
      const state = await toggle.locator("svg").evaluate(async (icon, reducedMotion) => {
        const animation = icon.getAnimations()[0];
        if (!animation) throw new Error("Switch must animate");
        animation.pause();
        await animation.ready;
        animation.currentTime = 250;
        const flash = getComputedStyle(icon).color;
        const sample = document.createElement("span");
        sample.style.color = icon.getAttribute("data-theme") === "dark" ? "var(--transfer)" : "var(--amber-400)";
        document.body.append(sample);
        const expectedFlash = getComputedStyle(sample).color;
        sample.remove();
        const name = animation.animationName;
        const transform = getComputedStyle(icon).transform;
        const duration = animation.effect.getTiming().duration;
        animation.currentTime = 1000;
        const fading = getComputedStyle(icon).color;
        const fadingTransform = getComputedStyle(icon).transform;
        const motionSettled = fadingTransform === "none" || new DOMMatrix(fadingTransform).isIdentity;
        animation.finish();
        await animation.finished;
        return { motionSettled, duration, flash, fading, expectedFlash, name, transform, settled: getComputedStyle(icon).color, normal: getComputedStyle(icon.parentElement).color, reducedMotion };
      }, reducedMotion);
      assert.equal(state.flash, state.expectedFlash, "Moon flashes blue; sun flashes yellow");
      assert.equal(state.settled, state.normal, "Color returns to normal");
      assert.ok(state.motionSettled, "Spin and bounce finish before the color fade");
      assert.equal(state.duration, 1350, "Switch uses balanced timing while retaining the color fade");
      assert.notEqual(state.fading, state.flash, "Color fades before the animation ends");
      assert.notEqual(state.fading, state.normal, "Fade has an intermediate color");
      const channels = (color) => color.match(/[\d.]+/g).map(Number);
      const flashChannels = channels(state.flash), normalChannels = channels(state.normal);
      channels(state.fading).forEach((channel, i) => assert.ok(channel >= Math.min(flashChannels[i], normalChannels[i]) - 1 && channel <= Math.max(flashChannels[i], normalChannels[i]) + 1, "Fade interpolates toward the current theme color without a final snap"));
      assert.equal(state.name, reducedMotion === "reduce" ? "theme-icon-color" : "theme-icon-switch");
      if (reducedMotion === "reduce") assert.equal(state.transform, "none", "Reduced motion omits spin and bounce");
      assert.ok(await toggle.locator("svg").evaluate((icon, theme) => icon.classList.contains(theme === "dark" ? "lucide-moon" : "lucide-sun"), theme));
    }
    await toggle.focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.documentElement.classList.contains("dark"));
    for (const width of [320, 390, 568, 768, 1440]) {
      await page.setViewportSize({ width, height: width === 568 ? 320 : 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const box = await toggle.boundingBox();
      assert.ok(box.width >= 44 && box.height >= 44);
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log("Theme icon checks passed: current-theme icons, blue/yellow animation, settled color, reduced motion, keyboard switching, both locales and responsive touch targets.");
} finally {
  await browser.close();
}

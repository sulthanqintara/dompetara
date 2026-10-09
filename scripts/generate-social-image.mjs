import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

// The HTML contains its font and logo, so captures need no dev server or network.
const root = new URL("../", import.meta.url);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
});

try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.goto(new URL("src/features/branding/social-preview.html", root).href);
  await page.evaluate(() => document.fonts.ready);
  const image = await page.screenshot();
  const alt = "Dompetara. Your money. All accounted for. Income. Expenses. One clear picture.\n";
  for (const name of ["opengraph-image", "twitter-image"]) {
    await writeFile(new URL(`src/app/${name}.png`, root), image);
    await writeFile(new URL(`src/app/${name}.alt.txt`, root), alt);
  }

  const previews = new URL("outputs/social-preview/", root);
  await mkdir(previews, { recursive: true });
  for (const width of [320, 400, 768]) {
    await page.setViewportSize({ width, height: Math.round(width * 630 / 1200) });
    await page.evaluate((scale) => {
      const main = document.querySelector("main");
      main.style.transformOrigin = "top left";
      main.style.transform = `scale(${scale})`;
      document.body.style.overflow = "hidden";
    }, width / 1200);
    await page.screenshot({ path: fileURLToPath(new URL(`selected-${width}.png`, previews)) });
  }
  console.log("Captured Open Graph and Twitter images at 1200×630, plus small embed previews.");
} finally {
  await browser.close();
}

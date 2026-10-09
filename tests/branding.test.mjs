import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { colorScales } from "../src/features/branding/design-system.ts";

const root = new URL("../", import.meta.url);
const manifestSource = await readFile(new URL("src/app/manifest.ts", root), "utf8");
const manifest = JSON.parse(manifestSource.slice(manifestSource.indexOf("return ") + 7, manifestSource.lastIndexOf("};") + 1)
  .replace(/t\("trackYourIncomeAndExpensesAllInOnePlace"\)/, '"localized description"').replace(/await getLocale\(\)/, '"en"')
  .replace(/colorScales.neutral\[100\]/, JSON.stringify(colorScales.neutral[100])).replace(/colorScales.brand\[500\]/, JSON.stringify(colorScales.brand[500])));
assert.equal(manifest.name, "Dompetara");
assert(manifest.icons.some(icon => icon.purpose === "maskable"));
for (const icon of manifest.icons) {
  const bytes = await readFile(new URL(`public${icon.src}`, root));
  const metadata = await sharp(bytes).metadata();
  assert.equal(`${metadata.width}x${metadata.height}`, icon.sizes);
  if (icon.purpose === "maskable") assert.equal((await sharp(bytes).stats()).isOpaque, true);
}
const apple = await readFile(new URL("src/app/apple-icon.png", root));
assert.equal((await sharp(apple).metadata()).width, 180);
assert.equal((await sharp(apple).stats()).isOpaque, true);
const ico = await readFile(new URL("src/app/favicon.ico", root));
assert.equal(ico.readUInt16LE(2), 1);
assert.equal(ico.readUInt16LE(4), 3);
for (let i = 0; i < 3; i++) {
  const entry = 6 + 16 * i;
  const offset = ico.readUInt32LE(entry + 12);
  const length = ico.readUInt32LE(entry + 8);
  const frame = await sharp(ico.subarray(offset, offset + length)).metadata();
  assert.equal(frame.width, [16, 32, 48][i]);
  assert.equal(frame.height, frame.width);
}
console.log("Dompetara device icons passed");
for (const name of ["dompetara-mark", "dompetara-mark-mono"]) {
  const { data, info } = await sharp(await readFile(new URL(`public/icons/${name}.svg`, root))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alpha = (x, y) => data[(y * info.width + x) * info.channels + 3];
  assert.equal(alpha(0, 0), 0, "Background must be transparent");
  assert.equal(alpha(110, 128), 0, "D counter must be transparent");
  assert.equal(alpha(151, 128), 0, "Wallet clasp hole must be transparent");
  assert.equal(alpha(75, 128), 255, "D must remain visible");
}
console.log("Dompetara transparent marks passed");

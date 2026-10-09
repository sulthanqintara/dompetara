import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { colorHsl, colorRoles, colorScales, designColors, scaleLabels, shadeColor, themeCss } from "../src/features/branding/design-system.ts";

function luminance(hex: string) {
  const rgb = hex.slice(1).match(/../g)!.map((channel) => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

for (const [family, shades] of Object.entries(colorScales)) {
  assert.deepEqual(Object.keys(shades), ["100", "200", "300", "400", "500", "600", "700", "800", "900"]);
  let previous = Infinity;
  for (const hex of Object.values(shades)) {
    assert.match(hex, /^#[0-9A-F]{6}$/);
    const brightness = luminance(hex);
    assert.ok(brightness < previous, `${family}: shades must progressively darken`);
    previous = brightness;
  }
  for (const [shade, hex] of Object.entries(shades)) assert.ok(themeCss.includes(`--${family}-${shade}:${hex};`));
}
assert.equal(colorHsl("#FFFFFF"), "hsl(0 0% 100%)");
assert.equal(colorHsl("#000000"), "hsl(0 0% 0%)");
assert.equal(colorHsl("#FF0000"), "hsl(0 100% 50%)");
assert.equal(colorHsl("#00FF00"), "hsl(120 100% 50%)");
assert.equal(colorHsl("#0000FF"), "hsl(240 100% 50%)");
assert.equal(colorHsl("#287D69"), "hsl(166 52% 32%)");
for (const mode of ["light", "dark"] as const) {
  const colors = Object.fromEntries(designColors.map((color) => [color.token, color[mode]]));
  const pairs: [string, string, number][] = [
    ["primary-foreground", "primary", 4.5], ["secondary-foreground", "secondary", 4.5],
    ["primary-foreground", "primary-hover", 4.5],
    ...["background", "card", "muted"].flatMap((surface): [string, string, number][] => [
      ...["foreground", "muted-foreground", "income", "destructive", "transfer", "warning"].map((text): [string, string, number] => [text, surface, 4.5]),
      ["input", surface, 3], ["ring", surface, 3],
    ]),
  ];
  for (const [foreground, background, minimum] of pairs) {
    const values = [luminance(colors[foreground]), luminance(colors[background])];
    const ratio = (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
    assert.ok(ratio >= minimum, `${mode}: ${foreground}/${background} = ${ratio}, expected ${minimum}`);
  }
  const messages = JSON.parse(await readFile(`messages/${mode === "light" ? "en" : "id"}.json`, "utf8"));
  for (const color of designColors) assert.ok(messages.UI[color.label]);
  for (const label of Object.values(scaleLabels)) assert.ok(messages.UI[label]);
  for (const role of colorRoles) assert.equal(colors[role.token], shadeColor(role[mode]));
  const css = themeCss.split(mode === "light" ? ":root,.theme-light{" : ".dark{")[1].split("}")[0];
  for (const color of designColors) assert.ok(css.includes(`--${color.token}:${color[mode]};`));
}

assert.doesNotMatch(await readFile("src/app/globals.css", "utf8"), /#[0-9a-fA-F]{3,8}\b/, "App CSS must use the shared palette");

// Execute the actual route exports with framework dependencies stubbed.
const source = await readFile("src/app/style-guide/page.tsx", "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
for (const environment of ["development", "production", "test"]) {
  const exports: Record<string, () => unknown> = {};
  runInNewContext(code, {
    exports, process: { env: { NODE_ENV: environment } },
    require: (name: string) => {
      if (name === "next/navigation") return { notFound: () => { throw new Error("404"); } };
      if (name === "next-intl/server") return { getTranslations: async () => () => "Style guide" };
      if (name === "react/jsx-runtime") return { jsx: (component: unknown) => component };
      if (name.endsWith("/style-guide")) return { StyleGuide: "preview" };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  if (environment === "development") {
    assert.equal(exports.default(), "preview");
    assert.equal((await exports.generateMetadata() as { robots: { index: boolean } }).robots.index, false);
  } else {
    assert.throws(exports.default, /404/);
    await assert.rejects(async () => exports.generateMetadata(), /404/);
  }
}
console.log("Design system checks passed: ordered shade scales, HSL conversion, role mapping/contrast, translations, and development-only route/metadata.");

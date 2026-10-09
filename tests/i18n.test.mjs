import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import ts from "typescript";
import { createTranslator } from "next-intl";
import { resolveLocale, preferenceSchema } from "../src/features/i18n/i18n.ts";
import { categoryLabel, entryTitle } from "../src/features/i18n/format.ts";
import { format, formatShare } from "../src/features/ledger/format.ts";

assert.equal(resolveLocale("id", "en", "en-US"), "id");
assert.equal(resolveLocale("en", "id", "id-ID"), "en");
assert.equal(resolveLocale(null, "id", "en"), "id");
assert.equal(resolveLocale(null, null, "id-ID,id;q=0.9,en;q=0.8"), "id");
assert.equal(resolveLocale(null, null, "en;q=0.1,id;q=0.9"), "id");
assert.equal(resolveLocale(null, null, "fr-FR,id;q=0.5"), "en");
assert.equal(resolveLocale("invalid", "../../id", null), "en");
assert.equal(resolveLocale(null, null, "id;q=0,en;q=1"), "en");
assert.equal(resolveLocale(null, null, "ID-id"), "id");
assert.equal(resolveLocale(null, null, "id;q=NaN,en;q=0.5"), "en");
assert.equal(preferenceSchema.safeParse({ locale: "fr" }).success, false);
assert.equal(preferenceSchema.safeParse({}).success, true);
const messages = Object.fromEntries(await Promise.all(["en", "id"].map(async (locale) => [locale, JSON.parse(await readFile(`messages/${locale}.json`, "utf8"))])));
assert.deepEqual(Object.keys(messages.id).sort(), Object.keys(messages.en).sort(), "Translation namespaces must match");
for (const namespace of Object.keys(messages.en)) {
  assert.deepEqual(Object.keys(messages.id[namespace]).sort(), Object.keys(messages.en[namespace]).sort());
  for (const locale of ["en", "id"]) {
    const t = createTranslator({ locale, messages: messages[locale], namespace, onError: (error) => { throw error; } });
    for (const [key, value] of Object.entries(messages[locale][namespace])) {
      assert.ok(value.trim(), `${locale}.${namespace}.${key} must have a translation`);
      const parameters = Object.fromEntries([...value.matchAll(/\{(\w+)(?:,|\})/g)].map(([, name]) => [name, ["count", "number", "page", "pages", "start", "end", "total", "size"].includes(name) ? 2 : "example"]));
      assert.ok(t(key, parameters), `${locale}.${namespace}.${key} must be valid ICU`);
    }
  }
}
const securityErrorMessages = [
  "Wallet limit reached. Remove a wallet before adding another.",
  "Category limit reached. Remove a category before adding another.",
  "Transaction limit reached. Remove a transaction before adding another.",
  "Receipt import limit reached. Save this transaction manually.",
  "Ledger storage limit reached. Remove transaction details before adding more data.",
  "Too many requests. Please wait a moment and try again.",
  "Request protection is temporarily unavailable. Please try again later.",
];
const errorKeys = new Map(Object.entries(messages.en.Errors).map(([key, value]) => [value, key]));
for (const message of securityErrorMessages) {
  const key = errorKeys.get(message);
  assert.ok(key, `Security error must map through useErrorMessage: ${message}`);
  for (const locale of ["en", "id"]) {
    const translateError = createTranslator({ locale, messages: messages[locale], namespace: "Errors", onError: (error) => { throw error; } });
    assert.equal(translateError(key), messages[locale].Errors[key]);
    assert.notEqual(key, "somethingWentWrongPleaseTryAgain", "Known security errors retain their actionable translation");
  }
  assert.notEqual(messages.id.Errors[key], message, `${key} must have Indonesian copy`);
}
const t = createTranslator({ locale: "id", messages: messages.id, namespace: "UI" });
assert.equal(categoryLabel({ categories: [{ id: "Bills", name: "Bills", kind: "expense" }], entries: [] }, "Bills", t), "Tagihan");
assert.equal(categoryLabel({ categories: [{ id: "custom", name: "Bills", kind: "expense" }], entries: [] }, "Bills", t), "Bills", "Custom names must not be translated");
assert.equal(categoryLabel({ categories: [], entries: [{ transferId: "legacy", category: "Admin fees" }] }, "Admin fees", t), "Biaya admin");
assert.equal(categoryLabel({ categories: [{ id: "custom", name: "Admin fees" }], entries: [] }, "Admin fees", t), "Admin fees");
assert.equal(entryTitle({ kind: "transfer", title: "Transfer" }, t), "Transfer");
assert.equal(entryTitle({ kind: "correction", title: "Opening balance" }, t), "Saldo awal");
assert.equal(entryTitle({ kind: "expense", title: "Opening balance" }, t), "Opening balance");
assert.equal(format(123456, "IDR", "id"), new Intl.NumberFormat("id", { style: "currency", currency: "IDR", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(1234.56));
assert.equal(formatShare(0.0001, "id"), "<0,1%");

async function filesAt(path) {
  return (await Promise.all((await readdir(path, { withFileTypes: true })).map((entry) => entry.isDirectory() ? filesAt(`${path}/${entry.name}`) : [`${path}/${entry.name}`]))).flat();
}
const properNames = new Set(["Dompetara", "ompetara", "G", "Pocket D", "Sunrise Pocket", "Woven D", "Growing Coin", "North Star", "Rp"]);
const copyAttributes = new Set(["aria-label", "aria-description", "aria-valuetext", "alt", "placeholder", "title", "label", "description", "children"]);

function untranslatedCopy(source) {
  const copy = [];
  function checkText(text) {
    const value = text.replace(/\s+/g, " ").trim();
    if (/\p{L}/u.test(value) && !properNames.has(value)) copy.push(value);
  }
  function checkExpression(node) {
    if (!node) return;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) checkText(node.text);
    else if (ts.isTemplateExpression(node)) {
      checkText(node.head.text);
      for (const span of node.templateSpans) {
        checkExpression(span.expression);
        checkText(span.literal.text);
      }
    } else if (ts.isConditionalExpression(node)) {
      checkExpression(node.whenTrue);
      checkExpression(node.whenFalse);
    } else if (ts.isBinaryExpression(node) && [ts.SyntaxKind.PlusToken, ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind)) {
      // Conditions in &&/|| are code, while their right-hand side can be copy.
      if (node.operatorToken.kind === ts.SyntaxKind.PlusToken) checkExpression(node.left);
      checkExpression(node.right);
    } else if (ts.isParenthesizedExpression(node)) checkExpression(node.expression);
    else if (ts.isArrayLiteralExpression(node)) node.elements.forEach(checkExpression);
  }
  function visit(node) {
    if (ts.isJsxText(node)) checkText(node.text);
    if (ts.isJsxExpression(node) && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) checkExpression(node.expression);
    if (ts.isJsxAttribute(node) && copyAttributes.has(node.name.getText(source)) && node.initializer) {
      if (ts.isStringLiteral(node.initializer)) checkText(node.initializer.text);
      else if (ts.isJsxExpression(node.initializer)) checkExpression(node.initializer.expression);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return copy;
}

for (const snippet of ['<p>Hello</p>', '<p>{"Hello"}</p>', '<p>{ready ? "Ready" : "Waiting"}</p>', '<p>{ready && "Ready"}</p>', '<p>{`Hello ${name}`}</p>', '<Input placeholder={"Search"} />', '<Button aria-label={ready ? "Save" : "Wait"} />']) {
  assert.ok(untranslatedCopy(ts.createSourceFile("fixture.tsx", snippet, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)).length, `Copy scan must reject ${snippet}`);
}
assert.deepEqual(untranslatedCopy(ts.createSourceFile("fixture.tsx", '<p>{t("greeting", { name: "Example" })}{name}{ready && t("ready")}<Button aria-label={t("save")} /></p>', ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)), []);
const leftovers = [];
for (const file of (await filesAt("src")).filter((file) => file.endsWith(".tsx"))) {
  const source = ts.createSourceFile(file, await readFile(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  leftovers.push(...untranslatedCopy(source).map((text) => `${file}: ${text}`));
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(source) === "t" && ts.isStringLiteral(node.arguments[0])) {
      const key = node.arguments[0].text;
      assert.ok(messages.en[file.includes("use-error-message") ? "Errors" : "UI"][key], `${file}: missing key ${key}`);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
assert.deepEqual(leftovers, [], "App-authored JSX copy must use translations");
console.log("i18n checks passed: locale precedence, validation, dictionary/ICU parity, JSX coverage, money formatting and preserved custom content.");

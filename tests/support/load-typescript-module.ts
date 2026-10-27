import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Execute real modules with explicit boundaries, retaining source maps for coverage.
export async function loadTypescriptModule(path: string, dependencies: Record<string, unknown>, exports: object) {
  const original = resolve(path);
  const code = ts.transpileModule(await readFile(original, "utf8"), {
    fileName: original,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      inlineSourceMap: true, inlineSources: true, sourceRoot: dirname(original) },
  }).outputText;
  const filename = process.env.LEDGER_COVERAGE_DIR ? resolve(process.env.LEDGER_COVERAGE_DIR, "transpiled", `${path}.js`) : original;
  if (process.env.LEDGER_COVERAGE_DIR) {
    await mkdir(dirname(filename), { recursive: true });
    await writeFile(filename, code);
  }
  runInNewContext(code, { exports, URL, Response, require: (name: string) => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  } }, { filename });
}

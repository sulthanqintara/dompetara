import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile, rename } from "node:fs/promises";
import { resolve, join, sep, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import v8ToIstanbul from "v8-to-istanbul";
import libCoverage from "istanbul-lib-coverage";

const root = fileURLToPath(new URL("../", import.meta.url));
const destination = join(root, "coverage", "fallow");
await mkdir(destination, { recursive: true });
const report = join(destination, "coverage-final.json");
// A failed run must not leave an earlier passing report in use.
await rm(report, { force: true });
const runDirectory = await mkdtemp(join(destination, "run-"));
const rawDirectory = join(runDirectory, "raw");
await mkdir(rawDirectory);
const env = { ...process.env, NODE_V8_COVERAGE: rawDirectory, LEDGER_COVERAGE_DIR: rawDirectory };
for (const [command, args] of [["pnpm", ["test"]], [process.execPath, ["tests/ledger-editor-browser.test.mjs"]]]) {
  const child = spawnSync(command, args, { cwd: root, env, stdio: "inherit" });
  if (child.error) throw child.error;
  if (child.status !== 0) process.exit(child.status ?? 1);
}

const coverage = libCoverage.createCoverageMap({});
for (const filename of await readdir(rawDirectory)) {
  if (!filename.endsWith(".json")) continue;
  const raw = JSON.parse(await readFile(join(rawDirectory, filename), "utf8"));
  for (const script of raw.result ?? []) {
    const path = script.url.startsWith("file://") ? fileURLToPath(script.url) : script.url;
    if (!isAbsolute(path)) continue;
    if (!path.startsWith(root) || path.includes(`${sep}node_modules${sep}`)) continue;
    const converter = v8ToIstanbul(path);
    await converter.load();
    converter.applyCoverage(script.functions);
    const converted = converter.toIstanbul();
    for (const [source, data] of Object.entries(converted)) {
      const actual = resolve(source);
      if (actual.startsWith(root) && !actual.includes(`${sep}node_modules${sep}`) && !actual.startsWith(destination))
        coverage.addFileCoverage(data);
    }
  }
}
await writeFile(`${report}.tmp`, JSON.stringify(coverage.toJSON()));
await rename(`${report}.tmp`, report);
await rm(runDirectory, { recursive: true, force: true });
console.log(`Coverage from real Node and Chromium execution: ${coverage.files().length} project files in ${report}`);

import assert from "node:assert/strict";
import { measureServerStage } from "../src/lib/measure-server-stage.ts";

const originalLog = console.info;
const environment: Record<string, string | undefined> = process.env;
const originalFlag = process.env.LEDGER_PERFORMANCE_LOGS;
const originalMode = process.env.NODE_ENV;
const logs: unknown[][] = [];
const context = { requestId: "test-request", source: "ledger-read" as const };
try {
  console.info = (...args: unknown[]) => { logs.push(args); };
  environment.NODE_ENV = "production";
  process.env.LEDGER_PERFORMANCE_LOGS = "0";
  await measureServerStage(context, "test", async () => "private-result");
  assert.equal(logs.length, 0, "Production logging is opt-in");
  process.env.LEDGER_PERFORMANCE_LOGS = "1";
  const result = { privateData: "must-not-be-logged" };
  assert.equal(await measureServerStage(context, "test", async () => result), result);
  const error = new Error("private-error-message");
  await assert.rejects(measureServerStage(context, "test", async () => { throw error; }), (caught) => caught === error);
  const entries = logs.map((args) => JSON.parse(args[1] as string));
  assert.deepEqual(entries.map((entry) => entry.outcome), ["completed", "interrupted"]);
  assert.ok(entries.every((entry) => entry.durationMs >= 0 && entry.requestId === "test-request"));
  assert.ok(!JSON.stringify(logs).includes("private"), "Results and exception messages must never enter timing logs");
} finally {
  console.info = originalLog;
  if (originalFlag === undefined) delete process.env.LEDGER_PERFORMANCE_LOGS;
  else process.env.LEDGER_PERFORMANCE_LOGS = originalFlag;
  if (originalMode === undefined) delete environment.NODE_ENV;
  else environment.NODE_ENV = originalMode;
}
console.log("Server timing logging checks passed.");

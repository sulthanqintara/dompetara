import "server-only";
import { consumeLimits } from "./consume-limits";
import { RequestLimitError } from "./request-limit-error";
import { logServerError } from "../log-server-error";

export const authRateStorage = {
  async consume(key: string, rule: { window: number; max: number }) {
    // Better Auth separates normalized IP and endpoint with '|'. Aggregate IP
    // and global limits also bound attempts spread across different endpoints.
    const separator = key.indexOf("|");
    const ip = separator < 0 ? "unknown" : key.slice(0, separator);
    try {
      const result = await consumeLimits([
      { key: `auth:endpoint:${key}`, windowMs: rule.window * 1_000, max: rule.max },
      { key: `auth:ip:${ip}`, windowMs: 60_000, max: 100 },
      { key: "auth:global", windowMs: 60_000, max: 600 },
      ]);
      return { allowed: result.allowed, retryAfter: result.allowed ? null : result.retryAfterSeconds };
    } catch (error) {
      logServerError({ provider: "postgres", stage: "authentication admission", status: 503 }, error);
      throw new RequestLimitError(503, 60);
    }
  },
};

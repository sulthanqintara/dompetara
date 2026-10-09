import "server-only";
import { consumeLimits } from "./consume-limits";
import { RequestLimitError } from "./request-limit-error";
import { logServerError } from "../log-server-error";

const limits = {
  "ledger-read": [120, 1_200],
  "ledger-write": [30, 300],
  preferences: [30, 300],
  "exchange-rates": [120, 1_200],
  "receipt-image": [60, 600],
  "receipt-intake": [10, 200],
} as const;

export async function enforceUserLimit(userId: string, scope: keyof typeof limits) {
  try {
    const [perUser, global] = limits[scope];
    const result = await consumeLimits([
      { key: `api:${scope}:user:${userId}`, windowMs: 60_000, max: perUser },
      { key: `api:${scope}:global`, windowMs: 60_000, max: global },
    ]);
    if (!result.allowed) throw new RequestLimitError(429, result.retryAfterSeconds);
  } catch (error) {
    if (error instanceof RequestLimitError) throw error;
    logServerError({ provider: "postgres", stage: "request admission", status: 503 }, error);
    throw new RequestLimitError(503, 60);
  }
}

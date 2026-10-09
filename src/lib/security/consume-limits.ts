import "server-only";
import { db } from "../db";
import { createDatabaseSecurityStore } from "./create-database-security-store.ts";
import { createSecurityLimiter } from "./create-security-limiter.ts";
import { getLimiterSecret } from "./get-limiter-secret.ts";
import type { LimitDecision, LimitRule } from "./security-limits.ts";

export async function consumeLimits(rules: LimitRule[]): Promise<LimitDecision> {
  return createSecurityLimiter(createDatabaseSecurityStore(db), getLimiterSecret()).consumeLimits(rules);
}

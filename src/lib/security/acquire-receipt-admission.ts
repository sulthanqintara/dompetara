import "server-only";
import { db } from "../db";
import { createDatabaseSecurityStore } from "./create-database-security-store.ts";
import { createSecurityLimiter } from "./create-security-limiter.ts";
import { getLimiterSecret } from "./get-limiter-secret.ts";
import { readReceiptLimitsConfig } from "./read-receipt-limits-config.ts";
import type { ReceiptAdmission } from "./security-limits.ts";

export async function acquireReceiptAdmission(userId: string): Promise<ReceiptAdmission> {
  return createSecurityLimiter(createDatabaseSecurityStore(db), getLimiterSecret())
    .acquireReceiptAdmission(userId, readReceiptLimitsConfig());
}

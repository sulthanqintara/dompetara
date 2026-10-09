import { z } from "zod";
import { receiptLimitsConfigSchema, type ReceiptLimitsConfig } from "./security-limits.ts";

export function readReceiptLimitsConfig(env: Readonly<Record<string, string | undefined>> = process.env): ReceiptLimitsConfig {
  const integer = z.string().regex(/^(0|[1-9]\d*)$/).transform(Number);
  const parsed = z.object({
    globalDailyLimit: integer,
    globalConcurrency: integer,
  }).pipe(receiptLimitsConfigSchema).safeParse({
    globalDailyLimit: env.RECEIPT_GLOBAL_DAILY_LIMIT ?? "100",
    globalConcurrency: env.RECEIPT_GLOBAL_CONCURRENCY ?? "3",
  });
  if (!parsed.success) throw new Error("Receipt admission configuration is invalid.");
  return parsed.data;
}

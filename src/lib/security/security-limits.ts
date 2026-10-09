import { z } from "zod";

export const limitRulesSchema = z.array(z.object({
  key: z.string().min(1).max(1024),
  windowMs: z.number().int().min(1000).max(86_400_000),
  max: z.number().int().min(0).max(1_000_000),
})).min(1).max(16);

export const receiptLimitsConfigSchema = z.object({
  globalDailyLimit: z.number().int().min(0).max(1_000_000),
  globalConcurrency: z.number().int().min(0).max(100),
});

export type LimitRule = z.infer<typeof limitRulesSchema>[number];
export type ReceiptLimitsConfig = z.infer<typeof receiptLimitsConfigSchema>;
export type LimitDecision = { allowed: boolean; retryAfterSeconds: number };
export type HashedLimitRule = Omit<LimitRule, "key"> & { keyHash: string };
export type LeaseRule = { scopeHash: string; max: number };
export type AdmissionRequest = {
  rules: HashedLimitRule[];
  lease?: { rules: LeaseRule[]; token: string; ttlMs: number };
};
export type LimitBucket = { keyHash: string; count: number; windowStartedAt: number };
export type AdmissionLease = { scopeHash: string; expiresAt: number };
export type SecurityLimitStore = {
  // Must atomically check every budget/lease and consume all of them or none.
  consume: (request: AdmissionRequest) => Promise<LimitDecision>;
  release: (token: string) => Promise<void>;
};
export type ReceiptAdmission =
  | { allowed: true; release: () => Promise<void> }
  | { allowed: false; retryAfterSeconds: number };

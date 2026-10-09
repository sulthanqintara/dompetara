import { randomUUID } from "node:crypto";
import { hashLimitKey } from "./hash-limit-key.ts";
import { limitRulesSchema, receiptLimitsConfigSchema, type HashedLimitRule, type LimitRule, type ReceiptAdmission, type ReceiptLimitsConfig, type SecurityLimitStore } from "./security-limits.ts";

export function createSecurityLimiter(store: SecurityLimitStore, secret: string) {
  // Validate even when a caller's policy disables admission.
  hashLimitKey("configuration-check", secret);
  const prepare = (rules: LimitRule[]): HashedLimitRule[] => {
    const parsed = limitRulesSchema.parse(rules);
    const hashed = parsed.map(({ key, ...rule }) => ({ ...rule, keyHash: hashLimitKey(`${key}\0window:${rule.windowMs}`, secret) }));
    if (new Set(hashed.map((rule) => rule.keyHash)).size !== hashed.length)
      throw new Error("Duplicate security limit rule.");
    return hashed;
  };
  return {
    consumeLimits(rules: LimitRule[]) {
      return store.consume({ rules: prepare(rules) });
    },
    async acquireReceiptAdmission(userId: string, rawConfig: ReceiptLimitsConfig): Promise<ReceiptAdmission> {
      if (!userId || userId.length > 1024) throw new Error("Invalid receipt admission identity.");
      const config = receiptLimitsConfigSchema.parse(rawConfig);
      const token = randomUUID();
      const decision = await store.consume({
        rules: prepare([
          { key: `receipt:user:${userId}:minute`, windowMs: 60_000, max: 5 },
          { key: `receipt:user:${userId}:day`, windowMs: 86_400_000, max: 30 },
          { key: "receipt:global:day", windowMs: 86_400_000, max: config.globalDailyLimit },
        ]),
        lease: { token, ttlMs: 90_000, rules: [
          { scopeHash: hashLimitKey(`receipt:user:${userId}:lease`, secret), max: 1 },
          { scopeHash: hashLimitKey("receipt:global:lease", secret), max: config.globalConcurrency },
        ] },
      });
      if (!decision.allowed) return { allowed: false, retryAfterSeconds: decision.retryAfterSeconds };
      return { allowed: true, release: () => store.release(token) };
    },
  };
}

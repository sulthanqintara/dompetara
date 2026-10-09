import type { AdmissionLease, AdmissionRequest, LimitBucket, LimitDecision } from "./security-limits.ts";

export function evaluateAdmission(request: AdmissionRequest, buckets: LimitBucket[], leases: AdmissionLease[], now: number): LimitDecision {
  let retryAfterSeconds = 0;
  const bucketMap = new Map(buckets.map((bucket) => [bucket.keyHash, bucket]));
  for (const rule of request.rules) {
    // Fixed windows are aligned to UTC epoch; replicas use the DB clock.
    const start = Math.floor(now / rule.windowMs) * rule.windowMs;
    const bucket = bucketMap.get(rule.keyHash);
    const count = bucket?.windowStartedAt === start ? bucket.count : 0;
    if (count >= rule.max)
      retryAfterSeconds = Math.max(retryAfterSeconds, Math.ceil((start + rule.windowMs - now) / 1000));
  }
  for (const rule of request.lease?.rules ?? []) {
    const active = leases.filter((lease) => lease.scopeHash === rule.scopeHash && lease.expiresAt > now)
      .sort((a, b) => a.expiresAt - b.expiresAt);
    if (rule.max === 0) retryAfterSeconds = Math.max(retryAfterSeconds, 90);
    else if (active.length >= rule.max)
      retryAfterSeconds = Math.max(retryAfterSeconds, Math.ceil((active[active.length - rule.max].expiresAt - now) / 1000));
  }
  return { allowed: retryAfterSeconds === 0, retryAfterSeconds };
}

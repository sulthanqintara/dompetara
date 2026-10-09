import { createHmac } from "node:crypto";

export function hashLimitKey(key: string, secret: string) {
  if (secret.length < 32) throw new Error("Security limiter configuration is invalid.");
  return createHmac("sha256", secret).update(`dompetara-security-v1\0${key}`).digest("hex");
}

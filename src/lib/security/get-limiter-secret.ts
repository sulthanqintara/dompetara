import "server-only";

export function getLimiterSecret(env: Readonly<Record<string, string | undefined>> = process.env) {
  const secret = env.SECURITY_LIMITER_SECRET || env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("Security limiter configuration is invalid.");
  return secret;
}

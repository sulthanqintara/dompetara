import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "./db";
import { logAuthError } from "./log-auth-error";
import { authRateStorage } from "./security/auth-rate-storage";
import { authPrivacyOptions } from "./auth-privacy/auth-privacy";
import { protectSessionAdapter } from "./auth-privacy/protect-session-adapter";

export const auth = betterAuth({
  ...authPrivacyOptions,
  logger: { log: logAuthError },
  user: { deleteUser: { enabled: true } },
  rateLimit: { enabled: true, customStorage: authRateStorage },
  advanced: {
    ipAddress: {
      // Vercel overwrites this header at its trusted ingress. Local development
      // uses Better Auth's localhost fallback rather than arbitrary forwarded IPs.
      ipAddressHeaders: ["x-vercel-forwarded-for"],
    },
  },
  database: protectSessionAdapter(drizzleAdapter(db, {
    provider: "pg",
    transaction: true,
  })),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      includeGrantedScopes: false,
    },
  },
});

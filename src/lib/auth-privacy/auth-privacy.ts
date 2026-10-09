import type { BetterAuthOptions } from "better-auth";

const discardGoogleCredentials = {
  accessToken: null,
  refreshToken: null,
  idToken: null,
  accessTokenExpiresAt: null,
  refreshTokenExpiresAt: null,
  scope: null,
};

// These hooks run for both first sign-in and subsequent profile/account updates.
export const authPrivacyOptions = {
  account: { storeStateStrategy: "cookie", storeAccountCookie: false, encryptOAuthTokens: true },
  session: {
    additionalFields: {
      tokenHash: { type: "string", required: false, input: false, returned: false },
    },
  },
  databaseHooks: {
    user: {
      create: { before: async () => ({ data: { image: null } }) },
      update: { before: async () => ({ data: { image: null } }) },
    },
    account: {
      create: { before: async () => ({ data: discardGoogleCredentials }) },
      update: { before: async () => ({ data: discardGoogleCredentials }) },
    },
    session: {
      create: { before: async () => ({ data: { ipAddress: null, userAgent: null } }) },
      update: { before: async () => ({ data: { ipAddress: null, userAgent: null } }) },
    },
  },
} satisfies BetterAuthOptions;

import { createHash, createHmac } from "node:crypto";
import { symmetricDecrypt, symmetricEncrypt } from "better-auth/crypto";
import { z } from "zod";

export function createSessionTokenCodec(rawSecret: unknown) {
  const secret = z.string().min(32).parse(rawSecret);
  const key = createHmac("sha256", secret).update("dompetara/session-storage/v1").digest("hex");
  const prefix = "dompetara-session-v1:";
  return {
    hash: (token: string) => createHash("sha256").update(token).digest("hex"),
    async encrypt(token: string) {
      return prefix + await symmetricEncrypt({ key, data: z.string().min(1).parse(token) });
    },
    async decrypt(token: string) {
      // Never silently accept legacy plaintext: the migration revokes it.
      if (!token.startsWith(prefix)) throw new Error("Unprotected session record.");
      return symmetricDecrypt({ key, data: token.slice(prefix.length) });
    },
  };
}

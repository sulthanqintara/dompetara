-- Revoke old plaintext sessions; every user must sign in again at cutover.
DELETE FROM "session";--> statement-breakpoint
UPDATE "user" SET "image" = NULL;--> statement-breakpoint
UPDATE "account" SET "access_token" = NULL, "refresh_token" = NULL,
  "id_token" = NULL, "access_token_expires_at" = NULL,
  "refresh_token_expires_at" = NULL, "scope" = NULL;--> statement-breakpoint
-- In-flight OAuth flows must restart using the encrypted state cookie.
DELETE FROM "verification";--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "token_hash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_token_hash_unique" UNIQUE("token_hash");

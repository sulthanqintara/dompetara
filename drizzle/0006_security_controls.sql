CREATE TABLE "security_admission_leases" (
	"scope_hash" text NOT NULL,
	"token" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "security_admission_leases_scope_hash_token_pk" PRIMARY KEY("scope_hash","token")
);
--> statement-breakpoint
ALTER TABLE "security_admission_leases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "security_limit_buckets" (
	"key_hash" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "security_limit_buckets_count_check" CHECK ("security_limit_buckets"."count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "security_limit_buckets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "security_admission_leases_expiry_idx" ON "security_admission_leases" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "security_limit_buckets_expiry_idx" ON "security_limit_buckets" USING btree ("expires_at");
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE public.security_limit_buckets, public.security_admission_leases FROM anon, authenticated;

CREATE TABLE "exchange_rate_cache" (
	"provider" text NOT NULL,
	"base_currency" text NOT NULL,
	"rate_date" date NOT NULL,
	"rates" jsonb NOT NULL,
	"etag" text,
	"last_checked_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "exchange_rate_cache_provider_base_currency_rate_date_pk" PRIMARY KEY("provider","base_currency","rate_date")
);
--> statement-breakpoint
ALTER TABLE "exchange_rate_cache" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON public.exchange_rate_cache FROM anon, authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON public.exchange_rate_cache TO service_role;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_cron;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

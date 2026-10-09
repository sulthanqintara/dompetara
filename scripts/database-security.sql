-- These app tables are accessed only through the authenticated application server.
REVOKE ALL PRIVILEGES ON TABLE
  public."user", public.session, public.account, public.verification,
  public.ledger, public.receipt_images, public.exchange_rate_cache,
  public.user_preferences, public.security_limit_buckets, public.security_admission_leases
FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.exchange_rate_cache TO service_role;

-- The reference-rate refresh job uses Supabase cron and HTTP extensions.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

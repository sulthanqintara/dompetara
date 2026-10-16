-- These app tables are accessed only through the authenticated application server.
REVOKE ALL PRIVILEGES ON TABLE
  public."user", public.session, public.account, public.verification,
  public.ledger, public.ledger_wallets, public.ledger_categories,
  public.ledger_transactions, public.ledger_receipt_imports, public.exchange_rate_cache,
  public.user_preferences, public.security_limit_buckets, public.security_admission_leases
FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.exchange_rate_cache TO service_role;

-- The reference-rate refresh job uses Supabase cron and HTTP extensions.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Reject writes from an older deployment after the explicit normalized cutover.
-- Updating the version remains allowed; the preserved JSON snapshot is immutable.
CREATE OR REPLACE FUNCTION public.prevent_legacy_ledger_writes()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF OLD.normalized AND NEW.data IS DISTINCT FROM OLD.data THEN
    RAISE EXCEPTION 'Normalized ledger cannot accept legacy document writes.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.prevent_legacy_ledger_writes() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS ledger_legacy_write_guard ON public.ledger;
CREATE TRIGGER ledger_legacy_write_guard BEFORE UPDATE OF data ON public.ledger
  FOR EACH ROW EXECUTE FUNCTION public.prevent_legacy_ledger_writes();

-- Invoker rights: only the app's database role can execute these functions.
-- All budget checks and writes share one statement/transaction and one network call.
CREATE OR REPLACE FUNCTION public.consume_security_limits(request jsonb)
RETURNS TABLE(allowed boolean, retry_after_seconds integer)
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE
  lock_id bigint;
  rule jsonb;
  now_ms bigint;
  window_start bigint;
  used bigint;
  active_count bigint;
  next_expiry timestamptz;
  retry_seconds integer := 0;
BEGIN
  PERFORM set_config('lock_timeout', '2000', true);
  -- Stable numeric ordering also covers hash collisions and absent bucket rows.
  FOR lock_id IN
    SELECT DISTINCT ('x' || substr(key, 1, 16))::bit(64)::bigint
    FROM (
      SELECT value->>'keyHash' AS key FROM jsonb_array_elements(request->'rules')
      UNION ALL
      SELECT value->>'scopeHash' FROM jsonb_array_elements(coalesce(request->'lease'->'rules', '[]'::jsonb))
    ) keys ORDER BY 1
  LOOP
    PERFORM pg_advisory_xact_lock(lock_id);
  END LOOP;
  now_ms := floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint;
  FOR rule IN SELECT value FROM jsonb_array_elements(request->'rules') LOOP
    window_start := (now_ms / (rule->>'windowMs')::bigint) * (rule->>'windowMs')::bigint;
    SELECT count INTO used FROM public.security_limit_buckets
      WHERE key_hash = rule->>'keyHash' AND window_started_at = to_timestamp(window_start / 1000.0)
      FOR UPDATE;
    IF coalesce(used, 0) >= (rule->>'max')::bigint THEN
      retry_seconds := greatest(retry_seconds, ceil((window_start + (rule->>'windowMs')::bigint - now_ms) / 1000.0)::integer);
    END IF;
  END LOOP;
  FOR rule IN SELECT value FROM jsonb_array_elements(coalesce(request->'lease'->'rules', '[]'::jsonb)) LOOP
    IF (rule->>'max')::integer = 0 THEN
      retry_seconds := greatest(retry_seconds, 90);
    ELSE
      SELECT count(*) INTO active_count FROM public.security_admission_leases
        WHERE scope_hash = rule->>'scopeHash' AND expires_at > to_timestamp(now_ms / 1000.0);
      IF active_count >= (rule->>'max')::integer THEN
        SELECT expires_at INTO next_expiry FROM public.security_admission_leases
          WHERE scope_hash = rule->>'scopeHash' AND expires_at > to_timestamp(now_ms / 1000.0)
          ORDER BY expires_at OFFSET (active_count - (rule->>'max')::integer) LIMIT 1;
        retry_seconds := greatest(retry_seconds, ceil(extract(epoch FROM next_expiry) - now_ms / 1000.0)::integer);
      END IF;
    END IF;
  END LOOP;
  IF retry_seconds > 0 THEN
    RETURN QUERY SELECT false, retry_seconds;
    RETURN;
  END IF;
  INSERT INTO public.security_limit_buckets AS bucket (key_hash, count, window_started_at, expires_at)
    SELECT value->>'keyHash', 1,
      to_timestamp((now_ms / (value->>'windowMs')::bigint * (value->>'windowMs')::bigint) / 1000.0),
      to_timestamp(((now_ms / (value->>'windowMs')::bigint + 1) * (value->>'windowMs')::bigint) / 1000.0)
    FROM jsonb_array_elements(request->'rules')
    ON CONFLICT (key_hash) DO UPDATE SET
      count = CASE WHEN bucket.window_started_at = excluded.window_started_at THEN bucket.count + 1 ELSE 1 END,
      window_started_at = excluded.window_started_at, expires_at = excluded.expires_at;
  IF request->'lease' IS NOT NULL THEN
    INSERT INTO public.security_admission_leases (scope_hash, token, expires_at)
      SELECT value->>'scopeHash', (request->'lease'->>'token')::uuid,
        to_timestamp((now_ms + (request->'lease'->>'ttlMs')::bigint) / 1000.0)
      FROM jsonb_array_elements(request->'lease'->'rules');
  END IF;
  RETURN QUERY SELECT true, 0;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_security_limits(jsonb) FROM PUBLIC, anon, authenticated;

-- Separate transaction: cleanup never holds expired-row locks while waiting for admission locks.
-- Remove the superseded no-argument helper, if present; the cron job calls the bounded integer signature.
DROP FUNCTION IF EXISTS public.cleanup_security_limits();
CREATE OR REPLACE FUNCTION public.cleanup_security_limits(batch_size integer DEFAULT 64)
RETURNS void LANGUAGE sql SET search_path = pg_catalog AS $$
  WITH expired_buckets AS (
    SELECT key_hash FROM public.security_limit_buckets WHERE expires_at <= clock_timestamp()
    ORDER BY expires_at LIMIT greatest(1, least(batch_size, 4096)) FOR UPDATE SKIP LOCKED
  ), removed_buckets AS (
    DELETE FROM public.security_limit_buckets b USING expired_buckets e WHERE b.key_hash = e.key_hash RETURNING b.key_hash
  ), expired_leases AS (
    SELECT scope_hash, token FROM public.security_admission_leases WHERE expires_at <= clock_timestamp()
    ORDER BY expires_at LIMIT greatest(1, least(batch_size, 4096)) FOR UPDATE SKIP LOCKED
  ), removed_leases AS (
    DELETE FROM public.security_admission_leases l USING expired_leases e
    WHERE l.scope_hash = e.scope_hash AND l.token = e.token RETURNING l.token
  ) SELECT NULL::void FROM (SELECT count(*) FROM removed_buckets) b, (SELECT count(*) FROM removed_leases) l;
$$;
REVOKE ALL ON FUNCTION public.cleanup_security_limits(integer) FROM PUBLIC, anon, authenticated;

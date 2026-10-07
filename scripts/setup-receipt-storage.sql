-- Run in the Supabase SQL editor after applying the app migrations.
-- No client storage policies: Better Auth ownership checks run on the app server.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('receipt-images', 'receipt-images', false, 4000000, ARRAY['image/jpeg'])
ON CONFLICT (id) DO UPDATE
SET public = false, file_size_limit = 4000000, allowed_mime_types = ARRAY['image/jpeg'];

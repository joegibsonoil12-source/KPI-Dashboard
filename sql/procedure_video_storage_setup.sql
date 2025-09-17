-- DB helpers for video playback (public URLs) and storage settings.
-- NOTE: this does NOT create buckets. Use the supplied shell script (or dashboard/CLI) to create buckets.

-- 1) Storage settings table (store your Supabase project URL + default bucket)
CREATE TABLE IF NOT EXISTS public.storage_settings (
  id serial PRIMARY KEY,
  project_url text,           -- e.g. https://your-project-ref.supabase.co
  default_bucket text DEFAULT 'videos',
  default_signed_url_ttl int DEFAULT 3600, -- seconds for signed URL TTL if used in app
  created_at timestamptz DEFAULT now()
);

-- Insert placeholder row if settings table is empty (user should update project_url to their project)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.storage_settings) THEN
    INSERT INTO public.storage_settings (project_url, default_bucket, default_signed_url_ttl)
    VALUES ('https://<your-project>.supabase.co', 'videos', 3600);
  END IF;
END$$;

-- 2) Helper function to compose public object URL for a public bucket
CREATE OR REPLACE FUNCTION public.get_public_video_url(video_path text, bucket_in text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  purl text;
  bucket_setting text;
  chosen_bucket text;
BEGIN
  SELECT project_url, default_bucket INTO purl, bucket_setting FROM public.storage_settings LIMIT 1;

  chosen_bucket := COALESCE(bucket_in, bucket_setting, 'videos');

  IF purl IS NULL OR trim(purl) = '' THEN
    RAISE NOTICE 'public.storage_settings.project_url not set. Set it to your Supabase project URL (https://<ref>.supabase.co)';
    RETURN NULL;
  END IF;

  -- Compose canonical public URL for Supabase Storage public objects:
  -- https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
  RETURN rtrim(purl, '/') || '/storage/v1/object/public/' || chosen_bucket || '/' || ltrim(video_path, '/');
END;
$$;

-- 3) View: expose procedure rows with computed public playable and original URLs (if project_url and bucket are set)
CREATE OR REPLACE VIEW public.procedures_with_video_urls AS
SELECT
  p.*,
  public.get_public_video_url(p.video_playable_path)  AS video_playable_public_url,
  public.get_public_video_url(p.video_original_path)  AS video_original_public_url
FROM public.procedures p;

-- 4) Optional: convenience function to update project_url and default_bucket
CREATE OR REPLACE FUNCTION public.set_storage_settings(new_project_url text, new_default_bucket text, new_ttl int DEFAULT 3600)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.storage_settings) THEN
    UPDATE public.storage_settings
    SET project_url = new_project_url,
        default_bucket = new_default_bucket,
        default_signed_url_ttl = new_ttl,
        created_at = now();
  ELSE
    INSERT INTO public.storage_settings (project_url, default_bucket, default_signed_url_ttl)
    VALUES (new_project_url, new_default_bucket, new_ttl);
  END IF;
END;
$$;

-- 5) Quick notes:
-- - After running this SQL, edit the storage_settings row to set project_url to "https://<your-project-ref>.supabase.co".
--   Example: SELECT public.set_storage_settings('https://abcd1234.supabase.co', 'videos', 3600);
-- - For private buckets you must still create signed URLs with the Storage API (service role key) — that cannot be done entirely in plain SQL safely.
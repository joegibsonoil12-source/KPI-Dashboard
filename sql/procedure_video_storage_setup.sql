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
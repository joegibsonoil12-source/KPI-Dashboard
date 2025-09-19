-- RLS policies for procedure_videos table
-- This migration enables Row Level Security and creates owner-based policies
-- Safe to run multiple times in development. Run in Supabase SQL editor.

-- 0) Ensure pgcrypto extension (for gen_random_uuid) is available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1) Create procedure_videos table if it doesn't exist
-- This table stores video attachments for procedures with ownership tracking
CREATE TABLE IF NOT EXISTS public.procedure_videos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  procedure_id uuid REFERENCES public.procedures(id) ON DELETE CASCADE,
  url text NOT NULL,
  owner uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 2) Add owner column if it doesn't exist (for existing tables)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'procedure_videos' 
      AND column_name = 'owner'
  ) THEN
    ALTER TABLE public.procedure_videos ADD COLUMN owner uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END$$;

-- 3) Enable RLS on public.procedure_videos (idempotent)
ALTER TABLE public.procedure_videos ENABLE ROW LEVEL SECURITY;

-- 4) Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "procedure_videos_insert_owner" ON public.procedure_videos;
DROP POLICY IF EXISTS "procedure_videos_select_authenticated" ON public.procedure_videos;
DROP POLICY IF EXISTS "procedure_videos_update_owner" ON public.procedure_videos;
DROP POLICY IF EXISTS "procedure_videos_delete_owner" ON public.procedure_videos;

-- 5) Create RLS policies

-- INSERT: Only authenticated users can insert and must set owner to their own ID
CREATE POLICY "procedure_videos_insert_owner" ON public.procedure_videos
  FOR INSERT 
  WITH CHECK (
    auth.role() = 'authenticated' 
    AND owner = auth.uid()
  );

-- SELECT: All authenticated users can read procedure videos
-- This allows users to view videos in procedures shared with them
CREATE POLICY "procedure_videos_select_authenticated" ON public.procedure_videos
  FOR SELECT 
  USING (auth.role() = 'authenticated');

-- UPDATE: Only owners can update their own video records
-- Must ensure owner field cannot be changed to someone else
CREATE POLICY "procedure_videos_update_owner" ON public.procedure_videos
  FOR UPDATE 
  USING (owner = auth.uid())
  WITH CHECK (owner = auth.uid());

-- DELETE: Only owners can delete their own video records
CREATE POLICY "procedure_videos_delete_owner" ON public.procedure_videos
  FOR DELETE 
  USING (owner = auth.uid());

-- 6) Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_procedure_videos_owner ON public.procedure_videos(owner);
CREATE INDEX IF NOT EXISTS idx_procedure_videos_procedure_id ON public.procedure_videos(procedure_id);
CREATE INDEX IF NOT EXISTS idx_procedure_videos_created_at ON public.procedure_videos(created_at);

-- 7) Create trigger for updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_procedure_videos_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER procedure_videos_updated_at
  BEFORE UPDATE ON public.procedure_videos
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_procedure_videos_updated_at();

-- 8) Verification query (run after migration to check)
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = 'procedure_videos';

/*
ROLLBACK SNIPPET - Run these commands to undo the changes if needed:

-- Drop policies
DROP POLICY IF EXISTS "procedure_videos_insert_owner" ON public.procedure_videos;
DROP POLICY IF EXISTS "procedure_videos_select_authenticated" ON public.procedure_videos;
DROP POLICY IF EXISTS "procedure_videos_update_owner" ON public.procedure_videos;
DROP POLICY IF EXISTS "procedure_videos_delete_owner" ON public.procedure_videos;

-- Disable RLS
ALTER TABLE public.procedure_videos DISABLE ROW LEVEL SECURITY;

-- Drop trigger and function
DROP TRIGGER IF EXISTS procedure_videos_updated_at ON public.procedure_videos;
DROP FUNCTION IF EXISTS public.handle_procedure_videos_updated_at();

-- Drop indexes
DROP INDEX IF EXISTS idx_procedure_videos_owner;
DROP INDEX IF EXISTS idx_procedure_videos_procedure_id;
DROP INDEX IF EXISTS idx_procedure_videos_created_at;

-- Note: Table and columns are not dropped in rollback to preserve data
*/
-- Create videos table with RLS policy for owners
-- This migration creates the videos table and sets up Row Level Security

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create videos table
CREATE TABLE IF NOT EXISTS public.videos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text,
  description text,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint,
  mime_type text,
  duration_seconds integer,
  width integer,
  height integer,
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- Create policies for owners
CREATE POLICY "videos_select_owner" ON public.videos
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "videos_insert_owner" ON public.videos  
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "videos_update_owner" ON public.videos
  FOR UPDATE USING (owner_id = auth.uid()) 
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "videos_delete_owner" ON public.videos
  FOR DELETE USING (owner_id = auth.uid());

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_videos_owner_id ON public.videos(owner_id);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON public.videos(created_at);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER videos_updated_at
  BEFORE UPDATE ON public.videos
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
-- db/migrations/20250916_add_procedures.sql
-- Migration: add procedures table and safe alters
-- Run this in Supabase SQL Editor or apply via your migration tooling.
-- Includes safe CREATE TABLE IF NOT EXISTS and ALTER TABLE ADD COLUMN IF NOT EXISTS
-- Also provides optional RLS policy snippets (commented) for private buckets.

-- 1) Create table if missing
create table if not exists public.procedures (
  id bigserial primary key,
  title text not null,
  body text,
  type text not null check (type in ('doc','video')),
  storage_bucket text default 'procedures', -- storage bucket name (default: procedures)
  storage_path text,                         -- path inside storage bucket (e.g. procedures/12345.mp4)
  public_url text,                           -- optional precomputed public URL (if bucket is public)
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

-- 2) If table already existed, ensure required columns exist (safe ALTERs)
alter table public.procedures
  add column if not exists title text not null,
  add column if not exists body text,
  add column if not exists type text not null default 'doc',
  add column if not exists storage_bucket text default 'procedures',
  add column if not exists storage_path text,
  add column if not exists public_url text,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists created_at timestamptz default now();

-- 3) Ensure a type check constraint exists
alter table public.procedures
  add constraint if not exists procedures_type_check check (type in ('doc','video'));

-- 4) Indexes to support common queries
create index if not exists procedures_created_at_idx on public.procedures (created_at desc);
create index if not exists procedures_created_by_idx on public.procedures (created_by);

-- 5) Optional: Row Level Security (RLS) snippets
-- NOTE: By default RLS is OFF. If you enable RLS, you must add policies matching your UX.
-- Example: allow any authenticated user to SELECT and INSERT, but only owners to DELETE.
-- Uncomment and adapt if you enable RLS on this table.

-- -- enable RLS
-- alter table public.procedures enable row level security;
-- 
-- -- Allow authenticated users to insert rows (and ensure created_by matches auth.uid())
-- create policy "Allow inserts for authenticated" on public.procedures
--   for insert
--   with check (auth.role() = 'authenticated' and (created_by is null or created_by = auth.uid()));
-- 
-- -- Allow select for everyone (change to created_by = auth.uid() for private per-user view)
-- create policy "Allow select (public)" on public.procedures
--   for select
--   using (true);
-- 
-- -- Allow owners to delete their own rows
-- create policy "Allow delete for owner" on public.procedures
--   for delete
--   using (created_by = auth.uid());

-- 6) Helpful notes:
-- - Create a Supabase Storage bucket named 'procedures' in the Supabase dashboard > Storage.
--   For public access: make the bucket public and use getPublicUrl() from the client.
--   For private access: keep the bucket private and use createSignedUrl() to generate temporary URLs.
-- - If you keep the bucket private and enable RLS, update client code to use signed URLs when rendering videos.
-- - If you want to track the uploader in the Procedures UI, the client should set created_by = auth.user().id when inserting (or rely on RLS to set it).

-- End of migration
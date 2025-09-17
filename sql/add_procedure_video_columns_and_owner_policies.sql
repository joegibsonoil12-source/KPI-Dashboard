-- Idempotent DB changes for procedure video support and owner-based RLS.
-- Safe to run multiple times in development. Run in Supabase SQL editor.

-- 0) Ensure pgcrypto (gen_random_uuid) is available
create extension if not exists "pgcrypto";

-- 1) Add video + ownership columns
alter table if exists public.procedures
  add column if not exists video_original_path text,
  add column if not exists video_playable_path text,
  add column if not exists video_mime text,
  add column if not exists video_uploaded_at timestamptz,
  add column if not exists owner_id uuid;

-- 2) Create helper function to set owner_id automatically on insert (if missing)
create or replace function public.set_procedure_owner()
returns trigger language plpgsql security definer as $$
begin
  -- If owner_id not provided, set it from auth.uid() when available
  if new.owner_id is null then
    if auth.uid() is not null then
      begin
        new.owner_id := auth.uid()::uuid;
      exception when others then
        -- if auth.uid() is not a uuid or cast fails, leave owner_id null
        new.owner_id := null;
      end;
    end if;
  end if;
  return new;
end;
$$;

-- 3) Create / recreate trigger (drop first if exists)
drop trigger if exists procedures_set_owner on public.procedures;
create trigger procedures_set_owner
before insert on public.procedures
for each row
execute function public.set_procedure_owner();

-- 4) Remove legacy permissive policies (if present) to avoid duplicates
do $$
begin
  if exists (select 1 from pg_policies where policyname = 'procedures_allow_authenticated_select' and tablename = 'procedures') then
    execute 'drop policy if exists procedures_allow_authenticated_select on public.procedures';
  end if;
  if exists (select 1 from pg_policies where policyname = 'procedures_allow_authenticated_insert' and tablename = 'procedures') then
    execute 'drop policy if exists procedures_allow_authenticated_insert on public.procedures';
  end if;
  if exists (select 1 from pg_policies where policyname = 'procedures_allow_authenticated_update' and tablename = 'procedures') then
    execute 'drop policy if exists procedures_allow_authenticated_update on public.procedures';
  end if;
  if exists (select 1 from pg_policies where policyname = 'procedures_allow_authenticated_delete' and tablename = 'procedures') then
    execute 'drop policy if exists procedures_allow_authenticated_delete on public.procedures';
  end if;
end$$;

-- 5) Enable RLS (idempotent)
alter table if exists public.procedures enable row level security;

-- 6) Create owner-based policies (wrapped in conditional DO blocks)
-- INSERT: only authenticated users can insert and must set owner_id to themselves (the trigger sets it if omitted)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'procedures' and policyname = 'procedures_insert_owner'
  ) then
    execute $sql$
      CREATE POLICY procedures_insert_owner
        ON public.procedures
        FOR INSERT
        WITH CHECK (owner_id = auth.uid()::uuid);
    $sql$;
  end if;
end$$;

-- SELECT: owners can select their rows
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'procedures' and policyname = 'procedures_select_owner'
  ) then
    execute $sql$
      CREATE POLICY procedures_select_owner
        ON public.procedures
        FOR SELECT
        USING (owner_id = auth.uid()::uuid);
    $sql$;
  end if;
end$$;

-- UPDATE: owners can update their rows; ensure owner_id remains the same
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'procedures' and policyname = 'procedures_update_owner'
  ) then
    execute $sql$
      CREATE POLICY procedures_update_owner
        ON public.procedures
        FOR UPDATE
        USING (owner_id = auth.uid()::uuid)
        WITH CHECK (owner_id = auth.uid()::uuid);
    $sql$;
  end if;
end$$;

-- DELETE: owners can delete their rows
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'procedures' and policyname = 'procedures_delete_owner'
  ) then
    execute $sql$
      CREATE POLICY procedures_delete_owner
        ON public.procedures
        FOR DELETE
        USING (owner_id = auth.uid()::uuid);
    $sql$;
  end if;
end$$;

-- 7) Add index to speed owner lookups
create index if not exists idx_procedures_owner on public.procedures(owner_id);

-- 8) Quick verification hints (you can run these separately after executing above)
-- select column_name, data_type, is_nullable from information_schema.columns where table_schema='public' and table_name='procedures' order by ordinal_position;
-- select policyname, schemaname, tablename, qual, with_check from pg_policies where schemaname='public' and tablename='procedures';
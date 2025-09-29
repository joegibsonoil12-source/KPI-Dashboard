-- Create procedure_attachments table for storing images/screenshots/files attached to procedures
-- Idempotent migration suitable for Supabase migrations folder.

create extension if not exists "pgcrypto";

-- Create attachments table
create table if not exists public.procedure_attachments (
  id uuid default gen_random_uuid() primary key,
  procedure_id uuid not null references public.procedures(id) on delete cascade,
  url text not null,
  filename text,
  mime_type text,
  owner uuid references auth.users(id) on delete set null,
  created_at timestamptz default now() not null
);

-- Enable RLS
alter table public.procedure_attachments enable row level security;

-- Policies: owner-based access
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'procedure_attachments' and policyname = 'proc_attach_select_owner') then
    execute $sql$
      create policy proc_attach_select_owner
        on public.procedure_attachments
        for select
        using (owner = auth.uid());
    $sql$;
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'procedure_attachments' and policyname = 'proc_attach_insert_owner') then
    execute $sql$
      create policy proc_attach_insert_owner
        on public.procedure_attachments
        for insert
        with check (owner = auth.uid());
    $sql$;
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'procedure_attachments' and policyname = 'proc_attach_update_owner') then
    execute $sql$
      create policy proc_attach_update_owner
        on public.procedure_attachments
        for update
        using (owner = auth.uid())
        with check (owner = auth.uid());
    $sql$;
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'procedure_attachments' and policyname = 'proc_attach_delete_owner') then
    execute $sql$
      create policy proc_attach_delete_owner
        on public.procedure_attachments
        for delete
        using (owner = auth.uid());
    $sql$;
  end if;
end$$;

-- Indexes
create index if not exists idx_proc_attach_procedure_id on public.procedure_attachments(procedure_id);
create index if not exists idx_proc_attach_owner on public.procedure_attachments(owner);
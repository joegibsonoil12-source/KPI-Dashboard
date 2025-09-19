-- Procedure Videos RLS migration (idempotent)
-- Adds owner column, enables RLS, and creates policies that allow:
--  - authenticated inserts when owner = auth.uid() OR the user is the parent procedure's created_by
--  - authenticated selects
--  - owner/parent-owner updates and deletes
-- Rollback snippet at bottom (commented).

-- 1) Ensure owner column exists
ALTER TABLE public.procedure_videos
  ADD COLUMN IF NOT EXISTS owner uuid;

-- 2) Enable row level security
ALTER TABLE public.procedure_videos ENABLE ROW LEVEL SECURITY;

-- 3) Revoke broad rights (optional, for clarity)
REVOKE ALL ON public.procedure_videos FROM public;

-- 4) Drop potentially conflicting/old policies
DROP POLICY IF EXISTS procedure_videos_insert ON public.procedure_videos;
DROP POLICY IF EXISTS procedure_videos_delete ON public.procedure_videos;
DROP POLICY IF EXISTS procedure_videos_read ON public.procedure_videos;
DROP POLICY IF EXISTS "Insert own procedure_videos" ON public.procedure_videos;
DROP POLICY IF EXISTS "Select for authenticated" ON public.procedure_videos;
DROP POLICY IF EXISTS "Owner modify" ON public.procedure_videos;
DROP POLICY IF EXISTS "Update own procedure_videos" ON public.procedure_videos;
DROP POLICY IF EXISTS "Delete own procedure_videos" ON public.procedure_videos;
DROP POLICY IF EXISTS "Modify own procedure_videos" ON public.procedure_videos;

-- 5) INSERT policy
CREATE POLICY IF NOT EXISTS "Insert own procedure_videos" ON public.procedure_videos
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND (
      owner = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.procedures p
        WHERE p.id = procedure_videos.procedure_id
          AND p.created_by = auth.uid()
      )
    )
  );

-- 6) SELECT policy: authenticated users can read (tweak if you need stricter rules)
CREATE POLICY IF NOT EXISTS "Select for authenticated" ON public.procedure_videos
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- 7) UPDATE policy: owner or parent procedure creator can update
CREATE POLICY IF NOT EXISTS "Update own procedure_videos" ON public.procedure_videos
  FOR UPDATE
  USING (
    owner = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.procedures p
      WHERE p.id = procedure_videos.procedure_id
        AND p.created_by = auth.uid()
    )
  )
  WITH CHECK (
    owner = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.procedures p
      WHERE p.id = procedure_videos.procedure_id
        AND p.created_by = auth.uid()
    )
  );

-- 8) DELETE policy: owner or parent procedure creator can delete
CREATE POLICY IF NOT EXISTS "Delete own procedure_videos" ON public.procedure_videos
  FOR DELETE
  USING (
    owner = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.procedures p
      WHERE p.id = procedure_videos.procedure_id
        AND p.created_by = auth.uid()
    )
  );

-- Optional rollback snippet (comments only)
-- DROP POLICY IF EXISTS "Insert own procedure_videos" ON public.procedure_videos;
-- DROP POLICY IF EXISTS "Select for authenticated" ON public.procedure_videos;
-- DROP POLICY IF EXISTS "Update own procedure_videos" ON public.procedure_videos;
-- DROP POLICY IF EXISTS "Delete own procedure_videos" ON public.procedure_videos;
-- ALTER TABLE public.procedure_videos DISABLE ROW LEVEL SECURITY;

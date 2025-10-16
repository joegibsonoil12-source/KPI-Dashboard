-- Migration: Admin/Manager Delete Policies for Delivery Tickets and Attachments
-- Date: 2025-10-16
-- Safe to run multiple times (idempotent). Run in Supabase SQL editor.
-- NO destructive operations - all DDL is additive only.
--
-- Purpose: Allow users with admin or manager roles to delete any delivery ticket
-- and its associated attachments, even if they are not the owner. This enables
-- proper administrative control while CASCADE delete functionality remains intact.

-- ============================================================================
-- 1) Create admin/manager delete policy for delivery_tickets
-- ============================================================================

-- DELETE: Admin and manager can delete any ticket (not just their own)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' 
      AND tablename = 'delivery_tickets' 
      AND policyname = 'delivery_tickets_delete_admin'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY delivery_tickets_delete_admin
        ON public.delivery_tickets
        FOR DELETE
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.app_roles r
            WHERE r.user_id = auth.uid()
              AND r.role IN ('admin', 'manager')
          )
        );
    $sql$;
  END IF;
END$$;

-- ============================================================================
-- 2) Create admin/manager delete policy for ticket_attachments
-- ============================================================================

-- DELETE: Admin and manager can delete any attachment (not just their own)
-- This is critical for CASCADE delete to work when admin/manager deletes a ticket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' 
      AND tablename = 'ticket_attachments' 
      AND policyname = 'ticket_attachments_delete_admin'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY ticket_attachments_delete_admin
        ON public.ticket_attachments
        FOR DELETE
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.app_roles r
            WHERE r.user_id = auth.uid()
              AND r.role IN ('admin', 'manager')
          )
        );
    $sql$;
  END IF;
END$$;

-- ============================================================================
-- 3) Verification queries (run separately to verify setup)
-- ============================================================================

-- Verify the new policies exist:
-- SELECT schemaname, tablename, policyname, cmd, qual
-- FROM pg_policies 
-- WHERE schemaname = 'public' 
--   AND tablename IN ('delivery_tickets', 'ticket_attachments')
--   AND policyname LIKE '%_admin'
-- ORDER BY tablename, policyname;

-- Count all policies for these tables:
-- SELECT tablename, COUNT(*) as policy_count
-- FROM pg_policies 
-- WHERE schemaname = 'public' 
--   AND tablename IN ('delivery_tickets', 'ticket_attachments')
-- GROUP BY tablename;

-- ============================================================================
-- NOTES:
-- ============================================================================
-- 1. These policies are ADDITIVE - they work alongside existing owner policies
-- 2. Non-admin users retain their existing delete restrictions (owner-only)
-- 3. Admin/manager delete capability applies to BOTH tables for CASCADE compatibility
-- 4. The app_roles table must exist and be properly populated with admin/manager roles
-- 5. This migration is safe to run multiple times (idempotent)

-- Verification Script for Admin Delete Policy Migration
-- Run this after applying 2025-10-16_delivery_tickets_admin_delete_policy.sql
-- to verify the policies were created successfully

-- ============================================================================
-- 1. Check that the admin delete policies exist
-- ============================================================================
SELECT 
  'Admin Delete Policies Check' AS test_name,
  COUNT(*) AS policies_found,
  CASE 
    WHEN COUNT(*) = 2 THEN '✓ PASS: Both policies exist'
    ELSE '✗ FAIL: Expected 2 policies, found ' || COUNT(*)
  END AS result
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('delivery_tickets', 'ticket_attachments')
  AND policyname IN ('delivery_tickets_delete_admin', 'ticket_attachments_delete_admin');

-- ============================================================================
-- 2. List all delete policies for delivery_tickets
-- ============================================================================
SELECT 
  'delivery_tickets DELETE Policies' AS table_name,
  policyname,
  CASE 
    WHEN policyname = 'delivery_tickets_delete_owner' THEN 'Owner-only delete'
    WHEN policyname = 'delivery_tickets_delete_admin' THEN 'Admin/Manager delete'
    ELSE 'Other policy'
  END AS description
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'delivery_tickets'
  AND cmd = 'DELETE'
ORDER BY policyname;

-- ============================================================================
-- 3. List all delete policies for ticket_attachments
-- ============================================================================
SELECT 
  'ticket_attachments DELETE Policies' AS table_name,
  policyname,
  CASE 
    WHEN policyname = 'ticket_attachments_delete_owner' THEN 'Owner-only delete'
    WHEN policyname = 'ticket_attachments_delete_admin' THEN 'Admin/Manager delete'
    ELSE 'Other policy'
  END AS description
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'ticket_attachments'
  AND cmd = 'DELETE'
ORDER BY policyname;

-- ============================================================================
-- 4. Verify app_roles table exists (prerequisite)
-- ============================================================================
SELECT 
  'app_roles table check' AS test_name,
  CASE 
    WHEN COUNT(*) > 0 THEN '✓ PASS: app_roles table exists'
    ELSE '✗ FAIL: app_roles table not found - run 2025-10-16_safe_roles_permissions_extension.sql first'
  END AS result
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'app_roles';

-- ============================================================================
-- 5. Check for users with admin or manager roles
-- ============================================================================
SELECT 
  'Admin/Manager Users' AS check_name,
  COUNT(*) AS user_count,
  array_agg(role) AS roles_present
FROM public.app_roles 
WHERE role IN ('admin', 'manager');

-- ============================================================================
-- 6. Summary of all policies on delivery_tickets
-- ============================================================================
SELECT 
  tablename,
  cmd AS operation,
  COUNT(*) AS policy_count
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('delivery_tickets', 'ticket_attachments')
GROUP BY tablename, cmd
ORDER BY tablename, cmd;

-- ============================================================================
-- EXPECTED RESULTS:
-- ============================================================================
-- Test 1: Should show 2 policies found with PASS message
-- Test 2: Should show 2 DELETE policies for delivery_tickets:
--   - delivery_tickets_delete_owner (Owner-only delete)
--   - delivery_tickets_delete_admin (Admin/Manager delete)
-- Test 3: Should show 2 DELETE policies for ticket_attachments:
--   - ticket_attachments_delete_owner (Owner-only delete)
--   - ticket_attachments_delete_admin (Admin/Manager delete)
-- Test 4: Should show PASS message indicating app_roles table exists
-- Test 5: Should show count of users with admin/manager roles (may be 0 initially)
-- Test 6: Should show policy counts for each operation type (SELECT, INSERT, UPDATE, DELETE)

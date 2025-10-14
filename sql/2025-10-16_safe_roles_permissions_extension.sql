-- Migration: Safe Roles, Permissions, and Fuel Budgets Extension
-- Date: 2025-10-16
-- Safe to run multiple times (idempotent). Run in Supabase SQL editor.
-- NO destructive operations - all DDL is additive only.

-- ============================================================================
-- 0) Enable required extensions
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1) Create app_roles table (if not exists)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.app_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'manager', 'editor', 'viewer')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- ============================================================================
-- 2) Create audit_log table (if not exists)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz DEFAULT now() NOT NULL
);

-- ============================================================================
-- 3) Create audit trigger function (if not exists)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.audit_tickets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (table_name, record_id, action, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (table_name, record_id, action, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (table_name, record_id, action, old_data, changed_by)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- ============================================================================
-- 4) Attach audit triggers to delivery_tickets (only if not present)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'audit_delivery_tickets_insert' 
    AND tgrelid = 'public.delivery_tickets'::regclass
  ) THEN
    CREATE TRIGGER audit_delivery_tickets_insert
      AFTER INSERT ON public.delivery_tickets
      FOR EACH ROW
      EXECUTE FUNCTION public.audit_tickets();
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'audit_delivery_tickets_update' 
    AND tgrelid = 'public.delivery_tickets'::regclass
  ) THEN
    CREATE TRIGGER audit_delivery_tickets_update
      AFTER UPDATE ON public.delivery_tickets
      FOR EACH ROW
      EXECUTE FUNCTION public.audit_tickets();
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'audit_delivery_tickets_delete' 
    AND tgrelid = 'public.delivery_tickets'::regclass
  ) THEN
    CREATE TRIGGER audit_delivery_tickets_delete
      AFTER DELETE ON public.delivery_tickets
      FOR EACH ROW
      EXECUTE FUNCTION public.audit_tickets();
  END IF;
END$$;

-- ============================================================================
-- 5) Create dim_product table (if not exists)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.dim_product (
  product_id serial PRIMARY KEY,
  product_name text UNIQUE NOT NULL,
  category text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- ============================================================================
-- 6) Seed baseline products (idempotent with ON CONFLICT)
-- ============================================================================
INSERT INTO public.dim_product (product_name, category)
VALUES 
  ('PROPANE', 'fuel'),
  ('OFF_DIESEL', 'fuel'),
  ('HWY_DIESEL', 'fuel'),
  ('FUEL_OIL_2', 'fuel'),
  ('UNLEADED', 'fuel')
ON CONFLICT (product_name) DO NOTHING;

-- ============================================================================
-- 7) Create mapping_ticket_product table (if not exists)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.mapping_ticket_product (
  id serial PRIMARY KEY,
  raw_product text NOT NULL,
  product_id integer REFERENCES public.dim_product(product_id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(raw_product)
);

-- ============================================================================
-- 8) Create views for normalized products and metrics
-- ============================================================================

-- View: ticket_products_normalized
CREATE OR REPLACE VIEW public.ticket_products_normalized AS
SELECT 
  dt.id,
  dt.date,
  dt.store,
  dt.product AS raw_product,
  COALESCE(dp.product_name, dt.product) AS normalized_product,
  dt.driver,
  dt.truck,
  dt.qty,
  dt.price,
  dt.tax,
  dt.amount,
  dt.status,
  dt.notes,
  dt.customerName,
  dt.account,
  dt.created_by,
  dt.created_at,
  dt.updated_at
FROM public.delivery_tickets dt
LEFT JOIN public.mapping_ticket_product mtp ON dt.product = mtp.raw_product
LEFT JOIN public.dim_product dp ON mtp.product_id = dp.product_id;

-- View: view_ticket_metrics_monthly
CREATE OR REPLACE VIEW public.view_ticket_metrics_monthly AS
SELECT 
  date_trunc('month', date) AS month,
  store,
  normalized_product AS product,
  COUNT(*) AS ticket_count,
  SUM(qty) AS total_qty,
  SUM(amount) AS total_amount
FROM public.ticket_products_normalized
WHERE date IS NOT NULL
GROUP BY date_trunc('month', date), store, normalized_product;

-- ============================================================================
-- 9) Create fuel_budgets table (if not exists) with RLS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.fuel_budgets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  month date NOT NULL,
  store text NOT NULL,
  product text NOT NULL,
  budget_qty numeric NOT NULL,
  budget_amount numeric NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(month, store, product)
);

-- Enable RLS on fuel_budgets (non-destructive)
ALTER TABLE public.fuel_budgets ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 10) Create RLS policies for fuel_budgets (only if absent)
-- ============================================================================

-- SELECT: All authenticated users can view budgets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' 
      AND tablename = 'fuel_budgets' 
      AND policyname = 'fuel_budgets_select_all'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY fuel_budgets_select_all
        ON public.fuel_budgets
        FOR SELECT
        TO authenticated
        USING (true);
    $sql$;
  END IF;
END$$;

-- INSERT: Only admin and manager can insert budgets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' 
      AND tablename = 'fuel_budgets' 
      AND policyname = 'fuel_budgets_insert_admin_manager'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY fuel_budgets_insert_admin_manager
        ON public.fuel_budgets
        FOR INSERT
        TO authenticated
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.app_roles
            WHERE user_id = auth.uid()
              AND role IN ('admin', 'manager')
          )
        );
    $sql$;
  END IF;
END$$;

-- UPDATE: Admin, manager, or owner can update
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' 
      AND tablename = 'fuel_budgets' 
      AND policyname = 'fuel_budgets_update_admin_manager_or_owner'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY fuel_budgets_update_admin_manager_or_owner
        ON public.fuel_budgets
        FOR UPDATE
        TO authenticated
        USING (
          created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.app_roles
            WHERE user_id = auth.uid()
              AND role IN ('admin', 'manager')
          )
        );
    $sql$;
  END IF;
END$$;

-- DELETE: Only admin can delete budgets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' 
      AND tablename = 'fuel_budgets' 
      AND policyname = 'fuel_budgets_delete_admin'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY fuel_budgets_delete_admin
        ON public.fuel_budgets
        FOR DELETE
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.app_roles
            WHERE user_id = auth.uid()
              AND role = 'admin'
          )
        );
    $sql$;
  END IF;
END$$;

-- ============================================================================
-- 11) Add role-based RLS policies for delivery_tickets (only if absent)
-- ============================================================================

-- Enable RLS on delivery_tickets (if not already enabled - non-destructive)
ALTER TABLE public.delivery_tickets ENABLE ROW LEVEL SECURITY;

-- SELECT: All authenticated users can view tickets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' 
      AND tablename = 'delivery_tickets' 
      AND policyname = 'dt_select_all'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY dt_select_all
        ON public.delivery_tickets
        FOR SELECT
        TO authenticated
        USING (true);
    $sql$;
  END IF;
END$$;

-- INSERT: Role-based insert (admin, manager, editor)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' 
      AND tablename = 'delivery_tickets' 
      AND policyname = 'dt_insert_role_based'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY dt_insert_role_based
        ON public.delivery_tickets
        FOR INSERT
        TO authenticated
        WITH CHECK (
          created_by = auth.uid()
          AND (
            NOT EXISTS (SELECT 1 FROM public.app_roles WHERE user_id = auth.uid())
            OR EXISTS (
              SELECT 1 FROM public.app_roles
              WHERE user_id = auth.uid()
                AND role IN ('admin', 'manager', 'editor')
            )
          )
        );
    $sql$;
  END IF;
END$$;

-- UPDATE: Role-based or owner can update
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' 
      AND tablename = 'delivery_tickets' 
      AND policyname = 'dt_update_role_or_owner'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY dt_update_role_or_owner
        ON public.delivery_tickets
        FOR UPDATE
        TO authenticated
        USING (
          created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.app_roles
            WHERE user_id = auth.uid()
              AND role IN ('admin', 'manager', 'editor')
          )
        );
    $sql$;
  END IF;
END$$;

-- DELETE: Admin and manager can delete
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' 
      AND tablename = 'delivery_tickets' 
      AND policyname = 'dt_delete_admin_manager'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY dt_delete_admin_manager
        ON public.delivery_tickets
        FOR DELETE
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.app_roles
            WHERE user_id = auth.uid()
              AND role IN ('admin', 'manager')
          )
        );
    $sql$;
  END IF;
END$$;

-- ============================================================================
-- 12) Create fuel_budget_vs_actual view
-- ============================================================================
CREATE OR REPLACE VIEW public.fuel_budget_vs_actual AS
SELECT
  b.month,
  b.store,
  b.product,
  b.budget_qty,
  b.budget_amount,
  COALESCE(m.total_qty, 0) AS actual_qty,
  COALESCE(m.total_amount, 0) AS actual_amount,
  (COALESCE(m.total_qty, 0) - b.budget_qty) AS variance_qty,
  (COALESCE(m.total_amount, 0) - b.budget_amount) AS variance_amount,
  CASE 
    WHEN b.budget_qty > 0 THEN 
      ROUND(((COALESCE(m.total_qty, 0) - b.budget_qty) / b.budget_qty * 100), 2)
    ELSE 0
  END AS variance_qty_pct,
  CASE 
    WHEN b.budget_amount > 0 THEN 
      ROUND(((COALESCE(m.total_amount, 0) - b.budget_amount) / b.budget_amount * 100), 2)
    ELSE 0
  END AS variance_amount_pct
FROM public.fuel_budgets b
LEFT JOIN public.view_ticket_metrics_monthly m 
  ON b.month = m.month 
  AND b.store = m.store 
  AND b.product = m.product;

-- ============================================================================
-- 13) Create system_health_summary() function (only if absent)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'system_health_summary'
      AND pg_get_function_identity_arguments(oid) = ''
  ) THEN
    EXECUTE $sql$
      CREATE FUNCTION public.system_health_summary()
      RETURNS jsonb
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $func$
      DECLARE
        result jsonb;
      BEGIN
        SELECT jsonb_build_object(
          'timestamp', now(),
          'tables', jsonb_build_object(
            'app_roles', (SELECT COUNT(*) FROM public.app_roles),
            'audit_log', (SELECT COUNT(*) FROM public.audit_log),
            'delivery_tickets', (SELECT COUNT(*) FROM public.delivery_tickets),
            'dim_product', (SELECT COUNT(*) FROM public.dim_product),
            'mapping_ticket_product', (SELECT COUNT(*) FROM public.mapping_ticket_product),
            'fuel_budgets', (SELECT COUNT(*) FROM public.fuel_budgets)
          ),
          'views', jsonb_build_object(
            'ticket_products_normalized', true,
            'view_ticket_metrics_monthly', true,
            'fuel_budget_vs_actual', true
          ),
          'rls_enabled', jsonb_build_object(
            'delivery_tickets', (SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='delivery_tickets'),
            'fuel_budgets', (SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='fuel_budgets')
          ),
          'policies', jsonb_build_object(
            'delivery_tickets', (SELECT COUNT(*) FROM pg_policies WHERE schemaname='public' AND tablename='delivery_tickets'),
            'fuel_budgets', (SELECT COUNT(*) FROM pg_policies WHERE schemaname='public' AND tablename='fuel_budgets')
          ),
          'triggers', jsonb_build_object(
            'audit_triggers', (
              SELECT COUNT(*) FROM pg_trigger 
              WHERE tgrelid = 'public.delivery_tickets'::regclass 
              AND tgname LIKE 'audit_%'
            )
          )
        ) INTO result;
        RETURN result;
      END;
      $func$;
    $sql$;
  END IF;
END$$;

-- ============================================================================
-- 14) Create indexes for performance (if not exists)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON public.audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_record_id ON public.audit_log(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at ON public.audit_log(changed_at);
CREATE INDEX IF NOT EXISTS idx_fuel_budgets_month ON public.fuel_budgets(month);
CREATE INDEX IF NOT EXISTS idx_fuel_budgets_store ON public.fuel_budgets(store);
CREATE INDEX IF NOT EXISTS idx_fuel_budgets_product ON public.fuel_budgets(product);

-- ============================================================================
-- Verification queries (run separately to verify setup)
-- ============================================================================
-- To verify the migration was successful, run:
-- SELECT system_health_summary();
--
-- Expected output includes counts for all tables, views status, RLS status,
-- and policy counts.

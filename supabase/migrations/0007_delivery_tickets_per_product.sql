-- Create per-product aggregated view for delivery tickets
-- Shows total gallons, revenue, and ticket count per product over the last 365 days

CREATE OR REPLACE VIEW public.delivery_tickets_per_product AS
SELECT
  COALESCE(product, 'UNKNOWN') AS product,
  COUNT(*)::int AS ticket_count,
  SUM(COALESCE(qty, 0))::numeric AS total_gallons,
  SUM(COALESCE(amount, 0))::numeric AS revenue
FROM public.delivery_tickets
WHERE 
  date >= NOW()::date - INTERVAL '365 days'
  AND (status IS NULL OR (status NOT ILIKE '%void%' AND status NOT ILIKE '%cancel%'))
GROUP BY product
ORDER BY revenue DESC;

-- Grant read permissions to authenticated and anon users
GRANT SELECT ON public.delivery_tickets_per_product TO authenticated;
GRANT SELECT ON public.delivery_tickets_per_product TO anon;

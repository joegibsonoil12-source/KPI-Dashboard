-- KPI Views for Gibson Oil & Gas Dashboard
-- ========================================
-- Creates materialized views for key performance indicators

-- Revenue Month-to-Date
CREATE OR REPLACE VIEW revenue_mtd AS
SELECT 
    COALESCE(SUM(total_amount), 0) as revenue,
    COUNT(*) as invoice_count,
    DATE_TRUNC('month', CURRENT_DATE) as period_start,
    CURRENT_DATE as period_end
FROM invoices 
WHERE invoice_date >= DATE_TRUNC('month', CURRENT_DATE)
    AND invoice_date <= CURRENT_DATE
    AND status IN ('paid', 'partial');

-- Revenue Year-to-Date  
CREATE OR REPLACE VIEW revenue_ytd AS
SELECT 
    COALESCE(SUM(total_amount), 0) as revenue,
    COUNT(*) as invoice_count,
    DATE_TRUNC('year', CURRENT_DATE) as period_start,
    CURRENT_DATE as period_end
FROM invoices 
WHERE invoice_date >= DATE_TRUNC('year', CURRENT_DATE)
    AND invoice_date <= CURRENT_DATE
    AND status IN ('paid', 'partial');

-- Average Order Value Month-to-Date
CREATE OR REPLACE VIEW avg_order_value_mtd AS
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN ROUND(SUM(total_amount) / COUNT(*), 2)
        ELSE 0 
    END as avg_order_value,
    COUNT(*) as order_count,
    COALESCE(SUM(total_amount), 0) as total_revenue
FROM invoices 
WHERE invoice_date >= DATE_TRUNC('month', CURRENT_DATE)
    AND invoice_date <= CURRENT_DATE
    AND status IN ('paid', 'partial');

-- Gallons Sold Month-to-Date
CREATE OR REPLACE VIEW gallons_sold_mtd AS
SELECT 
    COALESCE(SUM(d.gallons_delivered), 0) as gallons_sold,
    COUNT(*) as delivery_count,
    COALESCE(AVG(d.gallons_delivered), 0) as avg_gallons_per_delivery
FROM deliveries d
WHERE d.delivery_date >= DATE_TRUNC('month', CURRENT_DATE)
    AND d.delivery_date <= CURRENT_DATE
    AND d.status = 'delivered';

-- Deliveries On-Time Percentage Month-to-Date
CREATE OR REPLACE VIEW deliveries_on_time_pct_mtd AS
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN 
            ROUND(
                (COUNT(*) FILTER (WHERE DATE(delivery_date) <= scheduled_date) * 100.0) / COUNT(*), 
                2
            )
        ELSE 0 
    END as on_time_percentage,
    COUNT(*) FILTER (WHERE DATE(delivery_date) <= scheduled_date) as on_time_deliveries,
    COUNT(*) as total_deliveries
FROM deliveries 
WHERE delivery_date >= DATE_TRUNC('month', CURRENT_DATE)
    AND delivery_date <= CURRENT_DATE
    AND status = 'delivered';

-- Cost Per Delivery Month-to-Date (simplified calculation)
CREATE OR REPLACE VIEW cost_per_delivery_mtd AS
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN 
            ROUND(COALESCE(SUM(e.amount), 0) / COUNT(d.*), 2)
        ELSE 0 
    END as cost_per_delivery,
    COUNT(d.*) as delivery_count,
    COALESCE(SUM(e.amount), 0) as total_delivery_costs
FROM deliveries d
LEFT JOIN expenses e ON e.expense_date >= DATE_TRUNC('month', CURRENT_DATE) 
    AND e.expense_date <= CURRENT_DATE
    AND e.category ILIKE '%delivery%'
WHERE d.delivery_date >= DATE_TRUNC('month', CURRENT_DATE)
    AND d.delivery_date <= CURRENT_DATE
    AND d.status = 'delivered';

-- Outstanding Receivables
CREATE OR REPLACE VIEW outstanding_receivables AS
SELECT 
    COALESCE(SUM(i.total_amount - COALESCE(p.paid_amount, 0)), 0) as outstanding_amount,
    COUNT(*) as outstanding_invoices,
    COALESCE(AVG(CURRENT_DATE - i.due_date), 0) as avg_days_overdue
FROM invoices i
LEFT JOIN (
    SELECT 
        invoice_id, 
        SUM(amount) as paid_amount 
    FROM payments 
    GROUP BY invoice_id
) p ON i.id = p.invoice_id
WHERE i.status IN ('sent', 'partial', 'overdue')
    AND (i.total_amount - COALESCE(p.paid_amount, 0)) > 0;

-- Average Daily Sales Last 90 Days
CREATE OR REPLACE VIEW avg_daily_sales_90 AS
SELECT 
    CASE 
        WHEN COUNT(DISTINCT DATE(invoice_date)) > 0 THEN 
            ROUND(COALESCE(SUM(total_amount), 0) / COUNT(DISTINCT DATE(invoice_date)), 2)
        ELSE 0 
    END as avg_daily_sales,
    COALESCE(SUM(total_amount), 0) as total_sales_90_days,
    COUNT(DISTINCT DATE(invoice_date)) as active_sales_days
FROM invoices 
WHERE invoice_date >= CURRENT_DATE - INTERVAL '90 days'
    AND status IN ('paid', 'partial');

-- Gross Margin Month-to-Date (simplified calculation)
CREATE OR REPLACE VIEW gross_margin_mtd AS
SELECT 
    COALESCE(SUM(i.total_amount), 0) as revenue,
    COALESCE(SUM(d.gallons_delivered * p.base_price * 0.7), 0) as estimated_costs,
    COALESCE(SUM(i.total_amount) - SUM(d.gallons_delivered * p.base_price * 0.7), 0) as gross_profit,
    CASE 
        WHEN SUM(i.total_amount) > 0 THEN 
            ROUND(((SUM(i.total_amount) - SUM(d.gallons_delivered * p.base_price * 0.7)) / SUM(i.total_amount)) * 100, 2)
        ELSE 0 
    END as gross_margin_percentage
FROM invoices i
JOIN invoice_items ii ON i.id = ii.invoice_id
LEFT JOIN deliveries d ON ii.delivery_id = d.id
LEFT JOIN products p ON d.product_id = p.id
WHERE i.invoice_date >= DATE_TRUNC('month', CURRENT_DATE)
    AND i.invoice_date <= CURRENT_DATE
    AND i.status IN ('paid', 'partial');

-- Revenue by City Month-to-Date
CREATE OR REPLACE VIEW revenue_by_city_mtd AS
SELECT 
    a.city,
    a.state,
    COALESCE(SUM(i.total_amount), 0) as revenue,
    COUNT(*) as invoice_count,
    COALESCE(AVG(i.total_amount), 0) as avg_invoice_amount
FROM invoices i
JOIN customers c ON i.customer_id = c.id
JOIN addresses a ON c.id = a.customer_id AND a.address_type = 'service'
WHERE i.invoice_date >= DATE_TRUNC('month', CURRENT_DATE)
    AND i.invoice_date <= CURRENT_DATE
    AND i.status IN ('paid', 'partial')
GROUP BY a.city, a.state
ORDER BY revenue DESC;

-- Tank Low Level Alerts
CREATE OR REPLACE VIEW tanks_low_alerts AS
SELECT 
    t.id as tank_id,
    t.tank_number,
    c.name as customer_name,
    c.phone as customer_phone,
    a.city,
    a.state,
    tr.gallons_remaining,
    t.low_level_alert,
    t.capacity_gallons,
    ROUND((tr.gallons_remaining::numeric / t.capacity_gallons) * 100, 1) as fill_percentage,
    tr.reading_date as last_reading_date,
    CURRENT_DATE - DATE(tr.reading_date) as days_since_reading
FROM tanks t
JOIN customers c ON t.customer_id = c.id
JOIN addresses a ON c.id = a.customer_id AND a.address_type = 'service'
JOIN LATERAL (
    SELECT gallons_remaining, reading_date 
    FROM tank_readings 
    WHERE tank_id = t.id 
    ORDER BY reading_date DESC 
    LIMIT 1
) tr ON true
WHERE tr.gallons_remaining <= t.low_level_alert
    AND c.active = true
ORDER BY tr.gallons_remaining ASC, tr.reading_date ASC;
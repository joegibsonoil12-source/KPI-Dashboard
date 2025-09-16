-- Demo Seed Data for Gibson Oil & Gas KPI Dashboard
-- ==================================================
-- Safe demo data for testing and demonstration purposes

-- Insert demo products
INSERT INTO products (name, product_code, unit_type, base_price, active) VALUES 
('Propane', 'PROP', 'gallons', 2.45, true),
('Diesel Fuel', 'DIESEL', 'gallons', 3.89, true),
('Unleaded Gasoline', 'GAS87', 'gallons', 3.12, true),
('DEF (Diesel Exhaust Fluid)', 'DEF', 'gallons', 4.50, true),
('Tank Installation', 'INSTALL', 'each', 500.00, true),
('Tank Maintenance', 'MAINT', 'each', 150.00, true);

-- Insert demo employees
INSERT INTO employees (employee_number, first_name, last_name, position, department, hire_date, hourly_rate, active, phone, email) VALUES 
('EMP001', 'John', 'Carter', 'Delivery Driver', 'Operations', '2022-01-15', 22.50, true, '432-555-0101', 'j.carter@gibsonoil.com'),
('EMP002', 'Lisa', 'Nguyen', 'Delivery Driver', 'Operations', '2021-06-10', 24.00, true, '432-555-0102', 'l.nguyen@gibsonoil.com'),
('EMP003', 'Mike', 'Patel', 'Service Technician', 'Service', '2020-03-20', 28.75, true, '432-555-0103', 'm.patel@gibsonoil.com'),
('EMP004', 'Rosa', 'Gomez', 'Office Manager', 'Administration', '2019-05-12', 25.00, true, '432-555-0104', 'r.gomez@gibsonoil.com'),
('EMP005', 'Sam', 'Ali', 'Delivery Driver', 'Operations', '2023-02-01', 21.00, true, '432-555-0105', 's.ali@gibsonoil.com');

-- Insert demo customers
INSERT INTO customers (name, customer_number, type, phone, email, active) VALUES 
('West Texas Diner', 'CUST001', 'commercial', '432-555-1001', 'orders@westtexasdiner.com', true),
('Johnson Residence', 'CUST002', 'residential', '432-555-1002', 'mjohnson@email.com', true),
('Midland Manufacturing Co', 'CUST003', 'commercial', '432-555-1003', 'facilities@midlandmfg.com', true),
('Smith Family Farm', 'CUST004', 'residential', '432-555-1004', 'farmsmith@email.com', true),
('Desert Rose Restaurant', 'CUST005', 'commercial', '432-555-1005', 'manager@desertrose.com', true),
('Williams Ranch', 'CUST006', 'residential', '432-555-1006', 'rwilliams@email.com', true),
('Odessa Truck Stop', 'CUST007', 'commercial', '432-555-1007', 'fuel@odessatrucks.com', true),
('Brown Residence', 'CUST008', 'residential', '432-555-1008', 'kbrown@email.com', true);

-- Insert demo addresses
INSERT INTO addresses (customer_id, street_address, city, state, zip_code, latitude, longitude, address_type) VALUES 
(1, '1200 W Wall Street', 'Midland', 'TX', '79701', 31.9973, -102.0779, 'service'),
(2, '2401 Mockingbird Lane', 'Midland', 'TX', '79705', 31.9935, -102.0462, 'service'),
(3, '4567 Industrial Blvd', 'Midland', 'TX', '79706', 32.0251, -102.1074, 'service'),
(4, '15890 County Road 1250', 'Midland', 'TX', '79706', 32.0876, -102.1543, 'service'),
(5, '890 E 8th Street', 'Odessa', 'TX', '79761', 31.8457, -102.3676, 'service'),
(6, '7823 Ranch Road 1788', 'Odessa', 'TX', '79765', 31.9234, -102.4321, 'service'),
(7, '2200 E Interstate 20', 'Odessa', 'TX', '79761', 31.8562, -102.3234, 'service'),
(8, '567 Maple Street', 'Odessa', 'TX', '79762', 31.8734, -102.3567, 'service');

-- Insert demo tanks
INSERT INTO tanks (customer_id, tank_number, capacity_gallons, product_id, install_date, last_fill_date, low_level_alert) VALUES 
(1, 'T001', 500, 1, '2023-01-15', '2024-12-01', 50),
(2, 'T002', 250, 1, '2022-08-20', '2024-11-28', 25),
(3, 'T003', 1000, 1, '2021-05-10', '2024-12-03', 100),
(4, 'T004', 500, 1, '2023-03-12', '2024-11-25', 50),
(5, 'T005', 750, 1, '2022-11-18', '2024-12-02', 75),
(6, 'T006', 500, 1, '2023-06-22', '2024-11-30', 50),
(7, 'T007', 2000, 2, '2021-09-15', '2024-12-04', 200),
(8, 'T008', 250, 1, '2023-09-10', '2024-11-26', 25);

-- Insert recent tank readings
INSERT INTO tank_readings (tank_id, reading_date, gallons_remaining, temperature, pressure, reading_method, notes) VALUES 
(1, '2024-12-05 09:00:00', 120, 45.5, 125.3, 'manual', 'Normal operation'),
(2, '2024-12-05 09:15:00', 85, 43.2, 118.7, 'manual', 'Normal operation'),
(3, '2024-12-05 09:30:00', 320, 46.8, 142.1, 'automatic', 'Normal operation'),
(4, '2024-12-05 09:45:00', 45, 44.1, 110.2, 'manual', 'Low level - schedule delivery'),
(5, '2024-12-05 10:00:00', 240, 45.9, 135.8, 'automatic', 'Normal operation'),
(6, '2024-12-05 10:15:00', 180, 44.7, 128.4, 'manual', 'Normal operation'),
(7, '2024-12-05 10:30:00', 800, 42.3, 155.6, 'automatic', 'Normal operation'),
(8, '2024-12-05 10:45:00', 20, 43.8, 105.9, 'manual', 'Critical low - urgent delivery needed');

-- Insert demo deliveries for current month
INSERT INTO deliveries (delivery_number, customer_id, tank_id, product_id, driver_employee_id, scheduled_date, delivery_date, gallons_delivered, price_per_gallon, total_amount, status, notes) VALUES 
('DEL2024001', 1, 1, 1, 1, '2024-12-01', '2024-12-01 10:30:00', 380.0, 2.45, 931.00, 'delivered', 'Regular delivery'),
('DEL2024002', 2, 2, 1, 2, '2024-12-02', '2024-12-02 14:15:00', 165.0, 2.45, 404.25, 'delivered', 'Regular delivery'),
('DEL2024003', 3, 3, 1, 1, '2024-12-03', '2024-12-03 11:00:00', 680.0, 2.40, 1632.00, 'delivered', 'Commercial discount applied'),
('DEL2024004', 5, 5, 1, 3, '2024-12-04', '2024-12-04 09:45:00', 510.0, 2.45, 1249.50, 'delivered', 'Regular delivery'),
('DEL2024005', 7, 7, 2, 2, '2024-12-04', '2024-12-04 16:20:00', 1200.0, 3.89, 4668.00, 'delivered', 'Diesel delivery'),
('DEL2024006', 4, 4, 1, 1, '2024-12-06', NULL, 455.0, 2.45, 1114.75, 'scheduled', 'Scheduled for tomorrow'),
('DEL2024007', 8, 8, 1, 2, '2024-12-06', NULL, 230.0, 2.45, 563.50, 'scheduled', 'Emergency delivery - tank critical');

-- Insert demo invoices
INSERT INTO invoices (invoice_number, customer_id, invoice_date, due_date, subtotal, tax_amount, total_amount, status, payment_terms, notes) VALUES 
('INV2024001', 1, '2024-12-01', '2024-12-31', 931.00, 74.48, 1005.48, 'paid', 30, 'Propane delivery'),
('INV2024002', 2, '2024-12-02', '2025-01-01', 404.25, 32.34, 436.59, 'sent', 30, 'Propane delivery'),
('INV2024003', 3, '2024-12-03', '2025-01-02', 1632.00, 130.56, 1762.56, 'paid', 15, 'Commercial propane delivery'),
('INV2024004', 5, '2024-12-04', '2025-01-03', 1249.50, 99.96, 1349.46, 'sent', 30, 'Propane delivery'),
('INV2024005', 7, '2024-12-04', '2024-12-19', 4668.00, 373.44, 5041.44, 'paid', 15, 'Diesel fuel delivery');

-- Insert demo invoice items
INSERT INTO invoice_items (invoice_id, delivery_id, description, quantity, unit_price, line_total) VALUES 
(1, 1, 'Propane Delivery - 380.0 gallons', 380.0, 2.45, 931.00),
(2, 2, 'Propane Delivery - 165.0 gallons', 165.0, 2.45, 404.25),
(3, 3, 'Propane Delivery - 680.0 gallons (Commercial Rate)', 680.0, 2.40, 1632.00),
(4, 4, 'Propane Delivery - 510.0 gallons', 510.0, 2.45, 1249.50),
(5, 5, 'Diesel Fuel Delivery - 1200.0 gallons', 1200.0, 3.89, 4668.00);

-- Insert demo payments
INSERT INTO payments (invoice_id, payment_date, amount, payment_method, reference_number, notes) VALUES 
(1, '2024-12-01', 1005.48, 'check', 'CHK2024-1001', 'Payment received same day'),
(3, '2024-12-05', 1762.56, 'ach', 'ACH2024-5003', 'Electronic payment'),
(5, '2024-12-04', 5041.44, 'ach', 'ACH2024-4005', 'Commercial customer auto-pay');

-- Insert demo jobs
INSERT INTO jobs (job_number, customer_id, job_type, description, scheduled_date, completed_date, status, priority, assigned_employee_id, estimated_hours, actual_hours) VALUES 
('JOB2024001', 1, 'Tank Maintenance', 'Annual tank inspection and maintenance', '2024-12-10', NULL, 'scheduled', 'normal', 3, 2.0, NULL),
('JOB2024002', 4, 'Tank Installation', 'Install new 500-gallon propane tank', '2024-12-08', NULL, 'scheduled', 'high', 3, 6.0, NULL),
('JOB2024003', 6, 'Tank Repair', 'Repair pressure gauge on existing tank', '2024-12-07', '2024-12-07', 'completed', 'normal', 3, 1.5, 1.75);

-- Insert demo expenses
INSERT INTO expenses (expense_number, employee_id, category, description, amount, expense_date, status, approved_by, approved_date) VALUES 
('EXP2024001', 1, 'Fuel', 'Delivery truck fuel', 125.50, '2024-12-01', 'approved', 4, '2024-12-02'),
('EXP2024002', 2, 'Fuel', 'Delivery truck fuel', 98.75, '2024-12-02', 'approved', 4, '2024-12-03'),
('EXP2024003', 3, 'Tools', 'Pressure gauge replacement', 85.20, '2024-12-03', 'approved', 4, '2024-12-04'),
('EXP2024004', 1, 'Delivery Costs', 'Emergency delivery overtime', 180.00, '2024-12-04', 'pending', NULL, NULL),
('EXP2024005', 2, 'Delivery Costs', 'Route optimization fuel', 67.30, '2024-12-05', 'pending', NULL, NULL);
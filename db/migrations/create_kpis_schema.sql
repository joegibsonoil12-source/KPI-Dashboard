-- KPI Database Schema for Gibson Oil & Gas
-- ========================================
-- Creates tables for customers, addresses, tanks, tank_readings, products, jobs, 
-- deliveries, invoices, invoice_items, payments, employees, expenses and indexes

-- Customers table
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    customer_number VARCHAR(50) UNIQUE NOT NULL,
    type VARCHAR(20) CHECK (type IN ('residential', 'commercial')) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Addresses table
CREATE TABLE addresses (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    street_address VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(2) NOT NULL,
    zip_code VARCHAR(10) NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    address_type VARCHAR(20) DEFAULT 'service' CHECK (address_type IN ('billing', 'service', 'mailing')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    product_code VARCHAR(20) UNIQUE NOT NULL,
    unit_type VARCHAR(20) DEFAULT 'gallons' CHECK (unit_type IN ('gallons', 'pounds', 'each')),
    base_price DECIMAL(10, 4) NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tanks table
CREATE TABLE tanks (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    tank_number VARCHAR(50) NOT NULL,
    capacity_gallons INTEGER NOT NULL,
    product_id INTEGER REFERENCES products(id),
    install_date DATE,
    last_fill_date DATE,
    low_level_alert INTEGER DEFAULT 20,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(customer_id, tank_number)
);

-- Tank readings table
CREATE TABLE tank_readings (
    id SERIAL PRIMARY KEY,
    tank_id INTEGER REFERENCES tanks(id) ON DELETE CASCADE,
    reading_date TIMESTAMP WITH TIME ZONE NOT NULL,
    gallons_remaining INTEGER NOT NULL,
    temperature DECIMAL(5, 2),
    pressure DECIMAL(8, 2),
    reading_method VARCHAR(20) DEFAULT 'manual' CHECK (reading_method IN ('manual', 'automatic', 'remote')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Employees table
CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    employee_number VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    position VARCHAR(100),
    department VARCHAR(50),
    hire_date DATE,
    hourly_rate DECIMAL(8, 2),
    active BOOLEAN DEFAULT true,
    phone VARCHAR(20),
    email VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Jobs table
CREATE TABLE jobs (
    id SERIAL PRIMARY KEY,
    job_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id INTEGER REFERENCES customers(id),
    job_type VARCHAR(50) NOT NULL,
    description TEXT,
    scheduled_date DATE,
    completed_date DATE,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    assigned_employee_id INTEGER REFERENCES employees(id),
    estimated_hours DECIMAL(5, 2),
    actual_hours DECIMAL(5, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Deliveries table
CREATE TABLE deliveries (
    id SERIAL PRIMARY KEY,
    delivery_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id INTEGER REFERENCES customers(id) NOT NULL,
    tank_id INTEGER REFERENCES tanks(id),
    product_id INTEGER REFERENCES products(id) NOT NULL,
    driver_employee_id INTEGER REFERENCES employees(id),
    scheduled_date DATE NOT NULL,
    delivery_date TIMESTAMP WITH TIME ZONE,
    gallons_delivered DECIMAL(10, 3) NOT NULL,
    price_per_gallon DECIMAL(8, 4) NOT NULL,
    total_amount DECIMAL(12, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_transit', 'delivered', 'cancelled')),
    delivery_address TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Invoices table
CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id INTEGER REFERENCES customers(id) NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    subtotal DECIMAL(12, 2) NOT NULL,
    tax_amount DECIMAL(12, 2) DEFAULT 0,
    total_amount DECIMAL(12, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled')),
    payment_terms INTEGER DEFAULT 30,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Invoice items table
CREATE TABLE invoice_items (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
    delivery_id INTEGER REFERENCES deliveries(id),
    description TEXT NOT NULL,
    quantity DECIMAL(10, 3) NOT NULL,
    unit_price DECIMAL(10, 4) NOT NULL,
    line_total DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Payments table
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER REFERENCES invoices(id) NOT NULL,
    payment_date DATE NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    payment_method VARCHAR(20) CHECK (payment_method IN ('cash', 'check', 'credit_card', 'ach', 'wire')),
    reference_number VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Expenses table
CREATE TABLE expenses (
    id SERIAL PRIMARY KEY,
    expense_number VARCHAR(50) UNIQUE NOT NULL,
    employee_id INTEGER REFERENCES employees(id),
    category VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    expense_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'reimbursed', 'rejected')),
    receipt_url TEXT,
    approved_by INTEGER REFERENCES employees(id),
    approved_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_customers_customer_number ON customers(customer_number);
CREATE INDEX idx_customers_type ON customers(type);
CREATE INDEX idx_customers_active ON customers(active);

CREATE INDEX idx_addresses_customer_id ON addresses(customer_id);
CREATE INDEX idx_addresses_city_state ON addresses(city, state);

CREATE INDEX idx_tanks_customer_id ON tanks(customer_id);
CREATE INDEX idx_tanks_product_id ON tanks(product_id);

CREATE INDEX idx_tank_readings_tank_id ON tank_readings(tank_id);
CREATE INDEX idx_tank_readings_date ON tank_readings(reading_date);

CREATE INDEX idx_employees_employee_number ON employees(employee_number);
CREATE INDEX idx_employees_active ON employees(active);

CREATE INDEX idx_jobs_customer_id ON jobs(customer_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_scheduled_date ON jobs(scheduled_date);
CREATE INDEX idx_jobs_assigned_employee_id ON jobs(assigned_employee_id);

CREATE INDEX idx_deliveries_customer_id ON deliveries(customer_id);
CREATE INDEX idx_deliveries_delivery_date ON deliveries(delivery_date);
CREATE INDEX idx_deliveries_status ON deliveries(status);
CREATE INDEX idx_deliveries_driver_employee_id ON deliveries(driver_employee_id);

CREATE INDEX idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX idx_invoices_invoice_date ON invoices(invoice_date);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
CREATE INDEX idx_invoices_status ON invoices(status);

CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_delivery_id ON invoice_items(delivery_id);

CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX idx_payments_payment_date ON payments(payment_date);

CREATE INDEX idx_expenses_employee_id ON expenses(employee_id);
CREATE INDEX idx_expenses_expense_date ON expenses(expense_date);
CREATE INDEX idx_expenses_status ON expenses(status);
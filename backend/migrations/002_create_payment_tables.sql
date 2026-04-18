-- Migration: Create payment and QR code tables
-- PostgreSQL version
-- Run this script before starting the application with new models

BEGIN;

-- Payment Types Enum (for PostgreSQL)
DO $$ BEGIN
    CREATE TYPE paymenttype AS ENUM ('income', 'expense');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Payment Methods Enum (for PostgreSQL)
DO $$ BEGIN
    CREATE TYPE paymentmethod AS ENUM ('cash', 'card', 'transfer', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Payments Table
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    amount DECIMAL(10, 2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_type paymenttype NOT NULL,
    payment_method paymentmethod NOT NULL,
    
    -- Optional relationships
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
    appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
    
    -- Descriptive fields
    description VARCHAR(500) NOT NULL,
    notes TEXT,
    reference_number VARCHAR(100) UNIQUE,
    
    -- Tracking
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Indexes for payments
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_client_id ON payments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_service_id ON payments(service_id);
CREATE INDEX IF NOT EXISTS idx_payments_appointment_id ON payments(appointment_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_type ON payments(payment_type);
CREATE INDEX IF NOT EXISTS idx_payments_payment_method ON payments(payment_method);

-- QR Code Tables
CREATE TABLE IF NOT EXISTS qr_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(100) UNIQUE NOT NULL,
    content TEXT NOT NULL,
    title VARCHAR(200),
    description TEXT,
    
    -- QR Configuration
    size INTEGER NOT NULL DEFAULT 300,
    format VARCHAR(10) NOT NULL DEFAULT 'png' CHECK (format IN ('png', 'svg', 'jpg')),
    error_correction CHAR(1) NOT NULL DEFAULT 'M' CHECK (error_correction IN ('L', 'M', 'Q', 'H')),
    color VARCHAR(7) NOT NULL DEFAULT '#000000',
    background_color VARCHAR(7) NOT NULL DEFAULT '#FFFFFF',
    
    -- Usage tracking
    use_count INTEGER NOT NULL DEFAULT 0,
    last_used_at TIMESTAMP,
    
    -- Relationships
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
    service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
    
    -- Storage
    image_data TEXT, -- Base64 encoded
    image_path VARCHAR(500),
    
    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- QR Code Scans Table
CREATE TABLE IF NOT EXISTS qr_code_scans (
    id SERIAL PRIMARY KEY,
    qr_code_id INTEGER NOT NULL REFERENCES qr_codes(id) ON DELETE CASCADE,
    
    -- Scan details
    scanned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    referrer VARCHAR(500),
    
    -- Optional user context
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL
);

-- Indexes for QR codes
CREATE INDEX IF NOT EXISTS idx_qr_codes_code ON qr_codes(code);
CREATE INDEX IF NOT EXISTS idx_qr_codes_client_id ON qr_codes(client_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_appointment_id ON qr_codes(appointment_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_expires_at ON qr_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_qr_scans_qr_code_id ON qr_code_scans(qr_code_id);
CREATE INDEX IF NOT EXISTS idx_qr_scans_scanned_at ON qr_code_scans(scanned_at);

-- Create payment summary view
CREATE OR REPLACE VIEW payment_summary_view AS
SELECT 
    service_id,
    s.name as service_name,
    payment_type,
    payment_method,
    TO_CHAR(payment_date, 'YYYY-MM') as month,
    SUM(amount) as total_amount,
    COUNT(*) as payment_count,
    AVG(amount) as avg_amount
FROM payments p
LEFT JOIN services s ON p.service_id = s.id
WHERE deleted_at IS NULL
GROUP BY service_id, s.name, payment_type, payment_method, TO_CHAR(payment_date, 'YYYY-MM');

COMMIT;

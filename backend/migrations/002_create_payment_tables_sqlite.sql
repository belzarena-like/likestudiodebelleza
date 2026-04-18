-- Migration: Create payment and QR code tables for SQLite
-- Run this script before starting the application with new models

BEGIN TRANSACTION;

-- Payments Table for SQLite
CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amount DECIMAL(10, 2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_type TEXT NOT NULL CHECK (payment_type IN ('INCOME', 'EXPENSE')),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('CASH', 'CARD', 'TRANSFER', 'OTHER', 'COUPON')),
    
    -- Optional relationships
    client_id INTEGER REFERENCES clients(id),
    service_id INTEGER REFERENCES services(id),
    appointment_id INTEGER REFERENCES appointments(id),
    
    -- Descriptive fields
    description TEXT NOT NULL,
    notes TEXT,
    reference_number TEXT UNIQUE,
    
    -- Tracking
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

-- Indexes for payments
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_client_id ON payments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_service_id ON payments(service_id);
CREATE INDEX IF NOT EXISTS idx_payments_appointment_id ON payments(appointment_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_type ON payments(payment_type);
CREATE INDEX IF NOT EXISTS idx_payments_payment_method ON payments(payment_method);

-- QR Code Table for SQLite
CREATE TABLE IF NOT EXISTS qr_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    content TEXT NOT NULL,
    title TEXT,
    description TEXT,
    
    -- QR Configuration
    size INTEGER NOT NULL DEFAULT 300,
    format TEXT NOT NULL DEFAULT 'png' CHECK (format IN ('png', 'svg', 'jpg')),
    error_correction TEXT NOT NULL DEFAULT 'M' CHECK (error_correction IN ('L', 'M', 'Q', 'H')),
    color TEXT NOT NULL DEFAULT '#000000',
    background_color TEXT NOT NULL DEFAULT '#FFFFFF',
    
    -- Usage tracking
    use_count INTEGER NOT NULL DEFAULT 0,
    last_used_at DATETIME,
    
    -- Relationships
    client_id INTEGER REFERENCES clients(id),
    appointment_id INTEGER REFERENCES appointments(id),
    service_id INTEGER REFERENCES services(id),
    
    -- Storage
    image_data TEXT, -- Base64 encoded
    image_path TEXT,
    
    -- Metadata
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME
);

-- QR Code Scans Table for SQLite
CREATE TABLE IF NOT EXISTS qr_code_scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    qr_code_id INTEGER NOT NULL REFERENCES qr_codes(id) ON DELETE CASCADE,
    
    -- Scan details
    scanned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    user_agent TEXT,
    referrer TEXT,
    
    -- Optional user context
    client_id INTEGER REFERENCES clients(id)
);

-- Indexes for QR codes
CREATE INDEX IF NOT EXISTS idx_qr_codes_code ON qr_codes(code);
CREATE INDEX IF NOT EXISTS idx_qr_codes_client_id ON qr_codes(client_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_appointment_id ON qr_codes(appointment_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_expires_at ON qr_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_qr_scans_qr_code_id ON qr_code_scans(qr_code_id);
CREATE INDEX IF NOT EXISTS idx_qr_scans_scanned_at ON qr_code_scans(scanned_at);

-- Create payment summary view for SQLite
CREATE VIEW IF NOT EXISTS payment_summary_view AS
SELECT 
    service_id,
    s.name as service_name,
    payment_type,
    payment_method,
    strftime('%Y-%m', payment_date) as month,
    SUM(amount) as total_amount,
    COUNT(*) as payment_count,
    AVG(amount) as avg_amount
FROM payments p
LEFT JOIN services s ON p.service_id = s.id
WHERE deleted_at IS NULL
GROUP BY service_id, s.name, payment_type, payment_method, strftime('%Y-%m', payment_date);

COMMIT;
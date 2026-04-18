-- Migration: Add logo columns to qr_codes table
-- PostgreSQL version
-- Run this script to add logo overlay options to QR codes

BEGIN;

-- Add logo-related columns to qr_codes table
ALTER TABLE IF EXISTS qr_codes
ADD COLUMN IF NOT EXISTS add_logo BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS logo_data TEXT,
ADD COLUMN IF NOT EXISTS logo_path VARCHAR(500),
ADD COLUMN IF NOT EXISTS logo_position VARCHAR(500),
ADD COLUMN IF NOT EXISTS logo_size_percent INTEGER DEFAULT 20 CHECK (logo_size_percent > 0 AND logo_size_percent <= 100);

-- Create index for logo queries
CREATE INDEX IF NOT EXISTS idx_qr_codes_add_logo ON qr_codes(add_logo);

COMMIT;

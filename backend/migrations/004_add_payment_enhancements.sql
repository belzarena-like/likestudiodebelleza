-- Migration: Add payment enhancements (split payments, tentative payments, coupon support)
-- PostgreSQL version
-- Run this script to add new columns and constraints to payments table

BEGIN;

-- Add new columns for split payment support
ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_split BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_group_id VARCHAR(36);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS parent_payment_id INTEGER REFERENCES payments(id);

-- Add new columns for tentative payment support
ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_tentative BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP;

-- Add new column for coupon support
ALTER TABLE payments ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(100);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_payments_payment_group_id ON payments(payment_group_id);
CREATE INDEX IF NOT EXISTS idx_payments_parent_payment_id ON payments(parent_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_is_tentative ON payments(is_tentative);
CREATE INDEX IF NOT EXISTS idx_payments_coupon_code ON payments(coupon_code);

-- Update payment_method CHECK constraint to include 'COUPON'
-- First, drop the old constraint if it exists
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;

-- Add new constraint with 'COUPON' included (CAPITALIZED)
ALTER TABLE payments ADD CONSTRAINT payments_payment_method_check 
  CHECK (payment_method IN ('CASH', 'CARD', 'TRANSFER', 'COUPON', 'OTHER'));

COMMIT;

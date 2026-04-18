-- Migration: Convert payment_method values to uppercase
-- This migration updates existing payment records to use uppercase enum values
-- Run this after 004_add_payment_enhancements.sql

BEGIN;

-- Update existing payment_method values to uppercase
UPDATE payments SET payment_method = 'CASH' WHERE payment_method = 'cash';
UPDATE payments SET payment_method = 'CARD' WHERE payment_method = 'card';
UPDATE payments SET payment_method = 'TRANSFER' WHERE payment_method = 'transfer';
UPDATE payments SET payment_method = 'COUPON' WHERE payment_method = 'coupon';
UPDATE payments SET payment_method = 'OTHER' WHERE payment_method = 'other';

COMMIT;

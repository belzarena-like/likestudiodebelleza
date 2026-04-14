-- Migration: add signature columns to consents table
-- Run this script after DB creation to add new columns

BEGIN;

-- Add columns if they don't exist
ALTER TABLE consents ADD COLUMN signature_image_path TEXT;
ALTER TABLE consents ADD COLUMN signature_mime_type TEXT;

COMMIT;
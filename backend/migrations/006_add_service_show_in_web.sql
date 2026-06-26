-- Migration 006: Add show_in_web flag to services
-- Controls whether a service is visible/bookable from the public website.

ALTER TABLE services
    ADD COLUMN IF NOT EXISTS show_in_web BOOLEAN NOT NULL DEFAULT TRUE;

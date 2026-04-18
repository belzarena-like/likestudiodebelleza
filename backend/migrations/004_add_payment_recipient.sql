-- Add recipient column to payments table
ALTER TABLE payments ADD COLUMN recipient VARCHAR(50);

-- Create index on recipient for faster queries
CREATE INDEX idx_payments_recipient ON payments(recipient);

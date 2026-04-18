# Migration Instructions

## Issue
The database has lowercase payment_method values (`'cash'`, `'card'`, etc.) but the application now expects uppercase values (`'CASH'`, `'CARD'`, etc.).

## Solution
Run the migration script to update existing data:

### Option 1: Using Python Script (Recommended)
```bash
cd backend
python run_migration_005.py
```

### Option 2: Using PostgreSQL directly
```bash
cd backend
psql -h localhost -U likestudio -d likestudio -f migrations/005_uppercase_payment_methods.sql
```

### Option 3: Manual SQL
Connect to your PostgreSQL database and run:
```sql
BEGIN;

UPDATE payments SET payment_method = 'CASH' WHERE payment_method = 'cash';
UPDATE payments SET payment_method = 'CARD' WHERE payment_method = 'card';
UPDATE payments SET payment_method = 'TRANSFER' WHERE payment_method = 'transfer';
UPDATE payments SET payment_method = 'COUPON' WHERE payment_method = 'coupon';
UPDATE payments SET payment_method = 'OTHER' WHERE payment_method = 'other';

COMMIT;
```

## Verification
After running the migration, restart your backend server and the error should be resolved.

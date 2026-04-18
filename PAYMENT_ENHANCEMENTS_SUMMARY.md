# Payment Enhancements Implementation Summary

## Changes Completed

### Backend Changes

#### 1. Database Migration
- **File**: `backend/migrations/004_add_payment_enhancements.sql`
- **Changes**:
  - Added `is_split` BOOLEAN column
  - Added `payment_group_id` VARCHAR(36) column with index
  - Added `parent_payment_id` INTEGER column with foreign key
  - Added `is_tentative` BOOLEAN column with index
  - Added `confirmed_at` TIMESTAMP column
  - Added `coupon_code` VARCHAR(100) column with index
  - Updated CHECK constraint to include 'COUPON' payment method (CAPITALIZED)

#### 2. Models (`backend/app/models.py`)
- Updated `PaymentMethod` enum to include `COUPON = "COUPON"` (CAPITALIZED)
- Added new fields to `Payment` model:
  - `is_split`, `payment_group_id`, `parent_payment_id`
  - `is_tentative`, `confirmed_at`
  - `coupon_code`
- Added self-referential relationships for split payments

#### 3. Schemas (`backend/app/schemas.py`)
- Created `PaymentPartCreate` schema for split payment parts
- Updated `PaymentCreate` with new fields:
  - `is_split`, `split_parts`, `is_tentative`, `coupon_code`
- Updated `PaymentRead` with new fields:
  - `payment_group_id`, `parent_payment_id`, `confirmed_at`, `child_parts`
- Updated `PaymentMethod` enum (CAPITALIZED)

#### 4. CRUD Operations (`backend/app/crud_payment.py`)
- Added `validate_split_payment()` function
- Added `validate_coupon_payment()` function
- Added `create_split_payment()` function
- Added `confirm_tentative_payment()` function
- Updated `search_payments()` to:
  - Exclude child payments from results
  - Calculate separate tentative balances
  - Support `status_filter` parameter

#### 5. Service Layer (`backend/app/services/payment_service.py`)
- Added `confirm_tentative_payment()` method
- Updated `search_payments()` to include `status_filter` parameter

#### 6. API Endpoints (`backend/app/main.py`)
- Updated `GET /admin/payments` to include `status_filter` query parameter
- Added `POST /admin/payments/{payment_id}/confirm` endpoint

### Frontend Changes

#### 1. HTML (`admin/payments.html`)
- Added split payment checkbox and section
- Added tentative payment checkbox
- Added coupon code input field
- Updated payment method dropdown to include "Cupón/Groupon" (value: COUPON)
- Added 3 new tentative balance cards
- Updated table header to show "Estado" column instead of "Destinatario"
- Added status filter dropdown
- All payment method values are CAPITALIZED (CASH, CARD, TRANSFER, COUPON, OTHER)

#### 2. CSS (`css/payment-enhancements.css`)
- Split payment section styles
- Tentative payment card styles (dashed border)
- Child payment row styles
- Badge styles (including purple for coupon)
- Expand button styles

#### 3. JavaScript (`src/services/payment.service.js`)
- Added `confirmTentativePayment()` method

#### 4. JavaScript (`admin/js/payments.js`)
- Updated `getPaymentMethodLabel()` to handle CAPITALIZED values
- Updated chart data processing to handle CAPITALIZED keys
- Added backwards compatibility for lowercase values

## Features Implemented

### 1. Split Payments
- Divide a single payment into multiple installments
- Each part can have different date, amount, and payment method
- Parent payment tracks all child parts
- Balance calculations exclude child payments to avoid double-counting
- UI shows expand/collapse for split payment details

### 2. Tentative Payments
- Mark payments as tentative (future/expected)
- Tentative payments excluded from main balance calculations
- Separate balance cards show tentative income, expenses, and net
- Confirm button to convert tentative to effective
- Visual distinction with yellow badges and dashed borders

### 3. Coupon/Groupon Payments
- New payment method: COUPON
- Amount must be 0 for coupon payments
- Coupon code field (required, max 100 characters)
- Purple badge for coupon payments
- Coupon code displayed in description column

## Database Migration Instructions

### PostgreSQL
```bash
psql -U your_username -d your_database -f backend/migrations/004_add_payment_enhancements.sql
```

### Verify Migration
```sql
-- Check new columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'payments' 
AND column_name IN ('is_split', 'payment_group_id', 'parent_payment_id', 'is_tentative', 'confirmed_at', 'coupon_code');

-- Check indexes
SELECT indexname FROM pg_indexes WHERE tablename = 'payments';

-- Check constraint
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'payments_payment_method_check';
```

## Important Notes

### Payment Method Values
**ALL payment method values are now CAPITALIZED:**
- CASH
- CARD
- TRANSFER
- COUPON
- OTHER

The code includes backwards compatibility for lowercase values in the frontend, but the database and API use CAPITALIZED values.

### Balance Calculations
- **Effective balances**: Exclude tentative payments and child payments
- **Tentative balances**: Include only tentative payments (parent payments only)
- **Child payments**: Never included in any balance calculations

### Split Payment Rules
- Minimum 2 parts required
- Sum of parts must equal parent amount (within €0.01 tolerance)
- All parts share same client, service, and appointment
- Each part can have different date and payment method

### Coupon Payment Rules
- Amount must be exactly 0
- Coupon code is required
- Coupon code max length: 100 characters
- Payment method must be COUPON

## Testing Checklist

- [ ] Run database migration successfully
- [ ] Create a regular payment (effective)
- [ ] Create a tentative payment
- [ ] Confirm a tentative payment
- [ ] Create a split payment (2+ parts)
- [ ] View split payment details (expand/collapse)
- [ ] Create a coupon payment with code
- [ ] Verify balance calculations exclude tentative
- [ ] Verify balance calculations exclude child payments
- [ ] Filter by status (effective, tentative, split, coupon)
- [ ] Export payments to CSV
- [ ] View charts with new payment types

## Deployment Steps

1. **Backup database** before running migration
2. **Run migration** on production database
3. **Deploy backend** changes (restart API server)
4. **Deploy frontend** changes (clear browser cache)
5. **Verify** all features work correctly
6. **Monitor** for errors in first 24 hours

## Rollback Plan

If issues occur:
1. Revert backend code to previous version
2. Revert frontend code to previous version
3. Database rollback (if needed):
```sql
BEGIN;
ALTER TABLE payments DROP COLUMN IF EXISTS is_split;
ALTER TABLE payments DROP COLUMN IF EXISTS payment_group_id;
ALTER TABLE payments DROP COLUMN IF EXISTS parent_payment_id;
ALTER TABLE payments DROP COLUMN IF EXISTS is_tentative;
ALTER TABLE payments DROP COLUMN IF EXISTS confirmed_at;
ALTER TABLE payments DROP COLUMN IF EXISTS coupon_code;
-- Restore old CHECK constraint
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;
ALTER TABLE payments ADD CONSTRAINT payments_payment_method_check 
  CHECK (payment_method IN ('CASH', 'CARD', 'TRANSFER', 'OTHER'));
COMMIT;
```

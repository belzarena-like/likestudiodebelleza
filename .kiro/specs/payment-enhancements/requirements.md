# Requirements: Payment Enhancements

## Feature Overview

Enhance the existing payment system to support split payments, tentative/future payments, and coupon/Groupon payments. This will provide better flexibility for managing treatment payments that are paid in installments, tracking future expected payments separately from confirmed income, and registering promotional coupon redemptions.

## User Stories

### US-1: Split Payment Creation
**As a** studio administrator  
**I want to** split a single treatment payment into multiple installments  
**So that** I can track partial payments made at different times with different payment methods

**Acceptance Criteria:**
- [ ] AC-1.1: Admin can check "Split this payment" checkbox in payment modal
- [ ] AC-1.2: When split is enabled, admin can add 2 or more payment parts
- [ ] AC-1.3: Each payment part has: amount, date, payment method, and optional description
- [ ] AC-1.4: System validates that sum of parts equals total payment amount (within €0.01 tolerance)
- [ ] AC-1.5: System prevents saving if parts don't sum to total
- [ ] AC-1.6: Split payment is saved as parent payment with linked child payment parts
- [ ] AC-1.7: Parent payment displays with "Dividido" badge in payments table

### US-2: Split Payment Display
**As a** studio administrator  
**I want to** view the breakdown of split payments  
**So that** I can see all installment details

**Acceptance Criteria:**
- [ ] AC-2.1: Split payments show expand icon (▶) in payments table
- [ ] AC-2.2: Clicking expand icon reveals child payment parts
- [ ] AC-2.3: Child parts are indented and styled differently
- [ ] AC-2.4: Each child part shows: date, amount, payment method, description
- [ ] AC-2.5: Clicking again collapses the child parts

### US-3: Tentative Payment Creation
**As a** studio administrator  
**I want to** mark a payment as tentative (future/expected)  
**So that** I can track expected future income separately from confirmed payments

**Acceptance Criteria:**
- [ ] AC-3.1: Admin can check "Mark as tentative" checkbox in payment modal
- [ ] AC-3.2: Tentative payments are saved with is_tentative=true flag
- [ ] AC-3.3: Tentative payments display with "Tentativo" badge in yellow
- [ ] AC-3.4: Tentative payment rows have distinct visual styling (dashed border, light background)

### US-4: Tentative Payment Balances
**As a** studio administrator  
**I want to** see tentative payments excluded from main balance calculations  
**So that** I have accurate confirmed income/expense totals

**Acceptance Criteria:**
- [ ] AC-4.1: Main balance cards (Ingresos, Gastos, Neto) exclude tentative payments
- [ ] AC-4.2: New "Ingresos Tentativos" card shows tentative income total
- [ ] AC-4.3: New "Gastos Tentativos" card shows tentative expense total
- [ ] AC-4.4: New "Neto Tentativo" card shows tentative net balance
- [ ] AC-4.5: Tentative cards have distinct styling (dashed border, lighter background)
- [ ] AC-4.6: Tentative cards show tooltip: "Pagos futuros no confirmados"

### US-5: Tentative Payment Confirmation
**As a** studio administrator  
**I want to** confirm a tentative payment when it actually occurs  
**So that** it counts toward real balances

**Acceptance Criteria:**
- [ ] AC-5.1: Tentative payments show "Confirmar" button in actions column
- [ ] AC-5.2: Clicking "Confirmar" prompts for confirmation
- [ ] AC-5.3: Confirming sets is_tentative=false and records confirmed_at timestamp
- [ ] AC-5.4: Confirmed payment moves to effective balances
- [ ] AC-5.5: "Tentativo" badge is removed after confirmation
- [ ] AC-5.6: Success toast message shown: "Pago confirmado correctamente"

### US-6: Coupon Payment Creation
**As a** studio administrator  
**I want to** register Groupon/coupon redemptions as zero-amount payments  
**So that** I can track promotional treatments without monetary transactions

**Acceptance Criteria:**
- [ ] AC-6.1: Payment method dropdown includes "Cupón/Groupon" option
- [ ] AC-6.2: When "Cupón" is selected, amount field is set to €0.00 and becomes read-only
- [ ] AC-6.3: "Coupon Code" input field appears when method is "Cupón"
- [ ] AC-6.4: Coupon code field is required when method is "Cupón"
- [ ] AC-6.5: System validates coupon code is provided and ≤100 characters
- [ ] AC-6.6: Coupon payments display with "Cupón" badge in purple
- [ ] AC-6.7: Coupon code is shown in description column: "Description (COUPON-CODE)"

### US-7: Balance Calculation Accuracy
**As a** studio administrator  
**I want to** ensure split payment child parts don't double-count in balances  
**So that** financial reports are accurate

**Acceptance Criteria:**
- [ ] AC-7.1: Balance calculations only include parent split payments, not child parts
- [ ] AC-7.2: Tentative payments are excluded from effective balance totals
- [ ] AC-7.3: Confirmed payments (is_tentative=false) are included in effective balances
- [ ] AC-7.4: Coupon payments (amount=0) are included but don't affect balance totals
- [ ] AC-7.5: Soft-deleted payments are excluded from all calculations

### US-8: Payment Filtering
**As a** studio administrator  
**I want to** filter payments by status (effective, tentative, split, coupon)  
**So that** I can focus on specific payment types

**Acceptance Criteria:**
- [ ] AC-8.1: New "Estado" filter dropdown added to search form
- [ ] AC-8.2: Filter options: Todos, Solo efectivos, Solo tentativos, Solo divididos, Solo cupones
- [ ] AC-8.3: Selecting filter updates table to show only matching payments
- [ ] AC-8.4: Filter works in combination with existing filters (date, client, service, etc.)

## Correctness Properties

### CP-1: Split Payment Integrity
**Property:** For all split payments, the sum of child payment amounts must equal the parent payment amount (within €0.01 tolerance)

**Test Strategy:** Property-based test generating random parent amounts and random split parts, verifying sum equality

### CP-2: Tentative Exclusion
**Property:** When calculating effective balances (include_tentative=false), no tentative payments (is_tentative=true) are included in the result

**Test Strategy:** Property-based test generating random payment sets with mixed tentative/effective status, verifying exclusion

### CP-3: No Double-Counting
**Property:** Balance calculations never include both a parent split payment and its child parts

**Test Strategy:** Property-based test generating split payments, verifying only parent amounts are counted

### CP-4: Coupon Constraints
**Property:** All coupon payments have amount=0 and non-null coupon_code; all payments with coupon_code have payment_method="coupon"

**Test Strategy:** Property-based test generating coupon payments, verifying bidirectional constraint

### CP-5: Confirmation Monotonicity
**Property:** Once a payment is confirmed (is_tentative=false, confirmed_at set), it cannot become tentative again

**Test Strategy:** State-based test attempting to revert confirmed payment to tentative, verifying rejection

## Non-Functional Requirements

### NFR-1: Performance
- Split payment creation must complete in <100ms for up to 10 parts
- Balance calculation must complete in <200ms for up to 10,000 payments
- Tentative payment confirmation must complete in <50ms

### NFR-2: Usability
- Split payment UI must clearly show running total and validation status
- Tentative payments must be visually distinct from effective payments
- Coupon payments must be easily identifiable in the table

### NFR-3: Data Integrity
- Split payment creation must be atomic (all parts saved or none)
- Foreign key constraints must prevent orphaned child payments
- Soft-delete must be used to maintain audit trail

### NFR-4: Security
- Only authenticated admin users can create/modify payments
- Input validation must prevent SQL injection via coupon codes
- Amount validation must prevent negative values (except parent split can be sum)

## Out of Scope

- Editing existing split payments (must delete and recreate)
- Automatic tentative payment confirmation based on date
- Coupon code validation against external Groupon API
- Recurring/scheduled tentative payments
- Split payment templates or presets
- Multi-currency support
- Payment refunds or reversals

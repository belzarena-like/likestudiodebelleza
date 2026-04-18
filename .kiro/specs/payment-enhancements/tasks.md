# Implementation Tasks: Payment Enhancements

## 1. Database Schema Changes

- [-] 1.1 Create migration file for payment table modifications
  - [ ] 1.1.1 Add `is_split` BOOLEAN column (default FALSE)
  - [ ] 1.1.2 Add `payment_group_id` VARCHAR(36) column with index
  - [ ] 1.1.3 Add `parent_payment_id` INTEGER column with foreign key to payments.id
  - [ ] 1.1.4 Add `is_tentative` BOOLEAN column (default FALSE) with index
  - [ ] 1.1.5 Add `confirmed_at` DATETIME column (nullable)
  - [ ] 1.1.6 Add `coupon_code` VARCHAR(100) column with index (nullable)
  - [ ] 1.1.7 Update payment_method CHECK constraint to include 'COUPON'
- [ ] 1.2 Run migration on development database
- [ ] 1.3 Verify schema changes with SELECT queries

## 2. Backend Model Updates

- [x] 2.1 Update Payment model in backend/app/models.py
  - [ ] 2.1.1 Add new mapped columns: is_split, payment_group_id, parent_payment_id, is_tentative, confirmed_at, coupon_code
  - [ ] 2.1.2 Add self-referential relationship for parent_payment and child_parts
  - [ ] 2.1.3 Update PaymentMethod enum to include COUPON
- [ ] 2.2 Update Pydantic schemas in backend/app/schemas.py
  - [ ] 2.2.1 Create PaymentPartCreate schema
  - [ ] 2.2.2 Update PaymentCreate schema with new fields
  - [ ] 2.2.3 Update PaymentRead schema with new fields and child_parts list
  - [ ] 2.2.4 Update BalanceSummary schema with tentative fields
  - [ ] 2.2.5 Update PaymentMethod enum in schemas

## 3. Backend Service Layer

- [ ] 3.1 Implement split payment creation in payment_service.py
  - [ ] 3.1.1 Create validate_split_payment() function
  - [ ] 3.1.2 Create create_split_payment() function
  - [ ] 3.1.3 Generate UUID for payment_group_id
  - [ ] 3.1.4 Create parent payment with is_split=true
  - [ ] 3.1.5 Create child payment parts with parent_payment_id
  - [ ] 3.1.6 Wrap in database transaction
- [ ] 3.2 Implement tentative payment handling
  - [ ] 3.2.1 Create confirm_tentative_payment() function
  - [ ] 3.2.2 Validate payment exists and is tentative
  - [ ] 3.2.3 Set is_tentative=false and confirmed_at timestamp
- [ ] 3.3 Update balance calculation logic
  - [ ] 3.3.1 Modify calculate_balances() to exclude child payments
  - [ ] 3.3.2 Add separate tentative balance calculations
  - [ ] 3.3.3 Return BalanceSummary with all balance fields
- [ ] 3.4 Implement coupon payment validation
  - [ ] 3.4.1 Create validate_coupon_payment() function
  - [ ] 3.4.2 Validate amount=0 for coupon payments
  - [ ] 3.4.3 Validate coupon_code is provided and ≤100 chars

## 4. Backend API Endpoints

- [ ] 4.1 Update POST /api/payments endpoint
  - [ ] 4.1.1 Accept new fields in request body
  - [ ] 4.1.2 Call create_split_payment() if is_split=true
  - [ ] 4.1.3 Call validate_coupon_payment() if payment_method=coupon
  - [ ] 4.1.4 Return PaymentRead with child_parts if split
- [ ] 4.2 Create POST /api/payments/{id}/confirm endpoint
  - [ ] 4.2.1 Accept payment_id path parameter
  - [ ] 4.2.2 Call confirm_tentative_payment()
  - [ ] 4.2.3 Return updated PaymentRead
- [ ] 4.3 Update GET /api/payments endpoint
  - [ ] 4.3.1 Add status filter parameter (effective, tentative, split, coupon)
  - [ ] 4.3.2 Eager load child_parts for split payments
  - [ ] 4.3.3 Return payments with child_parts populated
- [ ] 4.4 Update GET /api/payments/summary endpoint
  - [ ] 4.4.1 Return BalanceSummary with tentative fields

## 5. Frontend Payment Modal UI

- [ ] 5.1 Update admin/payments.html modal structure
  - [ ] 5.1.1 Add "Split this payment" checkbox
  - [ ] 5.1.2 Add "Mark as tentative" checkbox
  - [ ] 5.1.3 Add "Cupón/Groupon" option to payment method dropdown
  - [ ] 5.1.4 Add coupon code input field (hidden by default)
  - [ ] 5.1.5 Add split payment section container (hidden by default)
  - [ ] 5.1.6 Add split parts container div
  - [ ] 5.1.7 Add "Add Part" button
  - [ ] 5.1.8 Add split total display and validation message
- [ ] 5.2 Create split part row template HTML
  - [ ] 5.2.1 Amount input field
  - [ ] 5.2.2 Date input field
  - [ ] 5.2.3 Payment method dropdown
  - [ ] 5.2.4 Description input field
  - [ ] 5.2.5 Remove button

## 6. Frontend Payment Modal Logic

- [ ] 6.1 Implement split payment handlers in admin/js/payments.js
  - [ ] 6.1.1 Add splitCheckbox change event listener
  - [ ] 6.1.2 Implement addSplitPart() function
  - [ ] 6.1.3 Implement validateSplitTotal() function
  - [ ] 6.1.4 Implement collectSplitParts() function
  - [ ] 6.1.5 Add remove part button handlers
  - [ ] 6.1.6 Add amount input change handlers for validation
- [ ] 6.2 Implement coupon payment handlers
  - [ ] 6.2.1 Add payment method change event listener
  - [ ] 6.2.2 Show/hide coupon code field based on method
  - [ ] 6.2.3 Set amount to 0 and make read-only for coupon
  - [ ] 6.2.4 Validate coupon code is provided
- [ ] 6.3 Update savePayment() function
  - [ ] 6.3.1 Validate split total before saving
  - [ ] 6.3.2 Collect split parts if enabled
  - [ ] 6.3.3 Include new fields in payment data object
  - [ ] 6.3.4 Handle API response with child_parts

## 7. Frontend Payments Table Display

- [ ] 7.1 Update renderTable() function
  - [ ] 7.1.1 Add status badges (Efectivo, Tentativo, Dividido, Cupón)
  - [ ] 7.1.2 Add expand icon for split payments
  - [ ] 7.1.3 Render child payment rows (hidden by default)
  - [ ] 7.1.4 Add "Confirmar" button for tentative payments
  - [ ] 7.1.5 Display coupon code in description column
- [ ] 7.2 Implement createPaymentRow() function
  - [ ] 7.2.1 Generate status badges based on payment properties
  - [ ] 7.2.2 Add expand button if is_split=true
  - [ ] 7.2.3 Add tentative row styling class
  - [ ] 7.2.4 Conditionally show confirm button
- [ ] 7.3 Implement createChildPaymentRow() function
  - [ ] 7.3.1 Create indented row with child payment data
  - [ ] 7.3.2 Apply child-payment-row CSS class
  - [ ] 7.3.3 Set data-parent-id attribute
- [ ] 7.4 Implement toggleSplitPaymentExpansion() function
  - [ ] 7.4.1 Find child rows by data-parent-id
  - [ ] 7.4.2 Toggle display: none/table-row
  - [ ] 7.4.3 Toggle expand icon ▶/▼

## 8. Frontend Balance Cards

- [ ] 8.1 Update admin/payments.html with new cards
  - [ ] 8.1.1 Add "Ingresos Tentativos" card
  - [ ] 8.1.2 Add "Gastos Tentativos" card
  - [ ] 8.1.3 Add "Neto Tentativo" card
  - [ ] 8.1.4 Apply tentative card styling (dashed border)
  - [ ] 8.1.5 Add tooltip: "Pagos futuros no confirmados"
- [ ] 8.2 Update updateCards() function in payments.js
  - [ ] 8.2.1 Update tentative income card value
  - [ ] 8.2.2 Update tentative expenses card value
  - [ ] 8.2.3 Update tentative net card value

## 9. Frontend Filters

- [ ] 9.1 Add status filter to admin/payments.html
  - [ ] 9.1.1 Add "Estado" dropdown to search form
  - [ ] 9.1.2 Add options: Todos, Solo efectivos, Solo tentativos, Solo divididos, Solo cupones
- [ ] 9.2 Update getFormFilters() function
  - [ ] 9.2.1 Include status filter value
- [ ] 9.3 Update backend search_payments() to handle status filter
  - [ ] 9.3.1 Add status parameter
  - [ ] 9.3.2 Apply appropriate WHERE clauses

## 10. Frontend Tentative Payment Confirmation

- [ ] 10.1 Implement confirmTentativePayment() function
  - [ ] 10.1.1 Show confirmation dialog
  - [ ] 10.1.2 Call POST /api/payments/{id}/confirm endpoint
  - [ ] 10.1.3 Show success toast
  - [ ] 10.1.4 Reload payments table
  - [ ] 10.1.5 Update charts

## 11. CSS Styling

- [ ] 11.1 Add split payment section styles
  - [ ] 11.1.1 Style split-payment-section container
  - [ ] 11.1.2 Style split-part-row grid layout
  - [ ] 11.1.3 Style split-summary section
  - [ ] 11.1.4 Style add/remove buttons
- [ ] 11.2 Add tentative payment styles
  - [ ] 11.2.1 Style tentative-row class (dashed border, light background)
  - [ ] 11.2.2 Style tentative summary cards
- [ ] 11.3 Add child payment row styles
  - [ ] 11.3.1 Style child-payment-row class (indented, gray)
- [ ] 11.4 Add badge styles
  - [ ] 11.4.1 Style badge-purple for coupon
  - [ ] 11.4.2 Update existing badge styles if needed
- [ ] 11.5 Add expand button styles
  - [ ] 11.5.1 Style expand-split button

## 12. Backend Testing

- [ ] 12.1 Unit tests for split payment creation
  - [ ] 12.1.1 Test valid split payment with 2 parts
  - [ ] 12.1.2 Test valid split payment with 5 parts
  - [ ] 12.1.3 Test split payment with amount mismatch (should fail)
  - [ ] 12.1.4 Test split payment with 1 part (should fail)
- [ ] 12.2 Unit tests for tentative payment handling
  - [ ] 12.2.1 Test creating tentative payment
  - [ ] 12.2.2 Test confirming tentative payment
  - [ ] 12.2.3 Test balance excludes tentative
  - [ ] 12.2.4 Test confirming already-confirmed payment (should fail)
- [ ] 12.3 Unit tests for coupon payment validation
  - [ ] 12.3.1 Test creating coupon payment with amount=0 and code
  - [ ] 12.3.2 Test creating coupon payment with amount>0 (should fail)
  - [ ] 12.3.3 Test creating coupon payment without code (should fail)
- [ ] 12.4 Unit tests for balance calculations
  - [ ] 12.4.1 Test balance excludes child payments
  - [ ] 12.4.2 Test balance excludes tentative payments
  - [ ] 12.4.3 Test balance includes confirmed payments

## 13. Integration Testing

- [ ] 13.1 End-to-end split payment flow
  - [ ] 13.1.1 Create split payment via API
  - [ ] 13.1.2 Verify parent and child payments in database
  - [ ] 13.1.3 Verify balance calculation excludes child payments
- [ ] 13.2 End-to-end tentative to effective flow
  - [ ] 13.2.1 Create tentative payment via API
  - [ ] 13.2.2 Verify balance excludes tentative
  - [ ] 13.2.3 Confirm payment via API
  - [ ] 13.2.4 Verify balance now includes payment
- [ ] 13.3 End-to-end coupon payment flow
  - [ ] 13.3.1 Create coupon payment via API
  - [ ] 13.3.2 Verify coupon code stored
  - [ ] 13.3.3 Verify amount is 0

## 14. Documentation

- [ ] 14.1 Update API documentation
  - [ ] 14.1.1 Document new PaymentCreate fields
  - [ ] 14.1.2 Document POST /api/payments/{id}/confirm endpoint
  - [ ] 14.1.3 Document new status filter parameter
- [ ] 14.2 Update user guide
  - [ ] 14.2.1 Document split payment feature
  - [ ] 14.2.2 Document tentative payment feature
  - [ ] 14.2.3 Document coupon payment feature

## 15. Deployment

- [ ] 15.1 Run database migration on production
- [ ] 15.2 Deploy backend changes
- [ ] 15.3 Deploy frontend changes
- [ ] 15.4 Verify all features work in production
- [ ] 15.5 Monitor for errors in first 24 hours

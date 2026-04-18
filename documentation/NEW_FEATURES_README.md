# Payment Control System & QR Code Generator

## New Features Added

### 1. Payment Control System
**Database Tables:**
- `payments` - Stores all payment transactions (income/expenses)
- `payment_summary_view` - Aggregated view for reporting

**API Endpoints:**
- `POST /payments` - Create new payment
- `GET /admin/payments` - Search payments with filters
- `GET /admin/payments/summary` - Get summary by service
- `PUT /admin/payments/{id}` - Update payment
- `DELETE /admin/payments/{id}` - Soft delete payment

**Frontend:**
- `admin/payments.html` - Main payments dashboard
- `admin/js/payments.js` - Payment controller
- `src/services/payment.service.js` - Frontend service

### 2. QR Code Generator
**Database Tables:**
- `qr_codes` - Stores QR code data and images
- `qr_code_scans` - Tracks scan history

**API Endpoints:**
- `POST /qr/generate` - Generate new QR code
- `GET /qr/{code}/image` - Get QR code image
- `GET /qr/{code}` - Get QR info (auto-redirects URLs)
- `POST /qr/scans` - Record scan event
- `GET /admin/qr-codes` - Search QR codes
- `DELETE /admin/qr-codes/{id}` - Delete QR code

**Frontend:**
- `admin/qr-generator.html` - QR generator interface
- `admin/js/qr-generator.js` - QR controller
- `src/services/qr.service.js` - Frontend service

## Installation Steps

1. **Database Migration:**
   ```bash
   psql -d your_database -f backend/migrations/002_create_payment_tables.sql
   ```
   Or for SQLite, the tables will be created automatically when the app starts.

2. **Install Python Dependencies:**
   ```bash
   pip install -r backend/requirements.txt
   ```

3. **Update Admin Menu:**
   All admin pages have been updated with new menu items.

4. **Start the Backend:**
   ```bash
   cd backend
   uvicorn app.main:app --reload
   ```

## Database Schema

### Payments Table
- `id` - Primary key
- `amount` - Payment amount (decimal)
- `payment_date` - Date of payment
- `payment_type` - 'income' or 'expense'
- `payment_method` - 'cash', 'card', 'transfer', 'other'
- `client_id`, `service_id`, `appointment_id` - Optional relationships
- `description` - Payment description
- `reference_number` - Optional reference number
- `created_at`, `updated_at`, `deleted_at` - Timestamps

### QR Codes Table
- `id` - Primary key
- `code` - Unique code for QR
- `content` - URL or text to encode
- `title`, `description` - Optional metadata
- `size`, `format`, `color`, `background_color`, `error_correction` - QR settings
- `image_data` - Base64 encoded QR image
- `use_count`, `last_used_at` - Usage tracking
- `expires_at` - Optional expiration
- `client_id`, `appointment_id`, `service_id` - Optional relationships

## Usage

### Payment Management
1. Access `/admin/payments.html`
2. View summary cards (income, expenses, net)
3. Use filters to search payments
4. Click "+ Nuevo Pago" or "+ Nuevo Gasto" to add transactions
5. Export to CSV for external reporting

### QR Code Generation
1. Access `/admin/qr-generator.html`
2. Enter content (URL or text)
3. Customize size, colors, format
4. Use templates for common use cases
5. Download, copy link, or share QR codes

## Integration Points

### With Services
- View payment statistics in service details
- Link payments to specific services

### With Appointments
- Mark appointments as paid
- Generate QR codes for appointment confirmations

### With Clients
- View client payment history
- Generate client profile QR codes

## Security Notes
- Admin authentication required for all endpoints
- QR codes can be set to expire
- Payment records are soft-deleted
- All scans are logged for audit trail
# ConsentService Test Suite

## Overview

Comprehensive test suite for the shared `ConsentService` that validates all consent save scenarios including success cases, error handling, and edge cases.

## Running the Tests

### Method 1: Test Runner Page (Recommended)

1. Open your browser and navigate to:
   ```
   http://localhost:8000/admin/test-consent-service.html
   ```

2. Click the "Run Tests" button

3. View the results in the console output

### Method 2: Browser Console

1. Open any admin page that loads `consent-service.js`
2. Open the browser developer console (F12)
3. Run:
   ```javascript
   runConsentServiceTests()
   ```

## Test Coverage

### ✅ Test Cases Included

1. **testSuccessfulConsentCreation**
   - Creates a new consent with signature
   - Verifies correct API calls (POST consent, PUT signature)
   - Validates response data

2. **testConsentCreationFailure**
   - Simulates consent creation failure (400 error)
   - Verifies error is thrown
   - Ensures no signature upload is attempted

3. **testSignatureUploadFailure**
   - Consent created successfully but signature upload fails
   - Verifies error message includes consent ID
   - Ensures user can recover by editing the consent

4. **testConsentUpdate**
   - Updates existing consent (edit mode)
   - Verifies PUT method is used
   - Validates signature update

5. **testConsentWithoutSignature**
   - Creates consent without signature
   - Verifies only consent creation call is made
   - No signature upload attempted

6. **testConsentWithSessions**
   - Creates consent with signature and session records
   - Verifies all 3 API calls (consent, signature, session)
   - Validates session creation payload

7. **testInvalidSignature**
   - Rejects invalid signature data
   - Throws error before making any API calls
   - Prevents bad data from reaching the server

## Backend Verification

### Signature Upload Endpoint

The backend endpoint `/consents/{consent_id}/signature` (PUT):

```python
@app.put("/consents/{consent_id}/signature")
async def update_consent_signature(
    consent_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)
):
    """Upload signature image for a consent - stores base64 in database."""
    consent = db.get(models.Consent, consent_id)
    if not consent:
        raise HTTPException(status_code=404, detail="Consent not found")

    # Validate file type
    if file.content_type not in ["image/png", "image/jpeg"]:
        raise HTTPException(
            status_code=400, detail="Only PNG and JPEG images are allowed"
        )

    # Read file and convert to base64
    content = await file.read()
    import base64

    base64_content = base64.b64encode(content).decode("utf-8")
    mime_type = file.content_type

    # Store base64 directly in database
    consent.signature_image_path = base64_content
    consent.signature_mime_type = mime_type
    db.add(consent)
    db.commit()
    db.refresh(consent)

    return {"signature_stored": True, "signature_mime_type": mime_type}
```

**Verified Behavior**:
- ✅ Accepts PNG and JPEG files
- ✅ Converts to base64 and stores in database
- ✅ Stores MIME type for proper display
- ✅ Returns success confirmation
- ✅ Same behavior as before - no breaking changes

## Expected Test Results

When all tests pass, you should see:

```
=== Running ConsentService Tests ===

Test: Successful consent creation with signature
✓ Test passed: Successful consent creation

Test: Consent creation failure
✓ Test passed: Consent creation failure handled correctly

Test: Signature upload failure after consent creation
✓ Test passed: Signature upload failure handled correctly
  Error message: Consentimiento guardado (ID: 123) pero la firma no se pudo subir...

Test: Consent update (edit mode)
✓ Test passed: Consent update

Test: Consent creation without signature
✓ Test passed: Consent without signature

Test: Consent creation with session creation
✓ Test passed: Consent with session creation

Test: Invalid signature data
✓ Test passed: Invalid signature rejected

=== Test Results ===
✓ Passed: 7
❌ Failed: 0
Total: 7
```

## Error Scenarios Tested

### 1. Consent Creation Fails (400/500)
- **Behavior**: Operation stops immediately
- **Result**: No consent created, no signature uploaded
- **User sees**: "No se pudo guardar el consentimiento (400)"

### 2. Signature Upload Fails After Consent Created
- **Behavior**: Consent exists in DB, signature upload fails
- **Result**: Consent saved without signature
- **User sees**: "Consentimiento guardado (ID: 123) pero la firma no se pudo subir. Por favor, edita el consentimiento para agregar la firma."
- **Recovery**: User can edit consent #123 to add signature

### 3. Session Creation Fails
- **Behavior**: Consent and signature saved, session creation fails
- **Result**: Consent and signature are saved successfully
- **User sees**: Success message (session failure is logged but doesn't fail operation)

### 4. Invalid Signature Data
- **Behavior**: Validation fails before any API calls
- **Result**: Nothing is saved
- **User sees**: "Firma inválida"

## Integration Testing

To test with real backend:

1. Start the backend server
2. Open `admin/test-consent-service.html`
3. Modify the test to use real API calls (remove mocks)
4. Run tests against actual database

**Warning**: Integration tests will create real data in the database. Use a test database!

## Continuous Testing

Add these tests to your CI/CD pipeline:

```bash
# Run tests in headless browser
npm run test:consent-service
```

## Troubleshooting

### Tests fail with "ConsentService not found"
- Ensure `consent-service.js` is loaded before the test file
- Check browser console for script loading errors

### Tests fail with "API configuration not found"
- Ensure `app-config.js` is loaded
- Check that `window.APP_CONFIG.API_BASE_URL` is set

### Mock responses not working
- Check that `mockResponses` array has enough responses
- Verify the order of mock responses matches API call order

## Files

- `static/js/consent-service.js` - The service being tested
- `static/js/consent-service.test.js` - Test suite
- `admin/test-consent-service.html` - Test runner page
- `backend/app/main.py` - Backend signature endpoint (line 819)

## Next Steps

1. Run the tests to verify everything works
2. Add more test cases as needed
3. Consider adding integration tests with real backend
4. Set up automated testing in CI/CD pipeline

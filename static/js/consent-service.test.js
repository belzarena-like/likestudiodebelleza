/* consent-service.test.js - Tests for consent service */

/**
 * Test suite for ConsentService
 * 
 * To run these tests:
 * 1. Open the browser console on any admin page that loads consent-service.js
 * 2. Copy and paste this entire file into the console
 * 3. Run: runConsentServiceTests()
 */

(function(window) {
  'use strict';

  // Mock fetch for testing
  let originalFetch;
  let mockResponses = [];
  let fetchCalls = [];

  function setupMockFetch() {
    originalFetch = window.fetch;
    fetchCalls = [];
    
    window.fetch = async function(url, options) {
      fetchCalls.push({ url, options });
      
      const mockResponse = mockResponses.shift();
      if (!mockResponse) {
        throw new Error('No mock response configured for: ' + url);
      }
      
      return {
        ok: mockResponse.ok,
        status: mockResponse.status,
        json: async () => mockResponse.data,
        text: async () => mockResponse.text || JSON.stringify(mockResponse.data)
      };
    };
  }

  function teardownMockFetch() {
    window.fetch = originalFetch;
    mockResponses = [];
    fetchCalls = [];
  }

  function addMockResponse(ok, status, data, text = null) {
    mockResponses.push({ ok, status, data, text });
  }

  // Test utilities
  function assert(condition, message) {
    if (!condition) {
      throw new Error('Assertion failed: ' + message);
    }
  }

  function assertEquals(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`${message}\nExpected: ${expected}\nActual: ${actual}`);
    }
  }

  function assertContains(str, substring, message) {
    if (!str.includes(substring)) {
      throw new Error(`${message}\nString "${str}" does not contain "${substring}"`);
    }
  }

  // Generate test signature
  function generateTestSignature() {
    // Create a minimal valid base64 PNG data URL
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  }

  // Test cases
  const tests = {
    
    async testSuccessfulConsentCreation() {
      console.log('Test: Successful consent creation with signature');
      setupMockFetch();
      
      try {
        // Mock consent creation response
        addMockResponse(true, 200, {
          id: 123,
          client_id: 456,
          consent_type: 'aesthetic_treatment'
        });
        
        // Mock signature upload response
        addMockResponse(true, 200, {
          signature_stored: true,
          signature_mime_type: 'image/png'
        });
        
        const payload = {
          consent_type: 'aesthetic_treatment',
          full_name: 'Test User',
          id_number: 'TEST123',
          phone: '123456789',
          email: null,
          treatment_areas: 'Test Treatment',
          medical_conditions: null,
          personalized_risks: null,
          case_particularities: null,
          acceptance_points: ['test'],
          photos_allowed: false,
          signed_at: '2026-04-18',
          therapist_name: 'Test Therapist',
          signature_text: 'Test User'
        };
        
        const result = await window.ConsentService.saveConsent({
          payload,
          consentId: null,
          signatureDataUrl: generateTestSignature()
        });
        
        // Verify consent was created
        assertEquals(result.id, 123, 'Consent ID should be 123');
        assertEquals(fetchCalls.length, 2, 'Should make 2 fetch calls (consent + signature)');
        
        // Verify first call was POST to /consents
        assertContains(fetchCalls[0].url, '/consents', 'First call should be to /consents');
        assertEquals(fetchCalls[0].options.method, 'POST', 'First call should be POST');
        
        // Verify second call was PUT to /consents/123/signature
        assertContains(fetchCalls[1].url, '/consents/123/signature', 'Second call should be to signature endpoint');
        assertEquals(fetchCalls[1].options.method, 'PUT', 'Second call should be PUT');
        
        console.log('✓ Test passed: Successful consent creation');
      } finally {
        teardownMockFetch();
      }
    },

    async testConsentCreationFailure() {
      console.log('Test: Consent creation failure');
      setupMockFetch();
      
      try {
        // Mock consent creation failure
        addMockResponse(false, 400, { detail: 'Invalid data' }, 'Invalid data');
        
        const payload = {
          consent_type: 'aesthetic_treatment',
          full_name: 'Test User'
        };
        
        let errorThrown = false;
        try {
          await window.ConsentService.saveConsent({
            payload,
            consentId: null,
            signatureDataUrl: generateTestSignature()
          });
        } catch (error) {
          errorThrown = true;
          assertContains(error.message, 'No se pudo guardar el consentimiento', 'Error message should mention consent save failure');
        }
        
        assert(errorThrown, 'Should throw error on consent creation failure');
        assertEquals(fetchCalls.length, 1, 'Should only make 1 fetch call (consent creation)');
        
        console.log('✓ Test passed: Consent creation failure handled correctly');
      } finally {
        teardownMockFetch();
      }
    },

    async testSignatureUploadFailure() {
      console.log('Test: Signature upload failure after consent creation');
      setupMockFetch();
      
      try {
        // Mock successful consent creation
        addMockResponse(true, 200, {
          id: 123,
          client_id: 456,
          consent_type: 'aesthetic_treatment'
        });
        
        // Mock signature upload failure
        addMockResponse(false, 500, { detail: 'Upload failed' }, 'Upload failed');
        
        const payload = {
          consent_type: 'aesthetic_treatment',
          full_name: 'Test User',
          id_number: 'TEST123',
          phone: '123456789',
          email: null,
          treatment_areas: 'Test Treatment',
          medical_conditions: null,
          personalized_risks: null,
          case_particularities: null,
          acceptance_points: ['test'],
          photos_allowed: false,
          signed_at: '2026-04-18',
          therapist_name: 'Test Therapist',
          signature_text: 'Test User'
        };
        
        let errorThrown = false;
        let errorMessage = '';
        try {
          await window.ConsentService.saveConsent({
            payload,
            consentId: null,
            signatureDataUrl: generateTestSignature()
          });
        } catch (error) {
          errorThrown = true;
          errorMessage = error.message;
          assertContains(error.message, 'ID: 123', 'Error should include consent ID');
          assertContains(error.message, 'firma no se pudo subir', 'Error should mention signature upload failure');
        }
        
        assert(errorThrown, 'Should throw error on signature upload failure');
        assertEquals(fetchCalls.length, 2, 'Should make 2 fetch calls');
        
        console.log('✓ Test passed: Signature upload failure handled correctly');
        console.log('  Error message:', errorMessage);
      } finally {
        teardownMockFetch();
      }
    },

    async testConsentUpdate() {
      console.log('Test: Consent update (edit mode)');
      setupMockFetch();
      
      try {
        // Mock consent update response
        addMockResponse(true, 200, {
          id: 123,
          client_id: 456,
          consent_type: 'aesthetic_treatment'
        });
        
        // Mock signature upload response
        addMockResponse(true, 200, {
          signature_stored: true,
          signature_mime_type: 'image/png'
        });
        
        const payload = {
          consent_type: 'aesthetic_treatment',
          full_name: 'Updated User',
          id_number: 'TEST123',
          phone: '123456789',
          email: null,
          treatment_areas: 'Updated Treatment',
          medical_conditions: null,
          personalized_risks: null,
          case_particularities: null,
          acceptance_points: ['test'],
          photos_allowed: false,
          signed_at: '2026-04-18',
          therapist_name: 'Test Therapist',
          signature_text: 'Updated User'
        };
        
        const result = await window.ConsentService.saveConsent({
          payload,
          consentId: 123,
          signatureDataUrl: generateTestSignature()
        });
        
        assertEquals(result.id, 123, 'Consent ID should be 123');
        assertEquals(fetchCalls.length, 2, 'Should make 2 fetch calls');
        
        // Verify first call was PUT to /consents/123
        assertContains(fetchCalls[0].url, '/consents/123', 'First call should be to /consents/123');
        assertEquals(fetchCalls[0].options.method, 'PUT', 'First call should be PUT');
        
        console.log('✓ Test passed: Consent update');
      } finally {
        teardownMockFetch();
      }
    },

    async testConsentWithoutSignature() {
      console.log('Test: Consent creation without signature');
      setupMockFetch();
      
      try {
        // Mock consent creation response
        addMockResponse(true, 200, {
          id: 123,
          client_id: 456,
          consent_type: 'aesthetic_treatment'
        });
        
        const payload = {
          consent_type: 'aesthetic_treatment',
          full_name: 'Test User',
          id_number: 'TEST123',
          phone: '123456789',
          email: null,
          treatment_areas: 'Test Treatment',
          medical_conditions: null,
          personalized_risks: null,
          case_particularities: null,
          acceptance_points: ['test'],
          photos_allowed: false,
          signed_at: '2026-04-18',
          therapist_name: 'Test Therapist',
          signature_text: 'Test User'
        };
        
        const result = await window.ConsentService.saveConsent({
          payload,
          consentId: null,
          signatureDataUrl: null  // No signature
        });
        
        assertEquals(result.id, 123, 'Consent ID should be 123');
        assertEquals(fetchCalls.length, 1, 'Should only make 1 fetch call (no signature upload)');
        
        console.log('✓ Test passed: Consent without signature');
      } finally {
        teardownMockFetch();
      }
    },

    async testConsentWithSessions() {
      console.log('Test: Consent creation with session creation');
      setupMockFetch();
      
      try {
        // Mock consent creation response
        addMockResponse(true, 200, {
          id: 123,
          client_id: 456,
          consent_type: 'aesthetic_treatment'
        });
        
        // Mock signature upload response
        addMockResponse(true, 200, {
          signature_stored: true,
          signature_mime_type: 'image/png'
        });
        
        // Mock session creation response
        addMockResponse(true, 200, {
          id: 789,
          client_id: 456,
          treatment_name: 'Test Treatment',
          planned_sessions: 5
        });
        
        const payload = {
          consent_type: 'aesthetic_treatment',
          full_name: 'Test User',
          id_number: 'TEST123',
          phone: '123456789',
          email: null,
          treatment_areas: 'Test Treatment',
          medical_conditions: null,
          personalized_risks: null,
          case_particularities: null,
          acceptance_points: ['test'],
          photos_allowed: false,
          signed_at: '2026-04-18',
          therapist_name: 'Test Therapist',
          signature_text: 'Test User'
        };
        
        const result = await window.ConsentService.saveConsent({
          payload,
          consentId: null,
          signatureDataUrl: generateTestSignature(),
          plannedSessions: 5,
          treatmentName: 'Test Treatment'
        });
        
        assertEquals(result.id, 123, 'Consent ID should be 123');
        assertEquals(fetchCalls.length, 3, 'Should make 3 fetch calls (consent + signature + session)');
        
        // Verify third call was POST to /sessions/upsert
        assertContains(fetchCalls[2].url, '/sessions/upsert', 'Third call should be to sessions endpoint');
        assertEquals(fetchCalls[2].options.method, 'POST', 'Third call should be POST');
        
        console.log('✓ Test passed: Consent with session creation');
      } finally {
        teardownMockFetch();
      }
    },

    async testInvalidSignature() {
      console.log('Test: Invalid signature data');
      setupMockFetch();
      
      try {
        const payload = {
          consent_type: 'aesthetic_treatment',
          full_name: 'Test User',
          id_number: 'TEST123',
          phone: '123456789',
          email: null,
          treatment_areas: 'Test Treatment',
          medical_conditions: null,
          personalized_risks: null,
          case_particularities: null,
          acceptance_points: ['test'],
          photos_allowed: false,
          signed_at: '2026-04-18',
          therapist_name: 'Test Therapist',
          signature_text: 'Test User'
        };
        
        let errorThrown = false;
        try {
          await window.ConsentService.saveConsent({
            payload,
            consentId: null,
            signatureDataUrl: 'data:image/png;base64,'  // Invalid - no data
          });
        } catch (error) {
          errorThrown = true;
          assertContains(error.message, 'Firma inválida', 'Error should mention invalid signature');
        }
        
        assert(errorThrown, 'Should throw error for invalid signature');
        assertEquals(fetchCalls.length, 0, 'Should not make any fetch calls');
        
        console.log('✓ Test passed: Invalid signature rejected');
      } finally {
        teardownMockFetch();
      }
    }
  };

  // Test runner
  async function runConsentServiceTests() {
    console.log('=== Running ConsentService Tests ===\n');
    
    if (!window.ConsentService) {
      console.error('❌ ConsentService not found! Make sure consent-service.js is loaded.');
      return;
    }
    
    if (!window.APP_CONFIG) {
      window.APP_CONFIG = { API_BASE_URL: 'http://test-api' };
      console.log('⚠️  Created mock APP_CONFIG for testing');
    }
    
    let passed = 0;
    let failed = 0;
    const failures = [];
    
    for (const [testName, testFn] of Object.entries(tests)) {
      try {
        await testFn();
        passed++;
      } catch (error) {
        failed++;
        failures.push({ testName, error });
        console.error(`❌ Test failed: ${testName}`);
        console.error('   Error:', error.message);
        console.error('   Stack:', error.stack);
      }
    }
    
    console.log('\n=== Test Results ===');
    console.log(`✓ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Total: ${passed + failed}`);
    
    if (failures.length > 0) {
      console.log('\n=== Failed Tests ===');
      failures.forEach(({ testName, error }) => {
        console.log(`\n${testName}:`);
        console.log(`  ${error.message}`);
      });
    }
    
    return { passed, failed, failures };
  }

  // Export to window
  window.runConsentServiceTests = runConsentServiceTests;
  
  console.log('ConsentService tests loaded. Run: runConsentServiceTests()');

})(window);

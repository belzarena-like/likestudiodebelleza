/* consent-service.js - Shared consent save functionality */
(function (window) {
  'use strict';

  /**
   * Saves a consent form (create or update) with signature upload
   * @param {Object} options - Configuration options
   * @param {Object} options.payload - The consent data payload
   * @param {string|null} options.consentId - Existing consent ID for updates (null for new)
   * @param {string|null} options.signatureDataUrl - Base64 signature image data URL
   * @param {number|null} options.plannedSessions - Number of planned sessions (optional)
   * @param {string|null} options.treatmentName - Treatment name for sessions (optional)
   * @returns {Promise<Object>} The saved consent object
   */
  async function saveConsent(options) {
    const {
      payload,
      consentId = null,
      signatureDataUrl = null,
      plannedSessions = null,
      treatmentName = null
    } = options;

    if (!window.APP_CONFIG || !window.APP_CONFIG.API_BASE_URL) {
      throw new Error('API configuration not found');
    }

    let consent = null;
    let signatureUploaded = false;

    try {
      // Step 1: Upload signature first if provided (for new consents)
      // This ensures we don't create a consent without a signature
      if (signatureDataUrl && !consentId) {
        console.log('Preparing signature for upload...');
        // We'll upload after consent creation, but validate the signature first
        const base64Data = signatureDataUrl.split(',')[1];
        if (!base64Data) {
          throw new Error('Firma inválida');
        }
      }

      // Step 2: Save or update the consent
      const url = `${window.APP_CONFIG.API_BASE_URL}/consents${consentId ? '/' + consentId : ''}`;
      const method = consentId ? 'PUT' : 'POST';
      
      console.log(`${method} consent:`, { url, payload });
      
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let errorMessage = 'No se pudo guardar el consentimiento';
        try {
          const errorData = await response.json();
          if (errorData.detail) {
            errorMessage = errorData.detail;
          }
        } catch (e) {
          // If JSON parsing fails, try text
          const errorText = await response.text();
          if (errorText) {
            errorMessage = errorText;
          }
        }
        console.error('Consent save failed:', response.status, errorMessage);
        throw new Error(errorMessage);
      }

      consent = await response.json();
      console.log('Consent saved:', consent);

      // Step 3: Upload signature image immediately after consent creation
      if (signatureDataUrl) {
        const base64Data = signatureDataUrl.split(',')[1];
        const blob = new Blob(
          [Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))],
          { type: 'image/png' }
        );
        const formData = new FormData();
        formData.append('file', blob, 'signature.png');
        
        const signatureResponse = await fetch(
          `${window.APP_CONFIG.API_BASE_URL}/consents/${consent.id}/signature`,
          {
            method: 'PUT',
            body: formData
          }
        );

        if (!signatureResponse.ok) {
          const errorText = await signatureResponse.text();
          console.error('Signature upload failed:', signatureResponse.status, errorText);
          throw new Error('No se pudo guardar la firma. El consentimiento fue creado pero sin firma.');
        }
        
        signatureUploaded = true;
        console.log('Signature uploaded successfully');
      }

      // Step 4: Create session record if planned sessions provided
      if (plannedSessions && !isNaN(plannedSessions) && treatmentName) {
        try {
          const sessionResponse = await fetch(
            `${window.APP_CONFIG.API_BASE_URL}/sessions/upsert`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                client_id: consent.client_id,
                treatment_name: treatmentName,
                planned_sessions: plannedSessions,
                status: 'planned',
                notes: null
              })
            }
          );

          if (!sessionResponse.ok) {
            console.warn('Session creation failed, but consent was saved');
          } else {
            console.log('Session record created successfully');
          }
        } catch (sessionError) {
          console.error('Error creating session:', sessionError);
          // Don't throw - consent and signature are already saved
        }
      }

      return consent;

    } catch (error) {
      // If consent was created but signature upload failed, inform the user
      if (consent && !signatureUploaded && signatureDataUrl) {
        console.error('Consent created but signature upload failed:', error);
        throw new Error(`Consentimiento guardado (ID: ${consent.id}) pero la firma no se pudo subir. Por favor, edita el consentimiento para agregar la firma.`);
      }
      throw error;
    }
  }

  /**
   * Loads an existing consent for editing
   * @param {number} consentId - The consent ID to load
   * @returns {Promise<Object>} The consent data
   */
  async function loadConsent(consentId) {
    if (!window.APP_CONFIG || !window.APP_CONFIG.API_BASE_URL) {
      throw new Error('API configuration not found');
    }

    const token = window.likestudioGetAuthToken() || '';
    const response = await fetch(
      `${window.APP_CONFIG.API_BASE_URL}/admin/consents/${consentId}`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );

    if (!response.ok) {
      throw new Error('No se pudo cargar el consentimiento');
    }

    return await response.json();
  }

  /**
   * Prepares signature URL for display
   * @param {string} signaturePath - The signature image path
   * @param {string|null} mimeType - The MIME type of the signature
   * @returns {string} Data URL for the signature
   */
  function prepareSignatureUrl(signaturePath, mimeType = null) {
    if (!signaturePath) return null;
    
    if (signaturePath.startsWith('data:')) {
      return signaturePath;
    }
    
    const mime = mimeType || 'image/png';
    return `data:${mime};base64,${signaturePath}`;
  }

  // Export to window
  window.ConsentService = {
    saveConsent,
    loadConsent,
    prepareSignatureUrl
  };

})(window);

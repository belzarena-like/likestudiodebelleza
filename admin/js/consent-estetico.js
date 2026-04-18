/* consent-estetico.js */
(function () {
  'use strict';

  const form      = document.getElementById('estetico-form');
  const message   = document.getElementById('form-message');
  const submitBtn = form.querySelector('button[type="submit"]');
  const required  = form.querySelectorAll('input[type="checkbox"][required]');
  const consentId = new URLSearchParams(window.location.search).get('consent_id');
  const isEditMode = new URLSearchParams(window.location.search).get('mode') === 'edit';

  document.getElementById('signed_at').valueAsDate = new Date();

  // Load existing consent data if in edit mode
  if (consentId && isEditMode && window.APP_CONFIG) {
    fetch(`${window.APP_CONFIG.API_BASE_URL}/admin/consents/${consentId}`, {
      headers: { 'Authorization': 'Bearer ' + (window.LIKESTUDIO_ADMIN_TOKEN || '') }
    })
    .then(r => r.json())
    .then(consent => {
      if (consent.client_name) {
        const parts = consent.client_name.split(' ');
        document.getElementById('full_name').value = parts[0] || '';
        document.getElementById('last_name').value = parts.slice(1).join(' ') || '';
      }
      if (consent.client_id_number) document.getElementById('dni').value = consent.client_id_number;
      if (consent.client_phone) document.getElementById('phone').value = consent.client_phone;
      if (consent.client_email) document.getElementById('email').value = consent.client_email;
      if (consent.treatment_areas) document.getElementById('treatment').value = consent.treatment_areas;
      if (consent.signed_at) document.getElementById('signed_at').value = consent.signed_at;
      if (consent.therapist_name) document.getElementById('therapist_name').value = consent.therapist_name;
      if (consent.signature_image_path && window.loadSignature) {
        let signatureUrl = consent.signature_image_path;
        if (!signatureUrl.startsWith('data:') && consent.signature_mime_type) {
          signatureUrl = `data:${consent.signature_mime_type};base64,${signatureUrl}`;
        } else if (!signatureUrl.startsWith('data:')) {
          signatureUrl = `data:image/png;base64,${signatureUrl}`;
        }
        window.loadSignature(signatureUrl);
      }
      window.LIKESTUDIO_CONSENT_META = window.LIKESTUDIO_CONSENT_META || {};
      window.LIKESTUDIO_CONSENT_META.client_id_number = consent.client_id_number;
    })
    .catch(err => console.error('Error loading consent:', err));
  }

  // Load services into treatment select
  const treatmentSelect = document.getElementById('treatment');
  if (window.LikeStudioWidgets && window.LikeStudioWidgets.fetchServices) {
    window.LikeStudioWidgets.fetchServices().then(services => {
      window.LikeStudioWidgets.renderServiceSelect(treatmentSelect, services, { placeholder: 'Seleccionar...' });
    });
  }

  function toggleSubmit() {
    submitBtn.disabled = Array.from(required).some(el => !el.checked);
  }
  form.addEventListener('change', toggleSubmit);
  toggleSubmit();

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;
    message.textContent = '';
    
    const data       = new FormData(form);
    const firstName  = data.get('full_name').trim();
    const lastName   = data.get('last_name').trim();
    const fullName   = [firstName, lastName].filter(Boolean).join(' ');
    const idNumber   = data.get('dni').trim();
    const phone      = data.get('phone').trim();
    const treatment  = data.get('treatment').trim();
    const therapist  = data.get('therapist_name').trim();
    const existingId = (window.LIKESTUDIO_CONSENT_META && window.LIKESTUDIO_CONSENT_META.client_id_number) || '';
    const finalId    = idNumber || existingId || ('NO-DOC-' + Date.now());

    // Get signature from canvas
    const signatureDataUrl = window.getSignatureData ? window.getSignatureData() : null;
    
    // Validation
    if (!fullName || !phone || !therapist || !treatment) {
      message.textContent = 'Nombre, teléfono, profesional y tratamiento son obligatorios.';
      submitBtn.disabled = false;
      return;
    }
    if (!signatureDataUrl) {
      message.textContent = 'La firma es obligatoria.';
      submitBtn.disabled = false;
      return;
    }

    const payload = {
      consent_type: 'aesthetic_treatment',
      full_name: fullName,
      id_number: finalId,
      phone,
      email: data.get('email') || null,
      treatment_areas: treatment,
      medical_conditions: JSON.stringify({
        conditions: data.getAll('conditions'),
        history: data.get('history') || null,
        profession: data.get('profession') || null,
        age: data.get('age') || null,
        children: data.get('children') || null,
        lifestyle: data.get('lifestyle') || null,
        sleep_quality: data.get('sleep_quality') || null,
        smoking: data.get('smoking') || null,
        alcohol: data.get('alcohol') || null,
        sports: data.get('sports') || null,
        sessions: data.get('sessions') || null,
        observations: data.get('observations') || null,
        appointment_policy_accepted: data.get('appointment_policy') === 'on'
      }),
      personalized_risks: null,
      case_particularities: null,
      acceptance_points: ['appointment_policy_accepted'],
      photos_allowed: false,
      signed_at: data.get('signed_at'),
      therapist_name: therapist,
      signature_text: fullName
    };

    try {
      // Use shared consent service
      await window.ConsentService.saveConsent({
        payload,
        consentId,
        signatureDataUrl,
        plannedSessions: parseInt(data.get('sessions'), 10),
        treatmentName: treatment
      });
      
      message.textContent = 'Ficha guardada correctamente.';
      setTimeout(() => { window.location.href = 'index.html'; }, 900);
    } catch (err) {
      message.textContent = err.message;
      submitBtn.disabled = false;
    }
  });
})();

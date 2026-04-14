/* consent-micropigmentacion.js */
(function () {
  'use strict';

  const form      = document.getElementById('micropigmentacion-form');
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
      // Fill form fields
      if (consent.client_name) document.getElementById('full_name').value = consent.client_name;
      if (consent.client_id_number) document.getElementById('id_number').value = consent.client_id_number;
      if (consent.client_phone) document.getElementById('phone').value = consent.client_phone;
      if (consent.client_email) document.getElementById('email').value = consent.client_email;
      if (consent.treatment_areas) document.getElementById('areas').value = consent.treatment_areas;
      if (consent.medical_conditions) document.getElementById('medical_conditions').value = consent.medical_conditions;
      if (consent.personalized_risks) document.getElementById('personalized_risks').value = consent.personalized_risks;
      if (consent.case_particularities) document.getElementById('case_particularities').value = consent.case_particularities;
      if (consent.signed_at) document.getElementById('signed_at').value = consent.signed_at;
      if (consent.therapist_name) document.getElementById('therapist_name').value = consent.therapist_name;
      
      // Load signature image if exists
      if (consent.signature_image_path && window.loadSignature) {
        let signatureUrl = consent.signature_image_path;
        if (!signatureUrl.startsWith('data:') && consent.signature_mime_type) {
          signatureUrl = `data:${consent.signature_mime_type};base64,${signatureUrl}`;
        } else if (!signatureUrl.startsWith('data:')) {
          signatureUrl = `data:image/png;base64,${signatureUrl}`;
        }
        window.loadSignature(signatureUrl);
      }
      
      // Store client_id_number for reference
      window.LIKESTUDIO_CONSENT_META = window.LIKESTUDIO_CONSENT_META || {};
      window.LIKESTUDIO_CONSENT_META.client_id_number = consent.client_id_number;
    })
    .catch(err => console.error('Error loading consent:', err));
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
    const fullName   = data.get('full_name').trim();
    const idNumber   = data.get('id_number').trim();
    const phone      = data.get('phone').trim();
    const therapist  = data.get('therapist_name').trim();
    const points     = data.getAll('acceptance_points');
    const existingId = (window.LIKESTUDIO_CONSENT_META && window.LIKESTUDIO_CONSENT_META.client_id_number) || '';
    const finalId    = idNumber || existingId || ('NO-DOC-' + Date.now());

    // Get signature from canvas
    const signatureDataUrl = window.getSignatureData ? window.getSignatureData() : null;
    
    if (!fullName || !phone || !therapist) { message.textContent = 'Nombre, teléfono y profesional son obligatorios.'; submitBtn.disabled = false; return; }
    if (points.length < 6) { message.textContent = 'Debes aceptar todos los puntos obligatorios.'; submitBtn.disabled = false; return; }
    if (!signatureDataUrl) { message.textContent = 'La firma es obligatoria.'; submitBtn.disabled = false; return; }

    const payload = {
      consent_type: 'micropigmentation', full_name: fullName, id_number: finalId,
      phone, email: data.get('email') || null,
      treatment_areas: data.get('areas'),
      medical_conditions: data.get('medical_conditions') || null,
      personalized_risks: data.get('personalized_risks') || null,
      case_particularities: data.get('case_particularities') || null,
      acceptance_points: points,
      photos_allowed: data.get('photos_allowed') === 'on',
      signed_at: data.get('signed_at'), therapist_name: therapist,
      signature_text: fullName  // Use full name as signature text fallback
    };

    try {
      let consent;
      const url = `${window.APP_CONFIG.API_BASE_URL}/consents${consentId ? '/' + consentId : ''}`;
      const r   = await fetch(url, { method: consentId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error('No se pudo guardar.');
      consent = await r.json();
      
      // Upload signature image
      if (signatureDataUrl) {
        const base64Data = signatureDataUrl.split(',')[1];
        const blob = new Blob([Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))], { type: 'image/png' });
        const formData = new FormData();
        formData.append('file', blob, 'signature.png');
        
        await fetch(`${window.APP_CONFIG.API_BASE_URL}/consents/${consent.id}/signature`, {
          method: 'PUT',
          body: formData
        });
      }
      
      message.textContent = 'Consentimiento guardado correctamente.';
      setTimeout(() => { window.location.href = 'index.html'; }, 900);
    } catch (err) { message.textContent = err.message; submitBtn.disabled = false; }
  });
})();

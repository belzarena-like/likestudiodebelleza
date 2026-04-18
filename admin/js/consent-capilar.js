/* consent-capilar.js */
(function () {
  'use strict';

  const form      = document.getElementById('capilar-condiciones-form');
  const message   = document.getElementById('form-message');
  const submitBtn = form.querySelector('button[type="submit"]');
  const required  = form.querySelectorAll('input[type="checkbox"][required]');
  const consentId = new URLSearchParams(window.location.search).get('consent_id');
  const isEditMode = new URLSearchParams(window.location.search).get('mode') === 'edit';

  document.getElementById('signed_at').valueAsDate = new Date();

  // Load existing consent data if in edit mode
  if (consentId && isEditMode && window.APP_CONFIG) {
    fetch(`${window.APP_CONFIG.API_BASE_URL}/admin/consents/${consentId}`, {
      headers: { 'Authorization': 'Bearer ' + window.likestudioGetAuthToken() }
    })
    .then(r => r.json())
    .then(consent => {
      if (consent.client_name) document.getElementById('full_name').value = consent.client_name;
      if (consent.client_id_number) document.getElementById('id_number').value = consent.client_id_number;
      if (consent.client_phone) document.getElementById('phone').value = consent.client_phone;
      if (consent.medical_conditions) {
        try {
          const mc = JSON.parse(consent.medical_conditions);
          if (mc.total_amount) document.getElementById('total_amount').value = mc.total_amount;
          if (mc.reserve_amount) document.getElementById('reserve_amount').value = mc.reserve_amount;
          if (mc.sessions) document.getElementById('sessions_count').value = mc.sessions;
          if (mc.payment_terms) document.getElementById('payment_terms').value = mc.payment_terms;
          if (mc.payments) document.getElementById('payments').value = mc.payments;
        } catch(e) {}
      }
      if (consent.signed_at) document.getElementById('signed_at').value = consent.signed_at;
      if (consent.therapist_name) document.getElementById('therapist_name').value = consent.therapist_name;
      
      // Restore acceptance_points checkboxes
      if (consent.acceptance_points && Array.isArray(consent.acceptance_points)) {
        consent.acceptance_points.forEach(point => {
          const checkbox = document.querySelector(`input[name="acceptance_points"][value="${point}"]`);
          if (checkbox) checkbox.checked = true;
        });
      }
      
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
    const totalAmt   = data.get('total_amount').trim();
    const therapist  = data.get('therapist_name').trim();
    const points     = data.getAll('acceptance_points');
    const sessions   = parseInt(data.get('sessions_count'), 10);
    const existingId = (window.LIKESTUDIO_CONSENT_META && window.LIKESTUDIO_CONSENT_META.client_id_number) || '';
    const finalId    = idNumber || existingId || ('NO-DOC-' + Date.now());

    // Get signature from canvas
    const signatureDataUrl = window.getSignatureData ? window.getSignatureData() : null;
    
    if (!fullName || !phone || !totalAmt) { message.textContent = 'Nombre, teléfono y valor total son obligatorios.'; submitBtn.disabled = false; return; }
    if (points.length < 3) { message.textContent = 'Debes aceptar todas las condiciones obligatorias.'; submitBtn.disabled = false; return; }
    if (!signatureDataUrl) { message.textContent = 'La firma es obligatoria.'; submitBtn.disabled = false; return; }

    const payload = {
      consent_type: 'micropigmentation_capilar', full_name: fullName, id_number: finalId,
      phone, email: null,
      treatment_areas: 'Micropigmentación capilar - condiciones de pago y reservas',
      medical_conditions: JSON.stringify({ total_amount: totalAmt, reserve_amount: data.get('reserve_amount') || null, payment_terms: data.get('payment_terms') || null, payments: data.get('payments') || null, sessions: isNaN(sessions) ? null : sessions }),
      personalized_risks: null, case_particularities: null,
      acceptance_points: points, photos_allowed: false,
      signed_at: data.get('signed_at'), therapist_name: therapist || 'Like Studio Team',
      signature_text: fullName  // Use full name as signature text fallback
    };

    try {
      // Use shared consent service
      await window.ConsentService.saveConsent({
        payload,
        consentId,
        signatureDataUrl,
        plannedSessions: sessions,
        treatmentName: 'Micropigmentación capilar'
      });
      
      message.textContent = 'Condiciones guardadas correctamente.';
      setTimeout(() => { window.location.href = 'index.html'; }, 900);
    } catch (err) {
      message.textContent = err.message;
      submitBtn.disabled = false;
    }
  });
})();

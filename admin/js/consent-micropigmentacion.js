/* consent-micropigmentacion.js */
(function () {
  'use strict';

  const form      = document.getElementById('micropigmentacion-form');
  const message   = document.getElementById('form-message');
  const submitBtn = form.querySelector('button[type="submit"]');
  const required  = form.querySelectorAll('input[type="checkbox"][required]');
  const consentId = new URLSearchParams(window.location.search).get('consent_id');

  document.getElementById('signed_at').valueAsDate = new Date();

  function toggleSubmit() {
    submitBtn.disabled = Array.from(required).some(el => !el.checked);
  }
  form.addEventListener('change', toggleSubmit);
  toggleSubmit();

  form.addEventListener('submit', async e => {
    e.preventDefault();
    message.textContent = '';
    const data       = new FormData(form);
    const fullName   = data.get('full_name').trim();
    const idNumber   = data.get('id_number').trim();
    const phone      = data.get('phone').trim();
    const signature  = data.get('signature_text').trim();
    const therapist  = data.get('therapist_name').trim();
    const points     = data.getAll('acceptance_points');
    const existingId = (window.LIKESTUDIO_CONSENT_META && window.LIKESTUDIO_CONSENT_META.client_id_number) || '';
    const finalId    = idNumber || existingId || ('NO-DOC-' + Date.now());

    if (!fullName || !phone || !signature || !therapist) { message.textContent = 'Nombre, teléfono, profesional y firma son obligatorios.'; return; }
    if (points.length < 6) { message.textContent = 'Debes aceptar todos los puntos obligatorios.'; return; }

    const payload = {
      consent_type: 'micropigmentation', full_name: fullName, id_number: finalId,
      phone, email: data.get('email') || null,
      treatment_areas: data.get('areas'),
      medical_conditions: data.get('medical_conditions') || null,
      personalized_risks: data.get('personalized_risks') || null,
      case_particularities: data.get('case_particularities') || null,
      acceptance_points: points,
      photos_allowed: data.get('photos_allowed') === 'on',
      signed_at: data.get('signed_at'), therapist_name: therapist, signature_text: signature
    };

    try {
      const url = `${window.APP_CONFIG.API_BASE_URL}/consents${consentId ? '/' + consentId : ''}`;
      const r   = await fetch(url, { method: consentId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error('No se pudo guardar.');
      message.textContent = 'Consentimiento guardado correctamente.';
      setTimeout(() => { window.location.href = 'index.html'; }, 900);
    } catch (err) { message.textContent = err.message; }
  });
})();

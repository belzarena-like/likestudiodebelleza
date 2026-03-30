/* consent-capilar.js */
(function () {
  'use strict';

  const form      = document.getElementById('capilar-condiciones-form');
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
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;
    message.textContent = '';
    const data       = new FormData(form);
    const fullName   = data.get('full_name').trim();
    const idNumber   = data.get('id_number').trim();
    const phone      = data.get('phone').trim();
    const totalAmt   = data.get('total_amount').trim();
    const signature  = data.get('signature_text').trim();
    const therapist  = data.get('therapist_name').trim();
    const points     = data.getAll('acceptance_points');
    const sessions   = parseInt(data.get('sessions_count'), 10);
    const existingId = (window.LIKESTUDIO_CONSENT_META && window.LIKESTUDIO_CONSENT_META.client_id_number) || '';
    const finalId    = idNumber || existingId || ('NO-DOC-' + Date.now());

    if (!fullName || !phone || !signature || !totalAmt) { message.textContent = 'Nombre, teléfono, valor total y firma son obligatorios.'; submitBtn.disabled = false; return; }
    if (points.length < 3) { message.textContent = 'Debes aceptar todas las condiciones obligatorias.'; submitBtn.disabled = false; return; }

    const payload = {
      consent_type: 'micropigmentation_capilar', full_name: fullName, id_number: finalId,
      phone, email: null,
      treatment_areas: 'Micropigmentacion capilar - condiciones de pago y reservas',
      medical_conditions: JSON.stringify({ total_amount: totalAmt, reserve_amount: data.get('reserve_amount') || null, payment_terms: data.get('payment_terms') || null, payments: data.get('payments') || null, sessions: isNaN(sessions) ? null : sessions }),
      personalized_risks: null, case_particularities: null,
      acceptance_points: points, photos_allowed: false,
      signed_at: data.get('signed_at'), therapist_name: therapist || 'Like Studio Team', signature_text: signature
    };

    try {
      const url = `${window.APP_CONFIG.API_BASE_URL}/consents${consentId ? '/' + consentId : ''}`;
      const r   = await fetch(url, { method: consentId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error('No se pudo guardar.');
      const saved = await r.json();
      if (!isNaN(sessions)) {
        await fetch(`${window.APP_CONFIG.API_BASE_URL}/sessions/upsert`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: saved.client_id, treatment_name: 'Micropigmentacion capilar', planned_sessions: sessions, status: 'planned', notes: null })
        });
      }
      message.textContent = 'Condiciones guardadas correctamente.';
      setTimeout(() => { window.location.href = 'index.html'; }, 900);
    } catch (err) { message.textContent = err.message; submitBtn.disabled = false; }
  });
})();

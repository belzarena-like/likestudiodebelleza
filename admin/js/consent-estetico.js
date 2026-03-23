/* consent-estetico.js */
(function () {
  'use strict';

  const form      = document.getElementById('estetico-form');
  const message   = document.getElementById('form-message');
  const submitBtn = form.querySelector('button[type="submit"]');
  const required  = form.querySelectorAll('input[type="checkbox"][required]');
  const consentId = new URLSearchParams(window.location.search).get('consent_id');

  document.getElementById('signed_at').valueAsDate = new Date();

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
    message.textContent = '';
    const data       = new FormData(form);
    const firstName  = data.get('full_name').trim();
    const lastName   = data.get('last_name').trim();
    const fullName   = [firstName, lastName].filter(Boolean).join(' ');
    const idNumber   = data.get('dni').trim();
    const phone      = data.get('phone').trim();
    const treatment  = data.get('treatment').trim();
    const signature  = data.get('signature_text').trim();
    const therapist  = data.get('therapist_name').trim();
    const existingId = (window.LIKESTUDIO_CONSENT_META && window.LIKESTUDIO_CONSENT_META.client_id_number) || '';
    const finalId    = idNumber || existingId || ('NO-DOC-' + Date.now());

    if (!fullName || !phone || !signature || !therapist || !treatment) { message.textContent = 'Nombre, teléfono, profesional, tratamiento y firma son obligatorios.'; return; }

    const payload = {
      consent_type: 'aesthetic_treatment', full_name: fullName, id_number: finalId,
      phone, email: data.get('email') || null,
      treatment_areas: treatment,
      medical_conditions: JSON.stringify({
        conditions: data.getAll('conditions'), history: data.get('history') || null,
        profession: data.get('profession') || null, age: data.get('age') || null,
        children: data.get('children') || null, lifestyle: data.get('lifestyle') || null,
        sleep_quality: data.get('sleep_quality') || null, smoking: data.get('smoking') || null,
        alcohol: data.get('alcohol') || null, sports: data.get('sports') || null,
        sessions: data.get('sessions') || null, observations: data.get('observations') || null,
        appointment_policy_accepted: data.get('appointment_policy') === 'on'
      }),
      personalized_risks: null, case_particularities: null,
      acceptance_points: ['appointment_policy_accepted'],
      photos_allowed: false,
      signed_at: data.get('signed_at'), therapist_name: therapist, signature_text: signature
    };

    try {
      const url = `${window.APP_CONFIG.API_BASE_URL}/consents${consentId ? '/' + consentId : ''}`;
      const r   = await fetch(url, { method: consentId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error('No se pudo guardar.');
      const saved = await r.json();
      const plannedSessions = parseInt(data.get('sessions'), 10);
      if (!isNaN(plannedSessions)) {
        await fetch(`${window.APP_CONFIG.API_BASE_URL}/sessions/upsert`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: saved.client_id, treatment_name: treatment, planned_sessions: plannedSessions, status: 'planned', notes: null })
        });
      }
      message.textContent = 'Ficha guardada correctamente.';
      setTimeout(() => { window.location.href = 'index.html'; }, 900);
    } catch (err) { message.textContent = err.message; }
  });
})();

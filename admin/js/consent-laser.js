/* consent-laser.js */
(function () {
  'use strict';

  const form      = document.getElementById('laser-form');
  const message   = document.getElementById('form-message');
  const submitBtn = form.querySelector('button[type="submit"]');
  const required  = form.querySelectorAll('input[type="checkbox"][required]');
  const consentId = new URLSearchParams(window.location.search).get('consent_id');

  document.getElementById('signed_at').valueAsDate = new Date();

  const treatmentSelect = document.getElementById('treatment_service');
  if (window.LikeStudioWidgets && window.LikeStudioWidgets.fetchServices) {
    window.LikeStudioWidgets.fetchServices().then(services => {
      window.LikeStudioWidgets.renderServiceSelect(treatmentSelect, services, { placeholder: 'Seleccionar...' });
      const preferred = services.find(s => { const n = s.name.toLowerCase(); return n.includes('laser') && (n.includes('depil') || n.includes('depilacion')); })
                     || services.find(s => s.name.toLowerCase().includes('laser'));
      if (preferred && !treatmentSelect.value) treatmentSelect.value = preferred.name;
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
    const data      = new FormData(form);
    const fullName  = data.get('full_name').trim();
    const idNumber  = data.get('id_number').trim();
    const phone     = data.get('phone').trim();
    const service   = data.get('treatment_service').trim();
    const signature = data.get('signature_text').trim();
    const therapist = data.get('therapist_name').trim();
    const points    = data.getAll('acceptance_points');
    const estimated = parseInt(data.get('estimated_sessions'), 10);
    const existingId= (window.LIKESTUDIO_CONSENT_META && window.LIKESTUDIO_CONSENT_META.client_id_number) || '';
    const finalId   = idNumber || existingId || ('NO-DOC-' + Date.now());

    if (!fullName || !phone || !signature || !therapist || !service) { message.textContent = 'Nombre, teléfono, profesional, tratamiento y firma son obligatorios.'; submitBtn.disabled = false; return; }
    if (points.length < 5) { message.textContent = 'Debes aceptar todos los puntos obligatorios.'; submitBtn.disabled = false; return; }

    const payload = {
      consent_type: 'laser', full_name: fullName, id_number: finalId,
      phone, email: data.get('email') || null,
      treatment_areas: `${service} - ${data.get('treatment_area')}`,
      medical_conditions: JSON.stringify({ birth_date: data.get('birth_date'), contraindications: data.get('medical_conditions') || null, estimated_sessions: isNaN(estimated) ? null : estimated }),
      personalized_risks: 'Consentimiento depilacion laser', case_particularities: null,
      acceptance_points: points, photos_allowed: data.get('photos_allowed') === 'on',
      signed_at: data.get('signed_at'), therapist_name: therapist, signature_text: signature
    };

    try {
      const url = `${window.APP_CONFIG.API_BASE_URL}/consents${consentId ? '/' + consentId : ''}`;
      const r   = await fetch(url, { method: consentId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error('No se pudo guardar.');
      const saved = await r.json();
      if (!isNaN(estimated)) {
        await fetch(`${window.APP_CONFIG.API_BASE_URL}/sessions/upsert`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: saved.client_id, treatment_name: service, planned_sessions: estimated, status: 'planned', notes: null })
        });
      }
      message.textContent = 'Consentimiento de depilación láser guardado correctamente.';
      setTimeout(() => { window.location.href = 'index.html'; }, 900);
    } catch (err) { message.textContent = err.message; submitBtn.disabled = false; }
  });
})();

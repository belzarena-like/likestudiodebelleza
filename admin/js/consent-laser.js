/* consent-laser.js */
(function () {
  'use strict';

  const form      = document.getElementById('laser-form');
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
      if (consent.client_name) document.getElementById('full_name').value = consent.client_name;
      if (consent.client_id_number) document.getElementById('id_number').value = consent.client_id_number;
      if (consent.client_phone) document.getElementById('phone').value = consent.client_phone;
      if (consent.client_email) document.getElementById('email').value = consent.client_email;
      if (consent.treatment_areas) {
        const parts = consent.treatment_areas.split(' - ');
        if (parts[0]) document.getElementById('treatment_service').value = parts[0];
        if (parts[1]) document.getElementById('treatment_area').value = parts[1];
      }
      if (consent.medical_conditions) {
        try {
          const mc = JSON.parse(consent.medical_conditions);
          if (mc.birth_date) document.getElementById('birth_date').value = mc.birth_date;
          if (mc.estimated_sessions) document.getElementById('estimated_sessions').value = mc.estimated_sessions;
        } catch(e) {}
      }
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
    const therapist = data.get('therapist_name').trim();
    const points    = data.getAll('acceptance_points');
    const estimated = parseInt(data.get('estimated_sessions'), 10);
    const existingId= (window.LIKESTUDIO_CONSENT_META && window.LIKESTUDIO_CONSENT_META.client_id_number) || '';
    const finalId   = idNumber || existingId || ('NO-DOC-' + Date.now());

    // Get signature from canvas
    const signatureDataUrl = window.getSignatureData ? window.getSignatureData() : null;
    
    if (!fullName || !phone || !therapist || !service) { message.textContent = 'Nombre, teléfono, profesional y tratamiento son obligatorios.'; submitBtn.disabled = false; return; }
    if (points.length < 5) { message.textContent = 'Debes aceptar todos los puntos obligatorios.'; submitBtn.disabled = false; return; }
    if (!signatureDataUrl) { message.textContent = 'La firma es obligatoria.'; submitBtn.disabled = false; return; }

    const payload = {
      consent_type: 'laser', full_name: fullName, id_number: finalId,
      phone, email: data.get('email') || null,
      treatment_areas: `${service} - ${data.get('treatment_area')}`,
      medical_conditions: JSON.stringify({ birth_date: data.get('birth_date'), contraindications: data.get('medical_conditions') || null, estimated_sessions: isNaN(estimated) ? null : estimated }),
      personalized_risks: 'Consentimiento depilación láser', case_particularities: null,
      acceptance_points: points, photos_allowed: data.get('photos_allowed') === 'on',
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
      
      if (!isNaN(estimated)) {
        await fetch(`${window.APP_CONFIG.API_BASE_URL}/sessions/upsert`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: consent.client_id, treatment_name: service, planned_sessions: estimated, status: 'planned', notes: null })
        });
      }
      message.textContent = 'Consentimiento de depilación láser guardado correctamente.';
      setTimeout(() => { window.location.href = 'index.html'; }, 900);
    } catch (err) { message.textContent = err.message; submitBtn.disabled = false; }
  });
})();

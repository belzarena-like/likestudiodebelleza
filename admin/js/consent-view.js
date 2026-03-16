/* consent-view.js */
(function () {
  'use strict';

  function byId(id) { return document.getElementById(id); }
  function textOrDash(v) { return v ? String(v) : '—'; }
  function clientIdLabel(v) { const id = String(v || ''); return id.startsWith('NO-DOC-') ? '—' : textOrDash(id); }
  function typeLabel(v) {
    return ({ micropigmentation: 'Micropigmentacion', micropigmentation_capilar: 'Micropigmentacion capilar', aesthetic_treatment: 'Tratamiento estetico', laser: 'Laser' })[v] || v;
  }

  function printTemplatePath(c) {
    if (c.consent_type === 'micropigmentation') {
      const area = String(c.treatment_areas || '').toLowerCase();
      return area.startsWith('micropigmentacion capilar - condiciones') ? 'consent-capilar-condiciones.html' : 'consent-micropigmentacion.html';
    }
    if (c.consent_type === 'micropigmentation_capilar') return 'consent-capilar-condiciones.html';
    if (c.consent_type === 'aesthetic_treatment')       return 'consent-estetico.html';
    if (c.consent_type === 'laser') {
      return String(c.treatment_areas || '').toLowerCase().startsWith('eliminacion tatuaje') ? 'consent-eliminacion-laser.html' : 'consent-laser.html';
    }
    return null;
  }

  async function loadDetail() {
    const loading = byId('loading');
    const content = byId('content');
    const id = new URLSearchParams(window.location.search).get('id');
    if (!id) { loading.textContent = 'Falta el id del consentimiento.'; return; }
    try {
      const r = await fetch(`${window.APP_CONFIG.API_BASE_URL}/admin/consents/${id}`);
      if (!r.ok) throw new Error('No se pudo cargar el consentimiento.');
      const c = await r.json();

      byId('v-id').textContent        = c.id;
      byId('v-signed-at').textContent = textOrDash(c.signed_at);
      byId('v-type').textContent      = typeLabel(c.consent_type);
      byId('v-therapist').textContent = textOrDash(c.therapist_name);
      byId('v-client').textContent    = textOrDash(c.client_name);
      byId('v-id-number').textContent = clientIdLabel(c.client_id_number);
      byId('v-phone').textContent     = textOrDash(c.client_phone);
      byId('v-email').textContent     = textOrDash(c.client_email);
      byId('v-photos').textContent    = c.photos_allowed ? 'Sí' : 'No';
      byId('v-signature').textContent = textOrDash(c.signature_text);
      byId('v-treatment').textContent = textOrDash(c.treatment_areas);
      byId('v-medical').textContent   = textOrDash(c.medical_conditions);
      byId('v-risks').textContent     = textOrDash(c.personalized_risks);
      byId('v-case').textContent      = textOrDash(c.case_particularities);

      const points = Array.isArray(c.acceptance_points) ? c.acceptance_points : [];
      byId('v-points').innerHTML = points.length ? points.map(p => `<li>${p}</li>`).join('') : '<li>—</li>';

      const path = printTemplatePath(c);
      const viewBtn        = byId('view-original');
      const originalPdfBtn = byId('download-original-pdf');
      const editBtn        = byId('edit-original');
      const pdfBtn         = byId('download-summary-pdf');

      if (path) {
        viewBtn.onclick        = () => window.open(`${path}?consent_id=${c.id}`, '_blank', 'noopener');
        originalPdfBtn.onclick = () => window.open(`${path}?consent_id=${c.id}&autopdf=1`, '_blank', 'noopener');
        editBtn.onclick        = () => window.open(`${path}?consent_id=${c.id}&mode=edit`, '_blank', 'noopener');
      } else {
        viewBtn.disabled = originalPdfBtn.disabled = editBtn.disabled = true;
      }

      pdfBtn.onclick = () => {
        const options = { margin: 8, filename: `consentimiento-${c.id}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: ['css', 'legacy'] } };
        html2pdf().set(options).from(byId('content')).save();
      };

      loading.style.display = 'none';
      content.style.display = 'block';
    } catch (e) { loading.textContent = e.message; }
  }

  loadDetail();
})();

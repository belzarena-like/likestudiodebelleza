/* consent-selector.js */
(function () {
  'use strict';

  const STORAGE_KEY = 'likestudio_client_prefill_v1';
  const API = () => window.APP_CONFIG.API_BASE_URL;

  const dayListDate         = document.getElementById('consent-daylist-date');
  const dayListProfessional = document.getElementById('consent-daylist-professional');
  const dayListRefresh      = document.getElementById('consent-daylist-refresh');
  const dayListItems        = document.getElementById('consent-daylist-items');
  const dayListMessage      = document.getElementById('consent-daylist-message');
  const selectedClient      = document.getElementById('selected-client');
  const clearClient         = document.getElementById('clear-client');
  const consentType         = document.getElementById('consent-type');
  const professionalInput   = document.getElementById('professional');
  const openConsent         = document.getElementById('open-consent');
  const consentMessage      = document.getElementById('consent-message');

  function localDateString(d) {
    const base = d || new Date();
    return `${base.getFullYear()}-${String(base.getMonth()+1).padStart(2,'0')}-${String(base.getDate()).padStart(2,'0')}`;
  }

  function readStored()       { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; } }
  function storePrefill(data) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {} }
  function clearPrefill()     { try { localStorage.removeItem(STORAGE_KEY); } catch {} }

  function renderSelected(data) {
    if (!data || !data.full_name) { selectedClient.textContent = 'No hay cliente seleccionado.'; return; }
    selectedClient.textContent = [data.full_name, data.phone ? `Tel. ${data.phone}` : null, data.id_number ? `DNI ${data.id_number}` : null].filter(Boolean).join(' · ');
  }

  function guessConsentType(serviceName) {
    const v = String(serviceName || '').toLowerCase();
    if (v.includes('capilar'))                          return 'capilar';
    if (v.includes('eliminacion') || v.includes('tatuaje')) return 'laser-eliminacion';
    if (v.includes('laser') || v.includes('depil'))     return 'laser';
    if (v.includes('estet'))                            return 'estetico';
    return 'micropigmentacion';
  }

  function resolveConsentPath(type) {
    if (type === 'capilar')          return 'consent-capilar-condiciones.html';
    if (type === 'estetico')         return 'consent-estetico.html';
    if (type === 'laser')            return 'consent-laser.html';
    if (type === 'laser-eliminacion')return 'consent-eliminacion-laser.html';
    return 'consent-micropigmentacion.html';
  }

  function applyPrefill(data) {
    if (!data) return;
    storePrefill(data);
    renderSelected(data);
    if (data.service_name) consentType.value = guessConsentType(data.service_name);
    if (data.professional_name && !professionalInput.value) professionalInput.value = data.professional_name;
  }

  async function loadDayList() {
    const dateValue    = dayListDate.value || localDateString();
    const professional = dayListProfessional.value;
    dayListMessage.textContent = 'Cargando citas...';
    dayListItems.innerHTML = '';
    try {
      const params = new URLSearchParams({ start_date: dateValue, end_date: dateValue, appointment_type: 'appointment', limit: '200', offset: '0' });
      const r = await fetch(`${API()}/admin/appointments?${params}`);
      if (!r.ok) throw new Error('No se pudieron cargar las citas.');
      let items = (await r.json()).items || [];
      if (professional) items = items.filter(i => String(i.professional_name || '').toLowerCase() === professional.toLowerCase());
      if (!items.length) { dayListMessage.textContent = 'No hay citas para este día.'; return; }
      dayListMessage.textContent = '';
      dayListItems.innerHTML = items.map(item => {
        const time    = String(item.start_time || '').slice(0, 5);
        const name    = String(item.client_name || 'Cliente').trim();
        const service = String(item.service_name || '').trim();
        const payload = { full_name: name, id_number: '', phone: item.client_phone || '', email: '', service_name: item.service_name || '', professional_name: item.professional_name || '' };
        return `<button class="btn btn-secondary btn-sm" type="button" data-payload='${JSON.stringify(payload).replace(/'/g,"&#39;")}'>
          ${time} · ${name}${service ? ' · ' + service : ''}
        </button>`;
      }).join('');
    } catch (e) { dayListMessage.textContent = e.message; }
  }

  dayListItems.addEventListener('click', e => {
    const btn = e.target.closest('button[data-payload]'); if (!btn) return;
    try { applyPrefill(JSON.parse(btn.getAttribute('data-payload').replace(/&#39;/g, "'"))); } catch {}
  });

  openConsent.addEventListener('click', () => {
    consentMessage.textContent = '';
    const stored = readStored();
    if (!stored.full_name && !stored.phone && !stored.id_number) {
      consentMessage.textContent = 'Selecciona un cliente antes de abrir el consentimiento.'; return;
    }
    window.open(resolveConsentPath(consentType.value), '_blank', 'noopener');
  });

  clearClient.addEventListener('click', () => { clearPrefill(); renderSelected({}); });

  dayListDate.value = localDateString();
  dayListRefresh.addEventListener('click', loadDayList);
  dayListDate.addEventListener('change', loadDayList);
  dayListProfessional.addEventListener('change', loadDayList);

  // Apply URL query prefill
  const urlParams = new URLSearchParams(window.location.search);
  const qp = { full_name: urlParams.get('client_name') || '', id_number: urlParams.get('client_id_number') || '', phone: urlParams.get('client_phone') || '', email: '', service_name: urlParams.get('service_name') || '', professional_name: urlParams.get('professional_name') || '' };
  if (qp.full_name || qp.phone || qp.id_number) applyPrefill(qp);
  else renderSelected(readStored());

  loadDayList();
})();

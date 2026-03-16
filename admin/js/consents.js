/* consents.js — Admin consents page */
(function () {
  'use strict';

  const API = () => `${window.APP_CONFIG.API_BASE_URL}/admin/consents`;
  const LIMIT = 20;
  let offset = 0;
  let lastTotal = 0;

  const form     = document.getElementById('search-form');
  const summary  = document.getElementById('summary');
  const tbody    = document.getElementById('table-body');

  const KIND_MAP = {
    micropigmentation:        'Micropigmentacion',
    micropigmentation_capilar:'Micropigmentacion capilar',
    aesthetic_treatment:      'Tratamiento estetico',
    laser:                    'Depilacion laser'
  };

  function resolveEditPath(item) {
    if (item.consent_type === 'micropigmentation')         return 'consent-micropigmentacion.html';
    if (item.consent_type === 'micropigmentation_capilar') return 'consent-capilar-condiciones.html';
    if (item.consent_type === 'aesthetic_treatment')       return 'consent-estetico.html';
    if (item.consent_type === 'laser') {
      const area = String(item.treatment_areas || '').toLowerCase();
      return area.startsWith('eliminacion tatuaje') ? 'consent-eliminacion-laser.html' : 'consent-laser.html';
    }
    return null;
  }

  function collectParams() {
    const fd = new FormData(form);
    const p  = new URLSearchParams();
    ['full_name','id_number','therapist_name','consent_type','signed_from','signed_to'].forEach(k => {
      const v = fd.get(k); if (v) p.set(k, v);
    });
    p.set('limit', LIMIT); p.set('offset', offset);
    return p;
  }

  function renderRows(items) {
    if (!items.length) {
      tbody.innerHTML = `<tr><td class="admin-table-empty" colspan="7">Sin resultados.</td></tr>`;
      return;
    }
    tbody.innerHTML = items.map(item => {
      const kind     = KIND_MAP[item.consent_type] || item.consent_type;
      const editPath = resolveEditPath(item);
      const editLink = editPath
        ? `<a class="btn btn-secondary btn-sm" href="${editPath}?consent_id=${item.id}&mode=edit" target="_blank" rel="noopener">Editar</a>`
        : `<span class="btn btn-secondary btn-sm" style="opacity:.4">Editar</span>`;
      return `<tr>
        <td data-label="Fecha">${item.signed_at}</td>
        <td data-label="Cliente">${item.client_name}</td>
        <td data-label="DNI/NIE">${item.client_id_number}</td>
        <td data-label="Tipo">${kind}</td>
        <td data-label="Tratamiento">${item.treatment_areas}</td>
        <td data-label="Profesional">${item.therapist_name}</td>
        <td data-label="Acciones"><div class="row-actions">
          <a class="btn btn-secondary btn-sm" href="consent-view.html?id=${item.id}" target="_blank" rel="noopener">Ver</a>
          ${editLink}
        </div></td>
      </tr>`;
    }).join('');
  }

  async function load() {
    summary.textContent = 'Cargando...';
    try {
      const r = await fetch(`${API()}?${collectParams()}`);
      if (!r.ok) throw new Error('No se pudieron obtener los consentimientos.');
      const d = await r.json();
      lastTotal = d.total;
      renderRows(d.items);
      const from = d.total === 0 ? 0 : d.offset + 1;
      const to   = Math.min(d.offset + d.limit, d.total);
      summary.textContent = `Mostrando ${from}–${to} de ${d.total} consentimientos.`;
      document.getElementById('prev').disabled = d.offset <= 0;
      document.getElementById('next').disabled = d.offset + d.limit >= d.total;
    } catch (e) {
      summary.textContent = e.message;
      tbody.innerHTML = '';
    }
  }

  form.addEventListener('submit', e => { e.preventDefault(); offset = 0; load(); });
  document.getElementById('reset').addEventListener('click', () => { form.reset(); offset = 0; load(); });
  document.getElementById('prev').addEventListener('click', () => { offset = Math.max(0, offset - LIMIT); load(); });
  document.getElementById('next').addEventListener('click', () => { if (offset + LIMIT < lastTotal) { offset += LIMIT; load(); } });

  // Apply URL query params
  const urlParams = new URLSearchParams(window.location.search);
  ['full_name','id_number','consent_type','signed_from','signed_to'].forEach(k => {
    const v = urlParams.get(k);
    if (v && form.elements[k]) form.elements[k].value = v;
  });

  const nameInput = document.getElementById('full_name');
  if (window.LikeStudioWidgets && nameInput) {
    window.LikeStudioWidgets.attachClientAutocomplete(nameInput, { minChars: 2 });
    nameInput.addEventListener('ls:select', () => { offset = 0; load(); });
  }

  load();
})();

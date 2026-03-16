/* client-profiles.js — Admin CRM profiles page */
(function () {
  'use strict';

  const API    = () => `${window.APP_CONFIG.API_BASE_URL}/admin/client-profiles`;
  const CLIENT = () => `${window.APP_CONFIG.API_BASE_URL}/admin/clients`;
  const LIMIT  = 24;
  let offset = 0, lastTotal = 0;

  const form    = document.getElementById('search-form');
  const summary = document.getElementById('summary');
  const grid    = document.getElementById('profile-grid');

  function collectParams() {
    const fd = new FormData(form);
    const p  = new URLSearchParams();
    const q  = fd.get('query'); if (q) p.set('query', q);
    p.set('limit', LIMIT); p.set('offset', offset);
    return p;
  }

  function renderCards(items) {
    if (!items.length) { grid.innerHTML = '<p class="admin-summary">Sin resultados.</p>'; return; }
    grid.innerHTML = items.map(item => `
      <article class="profile-card"
        data-client-id="${item.client_id}"
        data-id-number="${item.id_number}"
        data-email="${item.email || ''}">
        <div class="profile-card-header">
          <h3 class="profile-card-name" data-display-name>${item.full_name}</h3>
          <span class="profile-card-id">#${item.client_id}</span>
        </div>
        <div class="profile-fields">
          <div class="form-field">
            <label>Nombre</label>
            <input data-field="full_name" value="${item.full_name || ''}" />
          </div>
          <div class="form-field">
            <label>Teléfono</label>
            <input data-field="phone" value="${item.phone || ''}" />
          </div>
          <div class="form-field">
            <label>Instagram</label>
            <input data-field="instagram" value="${item.instagram || ''}" placeholder="@usuario" />
          </div>
          <div class="form-field">
            <label>Tipo de sesión</label>
            <input data-field="shoot_type" value="${item.shoot_type || ''}" />
          </div>
          <div class="form-field">
            <label>Fecha</label>
            <input data-field="shoot_date" type="date" value="${item.shoot_date || ''}" />
          </div>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary btn-sm" data-save>Guardar</button>
        </div>
        <p class="profile-message" data-message></p>
      </article>`).join('');
  }

  async function load() {
    summary.textContent = 'Cargando...';
    try {
      const r = await fetch(`${API()}?${collectParams()}`);
      if (!r.ok) throw new Error('No se pudieron obtener los perfiles.');
      const d = await r.json();
      lastTotal = d.total;
      renderCards(d.items);
      const from = d.total === 0 ? 0 : d.offset + 1;
      const to   = Math.min(d.offset + d.limit, d.total);
      summary.textContent = `Mostrando ${from}–${to} de ${d.total} perfiles.`;
      document.getElementById('prev').disabled = d.offset <= 0;
      document.getElementById('next').disabled = d.offset + d.limit >= d.total;
    } catch (e) { summary.textContent = e.message; grid.innerHTML = ''; }
  }

  grid.addEventListener('click', async e => {
    const btn = e.target.closest('[data-save]'); if (!btn) return;
    const card     = btn.closest('.profile-card');
    const clientId = card.dataset.clientId;
    const idNumber = card.dataset.idNumber;
    const email    = card.dataset.email || null;
    const msg      = card.querySelector('[data-message]');
    const fullName = card.querySelector('[data-field="full_name"]').value.trim();
    const phone    = card.querySelector('[data-field="phone"]').value.trim();
    const instagram= card.querySelector('[data-field="instagram"]').value.trim();
    const shootType= card.querySelector('[data-field="shoot_type"]').value.trim();
    const shootDate= card.querySelector('[data-field="shoot_date"]').value;

    if (!fullName) { msg.textContent = 'El nombre es obligatorio.'; return; }
    msg.textContent = 'Guardando...';
    try {
      const cr = await fetch(`${CLIENT()}/${clientId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName, id_number: idNumber, phone: phone || null, email })
      });
      if (!cr.ok) { const d = await cr.json(); throw new Error(d.detail || 'Error al actualizar cliente.'); }

      const pr = await fetch(`${API()}/${clientId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instagram: instagram || null, shoot_type: shootType || null, shoot_date: shootDate || null })
      });
      if (!pr.ok) { const d = await pr.json(); throw new Error(d.detail || 'Error al actualizar perfil.'); }

      card.querySelector('[data-display-name]').textContent = fullName;
      msg.textContent = '✓ Guardado';
    } catch (err) { msg.textContent = err.message; }
  });

  form.addEventListener('submit', e => { e.preventDefault(); offset = 0; load(); });
  document.getElementById('reset').addEventListener('click', () => { form.reset(); offset = 0; load(); });
  document.getElementById('prev').addEventListener('click', () => { offset = Math.max(0, offset - LIMIT); load(); });
  document.getElementById('next').addEventListener('click', () => { if (offset + LIMIT < lastTotal) { offset += LIMIT; load(); } });

  load();
})();

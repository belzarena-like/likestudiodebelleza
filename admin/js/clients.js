/* clients.js — Admin clients page */
(function () {
  'use strict';

  const API     = () => `${window.APP_CONFIG.API_BASE_URL}/admin/clients`;
  const CREATE  = () => `${window.APP_CONFIG.API_BASE_URL}/clients`;
  const PROFILE = () => `${window.APP_CONFIG.API_BASE_URL}/admin/client-profiles`;
  const LIMIT = 25;
  let offset = 0, lastTotal = 0, editingId = null;
  let clientsById = {};

  const form        = document.getElementById('search-form');
  const summary     = document.getElementById('summary');
  const tbody       = document.getElementById('table-body');
  const modal       = document.getElementById('client-modal');
  const modalTitle  = document.getElementById('modal-title');
  const clientForm  = document.getElementById('client-form');
  const fName       = document.getElementById('f-full-name');
  const fId         = document.getElementById('f-id-number');
  const fPhone      = document.getElementById('f-phone');
  const fEmail      = document.getElementById('f-email');
  const fInstagram  = document.getElementById('f-instagram');
  const fMsg        = document.getElementById('form-message');
  const submitBtn   = document.getElementById('submit-btn');

  function openModal()  { modal.classList.add('is-open'); document.body.classList.add('modal-open'); }
  function closeModal() { modal.classList.remove('is-open'); document.body.classList.remove('modal-open'); }

  function resetForm(skipReset = false) {
    editingId = null;
    modalTitle.textContent = 'Nuevo cliente';
    submitBtn.textContent  = 'Guardar';
    fMsg.textContent = '';
    if (!skipReset) { clientForm.reset(); fInstagram.value = ''; }
  }

  function collectParams() {
    const fd = new FormData(form);
    const p  = new URLSearchParams();
    const q  = fd.get('query'); if (q) p.set('query', q);
    p.set('limit', LIMIT); p.set('offset', offset);
    return p;
  }

  function renderRows(items) {
    if (!items.length) {
      tbody.innerHTML = `<tr><td class="admin-table-empty" colspan="5">Sin resultados.</td></tr>`;
      return;
    }
    clientsById = {};
    tbody.innerHTML = items.map(item => {
      clientsById[item.id] = item;
      const nameParam    = encodeURIComponent(item.full_name || '');
      const sessionQuery = encodeURIComponent(item.phone || item.full_name || '');
      return `<tr>
        <td>${item.full_name}</td>
        <td>${item.id_number}</td>
        <td>${item.phone || '—'}</td>
        <td>${item.email || '—'}</td>
        <td><div class="row-actions">
          <button class="btn btn-secondary btn-sm" data-edit-id="${item.id}">Editar</button>
          <a class="btn btn-secondary btn-sm" href="index.html?full_name=${nameParam}">Consentimientos</a>
          <a class="btn btn-secondary btn-sm" href="sessions.html?query=${sessionQuery}">Sesiones</a>
        </div></td>
      </tr>`;
    }).join('');
  }

  async function load() {
    summary.textContent = 'Cargando...';
    try {
      const r = await fetch(`${API()}?${collectParams()}`);
      if (!r.ok) throw new Error('No se pudieron obtener los clientes.');
      const d = await r.json();
      lastTotal = d.total;
      renderRows(d.items);
      const from = d.total === 0 ? 0 : d.offset + 1;
      const to   = Math.min(d.offset + d.limit, d.total);
      summary.textContent = `Mostrando ${from}–${to} de ${d.total} clientes.`;
      document.getElementById('prev').disabled = d.offset <= 0;
      document.getElementById('next').disabled = d.offset + d.limit >= d.total;
    } catch (e) {
      summary.textContent = e.message;
      tbody.innerHTML = '';
    }
  }

  async function loadProfile(clientId) {
    fInstagram.value = '';
    try {
      const r = await fetch(`${PROFILE()}/${clientId}`);
      if (!r.ok) return;
      const p = await r.json();
      if (p && p.instagram) fInstagram.value = p.instagram;
    } catch (_) {}
  }

  function startEdit(id) {
    const c = clientsById[id]; if (!c) return;
    editingId = id;
    modalTitle.textContent = `Editar cliente #${id}`;
    submitBtn.textContent  = 'Actualizar';
    fMsg.textContent = '';
    fName.value  = c.full_name || '';
    fId.value    = c.id_number || '';
    fPhone.value = c.phone || '';
    fEmail.value = c.email || '';
    loadProfile(id);
    openModal();
  }

  clientForm.addEventListener('submit', async e => {
    e.preventDefault();
    fMsg.textContent = '';
    const payload = {
      full_name: fName.value.trim(),
      id_number: fId.value.trim(),
      phone:     fPhone.value.trim() || null,
      email:     fEmail.value.trim() || null
    };
    if (!payload.full_name || !payload.id_number) { fMsg.textContent = 'Nombre y DNI/NIE son obligatorios.'; return; }
    try {
      const r = await fetch(editingId ? `${API()}/${editingId}` : CREATE(), {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error((d && d.detail) || 'No se pudo guardar.');
      await fetch(`${PROFILE()}/${d.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instagram: fInstagram.value.trim() || null })
      });
      resetForm(); closeModal(); load();
    } catch (err) { fMsg.textContent = err.message; }
  });

  tbody.addEventListener('click', e => {
    const btn = e.target.closest('[data-edit-id]');
    if (btn) startEdit(parseInt(btn.dataset.editId));
  });

  document.getElementById('new-client').addEventListener('click', () => { resetForm(); openModal(); });
  document.getElementById('modal-close').addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal(); });

  form.addEventListener('submit', e => { e.preventDefault(); offset = 0; load(); });
  document.getElementById('reset').addEventListener('click', () => { form.reset(); offset = 0; load(); });
  document.getElementById('prev').addEventListener('click', () => { offset = Math.max(0, offset - LIMIT); load(); });
  document.getElementById('next').addEventListener('click', () => { if (offset + LIMIT < lastTotal) { offset += LIMIT; load(); } });

  const queryInput = document.getElementById('query');
  if (window.LikeStudioWidgets && queryInput) {
    window.LikeStudioWidgets.attachClientAutocomplete(queryInput, { minChars: 2 });
    queryInput.addEventListener('ls:select', () => { offset = 0; load(); });
  }

  load();
})();

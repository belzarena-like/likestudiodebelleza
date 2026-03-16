/* services.js — Admin services page */
(function () {
  'use strict';

  const API = () => `${window.APP_CONFIG.API_BASE_URL}/admin/services`;
  const LIMIT = 50;
  let offset = 0, lastTotal = 0;

  const form       = document.getElementById('search-form');
  const summary    = document.getElementById('summary');
  const tbody      = document.getElementById('table-body');
  const modal      = document.getElementById('service-modal');
  const modalTitle = document.getElementById('modal-title');
  const svcForm    = document.getElementById('service-form');
  const fId        = document.getElementById('f-id');
  const fName      = document.getElementById('f-name');
  const fDuration  = document.getElementById('f-duration');
  const fActive    = document.getElementById('f-active');
  const fMsg       = document.getElementById('form-message');
  const submitBtn  = document.getElementById('submit-btn');

  function openModal()  { modal.classList.add('is-open'); document.body.classList.add('modal-open'); }
  function closeModal() { modal.classList.remove('is-open'); document.body.classList.remove('modal-open'); }

  function resetForm() {
    fId.value       = '';
    fName.value     = '';
    fDuration.value = '60';
    fActive.value   = 'true';
    fMsg.textContent = '';
    submitBtn.textContent  = 'Guardar';
    modalTitle.textContent = 'Nuevo servicio';
  }

  function collectParams() {
    const fd = new FormData(form);
    const p  = new URLSearchParams();
    const q  = fd.get('query');       if (q) p.set('query', q);
    const ao = fd.get('active_only'); if (ao) p.set('active_only', ao);
    p.set('limit', LIMIT); p.set('offset', offset);
    return p;
  }

  function renderRows(items) {
    if (!items.length) {
      tbody.innerHTML = `<tr><td class="admin-table-empty" colspan="4">Sin resultados.</td></tr>`;
      return;
    }
    tbody.innerHTML = items.map(item => `<tr>
      <td>${item.name}</td>
      <td>${item.duration_minutes} min</td>
      <td><span class="badge ${item.active ? 'badge-success' : 'badge-secondary'}">${item.active ? 'Activo' : 'Inactivo'}</span></td>
      <td><div class="row-actions">
        <button class="btn btn-secondary btn-sm" data-edit
          data-id="${item.id}" data-name="${item.name}"
          data-duration="${item.duration_minutes}" data-active="${item.active}">Editar</button>
      </div></td>
    </tr>`).join('');
  }

  async function load() {
    summary.textContent = 'Cargando...';
    try {
      const r = await fetch(`${API()}?${collectParams()}`);
      if (!r.ok) throw new Error('No se pudieron obtener los servicios.');
      const d = await r.json();
      lastTotal = d.total;
      renderRows(d.items);
      const from = d.total === 0 ? 0 : d.offset + 1;
      const to   = Math.min(d.offset + d.limit, d.total);
      summary.textContent = `Mostrando ${from}–${to} de ${d.total} servicios.`;
      document.getElementById('prev').disabled = d.offset <= 0;
      document.getElementById('next').disabled = d.offset + d.limit >= d.total;
    } catch (e) {
      summary.textContent = e.message;
      tbody.innerHTML = '';
    }
  }

  svcForm.addEventListener('submit', async e => {
    e.preventDefault();
    fMsg.textContent = '';
    const name     = fName.value.trim();
    const duration = parseInt(fDuration.value, 10);
    if (!name)                        { fMsg.textContent = 'Ingresa un nombre.'; return; }
    if (!duration || isNaN(duration)) { fMsg.textContent = 'Ingresa una duración válida.'; return; }
    const payload = { name, active: fActive.value === 'true', duration_minutes: duration };
    try {
      const id = fId.value;
      const r  = await fetch(id ? `${API()}/${id}` : API(), {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.detail || 'Error al guardar.'); }
      resetForm(); closeModal(); load();
    } catch (err) { fMsg.textContent = err.message; }
  });

  tbody.addEventListener('click', e => {
    const btn = e.target.closest('[data-edit]');
    if (!btn) return;
    fId.value       = btn.dataset.id;
    fName.value     = btn.dataset.name;
    fDuration.value = btn.dataset.duration;
    fActive.value   = btn.dataset.active === 'true' ? 'true' : 'false';
    fMsg.textContent = '';
    submitBtn.textContent  = 'Actualizar';
    modalTitle.textContent = `Editar servicio #${btn.dataset.id}`;
    openModal();
  });

  document.getElementById('new-service').addEventListener('click', () => { resetForm(); openModal(); });
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('form-reset').addEventListener('click', resetForm);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal(); });

  form.addEventListener('submit', e => { e.preventDefault(); offset = 0; load(); });
  document.getElementById('reset').addEventListener('click', () => { form.reset(); offset = 0; load(); });
  document.getElementById('prev').addEventListener('click', () => { offset = Math.max(0, offset - LIMIT); load(); });
  document.getElementById('next').addEventListener('click', () => { if (offset + LIMIT < lastTotal) { offset += LIMIT; load(); } });

  resetForm();
  load();
})();

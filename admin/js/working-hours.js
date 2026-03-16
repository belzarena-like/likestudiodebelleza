/* working-hours.js — Admin working hours page */
(function () {
  'use strict';

  const API = () => `${window.APP_CONFIG.API_BASE_URL}/admin/working-hours`;
  const DAY_NAMES = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

  const tbody     = document.getElementById('table-body');
  const message   = document.getElementById('message');
  const statusEl  = document.getElementById('status');
  const saveBtn   = document.getElementById('save-btn');
  const reloadBtn = document.getElementById('reload-btn');

  function setStatus(text, type) {
    statusEl.textContent = text || '';
    statusEl.className   = 'status-pill' + (type ? ` ${type}` : '');
  }

  function toTimeInput(v) { return v ? String(v).slice(0, 5) : ''; }

  function renderRows(items) {
    const map = {};
    (items || []).forEach(i => { map[i.weekday] = i; });
    tbody.innerHTML = '';
    DAY_NAMES.forEach((label, weekday) => {
      const e      = map[weekday] || { weekday, is_open: false, start_time: null, end_time: null };
      const isOpen = Boolean(e.is_open);
      const row    = document.createElement('tr');
      row.dataset.weekday = weekday;
      row.innerHTML = `
        <td>${label}</td>
        <td><select data-open-select>
          <option value="true">Abierto</option>
          <option value="false">Cerrado</option>
        </select></td>
        <td><input data-start type="time" step="900" value="${toTimeInput(e.start_time)}" ${!isOpen ? 'disabled' : ''} /></td>
        <td><input data-end   type="time" step="900" value="${toTimeInput(e.end_time)}"   ${!isOpen ? 'disabled' : ''} /></td>`;
      row.querySelector('[data-open-select]').value = isOpen ? 'true' : 'false';
      tbody.appendChild(row);
    });
  }

  async function load() {
    message.textContent = 'Cargando...'; setStatus('');
    try {
      const r = await fetch(API());
      if (!r.ok) throw new Error('No se pudo cargar el horario.');
      const d = await r.json();
      renderRows(d.items || []);
      message.textContent = '';
    } catch (e) { message.textContent = e.message; setStatus('Error', 'error'); }
  }

  function parseMinutes(v) {
    if (!v) return null;
    const [h, m] = v.split(':');
    return parseInt(h) * 60 + parseInt(m);
  }

  function collectItems() {
    return Array.from(tbody.querySelectorAll('tr')).map(row => {
      const weekday = parseInt(row.dataset.weekday);
      const isOpen  = row.querySelector('[data-open-select]').value === 'true';
      const start   = row.querySelector('[data-start]').value;
      const end     = row.querySelector('[data-end]').value;
      if (isOpen) {
        const sm = parseMinutes(start), em = parseMinutes(end);
        if (sm === null || em === null) throw new Error('Completa las horas para los días abiertos.');
        if (sm >= em) throw new Error('La hora de inicio debe ser menor que la hora fin.');
      }
      return { weekday, is_open: isOpen, start_time: isOpen ? start : null, end_time: isOpen ? end : null };
    });
  }

  async function save() {
    message.textContent = ''; setStatus('Guardando...');
    let payload;
    try { payload = { items: collectItems() }; }
    catch (e) { setStatus(''); message.textContent = e.message; return; }
    saveBtn.disabled = true;
    try {
      const r = await fetch(API(), {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.detail || 'Error al guardar.'); }
      const d = await r.json();
      renderRows(d.items || []);
      message.textContent = 'Horario actualizado.';
      setStatus('Guardado', 'success');
    } catch (e) { message.textContent = e.message; setStatus('Error', 'error'); }
    finally { saveBtn.disabled = false; }
  }

  tbody.addEventListener('change', e => {
    if (!e.target.matches('[data-open-select]')) return;
    const row    = e.target.closest('tr');
    const isOpen = e.target.value === 'true';
    const start  = row.querySelector('[data-start]');
    const end    = row.querySelector('[data-end]');
    start.disabled = !isOpen; end.disabled = !isOpen;
    if (!isOpen) { start.value = ''; end.value = ''; }
  });

  saveBtn.addEventListener('click', save);
  reloadBtn.addEventListener('click', load);
  load();
})();

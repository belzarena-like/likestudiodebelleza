/* sessions-modern.js — Daily sessions page logic */
(function () {
  'use strict';

  const API      = () => `${window.APP_CONFIG.API_BASE_URL}/admin/sessions`;
  const AGENDA   = () => `${window.APP_CONFIG.API_BASE_URL}/admin/session-agenda`;
  const ATTEND   = () => `${window.APP_CONFIG.API_BASE_URL}/admin/session-attendance`;
  const CONSENT_KEY = 'likestudio_client_prefill_v1';

  const SESSIONS = () => `${window.APP_CONFIG.API_BASE_URL}/admin/sessions`;

  /* ── state ─────────────────────────────────────────────────────────── */
  let agendaItems   = [];
  let historyCache  = {};
  let consentByAppt = {};
  let searchTimeout = null;
  // mode: 'agenda' = daily view, 'search' = name/phone search across all sessions
  let mode = 'agenda';

  /* ── DOM refs ───────────────────────────────────────────────────────── */
  const list       = () => document.getElementById('sessions-list');
  const dateEl     = () => document.getElementById('date-filter');
  const profEl     = () => document.getElementById('professional-filter');
  const searchEl   = () => document.getElementById('search-filter');
  const statTotal  = () => document.getElementById('stat-total');
  const statPend   = () => document.getElementById('stat-pending');
  const statComp   = () => document.getElementById('stat-completed');

  /* ── helpers ────────────────────────────────────────────────────────── */
  function statusLabel(s) {
    return { planned: 'Planificado', in_progress: 'En progreso', completed: 'Completado' }[s] || s;
  }

  function statusClass(s) {
    return { planned: 'badge-secondary', in_progress: 'badge-warning', completed: 'badge-success' }[s] || 'badge-secondary';
  }

  function matchesSearch(item, q) {
    if (!q) return true;
    const name  = (item.client_name  || '').toLowerCase();
    const phone = (item.client_phone || '').replace(/\D/g, '');
    const dq    = q.replace(/\D/g, '');
    return name.includes(q) || (dq ? phone.includes(dq) : (item.client_phone || '').toLowerCase().includes(q));
  }

  function pct(done, total) {
    return total > 0 ? Math.round((done / total) * 100) : 0;
  }

  function openConsent(prefill, treatment, professional) {
    try { localStorage.setItem(CONSENT_KEY, JSON.stringify(prefill)); } catch (_) {}
    const p = new URLSearchParams();
    if (prefill.full_name) p.set('client_name',     prefill.full_name);
    if (prefill.id_number) p.set('client_id_number', prefill.id_number);
    if (prefill.phone)     p.set('client_phone',     prefill.phone);
    if (treatment)         p.set('service_name',     treatment);
    if (professional)      p.set('professional_name', professional);
    window.open(`consent-selector.html?${p}`, '_blank', 'noopener');
  }

  /* ── render stats ───────────────────────────────────────────────────── */
  function renderStats(items) {
    const completed = items.filter(i => i.status === 'completed').length;
    const pending   = items.length - completed;
    statTotal().textContent = items.length;
    statPend().textContent  = pending;
    statComp().textContent  = completed;
  }

  /* ── render history panel ───────────────────────────────────────────── */
  function buildAppointmentList(sessionId, items) {
    if (!items.length) return '<p class="history-empty">Sin sesiones registradas.</p>';
    return `<div class="history-list">
      ${items.map(i => `
        <div class="history-item">
          <div class="history-item-info">
            <div class="history-item-date">${i.appointment_date} · ${i.start_time}–${i.end_time}</div>
            <div class="history-item-meta">${i.service_name || ''} · ${i.professional_name}${i.notes ? ` · ${i.notes}` : ''}</div>
          </div>
          <div class="history-item-actions">
            <span class="badge ${statusClass(i.status)}">${statusLabel(i.status)}</span>
            ${i.status !== 'completed' ? `<button class="btn btn-secondary btn-sm" data-history-complete="${i.id}" data-history-session="${sessionId}">Marcar completada</button>` : ''}
            <button class="btn btn-danger btn-sm" data-history-delete="${i.id}">Eliminar</button>
          </div>
        </div>`).join('')}
    </div>`;
  }

  function buildHistoryHtml(sessionId, items, planned, completed, status, otherBonos) {
    const last = items[0] || {};
    const isCompleted = status === 'completed' || (Number(planned) > 0 && Number(completed) >= Number(planned));

    const bonusHtml = isCompleted ? `
      <div class="bonus-form" data-bonus-form="${sessionId}">
        <span class="history-title">Crear nuevo bono</span>
        <input type="number" min="1" value="${Number(planned) || 4}" name="bonus_sessions" class="filter-input" style="width:90px" />
        <button class="btn btn-secondary btn-sm" data-bonus-create="${sessionId}">Crear bono</button>
        <span class="history-msg" data-bonus-message></span>
      </div>` : '';

    // Loose sessions: other sessions with 1 planned and 0-1 completed (not a real bono)
    const looseSessions = (otherBonos || []).filter(b => b.appointments.length > 0);
    const looseHtml = looseSessions.length ? `
      <div class="loose-sessions-section">
        <div class="loose-sessions-header">
          <span class="history-title">Sesiones sueltas (${looseSessions.length})</span>
          <span class="history-note">Estas sesiones no están agrupadas en este bono</span>
        </div>
        <div class="loose-sessions-list">
          ${looseSessions.map(b => b.appointments.map(appt => `
            <div class="history-item loose-item">
              <div class="history-item-info">
                <div class="history-item-date">${appt.appointment_date} · ${appt.start_time}–${appt.end_time}</div>
                <div class="history-item-meta">${appt.service_name || ''} · ${appt.professional_name}${appt.notes ? ` · ${appt.notes}` : ''}</div>
              </div>
              <div class="history-item-actions">
                <span class="badge ${statusClass(appt.status)}">${statusLabel(appt.status)}</span>
                <button class="btn btn-secondary btn-sm"
                  data-merge-appt="${appt.id}"
                  data-merge-target="${sessionId}"
                  data-merge-source="${b.session.id}">
                  Añadir a este bono
                </button>
              </div>
            </div>`).join('')).join('')}
        </div>
      </div>` : '';

    return `
      <div class="history-toolbar">
        <button class="btn btn-secondary btn-sm" data-history-add="${sessionId}">+ Agregar sesion pasada</button>
        <span class="history-note">Se guarda automáticamente como completada</span>
        <span class="history-msg" data-history-msg="${sessionId}"></span>
      </div>
      ${bonusHtml}
      <form class="add-history-form" data-history-form="${sessionId}"
            data-last-date="${last.appointment_date || ''}"
            data-last-start="${last.start_time || '10:00'}"
            data-last-end="${last.end_time || '11:00'}"
            data-last-prof="${last.professional_name || ''}" hidden>
        <div class="add-history-grid">
          <div><label class="filter-label">Fecha</label><input type="date" name="appointment_date" class="filter-input" required /></div>
          <div><label class="filter-label">Inicio</label><input type="time" name="start_time" class="filter-input" required /></div>
          <div><label class="filter-label">Fin</label><input type="time" name="end_time" class="filter-input" required /></div>
          <div><label class="filter-label">Profesional</label><input type="text" name="professional_name" class="filter-input" required /></div>
          <div class="add-history-full"><label class="filter-label">Notas</label><input type="text" name="notes" class="filter-input" /></div>
        </div>
        <div class="add-history-actions">
          <button type="button" class="btn btn-secondary btn-sm" data-history-duplicate="${sessionId}">Duplicar ultima</button>
          <button type="submit" class="btn btn-primary btn-sm">Guardar</button>
          <button type="button" class="btn btn-secondary btn-sm" data-history-cancel="${sessionId}">Cancelar</button>
        </div>
      </form>
      ${buildAppointmentList(sessionId, items)}
      ${looseHtml}`;
  }

  async function loadHistory(sessionId, panel) {
    panel.innerHTML = '<p class="history-empty">Cargando...</p>';
    const clientId  = panel.dataset.clientId;
    const treatment = decodeURIComponent(panel.dataset.treatment || '');

    // Two calls total — current session's appointments + ALL client appointments in one shot
    const allApptUrl = clientId
      ? `${window.APP_CONFIG.API_BASE_URL}/admin/appointments?client_id=${clientId}&limit=200&offset=0`
      : null;

    const [apptRes, allApptRes] = await Promise.all([
      fetch(`${window.APP_CONFIG.API_BASE_URL}/admin/sessions/${sessionId}/appointments?limit=50&offset=0`),
      allApptUrl ? fetch(allApptUrl) : Promise.resolve(null)
    ]);

    if (!apptRes.ok) throw new Error('No se pudo cargar el historial.');
    const currentItems = (await apptRes.json()).items || [];

    // Group all client appointments by session_id, exclude current session
    let otherBonos = [];
    if (allApptRes && allApptRes.ok) {
      const allAppts = (await allApptRes.json()).items || [];
      const bySession = {};
      for (const a of allAppts) {
        const sid = a.session_id;
        if (!sid || String(sid) === String(sessionId)) continue;
        // Only same treatment
        if (treatment && a.service_name !== treatment) continue;
        if (!bySession[sid]) bySession[sid] = [];
        bySession[sid].push(a);
      }
      otherBonos = Object.entries(bySession).map(([sid, appts]) => ({
        session: { id: sid },
        appointments: appts.sort((a, b) => b.appointment_date.localeCompare(a.appointment_date))
      }));
    }

    const html = buildHistoryHtml(sessionId, currentItems,
      panel.dataset.planned, panel.dataset.completed, panel.dataset.status, otherBonos);
    panel.innerHTML = html;
    historyCache[sessionId] = html;

    // Update total sessions counter with real cross-bono completed count
    const card = panel.closest('[data-card]');
    if (card) {
      const looseCompleted = otherBonos.reduce((sum, b) =>
        sum + b.appointments.filter(a => a.status === 'completed').length, 0);
      const total = currentItems.filter(a => a.status === 'completed').length + looseCompleted;
      const counter = card.querySelector('[data-total-counter]');
      if (counter) counter.textContent = `🗓 ${total} sesión${total !== 1 ? 'es' : ''}`;
    }
  }

  /* ── render one client card ─────────────────────────────────────────── */
  function buildCard(item) {
    const done  = Number(item.completed_sessions) || 0;
    const total = Number(item.planned_sessions)   || 0;
    const p     = pct(done, total);
    const sid   = item.session_id || '';
    const aid   = item.appointment_id;

    consentByAppt[aid] = {
      full_name: item.client_name, id_number: '', phone: item.client_phone || '',
      email: '', treatment: item.service_name, professional_name: item.professional_name
    };

    return `
    <div class="client-card" data-card data-appointment-id="${aid}" data-session-id="${sid}">

      <div class="client-card-header">
        <div class="client-info">
          <h2 class="client-name">${item.client_name}</h2>
          <div class="client-meta">
            <span class="client-meta-item">📞 ${item.client_phone || 'Sin teléfono'}</span>
            <span class="client-meta-item">👤 ${item.professional_name}</span>
            <span class="client-meta-item">🕐 ${item.start_time} – ${item.end_time}</span>
          </div>
        </div>
        <div class="client-badges">
          <span class="badge badge-primary">${item.service_name}</span>
          <span class="badge ${statusClass(item.status)}">${statusLabel(item.status)}</span>
          <span class="session-total-counter" data-total-counter>🗓 ${done} sesión${done !== 1 ? 'es' : ''}</span>
        </div>
      </div>

      <div class="session-details">
        <div class="session-row">
          <div class="session-field">
            <span class="session-field-label">Progreso de sesiones</span>
            <div class="session-progress">
              <div class="progress-bar"><div class="progress-fill" style="width:${p}%"></div></div>
              <span class="progress-text">${done}/${total}</span>
            </div>
          </div>
          <div class="session-field">
            <span class="session-field-label">Sesiones completadas</span>
            <input type="number" class="filter-input" style="width:90px" min="0" max="${total}"
                   value="${done}" data-field="completed" />
          </div>
        </div>
        <div class="session-field">
          <span class="session-field-label">Notas de la sesión</span>
          <textarea class="notes-textarea" data-field="notes" placeholder="Escribe una nota...">${item.notes || ''}</textarea>
        </div>
      </div>

      <div class="card-actions">
        <span class="card-msg" data-msg></span>
        <button class="btn btn-danger btn-sm" data-attend="no">No asistió</button>
        <button class="btn btn-secondary btn-sm" data-save-session>Guardar</button>
        <button class="btn btn-secondary btn-sm" data-consent>Consentimiento</button>
        ${sid ? `<button class="btn btn-secondary btn-sm" data-history-toggle="${sid}">Ver historial</button>` : ''}
        <button class="btn btn-primary btn-sm" data-attend="yes">✓ Asistió</button>
      </div>

      ${sid ? `
      <div class="history-section" data-history-section="${sid}" hidden>
        <div class="history-header">
          <span class="history-title">Historial de sesiones</span>
        </div>
        <div class="history-panel-inner"
             data-history-panel="${sid}"
             data-planned="${total}"
             data-completed="${done}"
             data-status="${item.status}"
             data-client-id="${item.client_id}"
             data-treatment="${encodeURIComponent(item.service_name)}">
        </div>
      </div>` : ''}

    </div>`;
  }

  /* ── render all cards ───────────────────────────────────────────────── */
  function render(items) {
    const q    = (searchEl().value || '').trim().toLowerCase();
    const prof = profEl().value;

    // Warn about items with no name and no phone (can't be identified)
    const unidentifiable = items.filter(i => !i.client_name && !i.client_phone);

    const filtered = items.filter(i =>
      (i.client_name || i.client_phone) &&   // skip truly unidentifiable from main list
      matchesSearch(i, q) &&
      (!prof || i.professional_name === prof)
    );

    renderStats(filtered);

    const parts = [];

    // Warning banner for unidentifiable appointments
    if (unidentifiable.length) {
      parts.push(`
        <div class="warning-banner">
          ⚠️ ${unidentifiable.length} cita${unidentifiable.length > 1 ? 's' : ''} sin nombre ni teléfono no se puede${unidentifiable.length > 1 ? 'n' : ''} mostrar.
          Revisa la agenda para completar los datos del cliente.
        </div>`);
    }

    if (!filtered.length) {
      parts.push(`
        <div class="empty-state">
          <div class="empty-state-icon">📅</div>
          <div class="empty-state-title">${q ? 'Sin resultados para "' + q + '"' : 'Sin citas para este día'}</div>
          <div class="empty-state-text">No hay sesiones con los filtros actuales.</div>
        </div>`);
      list().innerHTML = parts.join('');
      return;
    }

    // Sort by start_time
    filtered.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
    parts.push(...filtered.map(buildCard));
    list().innerHTML = parts.join('');

    // Preload history in background — one per card, staggered so we don't hammer the API
    list().querySelectorAll('[data-history-panel]').forEach((panel, i) => {
      const sid = panel.dataset.historyPanel;
      if (historyCache[sid]) return;
      setTimeout(() => {
        loadHistory(sid, panel).catch(() => {});
      }, i * 300);
    });
  }

  /* ── load agenda (daily mode) ───────────────────────────────────────── */
  async function load() {
    const date = dateEl().value;
    if (!date) return;
    mode = 'agenda';
    list().innerHTML = `<div class="empty-state"><div class="loading-spinner"></div><div class="empty-state-title" style="margin-top:1rem">Cargando...</div></div>`;
    try {
      const r = await fetch(`${AGENDA()}?date=${date}`);
      if (!r.ok) throw new Error('No se pudo cargar la agenda.');
      const data = await r.json();
      agendaItems = data.items || [];
      render(agendaItems);
    } catch (e) {
      list().innerHTML = `<div class="empty-state"><div class="empty-state-title">Error</div><div class="empty-state-text">${e.message}</div></div>`;
    }
  }

  /* ── search mode: query sessions API by client name/phone ───────────── */
  async function loadBySearch(q) {
    mode = 'search';
    list().innerHTML = `<div class="empty-state"><div class="loading-spinner"></div><div class="empty-state-title" style="margin-top:1rem">Buscando...</div></div>`;
    try {
      const params = new URLSearchParams({ query: q, limit: '50', offset: '0' });
      const r = await fetch(`${SESSIONS()}?${params}`);
      if (!r.ok) throw new Error('No se pudo buscar.');
      const data = await r.json();
      // Sessions API returns a different shape — normalise to agenda shape for rendering
      const items = (data.items || []).map(s => ({
        appointment_id:     null,
        session_id:         s.id,
        client_id:          s.client_id,
        client_name:        s.client_name,
        client_phone:       s.client_phone || '',
        professional_name:  s.professional_name || '',
        service_name:       s.treatment_name,
        start_time:         '',
        end_time:           '',
        appointment_date:   s.created_at || '',
        status:             s.status,
        planned_sessions:   s.planned_sessions,
        completed_sessions: s.completed_sessions,
        notes:              s.notes || ''
      }));
      renderStats(items);
      if (!items.length) {
        list().innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-title">Sin resultados para "${q}"</div></div>`;
        return;
      }
      list().innerHTML = items.map(buildCard).join('');
    } catch (e) {
      list().innerHTML = `<div class="empty-state"><div class="empty-state-title">Error</div><div class="empty-state-text">${e.message}</div></div>`;
    }
  }

  /* ── event delegation ───────────────────────────────────────────────── */
  document.addEventListener('click', async e => {
    const card = e.target.closest('[data-card]');
    if (!card) return;

    const aid = card.dataset.appointmentId;
    const sid = card.dataset.sessionId;
    const msg = card.querySelector('[data-msg]');

    /* attend */
    const attendBtn = e.target.closest('[data-attend]');
    if (attendBtn) {
      const attended = attendBtn.dataset.attend === 'yes';
      msg.textContent = 'Guardando...';
      try {
        const r = await fetch(ATTEND(), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appointment_id: parseInt(aid), attended })
        });
        if (!r.ok) { const d = await r.json(); throw new Error(d.detail || 'Error'); }
        msg.textContent = attended ? '✓ Asistencia marcada' : 'No asistencia marcada';
        await load();
      } catch (err) { msg.textContent = err.message; }
      return;
    }

    /* save session */
    if (e.target.closest('[data-save-session]')) {
      if (!sid) return;
      const completed = parseInt(card.querySelector('[data-field="completed"]').value) || 0;
      const notes     = card.querySelector('[data-field="notes"]').value || null;
      msg.textContent = 'Guardando...';
      try {
        const r = await fetch(`${API()}/${sid}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ completed_sessions: completed, notes })
        });
        if (!r.ok) { const d = await r.json(); throw new Error(d.detail || 'Error'); }
        msg.textContent = '✓ Guardado';
        await load();
      } catch (err) { msg.textContent = err.message; }
      return;
    }

    /* consent */
    if (e.target.closest('[data-consent]')) {
      const prefill = consentByAppt[parseInt(aid)] || {};
      openConsent(prefill, prefill.treatment, prefill.professional_name);
      return;
    }

    /* history toggle */
    const toggleBtn = e.target.closest('[data-history-toggle]');
    if (toggleBtn) {
      const section = card.querySelector(`[data-history-section="${sid}"]`);
      if (!section) return;
      const hidden = section.hasAttribute('hidden');
      if (hidden) {
        section.removeAttribute('hidden');
        toggleBtn.textContent = 'Ocultar historial';
        const panel = section.querySelector('[data-history-panel]');
        if (panel && !historyCache[sid]) {
          loadHistory(sid, panel).catch(err => { panel.innerHTML = `<p class="history-empty">${err.message}</p>`; });
        } else if (panel && historyCache[sid]) {
          panel.innerHTML = historyCache[sid];
        }
      } else {
        section.setAttribute('hidden', '');
        toggleBtn.textContent = 'Ver historial';
      }
      return;
    }

    /* history add */
    const addBtn = e.target.closest('[data-history-add]');
    if (addBtn) {
      const form = card.querySelector(`[data-history-form="${addBtn.dataset.historyAdd}"]`);
      if (!form) return;
      const today = new Date().toISOString().slice(0, 10);
      form.querySelector('[name="appointment_date"]').value = form.dataset.lastDate || today;
      form.querySelector('[name="start_time"]').value       = form.dataset.lastStart || '10:00';
      form.querySelector('[name="end_time"]').value         = form.dataset.lastEnd   || '11:00';
      form.querySelector('[name="professional_name"]').value = form.dataset.lastProf || '';
      form.querySelector('[name="notes"]').value            = '';
      form.removeAttribute('hidden');
      return;
    }

    /* history duplicate */
    const dupBtn = e.target.closest('[data-history-duplicate]');
    if (dupBtn) {
      const form = card.querySelector(`[data-history-form="${dupBtn.dataset.historyDuplicate}"]`);
      if (!form) return;
      form.querySelector('[name="appointment_date"]').value  = form.dataset.lastDate  || '';
      form.querySelector('[name="start_time"]').value        = form.dataset.lastStart || '10:00';
      form.querySelector('[name="end_time"]').value          = form.dataset.lastEnd   || '11:00';
      form.querySelector('[name="professional_name"]').value = form.dataset.lastProf  || '';
      form.removeAttribute('hidden');
      return;
    }

    /* history cancel */
    const cancelBtn = e.target.closest('[data-history-cancel]');
    if (cancelBtn) {
      const form = card.querySelector(`[data-history-form="${cancelBtn.dataset.historyCancel}"]`);
      if (form) form.setAttribute('hidden', '');
      return;
    }

    /* history mark completed */
    const completeHistBtn = e.target.closest('[data-history-complete]');
    if (completeHistBtn) {
      const apptId = completeHistBtn.dataset.historyComplete;
      const psid   = completeHistBtn.dataset.historySession;
      completeHistBtn.textContent = 'Guardando...';
      completeHistBtn.disabled = true;
      try {
        const r = await fetch(`${window.APP_CONFIG.API_BASE_URL}/appointments/${apptId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'completed' })
        });
        if (!r.ok) { const d = await r.json(); throw new Error(d.detail || 'Error'); }
        if (psid) {
          historyCache[psid] = '';
          const panel = document.querySelector(`[data-history-panel="${psid}"]`);
          if (panel) await loadHistory(psid, panel);
        }
      } catch (err) {
        completeHistBtn.textContent = 'Marcar completada';
        completeHistBtn.disabled = false;
        alert(err.message);
      }
      return;
    }

    /* history delete */
    const delHistBtn = e.target.closest('[data-history-delete]');
    if (delHistBtn) {
      if (!confirm('¿Eliminar esta sesión del historial?')) return;
      const apptId = delHistBtn.dataset.historyDelete;
      const panel  = delHistBtn.closest('[data-history-panel]');
      const psid   = panel ? panel.dataset.historyPanel : null;
      try {
        const r = await fetch(`${window.APP_CONFIG.API_BASE_URL}/appointments/${apptId}`, { method: 'DELETE' });
        if (!r.ok) { const d = await r.json(); throw new Error(d.detail || 'Error'); }
        if (psid) { historyCache[psid] = ''; await loadHistory(psid, panel); }
      } catch (err) { alert(err.message); }
      return;
    }

    /* merge loose appointment into this bono */
    const mergeBtn = e.target.closest('[data-merge-appt]');
    if (mergeBtn) {
      const apptId    = parseInt(mergeBtn.dataset.mergeAppt);
      const targetSid = mergeBtn.dataset.mergeTarget;
      const sourceSid = mergeBtn.dataset.mergeSource;
      mergeBtn.textContent = 'Moviendo...';
      mergeBtn.disabled = true;
      try {
        const r = await fetch(`${window.APP_CONFIG.API_BASE_URL}/appointments/${apptId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: parseInt(targetSid) })
        });
        if (!r.ok) { const d = await r.json(); throw new Error(d.detail || 'Error'); }
        // Invalidate cache for both sessions and reload
        historyCache[targetSid] = '';
        if (sourceSid) historyCache[sourceSid] = '';
        const panel = document.querySelector(`[data-history-panel="${targetSid}"]`);
        if (panel) await loadHistory(targetSid, panel);
      } catch (err) {
        mergeBtn.textContent = 'Añadir a este bono';
        mergeBtn.disabled = false;
        alert(err.message);
      }
      return;
    }

    /* bonus create */
    const bonusBtn = e.target.closest('[data-bonus-create]');
    if (bonusBtn) {
      const bsid    = bonusBtn.dataset.bonusCreate;
      const panel   = card.querySelector(`[data-history-panel="${bsid}"]`);
      const bform   = card.querySelector(`[data-bonus-form="${bsid}"]`);
      const bmsg    = bform ? bform.querySelector('[data-bonus-message]') : null;
      const planned = parseInt(bform.querySelector('[name="bonus_sessions"]').value);
      const clientId = parseInt(panel.dataset.clientId);
      const treatment = decodeURIComponent(panel.dataset.treatment || '');
      if (!clientId || !treatment || isNaN(planned) || planned < 1) {
        if (bmsg) bmsg.textContent = 'Datos incompletos.';
        return;
      }
      if (bmsg) bmsg.textContent = 'Creando...';
      try {
        const r = await fetch(`${window.APP_CONFIG.API_BASE_URL}/sessions`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: clientId, treatment_name: treatment,
            planned_sessions: planned, completed_sessions: 0, status: 'planned', notes: null })
        });
        if (!r.ok) { const d = await r.json(); throw new Error(d.detail || 'Error'); }
        if (bmsg) bmsg.textContent = '✓ Bono creado';
        await load();
      } catch (err) { if (bmsg) bmsg.textContent = err.message; }
      return;
    }
  });

  /* history form submit */
  document.addEventListener('submit', async e => {
    const form = e.target.closest('[data-history-form]');
    if (!form) return;
    e.preventDefault();
    const sid  = form.dataset.historyForm;
    const hmsg = form.querySelector('[data-history-message]') || form.closest('[data-card]')?.querySelector(`[data-history-msg="${sid}"]`);
    const payload = {
      appointment_date:  form.querySelector('[name="appointment_date"]').value,
      start_time:        form.querySelector('[name="start_time"]').value,
      end_time:          form.querySelector('[name="end_time"]').value,
      professional_name: form.querySelector('[name="professional_name"]').value,
      notes:             form.querySelector('[name="notes"]').value || null,
      status: 'completed'
    };
    if (hmsg) hmsg.textContent = 'Guardando...';
    try {
      const r = await fetch(`${window.APP_CONFIG.API_BASE_URL}/admin/sessions/${sid}/appointments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.detail || 'Error'); }
      if (hmsg) hmsg.textContent = '✓ Sesión guardada';
      form.setAttribute('hidden', '');
      historyCache[sid] = '';
      const panel = document.querySelector(`[data-history-panel="${sid}"]`);
      if (panel) await loadHistory(sid, panel);
    } catch (err) { if (hmsg) hmsg.textContent = err.message; }
  });

  /* ── filter listeners ───────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    const d = dateEl();
    d.valueAsDate = new Date();

    // Date change → always go back to agenda mode
    d.addEventListener('change', () => {
      searchEl().value = '';
      historyCache = {};
      load();
    });

    profEl().addEventListener('change', () => {
      if (mode === 'agenda') render(agendaItems);
    });

    // Search input: if date is cleared → search sessions API; otherwise filter agenda
    searchEl().addEventListener('input', () => {
      const q = (searchEl().value || '').trim();

      if (!q) {
        // Empty search: go back to agenda mode for current date
        if (mode === 'search') load();
        else render(agendaItems);
        return;
      }

      if (q.length < 2) return; // wait for at least 2 chars

      // If date is cleared, search across all sessions
      if (!d.value) {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => loadBySearch(q), 350);
        return;
      }

      // Date is set: filter the already-loaded agenda items client-side
      render(agendaItems);
    });

    // Clicking the date input hint clears the date so search mode activates
    document.getElementById('clear-date').addEventListener('click', () => {
      d.value = '';
      const q = (searchEl().value || '').trim();
      if (q.length >= 2) {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => loadBySearch(q), 100);
      } else {
        list().innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-title">Escribe un nombre para buscar</div><div class="empty-state-text">O selecciona una fecha para ver las citas del día.</div></div>`;
        statTotal().textContent = statPend().textContent = statComp().textContent = '—';
      }
    });

    document.getElementById('reset-filters').addEventListener('click', () => {
      d.valueAsDate = new Date();
      profEl().value   = '';
      searchEl().value = '';
      historyCache = {};
      mode = 'agenda';
      load();
    });

    if (window.LikeStudioWidgets) {
      window.LikeStudioWidgets.attachClientAutocomplete(searchEl(), { minChars: 2 });
    }

    load();
  });

})();

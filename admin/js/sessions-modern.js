/**
 * Sessions Modern Controller - Refactored to use clean architecture
 * Daily sessions page with agenda view and search functionality
 */

import { sessionService } from '../../src/services/session.service.js';
import { appointmentService } from '../../src/services/appointment.service.js';
import { storage } from '../../src/core/storage.js';
import { Toast } from '../../src/ui/components/toast.js';
import { Loading } from '../../src/ui/components/loading.js';
import { getStatusLabel, getStatusClass } from '../../src/utils/status-labels.js';

class SessionsModernController {
  constructor() {
    this.CONSENT_KEY = 'likestudio_client_prefill_v1';
    this.agendaItems = [];
    this.historyCache = {};
    this.consentByAppt = {};
    this.searchTimeout = null;
    this.mode = 'agenda'; // 'agenda' or 'search'

    this.initEventListeners();
    this.initializeDate();
    this.load();
  }

  initEventListeners() {
    // Date filter
    document.getElementById('date-filter').addEventListener('change', () => {
      document.getElementById('search-filter').value = '';
      this.historyCache = {};
      this.load();
    });

    // Professional filter
    document.getElementById('professional-filter').addEventListener('change', () => {
      if (this.mode === 'agenda') this.render(this.agendaItems);
    });

    // Search filter
    document.getElementById('search-filter').addEventListener('input', () => this.handleSearch());

    // Clear date button
    document.getElementById('clear-date').addEventListener('click', () => this.clearDate());

    // Reset filters
    document.getElementById('reset-filters').addEventListener('click', () => this.resetFilters());

    // Event delegation for card actions
    document.addEventListener('click', (e) => this.handleCardClick(e));
    document.addEventListener('submit', (e) => this.handleFormSubmit(e));

    // Autocomplete (if available)
    const searchEl = document.getElementById('search-filter');
    if (window.LikeStudioWidgets) {
      window.LikeStudioWidgets.attachClientAutocomplete(searchEl, { minChars: 2 });
    }
  }

  initializeDate() {
    const dateEl = document.getElementById('date-filter');
    dateEl.valueAsDate = new Date();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  matchesSearch(item, query) {
    if (!query) return true;
    const name = (item.client_name || '').toLowerCase();
    const phone = (item.client_phone || '').replace(/\D/g, '');
    const dq = query.replace(/\D/g, '');
    return name.includes(query) || (dq ? phone.includes(dq) : (item.client_phone || '').toLowerCase().includes(query));
  }

  pct(done, total) {
    return total > 0 ? Math.round((done / total) * 100) : 0;
  }

  openConsent(prefill, treatment, professional) {
    storage.set(this.CONSENT_KEY, prefill);
    const params = new URLSearchParams();
    if (prefill.full_name) params.set('client_name', prefill.full_name);
    if (prefill.id_number) params.set('client_id_number', prefill.id_number);
    if (prefill.phone) params.set('client_phone', prefill.phone);
    if (treatment) params.set('service_name', treatment);
    if (professional) params.set('professional_name', professional);
    window.open(`consent-selector.html?${params}`, '_blank', 'noopener');
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  renderStats(items) {
    const completed = items.filter(i => i.status === 'completed').length;
    const pending = items.length - completed;
    document.getElementById('stat-total').textContent = items.length;
    document.getElementById('stat-pending').textContent = pending;
    document.getElementById('stat-completed').textContent = completed;
  }

  // ── History Panel ──────────────────────────────────────────────────────────
  buildAppointmentList(sessionId, items) {
    if (!items.length) return '<p class="history-empty">Sin sesiones registradas.</p>';
    
    return `<div class="history-list">
      ${items.map(i => `
        <div class="history-item">
          <div class="history-item-info">
            <div class="history-item-date">${i.appointment_date} · ${i.start_time}–${i.end_time}</div>
            <div class="history-item-meta">${i.service_name || ''} · ${i.professional_name}${i.notes ? ` · ${i.notes}` : ''}</div>
          </div>
          <div class="history-item-actions">
            <span class="badge ${getStatusClass(i.status)}">${getStatusLabel(i.status)}</span>
            ${i.status !== 'completed' ? `<button class="btn btn-secondary btn-sm" data-history-complete="${i.id}" data-history-session="${sessionId}">Marcar completada</button>` : ''}
            <button class="btn btn-danger btn-sm" data-history-delete="${i.id}">Eliminar</button>
          </div>
        </div>`).join('')}
    </div>`;
  }

  buildHistoryHtml(sessionId, items, planned, completed, status, otherBonos) {
    const last = items[0] || {};
    const isCompleted = status === 'completed' || (Number(planned) > 0 && Number(completed) >= Number(planned));

    const bonusHtml = isCompleted ? `
      <div class="bonus-form" data-bonus-form="${sessionId}">
        <span class="history-title">Crear nuevo bono</span>
        <input type="number" min="1" value="${Number(planned) || 4}" name="bonus_sessions" class="filter-input" style="width:90px" />
        <button class="btn btn-secondary btn-sm" data-bonus-create="${sessionId}">Crear bono</button>
        <span class="history-msg" data-bonus-message></span>
      </div>` : '';

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
                <span class="badge ${this.statusClass(appt.status)}">${this.statusLabel(appt.status)}</span>
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
      ${this.buildAppointmentList(sessionId, items)}
      ${looseHtml}`;
  }

  async loadHistory(sessionId, panel) {
    panel.innerHTML = '<p class="history-empty">Cargando...</p>';
    const clientId = panel.dataset.clientId;
    const treatment = decodeURIComponent(panel.dataset.treatment || '');

    try {
      // Load current session appointments and all client appointments
      const [currentData, allApptsData] = await Promise.all([
        sessionService.getSessionHistory(sessionId, 50, 0),
        clientId ? appointmentService.searchAppointments({ client_id: clientId, limit: 200, offset: 0 }) : Promise.resolve(null)
      ]);

      const currentItems = currentData.items || [];

      // Group all client appointments by session_id, exclude current session
      let otherBonos = [];
      if (allApptsData) {
        const allAppts = allApptsData.items || [];
        const bySession = {};
        
        for (const a of allAppts) {
          const sid = a.session_id;
          if (!sid || String(sid) === String(sessionId)) continue;
          if (treatment && a.service_name !== treatment) continue;
          if (!bySession[sid]) bySession[sid] = [];
          bySession[sid].push(a);
        }
        
        otherBonos = Object.entries(bySession).map(([sid, appts]) => ({
          session: { id: sid },
          appointments: appts.sort((a, b) => b.appointment_date.localeCompare(a.appointment_date))
        }));
      }

      const html = this.buildHistoryHtml(sessionId, currentItems,
        panel.dataset.planned, panel.dataset.completed, panel.dataset.status, otherBonos);
      panel.innerHTML = html;
      this.historyCache[sessionId] = html;

      // Update total sessions counter
      const card = panel.closest('[data-card]');
      if (card) {
        const looseCompleted = otherBonos.reduce((sum, b) =>
          sum + b.appointments.filter(a => a.status === 'completed').length, 0);
        const total = currentItems.filter(a => a.status === 'completed').length + looseCompleted;
        const counter = card.querySelector('[data-total-counter]');
        if (counter) counter.textContent = `🗓 ${total} sesión${total !== 1 ? 'es' : ''}`;
      }
    } catch (error) {
      panel.innerHTML = `<p class="history-empty">${error.message}</p>`;
    }
  }

  // ── Card Rendering ─────────────────────────────────────────────────────────
  buildCard(item) {
    const done = Number(item.completed_sessions) || 0;
    const total = Number(item.planned_sessions) || 0;
    const p = this.pct(done, total);
    const sid = item.session_id || '';
    const aid = item.appointment_id;

    this.consentByAppt[aid] = {
      full_name: item.client_name,
      id_number: '',
      phone: item.client_phone || '',
      email: '',
      treatment: item.service_name,
      professional_name: item.professional_name
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
          <span class="badge ${getStatusClass(item.status)}">${getStatusLabel(item.status)}</span>
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
        <button class="btn btn-danger btn-sm" data-attend="no-lost">❌ No asistió (Sesión perdida)</button>
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

  render(items) {
    const q = (document.getElementById('search-filter').value || '').trim().toLowerCase();
    const prof = document.getElementById('professional-filter').value;

    const unidentifiable = items.filter(i => !i.client_name && !i.client_phone);
    const filtered = items.filter(i =>
      (i.client_name || i.client_phone) &&
      this.matchesSearch(i, q) &&
      (!prof || i.professional_name === prof)
    );

    this.renderStats(filtered);

    const parts = [];

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
      document.getElementById('sessions-list').innerHTML = parts.join('');
      return;
    }

    filtered.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
    parts.push(...filtered.map(item => this.buildCard(item)));
    document.getElementById('sessions-list').innerHTML = parts.join('');

    // Preload history in background
    document.querySelectorAll('[data-history-panel]').forEach((panel, i) => {
      const sid = panel.dataset.historyPanel;
      if (this.historyCache[sid]) return;
      setTimeout(() => {
        this.loadHistory(sid, panel).catch(() => {});
      }, i * 300);
    });
  }

  // ── Load Data ──────────────────────────────────────────────────────────────
  async load() {
    const date = document.getElementById('date-filter').value;
    if (!date) return;
    
    this.mode = 'agenda';
    document.getElementById('sessions-list').innerHTML = `
      <div class="empty-state">
        <div class="loading-spinner"></div>
        <div class="empty-state-title" style="margin-top:1rem">Cargando...</div>
      </div>`;

    try {
      const data = await sessionService.getSessionAgenda(date);
      this.agendaItems = data.items || [];
      this.render(this.agendaItems);
    } catch (error) {
      document.getElementById('sessions-list').innerHTML = `
        <div class="empty-state">
          <div class="empty-state-title">Error</div>
          <div class="empty-state-text">${error.message}</div>
        </div>`;
      Toast.error('No se pudo cargar la agenda');
    }
  }

  async loadBySearch(query) {
    this.mode = 'search';
    document.getElementById('sessions-list').innerHTML = `
      <div class="empty-state">
        <div class="loading-spinner"></div>
        <div class="empty-state-title" style="margin-top:1rem">Buscando...</div>
      </div>`;

    try {
      const data = await sessionService.searchSessions({ query, limit: 50, offset: 0 });
      
      // Normalize to agenda shape
      const items = (data.items || []).map(s => ({
        appointment_id: null,
        session_id: s.id,
        client_id: s.client_id,
        client_name: s.client_name,
        client_phone: s.client_phone || '',
        professional_name: s.professional_name || '',
        service_name: s.treatment_name,
        start_time: '',
        end_time: '',
        appointment_date: s.created_at || '',
        status: s.status,
        planned_sessions: s.planned_sessions,
        completed_sessions: s.completed_sessions,
        notes: s.notes || ''
      }));

      this.renderStats(items);
      
      if (!items.length) {
        document.getElementById('sessions-list').innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">🔍</div>
            <div class="empty-state-title">Sin resultados para "${query}"</div>
          </div>`;
        return;
      }

      document.getElementById('sessions-list').innerHTML = items.map(item => this.buildCard(item)).join('');
    } catch (error) {
      document.getElementById('sessions-list').innerHTML = `
        <div class="empty-state">
          <div class="empty-state-title">Error</div>
          <div class="empty-state-text">${error.message}</div>
        </div>`;
      Toast.error('Error en la búsqueda');
    }
  }

  // ── Event Handlers ─────────────────────────────────────────────────────────
  handleSearch() {
    const q = (document.getElementById('search-filter').value || '').trim();

    if (!q) {
      if (this.mode === 'search') this.load();
      else this.render(this.agendaItems);
      return;
    }

    if (q.length < 2) return;

    const dateEl = document.getElementById('date-filter');
    if (!dateEl.value) {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(() => this.loadBySearch(q), 350);
      return;
    }

    this.render(this.agendaItems);
  }

  clearDate() {
    const dateEl = document.getElementById('date-filter');
    dateEl.value = '';
    const q = (document.getElementById('search-filter').value || '').trim();
    
    if (q.length >= 2) {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(() => this.loadBySearch(q), 100);
    } else {
      document.getElementById('sessions-list').innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <div class="empty-state-title">Escribe un nombre para buscar</div>
          <div class="empty-state-text">O selecciona una fecha para ver las citas del día.</div>
        </div>`;
      document.getElementById('stat-total').textContent = '—';
      document.getElementById('stat-pending').textContent = '—';
      document.getElementById('stat-completed').textContent = '—';
    }
  }

  resetFilters() {
    document.getElementById('date-filter').valueAsDate = new Date();
    document.getElementById('professional-filter').value = '';
    document.getElementById('search-filter').value = '';
    this.historyCache = {};
    this.mode = 'agenda';
    this.load();
  }

  async handleCardClick(e) {
    const card = e.target.closest('[data-card]');
    if (!card) return;

    const aid = card.dataset.appointmentId;
    const sid = card.dataset.sessionId;
    const msg = card.querySelector('[data-msg]');

    // Attend button
    const attendBtn = e.target.closest('[data-attend]');
    if (attendBtn) {
      const attendType = attendBtn.dataset.attend;
      if (attendType === 'no-lost') {
        await this.handleNoShowLost(aid, sid, msg);
      } else {
        await this.handleAttendance(aid, attendType === 'yes', msg);
      }
      return;
    }

    // Save session button
    if (e.target.closest('[data-save-session]')) {
      await this.handleSaveSession(card, sid, msg);
      return;
    }

    // Consent button
    if (e.target.closest('[data-consent]')) {
      const prefill = this.consentByAppt[parseInt(aid)] || {};
      this.openConsent(prefill, prefill.treatment, prefill.professional_name);
      return;
    }

    // History toggle
    const toggleBtn = e.target.closest('[data-history-toggle]');
    if (toggleBtn) {
      await this.handleHistoryToggle(card, sid, toggleBtn);
      return;
    }

    // History add
    const addBtn = e.target.closest('[data-history-add]');
    if (addBtn) {
      this.handleHistoryAdd(card, addBtn.dataset.historyAdd);
      return;
    }

    // History duplicate
    const dupBtn = e.target.closest('[data-history-duplicate]');
    if (dupBtn) {
      this.handleHistoryDuplicate(card, dupBtn.dataset.historyDuplicate);
      return;
    }

    // History cancel
    const cancelBtn = e.target.closest('[data-history-cancel]');
    if (cancelBtn) {
      const form = card.querySelector(`[data-history-form="${cancelBtn.dataset.historyCancel}"]`);
      if (form) form.setAttribute('hidden', '');
      return;
    }

    // History mark completed
    const completeHistBtn = e.target.closest('[data-history-complete]');
    if (completeHistBtn) {
      await this.handleHistoryComplete(completeHistBtn);
      return;
    }

    // History delete
    const delHistBtn = e.target.closest('[data-history-delete]');
    if (delHistBtn) {
      await this.handleHistoryDelete(delHistBtn);
      return;
    }

    // Merge appointment
    const mergeBtn = e.target.closest('[data-merge-appt]');
    if (mergeBtn) {
      await this.handleMergeAppointment(mergeBtn);
      return;
    }

    // Bonus create
    const bonusBtn = e.target.closest('[data-bonus-create]');
    if (bonusBtn) {
      await this.handleBonusCreate(card, bonusBtn.dataset.bonusCreate);
      return;
    }
  }

  async handleFormSubmit(e) {
    const form = e.target.closest('[data-history-form]');
    if (!form) return;
    
    e.preventDefault();
    const sid = form.dataset.historyForm;
    const hmsg = form.querySelector('[data-history-message]') || 
                 form.closest('[data-card]')?.querySelector(`[data-history-msg="${sid}"]`);

    const payload = {
      appointment_date: form.querySelector('[name="appointment_date"]').value,
      start_time: form.querySelector('[name="start_time"]').value,
      end_time: form.querySelector('[name="end_time"]').value,
      professional_name: form.querySelector('[name="professional_name"]').value,
      notes: form.querySelector('[name="notes"]').value || null,
      status: 'completed'
    };

    if (hmsg) hmsg.textContent = 'Guardando...';

    try {
      await sessionService.createSessionAppointment(sid, payload);
      if (hmsg) hmsg.textContent = '✓ Sesión guardada';
      form.setAttribute('hidden', '');
      this.historyCache[sid] = '';
      const panel = document.querySelector(`[data-history-panel="${sid}"]`);
      if (panel) await this.loadHistory(sid, panel);
      Toast.success('Sesión guardada');
    } catch (error) {
      if (hmsg) hmsg.textContent = error.message;
      Toast.error('Error al guardar sesión');
    }
  }

  async handleAttendance(appointmentId, attended, msgEl) {
    msgEl.textContent = 'Guardando...';
    
    try {
      await sessionService.markAttendance(parseInt(appointmentId), attended);
      msgEl.textContent = attended ? '✓ Asistencia marcada' : 'No asistencia marcada';
      Toast.success(attended ? 'Asistencia marcada' : 'No asistencia marcada');
      await this.load();
    } catch (error) {
      msgEl.textContent = error.message;
      Toast.error('Error al marcar asistencia');
    }
  }

  async handleNoShowLost(appointmentId, sessionId, msgEl) {
    if (!confirm('¿Confirmar que el cliente no asistió y se pierde la sesión? Esta acción marcará la sesión como completada sin asistencia.')) {
      return;
    }

    msgEl.textContent = 'Guardando...';
    
    try {
      // Mark appointment as cancelled/no-show
      await appointmentService.updateAppointment(appointmentId, { 
        status: 'cancelled',
        notes: 'No asistió - Sesión perdida'
      });

      // If there's a session, increment completed count (lost session counts as completed)
      if (sessionId) {
        const card = document.querySelector(`[data-session-id="${sessionId}"]`);
        if (card) {
          const currentCompleted = parseInt(card.querySelector('[data-field="completed"]').value) || 0;
          await sessionService.updateSession(sessionId, { 
            completed_sessions: currentCompleted + 1 
          });
        }
      }

      msgEl.textContent = '✓ Sesión perdida marcada';
      Toast.success('Sesión marcada como perdida - cuenta como completada');
      await this.load();
    } catch (error) {
      msgEl.textContent = error.message;
      Toast.error('Error al marcar sesión perdida');
    }
  }

  async handleSaveSession(card, sessionId, msgEl) {
    if (!sessionId) return;
    
    const completed = parseInt(card.querySelector('[data-field="completed"]').value) || 0;
    const notes = card.querySelector('[data-field="notes"]').value || null;
    
    msgEl.textContent = 'Guardando...';

    try {
      await sessionService.updateSession(sessionId, { completed_sessions: completed, notes });
      msgEl.textContent = '✓ Guardado';
      Toast.success('Sesión actualizada');
      await this.load();
    } catch (error) {
      msgEl.textContent = error.message;
      Toast.error('Error al guardar sesión');
    }
  }

  async handleHistoryToggle(card, sessionId, toggleBtn) {
    const section = card.querySelector(`[data-history-section="${sessionId}"]`);
    if (!section) return;

    const hidden = section.hasAttribute('hidden');
    
    if (hidden) {
      section.removeAttribute('hidden');
      toggleBtn.textContent = 'Ocultar historial';
      const panel = section.querySelector('[data-history-panel]');
      if (panel && !this.historyCache[sessionId]) {
        await this.loadHistory(sessionId, panel).catch(err => {
          panel.innerHTML = `<p class="history-empty">${err.message}</p>`;
        });
      } else if (panel && this.historyCache[sessionId]) {
        panel.innerHTML = this.historyCache[sessionId];
      }
    } else {
      section.setAttribute('hidden', '');
      toggleBtn.textContent = 'Ver historial';
    }
  }

  handleHistoryAdd(card, sessionId) {
    const form = card.querySelector(`[data-history-form="${sessionId}"]`);
    if (!form) return;

    const today = new Date().toISOString().slice(0, 10);
    form.querySelector('[name="appointment_date"]').value = form.dataset.lastDate || today;
    form.querySelector('[name="start_time"]').value = form.dataset.lastStart || '10:00';
    form.querySelector('[name="end_time"]').value = form.dataset.lastEnd || '11:00';
    form.querySelector('[name="professional_name"]').value = form.dataset.lastProf || '';
    form.querySelector('[name="notes"]').value = '';
    form.removeAttribute('hidden');
  }

  handleHistoryDuplicate(card, sessionId) {
    const form = card.querySelector(`[data-history-form="${sessionId}"]`);
    if (!form) return;

    form.querySelector('[name="appointment_date"]').value = form.dataset.lastDate || '';
    form.querySelector('[name="start_time"]').value = form.dataset.lastStart || '10:00';
    form.querySelector('[name="end_time"]').value = form.dataset.lastEnd || '11:00';
    form.querySelector('[name="professional_name"]').value = form.dataset.lastProf || '';
    form.removeAttribute('hidden');
  }

  async handleHistoryComplete(btn) {
    const apptId = btn.dataset.historyComplete;
    const sessionId = btn.dataset.historySession;
    
    btn.textContent = 'Guardando...';
    btn.disabled = true;

    try {
      await appointmentService.updateAppointment(apptId, { status: 'completed' });
      Toast.success('Sesión marcada como completada');
      
      if (sessionId) {
        this.historyCache[sessionId] = '';
        const panel = document.querySelector(`[data-history-panel="${sessionId}"]`);
        if (panel) await this.loadHistory(sessionId, panel);
      }
    } catch (error) {
      btn.textContent = 'Marcar completada';
      btn.disabled = false;
      Toast.error('Error al marcar sesión como completada');
    }
  }

  async handleHistoryDelete(btn) {
    if (!confirm('¿Eliminar esta sesión del historial?')) return;

    const apptId = btn.dataset.historyDelete;
    const panel = btn.closest('[data-history-panel]');
    const sessionId = panel ? panel.dataset.historyPanel : null;

    try {
      await appointmentService.deleteAppointment(apptId);
      Toast.success('Sesión eliminada');
      
      if (sessionId) {
        this.historyCache[sessionId] = '';
        await this.loadHistory(sessionId, panel);
      }
    } catch (error) {
      Toast.error('Error al eliminar sesión');
    }
  }

  async handleMergeAppointment(btn) {
    const apptId = parseInt(btn.dataset.mergeAppt);
    const targetSid = btn.dataset.mergeTarget;
    const sourceSid = btn.dataset.mergeSource;
    
    btn.textContent = 'Moviendo...';
    btn.disabled = true;

    try {
      await appointmentService.updateAppointment(apptId, { session_id: parseInt(targetSid) });
      Toast.success('Sesión movida al bono');
      
      this.historyCache[targetSid] = '';
      if (sourceSid) this.historyCache[sourceSid] = '';
      
      const panel = document.querySelector(`[data-history-panel="${targetSid}"]`);
      if (panel) await this.loadHistory(targetSid, panel);
    } catch (error) {
      btn.textContent = 'Añadir a este bono';
      btn.disabled = false;
      Toast.error('Error al mover sesión');
    }
  }

  async handleBonusCreate(card, sessionId) {
    const panel = card.querySelector(`[data-history-panel="${sessionId}"]`);
    const bform = card.querySelector(`[data-bonus-form="${sessionId}"]`);
    const bmsg = bform ? bform.querySelector('[data-bonus-message]') : null;
    const planned = parseInt(bform.querySelector('[name="bonus_sessions"]').value);
    const clientId = parseInt(panel.dataset.clientId);
    const treatment = decodeURIComponent(panel.dataset.treatment || '');

    if (!clientId || !treatment || isNaN(planned) || planned < 1) {
      if (bmsg) bmsg.textContent = 'Datos incompletos';
      Toast.error('Datos incompletos');
      return;
    }

    if (bmsg) bmsg.textContent = 'Creando...';

    try {
      await sessionService.createSession({
        client_id: clientId,
        treatment_name: treatment,
        planned_sessions: planned,
        completed_sessions: 0,
        status: 'planned',
        notes: null
      });
      
      if (bmsg) bmsg.textContent = '✓ Bono creado';
      Toast.success('Bono creado');
      await this.load();
    } catch (error) {
      if (bmsg) bmsg.textContent = error.message;
      Toast.error('Error al crear bono');
    }
  }
}

// Initialize controller
new SessionsModernController();

/**
 * Sessions Modern Controller - Refactored to use clean architecture
 * Daily sessions page with agenda view and search functionality
 */

import { sessionService } from '../../src/services/session.service.js';
import { appointmentService } from '../../src/services/appointment.service.js';
import { serviceService } from '../../src/services/service.service.js';
import { storage } from '../../src/core/storage.js';
import { Toast } from '../../src/ui/components/toast.js';
import { Loading } from '../../src/ui/components/loading.js';
import { BonusCreator } from '../../src/ui/components/bonus-creator.js';
import { PagoModal } from '../../src/ui/components/pago-modal.js';
import { getStatusLabel, getStatusClass } from '../../src/utils/status-labels.js';

class SessionsModernController {
  constructor() {
    this.CONSENT_KEY = 'likestudio_client_prefill_v1';
    this.agendaItems = [];
    this.historyCache = {};
    this.consentByAppt = {};
    this.searchTimeout = null;
    this.mode = 'agenda'; // 'agenda' or 'search'
    this.bonusCreator = null;
    this.currentSearchQuery = ''; // Track current search query

    this.initEventListeners();
    this.initializeDate();
    this.initBonusCreator();
    this.load();
    
    // Expose instance for onclick handlers
    window.sessionsCtrl = this;
  }

  async initBonusCreator() {
    this.bonusCreator = new BonusCreator({
      onSuccess: () => {
        // If in search mode, refresh the search; otherwise load agenda
        if (this.mode === 'search' && this.currentSearchQuery) {
          this.loadBySearch(this.currentSearchQuery);
        } else {
          this.load();
        }
      }
    });
    await this.bonusCreator.init();
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
    // Count both 'completed' (attended) and 'cancelled' (no-show) as done
    const completed = items.filter(i => i.status === 'completed' || i.status === 'cancelled').length;
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

  buildHistoryHtml(sessionId, items, planned, completed, status, otherBonos, clientId, treatment) {
    const last = items[0] || {};
    const isCompleted = status === 'completed' || (Number(planned) > 0 && Number(completed) >= Number(planned));

    const bonusHtml = isCompleted && clientId ? `
      <div class="bonus-form">
        <span class="history-title">Crear nuevo bono</span>
        <button class="btn btn-secondary btn-sm" data-bonus-create="${clientId}">Crear bono</button>
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
                <span class="badge ${getStatusClass(appt.status)}">${getStatusLabel(appt.status)}</span>
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
    const clientName = panel.dataset.clientName;
    const clientPhone = panel.dataset.clientPhone;

    if (!clientId) {
      panel.innerHTML = '<p class="history-empty">Sin información del cliente</p>';
      return;
    }

    try {
      // Load all sessions for this client
      const allSessionsData = await sessionService.searchSessions({ 
        query: clientName || '', 
        limit: 100, 
        offset: 0,
        client_id: clientId 
      });

      const sessions = (allSessionsData.items || []).map(s => ({
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

      if (!sessions.length) {
        panel.innerHTML = '<p class="history-empty">Sin bonos para este cliente</p>';
        return;
      }

      // Load appointments for each session
      const appointmentMap = {};
      for (const session of sessions) {
        try {
          const apptsData = await sessionService.getSessionHistory(session.session_id, 200, 0);
          appointmentMap[session.session_id] = apptsData.items || [];
        } catch (error) {
          appointmentMap[session.session_id] = [];
        }
      }

      // Render using search view layout
      const html = this.buildSearchClientCard(
        {
          client_id: clientId,
          client_name: clientName,
          client_phone: clientPhone
        },
        sessions,
        appointmentMap
      );

      panel.innerHTML = html;
      this.historyCache[sessionId] = html;
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
    <div class="client-card" data-card data-appointment-id="${aid}" data-session-id="${sid}" data-completed="${done}">
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
        <button type="button" class="btn btn-success btn-sm" 
                data-pay-btn 
                data-cid="${item.client_id}" 
                data-sid="${item.service_id || ''}" 
                data-aid="${aid}"
                data-sname="${(item.service_name || '').replace(/"/g, '&quot;')}">💳 Crear pago</button>
        <button class="btn btn-primary btn-sm" data-attend="yes">✓ Asistió</button>
      </div>

      ${sid ? `
      <div class="history-section" data-history-section="${sid}" hidden>
        <div class="history-header">
          <span class="history-title">Historial de sesiones</span>
        </div>
        <div class="history-panel-inner"
             data-history-panel="${sid}"
             data-client-id="${item.client_id}"
             data-client-name="${item.client_name}"
             data-client-phone="${item.client_phone || ''}"
             data-planned="${total}"
             data-completed="${done}"
             data-status="${item.status}"
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
    this.currentSearchQuery = query; // Store for refresh
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

      // Group sessions by client
      const groupedByClient = {};
      items.forEach(item => {
        const key = item.client_id || `unknown-${item.client_name}`;
        if (!groupedByClient[key]) {
          groupedByClient[key] = {
            client: item,
            sessions: []
          };
        }
        groupedByClient[key].sessions.push(item);
      });

      // Load appointments for each session and render
      const htmlParts = [];
      for (const group of Object.values(groupedByClient)) {
        // Load appointments for each session in the group
        const appointmentMap = {};
        for (const session of group.sessions) {
          try {
            const apptsData = await sessionService.getSessionHistory(session.session_id, 200, 0);
            appointmentMap[session.session_id] = apptsData.items || [];
          } catch (error) {
            appointmentMap[session.session_id] = [];
          }
        }
        htmlParts.push(this.buildSearchClientCard(group.client, group.sessions, appointmentMap));
      }
      
      document.getElementById('sessions-list').innerHTML = htmlParts.join('');
    } catch (error) {
      document.getElementById('sessions-list').innerHTML = `
        <div class="empty-state">
          <div class="empty-state-title">Error</div>
          <div class="empty-state-text">${error.message}</div>
        </div>`;
      Toast.error('Error en la búsqueda');
    }
  }

  buildSearchClientCard(clientInfo, sessions, appointmentMap = {}) {
    const sessionsHtml = sessions.map(s => {
      const sid = s.session_id;
      const appointments = appointmentMap[sid] || [];
      const done = appointments.filter(a => a.status === 'completed' || a.status === 'cancelled').length;
      // Use actual appointment count if registered, otherwise use planned_sessions
      const total = Number(s.planned_sessions)> 0 ? Number(s.planned_sessions) :  appointments.length || 0;
      const p = total > 0 ? Math.round((done / total) * 100) : 0;

      // Build appointments list for this bono
      const appointmentsHtml = appointments.length > 0 ? `
        <div class="search-bono-appointments">
          <div class="search-appointments-header">
            <span class="search-appointments-title">Sesiones registradas (${done}/${total})</span>
          </div>
          <div class="search-appointments-list">
            ${appointments.map(appt => {
              const statusColor = appt.status === 'completed' ? 'success' : appt.status === 'pending' ? 'warning' : appt.status === 'cancelled' ? 'danger' : 'secondary';
              return `
              <div class="search-appointment-item" data-appointment-id="${appt.id}">
                <div class="search-appointment-details">
                  <div class="search-appointment-datetime">
                    ${appt.appointment_date} · ${appt.start_time}–${appt.end_time}
                  </div>
                  <div class="search-appointment-service">
                    ${s.service_name}${appt.professional_name ? ' · ' + appt.professional_name : ''}${appt.notes ? ' · ' + appt.notes : ''}
                  </div>
                </div>
                <div class="search-appointment-actions">
                  <span class="badge badge-${statusColor}">${appt.status === 'completed' ? '✓ Completada' : appt.status === 'pending' ? 'Programada' : appt.status === 'cancelled' ? 'Cancelada' : appt.status}</span>
                  ${appt.status !== 'completed' && appt.status !== 'cancelled' ? `<button class="btn btn-secondary btn-xs" data-search-appt-mark="${appt.id}" data-search-session="${sid}">Marcar completada</button>` : ''}
                  <button class="btn btn-danger btn-xs" data-search-appt-delete="${appt.id}" data-search-session="${sid}">Eliminar</button>
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>
      ` : '<p class="search-appointments-empty">Sin sesiones registradas</p>';

      // Add appointment form (only if not complete)
      const today = new Date().toISOString().slice(0, 10);
      const lastAppt = appointments[0] || {};
      const isComplete = total > 0 && done >= total;
      const addApptForm = !isComplete ? `
        <div class="search-add-appointment-form">
          <button class="btn btn-secondary btn-sm" data-search-add-appt-toggle="${sid}" style="width: 100%;">+ Agregar sesión pasada</button>
          <form class="search-add-appt-form" data-search-add-appt-form="${sid}" hidden>
            <div class="search-appt-form-row">
              <div class="search-form-group">
                <label class="filter-label">Fecha</label>
                <input type="date" name="appointment_date" class="filter-input" value="${lastAppt.appointment_date || today}" required />
              </div>
              <div class="search-form-group">
                <label class="filter-label">Inicio</label>
                <input type="time" name="start_time" class="filter-input" value="${lastAppt.start_time || '10:00'}" required />
              </div>
              <div class="search-form-group">
                <label class="filter-label">Fin</label>
                <input type="time" name="end_time" class="filter-input" value="${lastAppt.end_time || '11:00'}" required />
              </div>
              <div class="search-form-group">
                <label class="filter-label">Profesional</label>
                <input type="text" name="professional_name" class="filter-input" value="${lastAppt.professional_name || ''}" required />
              </div>
              <div class="search-form-group">
                <label class="filter-label">Notas</label>
                <input type="text" name="notes" class="filter-input" placeholder="Notas opcionales..." />
              </div>
            </div>
            <div class="search-appt-form-actions">
              <button type="submit" class="btn btn-primary btn-sm">Guardar</button>
              <button type="button" class="btn btn-secondary btn-sm" data-search-add-appt-cancel="${sid}">Cancelar</button>
            </div>
          </form>
        </div>
      ` : '';

      return `
      <div class="search-session-card" data-session-id="${sid}">
        <div class="search-session-header" data-toggle-session="${sid}">
          <div class="search-session-info">
            <div class="search-session-title">${s.service_name}</div>
            <div class="search-session-progress">
              <div class="progress-bar"><div class="progress-fill" style="width:${p}%"></div></div>
              <span class="progress-text">${done}/${total}</span>
            </div>
          </div>
          <span class="badge badge-${s.status === 'completed' ? 'success' : s.status === 'planned' ? 'primary' : 'secondary'}">${s.status}</span>
        </div>
        <div class="search-session-details" data-details="${sid}" hidden>
          <div class="search-session-body">
            ${appointmentsHtml}
            ${addApptForm}
            ${!isComplete ? `<div class="session-field">
              <span class="session-field-label">Notas del bono</span>
              <textarea class="notes-textarea" data-field="notes" placeholder="Notas de la sesión...">${s.notes || ''}</textarea>
            </div>` : ''}
          </div>
          <div class="search-session-actions">
            <span class="card-msg" data-msg></span>
            ${!isComplete ? `<button class="btn btn-secondary btn-sm" data-search-save-session="${sid}">Guardar</button>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');

    return `
    <div class="search-client-card" data-client-id="${clientInfo.client_id}">
      <div class="search-client-header">
        <div class="search-client-info">
          <h2 class="search-client-name">${clientInfo.client_name}</h2>
          <div class="search-client-meta">
            <span class="search-client-meta-item">📞 ${clientInfo.client_phone || 'Sin teléfono'}</span>
            <span class="search-client-meta-item">🗓 ${sessions.length} bono${sessions.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <div class="search-client-actions">
          <button class="btn btn-primary btn-sm" data-search-create-bono="${clientInfo.client_id}">+ Crear Bono</button>
        </div>
      </div>
      <div class="search-sessions-list">
        ${sessionsHtml}
      </div>
    </div>`;
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
    // Search results - Create bono
    const searchBonusBtn = e.target.closest('[data-search-create-bono]');
    if (searchBonusBtn) {
      const clientId = parseInt(searchBonusBtn.dataset.searchCreateBono);
      this.bonusCreator.show(clientId);
      return;
    }

    // Search results - Toggle session details
    const toggleSession = e.target.closest('[data-toggle-session]');
    if (toggleSession) {
      const sessionId = toggleSession.dataset.toggleSession;
      const detailsEl = toggleSession.closest('[data-session-id]').querySelector(`[data-details="${sessionId}"]`);
      if (detailsEl) {
        detailsEl.toggleAttribute('hidden');
      }
      return;
    }

    // Search results - Toggle add appointment form
    const toggleAddApptBtn = e.target.closest('[data-search-add-appt-toggle]');
    if (toggleAddApptBtn) {
      const sessionId = toggleAddApptBtn.dataset.searchAddApptToggle;
      const form = toggleAddApptBtn.closest('[data-session-id]').querySelector(`[data-search-add-appt-form="${sessionId}"]`);
      if (form) {
        form.toggleAttribute('hidden');
      }
      return;
    }

    // Search results - Cancel add appointment form
    const cancelAddApptBtn = e.target.closest('[data-search-add-appt-cancel]');
    if (cancelAddApptBtn) {
      const sessionId = cancelAddApptBtn.dataset.searchAddApptCancel;
      const form = cancelAddApptBtn.closest('[data-session-id]').querySelector(`[data-search-add-appt-form="${sessionId}"]`);
      if (form) {
        form.setAttribute('hidden', '');
      }
      return;
    }

    // Search results - Mark appointment as complete
    const markApptBtn = e.target.closest('[data-search-appt-mark]');
    if (markApptBtn) {
      const apptId = markApptBtn.dataset.searchApptMark;
      const sessionId = markApptBtn.dataset.searchSession;
      markApptBtn.textContent = 'Guardando...';
      markApptBtn.disabled = true;
      try {
        await appointmentService.updateAppointment(apptId, { status: 'completed', session_id: sessionId ? parseInt(sessionId) : null });
        Toast.success('Sesión marcada como completada');
        // Reload search to refresh appointments
        if (this.currentSearchQuery) {
          await this.loadBySearch(this.currentSearchQuery);
        }
      } catch (error) {
        markApptBtn.textContent = 'Marcar completada';
        markApptBtn.disabled = false;
        Toast.error('Error al marcar sesión como completada');
      }
      return;
    }

    // Search results - Delete appointment
    const deleteApptBtn = e.target.closest('[data-search-appt-delete]');
    if (deleteApptBtn) {
      if (!confirm('¿Eliminar esta sesión del historial?')) return;
      const apptId = deleteApptBtn.dataset.searchApptDelete;
      const sessionId = deleteApptBtn.dataset.searchSession;
      deleteApptBtn.textContent = 'Eliminando...';
      deleteApptBtn.disabled = true;
      try {
        await appointmentService.deleteAppointment(apptId);
        Toast.success('Sesión eliminada');
        // Reload search to refresh appointments
        if (this.currentSearchQuery) {
          await this.loadBySearch(this.currentSearchQuery);
        }
      } catch (error) {
        deleteApptBtn.textContent = 'Eliminar';
        deleteApptBtn.disabled = false;
        Toast.error('Error al eliminar sesión');
      }
      return;
    }

    // Search results - Save session (bono notes)
    const saveSessBtn = e.target.closest('[data-search-save-session]');
    if (saveSessBtn) {
      const sessionId = saveSessBtn.dataset.searchSaveSession;
      const card = saveSessBtn.closest('[data-session-id]');
      const notes = card.querySelector('[data-field="notes"]').value || null;
      const msgEl = card.querySelector('[data-msg]');
      
      msgEl.textContent = 'Guardando...';
      try {
        await sessionService.updateSession(sessionId, { notes });
        msgEl.textContent = '✓ Guardado';
        Toast.success('Sesión actualizada');
      } catch (error) {
        msgEl.textContent = error.message || 'Error al guardar';
        Toast.error('Error al guardar sesión');
      }
      return;
    }

    // Original agenda card click handling
    const card = e.target.closest('[data-card]');
    if (!card) return;

    const aid = card.dataset.appointmentId;
    const sid = card.dataset.sessionId;
    const msg = card.querySelector('[data-msg]');

    // Attend button
    const attendBtn = e.target.closest('[data-attend]');
    if (attendBtn) {
      const attendType = attendBtn.dataset.attend;
      console.log('Attend button clicked:', { appointmentId: aid, sessionId: sid, attendType });
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

    // Create payment button
    const payBtn = e.target.closest('[data-pay-btn]') || e.target.closest('a[data-pay-btn]');
    if (payBtn) {
      e.preventDefault();
      const clientId = Number(payBtn.dataset.cid);
      const serviceId = Number(payBtn.dataset.sid) || null;
      const appointmentId = Number(payBtn.dataset.aid);
      const serviceName = payBtn.dataset.sname || '';
      await this.openPaymentModal(clientId, serviceId, appointmentId, serviceName);
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
      const clientId = parseInt(bonusBtn.dataset.bonusCreate);
      this.bonusCreator.show(clientId);
      return;
    }
  }

  async handleFormSubmit(e) {
    // Handle search add appointment form
    const searchAddApptForm = e.target.closest('[data-search-add-appt-form]');
    if (searchAddApptForm) {
      e.preventDefault();
      const sessionId = searchAddApptForm.dataset.searchAddApptForm;
      const formData = new FormData(searchAddApptForm);
      
      const payload = {
        appointment_date: formData.get('appointment_date'),
        start_time: formData.get('start_time'),
        end_time: formData.get('end_time'),
        professional_name: formData.get('professional_name'),
        notes: formData.get('notes') || null,
        status: 'completed'
      };

      try {
        await sessionService.createSessionAppointment(sessionId, payload);
        Toast.success('Sesión guardada');
        searchAddApptForm.setAttribute('hidden', '');
        searchAddApptForm.reset();
        // Reload search to refresh appointments
        if (this.currentSearchQuery) {
          await this.loadBySearch(this.currentSearchQuery);
        }
      } catch (error) {
        Toast.error(error.message || 'Error al guardar sesión');
      }
      return;
    }

    // Handle history form (original functionality)
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
    if (!appointmentId) {
      msgEl.textContent = 'Error: ID de cita no válido';
      Toast.error('ID de cita no válido');
      return;
    }

    msgEl.textContent = 'Guardando...';
    
    try {
      const result = await sessionService.markAttendance(parseInt(appointmentId), attended);
      console.log('Attendance marked:', result);
      msgEl.textContent = attended ? '✓ Asistencia marcada' : 'No asistencia marcada';
      Toast.success(attended ? 'Asistencia marcada' : 'No asistencia marcada');
      await this.load();
    } catch (error) {
      console.error('Error marking attendance:', error);
      msgEl.textContent = error.message || 'Error al marcar asistencia';
      Toast.error('Error al marcar asistencia');
    }
  }

  async handleNoShowLost(appointmentId, sessionId, msgEl) {
    if (!appointmentId) {
      msgEl.textContent = 'Error: ID de cita no válido';
      Toast.error('ID de cita no válido');
      return;
    }

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
        const card = document.querySelector(`[data-card][data-session-id="${sessionId}"]`);
        if (card) {
          const currentCompleted = parseInt(card.dataset.completed) || 0;
          await sessionService.updateSession(sessionId, { 
            completed_sessions: currentCompleted + 1 
          });
        }
      }

      msgEl.textContent = '✓ Sesión perdida marcada';
      Toast.success('Sesión marcada como perdida - cuenta como completada');
      await this.load();
    } catch (error) {
      console.error('Error marking no-show:', error);
      msgEl.textContent = error.message || 'Error al marcar sesión perdida';
      Toast.error('Error al marcar sesión perdida');
    }
  }

  async handleSaveSession(card, sessionId, msgEl) {
    if (!sessionId) return;
    
    const notes = card.querySelector('[data-field="notes"]').value || null;
    
    msgEl.textContent = 'Guardando...';

    try {
      await sessionService.updateSession(sessionId, { notes });
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
      await appointmentService.updateAppointment(apptId, { status: 'completed', session_id: sessionId ? parseInt(sessionId) : null });
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

  async openPaymentModal(clientId, serviceId, appointmentId, serviceName = '') {
    const description = serviceName ? `Pago por ${serviceName}` : 'Pago por servicio';
    console.log('Opening payment modal with:', { clientId, serviceId, appointmentId, serviceName });
    
    // If we don't have serviceId but have serviceName, try to find it
    let finalServiceId = serviceId;
    if (!serviceId && serviceName) {
      console.log('No service_id provided, trying to find by name:', serviceName);
      try {
        const servicesResponse = await serviceService.searchServices();
        if (servicesResponse && servicesResponse.items) {
          const matchingService = servicesResponse.items.find(s => 
            s.name.toLowerCase() === serviceName.toLowerCase()
          );
          if (matchingService) {
            finalServiceId = matchingService.id;
            console.log('Found matching service:', matchingService);
          } else {
            console.warn('No matching service found for name:', serviceName);
          }
        }
      } catch (error) {
        console.error('Error looking up service:', error);
      }
    }
    
    await PagoModal.createAndOpen({
      client_id: clientId,
      service_id: finalServiceId || undefined,
      description: description
    }, {
      onSuccess: () => {
        Toast.success('Pago creado correctamente');
        this.load();
      }
    });
  }
}

// Global function for onclick handlers
window.sessionsPagoClick = async function(clientId, serviceId, appointmentId, serviceName) {
  if (window.sessionsCtrl) {
    await window.sessionsCtrl.openPaymentModal(clientId, serviceId, appointmentId, serviceName);
  }
};

// Initialize controller
new SessionsModernController();

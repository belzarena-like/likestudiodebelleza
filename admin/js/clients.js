/**
 * Clients Controller - Refactored to use clean architecture with expandable cards
 */

import { clientService } from '../../src/services/client.service.js';
import { serviceService } from '../../src/services/service.service.js';
import { sessionService } from '../../src/services/session.service.js';
import { Toast } from '../../src/ui/components/toast.js';
import { Modal } from '../../src/ui/components/modal.js';
import { Loading } from '../../src/ui/components/loading.js';
import { Form } from '../../src/ui/components/form.js';
import { BonusCreator } from '../../src/ui/components/bonus-creator.js';
import { PagoModal } from '../../src/ui/components/pago-modal.js';
import { getStatusLabel, getStatusClass } from '../../src/utils/status-labels.js';

class ClientsController {
  constructor() {
    this.LIMIT = 25;
    this.offset = 0;
    this.lastTotal = 0;
    this.editingId = null;
    this.clientsById = {};
    this.expandedClientId = null;
    this.bonusCreator = null;

    // DOM elements
    this.form = document.getElementById('search-form');
    this.summary = document.getElementById('summary');
    this.clientsList = document.getElementById('clients-list');
    this.modal = new Modal('client-modal');
    this.modalTitle = document.getElementById('modal-title');
    this.clientForm = document.getElementById('client-form');

    this.initEventListeners();
    this.initBonusCreator();
    this.load();
  }

  async initBonusCreator() {
    this.bonusCreator = new BonusCreator({
      onSuccess: () => {
        if (this.expandedClientId) {
          this.loadHistory(this.expandedClientId);
        }
      }
    });
    await this.bonusCreator.init();
  }

  initEventListeners() {
    // Search form
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.offset = 0;
      this.load();
    });

    // Reset button
    document.getElementById('reset').addEventListener('click', () => {
      this.form.reset();
      this.offset = 0;
      this.load();
    });

    // Pagination
    document.getElementById('prev').addEventListener('click', () => {
      this.offset = Math.max(0, this.offset - this.LIMIT);
      this.load();
    });

    document.getElementById('next').addEventListener('click', () => {
      if (this.offset + this.LIMIT < this.lastTotal) {
        this.offset += this.LIMIT;
        this.load();
      }
    });

    // New client button
    document.getElementById('new-client').addEventListener('click', () => {
      this.resetForm();
      this.modal.show();
    });

    // Modal close
    document.getElementById('modal-close').addEventListener('click', () => {
      this.modal.hide();
    });

    // Client form submit
    this.clientForm.addEventListener('submit', (e) => this.handleSubmit(e));

    // Client card actions (event delegation)
    this.clientsList.addEventListener('click', (e) => {
      const card = e.target.closest('.client-card');
      if (!card) return;

      const clientId = parseInt(card.dataset.clientId);

      // Toggle card
      if (e.target.closest('.client-card-header') && !e.target.closest('.client-card-actions')) {
        this.toggleCard(clientId);
        return;
      }

      // Edit button
      const editBtn = e.target.closest('[data-edit-id]');
      if (editBtn) {
        e.stopPropagation();
        this.startEdit(clientId);
        return;
      }

      // Create bonus button
      const bonusBtn = e.target.closest('[data-create-bonus]');
      if (bonusBtn) {
        e.stopPropagation();
        const cid = parseInt(bonusBtn.dataset.createBonus);
        this.bonusCreator.show(cid);
        return;
      }

      // Create payment button
      const paymentBtn = e.target.closest('[data-create-payment]');
      if (paymentBtn) {
        e.stopPropagation();
        const clientId = parseInt(paymentBtn.dataset.clientId);
        this.openPaymentModal(clientId);
        return;
      }
    });

    // Autocomplete (if available)
    const queryInput = document.getElementById('query');
    if (window.LikeStudioWidgets && queryInput) {
      window.LikeStudioWidgets.attachClientAutocomplete(queryInput, { minChars: 2 });
      queryInput.addEventListener('ls:select', () => {
        this.offset = 0;
        this.load();
      });
    }
  }

  async load() {
    try {
      this.summary.textContent = 'Cargando...';
      
      const formData = new FormData(this.form);
      const query = formData.get('query') || null;


      const data = await clientService.searchClients({
      query,
      withConsents: false,
      limit: this.LIMIT,
      offset: this.offset
    });
      
      this.lastTotal = data.total;
      this.renderCards(data.items);
      this.updateSummary(data);
      this.updatePagination(data);
    } catch (error) {
      this.summary.textContent = 'Error al cargar clientes';
      this.clientsList.innerHTML = '<p class="history-empty">No se pudieron cargar los clientes</p>';
      Toast.error('No se pudieron obtener los clientes');
    }
  }

  renderCards(items) {
    if (!items.length) {
      this.clientsList.innerHTML = '<p class="history-empty">Sin resultados.</p>';
      return;
    }

    this.clientsById = {};
    this.clientsList.innerHTML = items.map(item => {
      this.clientsById[item.id] = item;
      
      return `
        <div class="client-card" data-client-id="${item.id}">
          <div class="client-card-header">
            <div class="client-card-field">
              <span class="client-card-label">Nombre</span>
              <span class="client-card-value">${item.full_name}</span>
            </div>
            <div class="client-card-field">
              <span class="client-card-label">DNI/NIE</span>
              <span class="client-card-value">${item.id_number}</span>
            </div>
            <div class="client-card-field">
              <span class="client-card-label">Teléfono</span>
              <span class="client-card-value">${item.phone || '—'}</span>
            </div>
            <div class="client-card-field">
              <span class="client-card-label">Email</span>
              <span class="client-card-value">${item.email || '—'}</span>
            </div>
            <div class="client-card-actions">
              <button class="btn btn-secondary btn-sm" data-edit-id="${item.id}" title="Editar cliente">
                ✏️ Editar
              </button>
              <button class="btn btn-success btn-sm" data-create-payment data-client-id="${item.id}" title="Crear pago">
                💳 Pago
              </button>
              <button class="client-card-toggle" title="Ver historial">
                ▼
              </button>
            </div>
          </div>
          <div class="client-card-body">
            <div class="client-card-content" id="client-history-${item.id}">
              <p class="history-empty">Cargando historial...</p>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  updateSummary(data) {
    const from = data.total === 0 ? 0 : data.offset + 1;
    const to = Math.min(data.offset + data.limit, data.total);
    this.summary.textContent = `Mostrando ${from}–${to} de ${data.total} clientes.`;
  }

  updatePagination(data) {
    document.getElementById('prev').disabled = data.offset <= 0;
    document.getElementById('next').disabled = data.offset + data.limit >= data.total;
  }

  async toggleCard(clientId) {
    const card = document.querySelector(`[data-client-id="${clientId}"]`);
    if (!card) return;

    const isExpanded = card.classList.contains('expanded');

    // Collapse all cards
    document.querySelectorAll('.client-card.expanded').forEach(c => {
      c.classList.remove('expanded');
    });

    if (!isExpanded) {
      card.classList.add('expanded');
      this.expandedClientId = clientId;
      await this.loadHistory(clientId);
    } else {
      this.expandedClientId = null;
    }
  }

  async loadHistory(clientId) {
    const client = this.clientsById[clientId];
    if (!client) return;

    const content = document.getElementById(`client-history-${clientId}`);
    content.innerHTML = '<p class="history-empty">Cargando historial...</p>';

    try {
      // Fetch all client data in parallel
      const [consents, sessions, appointments, payments] = await Promise.all([
        this.fetchConsents(clientId),
        this.fetchSessions(clientId),
        this.fetchAppointments(clientId),
        this.fetchPayments(clientId)
      ]);

      content.innerHTML = this.renderHistory(client, consents, sessions, appointments, payments);
    } catch (error) {
      content.innerHTML = '<p class="history-empty">Error al cargar el historial</p>';
      Toast.error('No se pudo cargar el historial del cliente');
    }
  }

  async fetchPayments(clientId) {
    try {
      const response = await fetch(`${window.APP_CONFIG.API_BASE_URL}/admin/payments?client_id=${clientId}&limit=50`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.items || [];
    } catch (error) {
      return [];
    }
  }

  async fetchConsents(clientId) {
    try {
      const response = await fetch(`${window.APP_CONFIG.API_BASE_URL}/clients/${clientId}/consents`);
      if (!response.ok) return [];
      return await response.json();
    } catch (error) {
      return [];
    }
  }

  async fetchSessions(clientId) {
    try {
      const response = await fetch(`${window.APP_CONFIG.API_BASE_URL}/admin/sessions?client_id=${clientId}&limit=100`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.items || [];
    } catch (error) {
      return [];
    }
  }

  async fetchAppointments(clientId) {
    try {
      const response = await fetch(`${window.APP_CONFIG.API_BASE_URL}/admin/appointments?client_id=${clientId}&limit=100`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.items || [];
    } catch (error) {
      return [];
    }
  }

  renderHistory(client, consents, sessions, appointments, payments) {
    const formatDate = (dateStr) => {
      if (!dateStr) return '—';
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    const formatTime = (timeStr) => {
      if (!timeStr) return '—';
      return timeStr.slice(0, 5);
    };

    const consentTypeMap = {
      'micropigmentation': 'Micropigmentación',
      'micropigmentation_capilar': 'Micropigmentación Capilar',
      'aesthetic_treatment': 'Tratamiento Estético',
      'laser': 'Láser'
    };

    const nameParam = encodeURIComponent(client.full_name || '');
    const sessionQuery = encodeURIComponent(client.phone || client.full_name || '');

    return `
      <div class="history-section">
        <div class="history-section-header">
          <div class="history-section-title">
            Consentimientos
            <span class="history-section-count">${consents.length}</span>
          </div>
          <div class="history-section-actions">
            <a href="index.html?full_name=${nameParam}" class="btn btn-secondary btn-sm" target="_blank">
              Ver Todos →
            </a>
          </div>
        </div>
        ${consents.length === 0 ? '<p class="history-empty">No hay consentimientos registrados</p>' : 
          consents.slice(0, 5).map(c => `
            <div class="history-item">
              <div class="history-item-header">
                <div>
                  <div class="history-item-title">${consentTypeMap[c.consent_type] || c.consent_type}</div>
                  <div class="history-item-detail">${c.treatment_areas}</div>
                  <div class="history-item-detail">Profesional: ${c.therapist_name}</div>
                </div>
                <div class="history-item-date">${formatDate(c.signed_at)}</div>
              </div>
              <div class="history-item-footer">
                <a href="consent-view.html?id=${c.id}" class="btn btn-secondary btn-sm" target="_blank">Ver Detalle</a>
              </div>
            </div>
          `).join('') + (consents.length > 5 ? `<p class="history-empty">Y ${consents.length - 5} más...</p>` : '')
        }
      </div>

      <div class="history-section">
        <div class="history-section-header">
          <div class="history-section-title">
            Sesiones de Tratamiento
            <span class="history-section-count">${sessions.length}</span>
          </div>
          <div class="history-section-actions">
            <button class="btn btn-primary btn-sm" data-create-bonus="${client.id}">
              + Crear Bono
            </button>
            <a href="sessions.html?query=${sessionQuery}" class="btn btn-secondary btn-sm" target="_blank">
              Ver Todas →
            </a>
          </div>
        </div>
        ${sessions.length === 0 ? '<p class="history-empty">No hay sesiones registradas</p>' : 
          sessions.slice(0, 5).map(s => `
            <div class="history-item">
              <div class="history-item-header">
                <div>
                  <div class="history-item-title">${s.treatment_name}</div>
                  <div class="history-item-detail">Sesiones: ${s.completed_sessions} / ${s.planned_sessions}</div>
                  ${s.notes ? `<div class="history-item-detail">Notas: ${s.notes}</div>` : ''}
                </div>
                <div class="history-item-date">${formatDate(s.created_at)}</div>
              </div>
              <div class="history-item-footer">
                <span class="history-item-badge ${getStatusClass(s.status)}">${getStatusLabel(s.status)}</span>
              </div>
            </div>
          `).join('') + (sessions.length > 5 ? `<p class="history-empty">Y ${sessions.length - 5} más...</p>` : '')
        }
      </div>

      <div class="history-section">
        <div class="history-section-header">
          <div class="history-section-title">
            Citas
            <span class="history-section-count">${appointments.length}</span>
          </div>
          <div class="history-section-actions">
            <a href="booking-draft.html?client_id=${client.id}" class="btn btn-secondary btn-sm" target="_blank">
              Ver Todas →
            </a>
          </div>
        </div>
        ${appointments.length === 0 ? '<p class="history-empty">No hay citas registradas</p>' : 
          appointments.slice(0, 5).map(a => `
            <div class="history-item">
              <div class="history-item-header">
                <div>
                  <div class="history-item-title">${a.service_name}</div>
                  <div class="history-item-detail">Profesional: ${a.professional_name}</div>
                  <div class="history-item-detail">Hora: ${formatTime(a.start_time)} - ${formatTime(a.end_time)}</div>
                  ${a.notes ? `<div class="history-item-detail">Notas: ${a.notes}</div>` : ''}
                </div>
                <div class="history-item-date">${formatDate(a.appointment_date)}</div>
              </div>
              <div class="history-item-footer">
                <span class="history-item-badge ${getStatusClass(a.status)}">${getStatusLabel(a.status)}</span>
              </div>
            </div>
          `).join('') + (appointments.length > 5 ? `<p class="history-empty">Y ${appointments.length - 5} más...</p>` : '')
        }
      </div>

      <div class="history-section">
        <div class="history-section-header">
          <div class="history-section-title">
            Pagos
            <span class="history-section-count">${payments.length}</span>
          </div>
          <div class="history-section-actions">
            <a href="payments.html?client_id=${client.id}" class="btn btn-secondary btn-sm" target="_blank">
              Ver Todos →
            </a>
          </div>
        </div>
        ${payments.length === 0 ? '<p class="history-empty">No hay pagos registrados</p>' : 
          payments.slice(0, 5).map(p => `
            <div class="history-item">
              <div class="history-item-header">
                <div>
                  <div class="history-item-title">${p.description || 'Pago'}</div>
                  <div class="history-item-detail">Método: ${p.payment_method}</div>
                  ${p.service_name ? `<div class="history-item-detail">Servicio: ${p.service_name}</div>` : ''}
                </div>
                <div class="history-item-date">${formatDate(p.payment_date)}</div>
              </div>
              <div class="history-item-footer">
                <span class="history-item-amount">${parseFloat(p.amount).toFixed(2)} €</span>
                <span class="history-item-badge badge-${p.payment_type}">${p.payment_type === 'income' ? 'Ingreso' : 'Gasto'}</span>
              </div>
            </div>
          `).join('') + (payments.length > 5 ? `<p class="history-empty">Y ${payments.length - 5} más...</p>` : '')
        }
      </div>
    `;
  }

  resetForm() {
    this.editingId = null;
    this.modalTitle.textContent = 'Nuevo cliente';
    document.getElementById('submit-btn').textContent = 'Guardar';
    Form.reset('client-form');
    document.getElementById('f-instagram').value = '';
    Form.clearErrors('client-form');
  }

  async startEdit(id) {
    const client = this.clientsById[id];
    if (!client) return;

    this.editingId = id;
    this.modalTitle.textContent = `Editar cliente #${id}`;
    document.getElementById('submit-btn').textContent = 'Actualizar';

    // Set form data
    Form.setData('client-form', {
      'f-full-name': client.full_name || '',
      'f-id-number': client.id_number || '',
      'f-phone': client.phone || '',
      'f-email': client.email || '',
    });

    // Load profile
    await this.loadProfile(id);

    this.modal.show();
  }

  async loadProfile(clientId) {
    try {
      const profile = await clientService.getClientProfile(clientId);
      if (profile && profile.instagram) {
        document.getElementById('f-instagram').value = profile.instagram;
      }
    } catch (error) {
      // Profile not found, that's ok
    }
  }

  async handleSubmit(e) {
    e.preventDefault();
    Form.clearErrors('client-form');

    const formData = Form.getData('client-form');
    const payload = {
      full_name: formData['f-full-name']?.trim(),
      id_number: formData['f-id-number']?.trim(),
      phone: formData['f-phone']?.trim() || null,
      email: formData['f-email']?.trim() || null,
    };

    // Validation
    if (!payload.full_name || !payload.id_number) {
      Toast.error('Nombre y DNI/NIE son obligatorios');
      return;
    }

    try {
      Loading.show(this.editingId ? 'Actualizando cliente...' : 'Creando cliente...');

      // Create or update client
      let client;
      if (this.editingId) {
        client = await clientService.updateClient(this.editingId, payload);
      } else {
        client = await clientService.createClient(payload);
      }

      // Update profile
      const instagram = formData['f-instagram']?.trim() || null;
      await clientService.upsertClientProfile(client.id, { instagram });

      Toast.success(this.editingId ? 'Cliente actualizado' : 'Cliente creado');
      this.resetForm();
      this.modal.hide();
      this.load();
    } catch (error) {
      Toast.error(error.message || 'No se pudo guardar el cliente');
    } finally {
      Loading.hide();
    }
  }

  openPaymentModal(clientId) {
    PagoModal.createAndOpen({ 
      client_id: clientId,
      description: 'Pago por servicio'
    }, {
      onSuccess: () => {
        Toast.success('Pago creado correctamente');
        // Refresh history section if expanded
        if (this.expandedClientId === clientId) {
          this.loadHistory(clientId);
        }
        this.load();
      }
    });
  }
}

// Initialize controller
new ClientsController();

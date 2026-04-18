/**
 * BonusCreator - Shared component for creating treatment session bonuses (bonos)
 */

import { sessionService } from '../../services/session.service.js';
import { serviceService } from '../../services/service.service.js';
import { Modal } from './modal.js';
import { Toast } from './toast.js';

export class BonusCreator {
  constructor(options = {}) {
    this.onSuccess = options.onSuccess || (() => {});
    this.clientId = options.clientId || null;
    this.modal = null;
    this.services = [];
  }

  async init() {
    await this.loadServices();
    this.createModal();
    this.setupEventListeners();
  }

  async loadServices() {
    try {
      const data = await serviceService.searchServices(null, false, 100);
      this.services = data.items || [];
    } catch (error) {
      this.services = [];
    }
  }

  createModal() {
    const modalHtml = `
      <div id="bonus-creator-modal" class="modal-overlay">
        <div class="modal-card">
          <div class="modal-header">
            <h3 class="modal-title">Crear Nuevo Bono</h3>
            <button class="modal-close" data-modal-close>&times;</button>
          </div>
          <div class="modal-body">
            <form id="bonus-creator-form">
              <div class="form-group">
                <label class="filter-label">Tratamiento *</label>
                <select name="treatment_name" class="filter-input" required>
                  <option value="">Seleccionar tratamiento...</option>
                  ${this.services.map(s => `<option value="${s.name}">${s.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="filter-label">Número de sesiones *</label>
                <input type="number" name="planned_sessions" class="filter-input" min="1" value="4" required />
              </div>
              <div class="form-group">
                <label class="filter-label">Notas</label>
                <input type="text" name="notes" class="filter-input" placeholder="Notas opcionales..." />
              </div>
              <div class="form-actions">
                <button type="button" class="btn btn-secondary" data-modal-close>Cancelar</button>
                <button type="submit" class="btn btn-primary">Crear Bono</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    const existing = document.getElementById('bonus-creator-modal');
    if (existing) existing.remove();

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    this.modal = document.getElementById('bonus-creator-modal');
    this.form = document.getElementById('bonus-creator-form');
  }

  setupEventListeners() {
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));

    this.modal.querySelectorAll('[data-modal-close]').forEach(btn => {
      btn.addEventListener('click', () => this.hide());
    });

    this.modal.addEventListener('click', (e) => {
    if (e.target === this.modal) {
      this.hide();
    }
  });
  }

  show(clientId = null) {
    if (clientId) this.clientId = clientId;
    this.form.reset();
    this.modal.classList.add('is-open');
    document.body.classList.add('modal-open');
  }

  hide() {
    this.modal.classList.remove('is-open');
    document.body.classList.remove('modal-open');
  }

  async handleSubmit(e) {
    e.preventDefault();

    if (!this.clientId) {
      Toast.error('ID de cliente no válido');
      return;
    }

    const formData = new FormData(this.form);
    const payload = {
      client_id: this.clientId,
      treatment_name: formData.get('treatment_name'),
      planned_sessions: parseInt(formData.get('planned_sessions')),
      completed_sessions: 0,
      status: 'planned',
      notes: formData.get('notes') || null
    };

    if (!payload.treatment_name || !payload.planned_sessions || payload.planned_sessions < 1) {
      Toast.error('Datos incompletos');
      return;
    }

    try {
      await sessionService.createSession(payload);
      Toast.success('Bono creado correctamente');
      this.hide();
      this.onSuccess(payload);
    } catch (error) {
      Toast.error(error.message || 'Error al crear el bono');
    }
  }

  static renderBonusCard(session) {
    const done = Number(session.completed_sessions) || 0;
    const total = Number(session.planned_sessions) || 0;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    return `
      <div class="history-item" data-session-id="${session.id}">
        <div class="history-item-header">
          <div>
            <div class="history-item-title">${session.treatment_name}</div>
            <div class="history-item-detail">Sesiones: ${done} / ${total}</div>
            ${session.notes ? `<div class="history-item-detail">Notas: ${session.notes}</div>` : ''}
          </div>
          <div class="history-item-date">${session.created_at ? new Date(session.created_at).toLocaleDateString('es-ES') : '—'}</div>
        </div>
        <div class="history-item-footer">
          <span class="history-item-badge badge-${session.status === 'completed' ? 'success' : session.status === 'planned' ? 'primary' : 'secondary'}">${session.status}</span>
          <div class="session-progress" style="width:100px">
            <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
          </div>
        </div>
      </div>
    `;
  }
}

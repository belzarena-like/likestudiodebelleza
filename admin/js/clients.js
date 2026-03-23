/**
 * Clients Controller - Refactored to use clean architecture
 */

import { clientService } from '../../src/services/client.service.js';
import { Toast } from '../../src/ui/components/toast.js';
import { Modal } from '../../src/ui/components/modal.js';
import { Loading } from '../../src/ui/components/loading.js';
import { Form } from '../../src/ui/components/form.js';

class ClientsController {
  constructor() {
    this.LIMIT = 25;
    this.offset = 0;
    this.lastTotal = 0;
    this.editingId = null;
    this.clientsById = {};

    // DOM elements
    this.form = document.getElementById('search-form');
    this.summary = document.getElementById('summary');
    this.tbody = document.getElementById('table-body');
    this.modal = new Modal('client-modal');
    this.modalTitle = document.getElementById('modal-title');
    this.clientForm = document.getElementById('client-form');

    this.initEventListeners();
    this.load();
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

    // Table row actions
    this.tbody.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-edit-id]');
      if (btn) {
        this.startEdit(parseInt(btn.dataset.editId));
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

      const data = await clientService.searchClients(query, false, this.LIMIT, this.offset);
      
      this.lastTotal = data.total;
      this.renderRows(data.items);
      this.updateSummary(data);
      this.updatePagination(data);
    } catch (error) {
      this.summary.textContent = 'Error al cargar clientes';
      this.tbody.innerHTML = '';
      Toast.error('No se pudieron obtener los clientes');
    }
  }

  renderRows(items) {
    if (!items.length) {
      this.tbody.innerHTML = `<tr><td class="admin-table-empty" colspan="5">Sin resultados.</td></tr>`;
      return;
    }

    this.clientsById = {};
    this.tbody.innerHTML = items.map(item => {
      this.clientsById[item.id] = item;
      const nameParam = encodeURIComponent(item.full_name || '');
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

  updateSummary(data) {
    const from = data.total === 0 ? 0 : data.offset + 1;
    const to = Math.min(data.offset + data.limit, data.total);
    this.summary.textContent = `Mostrando ${from}–${to} de ${data.total} clientes.`;
  }

  updatePagination(data) {
    document.getElementById('prev').disabled = data.offset <= 0;
    document.getElementById('next').disabled = data.offset + data.limit >= data.total;
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
}

// Initialize controller
new ClientsController();

/**
 * Services Controller - Refactored to use clean architecture
 */

import { serviceService } from '../../src/services/service.service.js';
import { Toast } from '../../src/ui/components/toast.js';
import { Modal } from '../../src/ui/components/modal.js';
import { Loading } from '../../src/ui/components/loading.js';
import { Form } from '../../src/ui/components/form.js';

class ServicesController {
  constructor() {
    this.LIMIT = 50;
    this.offset = 0;
    this.lastTotal = 0;

    // DOM elements
    this.form = document.getElementById('search-form');
    this.summary = document.getElementById('summary');
    this.tbody = document.getElementById('table-body');
    this.modal = new Modal('service-modal');
    this.modalTitle = document.getElementById('modal-title');
    this.serviceForm = document.getElementById('service-form');

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

    // New service button
    document.getElementById('new-service').addEventListener('click', () => {
      this.resetForm();
      this.modal.show();
    });

    // Modal close
    document.getElementById('modal-close').addEventListener('click', () => {
      this.modal.hide();
    });

    // Form reset
    document.getElementById('form-reset').addEventListener('click', () => {
      this.resetForm();
    });

    // Service form submit
    this.serviceForm.addEventListener('submit', (e) => this.handleSubmit(e));

    // Table row actions
    this.tbody.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-edit]');
      if (btn) {
        this.startEdit(btn.dataset);
      }
    });
  }

  async load() {
    try {
      this.summary.textContent = 'Cargando...';
      
      const formData = new FormData(this.form);
      const query = formData.get('query') || null;
      const activeOnly = formData.get('active_only') === 'true';

      const data = await serviceService.searchServices(query, activeOnly, this.LIMIT, this.offset);
      
      this.lastTotal = data.total;
      this.renderRows(data.items);
      this.updateSummary(data);
      this.updatePagination(data);
    } catch (error) {
      this.summary.textContent = 'Error al cargar servicios';
      this.tbody.innerHTML = '';
      Toast.error('No se pudieron obtener los servicios');
    }
  }

  renderRows(items) {
    if (!items.length) {
      this.tbody.innerHTML = `<tr><td class="admin-table-empty" colspan="4">Sin resultados.</td></tr>`;
      return;
    }

    this.tbody.innerHTML = items.map(item => `<tr>
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

  updateSummary(data) {
    const from = data.total === 0 ? 0 : data.offset + 1;
    const to = Math.min(data.offset + data.limit, data.total);
    this.summary.textContent = `Mostrando ${from}–${to} de ${data.total} servicios.`;
  }

  updatePagination(data) {
    document.getElementById('prev').disabled = data.offset <= 0;
    document.getElementById('next').disabled = data.offset + data.limit >= data.total;
  }

  resetForm() {
    this.modalTitle.textContent = 'Nuevo servicio';
    document.getElementById('submit-btn').textContent = 'Guardar';
    Form.setData('service-form', {
      'f-id': '',
      'f-name': '',
      'f-duration': '60',
      'f-active': 'true',
    });
    Form.clearErrors('service-form');
  }

  startEdit(data) {
    this.modalTitle.textContent = `Editar servicio #${data.id}`;
    document.getElementById('submit-btn').textContent = 'Actualizar';
    
    Form.setData('service-form', {
      'f-id': data.id,
      'f-name': data.name,
      'f-duration': data.duration,
      'f-active': data.active === 'true' ? 'true' : 'false',
    });
    
    Form.clearErrors('service-form');
    this.modal.show();
  }

  async handleSubmit(e) {
    e.preventDefault();
    Form.clearErrors('service-form');

    const formData = Form.getData('service-form');
    const name = formData['f-name']?.trim();
    const duration = parseInt(formData['f-duration'], 10);
    const id = formData['f-id'];

    // Validation
    if (!name) {
      Toast.error('Ingresa un nombre');
      return;
    }
    if (!duration || isNaN(duration)) {
      Toast.error('Ingresa una duración válida');
      return;
    }

    const payload = {
      name,
      active: formData['f-active'] === 'true',
      duration_minutes: duration,
    };

    try {
      Loading.show(id ? 'Actualizando servicio...' : 'Creando servicio...');

      if (id) {
        await serviceService.updateService(id, payload);
        Toast.success('Servicio actualizado');
      } else {
        await serviceService.createService(payload);
        Toast.success('Servicio creado');
      }

      this.resetForm();
      this.modal.hide();
      this.load();
    } catch (error) {
      Toast.error(error.message || 'No se pudo guardar el servicio');
    } finally {
      Loading.hide();
    }
  }
}

// Initialize controller
new ServicesController();

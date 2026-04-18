/**
 * PagoModal - Reusable payment modal component
 * Creates its own modal HTML - no need to add to each page
 */

import { PaymentService } from '../../services/payment.service.js';
import { serviceService } from '../../services/service.service.js';
import { clientService } from '../../services/client.service.js';
import { Toast } from './toast.js';
import { Loading } from './loading.js';

let modalInstance = null;

export class PagoModal {
  constructor(options = {}) {
    this.options = {
      onSuccess: () => {},
      onClose: () => {},
      ...options
    };
    
    this.modal = null;
    this.form = null;
    this.servicesLoaded = false;
    
    this.init();
  }
  
  init() {
    // Don't recreate if already exists
    if (document.getElementById('pago-modal-overlay')) {
      this.modal = document.getElementById('pago-modal-overlay');
      this.form = document.getElementById('pago-form');
      this.setupEventListeners();
      // Reset the servicesLoaded flag when reusing existing modal
      this.servicesLoaded = false;
      return;
    }
    
    this.createModalHTML();
    this.setupEventListeners();
  }
  
  createModalHTML() {
    const overlay = document.createElement('div');
    overlay.id = 'pago-modal-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="pago-modal-title">
        <div class="modal-header">
          <h2 class="modal-title" id="pago-modal-title">Nuevo pago</h2>
          <button type="button" class="btn btn-secondary btn-sm" data-pago-close>✕ Cerrar</button>
        </div>
        <form id="pago-form" class="form-grid">
          <input type="hidden" id="pago-id" />
          
          <div class="form-field">
            <label for="pago-amount">Importe (€)</label>
            <input type="number" id="pago-amount" name="amount" step="0.01" min="0.01" required />
          </div>
          <div class="form-field">
            <label for="pago-date">Fecha</label>
            <input type="date" id="pago-date" name="payment_date" required />
          </div>
          
          <div class="form-field">
            <label for="pago-type">Tipo</label>
            <select id="pago-type" name="payment_type" required>
              <option value="income">Ingreso</option>
              <option value="expense">Gasto</option>
            </select>
          </div>
          <div class="form-field">
            <label for="pago-method">Método</label>
            <select id="pago-method" name="payment_method" required>
              <option value="cash">Efectivo</option>
              <option value="card">Tarjeta</option>
              <option value="transfer">Transferencia</option>
              <option value="other">Otro</option>
            </select>
          </div>
          
          <div class="form-field form-grid-full">
            <label for="pago-description">Descripción</label>
            <input type="text" id="pago-description" name="description" />
          </div>
          
          <div class="form-field">
            <label for="pago-service">Servicio (opcional)</label>
            <select id="pago-service" name="service_id">
              <option value="">Seleccionar servicio...</option>
            </select>
          </div>
          <div class="form-field">
            <label for="pago-client-id">Cliente (opcional)</label>
            <div class="ls-autocomplete-wrap">
              <input type="text" id="pago-client-search" name="client_search" placeholder="Buscar cliente..." autocomplete="off" />
              <input type="hidden" id="pago-client-id" name="client_id" />
              <div id="pago-client-results" class="ls-autocomplete-dropdown" style="display: none;"></div>
            </div>
          </div>
          
          <div class="form-field form-grid-full">
            <label for="pago-notes">Notas (opcional)</label>
            <textarea id="pago-notes" name="notes" rows="2"></textarea>
          </div>
          
          <div class="form-field form-grid-full">
            <label for="pago-reference">Número de referencia (opcional)</label>
            <input type="text" id="pago-reference" name="reference_number" />
          </div>
          
          <div class="form-actions form-grid-full">
            <button type="submit" class="btn btn-primary">Guardar</button>
            <button type="button" class="btn btn-secondary" data-pago-close>Cancelar</button>
          </div>
        </form>
      </div>
    `;
    
    document.body.appendChild(overlay);
    this.modal = overlay;
    this.form = document.getElementById('pago-form');
  }
  
  setupEventListeners() {
    // Close buttons
    this.modal.querySelectorAll('[data-pago-close]').forEach(btn => {
      btn.addEventListener('click', () => this.close());
    });
    
    // Form submit
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    
    // Close on overlay click
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.close();
      }
    });
  }
  
  async loadServices() {
    const select = document.getElementById('pago-service');
    if (!select) {
      console.error('Service select element not found!');
      return;
    }
    
    // Check if already loaded (has more than just the default option)
    if (select.options.length > 1) {
      console.log('Services already loaded, count:', select.options.length);
      return;
    }
    
    try {
      console.log('Loading services from API...');
      const response = await serviceService.searchServices();
      console.log('Services API response:', response);
      
      if (response && response.items) {
        // Clear existing options except the first one
        while (select.options.length > 1) {
          select.remove(1);
        }
        
        const sorted = [...response.items].sort((a, b) => a.name.localeCompare(b.name));
        console.log('Sorted services:', sorted);
        
        sorted.forEach(service => {
          const option = document.createElement('option');
          option.value = service.id;
          option.textContent = service.name;
          select.appendChild(option);
          console.log('Added service option:', service.id, '-', service.name);
        });
        
        console.log('Services loaded successfully, total count:', select.options.length);
        this.servicesLoaded = true;
      } else {
        console.warn('No services in response:', response);
      }
    } catch (error) {
      console.error('Error loading services:', error);
      console.error('Error stack:', error.stack);
    }
  }
  
  async open(prefill = {}) {
    console.log('Opening PagoModal with prefill:', prefill);
    
    // Show modal first for better UX
    this.modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    
    // Ensure services are loaded FIRST
    await this.loadServices();
    
    // Setup client autocomplete if not already
    this.setupClientAutocomplete();
    
    // Reset form
    this.form.reset();
    document.getElementById('pago-id').value = '';
    
    // Clear client search and hidden ID
    const clientSearchInput = document.getElementById('pago-client-search');
    const clientIdInput = document.getElementById('pago-client-id');
    if (clientSearchInput) clientSearchInput.value = '';
    if (clientIdInput) clientIdInput.value = '';
    
    // Set defaults
    document.getElementById('pago-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('pago-type').value = prefill.payment_type || 'income';
    document.getElementById('pago-method').value = prefill.payment_method || 'cash';
    document.getElementById('pago-description').value = prefill.description || 'Pago por servicio';
    
    // Set service if provided - services are now loaded
    if (prefill.service_id && prefill.service_id !== 'undefined' && prefill.service_id !== 'null') {
      const serviceSelect = document.getElementById('pago-service');
      if (serviceSelect) {
        // Convert to string for comparison
        const serviceIdStr = String(prefill.service_id);
        console.log('Setting service_id:', serviceIdStr);
        console.log('Available options:', Array.from(serviceSelect.options).map(o => ({ value: o.value, text: o.text })));
        
        serviceSelect.value = serviceIdStr;
        
        // If value didn't set (service not in list), log it
        if (serviceSelect.value !== serviceIdStr) {
          console.warn('Service ID not found in dropdown:', serviceIdStr);
          console.warn('Dropdown has', serviceSelect.options.length, 'options');
        } else {
          console.log('Service successfully set to:', serviceSelect.value, '-', serviceSelect.options[serviceSelect.selectedIndex].text);
        }
      }
    }
    
    // Set client if provided (do this last so it doesn't interfere with service loading)
    if (prefill.client_id) {
      if (clientIdInput) clientIdInput.value = prefill.client_id;
      await this.loadClientName(prefill.client_id);
    }
  }
  
  setupClientAutocomplete() {
    const clientSearchInput = document.getElementById('pago-client-search');
    const clientIdInput = document.getElementById('pago-client-id');
    const resultsEl = document.getElementById('pago-client-results');
    
    if (!clientSearchInput || !resultsEl || clientSearchInput.dataset.autocompleteAttached) return;
    clientSearchInput.dataset.autocompleteAttached = 'true';
    
    let timer = null;
    let lastQuery = '';
    
    clientSearchInput.addEventListener('input', (e) => {
      e.stopPropagation();
      const query = clientSearchInput.value.trim();
      if (query === lastQuery) return;
      lastQuery = query;
      
      // Clear hidden client ID when typing
      if (clientIdInput) clientIdInput.value = '';
      
      clearTimeout(timer);
      if (query.length < 2) {
        resultsEl.style.display = 'none';
        return;
      }
      
      timer = setTimeout(() => this.searchClients(query, resultsEl, clientSearchInput, clientIdInput), 300);
    });
    
    // Prevent dropdown from closing on mousedown
    resultsEl.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    
    // Close on blur with delay
    clientSearchInput.addEventListener('blur', () => {
      setTimeout(() => {
        if (!resultsEl.matches(':hover')) {
          resultsEl.style.display = 'none';
        }
      }, 300);
    });
    
    // Show results on focus if available
    clientSearchInput.addEventListener('focus', () => {
      if (resultsEl.children.length > 0 && clientSearchInput.value.trim().length >= 2) {
        resultsEl.style.display = 'block';
      }
    });
  }
  
  async searchClients(query, resultsEl, searchInputEl, idInputEl) {
    try {
      const response = await clientService.searchClients({ query, limit: 10 });
      resultsEl.innerHTML = '';
      
      if (!response.items || response.items.length === 0) {
        resultsEl.innerHTML = '<div class="ls-autocomplete-item">No se encontraron clientes</div>';
        resultsEl.style.display = 'block';
        return;
      }
      
      response.items.forEach(client => {
        const item = document.createElement('div');
        item.className = 'ls-autocomplete-item';
        item.innerHTML = `<strong>${client.full_name}</strong> <small>${client.id_number || client.phone || ''}</small>`;
        item.onclick = () => {
          searchInputEl.value = client.full_name;
          if (idInputEl) idInputEl.value = client.id;
          resultsEl.style.display = 'none';
        };
        resultsEl.appendChild(item);
      });
      
      resultsEl.style.display = 'block';
    } catch (error) {
      console.error('Error searching clients:', error);
      resultsEl.style.display = 'none';
    }
  }
  
  async loadClientName(clientId) {
    const clientSearchInput = document.getElementById('pago-client-search');
    const clientIdInput = document.getElementById('pago-client-id');
    
    try {
      const client = await clientService.getClientById(clientId);
      if (client) {
        if (clientSearchInput) clientSearchInput.value = client.full_name;
        if (clientIdInput) clientIdInput.value = client.id;
      }
    } catch (error) {
      console.error('Error loading client:', error);
    }
  }
  
  close() {
    if (this.modal) {
      this.modal.classList.remove('is-open');
      document.body.style.overflow = '';
    }
    
    this.options.onClose();
  }
  
  async handleSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const paymentId = document.getElementById('pago-id').value;
    const clientIdInput = document.getElementById('pago-client-id');
    const serviceSelect = document.getElementById('pago-service');
    
    const paymentData = {
      amount: parseFloat(form.amount.value),
      payment_date: form.payment_date.value,
      payment_type: form.payment_type.value,
      payment_method: form.payment_method.value,
      description: form.description?.value || 'Pago por servicio',
      service_id: serviceSelect?.value ? parseInt(serviceSelect.value) : null,
      client_id: clientIdInput?.value ? parseInt(clientIdInput.value) : null,
      notes: form.notes?.value || null,
      reference_number: form.reference_number?.value || null
    };
    
    Loading.show();
    
    console.log('Submitting payment:', paymentData);
    
    try {
      if (paymentId) {
        await PaymentService.updatePayment(paymentId, paymentData);
        Toast.success('Pago actualizado correctamente');
      } else {
        await PaymentService.createPayment(paymentData);
        Toast.success('Pago creado correctamente');
      }
      
      this.close();
      this.options.onSuccess(paymentData);
    } catch (error) {
      console.error('Payment error:', error);
      Toast.error('Error guardando pago: ' + (error.message || error.data?.detail || 'Inténtalo de nuevo'));
    } finally {
      Loading.hide();
    }
  }
  
  static async createAndOpen(prefill = {}, options = {}) {
    // Reuse singleton instance
    if (!modalInstance) {
      modalInstance = new PagoModal(options);
    } else {
      modalInstance.options = { ...modalInstance.options, ...options };
    }
    await modalInstance.open(prefill);
    return modalInstance;
  }
}
/**
 * Payment Modal Component
 * Reusable modal for creating payments from any page
 */

import { PaymentService } from '../../services/payment.service.js';
import { clientService } from '../../services/client.service.js';
import { serviceService } from '../../services/service.service.js';
import { Toast } from './toast.js';
import { Loading } from './loading.js';

export class PaymentModal {
  constructor(options = {}) {
    this.options = {
      onSuccess: () => {},
      onClose: () => {},
      ...options
    };
    
    this.modal = null;
    this.modalOverlay = null;
    this.isOpen = false;
    this.servicesLoaded = false;
    
    // Form elements
    this.form = null;
    this.clientSelect = null;
    this.serviceSelect = null;
    this.appointmentIdInput = null;
    this.paymentDateInput = null;
    this.amountInput = null;
    this.paymentTypeSelect = null;
    this.paymentMethodSelect = null;
    this.notesInput = null;
    
    this.initialize();
  }
  
  initialize() {
    // Add custom styles for payment modal to match app brand
    this.addStyles();
    
    // Create modal HTML
    this.createModalHTML();
    
    // Initialize event listeners
    this.initEventListeners();
    
    // Load services for dropdown
    this.loadServices();
  }
  
  addStyles() {
    if (document.getElementById('payment-modal-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'payment-modal-styles';
    style.textContent = `
      .payment-modal-overlay {
        --brand: #ff365f;
      }
      .payment-modal .modal-header {
        border-bottom: 2px solid var(--brand);
      }
      .payment-modal .modal-title {
        color: var(--brand);
      }
      .payment-modal .btn-primary {
        background: var(--brand);
        border-color: var(--brand);
      }
      .payment-modal .btn-primary:hover {
        background: #e03050;
        border-color: #e03050;
      }
      .payment-modal .form-field label {
        color: #e7edf8;
      }
      .payment-modal select:focus,
      .payment-modal input:focus {
        border-color: var(--brand);
        box-shadow: 0 0 0 3px rgba(255, 54, 99, 0.2);
      }
    `;
    document.head.appendChild(style);
  }
  
  createModalHTML() {
    // Create modal overlay
    this.modalOverlay = document.createElement('div');
    this.modalOverlay.className = 'modal-overlay payment-modal-overlay';
    this.modalOverlay.style.display = 'none';
    
    // Create modal container
    this.modal = document.createElement('div');
    this.modal.className = 'modal payment-modal';
    this.modal.innerHTML = `
      <div class="modal-header">
        <h3 class="modal-title">Crear Pago</h3>
        <button type="button" class="modal-close" data-close-payment-modal>×</button>
      </div>
      <div class="modal-body">
        <form id="payment-modal-form" class="form-grid">
          <div class="form-field form-grid-full">
            <label for="payment-modal-client-id">ID Cliente</label>
            <input type="number" id="payment-modal-client-id" name="client_id" placeholder="ID del cliente" />
            <small>Deja en blanco para pago sin cliente</small>
          </div>
          
          <div class="form-field">
            <label for="payment-modal-service">Servicio</label>
            <select id="payment-modal-service" name="service_id">
              <option value="">Seleccionar servicio</option>
            </select>
          </div>
          
          <div class="form-field">
            <label for="payment-modal-appointment-id">ID Cita</label>
            <input type="number" id="payment-modal-appointment-id" name="appointment_id" placeholder="Opcional" />
          </div>
          
          <div class="form-field">
            <label for="payment-modal-date">Fecha</label>
            <input type="date" id="payment-modal-date" name="payment_date" required />
          </div>
          
          <div class="form-field">
            <label for="payment-modal-amount">Monto (€)</label>
            <input type="number" id="payment-modal-amount" name="amount" step="0.01" min="0" required />
          </div>
          
          <div class="form-field">
            <label for="payment-modal-type">Tipo</label>
            <select id="payment-modal-type" name="payment_type" required>
              <option value="income">Ingreso</option>
              <option value="expense">Gasto</option>
            </select>
          </div>
          
          <div class="form-field">
            <label for="payment-modal-method">Método</label>
            <select id="payment-modal-method" name="payment_method" required>
              <option value="cash">Efectivo</option>
              <option value="card">Tarjeta</option>
              <option value="transfer">Transferencia</option>
              <option value="bizum">Bizum</option>
            </select>
          </div>
          
          <div class="form-field form-grid-full">
            <label for="payment-modal-notes">Notas</label>
            <textarea id="payment-modal-notes" name="notes" rows="3" placeholder="Notas adicionales..."></textarea>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-close-payment-modal>Cancelar</button>
        <button type="submit" form="payment-modal-form" class="btn btn-primary">Guardar Pago</button>
      </div>
    `;
    
    this.modalOverlay.appendChild(this.modal);
    document.body.appendChild(this.modalOverlay);
    
    // Get form elements
    this.form = this.modal.querySelector('#payment-modal-form');
    this.clientSelect = this.modal.querySelector('#payment-modal-client-id');
    this.serviceSelect = this.modal.querySelector('#payment-modal-service');
    this.appointmentIdInput = this.modal.querySelector('#payment-modal-appointment-id');
    this.paymentDateInput = this.modal.querySelector('#payment-modal-date');
    this.amountInput = this.modal.querySelector('#payment-modal-amount');
    this.paymentTypeSelect = this.modal.querySelector('#payment-modal-type');
    this.paymentMethodSelect = this.modal.querySelector('#payment-modal-method');
    this.notesInput = this.modal.querySelector('#payment-modal-notes');
    
    // Set default date to today
    this.paymentDateInput.value = new Date().toISOString().split('T')[0];
  }
  
  initEventListeners() {
    // Close modal buttons
    this.modal.querySelectorAll('[data-close-payment-modal]').forEach(btn => {
      btn.addEventListener('click', () => this.close());
    });
    
    // Close on overlay click
    this.modalOverlay.addEventListener('click', (e) => {
      if (e.target === this.modalOverlay) {
        this.close();
      }
    });
    
    // Form submit
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.submitPayment();
    });
  }
  
  async loadServices(forceReload = false) {
    if (this.servicesLoaded && !forceReload) return;
    
    try {
      const response = await serviceService.searchServices();
      
      if (response && response.items && response.items.length > 0) {
        while (this.serviceSelect.options.length > 1) {
          this.serviceSelect.remove(1);
        }
        
        response.items.sort((a, b) => a.name.localeCompare(b.name)).forEach(service => {
          const option = document.createElement('option');
          option.value = service.id;
          option.textContent = service.name;
          this.serviceSelect.appendChild(option);
        });
        
        this.servicesLoaded = true;
      }
    } catch (error) {
      console.error('Error loading services:', error);
    }
  }
  
  async open(prefill = {}) {
    // Reload services if needed
    await this.loadServices(true);
    
    // Set prefill values
    if (prefill.client_id) {
      this.clientSelect.value = prefill.client_id;
      
      // Try to load client info for display
      try {
        const client = await clientService.getClientById(prefill.client_id);
        if (client) {
          const clientIdContainer = this.clientSelect.parentElement;
          const existingInfo = clientIdContainer.querySelector('.client-info');
          if (existingInfo) existingInfo.remove();
          
          const infoSpan = document.createElement('span');
          infoSpan.className = 'client-info';
          infoSpan.textContent = ` (${client.full_name})`;
          infoSpan.style.fontSize = '0.9em';
          infoSpan.style.color = '#666';
          clientIdContainer.appendChild(infoSpan);
        }
      } catch (error) {
        // Silently fail - client ID is enough
      }
    }
    
    if (prefill.service_id) {
      this.serviceSelect.value = prefill.service_id;
    }
    
    if (prefill.appointment_id) {
      this.appointmentIdInput.value = prefill.appointment_id;
    }
    
    if (prefill.payment_date) {
      this.paymentDateInput.value = prefill.payment_date;
    }
    
    if (prefill.payment_type) {
      this.paymentTypeSelect.value = prefill.payment_type;
    }
    
    if (prefill.payment_method) {
      this.paymentMethodSelect.value = prefill.payment_method;
    }
    
    // Auto-calculate amount if service is selected
    if (prefill.service_id && !prefill.amount) {
      this.serviceSelect.addEventListener('change', this.calculateAmountFromService.bind(this));
      // Trigger calculation if service is already selected
      if (this.serviceSelect.value) {
        await this.calculateAmountFromService();
      }
    }
    
    // Show modal
    this.modalOverlay.style.display = 'flex';
    this.isOpen = true;
    
    // Focus on amount input
    setTimeout(() => {
      if (!this.amountInput.value) {
        this.amountInput.focus();
      }
    }, 100);
  }
  
  async calculateAmountFromService() {
    if (!this.serviceSelect.value) return;
    
    try {
      const response = await ServiceService.searchServices({ id: this.serviceSelect.value });
      if (response.items && response.items.length > 0) {
        const service = response.items[0];
        this.amountInput.value = service.price || '';
      }
    } catch (error) {
      // Silently fail
    }
  }
  
  close() {
    this.modalOverlay.style.display = 'none';
    this.isOpen = false;
    this.options.onClose();
    
    // Reset form
    this.form.reset();
    this.paymentDateInput.value = new Date().toISOString().split('T')[0];
    
    // Remove client info display
    const clientInfo = this.clientSelect.parentElement.querySelector('.client-info');
    if (clientInfo) clientInfo.remove();
  }
  
  async submitPayment() {
    // Validate form
    if (!this.amountInput.value || !this.paymentDateInput.value) {
      Toast.error('Por favor, completa los campos obligatorios');
      return;
    }
    
    const formData = new FormData(this.form);
    const payload = {
      client_id: formData.get('client_id') || null,
      service_id: formData.get('service_id') || null,
      appointment_id: formData.get('appointment_id') || null,
      amount: parseFloat(formData.get('amount')),
      payment_date: formData.get('payment_date'),
      payment_type: formData.get('payment_type'),
      payment_method: formData.get('payment_method'),
      notes: formData.get('notes') || null
    };
    
    Loading.show();
    
    try {
      const payment = await PaymentService.createPayment(payload);
      Toast.success('Pago creado correctamente');
      this.close();
      this.options.onSuccess(payment);
    } catch (error) {
      console.error('Error creating payment:', error);
      Toast.error('Error creando el pago');
    } finally {
      Loading.hide();
    }
  }
  
  // Static method for easy use
  static createAndOpen(prefill = {}, options = {}) {
    // Check if modal already exists
    let existingModal = document.querySelector('.payment-modal-overlay');
    if (existingModal) {
      existingModal.remove();
    }
    
    const modal = new PaymentModal(options);
    modal.open(prefill);
    return modal;
  }
}
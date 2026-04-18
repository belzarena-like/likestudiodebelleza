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
              <option value="CASH">Efectivo</option>
              <option value="CARD">Tarjeta</option>
              <option value="TRANSFER">Transferencia</option>
              <option value="COUPON">Cupón/Groupon</option>
              <option value="OTHER">Otro</option>
            </select>
          </div>
          
          <div class="form-field" id="pago-coupon-code-input" style="display: none;">
            <label for="pago-coupon-code">Código de Cupón</label>
            <input type="text" id="pago-coupon-code" name="coupon_code" maxlength="100" />
          </div>
          
          <div class="form-field">
            <label for="pago-recipient">Destinatario (opcional)</label>
            <select id="pago-recipient" name="recipient">
              <option value="">Seleccionar...</option>
              <option value="liege">Liege</option>
              <option value="josemi">Josemi</option>
              <option value="company">Empresa</option>
            </select>
          </div>
          
          <div class="form-field form-grid-full">
            <label>
              <input type="checkbox" id="pago-split-checkbox" />
              Dividir este pago en múltiples partes
            </label>
          </div>
          
          <div class="form-field form-grid-full">
            <label>
              <input type="checkbox" id="pago-tentative-checkbox" />
              Marcar como tentativo (pago futuro)
            </label>
          </div>
          
          <div id="pago-split-section" class="form-grid-full" style="display: none;">
            <h4>Partes del Pago</h4>
            <div class="split-helper">
              <label for="pago-split-count">Dividir en:</label>
              <input type="number" id="pago-split-count" min="2" max="12" value="3" style="width: 80px;" />
              <span>partes iguales</span>
              <button type="button" id="pago-auto-split" class="btn btn-secondary btn-sm">✨ Auto-dividir</button>
            </div>
            <div id="pago-split-parts-container"></div>
            <button type="button" id="pago-add-split-part" class="btn btn-secondary btn-sm">+ Añadir Parte</button>
            <div class="split-summary">
              <strong>Total: €<span id="pago-split-total">0.00</span></strong>
              <span id="pago-split-validation" class="error-text"></span>
            </div>
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
    
    // Initialize split payment state
    this.isSplitPayment = false;
    this.splitParts = [];
    
    // Setup payment enhancements handlers
    this.setupPaymentEnhancements();
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
  
  setupPaymentEnhancements() {
    const splitCheckbox = document.getElementById('pago-split-checkbox');
    const splitSection = document.getElementById('pago-split-section');
    const addSplitBtn = document.getElementById('pago-add-split-part');
    const autoSplitBtn = document.getElementById('pago-auto-split');
    const paymentMethodSelect = document.getElementById('pago-method');
    const couponCodeInput = document.getElementById('pago-coupon-code-input');
    const amountField = document.getElementById('pago-amount');
    
    if (!splitCheckbox || !splitSection || !addSplitBtn) return;
    
    // Toggle split payment section
    splitCheckbox.addEventListener('change', (e) => {
      this.isSplitPayment = e.target.checked;
      splitSection.style.display = e.target.checked ? 'block' : 'none';
      
      if (e.target.checked) {
        const container = document.getElementById('pago-split-parts-container');
        if (container && container.children.length === 0) {
          this.addSplitPart();
          this.addSplitPart();
        }
      }
    });
    
    // Add split part button
    addSplitBtn.addEventListener('click', () => {
      this.addSplitPart();
    });
    
    // Auto-split button
    if (autoSplitBtn) {
      autoSplitBtn.addEventListener('click', () => {
        this.autoSplitPayment();
      });
    }
    
    // Payment method change handler (show/hide coupon code)
    if (paymentMethodSelect && couponCodeInput && amountField) {
      paymentMethodSelect.addEventListener('change', (e) => {
        const isCoupon = e.target.value === 'COUPON';
        couponCodeInput.style.display = isCoupon ? 'block' : 'none';
        
        if (isCoupon) {
          amountField.value = '0.00';
          amountField.readOnly = true;
        } else {
          amountField.readOnly = false;
        }
      });
    }
  }
  
  autoSplitPayment() {
    const amountField = document.getElementById('pago-amount');
    const dateField = document.getElementById('pago-date');
    const splitCountField = document.getElementById('pago-split-count');
    const methodField = document.getElementById('pago-method');
    const container = document.getElementById('pago-split-parts-container');
    
    if (!amountField || !dateField || !splitCountField || !container) return;
    
    const totalAmount = parseFloat(amountField.value) || 0;
    const splitCount = parseInt(splitCountField.value) || 2;
    const startDate = new Date(dateField.value);
    const paymentMethod = methodField?.value || 'CASH';
    
    if (totalAmount <= 0) {
      Toast.warning('Por favor ingresa un importe válido primero');
      return;
    }
    
    if (isNaN(startDate.getTime())) {
      Toast.warning('Por favor selecciona una fecha válida primero');
      return;
    }
    
    // Clear existing parts
    container.innerHTML = '';
    
    // Calculate amount per part (rounded to 2 decimals)
    const amountPerPart = Math.round((totalAmount / splitCount) * 100) / 100;
    let remainingAmount = totalAmount;
    
    // Create parts
    for (let i = 0; i < splitCount; i++) {
      this.addSplitPart();
      const partRow = container.lastElementChild;
      
      if (partRow) {
        // Calculate date (add i months to start date)
        const partDate = new Date(startDate);
        partDate.setMonth(partDate.getMonth() + i);
        
        // For the last part, use remaining amount to avoid rounding errors
        const partAmount = (i === splitCount - 1) ? remainingAmount : amountPerPart;
        remainingAmount -= partAmount;
        
        // Set values
        partRow.querySelector('.split-amount').value = partAmount.toFixed(2);
        partRow.querySelector('.split-date').value = partDate.toISOString().split('T')[0];
        partRow.querySelector('.split-method').value = paymentMethod;
        partRow.querySelector('.split-description').value = `Parte ${i + 1} de ${splitCount}`;
      }
    }
    
    this.validateSplitTotal();
    Toast.success(`Pago dividido en ${splitCount} partes iguales`);
  }
  
  addSplitPart() {
    const container = document.getElementById('pago-split-parts-container');
    if (!container) return;
    
    const partRow = document.createElement('div');
    partRow.className = 'split-part-row';
    partRow.innerHTML = `
      <input type="number" class="split-amount" placeholder="Amount" step="0.01" min="0.01" required />
      <input type="date" class="split-date" required />
      <select class="split-method" required>
        <option value="CASH">Efectivo</option>
        <option value="CARD">Tarjeta</option>
        <option value="TRANSFER">Transferencia</option>
        <option value="COUPON">Cupón</option>
      </select>
      <input type="text" class="split-description" placeholder="Description (optional)" />
      <button type="button" class="remove-split-part">✕</button>
    `;
    
    // Remove button handler
    partRow.querySelector('.remove-split-part').addEventListener('click', () => {
      if (container.children.length > 2) {
        partRow.remove();
        this.validateSplitTotal();
      } else {
        Toast.warning('Split payment must have at least 2 parts');
      }
    });
    
    // Amount change handler
    partRow.querySelector('.split-amount').addEventListener('input', () => {
      this.validateSplitTotal();
    });
    
    container.appendChild(partRow);
    this.validateSplitTotal();
  }
  
  validateSplitTotal() {
    const container = document.getElementById('pago-split-parts-container');
    if (!container) return true;
    
    const parentAmount = parseFloat(document.getElementById('pago-amount')?.value) || 0;
    const partRows = container.querySelectorAll('.split-part-row');
    
    let total = 0;
    partRows.forEach(row => {
      const amount = parseFloat(row.querySelector('.split-amount').value) || 0;
      total += amount;
    });
    
    const splitTotalSpan = document.getElementById('pago-split-total');
    if (splitTotalSpan) {
      splitTotalSpan.textContent = total.toFixed(2);
    }
    
    const validationSpan = document.getElementById('pago-split-validation');
    if (!validationSpan) return true;
    
    const diff = Math.abs(total - parentAmount);
    
    if (diff > 0.01) {
      validationSpan.textContent = `⚠ Difference: €${diff.toFixed(2)}`;
      validationSpan.style.color = '#ef4444';
      return false;
    } else {
      validationSpan.textContent = '✓ Amounts match';
      validationSpan.style.color = '#10b981';
      return true;
    }
  }
  
  collectSplitParts() {
    const container = document.getElementById('pago-split-parts-container');
    if (!container) return [];
    
    const parts = [];
    const partRows = container.querySelectorAll('.split-part-row');
    
    partRows.forEach(row => {
      parts.push({
        amount: parseFloat(row.querySelector('.split-amount').value),
        payment_date: row.querySelector('.split-date').value,
        payment_method: row.querySelector('.split-method').value,
        description: row.querySelector('.split-description').value || null
      });
    });
    
    return parts;
  }
  
  async loadServices() {
    const select = document.getElementById('pago-service');
    if (!select) return;
    
    // Always check if we need to reload (in case form was reset)
    const needsLoading = select.options.length <= 1;
    
    if (!needsLoading) return;
    
    try {
      const response = await serviceService.searchServices();
      
      if (response && response.items) {
        // Clear existing options except the first one
        while (select.options.length > 1) {
          select.remove(1);
        }
        
        // Filter only active services and sort alphabetically
        // NOTE: The field is 'active', not 'is_active'
        const activeServices = response.items.filter(service => service.active);
        const sorted = [...activeServices].sort((a, b) => a.name.localeCompare(b.name));
        
        console.log('Services loaded:', sorted.length, 'services');
        
        sorted.forEach(service => {
          const option = document.createElement('option');
          option.value = service.id;
          option.textContent = service.name;
          select.appendChild(option);
        });
        
        this.servicesLoaded = true;
      }
    } catch (error) {
      console.error('Error loading services:', error);
    }
  }
  
  async open(prefill = {}) {
    // Show modal first for better UX
    this.modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    
    // Ensure services are loaded FIRST
    await this.loadServices();
    
    // Setup client autocomplete if not already
    this.setupClientAutocomplete();
    
    // Get all form elements before reset
    const paymentIdField = document.getElementById('pago-id');
    const modalTitle = document.getElementById('pago-modal-title');
    const splitCheckbox = document.getElementById('pago-split-checkbox');
    const splitSection = document.getElementById('pago-split-section');
    const splitContainer = document.getElementById('pago-split-parts-container');
    const tentativeCheckbox = document.getElementById('pago-tentative-checkbox');
    const couponCodeInput = document.getElementById('pago-coupon-code-input');
    const amountField = document.getElementById('pago-amount');
    const clientSearchInput = document.getElementById('pago-client-search');
    const clientIdInput = document.getElementById('pago-client-id');
    const recipientSelect = document.getElementById('pago-recipient');
    const serviceSelect = document.getElementById('pago-service');
    
    // Reset form FIRST
    this.form.reset();
    
    // Reset split payment state
    this.isSplitPayment = false;
    this.splitParts = [];
    if (splitCheckbox) splitCheckbox.checked = false;
    if (splitSection) splitSection.style.display = 'none';
    if (splitContainer) splitContainer.innerHTML = '';
    
    // Reset tentative checkbox
    if (tentativeCheckbox) tentativeCheckbox.checked = false;
    
    // Hide coupon code input
    if (couponCodeInput) couponCodeInput.style.display = 'none';
    
    // Enable amount field
    if (amountField) amountField.readOnly = false;
    
    // Only clear client if not provided in prefill
    if (!prefill.client_id) {
      if (clientSearchInput) clientSearchInput.value = '';
      if (clientIdInput) clientIdInput.value = '';
    }
    
    // NOW set all values AFTER reset
    
    // Set payment ID if editing
    if (paymentIdField) {
      paymentIdField.value = prefill.payment_id || '';
    }
    
    // Update modal title
    if (modalTitle) {
      modalTitle.textContent = prefill.payment_id ? 'Editar pago' : 'Nuevo pago';
    }
    
    // Set form values
    if (prefill.amount !== undefined) {
      document.getElementById('pago-amount').value = prefill.amount;
    }
    
    document.getElementById('pago-date').value = prefill.payment_date || new Date().toISOString().split('T')[0];
    document.getElementById('pago-type').value = prefill.payment_type || 'income';
    document.getElementById('pago-method').value = prefill.payment_method || 'CASH';
    document.getElementById('pago-description').value = prefill.description || 'Pago por servicio';
    
    // Set recipient if provided
    if (recipientSelect && prefill.recipient) {
      recipientSelect.value = prefill.recipient;
    }
    
    // Set notes and reference
    if (prefill.notes) {
      document.getElementById('pago-notes').value = prefill.notes;
    }
    if (prefill.reference_number) {
      document.getElementById('pago-reference').value = prefill.reference_number;
    }
    
    // Set service if provided - services are now loaded
    if (prefill.service_id && prefill.service_id !== 'undefined' && prefill.service_id !== 'null') {
      if (serviceSelect) {
        const serviceValue = String(prefill.service_id);
        serviceSelect.value = serviceValue;
        console.log('Setting service to:', serviceValue, 'Available options:', Array.from(serviceSelect.options).map(o => o.value));
      }
    }
    
    // Set client if provided
    if (prefill.client_id) {
      if (clientIdInput) {
        clientIdInput.value = prefill.client_id;
        console.log('Setting client ID to:', prefill.client_id);
      }
      await this.loadClientName(prefill.client_id);
    }
    
    // Handle split payment editing
    if (prefill.is_split && prefill.child_parts && prefill.child_parts.length > 0) {
      if (splitCheckbox) {
        splitCheckbox.checked = true;
        this.isSplitPayment = true;
      }
      if (splitSection) splitSection.style.display = 'block';
      
      // Load split parts
      prefill.child_parts.forEach(part => {
        this.addSplitPart();
        const lastRow = splitContainer.lastElementChild;
        if (lastRow) {
          lastRow.querySelector('.split-amount').value = part.amount;
          lastRow.querySelector('.split-date').value = part.payment_date;
          lastRow.querySelector('.split-method').value = part.payment_method;
          if (part.description) {
            lastRow.querySelector('.split-description').value = part.description;
          }
        }
      });
      this.validateSplitTotal();
    }
    
    // Handle tentative payment
    if (prefill.is_tentative && tentativeCheckbox) {
      tentativeCheckbox.checked = true;
    }
    
    // Handle coupon payment
    if (prefill.payment_method === 'COUPON') {
      if (couponCodeInput) couponCodeInput.style.display = 'block';
      if (prefill.coupon_code) {
        document.getElementById('pago-coupon-code').value = prefill.coupon_code;
      }
      if (amountField) amountField.readOnly = true;
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
    
    console.log('loadClientName called with clientId:', clientId);
    
    try {
      const client = await clientService.getClientById(clientId);
      console.log('Client loaded:', client);
      if (client) {
        if (clientSearchInput) {
          clientSearchInput.value = client.full_name;
          console.log('Set client name to:', client.full_name);
        }
        if (clientIdInput) {
          clientIdInput.value = client.id;
          console.log('Set client ID input to:', client.id);
        }
      } else {
        console.warn('Client not found for ID:', clientId);
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
    const recipientSelect = document.getElementById('pago-recipient');
    const tentativeCheckbox = document.getElementById('pago-tentative-checkbox');
    const couponCodeField = document.getElementById('pago-coupon-code');
    
    // Validate split payment if enabled
    if (this.isSplitPayment && !this.validateSplitTotal()) {
      Toast.error('Split payment amounts must match total');
      return;
    }
    
    const paymentData = {
      amount: parseFloat(form.amount.value),
      payment_date: form.payment_date.value,
      payment_type: form.payment_type.value,
      payment_method: form.payment_method.value,
      recipient: recipientSelect?.value || null,
      description: form.description?.value || 'Pago por servicio',
      service_id: serviceSelect?.value ? parseInt(serviceSelect.value) : null,
      client_id: clientIdInput?.value ? parseInt(clientIdInput.value) : null,
      notes: form.notes?.value || null,
      reference_number: form.reference_number?.value || null,
      
      // NEW: Payment enhancements fields
      is_split: this.isSplitPayment,
      split_parts: this.isSplitPayment ? this.collectSplitParts() : null,
      is_tentative: tentativeCheckbox ? tentativeCheckbox.checked : false,
      coupon_code: form.payment_method.value === 'COUPON' ? (couponCodeField?.value || null) : null
    };
    
    Loading.show();
    
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
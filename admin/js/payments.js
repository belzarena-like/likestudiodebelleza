import { PaymentService } from '../../src/services/payment.service.js';
import { serviceService } from '../../src/services/service.service.js';
import { clientService } from '../../src/services/client.service.js';
import { Toast } from '../../src/ui/components/toast.js';
import { Modal } from '../../src/ui/components/modal.js';
import { Loading } from '../../src/ui/components/loading.js';

class PaymentsController {
  constructor() {
    this.LIMIT = 50;
    this.offset = 0;
    this.lastTotal = 0;
    this.charts = {};
    
    // DOM elements
    this.form = document.getElementById('search-form');
    this.summary = document.getElementById('summary');
    this.tbody = document.getElementById('table-body');
    this.paymentModal = new Modal('payment-modal');
    this.incomeCard = document.getElementById('total-income');
    this.expenseCard = document.getElementById('total-expenses');
    this.netCard = document.getElementById('net-amount');
    
    // Client autocomplete
    this.clientSearchInput = document.getElementById('payment-client');
    this.clientIdInput = document.getElementById('payment-client-id');
    this.clientResultsDiv = document.getElementById('client-results');
    this.selectedClientId = null;
    
    // Set default month filter to current month
    this.setDefaultMonthFilter();
    
    this.initEventListeners();
    this.loadServices();
    this.initCharts();
    
    // Check for prefill data from session screen
    this.checkPaymentPrefill();
  }
  
  setDefaultMonthFilter() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    // Set month selector to current month
    const monthSelect = document.getElementById('month-filter');
    if (monthSelect) {
      monthSelect.value = `${year}-${month}`;
    }
    
    // Calculate first and last day of current month
    const firstDay = new Date(year, now.getMonth(), 1);
    const lastDay = new Date(year, now.getMonth() + 1, 0);
    
    // Set date inputs
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    
    if (startDateInput) {
      startDateInput.value = firstDay.toISOString().split('T')[0];
    }
    if (endDateInput) {
      endDateInput.value = lastDay.toISOString().split('T')[0];
    }
  }
  
  async loadServices() {
    try {
      const response = await serviceService.searchServices();
      const serviceSelect = document.getElementById('service');
      const paymentServiceSelect = document.getElementById('payment-service');
      
      response.items.forEach(service => {
        const option = document.createElement('option');
        option.value = service.id;
        option.textContent = service.name;
        serviceSelect.appendChild(option.cloneNode(true));
        
        // Also add to payment form
        if (paymentServiceSelect) {
          paymentServiceSelect.appendChild(option);
        }
      });
    } catch (error) {
      Toast.error('Error cargando servicios');
    }
  }
  
  async load(filters = {}) {
    Loading.show();
    try {
      const response = await PaymentService.searchPayments({
        ...filters,
        limit: this.LIMIT,
        offset: this.offset
      });
      
      this.renderTable(response.items);
      this.updateSummary(response);
      this.updateCards(response.summary);
      
      this.lastTotal = response.total;
      this.updatePagination();
      
      // Show results section
      document.getElementById('results-section').style.display = 'block';
      
      // Update charts with current filter dates
      this.updateCharts();
    } catch (error) {
      console.error('Error loading payments:', error);
      Toast.error('Error cargando pagos');
    } finally {
      Loading.hide();
    }
  }
  
  renderTable(payments) {
    this.tbody.innerHTML = '';
    
    payments.forEach(payment => {
      const row = document.createElement('tr');
      row.className = payment.payment_type === 'income' ? 'income-row' : 'expense-row';
      
      const recipientLabel = this.getRecipientLabel(payment.recipient);
      
      row.innerHTML = `
        <td>${new Date(payment.payment_date).toLocaleDateString('es-ES')}</td>
        <td>${payment.description}</td>
        <td>${payment.service_name || '-'}</td>
        <td>${payment.client_name || '-'}</td>
        <td>
          <span class="badge ${payment.payment_type === 'income' ? 'badge-success' : 'badge-warning'}">
            ${payment.payment_type === 'income' ? 'Ingreso' : 'Gasto'}
          </span>
        </td>
        <td>
          <span class="badge badge-info">
            ${this.getPaymentMethodLabel(payment.payment_method)}
          </span>
        </td>
        <td>
          ${recipientLabel ? `<span class="badge badge-secondary">${recipientLabel}</span>` : '-'}
        </td>
        <td class="${payment.payment_type === 'income' ? 'text-success' : 'text-danger'}">
          ${payment.payment_type === 'income' ? '+' : '-'}€${payment.amount.toFixed(2)}
        </td>
        <td>
          <button class="btn btn-sm btn-secondary" data-edit="${payment.id}">Editar</button>
          <button class="btn btn-sm btn-danger" data-delete="${payment.id}">Eliminar</button>
        </td>
      `;
      
      this.tbody.appendChild(row);
    });
    
    // Add event listeners for action buttons
    this.tbody.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', (e) => this.editPayment(e.target.dataset.edit));
    });
    
    this.tbody.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', (e) => this.deletePayment(e.target.dataset.delete));
    });
  }
  
  updateSummary(response) {
    const start = this.form.start_date?.value || 'inicio';
    const end = this.form.end_date?.value || 'hoy';
    this.summary.textContent = `Mostrando ${response.items.length} de ${response.total} pagos (${start} - ${end})`;
  }
  
  updateCards(summary) {
    this.incomeCard.textContent = `€${summary.total_income.toFixed(2)}`;
    this.expenseCard.textContent = `€${summary.total_expenses.toFixed(2)}`;
    this.netCard.textContent = `€${summary.net.toFixed(2)}`;
    this.netCard.parentElement.className = `summary-card ${summary.net >= 0 ? 'net-positive' : 'net-negative'}`;
  }
  
  checkPaymentPrefill() {
    try {
      const prefillData = sessionStorage.getItem('payment_prefill');
      if (prefillData) {
        const prefill = JSON.parse(prefillData);
        
        // Clear storage
        sessionStorage.removeItem('payment_prefill');
        
        // Open payment modal with prefill data
        setTimeout(() => {
          this.openPaymentModalWithPrefill(prefill);
        }, 500);
      }
    } catch (error) {
      console.error('Error checking payment prefill:', error);
    }
  }
  
  async openPaymentModalWithPrefill(prefill) {
    // Set form values
    if (prefill.client_id) {
      this.selectedClientId = prefill.client_id;
      this.clientIdInput.value = prefill.client_id;
      
      // Try to load client name
      try {
        const response = await clientService.searchClients({ query: '', limit: 1 });
        const client = response.items.find(c => c.id == prefill.client_id);
        if (client) {
          this.clientSearchInput.value = client.full_name;
        }
      } catch (error) {
        console.error('Error loading client:', error);
      }
    }
    
    if (prefill.service_id) {
      document.getElementById('payment-service').value = prefill.service_id;
    }
    
    if (prefill.payment_date) {
      document.getElementById('payment-date').value = prefill.payment_date;
    }
    
    if (prefill.payment_type) {
      document.getElementById('payment-type-select').value = prefill.payment_type;
    }
    
    if (prefill.payment_method) {
      document.getElementById('payment-method-select').value = prefill.payment_method;
    }
    
    // Set description
    document.getElementById('payment-description').value = 'Pago por servicio';
    
    // Open modal
    this.paymentModal.show();
  }

  initCharts() {
    // Initialize historical trend chart
    const trendChartCtx = document.getElementById('historical-trend-chart');
    const methodChartCtx = document.getElementById('payments-by-method-chart');
    
    if (trendChartCtx) {
      this.charts.trendChart = new Chart(trendChartCtx, {
        type: 'line',
        data: {
          labels: [],
          datasets: [
            {
              label: 'Ingresos',
              data: [],
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              tension: 0.4,
              fill: true
            },
            {
              label: 'Gastos',
              data: [],
              borderColor: '#ef4444',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              tension: 0.4,
              fill: true
            },
            {
              label: 'Balance',
              data: [],
              borderColor: '#6b7280',
              backgroundColor: 'rgba(107, 114, 128, 0.1)',
              tension: 0.4,
              fill: true
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'index',
            intersect: false
          },
          plugins: {
            legend: {
              display: true,
              position: 'top'
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  let label = context.dataset.label || '';
                  if (label) {
                    label += ': ';
                  }
                  label += '€' + context.parsed.y.toFixed(2);
                  return label;
                }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: function(value) {
                  return '€' + value.toFixed(0);
                }
              }
            }
          }
        }
      });
    }
    
    if (methodChartCtx) {
      this.charts.methodChart = new Chart(methodChartCtx, {
        type: 'doughnut',
        data: {
          labels: ['Efectivo', 'Tarjeta', 'Transferencia', 'Otro'],
          datasets: [{
            data: [0, 0, 0, 0],
            backgroundColor: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: 'bottom'
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  let label = context.label || '';
                  if (label) {
                    label += ': ';
                  }
                  label += '€' + context.parsed.toFixed(2);
                  return label;
                }
              }
            }
          }
        }
      });
    }
  }
  
  async updateCharts() {
    // Load chart data and update
    try {
      const startDateInput = document.getElementById('start-date');
      const endDateInput = document.getElementById('end-date');
      
      const startDate = startDateInput?.value || '';
      const endDate = endDateInput?.value || '';
      
      // Use default dates if not specified
      const start = startDate || new Date().toISOString().split('T')[0];
      const end = endDate || new Date().toISOString().split('T')[0];
      
      console.log('Fetching chart data for:', start, 'to', end);
      const chartData = await PaymentService.getChartData(start, end);
      
      console.log('Chart data received:', chartData);
      console.log('Monthly trend:', chartData.monthly_trend);
      console.log('Summary:', chartData.summary);
      
      // Update historical trend chart (line chart)
      if (this.charts.trendChart) {
        let labels = [];
        let income = [];
        let expenses = [];
        
        // Check if we have data
        if (chartData.monthly_trend && chartData.monthly_trend.labels && chartData.monthly_trend.labels.length > 0) {
          labels = chartData.monthly_trend.labels;
          income = chartData.monthly_trend.income || [];
          expenses = chartData.monthly_trend.expenses || [];
          
          console.log('Using monthly data - labels:', labels, 'income:', income, 'expenses:', expenses);
          
          // Check if we need daily granularity (single month or less than 2 months of data)
          const shouldUseDailyData = this.shouldUseDailyGranularity(start, end, labels);
          
          if (shouldUseDailyData && chartData.daily_trend && chartData.daily_trend.labels && chartData.daily_trend.labels.length > 0) {
            // Use daily data instead
            labels = chartData.daily_trend.labels;
            income = chartData.daily_trend.income || [];
            expenses = chartData.daily_trend.expenses || [];
            console.log('Switched to daily data - labels:', labels, 'income:', income, 'expenses:', expenses);
          }
        } else {
          console.warn('No monthly trend data available');
        }
        
        // Calculate balance for each period
        const balance = income.map((inc, idx) => inc - (expenses[idx] || 0));
        
        this.charts.trendChart.data.labels = labels;
        this.charts.trendChart.data.datasets[0].data = income;
        this.charts.trendChart.data.datasets[1].data = expenses;
        this.charts.trendChart.data.datasets[2].data = balance;
        this.charts.trendChart.update();
        
        console.log('Trend chart updated');
      }
      
      // Update method chart (doughnut chart)
      if (this.charts.methodChart && chartData.by_method) {
        const methodData = chartData.by_method;
        
        const methodValues = [
          methodData.cash || 0,
          methodData.card || 0,
          methodData.transfer || 0,
          methodData.other || 0
        ];
        
        console.log('Method data:', methodData, 'values:', methodValues);
        
        // Update chart data
        this.charts.methodChart.data.datasets[0].data = methodValues;
        this.charts.methodChart.update();
        
        console.log('Method chart updated');
      }
      
      // Update summary cards with real data
      if (chartData.summary) {
        const summary = chartData.summary;
        
        console.log('Updating summary cards:', summary);
        
        if (this.incomeCard) {
          this.incomeCard.textContent = `€${summary.total_income.toFixed(2)}`;
        }
        
        if (this.expenseCard) {
          this.expenseCard.textContent = `€${summary.total_expenses.toFixed(2)}`;
        }
        
        if (this.netCard) {
          this.netCard.textContent = `€${summary.net.toFixed(2)}`;
          this.netCard.style.color = summary.net >= 0 ? '#ffffff' : '#ef4444';
        }
      }
      
    } catch (error) {
      console.error('Error updating charts:', error);
    }
  }
  
  shouldUseDailyGranularity(startDate, endDate, monthlyLabels) {
    // Parse dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Calculate difference in days
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Use daily if:
    // 1. Date range is 45 days or less
    // 2. OR we have less than 3 months of data
    return diffDays <= 45 || (monthlyLabels && monthlyLabels.length < 3);
  }
  
  getPaymentMethodLabel(method) {
    const labels = {
      cash: 'Efectivo',
      card: 'Tarjeta',
      transfer: 'Transferencia',
      other: 'Otro'
    };
    return labels[method] || method;
  }
  
  getRecipientLabel(recipient) {
    const labels = {
      liege: 'Liege',
      josemi: 'Josemi',
      company: 'Empresa'
    };
    return labels[recipient] || null;
  }
  
  initEventListeners() {
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.offset = 0;  // Reset to first page when filtering
      this.load(this.getFormFilters());
    });
    
    // Month filter change handler
    const monthSelect = document.getElementById('month-filter');
    if (monthSelect) {
      monthSelect.addEventListener('change', (e) => {
        this.offset = 0;  // Reset to first page
        this.handleMonthFilterChange(e.target.value);
      });
    }
    
    document.getElementById('new-payment').addEventListener('click', () => {
      this.openPaymentModal('income');
    });
    
    document.getElementById('new-expense').addEventListener('click', () => {
      this.openPaymentModal('expense');
    });
    
    // Client search autocomplete
    const clientSearch = document.getElementById('client-filter');
    if (clientSearch) {
      clientSearch.addEventListener('input', (e) => this.handleClientSearchInput(e.target.value));
    }
    
    // Pagination
    document.getElementById('prev').addEventListener('click', () => {
      this.offset = Math.max(0, this.offset - this.LIMIT);
      this.load(this.getFormFilters());
    });
    
    document.getElementById('next').addEventListener('click', () => {
      if (this.offset + this.LIMIT < this.lastTotal) {
        this.offset += this.LIMIT;
        this.load(this.getFormFilters());
      }
    });
    
    document.getElementById('export').addEventListener('click', () => {
      this.exportToCSV();
    });
    
    // Reset button
    const resetBtn = document.getElementById('reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Clear all filter fields
        document.getElementById('month-filter').value = '';
        document.getElementById('start-date').value = '';
        document.getElementById('end-date').value = '';
        document.getElementById('payment-type').value = '';
        document.getElementById('payment-method').value = '';
        document.getElementById('recipient').value = '';
        document.getElementById('service').value = '';
        document.getElementById('client-filter').value = '';
        document.getElementById('client-filter-id').value = '';
        
        // Reset state
        this.selectedClientId = null;
        this.offset = 0;
        
        // Hide results
        document.getElementById('results-section').style.display = 'none';
      });
    }
    
    // Modal events
    document.getElementById('payment-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.savePayment();
    });
    
    document.getElementById('cancel-payment').addEventListener('click', () => {
      this.paymentModal.hide();
    });
    
    document.getElementById('modal-close').addEventListener('click', () => {
      this.paymentModal.hide();
    });
    
    // Client autocomplete using LikeStudioWidgets
    this.setupClientAutocomplete();
  }
  
  getFormFilters() {
    const clientIdInput = document.getElementById('client-filter-id');
    return {
      start_date: this.form.start_date.value || null,
      end_date: this.form.end_date.value || null,
      payment_type: this.form.payment_type.value || null,
      payment_method: this.form.payment_method.value || null,
      recipient: this.form.recipient.value || null,
      service_id: this.form.service_id.value || null,
      client_id: this.selectedClientId || (clientIdInput?.value ? parseInt(clientIdInput.value) : null)
    };
  }

  async handleClientSearchInput(query) {
    const resultsDiv = document.getElementById('client-results');
    if (!resultsDiv) return;
    
    if (!query || query.length < 2) {
      resultsDiv.style.display = 'none';
      return;
    }

    try {
      const response = await clientService.searchClients({
        query: query,
        limit: 10
      });

      this.renderClientSearchResults(response.items || [], resultsDiv);
    } catch (error) {
      console.error('Error searching clients:', error);
      resultsDiv.style.display = 'none';
    }
  }

  renderClientSearchResults(clients, resultsDiv) {
    if (!clients || clients.length === 0) {
      resultsDiv.innerHTML = '<div class="ls-autocomplete-item">No se encontraron clientes</div>';
      resultsDiv.style.display = 'block';
      return;
    }

    resultsDiv.innerHTML = '';
    clients.forEach(client => {
      const item = document.createElement('div');
      item.className = 'ls-autocomplete-item';
      item.innerHTML = `<strong>${client.full_name}</strong> <small>${client.id_number}</small>`;
      item.onclick = () => {
        document.getElementById('client-filter').value = client.full_name;
        document.getElementById('client-filter-id').value = client.id;
        resultsDiv.style.display = 'none';
      };
      resultsDiv.appendChild(item);
    });
    resultsDiv.style.display = 'block';
  }

  selectClient(clientId, clientName) {
    this.selectedClientId = clientId;
    this.clientSearchInput.value = clientName;
    this.clientIdInput.value = clientId;
    this.clientResultsDiv.style.display = 'none';
    
    // Trigger search with new client filter
    this.offset = 0;
    this.load(this.getFormFilters());
  }
  
  openPaymentModal(type, paymentId = null) {
    const form = document.getElementById('payment-form');
    const modalTitle = document.getElementById('modal-title');
    
    // Reset form
    form.reset();
    document.getElementById('payment-id').value = '';
    
    // Set defaults
    document.getElementById('payment-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('payment-type-select').value = type;
    document.getElementById('payment-method-select').value = 'cash';
    
    if (paymentId) {
      modalTitle.textContent = 'Editar pago';
      this.loadPaymentForEdit(paymentId);
    } else {
      modalTitle.textContent = type === 'income' ? 'Nuevo ingreso' : 'Nuevo gasto';
    }
    
    this.paymentModal.show();
  }
  
  async loadPaymentForEdit(paymentId) {
    console.log('Loading payment for edit, ID:', paymentId);
    try {
      const payments = await PaymentService.searchPayments({ limit: 200 });
      console.log('Payments loaded:', payments);
      const payment = payments.items.find(p => p.id == paymentId);
      console.log('Found payment:', payment);
      
      if (payment) {
        document.getElementById('payment-id').value = payment.id;
        document.getElementById('payment-amount').value = payment.amount;
        document.getElementById('payment-date').value = payment.payment_date;
        document.getElementById('payment-type-select').value = payment.payment_type;
        document.getElementById('payment-method-select').value = payment.payment_method;
        document.getElementById('payment-recipient').value = payment.recipient || '';
        document.getElementById('payment-description').value = payment.description || '';
        
        // Set service
        const serviceSelect = document.getElementById('payment-service');
        if (payment.service_id && serviceSelect) {
          serviceSelect.value = payment.service_id;
          console.log('Service set to:', payment.service_id);
        }
        
        // Set client name if available
        if (payment.client_id) {
          const clientIdInput = document.getElementById('payment-client-id');
          const clientSearchInput = document.getElementById('payment-client');
          if (clientIdInput) clientIdInput.value = payment.client_id;
          if (clientSearchInput && payment.client_name) {
            clientSearchInput.value = payment.client_name;
          }
          console.log('Client set to:', payment.client_name, payment.client_id);
        }
        
        document.getElementById('payment-notes').value = payment.notes || '';
        document.getElementById('payment-reference').value = payment.reference_number || '';
        
        console.log('Payment loaded successfully');
      } else {
        console.warn('Payment not found with ID:', paymentId);
        Toast.error('Pago no encontrado');
      }
    } catch (error) {
      console.error('Error loading payment for edit:', error);
      Toast.error('Error cargando pago: ' + error.message);
    }
  }
  
  async savePayment() {
    const form = document.getElementById('payment-form');
    const paymentId = document.getElementById('payment-id').value;
    const clientIdInput = document.getElementById('payment-client-id');
    const serviceSelect = document.getElementById('payment-service');
    const recipientSelect = document.getElementById('payment-recipient');
    
    const paymentData = {
      amount: parseFloat(form.amount.value),
      payment_date: form.payment_date.value,
      payment_type: form.payment_type.value,
      payment_method: form.payment_method.value,
      recipient: recipientSelect?.value || null,
      description: form.description.value || "",
      service_id: serviceSelect?.value || null,
      client_id: clientIdInput?.value || null,
      notes: form.notes.value || null,
      reference_number: form.reference_number.value || null
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
      
      this.paymentModal.hide();
      this.load(this.getFormFilters());
      this.updateCharts();
    } catch (error) {
      Toast.error('Error guardando pago');
    } finally {
      Loading.hide();
    }
  }
  
  async editPayment(paymentId) {
    this.openPaymentModal(null, paymentId);
  }
  
  async deletePayment(paymentId) {
    if (confirm('¿Estás seguro de eliminar este pago?')) {
      try {
        await PaymentService.deletePayment(paymentId);
        Toast.success('Pago eliminado correctamente');
        this.load(this.getFormFilters());
        this.updateCharts();
      } catch (error) {
        Toast.error('Error eliminando pago');
      }
    }
  }
  
  async exportToCSV() {
    try {
      const filters = this.getFormFilters();
      const blob = await PaymentService.exportPayments(filters);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pagos_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      Toast.success('Exportación completada');
    } catch (error) {
      Toast.error('Error exportando pagos');
    }
  }
  
  updatePagination() {
    const prevBtn = document.getElementById('prev');
    const nextBtn = document.getElementById('next');
    
    prevBtn.disabled = this.offset === 0;
    nextBtn.disabled = this.offset + this.LIMIT >= this.lastTotal;
  }
  
  handleMonthFilterChange(monthValue) {
    // Month filter is now just for convenience - it doesn't override date range
    // Users can still use start-date and end-date for custom ranges
    if (!monthValue) {
      // Clear date filters
      document.getElementById('start-date').value = '';
      document.getElementById('end-date').value = '';
    } else {
      // Parse year-month value
      const [year, month] = monthValue.split('-').map(Number);
      
      // Calculate first and last day of selected month
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0);
      
      // Set date inputs
      document.getElementById('start-date').value = firstDay.toISOString().split('T')[0];
      document.getElementById('end-date').value = lastDay.toISOString().split('T')[0];
    }
    
    // Trigger search with new dates
    this.offset = 0;
    this.load(this.getFormFilters());
  }

  setupClientAutocomplete() {
    // Setup input event
    this.clientSearchInput.addEventListener('input', () => {
      this.handleClientSearch();
    });

    // Setup focus event
    this.clientSearchInput.addEventListener('focus', () => {
      if (this.clientSearchInput.value.trim() !== '') {
        this.handleClientSearch();
      }
    });

    // Setup blur event
    this.clientSearchInput.addEventListener('blur', () => {
      setTimeout(() => {
        this.clientResultsDiv.style.display = 'none';
      }, 200);
    });

    // Handle clicks on client results
    this.clientResultsDiv.addEventListener('click', (e) => {
      e.preventDefault();
      const option = e.target.closest('.ls-autocomplete-item');
      if (option) {
        this.selectClient(option.dataset.clientId, option.dataset.clientName);
      }
    });
  }

  async handleClientSearch() {
    const query = this.clientSearchInput.value.trim();
    
    if (!query || query.length < 2) {
      this.clientResultsDiv.style.display = 'none';
      this.selectedClientId = null;
      this.clientIdInput.value = '';
      return;
    }

    try {
      // Search clients from backend
      const response = await clientService.searchClients({ query: query, limit: 10 });
      this.renderClientResults(response.items);
    } catch (error) {
      console.error('Error searching clients:', error);
      this.clientResultsDiv.style.display = 'none';
    }
  }

  renderClientResults(clients) {
    if (!clients || clients.length === 0) {
      this.clientResultsDiv.innerHTML = '<div class="ls-autocomplete-item"><div>No se encontraron clientes</div></div>';
      this.clientResultsDiv.style.display = 'block';
      return;
    }

    // Build HTML using LikeStudioWidgets style
    let html = '';
    clients.slice(0, 8).forEach(client => {
      html += `
        <div class="ls-autocomplete-item" 
             data-client-id="${client.id}" 
             data-client-name="${client.full_name || ''}">
          <div>${client.full_name || 'Sin nombre'}</div>
          ${client.phone ? `<div class="ls-autocomplete-detail">${client.phone}</div>` : ''}
          ${client.id_number ? `<div class="ls-autocomplete-detail">${client.id_number}</div>` : ''}
        </div>`;
    });

    this.clientResultsDiv.innerHTML = html;
    this.clientResultsDiv.style.display = 'block';
    
    // Add active class to first item
    const firstItem = this.clientResultsDiv.querySelector('.ls-autocomplete-item');
    if (firstItem) {
      firstItem.classList.add('is-active');
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PaymentsController();
});
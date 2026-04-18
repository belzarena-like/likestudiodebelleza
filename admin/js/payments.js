import { PaymentService } from '../../src/services/payment.service.js';
import { serviceService } from '../../src/services/service.service.js';
import { clientService } from '../../src/services/client.service.js';
import { Toast } from '../../src/ui/components/toast.js';
import { PagoModal } from '../../src/ui/components/pago-modal.js';
import { Loading } from '../../src/ui/components/loading.js';

class PaymentsController {
  constructor() {
    this.LIMIT = 50;
    this.offset = 0;
    this.lastTotal = 0;
    this.charts = {};
    this._prevSummary = null; // for trend indicators
    
    // DOM elements
    this.form = document.getElementById('search-form');
    this.summary = document.getElementById('summary');
    this.tbody = document.getElementById('table-body');
    this.incomeCard = document.getElementById('total-income');
    this.expenseCard = document.getElementById('total-expenses');
    this.netCard = document.getElementById('net-amount');
    
    // Set default month filter to current month
    this.setDefaultMonthFilter();
    
    this.initEventListeners();
    this.initStickyFilter();
    this.initModalKeyboardShortcuts();
    this.initModalContextualFields();
    this.initModalInlineValidation();
    this.initChartsToggle();
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
      
      // Filter only active services and sort alphabetically
      const activeServices = response.items.filter(service => service.is_active);
      const sorted = [...activeServices].sort((a, b) => a.name.localeCompare(b.name));
      
      sorted.forEach(service => {
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
    
    const emptyState = document.getElementById('empty-state');
    const tableWrap = this.tbody.closest('.admin-table-wrap');

    if (!payments || payments.length === 0) {
      if (emptyState) emptyState.style.display = 'flex';
      if (tableWrap) tableWrap.querySelector('.admin-table').style.display = 'none';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (tableWrap) tableWrap.querySelector('.admin-table').style.display = '';

    console.log('Rendering payments:', payments.length);
    
    payments.forEach(payment => {
      const row = this.createPaymentRow(payment);
      this.tbody.appendChild(row);
      
      // If split payment, add child rows
      if (payment.is_split && payment.child_parts && payment.child_parts.length > 0) {
        console.log(`Payment ${payment.id} has ${payment.child_parts.length} child parts:`, payment.child_parts);
        payment.child_parts.forEach(part => {
          const childRow = this.createChildPaymentRow(part);
          childRow.style.display = 'none'; // Hidden by default
          childRow.dataset.parentId = payment.id;
          this.tbody.appendChild(childRow);
        });
      } else if (payment.is_split) {
        console.log(`Payment ${payment.id} is split but has no child_parts:`, payment);
      }
    });
    
    // Add event listeners for action buttons
    this.tbody.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', (e) => this.editPayment(e.target.dataset.edit));
    });
    
    this.tbody.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', (e) => this.deletePayment(e.target.dataset.delete));
    });
    
    this.tbody.querySelectorAll('[data-confirm]').forEach(btn => {
      btn.addEventListener('click', (e) => this.confirmTentativePayment(e.target.dataset.confirm));
    });
    
    this.tbody.querySelectorAll('[data-confirm-child]').forEach(btn => {
      btn.addEventListener('click', (e) => this.confirmChildPayment(e.target.dataset.confirmChild));
    });
    
    this.tbody.querySelectorAll('.expand-split').forEach(btn => {
      btn.addEventListener('click', (e) => this.toggleSplitPaymentExpansion(e.target.dataset.paymentId));
    });
  }
  
  createPaymentRow(payment) {
    const row = document.createElement('tr');
    row.className = payment.payment_type === 'income' ? 'income-row' : 'expense-row';
    if (payment.is_tentative) row.classList.add('tentative-row');
    
    const recipientLabel = this.getRecipientLabel(payment.recipient);
    
    const statusBadges = [];
    if (payment.is_tentative) statusBadges.push('<span class="badge badge-warning">Tentativo</span>');
    if (payment.is_split) statusBadges.push('<span class="badge badge-info">Dividido</span>');
    if (payment.payment_method === 'COUPON') statusBadges.push('<span class="badge badge-purple">Cupón</span>');
    if (!payment.is_tentative && !payment.is_split && payment.payment_method !== 'COUPON') {
      statusBadges.push('<span class="badge badge-success">Efectivo</span>');
    }
    
    const expandIcon = payment.is_split ? `<button class="expand-split" data-payment-id="${payment.id}">▶</button>` : '';
    
    const actions = payment.is_tentative 
      ? `<button class="btn btn-sm btn-success" data-confirm="${payment.id}">Confirmar</button>
         <button class="btn btn-sm btn-secondary" data-edit="${payment.id}">Editar</button>
         <button class="btn btn-sm btn-danger" data-delete="${payment.id}">Eliminar</button>`
      : `<button class="btn btn-sm btn-secondary" data-edit="${payment.id}">Editar</button>
         <button class="btn btn-sm btn-danger" data-delete="${payment.id}">Eliminar</button>`;
    
    row.innerHTML = `
      <td data-label="Fecha">${expandIcon}${new Date(payment.payment_date).toLocaleDateString('es-ES')}</td>
      <td data-label="Descripción">${payment.description}${payment.coupon_code ? ` (${payment.coupon_code})` : ''}</td>
      <td data-label="Servicio">${payment.service_name || '-'}</td>
      <td data-label="Cliente">${payment.client_name || '-'}</td>
      <td data-label="Tipo">
        <span class="badge ${payment.payment_type === 'income' ? 'badge-success' : 'badge-warning'}">
          ${payment.payment_type === 'income' ? 'Ingreso' : 'Gasto'}
        </span>
      </td>
      <td data-label="Método">
        <span class="badge badge-info">
          ${this.getPaymentMethodLabel(payment.payment_method)}
        </span>
      </td>
      <td data-label="Destinatario">
        ${recipientLabel ? `<span class="badge badge-secondary">${recipientLabel}</span>` : '-'}
      </td>
      <td data-label="Estado">${statusBadges.join(' ')}</td>
      <td data-label="Importe" class="${payment.payment_type === 'income' ? 'text-success' : 'text-danger'}">
        ${payment.payment_type === 'income' ? '+' : '-'}€${payment.amount.toFixed(2)}
      </td>
      <td data-label="Acciones">${actions}</td>
    `;
    
    return row;
  }
  
  createChildPaymentRow(part) {
    const row = document.createElement('tr');
    row.className = 'child-payment-row';
    row.dataset.childPaymentId = part.id;
    
    console.log(`Creating child payment row for ID ${part.id}:`, {
      is_tentative: part.is_tentative,
      amount: part.amount,
      payment_date: part.payment_date,
      description: part.description
    });
    
    // Add confirmed class if payment is confirmed (not tentative)
    if (!part.is_tentative) {
      row.classList.add('confirmed');
    }
    
    // Status badge for child payment
    const statusBadge = part.is_tentative 
      ? '<span class="badge badge-warning">⏳ Pendiente</span>'
      : '<span class="badge badge-success">✓ Recibido</span>';
    
    // Action button for tentative child payments
    const actionButton = part.is_tentative
      ? `<button class="btn btn-sm btn-success" data-confirm-child="${part.id}">Confirmar</button>`
      : '<span style="color: #10b981;">✓</span>';
    
    row.innerHTML = `
      <td style="padding-left: 2rem;">├─ ${new Date(part.payment_date).toLocaleDateString('es-ES')}</td>
      <td>${part.description || '-'}</td>
      <td>-</td>
      <td>-</td>
      <td>-</td>
      <td>
        <span class="badge badge-info">
          ${this.getPaymentMethodLabel(part.payment_method)}
        </span>
      </td>
      <td>-</td>
      <td>${statusBadge}</td>
      <td>€${part.amount.toFixed(2)}</td>
      <td>${actionButton}</td>
    `;
    
    return row;
  }
  
  toggleSplitPaymentExpansion(paymentId) {
    const childRows = this.tbody.querySelectorAll(`[data-parent-id="${paymentId}"]`);
    const expandBtn = this.tbody.querySelector(`.expand-split[data-payment-id="${paymentId}"]`);
    
    childRows.forEach(row => {
      // Check if we're on mobile (screen width <= 640px)
      const isMobile = window.innerWidth <= 640;
      const displayValue = isMobile ? 'grid' : 'table-row';
      
      if (row.style.display === 'none' || !row.style.display) {
        row.style.display = displayValue;
      } else {
        row.style.display = 'none';
      }
    });
    
    if (expandBtn) {
      expandBtn.textContent = expandBtn.textContent === '▶' ? '▼' : '▶';
    }
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

    // Trend indicators vs previous load
    this._renderTrend('income-trend', summary.total_income, this._prevSummary?.total_income);
    this._renderTrend('expense-trend', summary.total_expenses, this._prevSummary?.total_expenses);
    this._prevSummary = summary;
    
    // Tentative cards (within selected period)
    const tentativeIncomeCard = document.getElementById('tentative-income');
    const tentativeExpensesCard = document.getElementById('tentative-expenses');
    const tentativeNetCard = document.getElementById('tentative-net');
    
    if (tentativeIncomeCard && summary.tentative_income !== undefined) {
      tentativeIncomeCard.textContent = `€${summary.tentative_income.toFixed(2)}`;
    }
    if (tentativeExpensesCard && summary.tentative_expenses !== undefined) {
      tentativeExpensesCard.textContent = `€${summary.tentative_expenses.toFixed(2)}`;
    }
    if (tentativeNetCard && summary.tentative_net !== undefined) {
      tentativeNetCard.textContent = `€${summary.tentative_net.toFixed(2)}`;
    }
    
    // Future obligations cards (after selected period)
    const futureIncomeCard = document.getElementById('future-income');
    const futureExpensesCard = document.getElementById('future-expenses');
    const futureNetCard = document.getElementById('future-net');
    
    if (futureIncomeCard && summary.future_income !== undefined) {
      futureIncomeCard.textContent = `€${summary.future_income.toFixed(2)}`;
    }
    if (futureExpensesCard && summary.future_expenses !== undefined) {
      futureExpensesCard.textContent = `€${summary.future_expenses.toFixed(2)}`;
    }
    if (futureNetCard && summary.future_net !== undefined) {
      futureNetCard.textContent = `€${summary.future_net.toFixed(2)}`;
    }
  }

  _renderTrend(elId, current, previous) {
    const el = document.getElementById(elId);
    if (!el || previous === undefined || previous === null) return;
    if (current > previous) {
      el.textContent = '↑';
      el.className = 'trend-indicator trend-up';
    } else if (current < previous) {
      el.textContent = '↓';
      el.className = 'trend-indicator trend-down';
    } else {
      el.textContent = '';
    }
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
      
      // Try to load client name by ID
      try {
        const client = await clientService.getClientById(prefill.client_id);
        if (client) {
          this.clientSearchInput.value = client.full_name;
        }
      } catch (error) {
        console.error('Error loading client:', error);
        // Fallback: try searching all clients
        try {
          const searchResponse = await clientService.searchClients({ query: '', limit: 100 });
          const client = searchResponse.items.find(c => c.id == prefill.client_id);
          if (client) {
            this.clientSearchInput.value = client.full_name;
          }
        } catch (fallbackError) {
          console.error('Fallback error loading client:', fallbackError);
        }
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
          methodData.CASH || methodData.cash || 0,
          methodData.CARD || methodData.card || 0,
          methodData.TRANSFER || methodData.transfer || 0,
          methodData.OTHER || methodData.other || 0
        ];
        
        console.log('Method data:', methodData, 'values:', methodValues);
        
        // Update chart data
        this.charts.methodChart.data.datasets[0].data = methodValues;
        this.charts.methodChart.update();
        
        console.log('Method chart updated');
      }
      
      // Don't update summary cards here - they're already updated correctly by updateCards()
      // The chart-data endpoint may have stale data before server restart
      
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
      CASH: 'Efectivo',
      CARD: 'Tarjeta',
      TRANSFER: 'Transferencia',
      COUPON: 'Cupón',
      OTHER: 'Otro',
      // Backwards compatibility with lowercase
      cash: 'Efectivo',
      card: 'Tarjeta',
      transfer: 'Transferencia',
      coupon: 'Cupón',
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
  
  // ── Sticky filter bar ──────────────────────────────────────────────────────
  initStickyFilter() {
    const panel = document.getElementById('filter-panel');
    if (!panel) return;
    const sentinel = document.createElement('div');
    sentinel.style.height = '1px';
    panel.parentElement.insertBefore(sentinel, panel);
    const obs = new IntersectionObserver(([entry]) => {
      panel.classList.toggle('filter-panel--stuck', !entry.isIntersecting);
    }, { threshold: 0 });
    obs.observe(sentinel);
  }

  // ── Advanced filter toggle ─────────────────────────────────────────────────
  initAdvancedFilterToggle() {
    const btn = document.getElementById('toggle-advanced-filters');
    const panel = document.getElementById('advanced-filters');
    if (!btn || !panel) return;
    btn.addEventListener('click', () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      btn.querySelector('.filter-toggle-icon').textContent = expanded ? '▼' : '▲';
      panel.hidden = expanded;
    });
  }

  // ── Charts toggle ──────────────────────────────────────────────────────────
  initChartsToggle() {
    const btn = document.getElementById('toggle-charts');
    const section = document.getElementById('charts-section');
    if (!btn || !section) return;
    btn.addEventListener('click', () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      btn.querySelector('.charts-toggle-icon').textContent = expanded ? '▶' : '▼';
      btn.querySelector('span:last-child').textContent = expanded ? 'Mostrar gráficos' : 'Ocultar gráficos';
      section.hidden = expanded;
    });
  }

  // ── Modal keyboard shortcuts ───────────────────────────────────────────────
  initModalKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      const modal = document.getElementById('payment-modal');
      if (!modal || modal.getAttribute('aria-hidden') === 'true') return;
      if (e.key === 'Escape') {
        modal.setAttribute('aria-hidden', 'true');
      }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        document.getElementById('payment-form')?.requestSubmit();
      }
    });
  }

  // ── Contextual show/hide in modal ─────────────────────────────────────────
  initModalContextualFields() {
    const methodSelect = document.getElementById('payment-method-select');
    const typeSelect = document.getElementById('payment-type-select');
    const couponField = document.getElementById('coupon-code-input');
    const referenceField = document.getElementById('reference-number-input');
    const recipientField = document.getElementById('recipient-field');

    const updateContextual = () => {
      const method = methodSelect?.value;
      const type = typeSelect?.value;
      if (couponField) couponField.style.display = method === 'COUPON' ? '' : 'none';
      if (referenceField) referenceField.style.display = method === 'TRANSFER' ? '' : 'none';
      if (recipientField) recipientField.style.display = type === 'expense' ? '' : 'none';
    };

    methodSelect?.addEventListener('change', updateContextual);
    typeSelect?.addEventListener('change', updateContextual);
    updateContextual();
  }

  // ── Inline validation on amount & date ────────────────────────────────────
  initModalInlineValidation() {
    const amountInput = document.getElementById('payment-amount');
    const dateInput = document.getElementById('payment-date');

    amountInput?.addEventListener('input', () => {
      const err = document.getElementById('amount-error');
      if (!err) return;
      const val = parseFloat(amountInput.value);
      err.textContent = (!amountInput.value || val <= 0) ? 'Introduce un importe válido mayor que 0' : '';
    });

    dateInput?.addEventListener('input', () => {
      const err = document.getElementById('date-error');
      if (!err) return;
      err.textContent = !dateInput.value ? 'La fecha es obligatoria' : '';
    });
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

    // Advanced filter toggle
    this.initAdvancedFilterToggle();

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

    // Empty state clear button
    document.getElementById('clear-filters-empty')?.addEventListener('click', () => {
      this._clearFilters();
    });
    
    // Reset button
    const resetBtn = document.getElementById('reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this._clearFilters();
      });
    }
  }

  _clearFilters() {
    document.getElementById('month-filter').value = '';
    document.getElementById('start-date').value = '';
    document.getElementById('end-date').value = '';
    document.getElementById('payment-type').value = '';
    document.getElementById('payment-method').value = '';
    document.getElementById('recipient').value = '';
    document.getElementById('service').value = '';
    document.getElementById('client-filter').value = '';
    document.getElementById('client-filter-id').value = '';
    this.offset = 0;
    document.getElementById('results-section').style.display = 'none';
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
  
  async openPaymentModal(type, paymentId = null) {
    const prefill = {
      payment_type: type,
      payment_method: 'CASH'
    };
    
    await PagoModal.createAndOpen(prefill, {
      onSuccess: () => {
        this.load(this.getFormFilters());
        this.updateCharts();
      }
    });
  }
  
  async editPayment(paymentId) {
    Loading.show();
    try {
      // Load payment data
      const payments = await PaymentService.searchPayments({ limit: 1000 });
      const payment = payments.items.find(p => p.id == paymentId);
      
      if (!payment) {
        Toast.error('Pago no encontrado');
        return;
      }
      
      // Prepare prefill data
      const prefill = {
        payment_id: payment.id,
        amount: payment.amount,
        payment_date: payment.payment_date,
        payment_type: payment.payment_type,
        payment_method: payment.payment_method,
        recipient: payment.recipient,
        description: payment.description,
        service_id: payment.service_id,
        client_id: payment.client_id,
        notes: payment.notes,
        reference_number: payment.reference_number,
        is_split: payment.is_split,
        is_tentative: payment.is_tentative,
        coupon_code: payment.coupon_code,
        child_parts: payment.child_parts
      };
      
      Loading.hide();
      
      // Open modal with prefill data
      await PagoModal.createAndOpen(prefill, {
        onSuccess: () => {
          this.load(this.getFormFilters());
          this.updateCharts();
        }
      });
    } catch (error) {
      Loading.hide();
      console.error('Error loading payment for edit:', error);
      Toast.error('Error cargando pago: ' + (error.message || 'Error desconocido'));
    }
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
    const infoEl = document.getElementById('pagination-info');
    
    prevBtn.disabled = this.offset === 0;
    nextBtn.disabled = this.offset + this.LIMIT >= this.lastTotal;

    if (infoEl) {
      const currentPage = Math.floor(this.offset / this.LIMIT) + 1;
      const totalPages = Math.max(1, Math.ceil(this.lastTotal / this.LIMIT));
      infoEl.textContent = `Página ${currentPage} de ${totalPages} (${this.lastTotal} resultados)`;
    }
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

  async confirmTentativePayment(paymentId) {
    if (!confirm('¿Confirmar este pago tentativo?')) return;
    
    Loading.show();
    try {
      await PaymentService.confirmTentativePayment(paymentId);
      Toast.success('Pago confirmado correctamente');
      this.load(this.getFormFilters());
      this.updateCharts();
    } catch (error) {
      console.error('Error confirming payment:', error);
      Toast.error('Error confirmando pago: ' + (error.message || 'Error desconocido'));
    } finally {
      Loading.hide();
    }
  }
  
  async confirmChildPayment(childPaymentId) {
    if (!confirm('¿Confirmar que has recibido esta parte del pago?')) return;
    
    Loading.show();
    try {
      await PaymentService.confirmTentativePayment(childPaymentId);
      Toast.success('Parte del pago confirmada correctamente');
      
      // Update the child row visually without full reload
      const childRow = this.tbody.querySelector(`[data-child-payment-id="${childPaymentId}"]`);
      if (childRow) {
        childRow.classList.add('confirmed');
        
        // Update status badge
        const statusCell = childRow.cells[7]; // Status column
        if (statusCell) {
          statusCell.innerHTML = '<span class="badge badge-success">✓ Recibido</span>';
        }
        
        // Remove confirm button
        const actionCell = childRow.cells[9]; // Action column
        if (actionCell) {
          actionCell.innerHTML = '-';
        }
      }
      
      // Also reload to update summary cards
      this.load(this.getFormFilters());
      this.updateCharts();
    } catch (error) {
      console.error('Error confirming child payment:', error);
      Toast.error('Error confirmando parte del pago: ' + (error.message || 'Error desconocido'));
    } finally {
      Loading.hide();
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PaymentsController();
});
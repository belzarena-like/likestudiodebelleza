/**
 * Booking Controller - Public booking form logic
 */

class BookingController {
  constructor() {
    this.API_BASE = window.APP_CONFIG.API_BASE_URL;
    this.servicesById = {};
    this.currentDuration = 60;
    this.availabilityRequestId = 0;
    this.pendingSuggestedSlot = null;
    this.SUGGESTION_LOOKAHEAD_DAYS = 10;
    this.SUGGESTION_MAX_SLOTS = 6;
    this.ADVANCE_BOOKING_HOURS = 4; // Minimum hours in advance required
    this.currentMonth = new Date();
    this.selectedDate = null;

    this.initElements();
    this.initEventListeners();
    this.initialize();
  }

  initElements() {
    this.servicesSelect = document.getElementById('service');
    this.professionalSelect = document.getElementById('professional');
    this.dateInput = document.getElementById('date');
    this.calendarContainer = document.getElementById('calendar');
    this.slotsContainer = document.getElementById('slots');
    this.startTimeInput = document.getElementById('start-time');
    this.serviceDuration = document.getElementById('service-duration');
    this.slotMessage = document.getElementById('slot-message');
    this.suggestionsContainer = document.getElementById('suggestions');
    this.suggestionMessage = document.getElementById('suggestion-message');
    this.summary = document.getElementById('summary');
    this.message = document.getElementById('message');
    this.fullNameInput = document.getElementById('full-name');
    this.phoneInput = document.getElementById('phone');
    this.emailInput = document.getElementById('email');
    this.instagramInput = document.getElementById('instagram');
    this.notesInput = document.getElementById('notes');
    this.form = document.getElementById('booking-form');
    this.capilarAlert = document.getElementById('capilar-alert');
  }

  initEventListeners() {
    this.servicesSelect.addEventListener('change', () => {
      this.checkCapilarService();
      this.renderCalendar();
      this.loadAvailability();
    });
    this.professionalSelect.addEventListener('change', () => {
      this.renderCalendar();
      this.loadAvailability();
    });
    this.dateInput.addEventListener('change', () => this.loadAvailability());

    this.slotsContainer.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-time]');
      if (!button) return;
      this.selectSlot(button.dataset.time);
    });

    this.suggestionsContainer.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-time][data-date]');
      if (!button) return;
      const dateValue = button.dataset.date;
      const timeValue = button.dataset.time;
      this.pendingSuggestedSlot = { date: dateValue, time: timeValue };
      this.dateInput.value = dateValue;
      this.selectedDate = dateValue;
      this.renderCalendar();
      this.loadAvailability();
    });

    // Calendar navigation
    this.calendarContainer.addEventListener('click', (event) => {
      const prevBtn = event.target.closest('[data-calendar-prev]');
      const nextBtn = event.target.closest('[data-calendar-next]');
      const dayBtn = event.target.closest('[data-calendar-day]');

      if (prevBtn) {
        this.currentMonth.setMonth(this.currentMonth.getMonth() - 1);
        this.renderCalendar();
      } else if (nextBtn) {
        this.currentMonth.setMonth(this.currentMonth.getMonth() + 1);
        this.renderCalendar();
      } else if (dayBtn && !dayBtn.classList.contains('is-disabled') && !dayBtn.classList.contains('is-past')) {
        const dateValue = dayBtn.dataset.calendarDay;
        this.selectedDate = dateValue;
        this.dateInput.value = dateValue;
        this.renderCalendar();
        this.loadAvailability();
      }
    });

    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
  }

  initialize() {
    this.loadServices();
    const today = this.getLocalDateString();
    this.dateInput.value = today;
    this.dateInput.min = today;
    this.selectedDate = today;
    this.dateInput.style.display = 'none'; // Hide the date input, use calendar instead
    this.renderCalendar();
  }

  // ── Utility Methods ────────────────────────────────────────────────────────

  isCapilarService(serviceName) {
    if (!serviceName) return false;
    const name = serviceName.toLowerCase();
    return name.includes('capilar') || name.includes('efecto rapado') || name.includes('densificacion');
  }

  checkCapilarService() {
    const serviceId = this.servicesSelect.value;
    const service = this.servicesById[serviceId];
    
    if (service && this.isCapilarService(service.name)) {
      this.capilarAlert.style.display = 'block';
      // Disable the rest of the form
      this.dateInput.disabled = true;
      this.professionalSelect.disabled = true;
      this.clearSlots('Este servicio solo se puede reservar por WhatsApp.');
    } else {
      this.capilarAlert.style.display = 'none';
      this.dateInput.disabled = false;
      this.professionalSelect.disabled = false;
    }
  }

  getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  isPastTimeSlot(dateText, timeText) {
    if (!dateText || !timeText) return false;
    const today = new Date();
    const selectedDate = new Date(`${dateText}T00:00:00`);
    selectedDate.setHours(0, 0, 0, 0);
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    // Check if date is in the past
    if (selectedDate < todayDate) return true;
    if (selectedDate > todayDate) return false;
    
    // For today, check if time slot is at least ADVANCE_BOOKING_HOURS in the future
    const [hour, minute] = timeText.split(':').map((value) => parseInt(value, 10));
    if (Number.isNaN(hour) || Number.isNaN(minute)) return false;
    
    const slotTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hour, minute, 0, 0);
    const minBookingTime = new Date(today.getTime() + (this.ADVANCE_BOOKING_HOURS * 60 * 60 * 1000));
    
    return slotTime <= minBookingTime;
  }

  formatDuration(minutes) {
    if (minutes >= 60) {
      const hours = (minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1);
      return `${hours} h`;
    }
    return `${minutes} min`;
  }

  formatShortDate(dateText) {
    const date = new Date(`${dateText}T00:00:00`);
    if (Number.isNaN(date.getTime())) return dateText;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
  }

  // ── UI Methods ─────────────────────────────────────────────────────────────

  renderCalendar() {
    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();
    
    // Get first and last day of month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay(); // 0 = Sunday
    
    // Month name
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const monthName = `${monthNames[month]} ${year}`;
    
    // Today's date for comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = this.getLocalDateString(today);
    
    // Check if we can go to previous month
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    const canGoPrev = new Date(year, month, 1) > currentDate;
    
    // Build calendar HTML
    let html = `
      <div class="calendar-header">
        <div class="calendar-month">${monthName}</div>
        <div class="calendar-nav">
          <button type="button" data-calendar-prev ${!canGoPrev ? 'disabled' : ''}>←</button>
          <button type="button" data-calendar-next>→</button>
        </div>
      </div>
      <div class="calendar-grid">
        <div class="calendar-day-header">Dom</div>
        <div class="calendar-day-header">Lun</div>
        <div class="calendar-day-header">Mar</div>
        <div class="calendar-day-header">Mié</div>
        <div class="calendar-day-header">Jue</div>
        <div class="calendar-day-header">Vie</div>
        <div class="calendar-day-header">Sáb</div>
    `;
    
    // Add empty cells for days before month starts
    for (let i = 0; i < startDayOfWeek; i++) {
      html += '<div class="calendar-day is-empty"></div>';
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      date.setHours(0, 0, 0, 0);
      const dateStr = this.getLocalDateString(date);
      
      const isPast = date < today;
      const isToday = dateStr === todayStr;
      const isSelected = dateStr === this.selectedDate;
      
      const classes = ['calendar-day'];
      if (isPast) classes.push('is-past');
      if (isToday) classes.push('is-today');
      if (isSelected) classes.push('is-selected');
      
      html += `<div class="${classes.join(' ')}" data-calendar-day="${dateStr}">${day}</div>`;
    }
    
    html += '</div>';
    this.calendarContainer.innerHTML = html;
  }

  setSummary() {
    const serviceText = this.servicesSelect.options[this.servicesSelect.selectedIndex]?.text || '-';
    const professional = this.professionalSelect.value || '-';
    const date = this.dateInput.value || '-';
    const start = this.startTimeInput.value || '-';
    if (!this.startTimeInput.value) {
      this.summary.textContent = 'Selecciona un horario para ver el resumen.';
      return;
    }
    this.summary.textContent = `${serviceText} con ${professional} el ${date} a las ${start} (duracion ${this.formatDuration(this.currentDuration)}).`;
  }

  clearSuggestions() {
    this.suggestionMessage.textContent = '';
    this.suggestionsContainer.innerHTML = '';
  }

  clearSlots(messageText, options = {}) {
    const keepDuration = options.keepDuration === true;
    this.slotsContainer.innerHTML = '';
    this.startTimeInput.value = '';
    this.slotMessage.textContent = messageText || '';
    if (!keepDuration) {
      this.serviceDuration.textContent = '';
    }
    this.clearSuggestions();
    this.setSummary();
  }

  selectSlot(timeValue) {
    if (!timeValue) return;
    const target = this.slotsContainer.querySelector(`button[data-time="${timeValue}"]`);
    if (!target) return;
    this.slotsContainer.querySelectorAll('button').forEach((btn) => btn.classList.remove('is-active'));
    target.classList.add('is-active');
    this.startTimeInput.value = timeValue;
    this.setSummary();
  }

  renderSlots(validSlots) {
    this.slotsContainer.innerHTML = validSlots.map((time) => `
      <button type="button" data-time="${time}">${time}</button>
    `).join('');
    this.slotMessage.textContent = 'Selecciona un horario disponible.';
    if (this.pendingSuggestedSlot && this.pendingSuggestedSlot.date === this.dateInput.value) {
      const timeValue = this.pendingSuggestedSlot.time;
      this.pendingSuggestedSlot = null;
      this.selectSlot(timeValue);
    }
  }

  // ── API Methods ────────────────────────────────────────────────────────────

  async loadServices() {
    try {
      const response = await fetch(`${this.API_BASE}/public/services?limit=200&offset=0`);
      if (!response.ok) throw new Error('No se pudieron cargar los servicios.');
      const payload = await response.json();
      this.servicesById = {};
      
      // Filter services: exclude Josemi's services and capilar services
      const filteredServices = payload.items.filter(service => {
        // Only show services for Liege or without specific professional
        const professionalName = service.professional_name || '';
        if (professionalName && professionalName.toLowerCase() !== 'liege') {
          return false;
        }
        // Exclude capilar services from the dropdown (only bookable via WhatsApp)
        const serviceName = service.name.toLowerCase();
        if (serviceName.includes('capilar')) {
          return false;
        }
        return true;
      });
      
      this.servicesSelect.innerHTML = '<option value="">Seleccionar...</option>' + filteredServices.map((service) => {
        this.servicesById[String(service.id)] = service;
        return `<option value="${service.id}">${service.name}</option>`;
      }).join('');
    } catch (error) {
      this.message.textContent = error.message;
    }
  }

  async fetchAvailabilitySlots(date, serviceId, professional) {
    const response = await fetch(`${this.API_BASE}/public/availability?date=${date}&service_id=${serviceId}&professional_name=${encodeURIComponent(professional)}`);
    if (!response.ok) throw new Error('No se pudieron cargar los horarios.');
    const payload = await response.json();
    
    // Filter slots based on service duration
    // Services >= 60 minutes: only hour slots (x:00)
    // Services < 60 minutes: all 15-minute slots
    let availableSlots = payload.start_times;
    if (this.currentDuration >= 60) {
      availableSlots = availableSlots.filter((time) => time.endsWith(':00'));
    }
    
    return availableSlots.filter((time) => !this.isPastTimeSlot(date, time));
  }

  async findNextAvailableSlots(serviceId, professional, dateText) {
    const baseDate = new Date(`${dateText}T00:00:00`);
    if (Number.isNaN(baseDate.getTime())) return null;
    for (let i = 1; i <= this.SUGGESTION_LOOKAHEAD_DAYS; i += 1) {
      const next = new Date(baseDate);
      next.setDate(next.getDate() + i);
      const nextText = this.getLocalDateString(next);
      const slots = await this.fetchAvailabilitySlots(nextText, serviceId, professional);
      if (slots.length) {
        return { date: nextText, slots };
      }
    }
    return null;
  }

  async loadSuggestions(serviceId, professional, dateText, requestId) {
    this.suggestionMessage.textContent = 'Buscando proximos horarios disponibles...';
    this.suggestionsContainer.innerHTML = '';
    try {
      const suggestion = await this.findNextAvailableSlots(serviceId, professional, dateText);
      if (requestId !== this.availabilityRequestId) return;
      if (!suggestion) {
        this.suggestionMessage.textContent = 'No hay horarios disponibles en los proximos dias.';
        return;
      }
      this.suggestionMessage.textContent = `Proxima disponibilidad: ${this.formatShortDate(suggestion.date)}.`;
      this.suggestionsContainer.innerHTML = suggestion.slots.slice(0, this.SUGGESTION_MAX_SLOTS).map((time) => {
        return `<button type="button" data-date="${suggestion.date}" data-time="${time}">${this.formatShortDate(suggestion.date)} ${time}</button>`;
      }).join('');
    } catch (error) {
      if (requestId !== this.availabilityRequestId) return;
      this.suggestionMessage.textContent = error.message;
    }
  }

  async loadAvailability() {
    const serviceId = this.servicesSelect.value;
    const professional = this.professionalSelect.value;
    const date = this.dateInput.value;
    
    if (!serviceId || !professional || !date) {
      if (!serviceId) {
        this.serviceDuration.textContent = '';
      }
      this.clearSlots('Selecciona servicio, profesional y fecha para ver horarios.');
      return;
    }

    // Check if it's a capilar service
    const service = this.servicesById[serviceId];
    if (service && this.isCapilarService(service.name)) {
      this.clearSlots('Este servicio solo se puede reservar por WhatsApp.');
      return;
    }
    
    const today = this.getLocalDateString();
    if (date < today) {
      this.clearSlots('Selecciona una fecha igual o posterior a hoy.');
      return;
    }

    this.currentDuration = service ? service.duration_minutes : 60;
    this.serviceDuration.textContent = `Duracion estimada: ${this.formatDuration(this.currentDuration)}`;

    this.slotMessage.textContent = 'Buscando horarios...';
    this.slotsContainer.innerHTML = '';
    this.clearSuggestions();
    const requestId = ++this.availabilityRequestId;

    try {
      const validSlots = await this.fetchAvailabilitySlots(date, serviceId, professional);
      if (requestId !== this.availabilityRequestId) return;
      if (!validSlots.length) {
        this.clearSlots('No hay horarios disponibles para ese dia.', { keepDuration: true });
        await this.loadSuggestions(serviceId, professional, date, requestId);
        return;
      }
      this.renderSlots(validSlots);
    } catch (error) {
      this.clearSlots(error.message);
    }
  }

  async handleSubmit(event) {
    event.preventDefault();
    this.message.textContent = '';

    const serviceId = this.servicesSelect.value;
    const professional = this.professionalSelect.value;
    const date = this.dateInput.value;
    const startTime = this.startTimeInput.value;

    if (!serviceId || !professional || !date || !startTime) {
      this.message.textContent = 'Completa servicio, profesional, fecha y horario.';
      return;
    }
    if (!this.fullNameInput.value.trim() || !this.phoneInput.value.trim() || !this.emailInput.value.trim()) {
      this.message.textContent = 'Nombre, teléfono y email son obligatorios.';
      return;
    }

    const payload = {
      full_name: this.fullNameInput.value.trim(),
      phone: this.phoneInput.value.trim(),
      email: this.emailInput.value.trim(),
      instagram: this.instagramInput.value.trim() || null,
      professional_name: professional,
      service_id: parseInt(serviceId, 10),
      appointment_date: date,
      start_time: startTime,
      notes: this.notesInput.value.trim() || null
    };

    try {
      const response = await fetch(`${this.API_BASE}/public/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.status === 409) {
        const data = await response.json();
        this.message.textContent = data.detail || 'Ese horario ya no esta disponible.';
        return;
      }
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'No se pudo crear la reserva.');
      }
      
      this.message.textContent = 'Reserva confirmada. Te contactaremos pronto.';
      this.form.reset();
      this.clearSlots('Selecciona servicio, profesional y fecha para ver horarios.');
    } catch (error) {
      this.message.textContent = error.message;
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new BookingController());
} else {
  new BookingController();
}

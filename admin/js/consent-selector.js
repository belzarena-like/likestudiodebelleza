/**
 * Consent Selector Controller - Refactored to use clean architecture
 */

import { appointmentService } from '../../src/services/appointment.service.js';
import { storage } from '../../src/core/storage.js';
import { Toast } from '../../src/ui/components/toast.js';
import { formatDate } from '../../src/core/utils.js';

class ConsentSelectorController {
  constructor() {
    this.STORAGE_KEY = 'likestudio_client_prefill_v1';

    // DOM elements
    this.dayListDate = document.getElementById('consent-daylist-date');
    this.dayListProfessional = document.getElementById('consent-daylist-professional');
    this.dayListRefresh = document.getElementById('consent-daylist-refresh');
    this.dayListItems = document.getElementById('consent-daylist-items');
    this.dayListMessage = document.getElementById('consent-daylist-message');
    this.selectedClient = document.getElementById('selected-client');
    this.clearClient = document.getElementById('clear-client');
    this.consentType = document.getElementById('consent-type');
    this.professionalInput = document.getElementById('professional');
    this.openConsent = document.getElementById('open-consent');
    this.consentMessage = document.getElementById('consent-message');

    this.initEventListeners();
    this.applyUrlPrefill();
    this.loadDayList();
  }

  initEventListeners() {
    // Day list refresh
    this.dayListRefresh.addEventListener('click', () => this.loadDayList());
    this.dayListDate.addEventListener('change', () => this.loadDayList());
    this.dayListProfessional.addEventListener('change', () => this.loadDayList());

    // Client selection from day list
    this.dayListItems.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-payload]');
      if (btn) {
        try {
          const payload = JSON.parse(btn.getAttribute('data-payload').replace(/&#39;/g, "'"));
          this.applyPrefill(payload);
        } catch (error) {
          Toast.error('Error al seleccionar cliente');
        }
      }
    });

    // Clear client
    this.clearClient.addEventListener('click', () => {
      this.clearPrefill();
      this.renderSelected({});
    });

    // Open consent
    this.openConsent.addEventListener('click', () => {
      this.consentMessage.textContent = '';
      const stored = this.readStored();
      
      if (!stored.full_name && !stored.phone && !stored.id_number) {
        this.consentMessage.textContent = 'Selecciona un cliente antes de abrir el consentimiento';
        Toast.error('Selecciona un cliente antes de abrir el consentimiento');
        return;
      }
      
      window.open(this.resolveConsentPath(this.consentType.value), '_blank', 'noopener');
    });
  }

  localDateString(date) {
    const base = date || new Date();
    return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;
  }

  readStored() {
    return storage.get(this.STORAGE_KEY, {});
  }

  storePrefill(data) {
    storage.set(this.STORAGE_KEY, data);
  }

  clearPrefill() {
    storage.remove(this.STORAGE_KEY);
  }

  renderSelected(data) {
    if (!data || !data.full_name) {
      this.selectedClient.textContent = 'No hay cliente seleccionado';
      return;
    }
    
    const parts = [
      data.full_name,
      data.phone ? `Tel. ${data.phone}` : null,
      data.id_number ? `DNI ${data.id_number}` : null,
    ].filter(Boolean);
    
    this.selectedClient.textContent = parts.join(' · ');
  }

  guessConsentType(serviceName) {
    const value = String(serviceName || '').toLowerCase();
    if (value.includes('capilar')) return 'capilar';
    if (value.includes('eliminacion') || value.includes('tatuaje')) return 'laser-eliminacion';
    if (value.includes('laser') || value.includes('depil')) return 'laser';
    if (value.includes('estet')) return 'estetico';
    return 'micropigmentacion';
  }

  resolveConsentPath(type) {
    if (type === 'capilar') return 'consent-capilar-condiciones.html';
    if (type === 'estetico') return 'consent-estetico.html';
    if (type === 'laser') return 'consent-laser.html';
    if (type === 'laser-eliminacion') return 'consent-eliminacion-laser.html';
    return 'consent-micropigmentacion.html';
  }

  applyPrefill(data) {
    if (!data) return;
    
    this.storePrefill(data);
    this.renderSelected(data);
    
    if (data.service_name) {
      this.consentType.value = this.guessConsentType(data.service_name);
    }
    
    if (data.professional_name && !this.professionalInput.value) {
      this.professionalInput.value = data.professional_name;
    }
  }

  async loadDayList() {
    const dateValue = this.dayListDate.value || this.localDateString();
    const professional = this.dayListProfessional.value;
    
    this.dayListMessage.textContent = 'Cargando citas...';
    this.dayListItems.innerHTML = '';

    try {
      const data = await appointmentService.searchAppointments({
        start_date: dateValue,
        end_date: dateValue,
        appointment_type: 'appointment',
        limit: 200,
        offset: 0,
      });

      let items = data.items || [];
      
      if (professional) {
        items = items.filter(item => 
          String(item.professional_name || '').toLowerCase() === professional.toLowerCase()
        );
      }

      if (!items.length) {
        this.dayListMessage.textContent = 'No hay citas para este día';
        return;
      }

      this.dayListMessage.textContent = '';
      this.renderDayList(items);
    } catch (error) {
      this.dayListMessage.textContent = 'Error al cargar citas';
      Toast.error('No se pudieron cargar las citas');
    }
  }

  renderDayList(items) {
    this.dayListItems.innerHTML = items.map(item => {
      const time = String(item.start_time || '').slice(0, 5);
      const name = String(item.client_name || 'Cliente').trim();
      const service = String(item.service_name || '').trim();
      
      const payload = {
        full_name: name,
        id_number: '',
        phone: item.client_phone || '',
        email: '',
        service_name: item.service_name || '',
        professional_name: item.professional_name || '',
      };
      
      return `<button class="btn btn-secondary btn-sm" type="button" data-payload='${JSON.stringify(payload).replace(/'/g, "&#39;")}'>
        ${time} · ${name}${service ? ' · ' + service : ''}
      </button>`;
    }).join('');
  }

  applyUrlPrefill() {
    const urlParams = new URLSearchParams(window.location.search);
    const prefill = {
      full_name: urlParams.get('client_name') || '',
      id_number: urlParams.get('client_id_number') || '',
      phone: urlParams.get('client_phone') || '',
      email: '',
      service_name: urlParams.get('service_name') || '',
      professional_name: urlParams.get('professional_name') || '',
    };

    if (prefill.full_name || prefill.phone || prefill.id_number) {
      this.applyPrefill(prefill);
    } else {
      this.renderSelected(this.readStored());
    }

    // Set today's date
    this.dayListDate.value = this.localDateString();
  }
}

// Initialize controller
new ConsentSelectorController();

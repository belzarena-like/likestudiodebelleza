/**
 * Consents Controller - Refactored to use clean architecture
 */

import { consentService } from '../../src/services/consent.service.js';
import { Toast } from '../../src/ui/components/toast.js';

class ConsentsController {
  constructor() {
    this.LIMIT = 20;
    this.offset = 0;
    this.lastTotal = 0;

    this.KIND_MAP = {
      micropigmentation: 'Micropigmentacion',
      micropigmentation_capilar: 'Micropigmentacion capilar',
      aesthetic_treatment: 'Tratamiento estetico',
      laser: 'Depilacion laser',
    };

    // DOM elements
    this.form = document.getElementById('search-form');
    this.summary = document.getElementById('summary');
    this.tbody = document.getElementById('table-body');

    this.initEventListeners();
    this.applyUrlParams();
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

    // Autocomplete (if available)
    const nameInput = document.getElementById('full_name');
    if (window.LikeStudioWidgets && nameInput) {
      window.LikeStudioWidgets.attachClientAutocomplete(nameInput, { minChars: 2 });
      nameInput.addEventListener('ls:select', () => {
        this.offset = 0;
        this.load();
      });
    }
  }

  applyUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    ['full_name', 'id_number', 'consent_type', 'signed_from', 'signed_to'].forEach(key => {
      const value = urlParams.get(key);
      if (value && this.form.elements[key]) {
        this.form.elements[key].value = value;
      }
    });
  }

  resolveEditPath(item) {
    if (item.consent_type === 'micropigmentation') return 'consent-micropigmentacion.html';
    if (item.consent_type === 'micropigmentation_capilar') return 'consent-capilar-condiciones.html';
    if (item.consent_type === 'aesthetic_treatment') return 'consent-estetico.html';
    if (item.consent_type === 'laser') {
      const area = String(item.treatment_areas || '').toLowerCase();
      return area.startsWith('eliminacion tatuaje') 
        ? 'consent-eliminacion-laser.html' 
        : 'consent-laser.html';
    }
    return null;
  }

  async load() {
    try {
      this.summary.textContent = 'Cargando...';
      
      const formData = new FormData(this.form);
      const filters = {
        limit: this.LIMIT,
        offset: this.offset,
      };

      ['full_name', 'id_number', 'therapist_name', 'consent_type', 'signed_from', 'signed_to'].forEach(key => {
        const value = formData.get(key);
        if (value) {
          filters[key] = value;
        }
      });

      const data = await consentService.searchConsents(filters);
      
      this.lastTotal = data.total;
      this.renderRows(data.items);
      this.updateSummary(data);
      this.updatePagination(data);
    } catch (error) {
      this.summary.textContent = 'Error al cargar consentimientos';
      this.tbody.innerHTML = '';
      Toast.error('No se pudieron obtener los consentimientos');
    }
  }

  renderRows(items) {
    if (!items.length) {
      this.tbody.innerHTML = `<tr><td class="admin-table-empty" colspan="7">Sin resultados.</td></tr>`;
      return;
    }

    this.tbody.innerHTML = items.map(item => {
      const kind = this.KIND_MAP[item.consent_type] || item.consent_type;
      const editPath = this.resolveEditPath(item);
      const editLink = editPath
        ? `<a class="btn btn-secondary btn-sm" href="${editPath}?consent_id=${item.id}&mode=edit" target="_blank" rel="noopener">Editar</a>`
        : `<span class="btn btn-secondary btn-sm" style="opacity:.4">Editar</span>`;
      
      return `<tr>
        <td data-label="Fecha">${item.signed_at}</td>
        <td data-label="Cliente">${item.client_name}</td>
        <td data-label="DNI/NIE">${item.client_id_number}</td>
        <td data-label="Tipo">${kind}</td>
        <td data-label="Tratamiento">${item.treatment_areas}</td>
        <td data-label="Profesional">${item.therapist_name}</td>
        <td data-label="Acciones"><div class="row-actions">
          <a class="btn btn-secondary btn-sm" href="consent-view.html?id=${item.id}" target="_blank" rel="noopener">Ver</a>
          ${editLink}
        </div></td>
      </tr>`;
    }).join('');
  }

  updateSummary(data) {
    const from = data.total === 0 ? 0 : data.offset + 1;
    const to = Math.min(data.offset + data.limit, data.total);
    this.summary.textContent = `Mostrando ${from}–${to} de ${data.total} consentimientos.`;
  }

  updatePagination(data) {
    document.getElementById('prev').disabled = data.offset <= 0;
    document.getElementById('next').disabled = data.offset + data.limit >= data.total;
  }
}

// Initialize controller
new ConsentsController();

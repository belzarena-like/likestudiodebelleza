/**
 * Client Profiles Controller - Refactored to use clean architecture
 */

import { clientService } from '../../src/services/client.service.js';
import { Toast } from '../../src/ui/components/toast.js';
import { BonusCreator } from '../../src/ui/components/bonus-creator.js';

class ClientProfilesController {
  constructor() {
    this.LIMIT = 24;
    this.offset = 0;
    this.lastTotal = 0;
    this.bonusCreator = null;
 
    // DOM elements
    this.form = document.getElementById('search-form');
    this.summary = document.getElementById('summary');
    this.grid = document.getElementById('profile-grid');
 
    this.initEventListeners();
    this.initBonusCreator();
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

    // Save button in cards
    this.grid.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-save]');
      if (btn) {
        this.saveProfile(btn.closest('.profile-card'));
      }
    });

    // Create bonus button
    this.grid.addEventListener('click', (e) => {
      const bonusBtn = e.target.closest('[data-create-bonus]');
      if (bonusBtn) {
        const clientId = parseInt(bonusBtn.dataset.createBonus);
        this.bonusCreator.show(clientId);
      }
    });
  }

  async load() {
    try {
      this.summary.textContent = 'Cargando...';
      
      const formData = new FormData(this.form);
      const query = formData.get('query') || null;

      const data = await clientService.searchClientProfiles(query, this.LIMIT, this.offset);
      
      this.lastTotal = data.total;
      this.renderCards(data.items);
      this.updateSummary(data);
      this.updatePagination(data);
    } catch (error) {
      this.summary.textContent = 'Error al cargar perfiles';
      this.grid.innerHTML = '';
      Toast.error('No se pudieron obtener los perfiles');
    }
  }

  renderCards(items) {
    if (!items.length) {
      this.grid.innerHTML = '<p class="admin-summary">Sin resultados.</p>';
      return;
    }

    this.grid.innerHTML = items.map(item => `
      <article class="profile-card"
        data-client-id="${item.client_id}"
        data-id-number="${item.id_number}"
        data-email="${item.email || ''}">
        <div class="profile-card-header">
          <h3 class="profile-card-name" data-display-name>${item.full_name}</h3>
          <span class="profile-card-id">#${item.client_id}</span>
        </div>
        <div class="profile-fields">
          <div class="form-field">
            <label>Nombre</label>
            <input data-field="full_name" value="${item.full_name || ''}" />
          </div>
          <div class="form-field">
            <label>Teléfono</label>
            <input data-field="phone" value="${item.phone || ''}" />
          </div>
          <div class="form-field">
            <label>Instagram</label>
            <input data-field="instagram" value="${item.instagram || ''}" placeholder="@usuario" />
          </div>
          <div class="form-field">
            <label>Tipo de sesión</label>
            <input data-field="shoot_type" value="${item.shoot_type || ''}" />
          </div>
          <div class="form-field">
            <label>Fecha</label>
            <input data-field="shoot_date" type="date" value="${item.shoot_date || ''}" />
          </div>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary btn-sm" data-save>Guardar</button>
          <button class="btn btn-secondary btn-sm" data-create-bonus="${item.client_id}">Crear Bono</button>
        </div>
        <p class="profile-message" data-message></p>
      </article>`).join('');
  }

  updateSummary(data) {
    const from = data.total === 0 ? 0 : data.offset + 1;
    const to = Math.min(data.offset + data.limit, data.total);
    this.summary.textContent = `Mostrando ${from}–${to} de ${data.total} perfiles.`;
  }

  updatePagination(data) {
    document.getElementById('prev').disabled = data.offset <= 0;
    document.getElementById('next').disabled = data.offset + data.limit >= data.total;
  }

async saveProfile(card) {
  const clientId = card.dataset.clientId;
  const idNumber = card.dataset.idNumber;
  const email = card.dataset.email || null;
  const msg = card.querySelector('[data-message]');
  
  const fullName = card.querySelector('[data-field="full_name"]').value.trim();
  const phone = card.querySelector('[data-field="phone"]').value.trim();
  const instagram = card.querySelector('[data-field="instagram"]').value.trim();
  const shootType = card.querySelector('[data-field="shoot_type"]').value.trim();
  const shootDate = card.querySelector('[data-field="shoot_date"]').value;

  if (!fullName) {
    msg.textContent = 'El nombre es obligatorio';
    Toast.error('El nombre es obligatorio');
    return;
  }

  msg.textContent = 'Guardando...';

  try {
    // Update client
    await clientService.updateClient(clientId, {
      full_name: fullName,
      id_number: idNumber,
      phone: phone || null,
      email,
    });

    // Update profile
    await clientService.upsertClientProfile(clientId, {
      instagram: instagram || null,
      shoot_type: shootType || null,
      shoot_date: shootDate || null,
    });

    card.querySelector('[data-display-name]').textContent = fullName;
    msg.textContent = '✓ Guardado';
    Toast.success('Perfil actualizado');
  } catch (error) {
    msg.textContent = error.message || 'Error al guardar';
    Toast.error('No se pudo guardar el perfil');
  }
}

async initBonusCreator() {
  this.bonusCreator = new BonusCreator({
    onSuccess: () => {
      // Reload client data after creating a bonus
      this.load();
    }
  });
  await this.bonusCreator.init();
}
}

// Initialize controller
new ClientProfilesController();

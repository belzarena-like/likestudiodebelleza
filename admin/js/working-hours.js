/**
 * Working Hours Controller - Refactored to use clean architecture
 */

import { workingHoursService } from '../../src/services/working-hours.service.js';
import { Toast } from '../../src/ui/components/toast.js';
import { Loading } from '../../src/ui/components/loading.js';

class WorkingHoursController {
  constructor() {
    this.DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

    // DOM elements
    this.tbody = document.getElementById('table-body');
    this.message = document.getElementById('message');
    this.statusEl = document.getElementById('status');
    this.saveBtn = document.getElementById('save-btn');
    this.reloadBtn = document.getElementById('reload-btn');

    this.initEventListeners();
    this.load();
  }

  initEventListeners() {
    // Save button
    this.saveBtn.addEventListener('click', () => this.save());

    // Reload button
    this.reloadBtn.addEventListener('click', () => this.load());

    // Open/close toggle
    this.tbody.addEventListener('change', (e) => {
      if (!e.target.matches('[data-open-select]')) return;
      
      const row = e.target.closest('tr');
      const isOpen = e.target.value === 'true';
      const start = row.querySelector('[data-start]');
      const end = row.querySelector('[data-end]');
      
      start.disabled = !isOpen;
      end.disabled = !isOpen;
      
      if (!isOpen) {
        start.value = '';
        end.value = '';
      }
    });
  }

  setStatus(text, type) {
    this.statusEl.textContent = text || '';
    this.statusEl.className = 'status-pill' + (type ? ` ${type}` : '');
  }

  toTimeInput(value) {
    return value ? String(value).slice(0, 5) : '';
  }

  renderRows(items) {
    const map = {};
    (items || []).forEach(item => {
      map[item.weekday] = item;
    });

    this.tbody.innerHTML = '';
    
    this.DAY_NAMES.forEach((label, weekday) => {
      const entry = map[weekday] || {
        weekday,
        is_open: false,
        start_time: null,
        end_time: null,
      };
      
      const isOpen = Boolean(entry.is_open);
      const row = document.createElement('tr');
      row.dataset.weekday = weekday;
      
      row.innerHTML = `
        <td>${label}</td>
        <td><select data-open-select>
          <option value="true">Abierto</option>
          <option value="false">Cerrado</option>
        </select></td>
        <td><input data-start type="time" step="900" value="${this.toTimeInput(entry.start_time)}" ${!isOpen ? 'disabled' : ''} /></td>
        <td><input data-end type="time" step="900" value="${this.toTimeInput(entry.end_time)}" ${!isOpen ? 'disabled' : ''} /></td>
      `;
      
      row.querySelector('[data-open-select]').value = isOpen ? 'true' : 'false';
      this.tbody.appendChild(row);
    });
  }

  async load() {
    try {
      this.message.textContent = 'Cargando...';
      this.setStatus('');

      const data = await workingHoursService.getWorkingHours();
      this.renderRows(data.items || []);
      this.message.textContent = '';
    } catch (error) {
      this.message.textContent = 'No se pudo cargar el horario';
      this.setStatus('Error', 'error');
      Toast.error('Error al cargar el horario');
    }
  }

  parseMinutes(value) {
    if (!value) return null;
    const [h, m] = value.split(':');
    return parseInt(h) * 60 + parseInt(m);
  }

  collectItems() {
    return Array.from(this.tbody.querySelectorAll('tr')).map(row => {
      const weekday = parseInt(row.dataset.weekday);
      const isOpen = row.querySelector('[data-open-select]').value === 'true';
      const start = row.querySelector('[data-start]').value;
      const end = row.querySelector('[data-end]').value;

      if (isOpen) {
        const startMinutes = this.parseMinutes(start);
        const endMinutes = this.parseMinutes(end);
        
        if (startMinutes === null || endMinutes === null) {
          throw new Error('Completa las horas para los días abiertos');
        }
        if (startMinutes >= endMinutes) {
          throw new Error('La hora de inicio debe ser menor que la hora fin');
        }
      }

      return {
        weekday,
        is_open: isOpen,
        start_time: isOpen ? start : null,
        end_time: isOpen ? end : null,
      };
    });
  }

  async save() {
    this.message.textContent = '';
    this.setStatus('Guardando...');

    let items;
    try {
      items = this.collectItems();
    } catch (error) {
      this.setStatus('');
      this.message.textContent = error.message;
      Toast.error(error.message);
      return;
    }

    this.saveBtn.disabled = true;

    try {
      const data = await workingHoursService.updateWorkingHours({ items });
      this.renderRows(data.items || []);
      this.message.textContent = 'Horario actualizado';
      this.setStatus('Guardado', 'success');
      Toast.success('Horario actualizado correctamente');
    } catch (error) {
      this.message.textContent = error.message || 'Error al guardar';
      this.setStatus('Error', 'error');
      Toast.error('No se pudo guardar el horario');
    } finally {
      this.saveBtn.disabled = false;
    }
  }
}

// Initialize controller
new WorkingHoursController();

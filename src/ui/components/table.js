/**
 * Table - Data table component
 */

import { escapeHtml } from '../../core/utils.js';

export class Table {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.options = {
      columns: [],
      data: [],
      emptyMessage: 'No hay datos',
      onRowClick: null,
      ...options,
    };
  }

  render(data = null) {
    if (data) {
      this.options.data = data;
    }

    if (!this.options.data || this.options.data.length === 0) {
      this.container.innerHTML = `<p class="empty-state">${this.options.emptyMessage}</p>`;
      return;
    }

    const table = document.createElement('table');
    table.className = 'data-table';

    // Header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    this.options.columns.forEach(col => {
      const th = document.createElement('th');
      th.textContent = col.label;
      if (col.width) th.style.width = col.width;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body
    const tbody = document.createElement('tbody');
    this.options.data.forEach((row, index) => {
      const tr = document.createElement('tr');
      if (this.options.onRowClick) {
        tr.style.cursor = 'pointer';
        tr.addEventListener('click', () => this.options.onRowClick(row, index));
      }

      this.options.columns.forEach(col => {
        const td = document.createElement('td');
        const value = this._getValue(row, col.field);
        
        if (col.render) {
          td.innerHTML = col.render(value, row);
        } else {
          td.textContent = value || '—';
        }
        
        tbody.appendChild(td);
      });

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    this.container.innerHTML = '';
    this.container.appendChild(table);
  }

  _getValue(obj, path) {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  }

  update(data) {
    this.render(data);
  }

  clear() {
    this.container.innerHTML = '';
  }
}

window.LikeStudioWidgets = window.LikeStudioWidgets || {};

(function (widgets) {
  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeText(value) {
    return String(value || '').toLowerCase().trim();
  }

  function normalizePhone(value) {
    return String(value || '').replace(/[^0-9]/g, '');
  }

  widgets.normalizeText = normalizeText;
  widgets.normalizePhone = normalizePhone;

  widgets.filterClients = function (clients, query) {
    const textQuery = normalizeText(query);
    if (!textQuery) return clients.slice();
    const digitsQuery = normalizePhone(query);
    return clients.filter((client) => {
      const name = normalizeText(client.full_name);
      const phoneRaw = String(client.phone || '');
      const phoneDigits = normalizePhone(phoneRaw);
      if (name && name.includes(textQuery)) return true;
      if (digitsQuery && phoneDigits && phoneDigits.includes(digitsQuery)) return true;
      if (!digitsQuery && normalizeText(phoneRaw).includes(textQuery)) return true;
      return false;
    });
  };

  widgets.buildClientOptions = function (clients, options) {
    const opts = options || {};
    const placeholder = opts.placeholder || 'Seleccionar...';
    const includeNew = opts.includeNew === true;
    const showPhone = opts.showPhone !== false;

    const items = [`<option value="">${escapeHtml(placeholder)}</option>`];
    if (includeNew) {
      items.push('<option value="__new__">+ Nuevo cliente</option>');
    }
    clients.forEach((client) => {
      const name = escapeHtml(client.full_name || '');
      const phone = escapeHtml(client.phone || '');
      const label = showPhone && phone ? `${name} - ${phone}` : name;
      items.push(`<option value="${client.id}">${label}</option>`);
    });
    return items.join('');
  };

  widgets.buildServiceOptions = function (services, options) {
    const opts = options || {};
    const placeholder = opts.placeholder || 'Seleccionar...';
    const includeBlock = opts.includeBlock === true;
    const items = [`<option value="">${escapeHtml(placeholder)}</option>`];
    if (includeBlock) {
      items.push('<option value="__block__">Bloqueo</option>');
    }
    services.forEach((service) => {
      const name = escapeHtml(service.name || '');
      items.push(`<option value="${name}">${name}</option>`);
    });
    return items.join('');
  };

  widgets.fetchServices = function (options) {
    const opts = options || {};
    const base = (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) || '';
    if (!base) return Promise.resolve([]);
    const limit = opts.limit || 1000;
    const offset = opts.offset || 0;
    const activeOnly = opts.activeOnly !== false;
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    if (activeOnly) params.set('active_only', 'true');
    const url = `${base}/admin/services?${params.toString()}`;
    return fetch(url)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => (payload && Array.isArray(payload.items) ? payload.items : []))
      .catch(() => []);
  };

  widgets.renderServiceSelect = function (select, services, options) {
    if (!select) return;
    select.innerHTML = widgets.buildServiceOptions(services, options);
  };
})(window.LikeStudioWidgets);

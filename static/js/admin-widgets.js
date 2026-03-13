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

  function detectQueryMode(query) {
    const raw = String(query || '');
    const digits = normalizePhone(raw);
    const letters = raw.replace(/[^a-zA-Z]/g, '').length;
    if (digits && digits.length >= 3 && digits.length >= letters) {
      return 'phone';
    }
    return 'name';
  }

  function buildClientDatalistOptions(clients, mode) {
    const items = [];
    clients.forEach((client) => {
      const name = String(client.full_name || '').trim();
      const phoneRaw = String(client.phone || '').trim();
      const phoneDigits = normalizePhone(phoneRaw);
      if (mode === 'phone' && phoneDigits) {
        items.push(`<option value="${escapeHtml(phoneDigits)}" label="${escapeHtml(name)}"></option>`);
        return;
      }
      if (name) {
        const label = phoneRaw ? `Tel: ${phoneRaw}` : '';
        items.push(`<option value="${escapeHtml(name)}"${label ? ` label="${escapeHtml(label)}"` : ''}></option>`);
        return;
      }
      if (phoneDigits) {
        items.push(`<option value="${escapeHtml(phoneDigits)}"></option>`);
      }
    });
    return items.join('');
  }

  widgets.attachClientAutocomplete = function (input, options) {
    if (!input) return;
    const opts = options || {};
    const minChars = Number.isFinite(opts.minChars) ? opts.minChars : 2;
    const limit = Number.isFinite(opts.limit) ? opts.limit : 12;
    const debounceMs = Number.isFinite(opts.debounceMs) ? opts.debounceMs : 200;
    const base = (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) || '';
    if (!base) return;

    const listId = opts.listId || `${input.id || 'client'}-list`;
    let datalist = document.getElementById(listId);
    if (!datalist) {
      datalist = document.createElement('datalist');
      datalist.id = listId;
      document.body.appendChild(datalist);
    }
    input.setAttribute('list', listId);

    let timer = null;
    let requestId = 0;
    let lastQuery = '';

    function fetchSuggestions(query) {
      const current = ++requestId;
      const params = new URLSearchParams();
      params.set('query', query);
      params.set('limit', String(limit));
      params.set('offset', '0');
      fetch(`${base}/admin/clients?${params.toString()}`)
        .then((response) => (response.ok ? response.json() : null))
        .then((payload) => {
          if (current !== requestId) return;
          const items = payload && Array.isArray(payload.items) ? payload.items : [];
          const mode = detectQueryMode(query);
          datalist.innerHTML = buildClientDatalistOptions(items, mode);
        })
        .catch(() => {
          if (current !== requestId) return;
          datalist.innerHTML = '';
        });
    }

    input.addEventListener('input', () => {
      const query = String(input.value || '').trim();
      if (query.length < minChars) {
        datalist.innerHTML = '';
        lastQuery = query;
        return;
      }
      if (query === lastQuery) return;
      lastQuery = query;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fetchSuggestions(query), debounceMs);
    });
  };
})(window.LikeStudioWidgets);

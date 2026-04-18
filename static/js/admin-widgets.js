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

  /* ── Custom styled autocomplete (replaces native datalist) ─────────── */

  const AUTOCOMPLETE_STYLE_ID = 'likestudio-autocomplete-styles';

  function injectAutocompleteStyles() {
    if (document.getElementById(AUTOCOMPLETE_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = AUTOCOMPLETE_STYLE_ID;
    style.textContent = `
      .ls-autocomplete-wrap { position: relative; display: block; }
      .ls-autocomplete-dropdown {
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        right: 0;
        z-index: 9999;
        background: #111827;
        border: 1px solid #1e2a3a;
        border-radius: 10px;
        box-shadow: 0 12px 32px rgba(0,0,0,0.55);
        max-height: 240px;
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: #2a354a #111827;
      }
      .ls-autocomplete-dropdown::-webkit-scrollbar { width: 6px; }
      .ls-autocomplete-dropdown::-webkit-scrollbar-track { background: #111827; border-radius: 10px; }
      .ls-autocomplete-dropdown::-webkit-scrollbar-thumb { background: #2a354a; border-radius: 10px; }
      .ls-autocomplete-dropdown::-webkit-scrollbar-thumb:hover { background: #3a4a60; }
      .ls-autocomplete-item {
        padding: 0.6rem 0.9rem;
        cursor: pointer;
        font-size: 0.875rem;
        color: #e7edf8;
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
        border-bottom: 1px solid rgba(30,42,58,0.5);
        transition: background 0.1s;
      }
      .ls-autocomplete-item:last-child { border-bottom: none; }
      .ls-autocomplete-item:hover,
      .ls-autocomplete-item.is-active {
        background: rgba(124,106,247,0.12);
        color: #fff;
      }
      .ls-autocomplete-item-name { font-weight: 600; }
      .ls-autocomplete-item-sub { font-size: 0.78rem; color: #8a96b0; }
      .ls-autocomplete-empty {
        padding: 0.75rem 0.9rem;
        font-size: 0.85rem;
        color: #6b7a99;
        text-align: center;
      }
    `;
    document.head.appendChild(style);
  }

  widgets.attachClientAutocomplete = function (input, options) {
    if (!input) return;
    injectAutocompleteStyles();

    const opts = options || {};
    const minChars = Number.isFinite(opts.minChars) ? opts.minChars : 2;
    const limit = Number.isFinite(opts.limit) ? opts.limit : 12;
    const debounceMs = Number.isFinite(opts.debounceMs) ? opts.debounceMs : 200;
    const base = (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) || '';
    if (!base) return;

    // Wrap input in relative container if not already
    const parent = input.parentElement;
    let anchorEl = input.parentElement;
    if (parent && !parent.classList.contains('ls-autocomplete-wrap')) {
      // Wrap just the input so dropdown anchors to the input bottom, not the whole field
      const wrap = document.createElement('div');
      wrap.className = 'ls-autocomplete-wrap';
      wrap.style.position = 'relative';
      parent.insertBefore(wrap, input);
      wrap.appendChild(input);
      anchorEl = wrap;
    }

    // Create dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'ls-autocomplete-dropdown';
    dropdown.style.display = 'none';
    anchorEl.appendChild(dropdown);

    let timer = null;
    let requestId = 0;
    let lastQuery = '';
    let activeIndex = -1;
    let currentItems = [];

    function getItems() {
      return Array.from(dropdown.querySelectorAll('.ls-autocomplete-item'));
    }

    function setActive(index) {
      const items = getItems();
      items.forEach((el, i) => el.classList.toggle('is-active', i === index));
      activeIndex = index;
    }

    function closeDropdown() {
      dropdown.style.display = 'none';
      activeIndex = -1;
      currentItems = [];
    }

    function renderItems(clients) {
      currentItems = clients;
      if (!clients.length) {
        dropdown.innerHTML = '<div class="ls-autocomplete-empty">Sin resultados</div>';
        dropdown.style.display = 'block';
        return;
      }
      dropdown.innerHTML = clients.map((client, i) => {
        const name = escapeHtml(String(client.full_name || '').trim());
        const phone = escapeHtml(String(client.phone || '').trim());
        return `<div class="ls-autocomplete-item" data-index="${i}" data-id="${client.id}" data-name="${name}" data-phone="${phone}">
          <span class="ls-autocomplete-item-name">${name}</span>
          ${phone ? `<span class="ls-autocomplete-item-sub">${phone}</span>` : ''}
        </div>`;
      }).join('');
      dropdown.style.display = 'block';
      activeIndex = -1;
    }

    function selectItem(client) {
      if (!client) return;
      input.value = String(client.full_name || '').trim();
      closeDropdown();
      // Fire a custom event so callers can react
      input.dispatchEvent(new CustomEvent('ls:select', { detail: client, bubbles: true }));
      // Also fire input event for compatibility
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function fetchSuggestions(query) {
      const current = ++requestId;
      const params = new URLSearchParams();
      params.set('query', query);
      params.set('limit', String(limit));
      params.set('offset', '0');
      fetch(`${base}/admin/clients?${params.toString()}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((payload) => {
          if (current !== requestId) return;
          const items = payload && Array.isArray(payload.items) ? payload.items : [];
          renderItems(items);
        })
        .catch(() => {
          if (current !== requestId) return;
          closeDropdown();
        });
    }

    input.addEventListener('input', () => {
      const query = String(input.value || '').trim();
      if (query.length < minChars) { closeDropdown(); lastQuery = query; return; }
      if (query === lastQuery) return;
      lastQuery = query;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fetchSuggestions(query), debounceMs);
    });

    input.addEventListener('keydown', (e) => {
      if (dropdown.style.display === 'none') return;
      const items = getItems();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive(Math.min(activeIndex + 1, items.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive(Math.max(activeIndex - 1, 0));
      } else if (e.key === 'Enter' && activeIndex >= 0) {
        e.preventDefault();
        selectItem(currentItems[activeIndex]);
      } else if (e.key === 'Escape') {
        closeDropdown();
      }
    });

    dropdown.addEventListener('mousedown', (e) => {
      const item = e.target.closest('.ls-autocomplete-item');
      if (!item) return;
      e.preventDefault();
      const index = parseInt(item.dataset.index, 10);
      if (!Number.isNaN(index) && currentItems[index]) {
        selectItem(currentItems[index]);
      }
    });

    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) {
        closeDropdown();
      }
    });
  };
})(window.LikeStudioWidgets);

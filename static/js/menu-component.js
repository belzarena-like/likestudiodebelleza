/**
 * Menu Component - Reusable navigation menu for Like Studio
 * Supports both public and admin menus with grouped navigation
 */

(function() {
  'use strict';

  // Menu configurations
  const MENU_CONFIGS = {
    public: {
      brand: {
        href: 'index.html',
        logo: 'assets/imgs/logo.png',
        text: 'Studio Academy'
      },
      items: [
        { label: 'Inicio', href: 'index.html' },
        { label: 'Servicios', href: 'servicios.html' },
        { label: 'Reserva online', href: 'reserva.html' },
        { label: 'Galeria', href: 'gallery.html' },
        { label: 'Instagram', href: 'index.html#instagram' },
        { label: 'Academia', href: 'index.html#academy' },
        { label: 'Contacto', href: 'index.html#contact' },
        { 
          label: 'WhatsApp', 
          href: 'https://api.whatsapp.com/send?phone=34603749744&text=Hola,%20quiero%20reservar%20una%20cita',
          class: 'btn btn-sm',
          target: '_blank'
        }
      ]
    },
    admin: {
      brand: {
        href: 'index.html',
        logo: '../assets/imgs/logo.png',
        text: 'Admin'
      },
      groups: [
        {
          label: 'Gestión',
          items: [
            { label: 'Consentimientos', href: 'index.html' },
            { label: 'Clientes', href: 'clients.html' },
            { label: 'Sesiones', href: 'sessions.html' },
            { label: 'Agenda', href: 'booking-draft.html' },
            { label: 'Pagos', href: 'payments.html' }
          ]
        },
        {
          label: 'Configuración',
          items: [
            { label: 'Servicios', href: 'services.html' },
            { label: 'Horario', href: 'working-hours.html' },
            { label: 'Email', href: 'settings.html' }
          ]
        },
        {
          label: 'Herramientas',
          items: [
            { label: 'Generador QR', href: 'qr-generator.html' },
            { label: 'Videos', href: 'videos.html' },
            { label: 'Formación', href: 'training.html' }
          ]
        }
      ],
      footer: [
        { label: 'Web pública', href: '../index.html' },
        { 
          label: 'Cerrar sesión', 
          href: '#', 
          onclick: 'likestudioAdminLogout(); return false;' 
        }
      ]
    }
  };

  /**
   * Renders the menu component
   * @param {string} type - 'public' or 'admin'
   * @param {HTMLElement} container - Container element for the menu
   */
  function renderMenu(type, container) {
    if (!container) {
      console.error('Menu container not found');
      return;
    }

    const config = MENU_CONFIGS[type];
    if (!config) {
      console.error(`Invalid menu type: ${type}`);
      return;
    }

    // Clear existing content
    container.innerHTML = '';

    // Create brand
    const brand = document.createElement('a');
    brand.className = 'brand';
    brand.href = config.brand.href;
    
    if (config.brand.logo) {
      const logo = document.createElement('img');
      logo.className = 'brand-logo';
      logo.src = config.brand.logo;
      logo.alt = 'Like Studio logo';
      brand.appendChild(logo);
    }
    
    const brandText = document.createElement('span');
    brandText.textContent = config.brand.text;
    brand.appendChild(brandText);
    container.appendChild(brand);

    // Create menu toggle button
    const menuToggle = document.createElement('button');
    menuToggle.className = 'menu-toggle';
    menuToggle.type = 'button';
    menuToggle.setAttribute('aria-label', 'Abrir menu');
    menuToggle.setAttribute('data-menu-toggle', '');
    menuToggle.textContent = 'Menu';
    container.appendChild(menuToggle);

    // Create nav element
    const nav = document.createElement('nav');
    nav.className = 'menu';
    nav.setAttribute('data-menu', '');

    if (type === 'public') {
      // Simple flat menu for public
      config.items.forEach(item => {
        const link = createLink(item);
        nav.appendChild(link);
      });
    } else if (type === 'admin') {
      // Grouped menu for admin with collapsible groups
      config.groups.forEach((group, index) => {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'menu-group';
        groupDiv.setAttribute('data-group-index', index);

        const groupHeader = document.createElement('button');
        groupHeader.className = 'menu-group-header';
        groupHeader.type = 'button';
        groupHeader.setAttribute('aria-expanded', 'true');
        
        const groupLabel = document.createElement('span');
        groupLabel.className = 'menu-group-label';
        groupLabel.textContent = group.label;
        
        const groupIcon = document.createElement('span');
        groupIcon.className = 'menu-group-icon';
        groupIcon.textContent = '▼';
        
        groupHeader.appendChild(groupLabel);
        groupHeader.appendChild(groupIcon);
        groupDiv.appendChild(groupHeader);

        const groupItems = document.createElement('div');
        groupItems.className = 'menu-group-items';
        
        group.items.forEach(item => {
          const link = createLink(item);
          groupItems.appendChild(link);
        });

        groupDiv.appendChild(groupItems);
        nav.appendChild(groupDiv);

        // Add click handler for group toggle
        groupHeader.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleGroup(groupDiv, groupHeader, groupIcon);
        });
      });

      // Add footer items
      if (config.footer) {
        const separator = document.createElement('div');
        separator.className = 'menu-separator';
        nav.appendChild(separator);

        config.footer.forEach(item => {
          const link = createLink(item);
          nav.appendChild(link);
        });
      }
    }

    container.appendChild(nav);

    // Setup menu toggle functionality
    setupMenuToggle(menuToggle, nav);
  }

  /**
   * Creates a link element from item config
   */
  function createLink(item) {
    const link = document.createElement('a');
    link.href = item.href;
    link.textContent = item.label;
    
    if (item.class) {
      link.className = item.class;
    }
    
    if (item.target) {
      link.target = item.target;
      link.rel = 'noreferrer';
    }
    
    if (item.onclick) {
      link.setAttribute('onclick', item.onclick);
    }
    
    return link;
  }

  /**
   * Toggles a menu group open/closed
   */
  function toggleGroup(groupDiv, groupHeader, groupIcon) {
    const isExpanded = groupHeader.getAttribute('aria-expanded') === 'true';
    
    if (isExpanded) {
      groupDiv.classList.add('collapsed');
      groupHeader.setAttribute('aria-expanded', 'false');
      groupIcon.textContent = '▶';
    } else {
      groupDiv.classList.remove('collapsed');
      groupHeader.setAttribute('aria-expanded', 'true');
      groupIcon.textContent = '▼';
    }
  }

  /**
   * Sets up menu toggle functionality
   */
  function setupMenuToggle(toggle, menu) {
    toggle.addEventListener('click', () => {
      menu.classList.toggle('is-open');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!toggle.contains(e.target) && !menu.contains(e.target)) {
        menu.classList.remove('is-open');
      }
    });

    // Close menu on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        menu.classList.remove('is-open');
      }
    });
  }

  /**
   * Initialize menu on page load
   */
  function init() {
    const header = document.querySelector('.topbar');
    if (!header) return;

    // Determine menu type based on page location
    const isAdmin = window.location.pathname.includes('/admin/');
    const menuType = isAdmin ? 'admin' : 'public';

    renderMenu(menuType, header);
  }

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Export for manual initialization if needed
  window.LikeStudioMenu = {
    render: renderMenu,
    configs: MENU_CONFIGS
  };
})();

/**
 * Loading - Loading indicator
 */

export class Loading {
  static show(message = 'Cargando...') {
    // Remove existing loader
    this.hide();

    // Create loader
    const loader = document.createElement('div');
    loader.id = 'global-loader';
    loader.className = 'loading-overlay';
    loader.innerHTML = `
      <div class="loading-spinner">
        <div class="spinner"></div>
        <p class="loading-message">${message}</p>
      </div>
    `;

    document.body.appendChild(loader);
    document.body.style.overflow = 'hidden';
  }

  static hide() {
    const loader = document.getElementById('global-loader');
    if (loader) {
      loader.remove();
      document.body.style.overflow = '';
    }
  }

  static update(message) {
    const messageEl = document.querySelector('.loading-message');
    if (messageEl) {
      messageEl.textContent = message;
    }
  }
}

// Add CSS if not already present
if (!document.getElementById('loading-styles')) {
  const style = document.createElement('style');
  style.id = 'loading-styles';
  style.textContent = `
    .loading-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 99999;
    }
    .loading-spinner {
      text-align: center;
      color: white;
    }
    .spinner {
      width: 50px;
      height: 50px;
      margin: 0 auto 20px;
      border: 4px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .loading-message {
      font-size: 16px;
      margin: 0;
    }
  `;
  document.head.appendChild(style);
}

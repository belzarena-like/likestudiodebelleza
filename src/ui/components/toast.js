/**
 * Toast - Notification system
 */

export class Toast {
  static show(message, type = 'info', duration = 3000) {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-content">
        <span class="toast-icon">${this._getIcon(type)}</span>
        <span class="toast-message">${message}</span>
      </div>
    `;

    // Add to body
    document.body.appendChild(toast);

    // Show with animation
    setTimeout(() => toast.classList.add('show'), 10);

    // Hide and remove
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  static success(message, duration) {
    this.show(message, 'success', duration);
  }

  static error(message, duration) {
    this.show(message, 'error', duration);
  }

  static warning(message, duration) {
    this.show(message, 'warning', duration);
  }

  static info(message, duration) {
    this.show(message, 'info', duration);
  }

  static _getIcon(type) {
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ',
    };
    return icons[type] || icons.info;
  }
}

// Add CSS if not already present
if (!document.getElementById('toast-styles')) {
  const style = document.createElement('style');
  style.id = 'toast-styles';
  style.textContent = `
    .toast {
      position: fixed;
      top: 20px;
      right: 20px;
      min-width: 250px;
      max-width: 400px;
      padding: 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      opacity: 0;
      transform: translateX(400px);
      transition: all 0.3s ease;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .toast.show {
      opacity: 1;
      transform: translateX(0);
    }
    .toast-content {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .toast-icon {
      font-size: 20px;
      font-weight: bold;
    }
    .toast-message {
      flex: 1;
      font-size: 14px;
    }
    .toast-success {
      background: #10b981;
      color: white;
    }
    .toast-error {
      background: #ef4444;
      color: white;
    }
    .toast-warning {
      background: #f59e0b;
      color: white;
    }
    .toast-info {
      background: #3b82f6;
      color: white;
    }
  `;
  document.head.appendChild(style);
}

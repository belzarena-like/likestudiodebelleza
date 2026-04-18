import { QRService } from '../../src/services/qr.service.js';
import { Toast } from '../../src/ui/components/toast.js';

class QRGeneratorController {
  constructor() {
    this.currentQR = null;
    this.form = document.getElementById('qr-form');
    this.preview = document.getElementById('qr-preview');
    this.details = document.getElementById('qr-details');
    this.actions = document.getElementById('qr-actions');
    this.historyList = document.getElementById('qr-history-list');
    this.tableBody = document.getElementById('qr-table-body');
    
    this.initEventListeners();
    this.loadHistory();
    this.loadAllQR();
  }
  
  initEventListeners() {
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.generateQR();
    });
    
    document.getElementById('download-qr').addEventListener('click', () => {
      this.downloadQR();
    });
    
    document.getElementById('copy-link').addEventListener('click', () => {
      this.copyQRLink();
    });
    
    document.getElementById('share-qr').addEventListener('click', () => {
      this.shareQR();
    });
    
    document.getElementById('reset-form').addEventListener('click', () => {
      this.form.reset();
      this.toggleLogoOptions(false);
      this.updateLivePreview();
    });
    
    // Template buttons
    document.querySelectorAll('[data-template]').forEach(btn => {
      btn.addEventListener('click', (e) => this.applyTemplate(e.target.dataset.template));
    });
    
    // Live preview on content change
    document.getElementById('qr-content').addEventListener('input', () => {
      this.updateLivePreview();
    });
    
    // Logo options toggle
    document.getElementById('qr-add-logo').addEventListener('change', (e) => {
      this.toggleLogoOptions(e.target.checked);
    });
    
    // Logo size slider
    document.getElementById('qr-logo-size').addEventListener('input', (e) => {
      document.getElementById('logo-size-value').textContent = `${e.target.value}%`;
    });
  }
  
  toggleLogoOptions(show) {
    const sizeContainer = document.getElementById('logo-size-container');
    const positionContainer = document.getElementById('logo-position-container');
    
    if (show) {
      sizeContainer.style.display = 'block';
      positionContainer.style.display = 'block';
    } else {
      sizeContainer.style.display = 'none';
      positionContainer.style.display = 'none';
    }
  }
  
  async generateQR() {
    const formData = new FormData(this.form);
    const addLogo = formData.get('add_logo') === 'on';
    
    const payload = {
      content: formData.get('content'),
      title: formData.get('title') || null,
      description: formData.get('description') || null,
      size: parseInt(formData.get('size')),
      format: formData.get('format'),
      error_correction: formData.get('error_correction'),
      color: formData.get('color'),
      background_color: formData.get('background_color'),
      add_logo: addLogo,
    };
    
    if (addLogo) {
      payload.logo_size = parseInt(formData.get('logo_size'));
      payload.logo_position = formData.get('logo_position');
    }
    
    console.log('Generating QR with payload:', payload);
    
    try {
      const qrCode = await QRService.generateQR(payload);
      console.log('QR generated:', qrCode);
      this.currentQR = qrCode;
      this.showQRPreview(qrCode);
      Toast.success('QR generado correctamente');
      this.addToHistory(qrCode);
      this.loadAllQR(); // Refresh table
    } catch (error) {
      console.error('Error generating QR:', error);
      Toast.error('Error generando QR');
    }
  }
  
  showQRPreview(qrCode) {
    console.log('Showing QR preview:', qrCode);
    
    // Clear preview
    this.preview.innerHTML = '';
    
    // Create image element
    const img = document.createElement('img');
    img.alt = qrCode.title || 'Código QR';
    img.style.maxWidth = '100%';
    img.style.height = 'auto';
    img.onload = () => console.log('QR image loaded successfully');
    img.onerror = (e) => {
      console.error('Error loading QR image:', e);
      console.log('Image src was:', img.src.substring(0, 100) + '...');
    };
    
    // Use base64 data if available, otherwise use URL
    if (qrCode.image_data && qrCode.image_mime_type) {
      console.log('Using base64 data, mime type:', qrCode.image_mime_type);
      img.src = `data:${qrCode.image_mime_type};base64,${qrCode.image_data}`;
    } else if (qrCode.image_url) {
      console.log('Using image URL:', qrCode.image_url);
      img.src = qrCode.image_url;
    } else {
      console.log('No image data, using placeholder');
      // Fallback - generate simple placeholder
      img.src = 'data:image/svg+xml;base64,' + btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
          <rect width="300" height="300" fill="#ffffff"/>
          <text x="150" y="150" font-family="Arial" font-size="14" text-anchor="middle" fill="#666">QR Code</text>
        </svg>
      `);
    }
    
    this.preview.appendChild(img);
    
    // Update details
    document.getElementById('qr-code-value').textContent = qrCode.code;
    document.getElementById('qr-scan-count').textContent = qrCode.use_count;
    document.getElementById('qr-created-at').textContent = new Date(qrCode.created_at).toLocaleString('es-ES');
    
    // Show details and actions
    this.details.style.display = 'block';
    this.actions.style.display = 'flex';
  }
  
  async downloadQR() {
    if (!this.currentQR) return;
    
    try {
      const response = await QRService.downloadQRImage(this.currentQR.code);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qr-${this.currentQR.code}.${this.currentQR.format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      Toast.success('QR descargado');
    } catch (error) {
      Toast.error('Error descargando QR');
    }
  }
  
  async copyQRLink() {
    if (!this.currentQR) return;
    
    const link = `${window.location.origin}/public-qr.html?code=${this.currentQR.code}`;
    try {
      await navigator.clipboard.writeText(link);
      Toast.success('Enlace público copiado al portapapeles');
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = link;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      Toast.success('Enlace público copiado al portapapeles');
    }
  }
  
  async shareQR() {
    if (!this.currentQR) return;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: this.currentQR.title || 'Código QR Like Studio',
          text: this.currentQR.description || 'Escanea este código QR',
          url: `${window.location.origin}/public-qr.html?code=${this.currentQR.code}`,
        });
      } catch (error) {
        console.log('Error sharing:', error);
      }
    } else {
      this.copyQRLink();
    }
  }
  
  applyTemplate(templateName) {
    const templates = {
      'client-profile': {
        content: `${window.location.origin}/admin/clients.html?id=`,
        title: 'Perfil de cliente',
        description: 'Acceso al perfil del cliente en el sistema',
        color: '#3b82f6',
        placeholder: 'ID_CLIENTE (ej: 123)',
      },
      'appointment': {
        content: `${window.location.origin}/admin/booking-draft.html?appointment=`,
        title: 'Cita reservada',
        description: 'Detalles de la cita reservada',
        color: '#10b981',
        placeholder: 'ID_CITA (ej: 456)',
      },
      'service-info': {
        content: `${window.location.origin}/servicios.html#`,
        title: 'Información del servicio',
        description: 'Más información sobre este servicio',
        color: '#8b5cf6',
        placeholder: 'NOMBRE_SERVICIO (ej: manicura)',
      },
      'payment': {
        content: `${window.location.origin}/pay?amount=`,
        title: 'Enlace de pago',
        description: 'Realizar pago online',
        color: '#f59e0b',
        placeholder: 'CANTIDAD (ej: 50.00)',
      }
    };
    
    const template = templates[templateName];
    if (template) {
      let content = template.content;
      
      // Add placeholder comment
      const placeholderText = `[${template.placeholder}]`;
      content += placeholderText;
      
      document.getElementById('qr-content').value = content;
      document.getElementById('qr-title').value = template.title || '';
      document.getElementById('qr-description').value = template.description || '';
      document.getElementById('qr-color').value = template.color || '#000000';
      
      // Reset logo options
      document.getElementById('qr-add-logo').checked = false;
      this.toggleLogoOptions(false);
      
      // Show template hint
      Toast.info(`Plantilla aplicada. Reemplaza "${placeholderText}" con el valor real.`, 5000);
      
      this.updateLivePreview();
    }
  }
  
  updateLivePreview() {
    // Simple text preview for content
    const content = document.getElementById('qr-content').value;
    if (content) {
      this.preview.innerHTML = `
        <div class="qr-preview-text">
          <p><strong>Contenido:</strong> ${content.length > 50 ? content.substring(0, 50) + '...' : content}</p>
          <small>El código QR se generará al enviar el formulario</small>
        </div>
      `;
    } else {
      this.preview.innerHTML = '<p>El código QR aparecerá aquí</p>';
    }
  }
  
  async loadHistory() {
    try {
      const response = await QRService.searchQR({ limit: 5 });
      response.items.forEach(qr => this.addToHistory(qr, false));
    } catch (error) {
      console.error('Error loading QR history:', error);
    }
  }
  
  addToHistory(qrCode, prepend = true) {
    const item = document.createElement('div');
    item.className = 'qr-history-item';
    // Build image source
    let imgSrc = qrCode.image_url;
    if (qrCode.image_data && qrCode.image_mime_type) {
      imgSrc = `data:${qrCode.image_mime_type};base64,${qrCode.image_data}`;
    }
    
    item.innerHTML = `
      <img src="${imgSrc}" alt="${qrCode.title || 'QR'}" />
      <div>
        <strong>${qrCode.title || 'Sin título'}</strong>
        <small>${new Date(qrCode.created_at).toLocaleDateString('es-ES')}</small>
        <small>${qrCode.use_count} escaneos</small>
      </div>
      <button class="btn btn-sm" data-code="${qrCode.code}">Usar</button>
    `;
    
    if (prepend && this.historyList.firstChild) {
      this.historyList.insertBefore(item, this.historyList.firstChild);
    } else {
      this.historyList.appendChild(item);
    }
    
    // Limit to 10 items
    while (this.historyList.children.length > 10) {
      this.historyList.removeChild(this.historyList.lastChild);
    }
    
    // Add click event to use button
    item.querySelector('button').addEventListener('click', (e) => {
      this.loadQR(e.target.dataset.code);
    });
  }
  
  async loadQR(code) {
    try {
      const qrCode = await QRService.getQR(code);
      this.currentQR = qrCode;
      this.showQRPreview(qrCode);
      
      // Scroll to preview
      document.querySelector('.qr-preview-section').scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
      Toast.error('Error cargando QR');
    }
  }
  
  async loadAllQR() {
    try {
      const response = await QRService.searchQR({ limit: 50 });
      this.renderTable(response.items);
    } catch (error) {
      Toast.error('Error cargando códigos QR');
    }
  }
  
  renderTable(qrCodes) {
    this.tableBody.innerHTML = '';
    
    qrCodes.forEach(qr => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><code>${qr.code}</code></td>
        <td class="truncate">${qr.content.length > 50 ? qr.content.substring(0, 50) + '...' : qr.content}</td>
        <td>${qr.title || '-'}</td>
        <td>${qr.use_count}</td>
        <td>${new Date(qr.created_at).toLocaleDateString('es-ES')}</td>
        <td>
          <button class="btn btn-sm btn-secondary" data-view="${qr.code}">Ver</button>
          <button class="btn btn-sm btn-danger" data-delete="${qr.id}">Eliminar</button>
        </td>
      `;
      
      this.tableBody.appendChild(row);
    });
    
    // Add event listeners
    this.tableBody.querySelectorAll('[data-view]').forEach(btn => {
      btn.addEventListener('click', (e) => this.loadQR(e.target.dataset.view));
    });
    
    this.tableBody.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', (e) => this.deleteQR(e.target.dataset.delete));
    });
  }
  
  async deleteQR(qrId) {
    if (confirm('¿Estás seguro de eliminar este código QR?')) {
      try {
        await QRService.deleteQR(qrId);
        Toast.success('QR eliminado');
        this.loadAllQR();
        this.loadHistory();
        
        // If deleted QR is the current one, clear preview
        if (this.currentQR && this.currentQR.id == qrId) {
          this.currentQR = null;
          this.preview.innerHTML = '<p>El código QR aparecerá aquí</p>';
          this.details.style.display = 'none';
          this.actions.style.display = 'none';
        }
      } catch (error) {
        Toast.error('Error eliminando QR');
      }
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new QRGeneratorController();
});
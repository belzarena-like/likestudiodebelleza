import { apiClient } from '../core/api-client.js';

export class QRService {
  static async generateQR(qrData) {
    return await apiClient.post('/qr/generate', qrData);
  }
  
  static async searchQR(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
    
    const url = `/admin/qr-codes${params.toString() ? `?${params.toString()}` : ''}`;
    return await apiClient.get(url);
  }
  
  static async getQR(code) {
    return await apiClient.get(`/api/qr/${code}/info`);
  }
  
  static async deleteQR(qrId) {
    return await apiClient.delete(`/admin/qr-codes/${qrId}`);
  }
  
  static async downloadQRImage(code) {
    return await apiClient.getBlob(`/api/qr/${code}/image`);
  }
  
  static async recordScan(scanData) {
    return await apiClient.post('/qr/scans', scanData);
  }
}
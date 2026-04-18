import { apiClient } from '../core/api-client.js';

export class PaymentService {
  static async searchPayments(filters = {}) {
    const params = new URLSearchParams();
    
    // Add filter params
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value);
      }
    });
    
    const url = `/admin/payments${params.toString() ? `?${params.toString()}` : ''}`;
    return await apiClient.get(url);
  }
  
  static async createPayment(paymentData) {
    console.log('Creating payment with data:', JSON.stringify(paymentData));
    return await apiClient.post('/payments', paymentData);
  }
  
  static async updatePayment(paymentId, paymentData) {
    return await apiClient.put(`/admin/payments/${paymentId}`, paymentData);
  }
  
  static async deletePayment(paymentId) {
    return await apiClient.delete(`/admin/payments/${paymentId}`);
  }
  
  static async getSummary(startDate, endDate) {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    
    const url = `/admin/payments/summary${params.toString() ? `?${params.toString()}` : ''}`;
    return await apiClient.get(url);
  }
  
  static async exportPayments(filters) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
    
    const url = `/admin/payments/export${params.toString() ? `?${params.toString()}` : ''}`;
    return await apiClient.get(url, { responseType: 'blob' });
  }
  
  static async getChartData(startDate, endDate) {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    
    const url = `/admin/payments/chart-data${params.toString() ? `?${params.toString()}` : ''}`;
    return await apiClient.get(url);
  }
  
  static async confirmTentativePayment(paymentId) {
    return await apiClient.post(`/admin/payments/${paymentId}/confirm`);
  }
}
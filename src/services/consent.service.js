/**
 * Consent Service - Consent form management API calls
 */

import { apiClient } from '../core/api-client.js';

export class ConsentService {
  async searchConsents(filters = {}) {
    return await apiClient.get('/admin/consents', filters);
  }

  async getConsent(consentId) {
    return await apiClient.get(`/admin/consents/${consentId}`);
  }

  async createConsent(consentData) {
    return await apiClient.post('/consents', consentData);
  }

  async updateConsent(consentId, consentData) {
    return await apiClient.put(`/consents/${consentId}`, consentData);
  }

  async getClientConsents(clientId) {
    return await apiClient.get(`/clients/${clientId}/consents`);
  }
}

export const consentService = new ConsentService();

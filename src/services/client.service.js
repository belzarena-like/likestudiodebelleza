/**
 * Client Service - Client management API calls
 */

import { apiClient } from '../core/api-client.js';

export class ClientService {
  async searchClients({ query = null, id = null, withConsents = false, limit = 200, offset = 0 } = {}) {
    const params = new URLSearchParams();
    if (query) params.append('query', query);
    if (id) params.append('id', id.toString());
    if (withConsents) params.append('with_consents', 'true');
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    
    const url = `/admin/clients${params.toString() ? `?${params.toString()}` : ''}`;
    return await apiClient.get(url);
  }
  
  async getClientById(clientId) {
    const response = await apiClient.get('/admin/clients', { id: clientId });
    if (response && response.items && response.items.length > 0) {
      return response.items[0];
    }
    return null;
  }

  async createClient(clientData) {
    return await apiClient.post('/clients', clientData);
  }

  async updateClient(clientId, clientData) {
    return await apiClient.put(`/admin/clients/${clientId}`, clientData);
  }

  async getClientPrefill(idNumber) {
    return await apiClient.get('/admin/client-prefill', { id_number: idNumber });
  }

  async getClientConsents(clientId) {
    return await apiClient.get(`/clients/${clientId}/consents`);
  }

  // Client Profiles
  async searchClientProfiles(query = null, limit = 50, offset = 0) {
    return await apiClient.get('/admin/client-profiles', { query, limit, offset });
  }

  async getClientProfile(clientId) {
    return await apiClient.get(`/admin/client-profiles/${clientId}`);
  }

  async upsertClientProfile(clientId, profileData) {
    return await apiClient.put(`/admin/client-profiles/${clientId}`, profileData);
  }
}

export const clientService = new ClientService();

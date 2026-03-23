/**
 * Service Service - Service/treatment management API calls
 */

import { apiClient } from '../core/api-client.js';

export class ServiceService {
  async searchServices(query = null, activeOnly = false, limit = 200, offset = 0) {
    return await apiClient.get('/admin/services', {
      query,
      active_only: activeOnly,
      limit,
      offset,
    });
  }

  async createService(serviceData) {
    return await apiClient.post('/admin/services', serviceData);
  }

  async updateService(serviceId, serviceData) {
    return await apiClient.put(`/admin/services/${serviceId}`, serviceData);
  }

  async getPublicServices(limit = 200, offset = 0) {
    return await apiClient.get('/public/services', { limit, offset });
  }
}

export const serviceService = new ServiceService();

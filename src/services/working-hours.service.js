/**
 * Working Hours Service - Working hours management API calls
 */

import { apiClient } from '../core/api-client.js';

export class WorkingHoursService {
  async getWorkingHours() {
    return await apiClient.get('/admin/working-hours');
  }

  async updateWorkingHours(workingHoursData) {
    return await apiClient.put('/admin/working-hours', workingHoursData);
  }
}

export const workingHoursService = new WorkingHoursService();

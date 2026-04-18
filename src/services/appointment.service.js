/**
 * Appointment Service - Appointment management API calls
 */

import { apiClient } from '../core/api-client.js';

export class AppointmentService {
  async searchAppointments(filters = {}) {
    return await apiClient.get('/admin/appointments', filters);
  }

  async getAppointment(appointmentId) {
    return await apiClient.get(`/admin/appointments/${appointmentId}`);
  }

  async createAppointment(appointmentData) {
    return await apiClient.post('/appointments', appointmentData);
  }

  async updateAppointment(appointmentId, appointmentData) {
    return await apiClient.put(`/appointments/${appointmentId}`, appointmentData);
  }

  async deleteAppointment(appointmentId) {
    return await apiClient.delete(`/appointments/${appointmentId}`);
  }

  // Public booking
  async getAvailability(date, serviceId, professionalName) {
    return await apiClient.get('/public/availability', {
      date,
      service_id: serviceId,
      professional_name: professionalName,
    });
  }

  async createPublicBooking(bookingData) {
    return await apiClient.post('/public/bookings', bookingData);
  }
}

export const appointmentService = new AppointmentService();

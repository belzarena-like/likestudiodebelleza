/**
 * Session Service - Treatment session management API calls
 */

import { apiClient } from '../core/api-client.js';

export class SessionService {
  async searchSessions(filters = {}) {
    return await apiClient.get('/admin/sessions', filters);
  }

  async createSession(sessionData) {
    return await apiClient.post('/sessions', sessionData);
  }

  async upsertSession(sessionData) {
    return await apiClient.post('/sessions/upsert', sessionData);
  }

  async updateSession(sessionId, sessionData) {
    return await apiClient.put(`/admin/sessions/${sessionId}`, sessionData);
  }

  async deleteSession(sessionId) {
    return await apiClient.delete(`/admin/sessions/${sessionId}`);
  }

  async getSessionAgenda(date) {
    return await apiClient.get('/admin/session-agenda', { date });
  }

  async markAttendance(appointmentId, attended) {
    return await apiClient.post('/admin/session-attendance', {
      appointment_id: appointmentId,
      attended,
    });
  }

  async getSessionHistory(sessionId, limit = 50, offset = 0) {
    return await apiClient.get(`/admin/sessions/${sessionId}/appointments`, {
      limit,
      offset,
    });
  }

  async createSessionAppointment(sessionId, appointmentData) {
    return await apiClient.post(`/admin/sessions/${sessionId}/appointments`, appointmentData);
  }
}

export const sessionService = new SessionService();

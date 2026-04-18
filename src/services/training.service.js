/**
 * Training Service - Business logic for training/academy features
 */

import { apiClient } from '../core/api-client.js';

export class TrainingService {
  // ── Training Sessions ────────────────────────────────────────────────────

  async listSessions(query = null, category = null, limit = 100) {
    const params = { limit };
    if (query) params.query = query;
    if (category) params.category = category;
    return await apiClient.get('/admin/training/sessions', params);
  }

  async getSession(sessionId) {
    return await apiClient.get(`/admin/training/sessions/${sessionId}`);
  }

  async createSession(sessionData) {
    return await apiClient.post('/admin/training/sessions', sessionData);
  }

  async updateSession(sessionId, sessionData) {
    return await apiClient.put(`/admin/training/sessions/${sessionId}`, sessionData);
  }

  async toggleSession(sessionId, isActive) {
    return await apiClient.put(`/admin/training/sessions/${sessionId}`, { is_active: isActive });
  }

  // ── Videos ───────────────────────────────────────────────────────────────

  async listVideos(query = null, limit = 200) {
    const params = { limit };
    if (query) params.query = query;
    return await apiClient.get('/admin/training/videos', params);
  }

  async getUploadUrl(filename, contentType = 'video/mp4') {
    // Use GET with query params instead of POST with empty body
    return await apiClient.get('/admin/training/videos/upload-url', {
      filename: filename,
      content_type: contentType
    });
  }

  async createVideo(videoData) {
    return await apiClient.post('/admin/training/videos', videoData);
  }

  async deleteVideo(videoId) {
    return await apiClient.delete(`/admin/training/videos/${videoId}`);
  }

  // S3 Upload helper - delegates to apiClient for progress support
  async uploadToS3(uploadUrl, file, contentType, onProgress) {
    return await apiClient.uploadToS3(uploadUrl, file, contentType, onProgress);
  }

  // ── Session Videos ───────────────────────────────────────────────────────

  async addVideoToSession(sessionId, videoId, displayOrder) {
    return await apiClient.post(`/admin/training/sessions/${sessionId}/videos`, {
      training_session_id: sessionId,
      video_id: videoId,
      display_order: displayOrder,
    });
  }

  async removeVideoFromSession(sessionId, videoId) {
    return await apiClient.delete(`/admin/training/sessions/${sessionId}/videos/${videoId}`);
  }

  async reorderVideos(sessionId, order) {
    return await apiClient.put(`/admin/training/sessions/${sessionId}/videos/reorder`, order);
  }

  // ── User Access ──────────────────────────────────────────────────────────

  async listSessionUsers(sessionId, limit = 200) {
    return await apiClient.get(`/admin/training/sessions/${sessionId}/users`, { limit });
  }

  async createUserAccess(sessionId, userData) {
    return await apiClient.post(`/admin/training/sessions/${sessionId}/users`, {
      training_session_id: sessionId,
      ...userData,
    });
  }

  async extendUserAccess(accessId, extendDays = 30) {
    return await apiClient.put(`/admin/training/users/${accessId}?extend_days=${extendDays}`);
  }

  async resetUserPassword(accessId, newPassword) {
    return await apiClient.put(
      `/admin/training/users/${accessId}?new_password=${encodeURIComponent(newPassword)}`
    );
  }

  async deleteUserAccess(accessId) {
    return await apiClient.delete(`/admin/training/users/${accessId}`);
  }

  // ── Academy (Public) ─────────────────────────────────────────────────────

  async login(username, password, sessionId) {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    formData.append('session_id', sessionId);
    return await apiClient.postForm('/academy/login', formData);
  }

  async getAcademySession(sessionId, token) {
    return await apiClient.get(`/academy/session/${sessionId}`, { token });
  }

  async getVideoStreamUrl(videoId, token) {
    return await apiClient.get(`/academy/video/${videoId}/stream-url`, { token });
  }
}

// Create singleton instance
export const trainingService = new TrainingService();

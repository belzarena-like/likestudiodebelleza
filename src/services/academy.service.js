/**
 * Academy Service - Public student access to training content
 */

import { apiClient } from '../core/api-client.js';

export class AcademyService {
  /**
   * Student login
   */
  async login(username, password, sessionId) {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    formData.append('session_id', sessionId);
    
    return await apiClient.postForm('/academy/login', formData);
  }

  /**
   * Get session/course details with videos
   */
  async getSession(sessionId, token) {
    return await apiClient.get(`/academy/session/${sessionId}`, { token });
  }

  /**
   * Get video stream URL
   */
  async getVideoStreamUrl(videoId, token) {
    return await apiClient.get(`/academy/video/${videoId}/stream-url`, { token });
  }
}

// Create singleton instance
export const academyService = new AcademyService();

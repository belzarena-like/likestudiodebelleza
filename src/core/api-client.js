/**
 * API Client - Centralized HTTP client for all API calls
 */

export class ApiClient {
  constructor() {
    // Don't cache baseURL - always read fresh from config
  }

  get baseURL() {
    // Always read fresh from config (no caching)
    return window.APP_CONFIG?.API_BASE_URL || 'https://apis.listoapp.es/like_api';
  }

  /**
   * Make a GET request
   */
  async get(endpoint, params = {}) {
    // Ensure auth is ready
    if (window.waitForAuth) {
      await window.waitForAuth();
    }
    
    const url = new URL(this.baseURL + endpoint);
    Object.keys(params).forEach(key => {
      if (params[key] !== null && params[key] !== undefined) {
        url.searchParams.append(key, params[key]);
      }
    });

    const response = await fetch(url, {
      method: 'GET',
      headers: this._getHeaders(),
    });

    return this._handleResponse(response);
  }
  
  /**
   * Make a GET request that returns a blob
   */
  async getBlob(endpoint, params = {}) {
    const url = new URL(this.baseURL + endpoint);
    Object.keys(params).forEach(key => {
      if (params[key] !== null && params[key] !== undefined) {
        url.searchParams.append(key, params[key]);
      }
    });

    const response = await fetch(url, {
      method: 'GET',
      headers: this._getHeaders(),
    });

    if (!response.ok) {
      throw new ApiError('Request failed', response.status);
    }
    
    return response;
  }

  /**
   * Make a POST request
   */
  async post(endpoint, data = {}) {
    // Ensure auth is ready
    if (window.waitForAuth) {
      await window.waitForAuth();
    }
    
    const url = new URL(this.baseURL + endpoint);
    const response = await fetch(url, {
      method: 'POST',
      headers: this._getHeaders(),
      body: JSON.stringify(data),
    });

    return this._handleResponse(response);
  }

  /**
   * Make a POST request with FormData
   */
  async postForm(endpoint, formData) {
    const url = new URL(this.baseURL + endpoint);
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    return this._handleResponse(response);
  }

  /**
   * Make a PUT request
   */
  async put(endpoint, data = {}) {
    // Ensure auth is ready
    if (window.waitForAuth) {
      await window.waitForAuth();
    }
    
    const url = new URL(this.baseURL + endpoint);
    const response = await fetch(url, {
      method: 'PUT',
      headers: this._getHeaders(),
      body: JSON.stringify(data),
    });

    return this._handleResponse(response);
  }

  /**
   * Make a DELETE request
   */
  async delete(endpoint) {
    // Ensure auth is ready
    if (window.waitForAuth) {
      await window.waitForAuth();
    }
    
    const url = new URL(this.baseURL + endpoint);
    const response = await fetch(url, {
      method: 'DELETE',
      headers: this._getHeaders(),
    });

    return this._handleResponse(response);
  }

  /**
   * Upload file directly to S3 using pre-signed URL
   */
  async uploadToS3(presignedUrl, file, contentType, onProgress = null) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', presignedUrl);
      xhr.setRequestHeader('Content-Type', contentType);

      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            onProgress(percentComplete);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error('Upload failed'));
      xhr.send(file);
    });
  }

  /**
   * Get default headers
   */
  _getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };

    // Add authentication token if available
    if (typeof window.likestudioGetAuthToken === 'function') {
      try {
        const token = window.likestudioGetAuthToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      } catch (e) {
        console.error('Error getting auth token:', e);
      }
    }

    return headers;
  }

  /**
   * Handle API response
   */
  async _handleResponse(response) {
    // If 401, token expired - logout
    if (response.status === 401) {
      if (window.likestudioAdminLogout) {
        window.likestudioAdminLogout();
      }
      throw new ApiError('Session expired', response.status, { detail: 'Session expired' });
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new ApiError(error.detail || 'Request failed', response.status, error);
    }

    // Handle empty responses
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return null;
    }

    return response.json();
  }
}

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

// Create singleton instance (baseURL will be read lazily)
export const apiClient = new ApiClient();

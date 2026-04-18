/**
 * Admin API Helper - Handles authenticated requests to the backend
 */

(function() {
  var API_BASE = window.location.origin.includes('localhost') 
    ? 'http://localhost:8000'
    : window.location.origin;

  /**
   * Make an authenticated API request
   * @param {string} endpoint - API endpoint (e.g., '/admin/clients')
   * @param {object} options - Fetch options (method, body, etc.)
   * @returns {Promise}
   */
  window.adminApiCall = function(endpoint, options) {
    options = options || {};
    
    var token = window.likestudioGetAuthToken();
    if (!token) {
      return Promise.reject(new Error("Not authenticated"));
    }

    var headers = options.headers || {};
    headers["Authorization"] = "Bearer " + token;
    headers["Content-Type"] = headers["Content-Type"] || "application/json";

    var fetchOptions = Object.assign({}, options, { headers: headers });

    return fetch(API_BASE + endpoint, fetchOptions)
      .then(function(response) {
        // If 401, token expired - redirect to login
        if (response.status === 401) {
          window.likestudioAdminLogout();
          throw new Error("Session expired");
        }
        
        if (!response.ok) {
          return response.json().then(function(data) {
            throw new Error(data.detail || "API error: " + response.status);
          }).catch(function(e) {
            throw new Error("API error: " + response.status);
          });
        }
        
        return response.json();
      });
  };

  /**
   * GET request
   */
  window.adminApiGet = function(endpoint) {
    return window.adminApiCall(endpoint, { method: "GET" });
  };

  /**
   * POST request
   */
  window.adminApiPost = function(endpoint, data) {
    return window.adminApiCall(endpoint, {
      method: "POST",
      body: JSON.stringify(data)
    });
  };

  /**
   * PUT request
   */
  window.adminApiPut = function(endpoint, data) {
    return window.adminApiCall(endpoint, {
      method: "PUT",
      body: JSON.stringify(data)
    });
  };

  /**
   * DELETE request
   */
  window.adminApiDelete = function(endpoint) {
    return window.adminApiCall(endpoint, { method: "DELETE" });
  };
})();

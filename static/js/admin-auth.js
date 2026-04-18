(function () {
  var AUTH_KEY = "likestudio_admin_auth_v3";
  var AUTH_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
  
  // Wait for app-config to load
  function getApiBase() {
    return (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) 
      ? window.APP_CONFIG.API_BASE_URL 
      : 'http://localhost:8000';
  }

  function now() {
    return Date.now();
  }

  function writeSession(token, expiresIn) {
    try {
      localStorage.setItem(
        AUTH_KEY,
        JSON.stringify({
          token: token,
          expires_at: now() + (expiresIn * 1000),
          created_at: now()
        })
      );
    } catch (e) {
      console.error('Error writing to localStorage:', e);
    }
  }

  function getSession() {
    var raw = localStorage.getItem(AUTH_KEY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  function isAuthenticated() {
    var session = getSession();
    if (!session || !session.token) {
      return false;
    }
    
    // Check if token has expired
    if (Number(session.expires_at) <= now()) {
      localStorage.removeItem(AUTH_KEY);
      return false;
    }
    
    return true;
  }

  function getToken() {
    var session = getSession();
    return session ? session.token : null;
  }

  function createOverlay() {
    var overlay = document.createElement("div");
    overlay.id = "admin-auth-overlay";
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.zIndex = "9999";
    overlay.style.display = "grid";
    overlay.style.placeItems = "center";
    overlay.style.background = "rgba(7,10,15,0.9)";
    overlay.innerHTML =
      '<div style="width:min(420px, calc(100% - 2rem)); background:#141922; border:1px solid #283143; border-radius:14px; padding:18px; color:#edf1f7; box-shadow:0 20px 50px rgba(0,0,0,.45);">' +
      '<h2 style="margin:0 0 8px; font-size:1.2rem;">Acceso Admin</h2>' +
      '<p style="margin:0 0 12px; color:#a5b0c0;">Introduce usuario y contrasena del estudio.</p>' +
      '<form id="admin-auth-form" style="display:grid; gap:10px;">' +
      '<input id="admin-user" autocomplete="username" placeholder="Usuario" style="padding:10px 12px; border-radius:10px; border:1px solid #2f3a4f; background:#0e131b; color:#edf1f7;" required />' +
      '<input id="admin-pass" type="password" autocomplete="current-password" placeholder="Contrasena" style="padding:10px 12px; border-radius:10px; border:1px solid #2f3a4f; background:#0e131b; color:#edf1f7;" required />' +
      '<button type="submit" style="padding:10px 12px; border:0; border-radius:999px; background:linear-gradient(135deg,#ff365f,#c71f45); color:#fff; font-weight:700; cursor:pointer;">Entrar</button>' +
      '<p id="admin-auth-error" style="margin:2px 0 0; color:#ff8ca3; min-height:20px;"></p>' +
      "</form>" +
      "</div>";
    return overlay;
  }

  function mountAuthGate() {
    if (isAuthenticated()) return;

    // Remove existing overlay if present
    var existing = document.getElementById("admin-auth-overlay");
    if (existing) {
      existing.remove();
    }

    var overlay = createOverlay();
    document.body.appendChild(overlay);

    var form = document.getElementById("admin-auth-form");
    var user = document.getElementById("admin-user");
    var pass = document.getElementById("admin-pass");
    var error = document.getElementById("admin-auth-error");

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      
      // Disable button during request
      var button = form.querySelector("button");
      button.disabled = true;
      button.style.opacity = "0.6";
      error.textContent = "Autenticando...";

      // Send login request to backend
      fetch(getApiBase() + "/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username: user.value,
          password: pass.value
        })
      })
      .then(function(response) {
        if (response.ok) {
          return response.json();
        } else {
          throw new Error("Invalid credentials");
        }
      })
      .then(function(data) {
        // Store token and expiry
        writeSession(data.access_token, data.expires_in);
        error.textContent = "";
        overlay.remove();
      })
      .catch(function(err) {
        error.textContent = "Credenciales incorrectas o error de conexion.";
        button.disabled = false;
        button.style.opacity = "1";
      });
    });
  }

  window.likestudioAdminLogout = function () {
    localStorage.removeItem(AUTH_KEY);
    // Don't reload - just show the auth gate
    mountAuthGate();
  };

  window.likestudioGetAuthToken = function () {
    return getToken();
  };

  window.likestudioIsAuthenticated = function () {
    return isAuthenticated();
  };

  // Mark auth as ready
  window.LIKESTUDIO_AUTH_READY = true;

  // Helper to wait for auth to be ready
  window.waitForAuth = function(timeout = 5000) {
    return new Promise((resolve) => {
      if (window.likestudioGetAuthToken && typeof window.likestudioGetAuthToken === 'function') {
        resolve();
        return;
      }
      
      const startTime = Date.now();
      const checkInterval = setInterval(() => {
        if (window.likestudioGetAuthToken && typeof window.likestudioGetAuthToken === 'function') {
          clearInterval(checkInterval);
          resolve();
        } else if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          console.warn('Auth not ready after timeout');
          resolve();
        }
      }, 50);
    });
  };

  // Mount auth gate when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountAuthGate);
  } else {
    mountAuthGate();
  }
})();

(function () {
  var AUTH_KEY = "likestudio_admin_auth_v2";
  var LEGACY_AUTH_KEY = "likestudio_admin_auth";
  var AUTH_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
  var USERNAME = "likestudio";
  var PASSWORD = "liegeJosemi2026";

  function now() {
    return Date.now();
  }

  function writeSession() {
    localStorage.setItem(
      AUTH_KEY,
      JSON.stringify({
        ok: true,
        expires_at: now() + AUTH_TTL_MS
      })
    );
  }

  function isAuthenticated() {
    var raw = localStorage.getItem(AUTH_KEY);
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.ok && Number(parsed.expires_at) > now()) {
          // Sliding expiration while admin is active.
          writeSession();
          return true;
        }
      } catch (e) {
        // Ignore malformed values and force re-auth.
      }
    }

    // One-time migration from old sessionStorage key.
    if (sessionStorage.getItem(LEGACY_AUTH_KEY) === "ok") {
      sessionStorage.removeItem(LEGACY_AUTH_KEY);
      writeSession();
      return true;
    }

    return false;
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

    var overlay = createOverlay();
    document.body.appendChild(overlay);

    var form = document.getElementById("admin-auth-form");
    var user = document.getElementById("admin-user");
    var pass = document.getElementById("admin-pass");
    var error = document.getElementById("admin-auth-error");

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (user.value === USERNAME && pass.value === PASSWORD) {
        writeSession();
        overlay.remove();
        return;
      }
      error.textContent = "Credenciales incorrectas.";
    });
  }

  window.likestudioAdminLogout = function () {
    localStorage.removeItem(AUTH_KEY);
    sessionStorage.removeItem(LEGACY_AUTH_KEY);
    window.location.reload();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountAuthGate);
  } else {
    mountAuthGate();
  }
})();

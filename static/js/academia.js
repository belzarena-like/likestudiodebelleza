/* academia.js — public student video viewer */
(function () {
  const API = (window.APP_CONFIG || {}).API_BASE_URL || "https://apis.listoapp.es/like_api";
  const SESSION_KEY = "likestudio_academy_session";

  let state = null; // { token, sessionId, fullName, expiresAt }
  


  // ── Restore session ────────────────────────────────────────────────────────
  function restoreSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (new Date(s.expiresAt) < new Date()) { sessionStorage.removeItem(SESSION_KEY); return null; }
      return s;
    } catch { return null; }
  }

  function saveSession(s) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
  }

  window.logout = function () {
    sessionStorage.removeItem(SESSION_KEY);
    location.reload();
  };

  // ── Login ──────────────────────────────────────────────────────────────────
  document.getElementById("login-form").addEventListener("submit", async e => {
    e.preventDefault();
    const btn = document.getElementById("login-btn");
    const errEl = document.getElementById("login-error");
    errEl.style.display = "none";
    btn.disabled = true;
    btn.textContent = "Entrando...";

    // Determine session_id from URL param or prompt
    const urlParams = new URLSearchParams(location.search);
    const sessionId = parseInt(urlParams.get("session") || urlParams.get("curso") || "0");
    if (!sessionId) {
      errEl.textContent = "URL inválida. Usa el enlace que te enviaron.";
      errEl.style.display = "block";
      btn.disabled = false;
      btn.textContent = "Entrar";
      return;
    }

    const body = new URLSearchParams({
      username: document.getElementById("login-username").value,
      password: document.getElementById("login-password").value,
      session_id: sessionId,
    });

    try {
      const res = await fetch(`${API}/academy/login`, { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        errEl.textContent = data.detail || "Credenciales incorrectas";
        errEl.style.display = "block";
        return;
      }
      state = { token: data.token, sessionId: data.session_id, fullName: data.full_name, expiresAt: data.access_expires_at };
      saveSession(state);
      showCourse();
    } catch {
      errEl.textContent = "Error de conexión. Inténtalo de nuevo.";
      errEl.style.display = "block";
    } finally {
      btn.disabled = false;
      btn.textContent = "Entrar";
    }
  });

  // ── Show course ────────────────────────────────────────────────────────────
  async function showCourse() {
    console.log("showCourse called, state:", state);
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("course-screen").style.display = "block";
    document.getElementById("user-info").style.display = "flex";
    document.getElementById("user-name-display").textContent = state.fullName;
    const exp = new Date(state.expiresAt);
    document.getElementById("expiry-display").textContent = "Acceso hasta " + exp.toLocaleDateString("es-ES");

    try {
      const res = await fetch(`${API}/academy/session/${state.sessionId}?token=${encodeURIComponent(state.token)}`);
      if (!res.ok) {
        const err = await res.json();
        alert(err.detail || "Error al cargar el curso");
        logout();
        return;
      }
      const course = await res.json();
      console.log("Course loaded:", course);
      
      document.getElementById("course-title-sidebar").textContent = course.title;
      document.getElementById("course-instructor-sidebar").textContent = "Instructor: " + course.instructor_name;

      const list = document.getElementById("video-list");
      const videoHtml = course.videos.map((v, i) => `
        <li class="video-list-item" data-vid="${v.id}" data-title="${esc(v.title)}" data-desc="${esc(v.description || "")}">
          <span class="item-num">${i + 1}</span>
          <div class="item-info">
            <div class="item-title">${esc(v.title)}</div>
            <div class="item-dur">${formatDuration(v.duration_seconds)}</div>
          </div>
        </li>
      `).join("");
      
      console.log("Video list HTML:", videoHtml);
      list.innerHTML = videoHtml;
      console.log("Video list rendered, items:", list.children.length);
      
      // Add click listeners after rendering
      list.querySelectorAll('.video-list-item').forEach(item => {
        item.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          const videoId = parseInt(this.dataset.vid);
          console.log("Video item clicked, calling playVideo with id:", videoId);
          playVideo(videoId, this);
          return false;
        });
      });
    } catch (error) {
      console.error("Error loading course:", error);
      alert("Error al cargar el curso");
      logout();
    }
  }

  // ── Play video ─────────────────────────────────────────────────────────────
  window.playVideo = async function (videoId, el) {
    console.log("playVideo called with videoId:", videoId, "element:", el);
    
    document.querySelectorAll(".video-list-item").forEach(i => i.classList.remove("active"));
    el.classList.add("active");

    const title = el.dataset.title;
    const desc = el.dataset.desc;

    document.getElementById("player-placeholder").style.display = "none";
    document.getElementById("player-container").style.display = "flex";
    document.getElementById("current-video-title").textContent = title;
    document.getElementById("current-video-desc").textContent = desc;

    const videoContainer = document.getElementById("video-iframe-container");

    try {
      // Get the S3 signed URL from backend
      const res = await fetch(`${API}/academy/video/${videoId}/stream-url?token=${encodeURIComponent(state.token)}`);
      if (!res.ok) {
        const err = await res.json();
        alert(err.detail || "No se pudo cargar el video");
        return false;
      }
      const { stream_url } = await res.json();
      
      console.log("Got S3 stream URL:", stream_url);
      
      // Stop and remove any existing video
      const existing = videoContainer.querySelector('video');
      if (existing) {
        existing.pause();
        existing.src = '';
      }
      videoContainer.innerHTML = '';
      
      // Create a native video element (not iframe!)
      const video = document.createElement('video');
      video.controls = true;
      video.autoplay = false; // Don't autoplay initially
      video.style.cssText = 'width:100%; height:100%; background:#000;';
      video.controlsList = 'nodownload noremoteplayback';
      video.disablePictureInPicture = true;
      video.oncontextmenu = e => e.preventDefault(); // block right-click
      
      console.log("Creating video element with S3 URL");
      videoContainer.appendChild(video);
      
      // Set src AFTER appending to DOM and wait for it to load
      video.src = stream_url;
      console.log("Video src set, waiting for load...");
      
      // Add event handlers for debugging
      video.onloadedmetadata = () => {
        console.log("Video metadata loaded, duration:", video.duration);
      };
      video.oncanplay = () => {
        console.log("Video can play, ready to start");
      };
      video.onerror = (e) => {
        console.error("Video error:", video.error);
        alert("Error al cargar el video");
      };
      
    } catch (error) {
      console.error("Error:", error);
      alert("Error al cargar el video: " + error.message);
    }
  };

  // ── Anti-download measures ─────────────────────────────────────────────────
  // Note: We can't prevent download from iframes easily
  // The iframe will handle its own context menu
  
  document.addEventListener("keydown", e => {
    // Block common save shortcuts
    if ((e.ctrlKey || e.metaKey) && ["s", "u"].includes(e.key.toLowerCase())) {
      e.preventDefault();
    }
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  function esc(str) {
    return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function formatDuration(secs) {
    if (!secs) return "";
    const m = Math.floor(secs / 60), s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  state = restoreSession();
  if (state) {
    showCourse();
  }
  // else login screen is shown by default
})();

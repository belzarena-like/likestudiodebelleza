/**
 * Academia Controller - Public student video viewer
 */

import { academyService } from '../../src/services/academy.service.js';
import { storage } from '../../src/core/storage.js';

class AcademiaController {
  constructor() {
    this.SESSION_KEY = 'likestudio_academy_session';
    this.state = null;
    
    this.initEventListeners();
    this.init();
  }

  initEventListeners() {
    // Login form
    document.getElementById('login-form').addEventListener('submit', (e) => this.handleLogin(e));
    
    // Logout button
    window.logout = () => this.logout();
    
    // Anti-download measures
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && ['s', 'u'].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    });
  }

  // ── Session Management ─────────────────────────────────────────────────────

  restoreSession() {
    try {
      const raw = sessionStorage.getItem(this.SESSION_KEY);
      if (!raw) return null;
      
      const session = JSON.parse(raw);
      if (new Date(session.expiresAt) < new Date()) {
        sessionStorage.removeItem(this.SESSION_KEY);
        return null;
      }
      
      return session;
    } catch {
      return null;
    }
  }

  saveSession(session) {
    sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
  }

  logout() {
    sessionStorage.removeItem(this.SESSION_KEY);
    location.reload();
  }

  // ── Login ──────────────────────────────────────────────────────────────────

  async handleLogin(e) {
    e.preventDefault();
    
    const btn = document.getElementById('login-btn');
    const errEl = document.getElementById('login-error');
    
    errEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Entrando...';

    // Get session ID from URL
    const urlParams = new URLSearchParams(location.search);
    const sessionId = parseInt(urlParams.get('session') || urlParams.get('curso') || '0');
    
    if (!sessionId) {
      errEl.textContent = 'URL inválida. Usa el enlace que te enviaron.';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Entrar';
      return;
    }

    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    try {
      const data = await academyService.login(username, password, sessionId);
      
      this.state = {
        token: data.token,
        sessionId: data.session_id,
        fullName: data.full_name,
        expiresAt: data.access_expires_at
      };
      
      this.saveSession(this.state);
      this.showCourse();
    } catch (error) {
      errEl.textContent = error.message || 'Credenciales incorrectas';
      errEl.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Entrar';
    }
  }

  // ── Course Display ─────────────────────────────────────────────────────────

  async showCourse() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('course-screen').style.display = 'block';
    document.getElementById('user-info').style.display = 'flex';
    document.getElementById('user-name-display').textContent = this.state.fullName;
    
    const exp = new Date(this.state.expiresAt);
    document.getElementById('expiry-display').textContent = 
      'Acceso hasta ' + exp.toLocaleDateString('es-ES');

    try {
      const course = await academyService.getSession(this.state.sessionId, this.state.token);
      
      document.getElementById('course-title-sidebar').textContent = course.title;
      document.getElementById('course-instructor-sidebar').textContent = 
        'Instructor: ' + course.instructor_name;

      this.renderVideoList(course.videos);
    } catch (error) {
      alert(error.message || 'Error al cargar el curso');
      this.logout();
    }
  }

  renderVideoList(videos) {
    const list = document.getElementById('video-list');
    
    const videoHtml = videos.map((v, i) => `
      <li class="video-list-item" data-vid="${v.id}" data-title="${this.esc(v.title)}" data-desc="${this.esc(v.description || '')}">
        <span class="item-num">${i + 1}</span>
        <div class="item-info">
          <div class="item-title">${this.esc(v.title)}</div>
          <div class="item-dur">${this.formatDuration(v.duration_seconds)}</div>
        </div>
      </li>
    `).join('');
    
    list.innerHTML = videoHtml;
    
    // Add click listeners
    list.querySelectorAll('.video-list-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const videoId = parseInt(item.dataset.vid);
        this.playVideo(videoId, item);
      });
    });
  }

  // ── Video Playback ─────────────────────────────────────────────────────────

  async playVideo(videoId, el) {
    // Update active state
    document.querySelectorAll('.video-list-item').forEach(i => i.classList.remove('active'));
    el.classList.add('active');

    const title = el.dataset.title;
    const desc = el.dataset.desc;

    // Show player
    document.getElementById('player-placeholder').style.display = 'none';
    document.getElementById('player-container').style.display = 'flex';
    document.getElementById('current-video-title').textContent = title;
    document.getElementById('current-video-desc').textContent = desc;

    const videoContainer = document.getElementById('video-iframe-container');

    try {
      // Get signed URL
      const { stream_url } = await academyService.getVideoStreamUrl(videoId, this.state.token);
      
      // Stop existing video
      const existing = videoContainer.querySelector('video');
      if (existing) {
        existing.pause();
        existing.src = '';
      }
      videoContainer.innerHTML = '';
      
      // Create video element
      const video = document.createElement('video');
      video.controls = true;
      video.autoplay = false;
      video.style.cssText = 'width:100%; height:100%; background:#000;';
      video.controlsList = 'nodownload noremoteplayback';
      video.disablePictureInPicture = true;
      video.oncontextmenu = e => e.preventDefault();
      
      videoContainer.appendChild(video);
      video.src = stream_url;
      
      // Event handlers
      video.onloadedmetadata = () => console.log('Video loaded');
      video.onerror = () => alert('Error al cargar el video');
      
    } catch (error) {
      alert('Error al cargar el video: ' + error.message);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  formatDuration(secs) {
    if (!secs) return '';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  // ── Initialization ─────────────────────────────────────────────────────────

  init() {
    this.state = this.restoreSession();
    if (this.state) {
      this.showCourse();
    }
    // else login screen is shown by default
  }
}

// Initialize controller
new AcademiaController();

/**
 * Training Controller - Refactored to use clean architecture
 */

import { trainingService } from '../../src/services/training.service.js';
import { Toast } from '../../src/ui/components/toast.js';
import { Loading } from '../../src/ui/components/loading.js';
import { Modal } from '../../src/ui/components/modal.js';
import { formatBytes, formatDuration } from '../../src/core/utils.js';

class TrainingController {
  constructor() {
    this.currentCourseId = null;
    this.allVideos = [];

    this.initEventListeners();
    this.loadCourses();
    this.loadVideos();
  }

  initEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab + '-tab').classList.add('active');
        
        if (btn.dataset.tab === 'videos') this.loadVideos();
        if (btn.dataset.tab === 'sessions') this.loadCourses();
        if (btn.dataset.tab === 'users') this.loadAllUsers();
      });
    });

    // Course creation
    document.getElementById('create-course-btn').addEventListener('click', () => {
      new Modal('course-modal').show();
    });

    document.getElementById('course-form').addEventListener('submit', (e) => this.handleCreateCourse(e));

    // Video upload
    this.setupVideoUpload();

    // Video metadata form
    document.getElementById('video-meta-form').addEventListener('submit', (e) => this.handleVideoMetadata(e));

    // Add video to course
    document.getElementById('add-video-to-course-btn').addEventListener('click', () => this.addVideoToCourse());

    // User management
    document.getElementById('add-user-btn').addEventListener('click', () => this.showAddUserModal());
    document.getElementById('user-form').addEventListener('submit', (e) => this.handleCreateUser(e));
    document.getElementById('users-course-filter').addEventListener('change', (e) => {
      if (e.target.value) {
        this.loadUsersForCourse(parseInt(e.target.value));
      } else {
        document.getElementById('users-list').innerHTML = '<p class="empty-state">Selecciona un curso.</p>';
      }
    });

    // Global functions for onclick handlers
    window.openCourseDetail = (id) => this.openCourseDetail(id);
    window.manageCourseUsers = (id, title) => this.manageCourseUsers(id, title);
    window.toggleCourse = (id, active) => this.toggleCourse(id, active);
    window.copyCourseUrl = (id) => this.copyCourseUrl(id);
    window.removeVideoFromCourse = (sessionId, videoId) => this.removeVideoFromCourse(sessionId, videoId);
    window.deleteVideo = (id) => this.deleteVideo(id);
    window.extendUser = (accessId, sessionId) => this.extendUser(accessId, sessionId);
    window.resetPassword = (accessId) => this.resetPassword(accessId);
    window.deleteUser = (accessId, sessionId) => this.deleteUser(accessId, sessionId);
    window.closeModal = (id) => Modal.close(id);
  }

  // ── Courses ────────────────────────────────────────────────────────────────
  async loadCourses() {
    try {
      const search = document.getElementById('search-courses').value;
      const category = document.getElementById('category-filter').value;
      
      const filters = { limit: 100 };
      if (search) filters.query = search;
      if (category) filters.category = category;

      const data = await trainingService.listSessions(search, category, 100);
      this.renderCourses(data.items || []);
    } catch (error) {
      Toast.error('Error al cargar cursos');
    }
  }

  renderCourses(courses) {
    const el = document.getElementById('courses-list');
    if (!courses.length) {
      el.innerHTML = '<p class="empty-state">No hay cursos. Crea el primero.</p>';
      return;
    }

    el.innerHTML = courses.map(c => {
      const duration = c.total_duration_minutes > 0 
        ? `${c.total_duration_minutes} min` 
        : 'Sin videos';
      
      return `
      <div class="course-card" data-id="${c.id}">
        <div class="course-card-header">
          <h3>${this.esc(c.title)}</h3>
          <span class="status-badge ${c.is_active ? 'status-active' : 'status-inactive'}">
            ${c.is_active ? 'Activo' : 'Inactivo'}
          </span>
        </div>
        <p class="course-desc">${this.esc(c.description || '')}</p>
        <div class="course-meta">
          <span>👤 ${this.esc(c.instructor_name)}</span>
          <span>📂 ${this.esc(c.category)}</span>
          <span>⏱ ${duration}</span>
          <span>📅 Acceso: ${c.access_expiry_days} días</span>
        </div>
        <div class="course-actions">
          <button class="btn btn-secondary btn-sm" onclick="openCourseDetail(${c.id})">Ver / Editar</button>
          <button class="btn btn-secondary btn-sm" onclick="manageCourseUsers(${c.id}, '${this.esc(c.title)}')">Usuarios</button>
          <button class="btn btn-secondary btn-sm" onclick="copyCourseUrl(${c.id})">📋 Copiar URL</button>
          <button class="btn btn-danger btn-sm" onclick="toggleCourse(${c.id}, ${!c.is_active})">
            ${c.is_active ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      </div>
    `;
    }).join('');
  }

  async openCourseDetail(id) {
    try {
      this.currentCourseId = id;
      
      // Load videos if not already loaded
      if (!this.allVideos || this.allVideos.length === 0) {
        await this.loadVideos();
      }
      
      const course = await trainingService.getSession(id);
      this.showCourseDetailModal(course);
    } catch (error) {
      Toast.error('Error al cargar detalles del curso');
    }
  }

  showCourseDetailModal(course) {
    document.getElementById('detail-title').textContent = course.title;
    document.getElementById('detail-instructor').textContent = course.instructor_name;
    document.getElementById('detail-category').textContent = course.category;
    document.getElementById('detail-expiry').textContent = course.access_expiry_days + ' días';
    document.getElementById('detail-users').textContent = course.user_access_count;
    document.getElementById('detail-active-users').textContent = course.active_users;

    const videoList = document.getElementById('detail-videos');
    if (!course.videos.length) {
      videoList.innerHTML = '<p class="empty-state">Sin videos. Añade desde la biblioteca.</p>';
    } else {
      videoList.innerHTML = course.videos.map((v, i) => `
        <div class="detail-video-row" data-vid="${v.id}">
          <span class="drag-handle">⠿</span>
          <span class="video-order">${i + 1}</span>
          <span class="video-title">${this.esc(v.title)}</span>
          <span class="video-dur">${formatDuration(v.duration_seconds)}</span>
          <button class="btn btn-danger btn-sm" onclick="removeVideoFromCourse(${this.currentCourseId}, ${v.id})">✕</button>
        </div>
      `).join('');
    }

    // Populate video picker
    const picker = document.getElementById('video-picker');
    if (!this.allVideos || this.allVideos.length === 0) {
      picker.innerHTML = '<option value="">No hay videos disponibles</option>';
    } else {
      picker.innerHTML = '<option value="">Selecciona un video...</option>' + 
        this.allVideos.map(v =>
          `<option value="${v.id}">${this.esc(v.title)} (${formatDuration(v.duration_seconds)})</option>`
        ).join('');
    }

    new Modal('course-detail-modal').show();
  }

  async removeVideoFromCourse(sessionId, videoId) {
    if (!confirm('¿Quitar este video del curso?')) return;
    
    try {
      await trainingService.removeVideoFromSession(sessionId, videoId);
      Toast.success('Video eliminado del curso');
      this.openCourseDetail(sessionId);
    } catch (error) {
      Toast.error('Error al eliminar video del curso');
    }
  }

  async addVideoToCourse() {
    const picker = document.getElementById('video-picker');
    const videoId = parseInt(picker.value);
    
    if (!videoId || isNaN(videoId)) {
      Toast.error('Selecciona un video');
      return;
    }

    try {
      Loading.show('Añadiendo video...');
      const order = document.querySelectorAll('#detail-videos .detail-video-row').length;
      await trainingService.addVideoToSession(this.currentCourseId, videoId, order);
      Toast.success('Video añadido al curso');
      await this.openCourseDetail(this.currentCourseId);
    } catch (error) {
      Toast.error(error.message || 'Error al añadir video al curso');
    } finally {
      Loading.hide();
    }
  }

  async toggleCourse(id, active) {
    try {
      await trainingService.updateSession(id, { is_active: active });
      Toast.success(active ? 'Curso activado' : 'Curso desactivado');
      this.loadCourses();
    } catch (error) {
      Toast.error('Error al actualizar curso');
    }
  }

  copyCourseUrl(id) {
    const url = `${window.location.origin}/academia.html?session=${id}`;
    navigator.clipboard.writeText(url).then(() => {
      Toast.success('URL copiada al portapapeles');
    }).catch(() => {
      // Fallback for older browsers
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      Toast.success('URL copiada al portapapeles');
    });
  }

  async handleCreateCourse(e) {
    e.preventDefault();
    
    const payload = {
      title: document.getElementById('course-title').value,
      description: document.getElementById('course-description').value,
      instructor_name: document.getElementById('course-instructor').value,
      category: document.getElementById('course-category').value,
      access_expiry_days: parseInt(document.getElementById('course-duration').value),
      difficulty_level: document.getElementById('course-difficulty').value,
      is_active: true,
    };

    try {
      Loading.show('Creando curso...');
      await trainingService.createSession(payload);
      Toast.success('Curso creado');
      Modal.close('course-modal');
      e.target.reset();
      this.loadCourses();
    } catch (error) {
      Toast.error(error.message || 'No se pudo crear el curso');
    } finally {
      Loading.hide();
    }
  }

  // ── Videos ─────────────────────────────────────────────────────────────────
  async loadVideos() {
    try {
      this.allVideos = await trainingService.listVideos(null, 200);
      this.renderVideos(this.allVideos);
    } catch (error) {
      Toast.error('Error al cargar videos');
    }
  }

  renderVideos(videos) {
    const el = document.getElementById('videos-grid');
    if (!videos.length) {
      el.innerHTML = '<p class="empty-state">No hay videos. Sube el primero.</p>';
      return;
    }

    el.innerHTML = videos.map(v => `
      <div class="video-card">
        <div class="video-thumbnail">🎬</div>
        <div class="video-info">
          <h4>${this.esc(v.title)}</h4>
          <p class="text-sm text-muted">${this.esc(v.description || '')}</p>
          <div class="video-meta">
            <span>${formatDuration(v.duration_seconds)}</span>
            <span>${formatBytes(v.file_size_bytes)}</span>
          </div>
          <div class="course-actions mt-2">
            <button class="btn btn-danger btn-sm" onclick="deleteVideo(${v.id})">Eliminar</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  async deleteVideo(id) {
    if (!confirm('¿Eliminar este video? Se borrará de S3 también.')) return;
    
    try {
      Loading.show('Eliminando video...');
      await trainingService.deleteVideo(id);
      Toast.success('Video eliminado');
      this.loadVideos();
    } catch (error) {
      Toast.error('Error al eliminar video');
    } finally {
      Loading.hide();
    }
  }

  setupVideoUpload() {
    const uploadZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('video-upload');

    uploadZone.addEventListener('click', () => fileInput.click());
    uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadZone.classList.add('dragover');
    });
    uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadZone.classList.remove('dragover');
      if (e.dataTransfer.files[0]) this.handleUpload(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) this.handleUpload(fileInput.files[0]);
    });
  }

  async handleUpload(file) {
    const progress = document.getElementById('upload-progress');
    const fill = document.getElementById('progress-bar-fill');
    const text = document.getElementById('progress-text');
    
    progress.style.display = 'block';
    fill.style.width = '0%';
    text.textContent = 'Obteniendo URL de subida...';

    try {
      // Get pre-signed URL
      const uploadData = await trainingService.getUploadUrl(file.name, file.type || 'video/mp4');

      // Upload to S3 with the content_type from the response
      text.textContent = 'Subiendo...';
      await trainingService.uploadToS3(
        uploadData.upload_url, 
        file, 
        uploadData.content_type,
        (progress) => {
          fill.style.width = progress + '%';
          text.textContent = progress + '%';
        }
      );

      // Show metadata form
      text.textContent = 'Subida completa. Completa los datos del video.';
      this.showVideoMetaForm(file.name, uploadData.s3_key, uploadData.s3_bucket, file.size, file.type);
    } catch (error) {
      console.error('Upload error:', error);
      Toast.error('Error al subir video: ' + error.message);
      progress.style.display = 'none';
    }
  }

  showVideoMetaForm(filename, s3Key, s3Bucket, fileSize, mimeType) {
    document.getElementById('vmeta-filename').value = filename;
    document.getElementById('vmeta-s3key').value = s3Key;
    document.getElementById('vmeta-s3bucket').value = s3Bucket;
    document.getElementById('vmeta-filesize').value = fileSize;
    document.getElementById('vmeta-mimetype').value = mimeType || 'video/mp4';
    document.getElementById('vmeta-title').value = filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
    
    new Modal('video-meta-modal').show();
  }

  async handleVideoMetadata(e) {
    e.preventDefault();
    
    const payload = {
      title: document.getElementById('vmeta-title').value,
      description: document.getElementById('vmeta-description').value,
      filename: document.getElementById('vmeta-filename').value,
      s3_key: document.getElementById('vmeta-s3key').value,
      s3_bucket: document.getElementById('vmeta-s3bucket').value,
      file_size_bytes: parseInt(document.getElementById('vmeta-filesize').value) || null,
      mime_type: document.getElementById('vmeta-mimetype').value,
      duration_seconds: parseInt(document.getElementById('vmeta-duration').value) || null,
      is_public: true,
    };

    try {
      Loading.show('Registrando video...');
      await trainingService.createVideo(payload);
      Toast.success('Video registrado');
      Modal.close('video-meta-modal');
      document.getElementById('upload-progress').style.display = 'none';
      this.loadVideos();
      document.querySelector('[data-tab="videos"]').click();
    } catch (error) {
      Toast.error('Error al registrar el video');
    } finally {
      Loading.hide();
    }
  }

  // ── Users ──────────────────────────────────────────────────────────────────
  async loadAllUsers() {
    try {
      const data = await trainingService.listSessions(null, null, 200);
      const sel = document.getElementById('users-course-filter');
      sel.innerHTML = '<option value="">Todos los cursos</option>' +
        (data.items || []).map(c => `<option value="${c.id}">${this.esc(c.title)}</option>`).join('');
    } catch (error) {
      Toast.error('Error al cargar cursos');
    }
  }

  async manageCourseUsers(sessionId, title) {
    document.querySelector('[data-tab="users"]').click();
    await this.loadAllUsers();
    document.getElementById('users-course-filter').value = sessionId;
    this.loadUsersForCourse(sessionId);
  }

  async loadUsersForCourse(sessionId) {
    try {
      const data = await trainingService.listSessionUsers(sessionId, 200);
      this.renderUsers(data.items || [], sessionId);
    } catch (error) {
      Toast.error('Error al cargar usuarios');
    }
  }

  renderUsers(users, sessionId) {
    const el = document.getElementById('users-list');
    if (!users.length) {
      el.innerHTML = '<p class="empty-state">Sin usuarios. Añade el primero.</p>';
      return;
    }

    const now = new Date();
    el.innerHTML = users.map(u => {
      const expires = new Date(u.access_expires_at);
      const expired = expires < now;
      
      return `
        <div class="user-card">
          <div class="user-info">
            <h4>${this.esc(u.full_name)} <small class="text-muted">@${this.esc(u.username)}</small></h4>
            <div class="user-meta">
              ${u.email ? `📧 ${this.esc(u.email)} · ` : ''}
              Expira: ${expires.toLocaleDateString('es-ES')}
              ${expired ? '<span class="status-badge status-inactive">Expirado</span>' : '<span class="status-badge status-active">Activo</span>'}
              · Accesos: ${u.access_count}
              ${u.last_access_at ? `· Último: ${new Date(u.last_access_at).toLocaleDateString('es-ES')}` : ''}
            </div>
          </div>
          <div class="user-actions">
            <button class="btn btn-secondary btn-sm" onclick="extendUser(${u.id}, ${sessionId})">+30 días</button>
            <button class="btn btn-secondary btn-sm" onclick="resetPassword(${u.id})">Nueva clave</button>
            <button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id}, ${sessionId})">Eliminar</button>
          </div>
        </div>
      `;
    }).join('');
  }

  async extendUser(accessId, sessionId) {
    try {
      await trainingService.extendUserAccess(accessId, 30);
      Toast.success('Acceso extendido');
      this.loadUsersForCourse(sessionId);
    } catch (error) {
      Toast.error('Error al extender acceso');
    }
  }

  async resetPassword(accessId) {
    const pwd = prompt('Nueva contraseña (mínimo 6 caracteres):');
    if (!pwd || pwd.length < 6) return;

    try {
      await trainingService.resetUserPassword(accessId, pwd);
      Toast.success('Contraseña actualizada');
    } catch (error) {
      Toast.error('Error al actualizar contraseña');
    }
  }

  async deleteUser(accessId, sessionId) {
    if (!confirm('¿Eliminar acceso de este usuario?')) return;

    try {
      await trainingService.deleteUserAccess(accessId);
      Toast.success('Usuario eliminado');
      this.loadUsersForCourse(sessionId);
    } catch (error) {
      Toast.error('Error al eliminar usuario');
    }
  }

  showAddUserModal() {
    const sessionId = document.getElementById('users-course-filter').value;
    if (!sessionId) {
      Toast.error('Selecciona un curso primero');
      return;
    }
    
    document.getElementById('new-user-session-id').value = sessionId;
    new Modal('user-modal').show();
  }

  async handleCreateUser(e) {
    e.preventDefault();
    
    const username = document.getElementById('user-username').value.trim();
    const password = document.getElementById('user-password').value;
    
    // Validate username length (backend requires min 3 chars)
    if (username.length < 3) {
      Toast.error('El usuario debe tener al menos 3 caracteres');
      return;
    }
    
    // Validate password length (bcrypt limit is 72 bytes)
    if (password.length < 3) {
      Toast.error('La contraseña debe tener al menos 3 caracteres');
      return;
    }
    
    const passwordBytes = new TextEncoder().encode(password).length;
    if (passwordBytes > 72) {
      Toast.error('La contraseña es demasiado larga (máximo 72 bytes)');
      return;
    }
    
    const sessionId = parseInt(document.getElementById('new-user-session-id').value);
    const payload = {
      training_session_id: sessionId,
      username: username,
      password: password,
      full_name: document.getElementById('user-fullname').value,
      email: document.getElementById('user-email').value || null,
      access_days: parseInt(document.getElementById('user-days').value) || 30,
    };

    try {
      Loading.show('Creando usuario...');
      await trainingService.createUserAccess(sessionId, payload);
      Toast.success('Usuario creado');
      Modal.close('user-modal');
      e.target.reset();
      this.loadUsersForCourse(sessionId);
    } catch (error) {
      Toast.error(error.message || 'No se pudo crear el usuario');
    } finally {
      Loading.hide();
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
}

// Initialize controller
new TrainingController();

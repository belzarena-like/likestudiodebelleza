/**
 * Videos Controller - Dedicated page for video management
 */

import { trainingService } from '../../src/services/training.service.js';
import { Toast } from '../../src/ui/components/toast.js';
import { Loading } from '../../src/ui/components/loading.js';
import { Modal } from '../../src/ui/components/modal.js';
import { formatBytes, formatDuration } from '../../src/core/utils.js';

class VideosController {
  constructor() {
    this.allVideos = [];
    this.initEventListeners();
    this.loadVideos();
  }

  initEventListeners() {
    // Upload button
    document.getElementById('upload-video-btn').addEventListener('click', () => {
      const section = document.getElementById('upload-section');
      section.style.display = section.style.display === 'none' ? 'block' : 'none';
    });

    // Video upload
    this.setupVideoUpload();

    // Video metadata form
    document.getElementById('video-meta-form').addEventListener('submit', (e) => this.handleVideoMetadata(e));

    // Global functions for onclick handlers
    window.deleteVideo = (id) => this.deleteVideo(id);
    window.closeModal = (id) => Modal.close(id);
  }

  // ── Videos ─────────────────────────────────────────────────────────────────
  async loadVideos() {
    try {
      Loading.show('Cargando videos...');
      this.allVideos = await trainingService.listVideos(null, 200);
      this.renderVideos(this.allVideos);
    } catch (error) {
      Toast.error('Error al cargar videos');
    } finally {
      Loading.hide();
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

      // Upload to S3 with the exact content type from the presigned URL
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
      document.getElementById('upload-section').style.display = 'none';
      this.loadVideos();
    } catch (error) {
      Toast.error('Error al registrar el video');
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
new VideosController();

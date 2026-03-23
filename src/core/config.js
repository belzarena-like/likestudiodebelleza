/**
 * Application Configuration
 */

export const config = {
  // API Configuration
  api: {
    baseURL: window.APP_CONFIG?.API_BASE_URL || 'https://apis.listoapp.es/like_api',
    timeout: 30000, // 30 seconds
  },

  // Storage keys
  storage: {
    authToken: 'academy_token',
    userInfo: 'academy_user',
    adminAuth: 'admin_auth',
  },

  // Pagination defaults
  pagination: {
    defaultLimit: 50,
    maxLimit: 200,
  },

  // Date/Time formats
  formats: {
    date: 'es-ES',
    dateOptions: { year: 'numeric', month: '2-digit', day: '2-digit' },
    time: 'HH:mm',
  },

  // File upload
  upload: {
    maxFileSize: 500 * 1024 * 1024, // 500MB
    allowedVideoTypes: ['video/mp4', 'video/webm', 'video/ogg'],
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif'],
  },

  // UI Configuration
  ui: {
    toastDuration: 3000, // 3 seconds
    modalAnimationDuration: 300, // 300ms
  },
};

export default config;

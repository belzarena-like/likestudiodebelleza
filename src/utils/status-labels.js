/**
 * Status Labels Utility - Centralized status translations and styling
 */

export const StatusLabels = {
  // Appointment statuses
  scheduled: 'Programada',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_show: 'No asistió',
  
  // Session statuses
  planned: 'Planificada',
  in_progress: 'En progreso',
  
  // Generic fallback
  active: 'Activa',
  inactive: 'Inactiva',
};

export const StatusClasses = {
  // Appointment statuses
  scheduled: 'badge-scheduled',
  completed: 'badge-completed',
  cancelled: 'badge-cancelled',
  no_show: 'badge-cancelled',
  
  // Session statuses
  planned: 'badge-planned',
  in_progress: 'badge-warning',
  
  // Generic fallback
  active: 'badge-success',
  inactive: 'badge-secondary',
};

/**
 * Get translated label for a status
 * @param {string} status - The status key
 * @returns {string} Translated label
 */
export function getStatusLabel(status) {
  if (!status) return '—';
  const normalized = String(status).toLowerCase().replace(/\s+/g, '_');
  return StatusLabels[normalized] || status;
}

/**
 * Get CSS class for a status badge
 * @param {string} status - The status key
 * @returns {string} CSS class name
 */
export function getStatusClass(status) {
  if (!status) return 'badge-secondary';
  const normalized = String(status).toLowerCase().replace(/\s+/g, '_');
  return StatusClasses[normalized] || 'badge-secondary';
}

/**
 * Render a status badge with proper styling and translation
 * @param {string} status - The status key
 * @returns {string} HTML string for the badge
 */
export function renderStatusBadge(status) {
  const label = getStatusLabel(status);
  const cssClass = getStatusClass(status);
  return `<span class="history-item-badge ${cssClass}">${label}</span>`;
}

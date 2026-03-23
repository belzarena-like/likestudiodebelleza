/**
 * Migration Helper - Makes new services/components available globally
 * 
 * Usage: Add this to your HTML before loading old scripts:
 * <script type="module" src="../src/migration-helper.js"></script>
 */

// Import everything
import { apiClient } from './core/api-client.js';
import { config } from './core/config.js';
import * as utils from './core/utils.js';
import { localStorage, sessionStorage } from './core/storage.js';

import { trainingService } from './services/training.service.js';
import { clientService } from './services/client.service.js';
import { appointmentService } from './services/appointment.service.js';
import { sessionService } from './services/session.service.js';
import { serviceService } from './services/service.service.js';
import { consentService } from './services/consent.service.js';
import { workingHoursService } from './services/working-hours.service.js';

import { Toast } from './ui/components/toast.js';
import { Modal } from './ui/components/modal.js';
import { Loading } from './ui/components/loading.js';
import { Table } from './ui/components/table.js';
import { Form } from './ui/components/form.js';

// Make everything available globally for old code
window.LikeStudio = {
  // Core
  apiClient,
  config,
  utils,
  storage: { local: localStorage, session: sessionStorage },
  
  // Services
  services: {
    training: trainingService,
    client: clientService,
    appointment: appointmentService,
    session: sessionService,
    service: serviceService,
    consent: consentService,
    workingHours: workingHoursService,
  },
  
  // Components
  Toast,
  Modal,
  Loading,
  Table,
  Form,
};

// Also make components available directly
window.Toast = Toast;
window.Loading = Loading;

console.log('✅ LikeStudio refactored architecture loaded!');
console.log('📦 Available: window.LikeStudio.services, window.Toast, window.Loading');

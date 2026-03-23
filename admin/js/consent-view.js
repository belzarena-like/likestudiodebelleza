/**
 * Consent View Controller - Refactored to use clean architecture
 */

import { consentService } from '../../src/services/consent.service.js';
import { Toast } from '../../src/ui/components/toast.js';
import { Loading } from '../../src/ui/components/loading.js';

class ConsentViewController {
  constructor() {
    this.TYPE_MAP = {
      micropigmentation: 'Micropigmentacion',
      micropigmentation_capilar: 'Micropigmentacion capilar',
      aesthetic_treatment: 'Tratamiento estetico',
      laser: 'Laser',
    };

    this.loadDetail();
  }

  textOrDash(value) {
    return value ? String(value) : '—';
  }

  translateFieldName(key) {
    // Translation map for common field names
    const translations = {
      // Payment fields
      'total_amount': 'Importe Total',
      'reserve_amount': 'Importe Reserva',
      'payment_terms': 'Condiciones de Pago',
      'payments': 'Pagos',
      'sessions': 'Sesiones',
      'session_price': 'Precio por Sesión',
      'deposit': 'Depósito',
      'balance': 'Saldo',
      'paid_amount': 'Importe Pagado',
      'remaining_amount': 'Importe Pendiente',
      
      // Medical fields
      'conditions': 'Condiciones Médicas',
      'allergies': 'Alergias',
      'medications': 'Medicamentos',
      'medical_history': 'Historial Médico',
      'skin_type': 'Tipo de Piel',
      'previous_treatments': 'Tratamientos Previos',
      'contraindications': 'Contraindicaciones',
      'pregnancy': 'Embarazo',
      'breastfeeding': 'Lactancia',
      'diabetes': 'Diabetes',
      'hypertension': 'Hipertensión',
      'heart_disease': 'Enfermedad Cardíaca',
      'blood_disorders': 'Trastornos Sanguíneos',
      'keloid_tendency': 'Tendencia a Queloides',
      'photosensitivity': 'Fotosensibilidad',
      
      // Lifestyle fields
      'lifestyle': 'Estilo de Vida',
      'sleep_quality': 'Calidad del Sueño',
      'smoking': 'Fumador',
      'alcohol': 'Alcohol',
      'sports': 'Deportes',
      'exercise': 'Ejercicio',
      'diet': 'Dieta',
      'stress_level': 'Nivel de Estrés',
      'water_intake': 'Consumo de Agua',
      
      // Lifestyle values
      'sedentary': 'Sedentario',
      'active': 'Activo',
      'very_active': 'Muy Activo',
      'good': 'Bueno',
      'bad': 'Malo',
      'regular': 'Regular',
      'yes': 'Sí',
      'no': 'No',
      
      // Policy fields
      'appointment_policy_accepted': 'Política de Citas Aceptada',
      'privacy_policy_accepted': 'Política de Privacidad Aceptada',
      'terms_accepted': 'Términos Aceptados',
      'consent_given': 'Consentimiento Otorgado',
      
      // Treatment fields
      'treatment_area': 'Área de Tratamiento',
      'treatment_type': 'Tipo de Tratamiento',
      'treatment_date': 'Fecha de Tratamiento',
      'duration': 'Duración',
      'frequency': 'Frecuencia',
      'notes': 'Notas',
      'observations': 'Observaciones',
      'comments': 'Comentarios',
      
      // Client fields
      'full_name': 'Nombre Completo',
      'phone': 'Teléfono',
      'email': 'Correo Electrónico',
      'address': 'Dirección',
      'birth_date': 'Fecha de Nacimiento',
      'age': 'Edad',
      
      // Other common fields
      'date': 'Fecha',
      'time': 'Hora',
      'status': 'Estado',
      'active': 'Activo',
      'inactive': 'Inactivo',
      'completed': 'Completado',
      'pending': 'Pendiente',
      'cancelled': 'Cancelado',
    };
    
    return translations[key.toLowerCase()] || key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  translateValue(value) {
    // Translation map for common values
    const translations = {
      'true': 'Sí',
      'false': 'No',
      'yes': 'Sí',
      'no': 'No',
      'sedentary': 'Sedentario',
      'active': 'Activo',
      'very_active': 'Muy Activo',
      'good': 'Bueno',
      'bad': 'Malo',
      'regular': 'Regular',
      'excellent': 'Excelente',
      'poor': 'Pobre',
      'gym': 'Gimnasio',
      'running': 'Correr',
      'swimming': 'Natación',
      'cycling': 'Ciclismo',
      'yoga': 'Yoga',
      'none': 'Ninguno',
    };
    
    const strValue = String(value).toLowerCase();
    return translations[strValue] || value;
  }

  formatJsonField(value) {
    if (!value) return '—';
    
    // Try to parse as JSON
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value;
      
      // If it's an object, format it nicely
      if (typeof parsed === 'object' && parsed !== null) {
        return Object.entries(parsed)
          .filter(([_, v]) => v !== null && v !== undefined && v !== '')
          .map(([key, val]) => {
            // Translate the key to Spanish
            const translatedKey = this.translateFieldName(key);
            
            // Format the value
            let formattedVal = val;
            
            // Handle arrays
            if (Array.isArray(val)) {
              if (val.length === 0) {
                formattedVal = 'Ninguno';
              } else {
                formattedVal = val.map(v => this.translateValue(v)).join(', ');
              }
            }
            // Handle booleans
            else if (typeof val === 'boolean') {
              formattedVal = val ? 'Sí' : 'No';
            }
            // Handle objects
            else if (typeof val === 'object' && val !== null) {
              formattedVal = JSON.stringify(val, null, 2);
            }
            // Handle strings and numbers
            else {
              formattedVal = this.translateValue(val);
            }
            
            return `${translatedKey}: ${formattedVal}`;
          })
          .join('\n');
      }
      
      return String(value);
    } catch (e) {
      // If it's not JSON, return as is
      return String(value);
    }
  }

  clientIdLabel(value) {
    const id = String(value || '');
    return id.startsWith('NO-DOC-') ? '—' : this.textOrDash(id);
  }

  typeLabel(value) {
    return this.TYPE_MAP[value] || value;
  }

  printTemplatePath(consent) {
    if (consent.consent_type === 'micropigmentation') {
      const area = String(consent.treatment_areas || '').toLowerCase();
      return area.startsWith('micropigmentacion capilar - condiciones')
        ? 'consent-capilar-condiciones.html'
        : 'consent-micropigmentacion.html';
    }
    if (consent.consent_type === 'micropigmentation_capilar') {
      return 'consent-capilar-condiciones.html';
    }
    if (consent.consent_type === 'aesthetic_treatment') {
      return 'consent-estetico.html';
    }
    if (consent.consent_type === 'laser') {
      return String(consent.treatment_areas || '').toLowerCase().startsWith('eliminacion tatuaje')
        ? 'consent-eliminacion-laser.html'
        : 'consent-laser.html';
    }
    return null;
  }

  async loadDetail() {
    const loading = document.getElementById('loading');
    const content = document.getElementById('content');
    
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    
    if (!id) {
      loading.textContent = 'Falta el id del consentimiento';
      Toast.error('Falta el id del consentimiento');
      return;
    }

    try {
      Loading.show('Cargando consentimiento...');
      
      const consent = await consentService.getConsent(id);
      
      this.renderConsent(consent);
      
      loading.style.display = 'none';
      content.style.display = 'block';
      
      Loading.hide();
    } catch (error) {
      loading.textContent = error.message || 'No se pudo cargar el consentimiento';
      Toast.error('No se pudo cargar el consentimiento');
      Loading.hide();
    }
  }

  renderConsent(consent) {
    // Basic info
    document.getElementById('v-id').textContent = consent.id;
    document.getElementById('v-signed-at').textContent = this.textOrDash(consent.signed_at);
    document.getElementById('v-type').textContent = this.typeLabel(consent.consent_type);
    document.getElementById('v-therapist').textContent = this.textOrDash(consent.therapist_name);
    
    // Client info
    document.getElementById('v-client').textContent = this.textOrDash(consent.client_name);
    document.getElementById('v-id-number').textContent = this.clientIdLabel(consent.client_id_number);
    document.getElementById('v-phone').textContent = this.textOrDash(consent.client_phone);
    document.getElementById('v-email').textContent = this.textOrDash(consent.client_email);
    
    // Consent details
    document.getElementById('v-photos').textContent = consent.photos_allowed ? 'Sí' : 'No';
    document.getElementById('v-signature').textContent = this.textOrDash(consent.signature_text);
    document.getElementById('v-treatment').textContent = this.textOrDash(consent.treatment_areas);
    document.getElementById('v-medical').textContent = this.formatJsonField(consent.medical_conditions);
    document.getElementById('v-risks').textContent = this.textOrDash(consent.personalized_risks);
    document.getElementById('v-case').textContent = this.formatJsonField(consent.case_particularities);
    
    // Acceptance points
    const points = Array.isArray(consent.acceptance_points) ? consent.acceptance_points : [];
    document.getElementById('v-points').innerHTML = points.length
      ? points.map(p => `<li>${p}</li>`).join('')
      : '<li>—</li>';
    
    // Setup buttons
    this.setupButtons(consent);
  }

  setupButtons(consent) {
    const path = this.printTemplatePath(consent);
    const viewBtn = document.getElementById('view-original');
    const originalPdfBtn = document.getElementById('download-original-pdf');
    const editBtn = document.getElementById('edit-original');
    const pdfBtn = document.getElementById('download-summary-pdf');

    if (path) {
      viewBtn.onclick = () => window.open(`${path}?consent_id=${consent.id}`, '_blank', 'noopener');
      originalPdfBtn.onclick = () => window.open(`${path}?consent_id=${consent.id}&autopdf=1`, '_blank', 'noopener');
      editBtn.onclick = () => window.open(`${path}?consent_id=${consent.id}&mode=edit`, '_blank', 'noopener');
    } else {
      viewBtn.disabled = true;
      originalPdfBtn.disabled = true;
      editBtn.disabled = true;
    }

    pdfBtn.onclick = () => {
      const options = {
        margin: 8,
        filename: `consentimiento-${consent.id}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] },
      };
      html2pdf().set(options).from(document.getElementById('content')).save();
    };
  }
}

// Initialize controller
new ConsentViewController();

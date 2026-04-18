/**
 * Form - Form helper utilities
 */

export class Form {
  /**
   * Get form data as object
   */
  static getData(formId) {
    const form = document.getElementById(formId);
    if (!form) return {};

    const formData = new FormData(form);
    const data = {};

    for (const [key, value] of formData.entries()) {
      // Handle checkboxes
      if (form.elements[key]?.type === 'checkbox') {
        data[key] = form.elements[key].checked;
      } else {
        data[key] = value;
      }
    }

    return data;
  }

  /**
   * Set form data from object
   */
  static setData(formId, data) {
    const form = document.getElementById(formId);
    if (!form) return;

    Object.keys(data).forEach(key => {
      const element = form.elements[key];
      if (!element) return;

      if (element.type === 'checkbox') {
        element.checked = data[key];
      } else if (element.type === 'radio') {
        const radio = form.querySelector(`input[name="${key}"][value="${data[key]}"]`);
        if (radio) radio.checked = true;
      } else {
        element.value = data[key] || '';
      }
    });
  }

  /**
   * Reset form
   */
  static reset(formId) {
    const form = document.getElementById(formId);
    if (form) form.reset();
  }

  /**
   * Validate form
   */
  static validate(formId) {
    const form = document.getElementById(formId);
    if (!form) return false;
    return form.checkValidity();
  }

  /**
   * Show validation errors
   */
  static showErrors(formId, errors) {
    const form = document.getElementById(formId);
    if (!form) return;

    // Clear previous errors
    form.querySelectorAll('.error-message').forEach(el => el.remove());
    form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));

    // Show new errors
    Object.keys(errors).forEach(field => {
      const element = form.elements[field];
      if (!element) return;

      element.classList.add('error');
      
      const errorDiv = document.createElement('div');
      errorDiv.className = 'error-message';
      errorDiv.textContent = errors[field];
      element.parentNode.insertBefore(errorDiv, element.nextSibling);
    });
  }

  /**
   * Clear errors
   */
  static clearErrors(formId) {
    const form = document.getElementById(formId);
    if (!form) return;

    form.querySelectorAll('.error-message').forEach(el => el.remove());
    form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
  }
}

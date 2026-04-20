(function () {
  var STORAGE_KEY = "likestudio_client_prefill_v1";

  function getField(id) {
    return document.getElementById(id);
  }

  function splitName(fullName) {
    var parts = (fullName || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length <= 1) return { first: parts[0] || "", last: "" };
    return {
      first: parts[0],
      last: parts.slice(1).join(" ")
    };
  }

  function mergeName(first, last) {
    return [first || "", last || ""].join(" ").trim();
  }

  function readStored() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveStored(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      // Ignore storage failures.
    }
  }

  function clearStored() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      // Ignore storage failures.
    }
  }

  function collectFromForm() {
    var fullName = getField("full_name");
    var lastName = getField("last_name");
    var firstName = fullName ? fullName.value : "";
    var composedName = lastName ? mergeName(firstName, lastName.value) : firstName;

    return {
      full_name: composedName || "",
      id_number: (getField("id_number") || getField("dni") || { value: "" }).value || "",
      phone: (getField("phone") || { value: "" }).value || "",
      email: (getField("email") || { value: "" }).value || ""
    };
  }

  function applyData(data) {
    if (!data) return;

    var fullNameField = getField("full_name");
    var lastNameField = getField("last_name");
    if (fullNameField) {
      if (lastNameField) {
        var split = splitName(data.full_name || "");
        if (!fullNameField.value) fullNameField.value = split.first;
        if (!lastNameField.value) lastNameField.value = split.last;
      } else if (!fullNameField.value && data.full_name) {
        fullNameField.value = data.full_name;
      }
    }

    var idField = getField("id_number") || getField("dni");
    if (idField && !idField.value && data.id_number) idField.value = data.id_number;

    var phoneField = getField("phone");
    if (phoneField && !phoneField.value && data.phone) phoneField.value = data.phone;

    var emailField = getField("email");
    if (emailField && !emailField.value && data.email) emailField.value = data.email;
  }

  function clearIdentityFields() {
    [
      "full_name",
      "last_name",
      "id_number",
      "dni",
      "phone",
      "email"
    ].forEach(function (id) {
      var el = getField(id);
      if (el) el.value = "";
    });
  }

  function getLocalDateString(date) {
    var base = date || new Date();
    var year = base.getFullYear();
    var month = String(base.getMonth() + 1).padStart(2, "0");
    var day = String(base.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function safeText(value) {
    return String(value || "").trim();
  }

  function formatTime(value) {
    return String(value || "").slice(0, 5);
  }

  function buildDayListPanel() {
    var body = document.body;
    if (!body || !body.getAttribute("data-consent-form")) return null;
    var form = document.querySelector("form");
    if (!form || !form.parentNode) return null;

    var panel = document.createElement("section");
    panel.className = "legal-box consent-daylist";
    panel.innerHTML =
      '<div class="consent-daylist-head">' +
      '  <div>' +
      '    <h3>Citas del dia</h3>' +
      '    <p class="form-note">Selecciona una cita para rellenar datos si el formulario esta vacio.</p>' +
      "  </div>" +
      '  <div class="consent-daylist-controls">' +
      '    <div>' +
      '      <label for="consent-daylist-date">Fecha</label>' +
      '      <input id="consent-daylist-date" type="date" />' +
      "    </div>" +
      '    <div>' +
      '      <label for="consent-daylist-professional">Profesional</label>' +
      '      <select id="consent-daylist-professional">' +
      '        <option value="">Todos</option>' +
      '        <option value="Josemi">Josemi</option>' +
      '        <option value="Liege">Liege</option>' +
      "      </select>" +
      "    </div>" +
      '    <button class="btn btn-ghost btn-sm" type="button" id="consent-daylist-refresh">Actualizar</button>' +
      "  </div>" +
      "</div>" +
      '<div id="consent-daylist-items" class="consent-daylist-items"></div>' +
      '<p id="consent-daylist-message" class="form-note"></p>';

    form.parentNode.insertBefore(panel, form);
    return panel;
  }

  function shouldAutofill() {
    var fields = [
      getField("full_name"),
      getField("last_name"),
      getField("id_number"),
      getField("dni"),
      getField("phone"),
      getField("email")
    ].filter(Boolean);

    return fields.every(function (el) {
      return !safeText(el.value);
    });
  }

  function applyAppointmentPrefill(data) {
    if (!data) return;
    if (!shouldAutofill()) return;

    var payload = {
      full_name: safeText(data.client_name),
      id_number: "",
      phone: safeText(data.client_phone),
      email: ""
    };
    applyData(payload);
    saveStored(payload);

    var therapistField = getField("therapist_name");
    if (therapistField && !safeText(therapistField.value) && data.professional_name) {
      therapistField.value = data.professional_name;
    }
  }

  function wireDayList() {
    var panel = buildDayListPanel();
    if (!panel || !window.APP_CONFIG || !window.APP_CONFIG.API_BASE_URL) return;

    var dateInput = panel.querySelector("#consent-daylist-date");
    var professionalSelect = panel.querySelector("#consent-daylist-professional");
    var refreshBtn = panel.querySelector("#consent-daylist-refresh");
    var list = panel.querySelector("#consent-daylist-items");
    var message = panel.querySelector("#consent-daylist-message");
    if (!dateInput || !professionalSelect || !refreshBtn || !list || !message) return;

    dateInput.value = getLocalDateString(new Date());

    function renderItems(items) {
      list.innerHTML = "";
      if (!items.length) {
        message.textContent = "No hay citas para este dia.";
        return;
      }
      message.textContent = "";
      list.innerHTML = items.map(function (item) {
        var time = formatTime(item.start_time);
        var name = safeText(item.client_name) || "Cliente";
        var service = safeText(item.service_name);
        var professional = safeText(item.professional_name);
        var label = (time ? time + " · " : "") + name + (service ? " · " + service : "");
        var payload = {
          client_name: name,
          client_phone: safeText(item.client_phone),
          professional_name: professional
        };
        return (
          '<button class="btn btn-ghost btn-sm" type="button" ' +
          'data-payload=\'' + JSON.stringify(payload).replace(/'/g, "&#39;") + "'>" +
          label +
          "</button>"
        );
      }).join("");
    }

    async function loadDayList() {
      var dateValue = dateInput.value || getLocalDateString(new Date());
      var professional = professionalSelect.value;
      message.textContent = "Cargando citas...";
      list.innerHTML = "";
      try {
        var params = new URLSearchParams();
        params.set("start_date", dateValue);
        params.set("end_date", dateValue);
        params.set("appointment_type", "appointment");
        params.set("limit", "200");
        params.set("offset", "0");
        var response = await fetch(window.APP_CONFIG.API_BASE_URL + "/admin/appointments?" + params.toString());
        if (!response.ok) throw new Error("No se pudieron cargar las citas.");
        var payload = await response.json();
        var items = Array.isArray(payload.items) ? payload.items : [];
        if (professional) {
          items = items.filter(function (item) {
            return safeText(item.professional_name).toLowerCase() === professional.toLowerCase();
          });
        }
        renderItems(items);
      } catch (e) {
        message.textContent = e.message || "No se pudieron cargar las citas.";
      }
    }

    list.addEventListener("click", function (event) {
      var button = event.target.closest("button[data-payload]");
      if (!button) return;
      try {
        var raw = button.getAttribute("data-payload");
        var data = raw ? JSON.parse(raw.replace(/&#39;/g, "'")) : null;
        applyAppointmentPrefill(data);
      } catch (e) {
        // Ignore parse errors.
      }
    });

    refreshBtn.addEventListener("click", loadDayList);
    dateInput.addEventListener("change", loadDayList);
    professionalSelect.addEventListener("change", loadDayList);
    loadDayList();
  }

  async function fetchClientPrefill(idNumber) {
    if (!idNumber || !window.APP_CONFIG || !window.APP_CONFIG.API_BASE_URL) return;
    try {
      var response = await fetch(
        window.APP_CONFIG.API_BASE_URL + "/admin/client-prefill?id_number=" + encodeURIComponent(idNumber)
      );
      if (!response.ok) return;
      var payload = await response.json();
      applyData(payload);
      saveStored({
        full_name: payload.full_name || "",
        id_number: payload.id_number || "",
        phone: payload.phone || "",
        email: payload.email || ""
      });
    } catch (e) {
      // Silent fallback to local storage only.
    }
  }

  function wireEvents() {
    var idField = getField("id_number") || getField("dni");
    if (idField) {
      idField.addEventListener("blur", function () {
        var value = (idField.value || "").trim();
        if (!value) return;
        fetchClientPrefill(value);
      });
    }

    document.addEventListener("submit", function () {
      var data = collectFromForm();
      if (data.full_name || data.id_number || data.phone || data.email) saveStored(data);
    });
  }

  function addResetControl() {
    var stored = readStored();
    var hasData = stored && (stored.full_name || stored.phone || stored.id_number);
    if (!hasData) return;

    var main = document.querySelector("main") || document.querySelector(".form-wrap");
    if (!main) return;

    var banner = document.createElement("div");
    banner.className = "consent-prefill-banner";
    banner.innerHTML =
      '<div class="consent-prefill-content">' +
      '<span class="consent-prefill-icon">⚠️</span>' +
      '<div>' +
      '<strong>Datos precargados del cliente anterior</strong>' +
      '<p>' + (stored.full_name || stored.phone || 'Cliente') + '</p>' +
      '</div>' +
      '</div>' +
      '<button type="button" class="btn btn-danger btn-sm consent-reset-btn">Cambiar cliente</button>';

    banner.querySelector(".consent-reset-btn").addEventListener("click", function () {
      clearStored();
      clearIdentityFields();
      banner.remove();
    });

    // Insert as the FIRST child of main, before everything else
    main.insertBefore(banner, main.firstChild);
  }

  function init() {
    applyData(readStored());
    wireEvents();
    addResetControl();
    if (document.body && document.body.hasAttribute("data-consent-daylist")) {
      wireDayList();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

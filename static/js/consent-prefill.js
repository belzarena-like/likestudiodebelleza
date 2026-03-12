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
    var topbar = document.querySelector(".topbar");
    if (!topbar) return;

    var actions = topbar.querySelector(".topbar-actions");
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "topbar-actions";
      var toggle = topbar.querySelector(".menu-toggle");
      if (toggle && toggle.parentNode) {
        toggle.parentNode.insertBefore(actions, toggle);
      } else {
        topbar.appendChild(actions);
      }
    }

    var button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-ghost";
    button.textContent = "Reset cliente";
    button.addEventListener("click", function () {
      clearStored();
      clearIdentityFields();
    });
    actions.appendChild(button);
  }

  function init() {
    applyData(readStored());
    wireEvents();
    addResetControl();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

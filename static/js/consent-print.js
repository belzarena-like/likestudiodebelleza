(function () {
  function getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function setValue(id, value) {
    var el = document.getElementById(id);
    if (!el) return;
    el.value = value == null ? "" : String(value);
  }

  function splitName(fullName) {
    var parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length <= 1) return { first: parts[0] || "", last: "" };
    return { first: parts[0], last: parts.slice(1).join(" ") };
  }

  function safeJson(text) {
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  }

  function setChecks(name, values) {
    var set = new Set(Array.isArray(values) ? values : []);
    document.querySelectorAll('input[name="' + name + '"]').forEach(function (el) {
      el.checked = set.has(el.value);
    });
  }

  function disableFormForPrint() {
    document.querySelectorAll("input, textarea, select, button").forEach(function (el) {
      if (el.id === "admin-auth-overlay") return;
      if (el.type === "button" && (el.textContent || "").indexOf("Imprimir") >= 0) return;
      if (el.closest(".topbar")) return;
      if (el.closest(".form-actions")) return;
      el.disabled = true;
      el.readOnly = true;
    });

    document.querySelectorAll(".form-actions, #form-message").forEach(function (el) {
      el.style.display = "none";
    });

    var resetBtn = Array.prototype.find.call(
      document.querySelectorAll(".topbar .menu button, .topbar .menu a"),
      function (el) { return (el.textContent || "").trim().toLowerCase() === "reset cliente"; }
    );
    if (resetBtn) resetBtn.style.display = "none";
  }

  async function exportCurrentPagePdf(consentId) {
    if (typeof window.html2pdf === "undefined") {
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js");
    }
    var target = document.querySelector(".form-wrap") || document.body;
    var options = {
      margin: 8,
      filename: "consentimiento-original-" + consentId + ".pdf",
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"] }
    };
    window.html2pdf().set(options).from(target).save();
  }

  function fillMicropigmentacion(c) {
    setValue("full_name", c.client_name);
    setValue("id_number", c.client_id_number);
    setValue("phone", c.client_phone);
    setValue("email", c.client_email);
    setValue("areas", c.treatment_areas);
    setValue("medical_conditions", c.medical_conditions);
    setValue("personalized_risks", c.personalized_risks);
    setValue("case_particularities", c.case_particularities);
    setChecks("acceptance_points", c.acceptance_points);
    var photos = document.getElementById("photos_allowed");
    if (photos) photos.checked = !!c.photos_allowed;
    setValue("signed_at", c.signed_at);
    setValue("therapist_name", c.therapist_name);
    setValue("signature_text", c.signature_text);
  }

  function fillEstetico(c) {
    var info = safeJson(c.medical_conditions) || {};
    var name = splitName(c.client_name);
    setValue("full_name", name.first);
    setValue("last_name", name.last);
    setValue("dni", c.client_id_number);
    setValue("phone", c.client_phone);
    setValue("email", c.client_email);
    setValue("history", info.history);
    setChecks("conditions", info.conditions || []);
    setValue("profession", info.profession);
    setValue("age", info.age);
    setValue("children", info.children);
    setValue("lifestyle", info.lifestyle);
    setValue("sleep_quality", info.sleep_quality);
    setValue("smoking", info.smoking);
    setValue("alcohol", info.alcohol);
    setValue("sports", info.sports);
    setValue("sessions", info.sessions);
    setValue("observations", info.observations);
    setValue("treatment", c.treatment_areas);
    setValue("signed_at", c.signed_at);
    setValue("signature_text", c.signature_text);
    var policy = document.getElementById("appointment_policy");
    if (policy) policy.checked = !!info.appointment_policy_accepted;
  }

  function fillLaserDepilacion(c) {
    var info = safeJson(c.medical_conditions) || {};
    var area = String(c.treatment_areas || "").replace(/^Depilacion laser\s*-\s*/i, "");
    setValue("full_name", c.client_name);
    setValue("id_number", c.client_id_number);
    setValue("phone", c.client_phone);
    setValue("email", c.client_email);
    setValue("birth_date", info.birth_date);
    setValue("treatment_area", area || c.treatment_areas);
    setValue("medical_conditions", info.contraindications || c.medical_conditions);
    setChecks("acceptance_points", c.acceptance_points);
    var photos = document.getElementById("photos_allowed");
    if (photos) photos.checked = !!c.photos_allowed;
    setValue("signed_at", c.signed_at);
    setValue("therapist_name", c.therapist_name);
    setValue("signature_text", c.signature_text);
  }

  function fillLaserEliminacion(c) {
    var info = safeJson(c.medical_conditions) || {};
    var area = String(c.treatment_areas || "").replace(/^Eliminacion tatuaje\/micropigmentacion\s*-\s*/i, "");
    setValue("full_name", c.client_name);
    setValue("id_number", c.client_id_number);
    setValue("phone", c.client_phone);
    setValue("email", c.client_email);
    setValue("age", info.age);
    setValue("laser_type", info.laser_type);
    setValue("estimated_sessions", info.estimated_sessions);
    setValue("treatment_area", area || c.treatment_areas);
    setValue("medical_conditions", info.notes || c.medical_conditions);
    setChecks("acceptance_points", c.acceptance_points);
    setValue("signed_at", c.signed_at);
    setValue("therapist_name", c.therapist_name);
    setValue("signature_text", c.signature_text);
  }

  async function init() {
    var consentId = getParam("consent_id");
    if (!consentId || !window.APP_CONFIG || !window.APP_CONFIG.API_BASE_URL) return;

    try {
      var res = await fetch(window.APP_CONFIG.API_BASE_URL + "/admin/consents/" + encodeURIComponent(consentId));
      if (!res.ok) return;
      var c = await res.json();
      var formType = document.body.getAttribute("data-consent-form");

      if (formType === "micropigmentacion") fillMicropigmentacion(c);
      if (formType === "estetico") fillEstetico(c);
      if (formType === "laser-depilacion") fillLaserDepilacion(c);
      if (formType === "laser-eliminacion") fillLaserEliminacion(c);

      disableFormForPrint();

      if (getParam("autopdf") === "1") {
        setTimeout(function () {
          exportCurrentPagePdf(c.id);
        }, 300);
        return;
      }

      if (getParam("autoprint") === "1") {
        setTimeout(function () { window.print(); }, 300);
      }
    } catch (e) {
      // Fail silently and keep normal form behavior.
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

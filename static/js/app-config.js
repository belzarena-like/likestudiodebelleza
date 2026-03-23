(function () {
  var existing = window.APP_CONFIG || {};
  var override = window.LIKESTUDIO_API_BASE_URL;
  var defaultBase = "http://localhost:8000";

  var baseUrl = (override || existing.API_BASE_URL || defaultBase).replace(/\/+$/, "");

  window.APP_CONFIG = {
    API_BASE_URL: baseUrl
  };
})();

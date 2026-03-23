
//DONT FORGET TO CHANGE THE BASE URL FOR LOCAL DEVELOPMENT
(function () {
  var existing = window.APP_CONFIG || {};
  var override = window.LIKESTUDIO_API_BASE_URL;
  var defaultBase = "https://apis.listoapp.es/like_api";

  var baseUrl = (override || existing.API_BASE_URL || defaultBase).replace(/\/+$/, "");

  // Set global config that both old and new code can use
  window.APP_CONFIG = {
    API_BASE_URL: baseUrl
  };
})();

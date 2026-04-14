
//DONT FORGET TO CHANGE THE BASE URL FOR LOCAL DEVELOPMENT
(function () {
  var defaultBase = "https://apis.listoapp.es/like_api";
    
  // Check for overrides
  var override = window.LIKESTUDIO_API_BASE_URL;
  var existing = (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) ? window.APP_CONFIG.API_BASE_URL : null;
  
  // Use override, then existing, then default
  var baseUrl = override || existing || defaultBase;
  
  // Remove trailing slashes
  baseUrl = baseUrl.replace(/\/+$/, "");
  
  // CRITICAL: Ensure /like_api is present if using apis.listoapp.es
  if (baseUrl === "https://apis.listoapp.es" || baseUrl === "http://apis.listoapp.es") {
    baseUrl = baseUrl + "/like_api";
  }
  
  // Set global config
  window.APP_CONFIG = {
    API_BASE_URL: baseUrl
  };
  
  console.log("API Base URL configured:", baseUrl);
})();

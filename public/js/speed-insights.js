// Vercel Speed Insights Integration
// Inject the Speed Insights script into the page
(function() {
  // Check if already loaded
  if (window.sil) return;
  
  // Mark as loaded
  window.sil = true;
  
  // Initialize queue for Speed Insights
  if (!window.si) {
    window.si = function() {
      (window.siq = window.siq || []).push(arguments);
    };
  }
  
  // Create and inject the Speed Insights script
  var script = document.createElement('script');
  script.src = '/_vercel/speed-insights/script.js';
  script.defer = true;
  script.dataset.sdkn = '@vercel/speed-insights';
  script.dataset.sdkv = '2.0.0';
  
  script.onerror = function() {
    console.log('[Vercel Speed Insights] Failed to load script. Please check if any content blockers are enabled.');
  };
  
  document.head.appendChild(script);
})();

// Theme toggle – must load synchronously in <head> before first paint.
(function () {
  var STORAGE_KEY = 'theme-preference'; // 'light' | 'dark' | 'auto'

  function getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function resolveTheme(pref) {
    return pref === 'auto' ? getSystemTheme() : pref;
  }

  function applyTheme(pref) {
    document.documentElement.setAttribute('data-theme', resolveTheme(pref));
  }

  function getPreference() {
    try { return localStorage.getItem(STORAGE_KEY) || 'auto'; }
    catch (e) { return 'auto'; }
  }

  function setPreference(pref) {
    try { localStorage.setItem(STORAGE_KEY, pref); } catch (e) { /* quota / private */ }
    applyTheme(pref);
  }

  // Apply immediately (blocks render — intentional to prevent flash)
  applyTheme(getPreference());

  // Re-apply when system theme changes (matters when preference is 'auto')
  window.matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', function () {
      if (getPreference() === 'auto') applyTheme('auto');
    });

  // Public API for toggle UI
  window.themeToggle = { getPreference: getPreference, setPreference: setPreference };
})();

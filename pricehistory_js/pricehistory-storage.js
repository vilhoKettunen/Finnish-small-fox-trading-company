// pricehistory-storage.js
window.PriceHistory = window.PriceHistory || {};
window.PriceHistory.Storage = (function () {
  const { STORAGE_KEYS } = window.PriceHistory.Config;

  function loadPreset() {
try {
      const raw = localStorage.getItem(STORAGE_KEYS.PRESET);
  if (!raw) return null;
  const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
} catch {
  return null;
    }
  }

  function savePreset(state) {
    try {
      localStorage.setItem(STORAGE_KEYS.PRESET, JSON.stringify(state || {}));
    } catch {
      // ignore
    }
  }

  function clearPreset() {
    try {
      localStorage.removeItem(STORAGE_KEYS.PRESET);
    } catch {
// ignore
    }
  }

  return { loadPreset, savePreset, clearPreset };
})();

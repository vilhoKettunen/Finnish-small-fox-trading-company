// Small auth storage helper — store/restore/clear id_token using cookie (fallback to localStorage)
// Include this file BEFORE your main app script (index.html).

(function () {
  const COOKIE_NAME = 'vak_id_token';
  const FALLBACK_KEY = 'vak_id_token'; // localStorage fallback
  const DEFAULT_DAYS = 7;

  function setCookie(name, value, days) {
    const d = new Date();
    d.setTime(d.getTime() + (days || DEFAULT_DAYS) * 24 * 60 * 60 * 1000);
    const expires = "expires=" + d.toUTCString();
    // Secure and SameSite=Lax. HttpOnly cannot be set via JS.
    document.cookie = `${name}=${encodeURIComponent(value)}; ${expires}; path=/; Secure; SameSite=Lax`;
  }

  function getCookie(name) {
    const v = document.cookie.match('(?:^|; )' + name.replace(/([.*+?^=!:${}()|[\]\\/])/g, '\\$1') + '=([^;]*)');
    return v ? decodeURIComponent(v[1]) : null;
  }

  function deleteCookie(name) {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; Secure; SameSite=Lax`;
  }

  function saveToFallback(value) {
    try { localStorage.setItem(FALLBACK_KEY, value); } catch (e) { /* ignore */ }
  }
  function getFromFallback() {
    try { return localStorage.getItem(FALLBACK_KEY); } catch (e) { return null; }
  }
  function removeFallback() {
    try { localStorage.removeItem(FALLBACK_KEY); } catch (e) { /* ignore */ }
  }

  // Minimal JWT parser to check expiry (exp). Returns payload or null.
  function parseJwt(token) {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length < 2) return null;
    try {
      const payload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decodeURIComponent(escape(payload)));
    } catch (e) {
      try { return JSON.parse(atob(parts[1])); } catch (e2) { return null; }
    }
  }

  function isJwtExpired(token) {
    const p = parseJwt(token);
    if (!p) return false; // can't decide -> treat as valid
    const exp = Number(p.exp || 0);
    if (!exp) return false;
    return (Date.now() / 1000) > (exp - 10); // consider a 10s grace
  }

  // Public API: save / restore / clear
  window.saveIdToken = function (idToken, opts) {
    try {
      if (!idToken) return { ok: false, error: 'missing token' };
      // store cookie and fallback
      setCookie(COOKIE_NAME, idToken, (opts && opts.days) || DEFAULT_DAYS);
      saveToFallback(idToken);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  };

  // Returns Promise<{ok: boolean, idToken?: string}>
  window.initAuthFromStorage = async function () {
    try {
      // Prefer cookie
      let token = getCookie(COOKIE_NAME);
      if (!token) token = getFromFallback();
      if (!token) return { ok: false };
      if (isJwtExpired(token)) {
        // clear expired token
        deleteCookie(COOKIE_NAME);
        removeFallback();
        return { ok: false, expired: true };
      }
      return { ok: true, idToken: token };
    } catch (e) {
      console.warn('initAuthFromStorage error', e);
      return { ok: false, error: String(e) };
    }
  };

  window.clearSavedIdToken = function () {
    try {
      deleteCookie(COOKIE_NAME);
      removeFallback();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  };
})();
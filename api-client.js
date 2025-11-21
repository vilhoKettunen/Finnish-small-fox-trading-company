/* Shared API helper for pages outside index.html.
   Requires app-config.js to define window.WEB_APP_URL and storage helpers. */

(function(){
  const BASE = (window.WEB_APP_URL || '').replace(/\/+$/,''); // Worker /exec url

  function normalize(j){
    if (!j) return j;
    if (typeof j === 'object' && 'ok' in j && j.ok === false) {
      const err = new Error(j.error || 'Backend error');
      err.extra = j.extra;
      throw err;
    }
    // Support both .result and .data consumers
    if (j && j.ok === true && j.data !== undefined && j.result === undefined) {
      j.result = j.data;
    }
    return j;
  }

  async function apiGet(action, params){
    const url = new URL(BASE);
    url.searchParams.set('action', action);
    if (params && typeof params === 'object') {
      for (const [k,v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
      }
    }
    const r = await fetch(url.toString(), { method: 'GET' });
    const j = await r.json();
    return normalize(j);
  }

  async function apiPost(action, body){
    const payload = { ...(body || {}), action };
    const r = await fetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const j = await r.json();
    return normalize(j);
  }

  // expose
  window.apiGet = apiGet;
  window.apiPost = apiPost;
})();
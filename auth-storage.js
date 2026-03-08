// Small auth storage helper — store/restore/clear id_token using cookie (fallback to localStorage)
// Include this file BEFORE your main app script (index.html).

(function () {
    const COOKIE_NAME = 'vak_id_token';
    const FALLBACK_KEY = 'vak_id_token'; // localStorage fallback
    const DEFAULT_DAYS = 30;

    function setCookie(name, value, days) {
        const d = new Date();
        d.setTime(d.getTime() + (days || DEFAULT_DAYS) * 24 * 60 * 60 * 1000);
        const expires = "expires=" + d.toUTCString();
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
        return (Date.now() / 1000) > (exp - 10); // 10s grace
    }

    // Public API: save / restore / clear
    window.saveIdToken = function (idToken, opts) {
        try {
            if (!idToken) return { ok: false, error: 'missing token' };
            setCookie(COOKIE_NAME, idToken, (opts && opts.days) || DEFAULT_DAYS);
            saveToFallback(idToken);
            return { ok: true };
        } catch (e) {
            return { ok: false, error: String(e) };
        }
    };

    // Synchronous raw read — used by pages that want the token immediately (Admin, EWInsurance)
    window.getSavedIdToken = function () {
        try {
            return getCookie(COOKIE_NAME) || getFromFallback() || null;
        } catch (e) {
            return null;
        }
    };

    // Returns Promise<{ok: boolean, idToken?: string}>
    window.initAuthFromStorage = async function () {
        try {
            let token = getCookie(COOKIE_NAME);
            if (!token) token = getFromFallback();
            if (!token) return { ok: false };
            if (isJwtExpired(token)) {
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

    // tryRestoreAuthGlobal — shared async silent restore used by topbar and individual pages.
    // Sets window._autoLoginDone = true ONLY on success.
    // On failure (no token, expired, backend rejection) leaves _autoLoginDone = false
    // so GSI auto_select / manual login callbacks are NOT suppressed.
    window.tryRestoreAuthGlobal = async function () {
        try {
            const res = await window.initAuthFromStorage();
            if (!res || !res.ok || !res.idToken) {
                // No stored token or locally expired — do NOT set _autoLoginDone.
                // This allows auto_select and the manual Login button to work normally.
                return { ok: false };
            }
            const idToken = res.idToken;

            const meUrl = window.WEB_APP_URL
                ? `${window.WEB_APP_URL}?action=me&idToken=${encodeURIComponent(idToken)}`
                : null;
            if (!meUrl) return { ok: false };

            const meResp = await fetch(meUrl);
            if (!meResp.ok) throw new Error('me fetch failed: ' + meResp.status);
            const meJson = await meResp.json();
            if (!meJson.ok) throw new Error(meJson.error || 'Backend rejected token');

            const user = meJson.data && meJson.data.user ? meJson.data.user : (meJson.user || {});
            const isAdmin = !!(meJson.data ? meJson.data.isAdmin : meJson.isAdmin);
            const balanceBT = Number((user && user.balanceBT) || 0);

            // Update topbar
            if (window.topbarSetAuthState) {
                window.topbarSetAuthState({ idToken, user, isAdmin, balanceBT });
            }

            // Refresh cookie expiry (sliding 30-day window)
            window.saveIdToken(idToken);

            // Only mark done on confirmed success
            window._autoLoginDone = true;
            window._lastRestoreResult = { ok: true, user, isAdmin, idToken };
            return { ok: true, user, isAdmin, idToken };
        } catch (e) {
            // Backend rejected the token (expired on Google's side, etc.) — clear silently.
            // Do NOT set _autoLoginDone = true so the user can still log in manually or via auto_select.
            try { window.clearSavedIdToken && window.clearSavedIdToken(); } catch (_) { }
            return { ok: false };
        }
    };
})();
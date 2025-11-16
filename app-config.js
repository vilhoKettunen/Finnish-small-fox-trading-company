// Shared configuration + auth helpers for all pages

// Configure your deployment defaults here (overridable by pre-set globals)
(function () {
    const DEFAULTS = {
        WEB_APP_URL: 'https://yellow-king-52c6.vilhokettu1.workers.dev/exec',
        OAUTH_CLIENT_ID: '857098772457-kuvq861sa844esf2jc4b7av1pnlmnn1c.apps.googleusercontent.com',
        RECAPTCHA_SITE_KEY: '6LdjcAgsAAAAABWoHl5dmFjbJQL61kOu7ddvkUZF'
    };

    window.WEB_APP_URL = window.WEB_APP_URL || DEFAULTS.WEB_APP_URL;
    window.OAUTH_CLIENT_ID = window.OAUTH_CLIENT_ID || DEFAULTS.OAUTH_CLIENT_ID;
    window.RECAPTCHA_SITE_KEY = window.RECAPTCHA_SITE_KEY || DEFAULTS.RECAPTCHA_SITE_KEY;

    // Persistent id_token storage
    const STORAGE_KEY = 'vak_id_token';
    window.saveIdToken = function (idToken) {
        try { if (idToken) localStorage.setItem(STORAGE_KEY, idToken); } catch (_) { }
    };
    window.getSavedIdToken = function () {
        try { return localStorage.getItem(STORAGE_KEY) || null; } catch (_) { return null; }
    };
    window.clearSavedIdToken = function () {
        try { localStorage.removeItem(STORAGE_KEY); } catch (_) { }
    };

    // Validate id_token via tokeninfo and audience
    window.verifyIdTokenInfo = async function (idToken) {
        if (!idToken) throw new Error('missing idToken');
        const resp = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken));
        if (!resp.ok) throw new Error('tokeninfo failed: ' + resp.status);
        const info = await resp.json();
        if ((info.aud || '') !== (window.OAUTH_CLIENT_ID || '')) throw new Error('invalid audience');
        const exp = Number(info.exp || 0);
        if (Date.now() / 1000 > exp) throw new Error('token expired');
        return info;
    };

    // Try restoring a saved id_token. Returns { ok, idToken, error? }
    window.initAuthFromStorage = async function () {
        try {
            const saved = window.getSavedIdToken();
            if (!saved) return { ok: false, error: 'no saved token' };
            await window.verifyIdTokenInfo(saved);
            return { ok: true, idToken: saved };
        } catch (e) {
            window.clearSavedIdToken();
            return { ok: false, error: e.message || String(e) };
        }
    };
})();
// Lightweight, reusable top bar for all pages (no page logic changed).
// Requires app-config.js for WEB_APP_URL and OAUTH_CLIENT_ID.
// Uses localStorage helpers from app-config.js if present.

(function () {
    const css = `
  #topBar{position:fixed;top:0;left:0;right:0;height:52px;background:#222;color:#fff;display:flex;align-items:center;padding:0 20px;z-index:1000;font-size:14px;gap:12px}
  #topBar button{color:#fff;background:none;border:none;cursor:pointer;margin-right:16px}
  #topBar .right{margin-left:auto;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
  body.withTopBar{padding-top:72px}
  #btnLogin{padding:6px 10px;background:#1a73e8;color:#fff;border:none;border-radius:4px}
  #btnLogout{padding:6px 10px;background:#444;color:#fff;border:1px solid #555;border-radius:4px}
  .balance-chip{padding:2px 6px;border-radius:4px;background:rgba(255,255,255,0.08);white-space:nowrap}
  .balance-you.positive{color:#2ecc71}.balance-you.negative{color:#ff5252}
  .balance-target{color:#f0c200}
  `;

    const html = `
  <div id="topBar" role="navigation" aria-label="Main">
    <div><strong>Vak Store</strong></div>
    <button type="button" onclick="navigateStore()">Store</button>
    <button type="button" onclick="navigateHistory()">Account History</button>
    <button type="button" onclick="navigateOCM()">OCM</button>
    <button type="button" onclick="navigateMerchant()">OCM Merchant</button>
    <button id="adminPanelBtn" style="display:none" type="button" onclick="navigateAdmin()">Admin Panel</button>
    <div class="right">
      <button id="btnLogin" type="button" onclick="startLogin()">Login</button>
      <span id="topBalanceTarget" class="small balance-chip balance-target" style="display:none;"></span>
      <span id="topBalance" class="small balance-chip balance-you" style="display:none;"></span>
      <span id="topUser" class="small"></span>
      <button id="btnLogout" style="display:none" type="button" onclick="logoutTopbar()">Logout</button>
    </div>
  </div>`;

    // Inject CSS + HTML once
    function ensureTopBar() {
        if (!document.getElementById('topBar')) {
            const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
            const wrap = document.createElement('div');
            wrap.innerHTML = html;
            document.body.insertBefore(wrap.firstElementChild, document.body.firstChild);
            document.body.classList.add('withTopBar');
        }
    }

    // Navigation
    window.navigateStore = () => { window.location.href = 'index.html'; };
    window.navigateHistory = () => {
        const tok = getSavedToken();
        if (!tok) return alert('You need to login for this tool');
        window.location.href = 'AccountHistory.html';
    };
    window.navigateOCM = () => { window.location.href = 'OCMHome.html'; };
    window.navigateMerchant = () => {
        const tok = getSavedToken();
        if (!tok) return alert('You need to login for this tool');
        window.location.href = 'OCMUser.html';
    };
    window.navigateAdmin = () => {
        const tok = getSavedToken();
        if (!tok || !state.isAdmin) return alert('Admin only');
        window.location.href = 'Admin.html';
    };

    // Simple state
    const state = {
        idToken: null,
        user: null,
        isAdmin: false
    };

    function getSavedToken() {
        if (window.getSavedIdToken) return window.getSavedIdToken();
        try { return localStorage.getItem('vak_id_token') || null; } catch { return null; }
    }
    function saveToken(tok) {
        if (window.saveIdToken) { try { window.saveIdToken(tok); return; } catch { } }
        try { localStorage.setItem('vak_id_token', tok); } catch { }
    }
    function clearSavedToken() {
        if (window.clearSavedIdToken) { try { window.clearSavedIdToken(); return; } catch { } }
        try { localStorage.removeItem('vak_id_token'); } catch { }
    }

    function updateTopBarAuth() {
        const email = state.user?.email || '';
        const admin = !!state.isAdmin;
        const logged = !!state.idToken;
        const topUser = document.getElementById('topUser');
        const btnLogin = document.getElementById('btnLogin');
        const btnLogout = document.getElementById('btnLogout');
        const adminBtn = document.getElementById('adminPanelBtn');
        if (topUser) topUser.textContent = logged ? email : '';
        if (btnLogin) btnLogin.style.display = logged ? 'none' : 'inline-block';
        if (btnLogout) btnLogout.style.display = logged ? 'inline-block' : 'none';
        if (adminBtn) adminBtn.style.display = admin ? 'inline-block' : 'none';
    }

    async function loadMe(idToken) {
        const base = window.WEB_APP_URL || '';
        const url = new URL(base);
        url.searchParams.set('action', 'me');
        url.searchParams.set('idToken', idToken);
        const r = await fetch(url.toString());
        const j = await r.json();
        if (!j.ok) throw new Error(j.error || 'me failed');
        const data = j.data || j.result || {};
        state.user = data.user || {};
        state.isAdmin = !!data.isAdmin;
    }

    // GSI
    window.startLogin = function () {
        if (window.google && google.accounts && google.accounts.id) {
            try { google.accounts.id.prompt(); } catch { startFallbackLogin(); }
        } else startFallbackLogin();
    };
    function startFallbackLogin() {
        const nonce = cryptoId();
        const redirectUri = location.origin + location.pathname;
        const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth'
            + '?client_id=' + encodeURIComponent(window.OAUTH_CLIENT_ID || '')
            + '&redirect_uri=' + encodeURIComponent(redirectUri)
            + '&response_type=id_token'
            + '&scope=' + encodeURIComponent('openid email profile')
            + '&nonce=' + encodeURIComponent(nonce)
            + '&prompt=select_account';
        window.location.href = authUrl;
    }
    function handleCredentialResponse(resp) {
        if (!resp || !resp.credential) return;
        onGoogleSignIn(resp.credential);
    }
    async function onGoogleSignIn(idToken) {
        try {
            // Validate
            const tResp = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
            if (!tResp.ok) throw new Error('tokeninfo failed ' + tResp.status);
            const info = await tResp.json();
            if ((info.aud || '') !== (window.OAUTH_CLIENT_ID || '')) throw new Error('Invalid audience');
            saveToken(idToken);
            state.idToken = idToken;
            await loadMe(idToken);
            updateTopBarAuth();
        } catch (e) {
            console.warn('Login error', e);
            alert('Login failed: ' + (e.message || e));
        }
    }
    window.logoutTopbar = function () {
        state.idToken = null; state.user = null; state.isAdmin = false;
        clearSavedToken();
        updateTopBarAuth();
    };

    function cryptoId() { return (crypto.getRandomValues(new Uint32Array(4))).join('-'); }

    // Auto init
    function initGsiWhenReady() {
        const iv = setInterval(() => {
            if (window.google && google.accounts && google.accounts.id && window.OAUTH_CLIENT_ID) {
                google.accounts.id.initialize({
                    client_id: window.OAUTH_CLIENT_ID,
                    callback: handleCredentialResponse,
                    ux_mode: 'popup',
                    auto_select: false,
                    use_fedcm_for_prompt: true
                });
                clearInterval(iv);
            }
        }, 200);
        setTimeout(() => clearInterval(iv), 4000);
    }

    async function restoreAuth() {
        const tok = getSavedToken();
        if (!tok) return;
        try {
            await loadMe(tok);
            state.idToken = tok;
            updateTopBarAuth();
        } catch { /* ignore */ }
    }

    // Inject on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', async () => {
            ensureTopBar();
            initGsiWhenReady();
            await restoreAuth();
        });
    } else {
        ensureTopBar();
        initGsiWhenReady();
        restoreAuth();
    }
})();
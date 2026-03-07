/* ewinsurance_js/ewinsurance-boot.js
   Boot / auth entry point for EWInsurance.html
*/

window.onload = function () {
    if (window.initSharedTopBar) window.initSharedTopBar();
    document.body.classList.add('withTopBar');

    // Try restoring auth from local storage
    const savedToken = window.getSavedIdToken ? window.getSavedIdToken() : null;
    if (savedToken) {
        window.applyAuthFromToken(savedToken);
    } else {
    showLoginArea_();
  }

    // GSI init
    const gsiWait = setInterval(() => {
        if (window.google && google.accounts && google.accounts.id) {
 clearInterval(gsiWait);
     google.accounts.id.initialize({
        client_id: window.GOOGLE_CLIENT_ID || (window.APP_CONFIG && window.APP_CONFIG.GOOGLE_CLIENT_ID) || '',
        callback: (resp) => {
if (resp && resp.credential) {
       window.applyAuthFromToken(resp.credential);
        }
      },
  auto_select: false
  });
        google.accounts.id.renderButton(
       document.getElementById('googleBtn'),
            { theme: 'outline', size: 'large', text: 'sign_in_with_google' }
    );
        }
    }, 200);
    setTimeout(() => clearInterval(gsiWait), 6000);
};

window.startFallbackLogin = function () {
 const clientId = window.GOOGLE_CLIENT_ID || (window.APP_CONFIG && window.APP_CONFIG.GOOGLE_CLIENT_ID) || '';
    const redirectUri = location.origin + location.pathname;
    const scope = 'openid email profile';
    const url = `https://accounts.google.com/o/oauth2/v2/auth?response_type=token+id_token&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&nonce=${Math.random().toString(36).slice(2)}`;
    location.href = url;
};

// Called after token obtained (GSI callback or storage restore)
window.applyAuthFromToken = async function (idToken) {
    const statusEl = document.getElementById('loginStatus');
    if (statusEl) statusEl.textContent = 'Verifying…';
    try {
        const r = await window.apiGet('me', { idToken });
        const d = r.data || r.result || r;
        const user = d.user || d;
        if (window.saveIdToken) window.saveIdToken(idToken);
        if (window.topbarSetAuthState) {
            window.topbarSetAuthState({
        idToken,
       user,
      isAdmin:   d.isAdmin || false,
    balanceBT: user.balanceBT || 0
      });
        }
        hideLoginArea_();

  // Store in EWIns state
   window.EWIns.state.idToken    = idToken;
  window.EWIns.state.user    = user;
      window.EWIns.state.isAdmin    = d.isAdmin || false;
 window.EWIns.state.balance    = user.balanceBT || 0;

        // Load policies + price sheet in parallel
        await Promise.all([
            window.EWIns.loadPolicies(),
            window.EWIns.loadPriceSheet()
        ]);
     window.EWIns.renderAll();
    } catch (e) {
        if (statusEl) statusEl.textContent = 'Login failed: ' + e.message;
        showLoginArea_();
    }
};

window.logout = function () {
    if (window.clearSavedIdToken) window.clearSavedIdToken();
    if (window.topbarSetAuthState) window.topbarSetAuthState({ idToken: null });
    window.EWIns.state.idToken  = null;
    window.EWIns.state.user     = null;
    window.EWIns.state.policies = [];
    const pl = document.getElementById('policyList');
    if (pl) pl.innerHTML = '';
    showLoginArea_();
};

function showLoginArea_() {
    const a = document.getElementById('googleLoginArea');
    if (a) a.style.display = '';
}

function hideLoginArea_() {
    const a = document.getElementById('googleLoginArea');
    if (a) a.style.display = 'none';
}

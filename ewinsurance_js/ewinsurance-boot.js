/* ewinsurance_js/ewinsurance-boot.js
   Boot / auth entry point for EWInsurance.html
*/

window.onload = function () {
    if (window.initSharedTopBar) window.initSharedTopBar();
    document.body.classList.add('withTopBar');

    // Initialize the shared login panel (terms + GSI button + setup form)
    window.SharedLogin && window.SharedLogin.init({});

    // Handle redirect-fallback returning id_token in URL hash
    try {
        const hash = String(location.hash || '');
   if (hash.includes('id_token=')) {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
            const tok = params.get('id_token');
 if (tok) {
         history.replaceState(null, '', location.pathname + location.search);
       window.applyAuthFromToken(tok);
    // GSI init still needed for button render, fall through
            }
        }
    } catch (e) { /* ignore */ }

    // Try restoring auth from local storage (only if no hash token consumed above)
    if (!location.hash) {
        const savedToken = window.getSavedIdToken ? window.getSavedIdToken() : null;
if (savedToken) {
       window.applyAuthFromToken(savedToken);
        }
    }

    // GSI init — renders the Google Sign-In button into #googleBtn (injected by shared panel)
    const gsiWait = setInterval(() => {
        if (window.google && google.accounts && google.accounts.id) {
            clearInterval(gsiWait);
            google.accounts.id.initialize({
        client_id: window.OAUTH_CLIENT_ID ||
         window.GOOGLE_CLIENT_ID ||
       (window.APP_CONFIG && window.APP_CONFIG.GOOGLE_CLIENT_ID) || '',
       callback: function (resp) {
        if (resp && resp.credential) {
  window.applyAuthFromToken(resp.credential);
        }
        },
     auto_select: false,
    ux_mode: 'popup',
  use_fedcm_for_prompt: true
            });
            google.accounts.id.renderButton(
       document.getElementById('googleBtn'),
        { theme: 'outline', size: 'large', type: 'standard', shape: 'rectangular', logo_alignment: 'left' }
       );
        }
 }, 200);
    setTimeout(() => clearInterval(gsiWait), 6000);
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
     isAdmin:   !!d.isAdmin,
    balanceBT: user.balanceBT || 0
     });
   }

        // Store in EWIns state
        window.EWIns.state.idToken  = idToken;
        window.EWIns.state.user   = user;
        window.EWIns.state.isAdmin  = !!d.isAdmin;
        window.EWIns.state.balance  = user.balanceBT || 0;

        if (statusEl) statusEl.textContent = '';

      // Evaluate setup form — BLOCKS page content for EWInsurance when profile is incomplete
        window.SharedLogin && window.SharedLogin.evaluateSetupForm(user);

        // Load policies + price sheet in parallel
     await Promise.all([
  window.EWIns.loadPolicies(),
  window.EWIns.loadPriceSheet()
   ]);
        window.EWIns.renderAll();

    } catch (e) {
    if (statusEl) statusEl.textContent = 'Login failed: ' + e.message;
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
    // Reset panel to logged-out state (shows terms warning + GSI button, hides setup form)
    window.SharedLogin && window.SharedLogin.evaluateSetupForm(null);
};

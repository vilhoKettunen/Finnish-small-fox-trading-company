// Auth + login bootstrapping for OCMHome
(function () {
 'use strict';

 const O = window.OCMHome;
 const S = O.state;
 const byId = O.byId;

 const OAUTH_CLIENT_ID = window.OAUTH_CLIENT_ID || '';

 function setTermsWarningVisible_(visible) {
 const el = document.getElementById('loginTermsWarning');
 if (!el) return;
 el.style.display = visible ? 'block' : 'none';
 }

 function updateTermsWarning_() {
 // Default to showing warning unless we are sure we have a token
 setTermsWarningVisible_(!S.googleIdToken);
 }

 // Ensure warning is visible by default (logged out) even if this script executes before DOM is fully ready.
 function showWarningSoon_() {
 try { setTermsWarningVisible_(true); } catch { }
 // Also re-apply after DOMContentLoaded in case element wasn't present yet.
 document.addEventListener('DOMContentLoaded', () => {
 try { updateTermsWarning_(); } catch { }
 });
 }

 showWarningSoon_();

 function initGoogleIdentity() {
 if (!window.google || !google.accounts || !google.accounts.id) return;
 google.accounts.id.initialize({
 client_id: OAUTH_CLIENT_ID,
 callback: resp => onGoogleSignIn(resp),
 ux_mode: 'popup',
 auto_select: false,
 use_fedcm_for_prompt: true
 });
 google.accounts.id.renderButton(
 document.getElementById('googleBtn'),
 { theme: 'outline', size: 'large', type: 'standard', shape: 'rectangular', logo_alignment: 'left' }
 );
 }

 function startFallbackLogin() {
 const nonce = crypto.getRandomValues(new Uint32Array(1))[0].toString(16);
 const redirectUri = location.origin + location.pathname;
 const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth'
 + '?client_id=' + encodeURIComponent(OAUTH_CLIENT_ID)
 + '&redirect_uri=' + encodeURIComponent(redirectUri)
 + '&response_type=id_token'
 + '&scope=' + encodeURIComponent('openid email profile')
 + '&nonce=' + encodeURIComponent(nonce)
 + '&prompt=select_account';
 window.location.href = authUrl;
 }

 async function onGoogleSignIn(resp) {
 const statusEl = byId('loginStatus');
 S.googleIdToken = resp && resp.credential;
 updateTermsWarning_();
 if (!S.googleIdToken) { statusEl.textContent = 'Login error: no credential'; return; }
 statusEl.textContent = 'Verifying token...';

 try {
 const tResp = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(S.googleIdToken)}`);
 if (!tResp.ok) throw new Error('tokeninfo failed ' + tResp.status);
 const info = await tResp.json();
 if (info.aud !== OAUTH_CLIENT_ID) throw new Error('Invalid audience');
 window.saveIdToken && window.saveIdToken(S.googleIdToken);

 statusEl.textContent = 'Loading profile...';
 await O.applyAuthFromToken(S.googleIdToken);
 statusEl.textContent = 'Logged in.';
 updateTermsWarning_();
 } catch (e) {
 statusEl.textContent = 'Login error: ' + e.message;
 }
 }

 window.startFallbackLogin = startFallbackLogin;
 O.initGoogleIdentity = initGoogleIdentity;
 O.onGoogleSignIn = onGoogleSignIn;

 // initial state
 try { updateTermsWarning_(); } catch { }
})();

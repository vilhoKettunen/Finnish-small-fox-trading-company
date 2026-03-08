// Auth + login bootstrapping for OCMHome
(function () {
 'use strict';

 const O = window.OCMHome;
 const S = O.state;
 const byId = O.byId;

 const OAUTH_CLIENT_ID = window.OAUTH_CLIENT_ID || '';

 function updateTermsWarning_() {
 if (typeof window.setLoginTermsWarningVisible_ === 'function') {
 window.setLoginTermsWarningVisible_(!S.googleIdToken);
 } else {
 const el = document.getElementById('loginTermsWarning');
 if (el) el.style.display = S.googleIdToken ? 'none' : 'block';
 }
 }

 function initGoogleIdentity() {
 if (!window.google || !google.accounts || !google.accounts.id) return;
 google.accounts.id.initialize({
 client_id: OAUTH_CLIENT_ID,
 callback: resp => onGoogleSignIn(resp),
 ux_mode: 'popup',
 auto_select: true,
 use_fedcm_for_prompt: true
 });
 google.accounts.id.renderButton(
 document.getElementById('googleBtn'),
 { theme: 'outline', size: 'large', type: 'standard', shape: 'rectangular', logo_alignment: 'left' }
 );
 }

 async function onGoogleSignIn(resp) {
 // Q7 guard: if cookie restore already succeeded, skip redundant full login flow
 if (window._autoLoginDone) return;

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

 O.initGoogleIdentity = initGoogleIdentity;
 O.onGoogleSignIn = onGoogleSignIn;

 try { updateTermsWarning_(); } catch { }
})();

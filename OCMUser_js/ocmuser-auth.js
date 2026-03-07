// Auth + topbar integration for OCMUser
(function () {
 'use strict';

 const S = window.OCMUser.state;
 const byId = window.OCMUser.byId;

 const OAUTH_CLIENT_ID = window.OAUTH_CLIENT_ID || '';

 function updateTermsWarning_() {
 if (typeof window.setLoginTermsWarningVisible_ === 'function') {
 window.setLoginTermsWarningVisible_(!S.googleIdToken);
 } else {
 const el = document.getElementById('loginTermsWarning');
 if (el) el.style.display = S.googleIdToken ? 'none' : 'block';
 }
 }

 function normalizeUser(u) {
 if (!u) return u;
 const cand = (u.playerName && u.playerName.trim()) || (u.name && u.name.trim()) || (u.displayName && u.displayName.trim()) || null;
 u.playerName = cand || u.playerName || null;
 return u;
 }

 async function applyAuthFromToken(idToken) {
 S.googleIdToken = idToken;
 updateTermsWarning_();
 const me = await apiGet('me', { idToken });
 const d = me.data || me.result || me;
 S.currentUser = normalizeUser(d.user || d) || {};
 const bal = Number(S.currentUser.balanceBT || 0);
 if (window.topbarSetAuthState) window.topbarSetAuthState({ idToken, user: S.currentUser, isAdmin: !!d.isAdmin, balanceBT: bal });
 byId('authStatus').textContent = 'Logged as ' + (S.currentUser.playerName || S.currentUser.email || '');

 // Evaluate setup form after profile is loaded
 window.SharedLogin && window.SharedLogin.evaluateSetupForm(S.currentUser);

 await window.OCMUser.ensureCatalogLoaded();
 await window.OCMUser.loadMyListings();
 await window.OCMUser.loadPendingRequests();
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
 await applyAuthFromToken(S.googleIdToken);
 statusEl.textContent = 'Logged in.';
 updateTermsWarning_();
 } catch (e) {
 statusEl.textContent = 'Login error: ' + e.message;
 }
 }

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

 async function tryRestoreAuthOnLoad() {
 if (!window.initAuthFromStorage) return;
 try {
 const res = await window.initAuthFromStorage();
 if (!res.ok) { updateTermsWarning_(); return; }
 await applyAuthFromToken(res.idToken);
 } catch (e) {
 console.warn('OCMUser auth restore failed', e);
 updateTermsWarning_();
 }
 }

 window.onTopbarAuthChanged = function (info) {
 S.googleIdToken = info.idToken;
 updateTermsWarning_();
 S.currentUser = info.user;
 if (window.topbarSetAuthState) window.topbarSetAuthState(info);
 if (!info.idToken) {
 byId('authStatus').textContent = 'Not logged in.';
 window.OCMUser.clearUI();
 } else {
 byId('authStatus').textContent = 'Logged as ' + ((info.user && (info.user.playerName || info.user.email)) || '');
 window.OCMUser.ensureCatalogLoaded().then(() => { window.OCMUser.loadMyListings(); window.OCMUser.loadPendingRequests(); });
 }
 };

 // Boot auth wiring
 window.OCMUser.bootAuth_ = function bootAuth_() {
 tryRestoreAuthOnLoad();
 const gsiWait = setInterval(() => {
 if (window.google && google.accounts && google.accounts.id) { initGoogleIdentity(); clearInterval(gsiWait); }
 }, 200);
 setTimeout(() => clearInterval(gsiWait), 4000);
 };

 try { updateTermsWarning_(); } catch { }
})();

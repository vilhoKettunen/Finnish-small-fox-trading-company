// Auth + topbar integration for OCMUser
(function () {
 'use strict';

 const S = window.OCMUser.state;
 const byId = window.OCMUser.byId;

 const OAUTH_CLIENT_ID = window.OAUTH_CLIENT_ID || '';

 function normalizeUser(u) {
 if (!u) return u;
 const cand = (u.playerName && u.playerName.trim()) || (u.name && u.name.trim()) || (u.displayName && u.displayName.trim()) || null;
 u.playerName = cand || u.playerName || null;
 return u;
 }

 async function applyAuthFromToken(idToken) {
 S.googleIdToken = idToken;
 const me = await apiGet('me', { idToken });
 const d = me.data || me.result || me;
 S.currentUser = normalizeUser(d.user || d) || {};
 const bal = Number(S.currentUser.balanceBT ||0);
 if (window.topbarSetAuthState) window.topbarSetAuthState({ idToken, user: S.currentUser, isAdmin: !!d.isAdmin, balanceBT: bal });
 byId('authStatus').textContent = 'Logged as ' + (S.currentUser.playerName || S.currentUser.email || '');

 await window.OCMUser.ensureCatalogLoaded();
 await window.OCMUser.loadMyListings();
 await window.OCMUser.loadPendingRequests();
 }

 async function onGoogleSignIn(resp) {
 const statusEl = byId('loginStatus');
 S.googleIdToken = resp && resp.credential;
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

 window.startFallbackLogin = function startFallbackLogin() {
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
 };

 async function tryRestoreAuthOnLoad() {
 if (!window.initAuthFromStorage) return;
 try {
 const res = await window.initAuthFromStorage();
 if (!res.ok) return;
 await applyAuthFromToken(res.idToken);
 } catch (e) {
 console.warn('OCMUser auth restore failed', e);
 }
 }

 window.onTopbarAuthChanged = function (info) {
 S.googleIdToken = info.idToken;
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
 },200);
 setTimeout(() => clearInterval(gsiWait),4000);
 };
})();

// Legacy auth related functions split out
(function () {
 'use strict';

 // ===== Login warning + setup highlight helpers =====
 let setupDeletionNoteTimer_ = null;

 function setDisplay_(id, show) {
 const el = document.getElementById(id);
 if (el) el.style.display = show ? 'block' : 'none';
 }

 function updateLoginTermsWarning_() {
 // Show warning only when logged out
 setDisplay_('loginTermsWarning', !window.googleIdToken);
 }

 // Ensure warning updates if some other script overwrites `window.googleIdToken` after this file loads.
 // (Index page has multiple legacy modules that re-initialize globals.)
 (function installGoogleIdTokenWatcher_() {
 try {
 if (window.__loginWarningGoogleIdTokenWatcherInstalled) return;
 window.__loginWarningGoogleIdTokenWatcherInstalled = true;

 let _tok = window.googleIdToken || null;
 Object.defineProperty(window, 'googleIdToken', {
 configurable: true,
 enumerable: true,
 get() { return _tok; },
 set(v) {
 _tok = v;
 try { updateLoginTermsWarning_(); } catch { }
 }
 });

 // Apply once
 updateLoginTermsWarning_();
 } catch {
 // If defineProperty fails, we fall back to explicit calls in login flow.
 }
 })();

 function computeProfileIncomplete_(u) {
 const playerName = String(u?.playerName || '').trim();
 const mailbox = String(u?.mailbox || '').trim();
 return (!playerName) || (!mailbox);
 }

 function setSetupHighlightAndNote_(user) {
 const setup = document.getElementById('setupForm');
 const note = document.getElementById('setupDeletionNote');
 if (!setup) return;

 const incomplete = !!window.googleIdToken && computeProfileIncomplete_(user);

 // Highlight setup when incomplete
 setup.classList.toggle('setup-highlight', incomplete);

 // Deletion note
 if (!note) return;

 if (!incomplete) {
 note.style.display = 'none';
 if (setupDeletionNoteTimer_) {
 clearTimeout(setupDeletionNoteTimer_);
 setupDeletionNoteTimer_ = null;
 }
 return;
 }

 // Show note and start auto-hide timer (120s)
 note.style.display = 'block';
 if (setupDeletionNoteTimer_) clearTimeout(setupDeletionNoteTimer_);
 setupDeletionNoteTimer_ = setTimeout(() => {
 // Auto-hide even if still incomplete
 const n = document.getElementById('setupDeletionNote');
 if (n) n.style.display = 'none';
 setupDeletionNoteTimer_ = null;
 },120000);
 }

 // expose minimal hooks (used by other modules if needed)
 window.updateLoginTermsWarning = window.updateLoginTermsWarning || updateLoginTermsWarning_;

 // ===== Account setup submit (required by index.html) =====
 // Some older versions had this inline; index.html still calls it via `onclick="submitSetup()"`.
 window.submitSetup = window.submitSetup || async function submitSetup() {
 const msg = document.getElementById('setupMsg');
 const playerName = String(document.getElementById('setupPlayerName')?.value || '').trim();
 const mailbox = String(document.getElementById('setupMailbox')?.value || '').trim();

 if (!window.googleIdToken) {
 if (msg) msg.textContent = 'You need to login first.';
 return;
 }

 if (msg) msg.textContent = 'Saving...';

 try {
 // Re-use existing update profile endpoint
 await window.apiPost('updateMyProfile', {
 idToken: window.googleIdToken,
 payload: { playerName, mailbox }
 });

 // Refresh current user
 const meResp = await fetch(`${window.WEB_APP_URL}?action=me&idToken=${encodeURIComponent(window.googleIdToken)}`);
 const meJson = await meResp.json();
 if (!meJson.ok) throw new Error(meJson.error || 'Backend error');
 window.currentUser = window.normalizeUser(meJson.data.user || {}) || {};
 window.currentUser.isAdmin = !!meJson.data.isAdmin;

 // Update UI
 if (msg) msg.textContent = 'Saved.';
 updateLoginTermsWarning_();
 setSetupHighlightAndNote_(window.currentUser);

 // Re-evaluate gating logic used in onGoogleSignIn
 const hasSetup = !computeProfileIncomplete_(window.currentUser);
 const passedCaptcha = !!window.currentUser.captchaPassed;
 if (hasSetup && passedCaptcha) {
 localStorage.setItem('vak_captcha_ok', '1');
 try { window.hideRecaptchaWidget(); } catch { }
 try { window.hideSetupShowApp(); } catch { }
 } else {
 localStorage.removeItem('vak_captcha_ok');
 try { window.showSetupOnly(); } catch { }
 try { window.showRecaptchaWidget(); } catch { }
 }

 try { await window.refreshPinnedBalanceForActiveTarget(); } catch { }
 try { await window.refreshTopBarBalances(); } catch { }
 } catch (e) {
 if (msg) msg.textContent = 'Error: ' + (e.message || e);
 }
 };

 // ===== Missing UI helpers (ported behavior) =====
 window.showRecaptchaWidget = window.showRecaptchaWidget || function showRecaptchaWidget() {
 const c = document.getElementById('recaptchaContainer');
 if (c) c.style.display = 'block';
 };

 window.hideRecaptchaWidget = window.hideRecaptchaWidget || function hideRecaptchaWidget() {
 const c = document.getElementById('recaptchaContainer');
 if (c) c.style.display = 'none';
 };

 window.showSetupOnly = window.showSetupOnly || function showSetupOnly() {
 const setup = document.getElementById('setupForm');
 const req = document.getElementById('requestControls');
 if (setup) setup.style.display = 'block';
 if (req) req.style.display = 'block';
 try { window.showRecaptchaWidget(); } catch { }
 const g = document.getElementById('requestGuard');
 if (g) g.style.display = window.googleIdToken ? 'none' : 'block';
 };

 window.hideSetupShowApp = window.hideSetupShowApp || function hideSetupShowApp() {
 const setup = document.getElementById('setupForm');
 if (setup) setup.style.display = 'none';
 try { window.hideRecaptchaWidget(); } catch { }
 const g = document.getElementById('requestGuard');
 if (g) g.style.display = 'none';
 };

 // ===== Balance fetch & pin (needed by login + admin on-behalf) =====
 window.getActiveTarget = window.getActiveTarget || function getActiveTarget() {
 return window.submitForUser || window.currentUser;
 };

 window.fetchBalanceForUser = window.fetchBalanceForUser || async function fetchBalanceForUser(user) {
 if (!window.googleIdToken || !user) return0;
 const qs = new URLSearchParams({ action: 'getBalance', idToken: window.googleIdToken });
 if (user.userId) qs.append('userId', user.userId);
 const r = await fetch(`${window.WEB_APP_URL}?${qs.toString()}`);
 const j = await r.json();
 if (!j.ok) throw new Error(j.error || 'getBalance failed');
 const v = Number(j.data?.balanceBT ?? j.balanceBT ?? j.data?.balance ??0);
 return isNaN(v) ?0 : v;
 };

 window.upsertPinnedBalanceRow = window.upsertPinnedBalanceRow || function upsertPinnedBalanceRow(balanceBT) {
 if (!Array.isArray(window.sellCart)) window.sellCart = [];
 window.sellCart = window.sellCart.filter(e => !e.isAccountBalancePinned);
 window.sellCart.unshift({
 name: 'Account Balance',
 qty:1,
 price: Number(balanceBT) ||0,
 isBalance: true,
 isAccountBalancePinned: true,
 source: 'BALANCE'
 });
 try { window.renderSellList && window.renderSellList(); } catch { }
 try { window.calculateNet && window.calculateNet(); } catch { }
 };

 window.setCurrentBalance = window.setCurrentBalance || function setCurrentBalance(bal) {
 window.currentBalanceBT = Number(bal) ||0;
 try { window.updateCombinedTotals && window.updateCombinedTotals(); } catch { }
 };

 window.refreshPinnedBalanceForActiveTarget = window.refreshPinnedBalanceForActiveTarget || async function refreshPinnedBalanceForActiveTarget() {
 const target = window.getActiveTarget();
 if (!target || !window.googleIdToken) return;
 try {
 const bal = await window.fetchBalanceForUser(target);
 window.setCurrentBalance(bal);
 if (window.currentUser?.isAdmin) {
 window.upsertPinnedBalanceRow(bal);
 } else {
 // Non-admin: clear pinned row if any
 if (Array.isArray(window.sellCart)) {
 window.sellCart = window.sellCart.filter(e => !e.isAccountBalancePinned);
 }
 try { window.renderSellList && window.renderSellList(); } catch { }
 try { window.calculateNet && window.calculateNet(); } catch { }
 }
 const st = document.getElementById('onBehalfStatus');
 if (st && window.submitForUser) {
 st.textContent = `Target set: ${target.playerName || target.email || target.userId}. Balance: ${Number(bal).toFixed(2)} BT`;
 }
 } catch (e) {
 const st = document.getElementById('onBehalfStatus');
 if (st) st.textContent = `Balance load failed: ${e.message}`;
 }
 };

 // In split version, open orders indicator may be absent; avoid crashing.
 window.refreshOpenOrders = window.refreshOpenOrders || function refreshOpenOrders() { };

 window.initGoogleIdentity = window.initGoogleIdentity || function initGoogleIdentity() {
 if (!window.google || !google.accounts || !google.accounts.id) return;
 google.accounts.id.initialize({
 client_id: window.OAUTH_CLIENT_ID,
 callback: window.handleCredentialResponse,
 ux_mode: 'popup',
 auto_select: false,
 use_fedcm_for_prompt: true
 });
 google.accounts.id.renderButton(document.getElementById('googleBtn'), { theme: 'outline', size: 'large', type: 'standard', shape: 'rectangular', logo_alignment: 'left' });
 };

 window.handleCredentialResponse = window.handleCredentialResponse || function handleCredentialResponse(resp) { window.onGoogleSignIn(resp); };

 window.startFallbackLogin = window.startFallbackLogin || function startFallbackLogin() {
 const nonce = window.cryptoRandomId();
 const redirectUri = location.origin + location.pathname;
 const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth'
 + '?client_id=' + encodeURIComponent(window.OAUTH_CLIENT_ID)
 + '&redirect_uri=' + encodeURIComponent(redirectUri)
 + '&response_type=id_token'
 + '&scope=' + encodeURIComponent('openid email profile')
 + '&nonce=' + encodeURIComponent(nonce)
 + '&prompt=select_account';
 window.location.href = authUrl;
 };

 window.startLogin = window.startLogin || function startLogin() {
 if (window.google && google.accounts && google.accounts.id) {
 try { google.accounts.id.prompt(); } catch { window.startFallbackLogin(); }
 } else window.startFallbackLogin();
 };

 window.checkHashForIdToken = window.checkHashForIdToken || function checkHashForIdToken() {
 if (!location.hash) return;
 const params = new URLSearchParams(location.hash.slice(1));
 const idt = params.get('id_token');
 if (idt) {
 window.handleCredentialResponse({ credential: idt });
 history.replaceState({}, document.title, location.pathname + location.search);
 }
 };

 window.onGoogleSignIn = window.onGoogleSignIn || async function onGoogleSignIn(resp) {
 const statusEl = document.getElementById('loginStatus');
 window.googleIdToken = resp && resp.credential;
 if (!window.googleIdToken) { statusEl.textContent = 'Login error: no credential'; updateLoginTermsWarning_(); return; }
 statusEl.textContent = 'Verifying token...';
 try {
 const tResp = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(window.googleIdToken)}`);
 if (!tResp.ok) throw new Error('tokeninfo failed ' + tResp.status);
 const info = await tResp.json();
 if (info.aud !== window.OAUTH_CLIENT_ID) throw new Error('Invalid audience');
 window.saveIdToken && window.saveIdToken(window.googleIdToken);

 statusEl.textContent = 'Loading profile...';
 const meResp = await fetch(`${window.WEB_APP_URL}?action=me&idToken=${encodeURIComponent(window.googleIdToken)}`);
 const meJson = await meResp.json();
 if (!meJson.ok) throw new Error(meJson.error || 'Backend error');
 window.currentUser = window.normalizeUser(meJson.data.user || {}) || {};
 window.currentUser.isAdmin = !!meJson.data.isAdmin;

 updateLoginTermsWarning_();

 window.updateTopBarAuth();
 const adminBtn = document.getElementById('adminPanelBtn');
 if (adminBtn) adminBtn.style.display = window.currentUser.isAdmin ? 'inline' : 'none';
 const ob = document.getElementById('onBehalfSection');
 if (ob) ob.style.display = window.currentUser.isAdmin ? 'block' : 'none';

 if (window.currentUser.isAdmin) { try { await window.adminLoadPlayers(); } catch { } }

 const hasSetup = !computeProfileIncomplete_(window.currentUser);
 const passedCaptcha = !!window.currentUser.captchaPassed;

 if (hasSetup && passedCaptcha) {
 localStorage.setItem('vak_captcha_ok', '1');
 window.hideRecaptchaWidget();
 window.hideSetupShowApp();
 } else {
 localStorage.removeItem('vak_captcha_ok');
 window.showSetupOnly();
 window.showRecaptchaWidget();
 }

 // highlight + deletion note only when profile incomplete
 setSetupHighlightAndNote_(window.currentUser);

 await window.refreshPinnedBalanceForActiveTarget();
 await window.refreshTopBarBalances();

 statusEl.textContent = 'Logged in.';
 window.refreshOpenOrders();
 } catch (e) {
 statusEl.textContent = 'Login error: ' + e.message;
 }
 };

 // Provide a small wrapper to refresh top-bar balances used by multiple places
 window.refreshTopBarBalances = window.refreshTopBarBalances || async function refreshTopBarBalances() {
 // try to compute and fetch balances for current user and target then call topbarSetAuthState
 try {
 const selfBal = (typeof window.fetchBalanceForUser === 'function' && window.currentUser) ? await window.fetchBalanceForUser(window.currentUser) : (window.currentBalanceBT ||0);
 let targetBal = null;
 if (window.currentUser?.isAdmin && window.submitForUser) {
 targetBal = (typeof window.fetchBalanceForUser === 'function') ? await window.fetchBalanceForUser(window.submitForUser) : null;
 }
 window.setCurrentBalance && window.setCurrentBalance(selfBal);
 if (window.topbarSetAuthState) {
 window.topbarSetAuthState({ idToken: window.googleIdToken || null, user: window.currentUser || null, isAdmin: !!window.currentUser?.isAdmin, balanceBT: selfBal });
 }
 return { selfBal, targetBal };
 } catch (e) {
 // swallow; callers handle error messages
 return null;
 }
 };

 // Initial state on load
 try { updateLoginTermsWarning_(); } catch { }

})();
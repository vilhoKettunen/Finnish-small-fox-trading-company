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
 // Delegate to shared panel helper (login-panel.js)
 if (typeof window.setLoginTermsWarningVisible_ === 'function') {
 window.setLoginTermsWarningVisible_(!window.googleIdToken);
 } else {
 setDisplay_('loginTermsWarning', !window.googleIdToken);
 }
 }

 // Ensure warning updates if some other script overwrites `window.googleIdToken` after this file loads.
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

 // Small DOM wait: SharedLogin may mount the login panel later (onload). If that happens
 // ensure the warning element receives correct visibility state as soon as it exists.
 (function ensureLoginWarningOnceMounted_() {
 const waitMs = 200; const max = 5000; let elapsed = 0;
 const t = setInterval(() => {
 const el = document.getElementById('loginTermsWarning');
 if (el) {
 try { updateLoginTermsWarning_(); } catch {};
 clearInterval(t);
 return;
 }
 elapsed += waitMs;
 if (elapsed >= max) clearInterval(t);
 }, waitMs);
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

 // expose minimal hook
 window.updateLoginTermsWarning = window.updateLoginTermsWarning || updateLoginTermsWarning_;
 window.updateLoginTermsWarning_ = window.updateLoginTermsWarning_ || updateLoginTermsWarning_;

 // submitSetup is defined in shared/login-panel.js and available globally.
 // We do NOT re-define it here to avoid overwriting the shared version.

 // ===== Missing UI helpers (needed by shared/login-panel.js + legacy flow) =====
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

 // ===== Balance globals (used by top bar + Combined Totals) =====
 // Always initialize to safe defaults, then overwrite from `me` immediately on login.
 window.currentBalanceBT = Number(window.currentBalanceBT) ||0;
 // Admin-only: preserved self balance while acting on-behalf
 if (window.topBalanceSelfBT === undefined) window.topBalanceSelfBT = undefined;

 window.getActiveTarget = window.getActiveTarget || function getActiveTarget() {
 return window.submitForUser || window.currentUser;
 };

 // Balance fetch helper used by admin (on-behalf) and pinned refresh
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

 window.setCurrentBalance = window.setCurrentBalance || function setCurrentBalance(bal) {
 window.currentBalanceBT = Number(bal) ||0;
 try { window.updateCombinedTotals && window.updateCombinedTotals(); } catch { }
 };

 // Make balance refresh helper context-aware: refresh target balance during on-behalf without overwriting admin self balance; refresh self balance when not on-behalf; update top bar silently.
 window.refreshPinnedBalanceForActiveTarget = window.refreshPinnedBalanceForActiveTarget || async function refreshPinnedBalanceForActiveTarget() {
 const target = window.getActiveTarget();
 if (!target || !window.googleIdToken) return;
 try {
 const bal = await window.fetchBalanceForUser(target);
 // If admin is acting on-behalf, treat this as a TARGET-balance refresh.
 // Keep admin self balance in `topBalanceSelfBT` unchanged.
 if (window.currentUser?.isAdmin && window.submitForUser) {
 window.setCurrentBalance && window.setCurrentBalance(bal);
 try {
 window.topbarSetAuthState && window.topbarSetAuthState({
 idToken: window.googleIdToken,
 user: window.currentUser,
 isAdmin: true,
 balanceBT: window.topBalanceSelfBT ?? window.currentBalanceBT,
 targetUser: window.submitForUser,
 targetBalanceBT: bal,
 targetLoading: false
 });
 } catch { }
 } else {
 // Regular users (and admins not on-behalf): refresh self balance.
 window.setCurrentBalance(bal);
 if (window.currentUser?.isAdmin) window.topBalanceSelfBT = Number(bal) ||0;
 try {
 window.topbarSetAuthState && window.topbarSetAuthState({
 idToken: window.googleIdToken,
 user: window.currentUser,
 isAdmin: !!window.currentUser?.isAdmin,
 balanceBT: window.currentBalanceBT,
 targetUser: null,
 targetBalanceBT: null,
 targetLoading: false
 });
 } catch { }
 }

 if (Array.isArray(window.sellCart)) {
 window.sellCart = window.sellCart.filter(e => !e.isAccountBalancePinned);
 try { window.renderSellList && window.renderSellList(); } catch { }
 try { window.calculateNet && window.calculateNet(); } catch { }
 }

 const st = document.getElementById('onBehalfStatus');
 if (st && window.submitForUser) {
 st.textContent = `Target set: ${target.playerName || target.email || target.userId}. Balance: ${Number(bal).toFixed(2)} EW`;
 }
 } catch (e) {
 const st = document.getElementById('onBehalfStatus');
 if (st) st.textContent = `Balance load failed: ${e.message}`;
 }
 };

 // In split version, open orders indicator may be absent; avoid crashing.
 window.refreshOpenOrders = window.refreshOpenOrders || function refreshOpenOrders() { };

 // ===== Google Identity (button + callback) =====
 window.initGoogleIdentity = window.initGoogleIdentity || function initGoogleIdentity() {
 if (!window.google || !google.accounts || !google.accounts.id) return;
 google.accounts.id.initialize({
 client_id: window.OAUTH_CLIENT_ID,
 callback: window.handleCredentialResponse,
 ux_mode: 'popup',
 auto_select: true,
 use_fedcm_for_prompt: true
 });

 const btnHost = document.getElementById('googleBtn');
 if (btnHost) {
 google.accounts.id.renderButton(btnHost, {
 theme: 'outline',
 size: 'large',
 type: 'standard',
 shape: 'rectangular',
 logo_alignment: 'left'
 });
 }
 };

 window.handleCredentialResponse = window.handleCredentialResponse || function handleCredentialResponse(resp) {
 // Guard: if cookie restore already succeeded, skip redundant full login flow
 if (window._autoLoginDone) return;
 window.onGoogleSignIn(resp);
 };

 window.startLogin = window.startLogin || function startLogin() {
 if (window.google && google.accounts && google.accounts.id) {
 try { google.accounts.id.prompt(); } catch { }
 }
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
 if (!window.googleIdToken) {
 if (statusEl) statusEl.textContent = 'Login error: no credential';
 updateLoginTermsWarning_();
 return;
 }
 if (statusEl) statusEl.textContent = 'Verifying token...';
 try {
 const tResp = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(window.googleIdToken)}`);
 if (!tResp.ok) throw new Error('tokeninfo failed ' + tResp.status);
 const info = await tResp.json();
 if (info.aud !== window.OAUTH_CLIENT_ID) throw new Error('Invalid audience');

 window.saveIdToken && window.saveIdToken(window.googleIdToken);
 if (statusEl) statusEl.textContent = 'Loading profile...';
 await onLoginMeApply_(window.googleIdToken);
 if (statusEl) statusEl.textContent = 'Logged in.';
 } catch (e) {
 if (statusEl) statusEl.textContent = 'Login error: ' + e.message;
 }
 };

 // Fast-path login apply (shared by silent restore and full login flow post-verification)
 async function onLoginMeApply_(idToken) {
 const meResp = await fetch(`${window.WEB_APP_URL}?action=me&idToken=${encodeURIComponent(idToken)}`);
 const meJson = await meResp.json();
 if (!meJson.ok) throw new Error(meJson.error || 'Backend error');
 window.currentUser = window.normalizeUser(meJson.data.user || {}) || {};
 window.currentUser.isAdmin = !!meJson.data.isAdmin;

 // Balance from `me` is correct at login time (no refetch needed).
 // For admins, preserve self-balance separately so on-behalf does not lose it.
 const meBal = Number(meJson.data?.user?.balanceBT);
 const safeMeBal = isFinite(meBal) ? meBal :0;
 if (window.currentUser.isAdmin) window.topBalanceSelfBT = safeMeBal;
 window.setCurrentBalance ? window.setCurrentBalance(safeMeBal) : (window.currentBalanceBT = safeMeBal);

 // Notify section panel of admin status
 window.IndexSectionPanel && window.IndexSectionPanel.onAdminChange(!!window.currentUser.isAdmin);

 updateLoginTermsWarning_();
 window.SharedLogin && window.SharedLogin.evaluateSetupForm(window.currentUser);

 // Optional early set (kept for compatibility with existing UI)
 const tempUser = Object.assign({}, window.currentUser);
 if (window.topbarSetAuthState) {
 window.topbarSetAuthState({
 idToken: window.googleIdToken,
 user: tempUser,
 isAdmin: !!window.currentUser.isAdmin,
 balanceBT: window.currentBalanceBT
 });
 }

 const adminBtn = document.getElementById('adminPanelBtn');
 if (adminBtn) adminBtn.style.display = window.currentUser.isAdmin ? 'inline' : 'none';
 const ob = document.getElementById('onBehalfSection');
 if (ob) ob.style.display = window.currentUser.isAdmin ? 'block' : 'none';
 const infraSec = document.getElementById('infraInvestSection');
 if (infraSec) infraSec.style.display = window.currentUser.isAdmin ? 'block' : 'none';

 if (window.currentUser.isAdmin) { try { await window.adminLoadPlayers(); } catch { } }

 const hasSetup = !computeProfileIncomplete_(window.currentUser);
 const passedCaptcha = !!window.currentUser.captchaPassed;

 const showRecap = () => {
 try { window.SharedLogin?.showRecaptcha && window.SharedLogin.showRecaptcha(); } catch { }
 try { window.showRecaptchaWidget && window.showRecaptchaWidget(); } catch { }
 };
 const hideRecap = () => {
 try { window.SharedLogin?.hideRecaptcha && window.SharedLogin.hideRecaptcha(); } catch { }
 try { window.hideRecaptchaWidget && window.hideRecaptchaWidget(); } catch { }
 };

 if (hasSetup && passedCaptcha) {
 localStorage.setItem('vak_captcha_ok', '1');
 hideRecap();
 window.hideSetupShowApp && window.hideSetupShowApp();
 } else {
 localStorage.removeItem('vak_captcha_ok');
 window.showSetupOnly && window.showSetupOnly();
 showRecap();
 }

 setSetupHighlightAndNote_(window.currentUser);

 // Do NOT refetch balance on initial login; balance already applied from `me`.
 // Still refresh pinned balance if other code expects sell-cart pinned cleanup.
 await window.refreshPinnedBalanceForActiveTarget();

 // Push final correct balance to topbar after balance is populated
 window.updateTopBarAuth && window.updateTopBarAuth();

 window.refreshOpenOrders && window.refreshOpenOrders();
 }

 // Silent restore — skips external tokeninfo re-verification
 window.tryRestoreAuthIndex_ = window.tryRestoreAuthIndex_ || async function tryRestoreAuthIndex_() {
 if (!window.initAuthFromStorage) return;
 try {
 const r = await window.initAuthFromStorage();
 if (!r || !r.ok || !r.idToken) return;
 // Mark as done so GSI auto_select callback won't double-fire
 window._autoLoginDone = true;
 window.googleIdToken = r.idToken;
 window.saveIdToken && window.saveIdToken(r.idToken);
 await onLoginMeApply_(r.idToken);
 } catch {
 // Backend rejected — clear cookie, allow GSI auto_select to try
 window.clearSavedIdToken && window.clearSavedIdToken();
 window._autoLoginDone = false;
 }
 };

 // Alias used by index.html onload
 window.tryRestoreAuthOnLoad = window.tryRestoreAuthOnLoad || window.tryRestoreAuthIndex_;

 // Initial state on load
 try { updateLoginTermsWarning_(); } catch { }

})();

// Recaptcha v2 explicit widget wrapper (solve once during onboarding)
(function () {
 'use strict';

 const SITE_KEY_ = () => window.RECAPTCHA_SITE_KEY;

 let widgetId_ = null;
 let lastToken_ = null;
 let didSolve_ = false;

 function _isReady_() {
 return !!(window.grecaptcha && typeof window.grecaptcha.render === 'function');
 }

 function _waitForGreCaptcha(timeoutMs =5000) {
 return new Promise((resolve) => {
 const start = Date.now();
 (function check() {
 if (_isReady_()) return resolve(true);
 if (Date.now() - start >= timeoutMs) return resolve(false);
 setTimeout(check,150);
 })();
 });
 }

 function _hideContainer_() {
 const c = document.getElementById('recaptchaContainer');
 if (c) c.style.display = 'none';
 }

 function _showContainer_() {
 const c = document.getElementById('recaptchaContainer');
 if (c) c.style.display = 'block';
 }

 function _ensureRendered_() {
 const key = SITE_KEY_();
 if (!key) return false;
 if (!_isReady_()) return false;

 const el = document.getElementById('recaptchaWidget');
 if (!el) return false;

 if (widgetId_ !== null) return true;

 widgetId_ = window.grecaptcha.render('recaptchaWidget', {
 sitekey: key,
 theme: 'light',
 callback: function (token) {
 lastToken_ = token || null;
 didSolve_ = !!lastToken_;

 // Hide after solve (token stored in memory for immediate `linkPlayer`)
 if (didSolve_) _hideContainer_();

 // Optional: notify listeners (login-panel uses this with the Verify button)
 try {
 if (window.__vakRecaptchaOnSolvedCb) window.__vakRecaptchaOnSolvedCb(lastToken_);
 } catch { /* ignore */ }
 },
 'expired-callback': function () {
 lastToken_ = null;
 didSolve_ = false;
 }
 });

 return true;
 }

 // Called by the reCAPTCHA script when loaded (index.html loads with onload=vakRecaptchaOnload&render=explicit)
 window.vakRecaptchaOnload = window.vakRecaptchaOnload || function vakRecaptchaOnload() {
 window.__vakRecaptchaLoaded = true;
 try { window.initRecaptcha && window.initRecaptcha(); } catch { /* ignore */ }
 };

 // Initialize: render ONLY if the container is currently visible/needed.
 window.initRecaptcha = window.initRecaptcha || function initRecaptcha() {
 const key = SITE_KEY_();
 if (!key) {
 console.warn('[recaptcha] RECAPTCHA_SITE_KEY missing; captcha will be disabled.');
 return;
 }

 // If user already passed per backend, never render.
 if (window.currentUser?.captchaPassed) {
 _hideContainer_();
 return;
 }

 // Render only if UI is actually showing the container.
 const c = document.getElementById('recaptchaContainer');
 const isVisible = !!(c && c.style.display !== 'none');
 if (!isVisible) return;

 try { _ensureRendered_(); } catch (e) { console.warn('[recaptcha] init/render failed', e); }
 };

 // Stable API for callers.
 // NOTE: returns last token (or null). Does NOT call execute() (this is v2 checkbox only).
 window.recaptchaWrap = window.recaptchaWrap || async function recaptchaWrap() {
 // If backend says passed, no token required.
 if (window.currentUser?.captchaPassed) return null;

 const key = SITE_KEY_();
 if (!key) return null;

 const ok = await _waitForGreCaptcha(5000);
 if (!ok) return null;

 // If container is hidden but captcha is required, show it and render.
 const c = document.getElementById('recaptchaContainer');
 if (c && c.style.display === 'none') _showContainer_();

 _ensureRendered_();

 if (widgetId_ !== null && typeof window.grecaptcha.getResponse === 'function') {
 const t = window.grecaptcha.getResponse(widgetId_) || '';
 lastToken_ = t ? String(t) : (lastToken_ || null);
 }

 return lastToken_ || null;
 };

 // Optional helpers (not required by existing code, but useful for future pages)
 window.vakRecaptcha = window.vakRecaptcha || {
 renderIfNeeded: function renderIfNeeded() {
 if (window.currentUser?.captchaPassed) {
 _hideContainer_();
 return { rendered: false, reason: 'already_passed' };
 }
 const c = document.getElementById('recaptchaContainer');
 if (!c || c.style.display === 'none') return { rendered: false, reason: 'container_hidden' };
 const rendered = _ensureRendered_();
 return { rendered };
 },
 getToken: function getToken() { return lastToken_ || null; },
 reset: function reset() {
 try {
 if (widgetId_ !== null && window.grecaptcha && typeof window.grecaptcha.reset === 'function') {
 window.grecaptcha.reset(widgetId_);
 }
 } catch { /* ignore */ }
 lastToken_ = null;
 didSolve_ = false;
 }
 };
})();
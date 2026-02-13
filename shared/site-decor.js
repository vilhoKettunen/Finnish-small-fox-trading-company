// Injects decorative side fox elements without requiring per-page HTML edits.
// Safe: does not modify existing layout DOM beyond adding fixed, aria-hidden divs.

(function () {
 function ensureDecor() {
 try {
 if (!document || !document.body) return;
 if (document.body.classList.contains('no-side-decor')) return;

 if (!document.querySelector('.site-decor-left')) {
 const left = document.createElement('div');
 left.className = 'site-decor-left';
 left.setAttribute('aria-hidden', 'true');
 document.body.insertBefore(left, document.body.firstChild);
 }

 if (!document.querySelector('.site-decor-right')) {
 const right = document.createElement('div');
 right.className = 'site-decor-right';
 right.setAttribute('aria-hidden', 'true');
 document.body.insertBefore(right, document.body.firstChild);
 }
 } catch {
 // no-op
 }
 }

 if (document.readyState === 'loading') {
 document.addEventListener('DOMContentLoaded', ensureDecor);
 } else {
 ensureDecor();
 }
})();

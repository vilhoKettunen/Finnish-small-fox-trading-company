// shared/site-footer.js
// Injects a shared footer onto pages that include this script.
(function () {
 'use strict';

 const FOOTER_ID = 'siteFooter';
 const CSS_HREF = 'css/shared/site-footer.css';
 const FOOTER_URL = 'shared/Footer.html';

 function injectCssOnce_() {
 const existing = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
 .find(l => (l.getAttribute('href') || '') === CSS_HREF);
 if (existing) return;

 const link = document.createElement('link');
 link.rel = 'stylesheet';
 link.href = CSS_HREF;

 // Fallback: if stylesheet fails to load, inject minimal inline styles
 link.addEventListener('error', () => {
 if (document.getElementById('siteFooter-inline-style')) return;
 const s = document.createElement('style');
 s.id = 'siteFooter-inline-style';
 s.textContent = `
#${FOOTER_ID}{margin-top:24px;padding:14px12px;border-top:1px solid rgba(0,0,0,.12);background:rgba(255,255,255,.75)}
#${FOOTER_ID} .siteFooter-inner{max-width:1100px;margin:0 auto;display:flex;gap:10px;align-items:baseline;justify-content:space-between;flex-wrap:wrap}
#${FOOTER_ID} .siteFooter-links{font-size:13px}
#${FOOTER_ID} .siteFooter-links a{color:#06c;text-decoration:none}
#${FOOTER_ID} .siteFooter-links a:hover{text-decoration:underline}
#${FOOTER_ID} .siteFooter-note{font-size:12px;color:rgba(0,0,0,.7)}
`;
 document.head.appendChild(s);
 });

 document.head.appendChild(link);
 }

 function alreadyInjected_() {
 return !!document.getElementById(FOOTER_ID);
 }

 function injectInlineFallbackFooter_() {
 if (alreadyInjected_()) return;
 const wrap = document.createElement('div');
 wrap.innerHTML = `
<footer id="${FOOTER_ID}" role="contentinfo" aria-label="Site footer">
 <div class="siteFooter-inner">
 <nav class="siteFooter-links" aria-label="Legal links">
 <a href="TermsAndConditions.html">Terms</a>
 <span class="siteFooter-sep">|</span>
 <a href="PrivacyPolicy.html">Privacy</a>
 </nav>
 <div class="siteFooter-note">Fan-made hobby project. Not affiliated with Vintage Story. No ads or monetization.</div>
 </div>
</footer>`;
 document.body.appendChild(wrap.firstElementChild);
 }

 async function injectFooter_() {
 if (alreadyInjected_()) return;

 try {
 const r = await fetch(FOOTER_URL, { cache: 'no-cache' });
 if (!r.ok) throw new Error('footer fetch failed: ' + r.status);
 const html = await r.text();
 if (alreadyInjected_()) return;

 const wrap = document.createElement('div');
 wrap.innerHTML = html;
 const el = wrap.querySelector('#' + FOOTER_ID) || wrap.firstElementChild;
 if (!el) throw new Error('footer markup missing');

 // Ensure links behave as requested (same tab)
 el.querySelectorAll('a[target]')?.forEach(a => a.removeAttribute('target'));

 document.body.appendChild(el);
 } catch (e) {
 console.warn('site-footer inject failed, using fallback:', e);
 injectInlineFallbackFooter_();
 }
 }

 function boot_() {
 injectCssOnce_();
 // Wait until body exists
 if (!document.body) {
 window.addEventListener('DOMContentLoaded', () => injectFooter_());
 return;
 }
 injectFooter_();
 }

 boot_();
})();

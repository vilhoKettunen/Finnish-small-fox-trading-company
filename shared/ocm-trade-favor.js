// Shared favor/disfavor helpers for OCM UI
(function () {
 'use strict';

 const ns = (window.OcmFavor = window.OcmFavor || {});

 function esc_(s) {
 return String(s || '')
 .replace(/&/g, '&amp;')
 .replace(/</g, '&lt;')
 .replace(/>/g, '&gt;')
 .replace(/"/g, '&quot;')
 .replace(/'/g, '&#39;');
 }

 function computePct(numerator, denominator) {
 const num = Number(numerator);
 const den = Number(denominator);
 if (!isFinite(num) || !isFinite(den) || den ===0) return null;
 return (1 - (num / den)) *100;
 }

 function formatLineHtml(who, pct) {
 if (pct == null || !isFinite(pct)) return '';
 const p = Number(pct);
 const abs = Math.abs(p).toFixed(1);
 const good = p >=0;
 const cls = good ? 'good' : 'bad';
 const label = good ? 'favor' : 'disfavor';
 const word = good ? 'cheaper' : 'more expensive';
 return `<span class="trade-favor ${cls}">${esc_(who)} ${label}: ${esc_(abs)}% ${word} compared to store</span>`;
 }

 function renderLine(el, who, pct) {
 if (!el) return;
 const html = formatLineHtml(who, pct);
 if (!html) { el.style.display = 'none'; el.innerHTML = ''; return; }
 el.innerHTML = html;
 el.style.display = '';
 }

 ns.computePct = computePct;
 ns.formatLineHtml = formatLineHtml;
 ns.renderLine = renderLine;
})();

// Shared “More info” listing renderer (Admin: review queue)
// Provides a robust details row for listing review queue.

(function () {
 'use strict';

 const esc = (s) => String(s ?? '')
 .replace(/&/g, '&amp;')
 .replace(/</g, '&lt;')
 .replace(/>/g, '&gt;')
 .replace(/"/g, '&quot;')
 .replace(/'/g, '&#39;');

 function safeJsonParse(s, fallback = null) {
 try { return JSON.parse(s); } catch { return fallback; }
 }

 function statusPill(statusRaw) {
 const s = String(statusRaw || '').toUpperCase();
 if (s === 'ACTIVE') return '<span class="pill pill-active">ACTIVE</span>';
 if (s === 'PENDING_REVIEW') return '<span class="pill pill-pending">PENDING_REVIEW</span>';
 if (s === 'PAUSED') return '<span class="pill pill-paused">PAUSED</span>';
 if (s === 'REJECTED') return '<span class="pill pill-rejected">REJECTED</span>';
 if (s === 'DELETED') return '<span class="pill">DELETED</span>';
 return `<span class="pill">${esc(s || '—')}</span>`;
 }

 function pricingSummary_(pricing) {
 const p = pricing || {};
 const mode = String(p.mode || '').toUpperCase();
 if (mode === 'FIXED_BT') {
 const v = Number(p.fixedBTPerUnit ?? p.fixedBtPerUnit ??0) ||0;
 return `FIXED_BT: <strong>${v.toFixed(2)} BT</strong> per unit`;
 }

 const prim = p.primaryPeg || (p.pegItemName ? {
 itemName: p.pegItemName,
 pegQtyPerInd: p.pegQtyPerInd ?? p.pegQtyPerUnit,
 ui: { priceBasis: p.pricingBasis || 'IND' }
 } : null);

 if (!prim || !prim.itemName) return 'PEG: —';

 const qty = Number(prim.pegQtyPerInd ?? prim.pegQtyPerUnit ??0) ||0;
 const basis = String(prim.ui?.priceBasis || p.pricingBasis || 'IND').toUpperCase();
 const altCount = Array.isArray(p.altPegs) ? p.altPegs.length :0;
 return `PEG: <strong>${qty}</strong> ${esc(prim.itemName)} (${esc(basis)}${altCount ? ` +${altCount} alts` : ''})`;
 }

 function rawDetailsObj_(listingObj) {
 // try to parse any embedded json fields
 const extra = listingObj?.extraJson ? safeJsonParse(listingObj.extraJson, listingObj.extraJson) : null;
 return { listing: listingObj, extraJson: extra };
 }

 function renderListingNiceHtml(listingObj, sellerLabel) {
 const l = listingObj || {};
 const seller = sellerLabel || '';

 const lines = [];
 lines.push(`<div class="small"><strong>Listing details</strong></div>`);
 lines.push(`<div class="small" style="margin-top:6px;">Seller: ${esc(seller)}</div>`);

 lines.push(`<div class="small" style="margin-top:6px;">` + [
 `<span class="pill-lite">${esc(String(l.type || '').toUpperCase() || '—')}</span>`,
 `<span class="pill-lite">${statusPill(l.status || l.statusRaw)}</span>`,
 l.isInvalidQty ? `<span class="pill-lite warn">INVALID QTY</span>` : ''
 ].filter(Boolean).join(' ') + `</div>`);

 const qty = (l.remainingQuantity != null) ? l.remainingQuantity : (l.qtyAvailable ?? l.quantity ?? '');
 const stack = Number(l.stackSize ||1) ||1;

 lines.push(`<div class="details-grid" style="margin-top:10px;">`
 + `<div><div class="small">ListingId</div><div class="mono">${esc(l.listingId || '')}</div></div>`
 + `<div><div class="small">Item</div><div>${esc(l.itemName || '')}</div></div>`
 + `<div><div class="small">Qty</div><div class="mono">${esc(qty)}</div></div>`
 + `<div><div class="small">Stack size</div><div class="mono">${esc(stack)}</div></div>`
 + `<div><div class="small">Updated</div><div class="mono">${esc(l.updatedAt || '')}</div></div>`
 + `<div><div class="small">Pricing</div><div>${pricingSummary_(l.pricing)}</div></div>`
 + `</div>`);

 const rawObj = rawDetailsObj_(l);
 const raw = esc(JSON.stringify(rawObj, null,2));
 const tid = 'raw_listing_' + Math.random().toString(36).slice(2);
 const bodyId = tid + '_body';

 lines.push(`
<div style="margin-top:10px;">
 <button type="button" data-raw-toggle="${esc(tid)}">Show raw details</button>
 <div id="${esc(bodyId)}" style="display:none; margin-top:8px;">
 <pre class="mono" style="white-space:pre-wrap;margin:0;">${raw}</pre>
 </div>
</div>`);

 return `<div class="details-box">${lines.join('')}</div>`;
 }

 function hookRawToggle(container) {
 container.querySelectorAll('button[data-raw-toggle]').forEach(btn => {
 btn.addEventListener('click', () => {
 const tid = btn.getAttribute('data-raw-toggle');
 const body = container.querySelector('#' + tid + '_body');
 if (!body) return;
 const open = body.style.display !== 'none';
 body.style.display = open ? 'none' : 'block';
 btn.textContent = open ? 'Show raw details' : 'Hide raw details';
 });
 });
 }

 function toggleDetailsRow(mainRow, listingObj, sellerLabel, colSpan) {
 const nxt = mainRow.nextElementSibling;
 if (nxt && nxt.classList.contains('details-row')) {
 nxt.remove();
 return;
 }

 const detailsTr = document.createElement('tr');
 detailsTr.className = 'details-row';

 const td = document.createElement('td');
 td.colSpan = Number(colSpan ||1);

 td.innerHTML = renderListingNiceHtml(listingObj, sellerLabel);
 detailsTr.appendChild(td);

 mainRow.parentNode.insertBefore(detailsTr, mainRow.nextSibling);
 hookRawToggle(td);
 }

 window.ListingMoreInfo = {
 esc,
 safeJsonParse,
 renderListingNiceHtml,
 toggleDetailsRow
 };

 window.__ListingMoreInfoLoaded = true;
})();

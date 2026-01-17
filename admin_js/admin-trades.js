// Trades tab (pending trades + review queue)
(function () {
 'use strict';

 const Admin = window.Admin;
 const byId = Admin.byId;
 const esc = Admin.esc;
 const safeJsonParse = Admin.safeJsonParse;

 function statusPill(statusRaw) {
 const s = String(statusRaw || '').toUpperCase();
 if (s === 'ACTIVE') return '<span class="pill pill-active">ACTIVE</span>';
 if (s === 'PENDING_REVIEW') return '<span class="pill pill-pending">PENDING_REVIEW</span>';
 if (s === 'PAUSED') return '<span class="pill pill-paused">PAUSED</span>';
 if (s === 'REJECTED') return '<span class="pill pill-rejected">REJECTED</span>';
 if (s === 'DELETED') return '<span class="pill">DELETED</span>';
 return `<span class="pill">${esc(s || '—')}</span>`;
 }

 function parseDetailsJsonSafe_(s) {
 return safeJsonParse(String(s || ''), null) || null;
 }

 function renderRawJsonToggleHtml_(obj, toggleId) {
 const tid = toggleId || ('raw_' + Math.random().toString(36).slice(2));
 const bodyId = tid + '_body';
 const raw = esc(typeof obj === 'string' ? obj : JSON.stringify(obj || {}, null,2));
 return `
 <div style="margin-top:10px;">
 <button type="button" data-raw-toggle="${esc(tid)}">Show raw details</button>
 <div id="${esc(bodyId)}" style="display:none; margin-top:8px;">
 <pre class="mono" style="white-space:pre-wrap;margin:0;">${raw}</pre>
 </div>
 </div>
 `;
 }

 function hookRawToggle_(container) {
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

 function normQty_(units, stackSize) {
 const u = Number(units ||0);
 if (!isFinite(u)) return '0';
 const ss = Number(stackSize ||1) ||1;
 if (ss >1) return `${u} (? ${Math.ceil(u / ss)} stack @${ss})`;
 return String(u);
 }

 function renderTradeNiceHtml_(snap, buyerLabel, sellerLabel) {
 const listing = snap?.listing || {};
 const request = snap?.request || {};
 const payment = snap?.payment || {};
 const pricing = snap?.pricing || {};

 const listingType = String(listing.type || '').toUpperCase();
 const itemName = listing.itemName || '';
 const stackSize = Number(listing.stackSize ||1) ||1;
 const requestedUnits = Number(request.requestedUnits ||0) ||0;

 // Semantics (confirmed in fix_admin.txt)
 // SELL listing: seller gives traded item, buyer pays.
 // BUY listing: buyer gives traded item, seller pays.
 const sellerGives = [];
 const buyerPays = [];

 const tradedLine = `${normQty_(requestedUnits, stackSize)} × ${esc(itemName)}`;

 if (listingType === 'SELL') {
 sellerGives.push(tradedLine);
 } else if (listingType === 'BUY') {
 // buyer gives the traded item to seller
 // (but we still label columns per request: Seller gives / Buyer pays)
 // Seller gives = (none for traded item)
 }

 // Payment lines
 const method = String(payment.method || 'BT').toUpperCase();
 if (method === 'ITEM') {
 const payItemName = payment.payItemName || '';
 const payItemQty = payment.payItemQty ||0;
 const payLine = `${esc(payItemQty)} × ${esc(payItemName)}`;

 // Buyer pays always represents the payer side.
 buyerPays.push(payLine);
 } else {
 const bt = Number(payment.canonicalBT ?? payment.payTotalBT ??0) ||0;
 buyerPays.push(`${bt.toFixed(2)} BT`);
 }

 // For BUY listing, seller gives traded item? no. Buyer gives traded item.
 // We keep labels as requested; to avoid confusion, show an extra note line.
 let directionNote = '';
 if (listingType === 'BUY') {
 directionNote = `<div class="small warn">Note: This is a BUY listing. Buyer gives the traded item to the seller; seller pays the buyer.</div>`;
 }

 const primaryBasis = esc(String(pricing.pricingBasis || ''));
 const canonicalBT = payment.canonicalBT != null ? Number(payment.canonicalBT ||0) : null;
 const selectedPegBT = payment.selectedPegBT != null ? Number(payment.selectedPegBT ||0) : null;

 const listHtml = (arr) => arr.length
 ? `<div>${arr.map(x => `<div class="picklist-item">${x}</div>`).join('')}</div>`
 : `<div class="picklist-empty">Nothing</div>`;

 const rawToggle = renderRawJsonToggleHtml_(snap, 'trade_raw_' + Math.random().toString(36).slice(2));

 return `
 <div class="details-box">
 <div class="small"><strong>Trade summary</strong></div>
 <div class="small" style="margin-top:6px;">
 <span class="pill-lite">${esc(listingType || '—')}</span>
 <span class="pill-lite">Payment: ${esc(method)}</span>
 ${primaryBasis ? `<span class="pill-lite">Basis: ${primaryBasis}</span>` : ''}
 </div>
 ${directionNote}

 <div class="details-grid" style="margin-top:10px;">
 <div class="picklist-col give">
 <h4>Seller gives</h4>
 <div class="small">${esc(sellerLabel || '')}</div>
 ${listHtml(sellerGives)}
 </div>
 <div class="picklist-col take">
 <h4>Buyer pays</h4>
 <div class="small">${esc(buyerLabel || '')}</div>
 ${listHtml(buyerPays)}
 </div>
 </div>

 <div class="small" style="margin-top:10px;">
 ${canonicalBT != null ? `Canonical BT: <strong>${canonicalBT.toFixed(2)} BT</strong>` : ''}
 ${selectedPegBT != null ? ` &nbsp;|&nbsp; Selected-peg BT: <strong>${selectedPegBT.toFixed(2)} BT</strong>` : ''}
 </div>

 ${rawToggle}
 </div>
 `;
 }

 function renderListingNiceHtml_(l, sellerLabel) {
 const pricing = l.pricing || {};
 const listingMode = pricing.listingMode || (Admin.safeJsonParse(l.extraJson || '{}') || {}).listingMode || '';

 const lines = [];
 lines.push(`<div><strong>ListingId:</strong> <span class="mono">${esc(l.listingId)}</span></div>`);
 lines.push(`<div><strong>Seller:</strong> ${esc(sellerLabel || '')}</div>`);
 lines.push(`<div><strong>Type:</strong> ${esc(l.type || '')} &nbsp; <strong>Status:</strong> ${statusPill(l.status || l.statusRaw)}</div>`);
 lines.push(`<div><strong>Item:</strong> ${esc(l.itemName || '')}</div>`);
 lines.push(`<div><strong>Qty (ind):</strong> <span class="mono">${esc(l.remainingQuantity)}</span> &nbsp; <strong>Stack:</strong> <span class="mono">${esc(l.stackSize ||1)}</span></div>`);
 lines.push(`<div><strong>Listing mode:</strong> ${esc(String(listingMode || '').toUpperCase())} &nbsp; <strong>Pricing mode:</strong> ${esc(pricing.mode || '')}</div>`);

 if (pricing.mode === 'FIXED_BT') {
 lines.push(`<div><strong>Fixed:</strong> ${Number(pricing.fixedBTPerUnit ||0).toFixed(2)} BT/unit</div>`);
 } else {
 const prim = pricing.primaryPeg;
 if (prim?.itemName) {
 lines.push(`<div><strong>Primary peg:</strong> ${esc(prim.itemName)} × ${Number(prim.pegQtyPerInd ||0)} (per ind)</div>`);
 }
 const alts = Array.isArray(pricing.altPegs) ? pricing.altPegs : [];
 if (alts.length) {
 lines.push(`<div><strong>Alt pegs:</strong> ${alts.map(p => esc(p.itemName)).join(', ')}</div>`);
 }
 }

 const rawToggle = renderRawJsonToggleHtml_(l, 'listing_raw_' + Math.random().toString(36).slice(2));

 return `
 <div class="details-box">
 <div class="small"><strong>Listing summary</strong></div>
 <div class="small" style="margin-top:8px;">${lines.join('')}</div>
 ${rawToggle}
 </div>
 `;
 }

 function updateTradeFilterIndicators_() {
 const filtName = Admin.state.adminPendingTradesFilterUserId
 ? (window.resolveNameMailbox_(Admin.state.adminPendingTradesFilterUserId).name)
 : 'All users';
 byId('pendingTradesFilterIndicator').textContent = `Filtered to: ${esc(filtName)}`;
 }

 window.loadAdminAllPendingTrades = async function loadAdminAllPendingTrades() {
 if (!Admin.state.googleIdToken) return;
 byId('pendingTradesMsg').textContent = 'Loading...';
 updateTradeFilterIndicators_();

 try {
 const r = await window.apiGet('ocmAdminListAllPendingTradesV2', {
 idToken: Admin.state.googleIdToken,
 userId: Admin.state.adminPendingTradesFilterUserId || ''
 });
 const d = r.data || r.result || r;
 Admin.state.adminAllPendingTrades = d.trades || [];
 renderAdminAllPendingTrades_();
 byId('pendingTradesMsg').textContent = `Loaded ${Admin.state.adminAllPendingTrades.length}.`;
 } catch (e) {
 Admin.state.adminAllPendingTrades = [];
 renderAdminAllPendingTrades_();
 byId('pendingTradesMsg').textContent = 'Error: ' + e.message;
 }
 };

 function tradeSnapshotSummary_(tr) {
 const snap = parseDetailsJsonSafe_(tr.detailsJson) || {};
 const item = snap.listing?.itemName || '';
 const qty = Number(snap.request?.requestedUnits || tr.quantity ||0);
 const payment = snap.payment?.method || '';
 const updatedAt = tr.updatedAt || '';
 return { snap, item, qty, payment, updatedAt };
 }

 function renderAdminAllPendingTrades_() {
 const tb = byId('tbAllPendingTrades');
 tb.innerHTML = '';

 (Admin.state.adminAllPendingTrades || []).forEach(tr => {
 const { snap, item, qty, payment, updatedAt } = tradeSnapshotSummary_(tr);

 const b = window.resolveNameMailbox_(tr.buyerUserId);
 const s = window.resolveNameMailbox_(tr.sellerUserId);

 const row = document.createElement('tr');
 row.innerHTML = `
 <td class="mono">${esc(tr.tradeId)}</td>
 <td>${esc(item)}</td>
 <td>${esc(b.name)}<div class="small">Mailbox: <span class="mono">${esc(b.mailbox)}</span></div></td>
 <td>${esc(s.name)}<div class="small">Mailbox: <span class="mono">${esc(s.mailbox)}</span></div></td>
 <td class="mono">${esc(qty)}</td>
 <td class="mono">${esc(payment)}</td>
 <td class="status-pending">${esc(tr.status || 'PENDING')}</td>
 <td class="mono">${esc(updatedAt)}</td>
 <td>
 <button type="button" data-more="1">Show more info</button>
 <button type="button" data-accept="1">Accept (Admin10%)</button>
 <button type="button" data-deny="1">Deny</button>
 </td>
 `;

 row.querySelector('button[data-accept]')?.addEventListener('click', async () => {
 if (!confirm(`Accept trade ${tr.tradeId} as admin? (10% fee)`)) return;
 try {
 await window.apiPost('ocmAcceptTradeAsAdminV2', { idToken: Admin.state.googleIdToken, tradeId: tr.tradeId });
 await window.loadAdminAllPendingTrades();
 } catch (e) { alert(e.message); }
 });

 row.querySelector('button[data-deny]')?.addEventListener('click', async () => {
 if (!confirm(`Deny trade ${tr.tradeId}?`)) return;
 try {
 await window.apiPost('ocmDenyTradeV2', { idToken: Admin.state.googleIdToken, tradeId: tr.tradeId });
 await window.loadAdminAllPendingTrades();
 } catch (e) { alert(e.message); }
 });

 row.querySelector('button[data-more]')?.addEventListener('click', () => toggleTradeDetailsRow_(row, snap, b, s));

 tb.appendChild(row);
 });
 }

 function toggleTradeDetailsRow_(mainRow, snapObj, buyer, seller) {
 const nxt = mainRow.nextElementSibling;
 if (nxt && nxt.classList.contains('details-row')) { nxt.remove(); return; }

 const detailsTr = document.createElement('tr');
 detailsTr.className = 'details-row';
 const td = document.createElement('td');
 td.colSpan =9;

 const buyerLabel = `${buyer?.name || ''} (Mailbox ${buyer?.mailbox || 'N/A'})`;
 const sellerLabel = `${seller?.name || ''} (Mailbox ${seller?.mailbox || 'N/A'})`;
 td.innerHTML = renderTradeNiceHtml_(snapObj || {}, buyerLabel, sellerLabel);

 detailsTr.appendChild(td);
 mainRow.parentNode.insertBefore(detailsTr, mainRow.nextSibling);

 hookRawToggle_(td);
 }

 window.filterPendingTradesToTarget_ = function filterPendingTradesToTarget_() {
 if (!Admin.state.globalTargetUser) { alert('Select a target user first.'); return; }
 Admin.state.adminPendingTradesFilterUserId = Admin.state.globalTargetUser.userId;
 window.loadAdminAllPendingTrades();
 };

 window.clearPendingTradesFilter_ = function clearPendingTradesFilter_() {
 Admin.state.adminPendingTradesFilterUserId = null;
 window.loadAdminAllPendingTrades();
 };

 function updateReviewQueueIndicator_() {
 const filtName = Admin.state.adminReviewQueueFilterUserId
 ? (window.resolveNameMailbox_(Admin.state.adminReviewQueueFilterUserId).name)
 : 'All users';
 byId('reviewQueueFilterIndicator').textContent = `Filtered to: ${esc(filtName)}`;
 }

 window.loadAdminReviewQueue = async function loadAdminReviewQueue() {
 if (!Admin.state.googleIdToken) return;
 byId('reviewQueueMsg').textContent = 'Loading...';
 updateReviewQueueIndicator_();

 try {
 const r = await window.apiGet('ocmListListingReviewQueue', {
 idToken: Admin.state.googleIdToken,
 userId: Admin.state.adminReviewQueueFilterUserId || ''
 });
 const d = r.data || r.result || r;
 Admin.state.adminReviewQueue = d.listings || [];
 renderAdminReviewQueue_();
 byId('reviewQueueMsg').textContent = `Loaded ${Admin.state.adminReviewQueue.length}.`;
 } catch (e) {
 Admin.state.adminReviewQueue = [];
 renderAdminReviewQueue_();
 byId('reviewQueueMsg').textContent = 'Error: ' + e.message;
 }
 };

 function renderAdminReviewQueue_() {
 const tb = byId('tbReviewQueue');
 tb.innerHTML = '';

 (Admin.state.adminReviewQueue || []).forEach(l => {
 const seller = window.resolveNameMailbox_(l.sellerUserId);
 const notes = [];
 if (l.isInvalidQty) notes.push('<span class="warn">INVALID QTY</span>');

 const row = document.createElement('tr');
 row.innerHTML = `
 <td class="mono">${esc(l.listingId)}</td>
 <td>${esc(l.itemName || '')}</td>
 <td>${l.type === 'SELL' ? '<span class="pill pill-sell">SELL</span>' : '<span class="pill pill-buy">BUY</span>'}</td>
 <td>${statusPill(l.status || l.statusRaw)}</td>
 <td class="mono">${esc(l.remainingQuantity)}</td>
 <td class="mono">${esc(Number(l.stackSize ||1) ||1)}</td>
 <td>${esc(seller.name)}<div class="small">Mailbox: <span class="mono">${esc(seller.mailbox)}</span> ${notes.length ? (' | ' + notes.join(' ')) : ''}</div></td>
 <td class="mono">${esc(l.updatedAt || '')}</td>
 <td>
 <button type="button" data-more="1">Show more info</button>
 <button type="button" data-approve="1">Approve</button>
 <button type="button" data-reject="1">Reject</button>
 </td>
 `;

 row.querySelector('button[data-approve]')?.addEventListener('click', async () => {
 if (!confirm(`Approve listing ${l.listingId}? (becomes ACTIVE)`)) return;
 try {
 await window.apiPost('ocmApproveListingV2', { idToken: Admin.state.googleIdToken, listingId: l.listingId });
 await window.loadAdminReviewQueue();
 } catch (e) { alert(e.message); }
 });

 row.querySelector('button[data-reject]')?.addEventListener('click', async () => {
 if (!confirm(`Reject listing ${l.listingId}? (becomes REJECTED)`)) return;
 try {
 await window.apiPost('ocmRejectListingV2', { idToken: Admin.state.googleIdToken, listingId: l.listingId });
 await window.loadAdminReviewQueue();
 } catch (e) { alert(e.message); }
 });

 row.querySelector('button[data-more]')?.addEventListener('click', () => toggleListingDetailsRow_(row, l, seller));

 tb.appendChild(row);
 });
 }

 function toggleListingDetailsRow_(mainRow, listingObj, seller) {
 const nxt = mainRow.nextElementSibling;
 if (nxt && nxt.classList.contains('details-row')) { nxt.remove(); return; }

 const detailsTr = document.createElement('tr');
 detailsTr.className = 'details-row';
 const td = document.createElement('td');
 td.colSpan =9;

 const sellerLabel = `${seller?.name || ''} (Mailbox ${seller?.mailbox || 'N/A'})`;
 td.innerHTML = renderListingNiceHtml_(listingObj, sellerLabel);

 detailsTr.appendChild(td);
 mainRow.parentNode.insertBefore(detailsTr, mainRow.nextSibling);

 hookRawToggle_(td);
 }

 window.filterReviewQueueToTarget_ = function filterReviewQueueToTarget_() {
 if (!Admin.state.globalTargetUser) { alert('Select a target user first.'); return; }
 Admin.state.adminReviewQueueFilterUserId = Admin.state.globalTargetUser.userId;
 window.loadAdminReviewQueue();
 };

 window.clearReviewQueueFilter_ = function clearReviewQueueFilter_() {
 Admin.state.adminReviewQueueFilterUserId = null;
 window.loadAdminReviewQueue();
 };
})();

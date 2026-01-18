// Pending trades tables + trade edit dialog for OCMUser
(function () {
 'use strict';

 const O = window.OCMUser;
 const S = O.state;
 const byId = O.byId;
 const esc = O.esc;
 const safeJsonParse = O.safeJsonParse;

 // ===== Mailbox cache (similar to Admin players cache) =====
 let playersCache_ = [];

 async function ensurePlayersLoaded_() {
 if (!S.googleIdToken) return;
 if (playersCache_ && playersCache_.length) return;
 try {
 const r = await window.apiGet('adminListPlayers', { idToken: S.googleIdToken });
 const arr = (r.data || r.result || r);
 playersCache_ = Array.isArray(arr) ? arr : (arr.players || []);
 } catch (e) {
 // OCMUser may not have admin rights; fall back to N/A.
 playersCache_ = [];
 }
 }

 function resolveNameMailbox_(uid, fallbackName) {
 const p = (playersCache_ || []).find(x => String(x.userId) === String(uid)) || null;
 return {
 name: p?.playerName || p?.email || fallbackName || String(uid || ''),
 mailbox: (p && p.mailbox) ? p.mailbox : 'N/A'
 };
 }

 function clearUI() {
 byId('tbSellListings').innerHTML = '';
 byId('tbBuyListings').innerHTML = '';
 byId('tbPendingListings').innerHTML = '';
 byId('tbMine').innerHTML = '';
 byId('tbIncoming').innerHTML = '';
 }

 async function loadPendingRequests() {
 if (!S.googleIdToken) return;

 // Best-effort mailbox enrichment
 await ensurePlayersLoaded_();

 byId('msgMine').textContent = 'Loading...';
 try {
 const r = await apiGet('ocmMyPendingTradesV2', { idToken: S.googleIdToken });
 const d = r.data || r.result || r;
 renderPendingTable(byId('tbMine'), d.trades || [], true);
 byId('msgMine').textContent = `Loaded ${(d.trades || []).length}.`;
 } catch (e) {
 byId('msgMine').textContent = 'Error: ' + e.message;
 }

 byId('msgIncoming').textContent = 'Loading...';
 try {
 const r = await apiGet('ocmIncomingPendingTradesV2', { idToken: S.googleIdToken });
 const d = r.data || r.result || r;
 renderPendingTable(byId('tbIncoming'), d.trades || [], false);
 byId('msgIncoming').textContent = `Loaded ${(d.trades || []).length}.`;
 } catch (e) {
 byId('msgIncoming').textContent = 'Error: ' + e.message;
 }
 }

 function tradeSummary(tr) {
 const s = safeJsonParse(tr.detailsJson || '{}', {}) || {};
 const supportsItem = !!(s.pricing?.primaryPeg?.itemName || s.pricing?.pegItemName);

 const uid = S.currentUser?.userId;
 const isMine = String(tr.buyerUserId) === String(uid);

 return {
 snap: s,
 item: s.listing?.itemName || '',
 counterparty: isMine ? (s.seller?.playerName || '') : (s.buyer?.playerName || ''),
 payment: s.payment?.method || 'BT',
 qty: Number(s.request?.requestedUnits || tr.quantity ||0),
 supportsItem
 };
 }

 function renderPendingTable(tb, arr, mine) {
 tb.innerHTML = '';
 (arr || []).forEach(tr => {
 const sum = tradeSummary(tr);
 const row = document.createElement('tr');
 row.innerHTML = `
 <td class="mono">${esc(tr.tradeId)}</td>
 <td>${esc(sum.item)}</td>
 <td>${esc(sum.counterparty)}</td>
 <td class="mono">${sum.qty}</td>
 <td class="mono">${esc(sum.payment)}</td>
 <td>
 <button type="button" data-more="1">More info</button>
 ${mine
 ? '<button type="button" data-edit="1">Edit</button> <button type="button" data-cancel="1">Cancel</button>'
 : '<button type="button" data-accept="1">Accept</button> <button type="button" data-deny="1">Deny</button>'}
 </td>
 `;

 row.querySelector('button[data-more]')?.addEventListener('click', () => {
 const snapObj = sum.snap || safeJsonParse(tr.detailsJson || '{}', {}) || {};

 const b = resolveNameMailbox_(tr.buyerUserId, snapObj?.buyer?.playerName);
 const s = resolveNameMailbox_(tr.sellerUserId, snapObj?.seller?.playerName);

 const buyerLabel = `${b?.name || ''} (Mailbox ${b?.mailbox || 'N/A'})`;
 const sellerLabel = `${s?.name || ''} (Mailbox ${s?.mailbox || 'N/A'})`;

 if (window.TradeMoreInfo && window.TradeMoreInfo.toggleDetailsRow) {
 window.TradeMoreInfo.toggleDetailsRow(row, snapObj, buyerLabel, sellerLabel,6);
 } else {
 // fallback to the local renderer if shared isn't loaded
 const buyer = { name: b?.name || '', mailbox: b?.mailbox || 'N/A' };
 const seller = { name: s?.name || '', mailbox: s?.mailbox || 'N/A' };
 tradeDetailsToggleCleanLocal_(row, snapObj, buyer, seller,6);
 }
 });

 if (mine) {
 row.querySelector('button[data-cancel]')?.addEventListener('click', async () => {
 if (!confirm('Cancel trade ' + tr.tradeId + '?')) return;
 await apiPost('ocmCancelTradeRequestV2', { idToken: S.googleIdToken, tradeId: tr.tradeId });
 await loadPendingRequests();
 });
 row.querySelector('button[data-edit]')?.addEventListener('click', () => openEditTrade(tr, sum));
 } else {
 row.querySelector('button[data-accept]')?.addEventListener('click', async () => {
 if (!confirm('Accept and complete trade ' + tr.tradeId + ' as seller? (0% fee)')) return;
 await apiPost('ocmAcceptTradeAsSellerV2', { idToken: S.googleIdToken, tradeId: tr.tradeId });
 await loadPendingRequests();
 });
 row.querySelector('button[data-deny]')?.addEventListener('click', async () => {
 if (!confirm('Deny trade ' + tr.tradeId + '?')) return;
 await apiPost('ocmDenyTradeV2', { idToken: S.googleIdToken, tradeId: tr.tradeId });
 await loadPendingRequests();
 });
 }

 tb.appendChild(row);
 });
 }

 // ===== Existing local renderer (kept as fallback) =====
 function tradeDetailsToggleCleanLocal_(mainRow, snapObj, buyer, seller, colSpanOverride) {
 const nxt = mainRow.nextElementSibling;
 if (nxt && nxt.classList.contains('details-row')) { nxt.remove(); return; }
 const detailsTr = document.createElement('tr');
 detailsTr.className = 'details-row';
 const td = document.createElement('td');
 td.colSpan = Number(colSpanOverride ||6);
 const buyerLabel = `${buyer?.name || ''} (Mailbox ${buyer?.mailbox || 'N/A'})`;
 const sellerLabel = `${seller?.name || ''} (Mailbox ${seller?.mailbox || 'N/A'})`;
 td.innerHTML = renderTradeNiceHtml_Local_(snapObj || {}, buyerLabel, sellerLabel);
 detailsTr.appendChild(td);
 mainRow.parentNode.insertBefore(detailsTr, mainRow.nextSibling);
 hookRawToggle_Local_(td);
 }

 function renderTradeNiceHtml_Local_(snap, buyerLabel, sellerLabel) {
 const listing = snap?.listing || {};
 const request = snap?.request || {};
 const payment = snap?.payment || {};
 const pricing = snap?.pricing || {};

 const listingType = String(listing.type || '').toUpperCase();
 const itemName = sanitizeItemName_Local(listing.itemName || '');
 const stackSize = Number(listing.stackSize ||1) ||1;
 const requestedUnits = Number(request.requestedUnits ||0) ||0;

 const merchantLabel = (listingType === 'SELL') ? (sellerLabel || '') : (buyerLabel || '');
 const customerLabel = (listingType === 'SELL') ? (buyerLabel || '') : (sellerLabel || '');

 const leftLines = [];
 const rightLines = [];

 const tradedLine = `${esc(normQty_Local_(requestedUnits, stackSize))} ${esc(itemName)}`;
 if (listingType === 'SELL' || listingType === 'BUY') leftLines.push(tradedLine);

 const method = String(payment.method || 'BT').toUpperCase();
 if (method === 'ITEM') {
 const payItemName = sanitizeItemName_Local(payment.payItemName || payment.payItem || '');
 const payItemQty = payment.payItemQty || payment.pegQtyPerInd ||0;
 rightLines.push(`${esc(payItemQty)} ${esc(payItemName)}`);
 } else {
 const bt = Number(payment.canonicalBT ?? payment.payTotalBT ??0) ||0;
 rightLines.push(`${bt.toFixed(2)} BT`);
 }

 const leftHeader = (listingType === 'BUY') ? 'Merchant takes' : 'Merchant gives';
 const rightHeader = (listingType === 'BUY') ? 'Customer receives' : 'Customer pays';

 const primaryBasis = esc(String(pricing.pricingBasis || ''));
 const canonicalBT = payment.canonicalBT != null ? Number(payment.canonicalBT ||0) : null;
 const selectedPegBT = payment.selectedPegBT != null ? Number(payment.selectedPegBT ||0) : null;

 const listHtml = (arr) => arr.length
 ? `<div>${arr.map(x => `<div class="picklist-item">${x}</div>`).join('')}</div>`
 : `<div class="picklist-empty">Nothing</div>`;

 const rawToggle = renderRawJsonToggleHtml_Local_(snap, 'trade_raw_' + Math.random().toString(36).slice(2));

 return `
 <div class="details-box">
 <div class="small"><strong>Trade summary</strong></div>
 <div class="small" style="margin-top:6px;">
 <span class="pill-lite">${esc(listingType || '—')}</span>
 <span class="pill-lite">Payment: ${esc(method)}</span>
 ${primaryBasis ? `<span class="pill-lite">Basis: ${primaryBasis}</span>` : ''}
 </div>

 <div class="details-grid" style="margin-top:10px;">
 <div class="picklist-col give">
 <h4>${esc(leftHeader)}</h4>
 <div class="small">Merchant: ${esc(merchantLabel)}</div>
 ${listHtml(leftLines)}
 </div>
 <div class="picklist-col take">
 <h4>${esc(rightHeader)}</h4>
 <div class="small">Customer: ${esc(customerLabel)}</div>
 ${listHtml(rightLines)}
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

 function renderRawJsonToggleHtml_Local_(obj, toggleId) {
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

 function hookRawToggle_Local_(container) {
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

 function normQty_Local_(units, stackSize) {
 const u = Number(units ||0);
 if (!isFinite(u)) return '0';
 const ss = Number(stackSize ||1) ||1;
 if (ss >1) return `${u} (${Math.ceil(u / ss)} stack @${ss})`;
 return String(u);
 }

 function sanitizeItemName_Local(name) {
 if (name == null) return '';
 try { return String(name).replace(/\uFFFD/g, '').replace(/�/g, '').replace(/\s+/g, ' ').trim(); } catch (e) { return String(name || '').trim(); }
 }

 // ===== Trade edit dialog =====
 function openEditTrade(tr, summary) {
 S.editingTrade = tr;

 byId('editTradeId').textContent = tr.tradeId;
 byId('tradePayItem').disabled = !summary.supportsItem;
 if (!summary.supportsItem) byId('tradePayBT').checked = true;

 const snap = summary.snap || {};

 const method = String(snap.payment?.method || 'BT').toUpperCase();
 (method === 'ITEM' ? byId('tradePayItem') : byId('tradePayBT')).checked = true;

 const qm = String(snap.request?.qtyMode || 'IND').toUpperCase();
 (qm === 'STACK' ? byId('tradeQtyStack') : byId('tradeQtyInd')).checked = true;

 byId('tradeQtyVal').value = String(snap.request?.qtyInput ||1);
 byId('editTradeMsg').textContent = '';

 const sel = byId('tradePayPeg');
 sel.innerHTML = '';

 const primaryName = snap.pricing?.primaryPeg?.itemName || snap.pricing?.pegItemName || '';
 const alts = Array.isArray(snap.pricing?.altPegs) ? snap.pricing.altPegs : [];
 const opts = [];
 if (primaryName) opts.push(primaryName);
 alts.forEach(a => { if (a?.itemName) opts.push(a.itemName); });

 const seen = new Set();
 opts.forEach(n => {
 const k = String(n).trim().toLowerCase();
 if (!k || seen.has(k)) return;
 seen.add(k);
 const o = document.createElement('option');
 o.value = n;
 o.textContent = n;
 sel.appendChild(o);
 });

 sel.value = snap.payment?.payItemName || primaryName || (sel.options[0]?.value || '');
 sel.disabled = !summary.supportsItem;

 byId('dlgEditTrade').showModal();
 }

 async function saveTradeEdit() {
 if (!S.editingTrade) return;
 const msg = byId('editTradeMsg');
 msg.textContent = 'Saving...';

 try {
 const qtyMode = byId('tradeQtyStack').checked ? 'STACK' : 'IND';
 const qty = Number(byId('tradeQtyVal').value ||0);
 const paymentChoice = byId('tradePayItem').checked ? 'ITEM' : 'BT';

 const payload = { idToken: S.googleIdToken, tradeId: S.editingTrade.tradeId, qtyMode, qty, paymentChoice };
 if (paymentChoice === 'ITEM') {
 const pegName = String(byId('tradePayPeg').value || '').trim();
 if (pegName) payload.paymentPegName = pegName;
 }

 const r = await apiPost('ocmUpdateTradeRequestV2', payload);
 const d = r.data || r.result || r;

 msg.textContent = 'Saved. New TradeId: ' + (d.tradeId || '');
 await loadPendingRequests();
 setTimeout(() => byId('dlgEditTrade').close(),350);
 } catch (e) {
 msg.textContent = 'Error: ' + e.message;
 }
 }

 // exports
 O.clearUI = clearUI;
 O.loadPendingRequests = loadPendingRequests;
 O.openEditTrade = openEditTrade;
 O.saveTradeEdit = saveTradeEdit;
})();

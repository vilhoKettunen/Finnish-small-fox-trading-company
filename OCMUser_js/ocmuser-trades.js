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

 row.querySelector('button[data-more]')?.addEventListener('click', async () => {
 const snapObj = sum.snap || safeJsonParse(tr.detailsJson || '{}', {}) || {};

 const b = resolveNameMailbox_(tr.buyerUserId, snapObj?.buyer?.playerName);
 const s = resolveNameMailbox_(tr.sellerUserId, snapObj?.seller?.playerName);

 const buyerLabel = `${b?.name || ''} (Mailbox ${b?.mailbox || 'N/A'})`;
 const sellerLabel = `${s?.name || ''} (Mailbox ${s?.mailbox || 'N/A'})`;

 const tmi = window.TradeMoreInfo;
 if (!tmi || typeof tmi.toggleDetailsRow !== 'function') {
 const marker = window.__TradeMoreInfoLoaded ? 'script executed but window.TradeMoreInfo missing' : 'script likely not loaded';
 alert('TradeMoreInfo helper is not loaded (' + marker + '). Check Network tab for shared/trade-more-info.js and Console for errors.');
 return;
 }

 // Ensure catalog lookup is available before rendering so pay-item bundle sizes come from catalog
 try {
 if (O && typeof O.ensureCatalogLoaded === 'function') {
 try { await O.ensureCatalogLoaded(); } catch (e) { /* ignore */ }
 }
 if (typeof tmi.setCatalogLookup === 'function' && typeof O.findCatalogItem === 'function') {
 try { tmi.setCatalogLookup(O.findCatalogItem); } catch { }
 }
 } catch { /* ignore */ }

 tmi.toggleDetailsRow(row, snapObj, buyerLabel, sellerLabel,6);
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

 // ===== Existing local renderer removed: shared TradeMoreInfo is required =====

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

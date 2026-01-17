// UI rendering + trade details for OCMHome
(function () {
 'use strict';

 const O = window.OCMHome;
 const S = O.state;
 const byId = O.byId;
 const fmt2 = O.fmt2;

 function escapeHtml_(s) {
 return String(s || '')
 .replace(/&/g, '&amp;')
 .replace(/</g, '&lt;')
 .replace(/>/g, '&gt;')
 .replace(/"/g, '&quot;')
 .replace(/'/g, '&#39;');
 }

 function clearTables() {
 byId('tbSell').innerHTML = '';
 byId('tbBuy').innerHTML = '';
 byId('tbMyPending').innerHTML = '';
 }

 function normalizeUser(u) {
 if (!u) return u;
 const cand = (u.playerName && u.playerName.trim()) || (u.name && u.name.trim()) || (u.displayName && u.displayName.trim()) || null;
 u.playerName = cand || u.playerName || null;
 return u;
 }

 async function applyAuthFromToken(idToken) {
 S.googleIdToken = idToken;

 // Load catalog FIRST so estimates are correct immediately
 await O.ensureCatalogLoaded();

 const me = await apiGet('me', { idToken });
 const d = me.data || me.result || me;
 S.currentUser = normalizeUser(d.user || d) || {};
 const isAdmin = !!d.isAdmin;
 const bal = Number(S.currentUser.balanceBT ||0);

 if (window.topbarSetAuthState) {
 window.topbarSetAuthState({ idToken, user: S.currentUser, isAdmin, balanceBT: bal });
 }

 byId('authStatus').textContent = 'Logged as ' + (S.currentUser.playerName || S.currentUser.email || '');

 await O.loadListings();
 await O.loadMyPending();
 }

 async function tryRestoreAuthOnLoad() {
 if (!window.initAuthFromStorage) return;
 const res = await window.initAuthFromStorage();
 if (!res.ok) return;
 try { await applyAuthFromToken(res.idToken); } catch { }
 }

 window.onTopbarAuthChanged = function (info) {
 S.googleIdToken = info.idToken;
 S.currentUser = info.user;

 if (window.topbarSetAuthState) window.topbarSetAuthState(info);

 if (!info.idToken) {
 byId('authStatus').textContent = 'Not logged in.';
 clearTables();
 } else {
 byId('authStatus').textContent = 'Logged as ' + ((info.user && (info.user.playerName || info.user.email)) || '');
 O.ensureCatalogLoaded().then(() => {
 O.loadListings();
 O.loadMyPending();
 });
 }
 };

 function renderPegValueSummary_(listing, primaryPeg) {
 // Similar to OCMUser peg equation helper:
 // Show BUY then SELL totals for "1 unit" of traded item vs required peg qty.
 const listedName = String(listing?.itemName || '').trim();
 const pegName = String(primaryPeg?.itemName || '').trim();
 if (!listedName || !pegName) return '<span class="muted">—</span>';

 const perInd = Number(primaryPeg?.pegQtyPerInd ?? listing?.pricing?.pegQtyPerUnit ??0);
 if (!isFinite(perInd) || perInd <=0) return '<span class="muted">—</span>';

 const basis = String(primaryPeg?.ui?.priceBasis || listing?.pricing?.pricingBasis || 'IND').toUpperCase();
 const leftQtyInd = (basis === 'STACK') ? (Number(listing.stackSize ||1) ||1) :1;
 const rightQtyInd = perInd * leftQtyInd;

 function perIndPrice(name, side) {
 const it = O.findCatalogItem(name);
 if (!it) return null;
 const each = O.getStoreEachPrice_(it, side);
 if (each != null) return each;
 const stk = O.getStoreStackPrice_(it, side);
 const bs = Number(it.bundleSize ||1) ||1;
 if (stk != null) return stk / bs;
 return null;
 }

 const soldBuy = perIndPrice(listedName, 'BUY');
 const soldSell = perIndPrice(listedName, 'SELL');
 const pegBuy = perIndPrice(pegName, 'BUY');
 const pegSell = perIndPrice(pegName, 'SELL');

 function line(label, l, r) {
 if (l == null || r == null) return `${label}: —`;
 return `${label}: ${fmt2(leftQtyInd * l)} BT (item) | ${fmt2(rightQtyInd * r)} BT (peg)`;
 }

 const buyLine = line('BUY', soldBuy, pegBuy);
 const sellLine = line('SELL', soldSell, pegSell);

 return `<div class="small mono">${escapeHtml_(buyLine)}<br>${escapeHtml_(sellLine)}</div>`;
 }

 function getPrimaryPeg_(listing) {
 const p = listing?.pricing || {};
 if (p.primaryPeg && p.primaryPeg.itemName) return p.primaryPeg;
 if (p.pegItemName) return { itemName: p.pegItemName, pegQtyPerInd: p.pegQtyPerUnit, ui: { priceBasis: p.pricingBasis || 'IND' } };
 return null;
 }

 function computeCanonicalBtForListing_(listing) {
 const p = listing?.pricing || {};

 if (String(p.mode || '').toUpperCase() === 'FIXED_BT') {
 const btPerInd = Number(p.fixedBTPerUnit ?? p.fixedBT ?? p.priceBT ??0);
 if (!isFinite(btPerInd) || btPerInd <=0) return { btPerInd: null, btPerStack: null };
 const stackSize = Number(listing.stackSize ||1) ||1;
 return { btPerInd, btPerStack: btPerInd * stackSize };
 }

 const peg = getPrimaryPeg_(listing);
 if (!peg?.itemName) return { btPerInd: null, btPerStack: null };

 const ratio = Number(peg.pegQtyPerInd ??0);
 if (!isFinite(ratio) || ratio <=0) return { btPerInd: null, btPerStack: null };

 const side = (listing.type === 'BUY') ? 'BUY' : 'SELL';
 const pegBtPerInd = O.perIndPriceFromCatalog_(peg.itemName, side);
 if (pegBtPerInd == null) return { btPerInd: null, btPerStack: null };

 const btPerInd = ratio * pegBtPerInd;
 const stackSize = Number(listing.stackSize ||1) ||1;
 return { btPerInd, btPerStack: btPerInd * stackSize };
 }

 function renderPegSummary_(listing) {
 const p = listing?.pricing || {};
 const listedItemName = String(listing?.itemName || '').trim();

 if (String(p.mode || '').toUpperCase() === 'FIXED_BT') {
 const btPerInd = Number(p.fixedBTPerUnit ?? p.fixedBT ?? p.priceBT ??0);
 if (!isFinite(btPerInd) || btPerInd <=0) return '<span class="muted">—</span>';
 return `1 ${escapeHtml_(listedItemName)} = ${fmt2(btPerInd)} BT`;
 }

 const prim = getPrimaryPeg_(listing);
 if (!prim || !prim.itemName) return '<span class="muted">—</span>';

 const pegItemName = String(prim.itemName || '').trim();
 const perInd = Number(prim.pegQtyPerInd ??0);
 const stackSize = Number(listing?.stackSize ||1) ||1;
 const pegQtyForStack = perInd * stackSize;

 const altCount = Array.isArray(p.altPegs) ? p.altPegs.length :0;
 const basis = (prim.ui && prim.ui.priceBasis) ? prim.ui.priceBasis : (p.pricingBasis || 'IND');
 const basisLabel = (String(basis).toUpperCase() === 'STACK') ? 'stack-basis' : 'ind-basis';

 // Keep this row clean; value exchange is shown in the trade details UI.
 return `${fmt2(stackSize)} ${escapeHtml_(listedItemName)} = ${fmt2(pegQtyForStack)} ${escapeHtml_(pegItemName)} <span class="small muted">(${basisLabel}${altCount ? ` +${altCount} alts` : ''})</span>`;
 }

 function renderListingRow(tb, listing) {
 const tr = document.createElement('tr');
 tr.className = 'clickable';
 tr.tabIndex =0;
 tr.dataset.listingId = listing.listingId;

 const isSell = listing.type === 'SELL';
 const who = listing.playerName || '';
 const qtyLabel = isSell ? 'Stock' : 'Demand';
 const qty = (listing.qtyAvailable == null) ? '0' : String(listing.qtyAvailable);

 const pegSummary = renderPegSummary_(listing);

 const canon = computeCanonicalBtForListing_(listing);
 const btPerUnit = canon.btPerInd != null ? canon.btPerInd : (Number(listing.priceBT) ||0);
 const btPerStack = canon.btPerStack != null ? canon.btPerStack : (btPerUnit * (Number(listing.stackSize ||1) ||1));

 tr.innerHTML = `
 <td>${listing.itemName || ''}</td>
 <td class="mono">${pegSummary}</td>
 <td class="mono">${fmt2(btPerUnit)} / <span class="muted">stk</span> ${fmt2(btPerStack)}</td>
 <td class="mono">${qtyLabel}: ${qty}</td>
 <td class="mono">${Number(listing.stackSize ||1) ||1}</td>
 <td>${who}</td>
 <td><button type="button" data-trade-btn="1">Trade</button></td>
 `;

 const open = () => O.toggleTradeDetails(tr, listing);
 tr.addEventListener('click', (ev) => {
 if (ev.target && ev.target.closest('button')) return;
 open();
 });
 tr.addEventListener('keydown', (ev) => {
 if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); open(); }
 });
 tr.querySelector('button[data-trade-btn]')?.addEventListener('click', (ev) => {
 ev.preventDefault();
 open();
 });

 tb.appendChild(tr);
 }

 function renderTables() {
 const tbSell = byId('tbSell');
 const tbBuy = byId('tbBuy');
 tbSell.innerHTML = '';
 tbBuy.innerHTML = '';
 (S.listingsSell || []).forEach(l => renderListingRow(tbSell, l));
 (S.listingsBuy || []).forEach(l => renderListingRow(tbBuy, l));
 O.updateTabVisibility();
 }

 function setTab(tab) {
 S.activeTab = tab;
 O.updateTabVisibility();
 }

 function updateTabVisibility() {
 const sellWrap = byId('sellWrap');
 const buyWrap = byId('buyWrap');
 const isMobile = window.matchMedia('(max-width:860px)').matches;

 if (!isMobile) {
 sellWrap.style.display = 'block';
 buyWrap.style.display = 'block';
 } else {
 sellWrap.style.display = (S.activeTab === 'sell') ? 'block' : 'none';
 buyWrap.style.display = (S.activeTab === 'buy') ? 'block' : 'none';
 }

 byId('tabSell').setAttribute('aria-selected', S.activeTab === 'sell' ? 'true' : 'false');
 byId('tabBuy').setAttribute('aria-selected', S.activeTab === 'buy' ? 'true' : 'false');
 }

 // Expose
 O.escapeHtml_ = escapeHtml_;
 O.applyAuthFromToken = applyAuthFromToken;
 O.tryRestoreAuthOnLoad = tryRestoreAuthOnLoad;
 O.renderTables = renderTables;
 O.setTab = setTab;
 O.updateTabVisibility = updateTabVisibility;
})();

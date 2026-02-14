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

 function normalizeUser(u) {
 if (!u) return u;
 const cand = (u.playerName && u.playerName.trim()) || (u.name && u.name.trim()) || (u.displayName && u.displayName.trim()) || null;
 u.playerName = cand || u.playerName || null;
 return u;
 }

 function clearListingsUi_() {
 const tb = byId('tbListings');
 if (tb) tb.innerHTML = '';
 const pageInfo = byId('pageInfo');
 if (pageInfo) pageInfo.textContent = '';
 const resultsInfo = byId('resultsInfo');
 if (resultsInfo) resultsInfo.textContent = '';
 const thQty = byId('thQty');
 if (thQty) thQty.textContent = 'Individual stock';
 }

 function clearTables() {
 clearListingsUi_();
 byId('tbMyPending').innerHTML = '';
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

 // Match index.html search feel: case-insensitive substring match.
 // Support multiple terms by splitting on whitespace + commas.
 function tokenize_(s) {
 return String(s || '')
 .trim()
 .toLowerCase()
 .split(/[\s,]+/g)
 .filter(Boolean);
 }

 function listingAcceptsPeg_(listing, pegNameLower) {
 const p = listing?.pricing || {};
 const prim = p.primaryPeg?.itemName ? String(p.primaryPeg.itemName).trim().toLowerCase() : '';
 if (prim && prim === pegNameLower) return true;
 const alts = Array.isArray(p.altPegs) ? p.altPegs : [];
 return alts.some(a => a && a.itemName && String(a.itemName).trim().toLowerCase() === pegNameLower);
 }

 function applyFiltersAndRender() {
 const idToken = S.googleIdToken;
 if (!idToken) {
 // Logged out: show nothing
 clearListingsUi_();
 updateActiveFiltersUi();
 updateLastUpdatedUi();
 return;
 }

 const type = (S.appliedFilters.type === 'BUY') ? 'BUY' : 'SELL';
 const base = (type === 'BUY') ? (S.listingsCache.buy || []) : (S.listingsCache.sell || []);

 const itemTerms = tokenize_(S.appliedFilters.itemText);
 const merchantTerms = tokenize_(S.appliedFilters.merchantText);
 const pegNames = Array.isArray(S.appliedFilters.pegNames) ? S.appliedFilters.pegNames : [];
 const pegLowers = pegNames.map(x => String(x || '').trim().toLowerCase()).filter(Boolean);

 let arr = base.slice();

 // Search-applied: item terms AND (index.html style: substring)
 if (itemTerms.length) {
 arr = arr.filter(l => {
 const hay = String(l.itemName || '').toLowerCase();
 return itemTerms.every(t => hay.includes(t));
 });
 }

 // Search-applied: merchant terms AND (substring)
 if (merchantTerms.length) {
 arr = arr.filter(l => {
 const hay = String(l.playerName || '').toLowerCase();
 return merchantTerms.every(t => hay.includes(t));
 });
 }

 // Search-applied: pegs OR; if pegs selected, require supportsItemPayment
 if (pegLowers.length) {
 arr = arr.filter(l => {
 if (!l?.pricing?.supportsItemPayment) return false;
 return pegLowers.some(p => listingAcceptsPeg_(l, p));
 });
 }

 // Immediate: only item-payment listings
 if (S.onlyItemPayment) {
 arr = arr.filter(l => !!l?.pricing?.supportsItemPayment);
 }

 // Immediate: stock range
 const min = (S.stockMin == null || S.stockMin === '') ? null : Number(S.stockMin);
 const max = (S.stockMax == null || S.stockMax === '') ? null : Number(S.stockMax);
 if (min != null || max != null) {
 arr = arr.filter(l => {
 const q = Number(l.qtyAvailable);
 if (!isFinite(q)) return false;
 if (min != null && q < min) return false;
 if (max != null && q > max) return false;
 return true;
 });
 }

 // Immediate: sorting by canonical BT
 const sort = String(S.sort || 'NONE');
 if (sort === 'PRICE_ASC' || sort === 'PRICE_DESC') {
 const dir = (sort === 'PRICE_ASC') ?1 : -1;
 arr.sort((a, b) => {
 const ca = computeCanonicalBtForListing_(a);
 const cb = computeCanonicalBtForListing_(b);
 const pa = (ca.btPerInd != null) ? ca.btPerInd : (Number(a.priceBT) ||0);
 const pb = (cb.btPerInd != null) ? cb.btPerInd : (Number(b.priceBT) ||0);
 if (pa < pb) return -1 * dir;
 if (pa > pb) return 1 * dir;
 // tie-breaker: newest first
 return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
 });
 }

 // Pagination
 const total = arr.length;
 const pageSize = Math.max(1, Number(S.pageSize ||20) ||20);
 const pageCount = Math.max(1, Math.ceil(total / pageSize));
 let pageIndex = Number(S.pageIndex ||0) ||0;
 if (pageIndex <0) pageIndex =0;
 if (pageIndex > pageCount -1) pageIndex = pageCount -1;
 S.pageIndex = pageIndex;

 const start = pageIndex * pageSize;
 const end = Math.min(total, start + pageSize);
 const pageItems = arr.slice(start, end);

 S.listingsView = {
 allMatching: arr,
 pageItems,
 totalMatching: total,
 pageIndex,
 pageCount
 };

 renderUnifiedTable_(pageItems, type);
 updatePagerUi_();
 updateActiveFiltersUi();
 updateLastUpdatedUi();
 }

 function renderUnifiedTable_(items, type) {
 const tb = byId('tbListings');
 tb.innerHTML = '';

 const thQty = byId('thQty');
 if (thQty) thQty.textContent = (type === 'BUY') ? 'Individual demand' : 'Individual stock';

 (items || []).forEach(listing => {
 const tr = document.createElement('tr');
 tr.className = 'clickable';
 tr.tabIndex =0;
 tr.dataset.listingId = listing.listingId;

 const who = listing.playerName || '';
 const qtyLabel = (type === 'BUY') ? 'Demand' : 'Stock';
 const qty = (listing.qtyAvailable == null) ? '0' : String(listing.qtyAvailable);

 const pegSummary = renderPegSummary_(listing);

 const canon = computeCanonicalBtForListing_(listing);
 const btPerUnit = canon.btPerInd != null ? canon.btPerInd : (Number(listing.priceBT) ||0);
 const btPerStack = canon.btPerStack != null ? canon.btPerStack : (btPerUnit * (Number(listing.stackSize ||1) ||1));

 tr.innerHTML = `
 <td>${escapeHtml_(listing.itemName || '')}</td>
 <td class="mono">${pegSummary}</td>
 <td class="mono">${fmt2(btPerUnit)} / <span class="muted">stk</span> ${fmt2(btPerStack)}</td>
 <td class="mono">${qtyLabel}: ${escapeHtml_(qty)}</td>
 <td class="mono">${Number(listing.stackSize ||1) ||1}</td>
 <td>${escapeHtml_(who)}</td>
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
 });
 }

 function updatePagerUi_() {
 const v = S.listingsView || {};
 const pageIndex = Number(v.pageIndex ||0);
 const pageCount = Number(v.pageCount ||1);
 const total = Number(v.totalMatching ||0);
 const pageSize = Math.max(1, Number(S.pageSize ||20) ||20);

 const start = total ? (pageIndex * pageSize +1) :0;
 const end = Math.min(total, pageIndex * pageSize + (v.pageItems ? v.pageItems.length :0));

 const pageInfo = byId('pageInfo');
 if (pageInfo) pageInfo.textContent = `Page ${pageIndex +1} of ${pageCount}`;

 const resultsInfo = byId('resultsInfo');
 if (resultsInfo) resultsInfo.textContent = total ? `Results: showing ${start}–${end} of ${total} matching` : 'Results:0 matching';

 const btnPrev = byId('btnPrevPage');
 const btnNext = byId('btnNextPage');
 if (btnPrev) btnPrev.disabled = (pageIndex <=0);
 if (btnNext) btnNext.disabled = (pageIndex >= pageCount -1);
 }

 function updateActiveFiltersUi() {
 const el = byId('activeFilters');
 if (!el) return;

 const typeLabel = (S.appliedFilters.type === 'BUY') ? 'Demand (BUY)' : 'Supply (SELL)';
 const itemT = String(S.appliedFilters.itemText || '').trim();
 const merchT = String(S.appliedFilters.merchantText || '').trim();
 const pegs = (Array.isArray(S.appliedFilters.pegNames) ? S.appliedFilters.pegNames : []).filter(Boolean);

 const partsSearch = [typeLabel];
 if (itemT) partsSearch.push(`Item:"${escapeHtml_(itemT)}"`);
 if (merchT) partsSearch.push(`Merchant:"${escapeHtml_(merchT)}"`);
 if (pegs.length) partsSearch.push(`Pegs: ${pegs.map(escapeHtml_).join(', ')}`);

 const partsImm = [];
 if (S.onlyItemPayment) partsImm.push('Item-payment only');
 if (S.stockMin != null || S.stockMax != null) {
 const a = (S.stockMin != null && S.stockMin !== '') ? String(S.stockMin) : '0';
 const b = (S.stockMax != null && S.stockMax !== '') ? String(S.stockMax) : '?';
 partsImm.push(`Stock: ${escapeHtml_(a)}..${escapeHtml_(b)}`);
 }
 const sort = String(S.sort || 'NONE');
 if (sort === 'PRICE_ASC') partsImm.push('Sort: Price asc');
 else if (sort === 'PRICE_DESC') partsImm.push('Sort: Price desc');
 else partsImm.push('Sort: None');
 partsImm.push(`Page size: ${Number(S.pageSize ||20) ||20}`);

 el.innerHTML = `<div><strong>Active (Search-applied)</strong>: ${partsSearch.join(' | ')}</div>
 <div><strong>Active (Immediate)</strong>: ${partsImm.join(' | ')}</div>
 <div class="small muted">Type/text/pegs apply on Search. Stock/sort/page apply immediately.</div>`;
 }

 function updateLastUpdatedUi() {
 const el = byId('lastUpdated');
 if (!el) return;
 const t = S.listingsCache?.fetchedAt;
 if (!t) {
 el.textContent = '';
 return;
 }
 el.textContent = 'Last updated: ' + t;
 }

 function renderPegDropdown_() {
 // If OCMHome.html was updated to use the searchable input dropdown, wire it.
 const input = byId('fltPegInput');
 const list = byId('fltPegInputList');
 if (input && list) {
 // Prefer universal dropdown (favorites)
 if (window.universalDropdown && typeof window.universalDropdown.attach === 'function') {
 window.universalDropdown.attach({
 inputEl: input,
 listEl: list,
 getItems: () => (S.catalog || []),
 getLabel: (it) => String(it?.name || ''),
 getExtraText: () => '',
 showProgress: false,
 onSelect: (name) => {
 input.value = name;
 list.style.display = 'none';
 input._dropIndex = -1;
 }
 });

 // Also keep Enter behavior: if no highlighted row, treat Enter like Add button.
 if (!input._ocmPegEnterAddWired) {
 input._ocmPegEnterAddWired = true;
 input.addEventListener('keydown', (ev) => {
 if (ev.key !== 'Enter') return;
 const hasActive = (typeof input._dropIndex === 'number' && input._dropIndex >=0);
 if (hasActive) return; // universal dropdown handles item click via active index
 ev.preventDefault();
 if (typeof O.addSelectedPegFromUi === 'function') O.addSelectedPegFromUi();
 });
 }

 // Initial render on empty
 try { input.dispatchEvent(new Event('focus')); } catch { }
 return;
 }

 // Fallback (old local implementation)
 // Build dropdownData in the same shape as index.html expects.
 const names = (S.catalog || []).slice().map(i => String(i.name || '')).filter(Boolean);
 names.sort((a, b) => String(a).localeCompare(String(b)));
 const dropdownData = names.map(n => ({ name: n, extra: '' }));

 // Minimal render compatible with index dropdown behavior (no stock indicator here).
 function renderList_(arr, onSelect) {
 list.innerHTML = '';
 (arr || []).forEach((item, idx) => {
 const div = document.createElement('div');
 div.className = 'dropdown-item';
 div.dataset.index = String(idx);
 div.dataset.name = item.name; // expose name for keyboard-add
 div.innerHTML = `<div><strong>${escapeHtml_(item.name)}</strong>${item.extra ? `<br><small>${escapeHtml_(item.extra)}</small>` : ''}</div>`;
 div.addEventListener('mouseover', () => {
 Array.from(list.querySelectorAll('.dropdown-item')).forEach(s => s.classList.remove('active'));
 div.classList.add('active');
 input._dropIndex = idx;
 });
 div.onclick = () => onSelect(item.name);
 list.appendChild(div);
 });
 }

 function filterBy(q) {
 const qq = String(q || '').toLowerCase().trim();
 if (!qq) return dropdownData.slice(0,200);
 return dropdownData.filter(d => String(d.name || '').toLowerCase().includes(qq)).slice(0,200);
 }

 function setActiveIndex(idx) {
 const itemsEls = Array.from(list.querySelectorAll('.dropdown-item'));
 itemsEls.forEach(it => it.classList.remove('active'));
 if (idx >=0 && idx < itemsEls.length) {
 itemsEls[idx].classList.add('active');
 itemsEls[idx].scrollIntoView({ block: 'nearest' });
 input._dropIndex = idx;
 } else input._dropIndex = -1;
 }

 function renderAndShow() {
 const filtered = filterBy(input.value);
 renderList_(filtered, (val) => {
 input.value = val;
 list.style.display = 'none';
 input._dropIndex = -1;
 });
 input._dropIndex = -1;
 list.style.display = list.querySelectorAll('.dropdown-item').length ? 'block' : 'none';
 }

 // Avoid double-wiring if called multiple times.
 if (!input._ocmPegWired) {
 input._ocmPegWired = true;
 input.addEventListener('input', renderAndShow);
 input.addEventListener('focus', renderAndShow);
 input.addEventListener('keydown', ev => {
 const itemsEls = Array.from(list.querySelectorAll('.dropdown-item'));
 if (!itemsEls.length) return;
 if (ev.key === 'ArrowDown') {
 ev.preventDefault();
 setActiveIndex(Math.min((input._dropIndex || -1) +1, itemsEls.length -1));
 } else if (ev.key === 'ArrowUp') {
 ev.preventDefault();
 setActiveIndex(Math.max((input._dropIndex || -1) -1,0));
 } else if (ev.key === 'Enter') {
 if (typeof input._dropIndex === 'number' && input._dropIndex >=0) {
 ev.preventDefault();
 itemsEls[input._dropIndex].click();
 } else {
 // no highlighted item, let Enter behave as Add (simulate Add button)
 ev.preventDefault();
 // trigger addSelectedPegFromUi if available
 if (typeof O.addSelectedPegFromUi === 'function') O.addSelectedPegFromUi();
 }
 } else if (ev.key === 'Escape') {
 list.style.display = 'none';
 input._dropIndex = -1;
 }
 });
 input.addEventListener('blur', () => setTimeout(() => {
 list.style.display = 'none';
 input._dropIndex = -1;
 },200));
 }

 // Render initial suggestions (empty query)
 try { renderAndShow(); } catch { }
 return;
 }

 // Fallback to old <select> if present
 const sel = byId('fltPegSelect');
 if (!sel) return;

 sel.innerHTML = '';
 const items = (S.catalog || []).slice().map(i => i.name).filter(Boolean);
 items.sort((a, b) => String(a).localeCompare(String(b)));

 const opt0 = document.createElement('option');
 opt0.value = '';
 opt0.textContent = '(select peg)';
 sel.appendChild(opt0);

 items.forEach(name => {
 const opt = document.createElement('option');
 opt.value = name;
 opt.textContent = name;
 sel.appendChild(opt);
 });
 }

 function addSelectedPegFromUi() {
 // New searchable input
 const inEl = byId('fltPegInput');
 const list = byId('fltPegInputList');
 if (inEl) {
 // If there is a highlighted suggestion, prefer it
 let name = '';
 if (list && typeof inEl._dropIndex === 'number' && inEl._dropIndex >=0) {
 const els = list.querySelectorAll('.dropdown-item');
 const el = els[inEl._dropIndex];
 name = el?.dataset?.name ? String(el.dataset.name).trim() : '';
 }
 // Otherwise use input text
 if (!name) name = String(inEl.value || '').trim();
 if (!name) return;

 // Only allow names from catalog (avoid typos)
 const key = name.toLowerCase();
 const exists = (S.catalog || []).some(i => String(i?.name || '').trim().toLowerCase() === key);
 if (!exists) return;

 const next = (Array.isArray(S.draftFilters.pegNames) ? S.draftFilters.pegNames.slice() : []);
 if (next.some(x => String(x || '').toLowerCase() === key)) return;
 if (next.length >=5) return;
 next.push((S.catalog || []).find(i => String(i?.name || '').trim().toLowerCase() === key)?.name || name);
 S.draftFilters.pegNames = next;
 renderPegChips();
 updateActiveFiltersUi();

 // Clear input and close list
 inEl.value = '';
 if (list) { list.style.display = 'none'; inEl._dropIndex = -1; }
 return;
 }

 // Old <select>
 const sel = byId('fltPegSelect');
 if (!sel) return;
 const name = String(sel.value || '').trim();
 if (!name) return;

 const next = (Array.isArray(S.draftFilters.pegNames) ? S.draftFilters.pegNames.slice() : []);
 const key = name.toLowerCase();
 if (next.some(x => String(x || '').toLowerCase() === key)) return;
 if (next.length >=5) return;
 next.push(name);
 S.draftFilters.pegNames = next;
 renderPegChips();
 updateActiveFiltersUi();
 }

 async function applyAuthFromToken(idToken) {
 S.googleIdToken = idToken;

 // Load catalog FIRST so canonical BT + peg dropdown are correct
 await O.ensureCatalogLoaded();
 renderPegDropdown_();

 const me = await apiGet('me', { idToken });
 const d = me.data || me.result || me;
 S.currentUser = normalizeUser(d.user || d) || {};
 const isAdmin = !!d.isAdmin;
 const bal = Number(S.currentUser.balanceBT ||0);

 if (window.topbarSetAuthState) {
 window.topbarSetAuthState({ idToken, user: S.currentUser, isAdmin, balanceBT: bal });
 }

 byId('authStatus').textContent = 'Logged as ' + (S.currentUser.playerName || S.currentUser.email || '');

 // Fetch listings only after authentication (anti-bot)
 const fetcher = (window.OCMHome && typeof window.OCMHome.fetchListingsOnceOrRefresh === 'function')
 ? window.OCMHome.fetchListingsOnceOrRefresh
 : null;
 if (fetcher) await fetcher({ force:true });

 // Pending trades loader lives in `ocmhome-trades.js` and may not be available if scripts load out-of-order.
 const pendingLoader = (window.OCMHome && typeof window.OCMHome.loadMyPending === 'function')
 ? window.OCMHome.loadMyPending
 : null;
 if (pendingLoader) await pendingLoader();
 }

 async function tryRestoreAuthOnLoad() {
 if (!window.initAuthFromStorage) return;
 const res = await window.initAuthFromStorage();
 if (!res || !res.ok || !res.idToken) return;
 try {
 await applyAuthFromToken(res.idToken);
 } catch {
 // ignore restore failures
 }
 }

 window.onTopbarAuthChanged = function (info) {
 S.googleIdToken = info.idToken;
 S.currentUser = info.user;

 if (window.topbarSetAuthState) window.topbarSetAuthState(info);

 if (!info.idToken) {
 byId('authStatus').textContent = 'Not logged in.';
 clearTables();
 // Only show login-required message when logged out
 const msgTop = byId('msgTop');
 if (msgTop) msgTop.textContent = 'Login required to load listings.';
 } else {
 byId('authStatus').textContent = 'Logged as ' + ((info.user && (info.user.playerName || info.user.email)) || '');
 O.ensureCatalogLoaded().then(async () => {
 renderPegDropdown_();
 const fetcher = (window.OCMHome && typeof window.OCMHome.fetchListingsOnceOrRefresh === 'function')
 ? window.OCMHome.fetchListingsOnceOrRefresh
 : null;
 if (fetcher) await fetcher({ force:false });
 const pendingLoader = (window.OCMHome && typeof window.OCMHome.loadMyPending === 'function')
 ? window.OCMHome.loadMyPending
 : null;
 if (pendingLoader) await pendingLoader();
 });
 }
 };

 function renderPegChips() {
 const wrap = byId('fltPegChips');
 if (!wrap) return;
 wrap.innerHTML = '';
 const pegs = Array.isArray(S.draftFilters?.pegNames) ? S.draftFilters.pegNames : [];
 pegs.forEach((name, idx) => {
 const chip = document.createElement('span');
 chip.className = 'chip';
 chip.innerHTML = `<span>${escapeHtml_(name)}</span> <button type="button" title="Remove" data-idx="${idx}">x</button>`;
 const btn = chip.querySelector('button');
 btn?.addEventListener('click', () => {
 const next = (Array.isArray(S.draftFilters.pegNames) ? S.draftFilters.pegNames.slice() : []);
 next.splice(idx,1);
 S.draftFilters.pegNames = next;
 renderPegChips();
 updateActiveFiltersUi();
 });
 wrap.appendChild(chip);
 });
 }

 function clearSelectedPegs() {
 S.draftFilters.pegNames = [];
 renderPegChips();
 updateActiveFiltersUi();
 }

 // Expose
 O.escapeHtml_ = escapeHtml_;
 O.applyAuthFromToken = applyAuthFromToken;
 O.tryRestoreAuthOnLoad = tryRestoreAuthOnLoad;
 O.applyFiltersAndRender = applyFiltersAndRender;
 O.updateActiveFiltersUi = updateActiveFiltersUi;
 O.updateLastUpdatedUi = updateLastUpdatedUi;

 O.renderPegChips = renderPegChips;
 O.addSelectedPegFromUi = addSelectedPegFromUi;
 O.clearSelectedPegs = clearSelectedPegs;

 O.clearListingsUi_ = clearListingsUi_;
 // keep canonical calculator exposed for compatibility (if other modules rely on it)
 O.computeCanonicalBtForListing_ = computeCanonicalBtForListing_;
})();

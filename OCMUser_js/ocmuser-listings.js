// Listing creation + listing editor/restock dialogs for OCMUser
(function () {
 'use strict';

 const O = window.OCMUser;
 const S = O.state;
 const byId = O.byId;
 const esc = O.esc;
 const fmt2 = O.fmt2;

 function setCreationTab(which) {
 const map = {
 store: { tab: 'tabCreateStore', panel: 'panelCreateStore' },
 half: { tab: 'tabCreateHalf', panel: 'panelCreateHalf' },
 full: { tab: 'tabCreateFull', panel: 'panelCreateFull' }
 };
 Object.keys(map).forEach(k => {
 byId(map[k].panel).style.display = (k === which) ? 'block' : 'none';
 byId(map[k].tab).setAttribute('aria-selected', (k === which) ? 'true' : 'false');
 });
 }

 async function createListingStore() {
 if (!S.googleIdToken) return;
 const msg = byId('createMsgStore');
 msg.textContent = 'Creating...';

 try {
 const type = byId('createTypeStore').value;
 const listingMode = 'STORE';

 const itemName = byId('createItemStore').value.trim();
 const item = O.findCatalogItem(itemName);
 if (!item) throw new Error('Store item not found in catalog');

 const stackSize = Number(item.bundleSize ||1) ||1;

 const qtyIn = Number(byId('createQtyUnitsStore').value ||0);
 const qtyMode = byId('createQtyModeStore').value;
 const quantityUnits = O.computeQtyUnitsFromInput(qtyIn, qtyMode, stackSize);
 if (!isFinite(quantityUnits) || quantityUnits <=0) throw new Error('Invalid quantity');

 if (!O.validatePegSet_(S.createState.store.primary, S.createState.store.alts, byId('createStorePegWarn'))) throw new Error('Fix peg inputs');
 const pegPayload = O.buildPegPayload_(S.createState.store.primary, S.createState.store.alts);

 const r = await apiPost('ocmCreateListingV2', {
 idToken: S.googleIdToken,
 listingMode,
 type,
 itemName,
 sourceItemId: 'sheet:' + item.name,
 stackSize,
 quantityUnits,
 pricingMode: 'PEG',
 primaryPeg: pegPayload.primaryPeg,
 altPegs: pegPayload.altPegs
 });

 const d = r.data || r.result || r;
 msg.textContent = 'Created. ListingId: ' + (d.listingId || '');
 await O.loadMyListings();
 } catch (e) {
 msg.textContent = 'Error: ' + (e.message || e);
 }
 }

 async function createListingHalf() {
 if (!S.googleIdToken) return;
 const msg = byId('createMsgHalf');
 msg.textContent = 'Creating...';

 try {
 const type = byId('createTypeHalf').value;
 const listingMode = 'HALF';

 const itemNameRaw = O.sanitizeLettersOnly_(byId('createItemHalf').value, { trim:true });
 if (!itemNameRaw) throw new Error('Custom item name required');
 if (!O.isLettersOnly_(itemNameRaw)) throw new Error('Custom item name must contain only letters and spaces (A-Z).');
 const itemName = itemNameRaw;

 const stackSize = Math.max(1, Math.round(Number(byId('createStackHalf').value ||1) ||1));
 if (!isFinite(stackSize) || stackSize <=0) throw new Error('Invalid stack size');

 const qtyIn = Number(byId('createQtyUnitsHalf').value ||0);
 const qtyMode = byId('createQtyModeHalf').value;
 const quantityUnits = O.computeQtyUnitsFromInput(qtyIn, qtyMode, stackSize);
 if (!isFinite(quantityUnits) || quantityUnits <=0) throw new Error('Invalid quantity');

 if (!O.validatePegSet_(S.createState.half.primary, S.createState.half.alts, byId('createHalfPegWarn'))) throw new Error('Fix peg inputs');
 const pegPayload = O.buildPegPayload_(S.createState.half.primary, S.createState.half.alts);

 const r = await apiPost('ocmCreateListingV2', {
 idToken: S.googleIdToken,
 listingMode,
 type,
 itemName,
 sourceItemId: '',
 stackSize,
 quantityUnits,
 pricingMode: 'PEG',
 primaryPeg: pegPayload.primaryPeg,
 altPegs: pegPayload.altPegs
 });

 const d = r.data || r.result || r;
 msg.textContent = 'Created. ListingId: ' + (d.listingId || '');
 await O.loadMyListings();
 } catch (e) {
 msg.textContent = 'Error: ' + (e.message || e);
 }
 }

 async function createListingFull() {
 if (!S.googleIdToken) return;
 const msg = byId('createMsgFull');
 msg.textContent = 'Creating...';

 try {
 const type = byId('createTypeFull').value;
 const listingMode = 'FULL';

 const itemNameRaw = byId('createItemFull').value.trim();
 if (!itemNameRaw) throw new Error('Custom item name required');
 if (!O.isLettersOnly_(itemNameRaw)) throw new Error('Custom item name must contain letters only (A-Z).');
 const itemName = itemNameRaw;

 const stackSize = Math.max(1, Math.round(Number(byId('createStackFull').value ||1) ||1));
 if (!isFinite(stackSize) || stackSize <=0) throw new Error('Invalid stack size');

 const quantityUnits = Math.max(1, Math.round(Number(byId('createQtyUnitsFull').value ||0) ||0));
 if (!isFinite(quantityUnits) || quantityUnits <=0) throw new Error('Invalid quantity');

 const fixedBTPerUnit = Number(byId('createFixedBT').value ||0);
 if (!isFinite(fixedBTPerUnit) || fixedBTPerUnit <=0) throw new Error('Fixed BT per unit must be >0');

 const r = await apiPost('ocmCreateListingV2', {
 idToken: S.googleIdToken,
 listingMode,
 type,
 itemName,
 sourceItemId: '',
 stackSize,
 quantityUnits,
 pricingMode: 'FIXED_BT',
 fixedBTPerUnit
 });

 const d = r.data || r.result || r;
 msg.textContent = 'Created. ListingId: ' + (d.listingId || '');
 await O.loadMyListings();
 } catch (e) {
 msg.textContent = 'Error: ' + (e.message || e);
 }
 }

 async function loadMyListings() {
 if (!S.googleIdToken) return;
 const r = await apiGet('ocmListMyListingsV2', { idToken: S.googleIdToken });
 const d = r.data || r.result || r;
 S.myListings = d.listings || [];
 renderMyListings();
 }

 function statusPill(statusRaw) {
 const s = String(statusRaw || '').toUpperCase();
 if (s === 'ACTIVE') return '<span class="pill pill-active">ACTIVE</span>';
 if (s === 'PENDING_REVIEW') return '<span class="pill pill-pending">PENDING_REVIEW</span>';
 if (s === 'PAUSED') return '<span class="pill pill-paused">PAUSED</span>';
 if (s === 'DELETED') return '<span class="pill">DELETED</span>';
 if (s === 'TRUE') return '<span class="pill pill-active">OPEN</span>';
 if (s === 'FALSE') return '<span class="pill">CLOSED</span>';
 return `<span class="pill">${esc(s || '—')}</span>`;
 }

 function pricingLabel(l) {
 const p = l.pricing || {};
 if (p.mode === 'FIXED_BT') return `FIXED ${fmt2(p.fixedBTPerUnit)} BT/unit`;

 const prim = p.primaryPeg || (p.pegItemName ? { itemName:p.pegItemName, pegQtyPerInd:p.pegQtyPerUnit, ui:{ priceBasis:p.pricingBasis || 'IND' } } : null);
 if (!prim || !prim.itemName) return '—';

 const alts = Array.isArray(p.altPegs) ? p.altPegs : [];
 const altCount = alts.length;
 const basis = String(prim.ui?.priceBasis || p.pricingBasis || 'IND').toUpperCase();
 const basisLabel = basis === 'STACK' ? 'STACK' : 'IND';
 return `${fmt2(Number(prim.pegQtyPerInd ||0))} ${prim.itemName} (${basisLabel}${altCount ? ` +${altCount} alts` : ''})`;
 }

 function editKindLabel(l) {
 const extra = O.safeJsonParse(l.extraJson || '{}', {}) || {};
 const k = String(extra.merchantEditKind || '').toUpperCase();
 if (k === 'RESTOCK_ONLY') return '<span class="pill pill-restock">RESTOCK_ONLY</span>';
 if (k === 'FULL_EDIT') return '<span class="pill pill-pending">FULL_EDIT</span>';
 return '<span class="pill">—</span>';
 }

 function renderListingRow(tb, l) {
 const tr = document.createElement('tr');
 tr.innerHTML = `
 <td class="mono">${esc(l.listingId)}</td>
 <td>${esc(l.itemName)}</td>
 <td>${statusPill(l.statusRaw || l.status)}</td>
 <td class="mono">${(l.qtyAvailable == null ? '0' : String(l.qtyAvailable))}</td>
 <td class="mono">${Number(l.stackSize ||1) ||1}</td>
 <td class="mono">${esc(pricingLabel(l))}</td>
 <td>
 <button type="button" data-edit="1">Edit</button>
 <button type="button" data-restock="1">Restock</button>
 </td>
 `;
 tr.querySelector('button[data-edit]')?.addEventListener('click', () => openEditListing(l));
 tr.querySelector('button[data-restock]')?.addEventListener('click', () => openRestock(l));
 tb.appendChild(tr);
 }

 function renderMyListings() {
 const sellTb = byId('tbSellListings');
 const buyTb = byId('tbBuyListings');
 const pendingTb = byId('tbPendingListings');

 sellTb.innerHTML = '';
 buyTb.innerHTML = '';
 pendingTb.innerHTML = '';

 (S.myListings || []).forEach(l => {
 const status = String(l.statusRaw || '').toUpperCase();
 if (status === 'PENDING_REVIEW') {
 const tr = document.createElement('tr');
 tr.innerHTML = `
 <td class="mono">${esc(l.listingId)}</td>
 <td>${esc(l.itemName)}</td>
 <td>${esc(l.type || '')}</td>
 <td>${statusPill(status)}</td>
 <td class="mono">${esc(l.updatedAt || '')}</td>
 <td class="mono">${esc(l.approvedBy || '')}</td>
 <td>${editKindLabel(l)}</td>
 `;
 pendingTb.appendChild(tr);
 return;
 }

 if (l.type === 'SELL') renderListingRow(sellTb, l);
 else renderListingRow(buyTb, l);
 });
 }

 // ===== Edit listing dialog (FULL_EDIT) =====
 function syncEditModeUI_() {
 const lm = byId('editListingMode').value;
 const store = (lm === 'STORE');
 const full = (lm === 'FULL');

 byId('editStoreItemBlock').style.display = store ? '' : 'none';
 byId('editCustomItemBlock').style.display = store ? 'none' : '';

 if (full) {
 byId('editPricingMode').value = 'FIXED_BT';
 byId('editPricingMode').disabled = true;
 } else {
 byId('editPricingMode').disabled = false;
 }

 const pm = byId('editPricingMode').value;
 byId('editFixedFields').style.display = (pm === 'FIXED_BT') ? '' : 'none';
 byId('editPegBox').style.display = (pm === 'PEG') ? '' : 'none';
 byId('btnEditAddAlt').disabled = (pm !== 'PEG');
 }

 function renderEditPegBox_(soldNameGetter, soldStackGetter) {
 const box = byId('editPegBox');
 box.innerHTML = '';

 S.editState.alts = [];

 S.editState.primary = O.makePegRowDom_({
 title: 'Primary peg (required)',
 canRemove: false,
 defaultRow: S.editState.primary || { itemName:'', ui:{ priceBasis:'IND', pegQtyBasis:'IND', pegQtyInput:1 } },
 getSoldName: soldNameGetter,
 getSoldStackSize: soldStackGetter,
 getListingType: () => byId('editType')?.value || 'SELL',
 onChange: () => O.validatePegSet_(S.editState.primary, S.editState.alts, byId('editPegWarn'))
 });
 box.appendChild(S.editState.primary);

 const existingAlts = (S.editState._initialAltRows || []);
 S.editState._initialAltRows = null;

 existingAlts.forEach((a, i) => {
 const row = O.makePegRowDom_({
 title: `Alternative peg #${i +1}`,
 canRemove: true,
 defaultRow: a,
 getSoldName: soldNameGetter,
 getSoldStackSize: soldStackGetter,
 getListingType: () => byId('editType')?.value || 'SELL',
 onRemove: () => {
 const idx = S.editState.alts.indexOf(row);
 if (idx >=0) S.editState.alts.splice(idx,1);
 row.remove();
 O.validatePegSet_(S.editState.primary, S.editState.alts, byId('editPegWarn'));
 },
 onChange: () => O.validatePegSet_(S.editState.primary, S.editState.alts, byId('editPegWarn'))
 });
 S.editState.alts.push(row);
 box.appendChild(row);
 });

 O.validatePegSet_(S.editState.primary, S.editState.alts, byId('editPegWarn'));
 }

 function openEditListing(l) {
 S.editingListing = l;
 byId('editListingId').textContent = l.listingId;

 const listingMode = String(l.pricing?.listingMode || (O.safeJsonParse(l.extraJson || '{}', {}) || {}).listingMode || '').toUpperCase()
 || (String(l.sourceItemId || '').startsWith('sheet:') ? 'STORE' : 'HALF');
 byId('editListingMode').value = (listingMode === 'FULL') ? 'FULL' : (listingMode === 'STORE' ? 'STORE' : 'HALF');

 byId('editType').value = String(l.type || 'SELL').toUpperCase();

 const rem = (l.remainingQuantity == null || l.remainingQuantity === '') ? (l.qtyAvailable ??0) : l.remainingQuantity;
 const remInt = Math.max(0, Math.round(Number(rem ||0) ||0));
 byId('editQty').value = String(remInt);

 byId('editItemStore').value = '';
 byId('editItemCustom').value = '';
 byId('editStack').value = String(Number(l.stackSize ||1) ||1);

 if (byId('editListingMode').value === 'STORE') byId('editItemStore').value = l.itemName || '';
 else byId('editItemCustom').value = l.itemName || '';

 const pm = String(l.pricing?.mode || 'PEG').toUpperCase();
 byId('editPricingMode').value = (pm === 'FIXED_BT') ? 'FIXED_BT' : 'PEG';
 byId('editFixedBTVal').value = String(l.pricing?.fixedBTPerUnit ??1);

 byId('editPause').checked = String(l.statusRaw || '').toUpperCase() === 'PAUSED';
 byId('editListingMsg').textContent = '';
 byId('editPegWarn').textContent = '';

 const prim = l.pricing?.primaryPeg || (l.pricing?.pegItemName ? {
 itemName: l.pricing.pegItemName,
 ui: { priceBasis: l.pricing.pricingBasis || 'IND', pegQtyBasis:'IND', pegQtyInput: Math.max(1, Math.round(Number(l.pricing.pegQtyPerUnit ||1) ||1)) }
 } : null);

 S.editState.primary = prim || { itemName:'', ui:{ priceBasis:'IND', pegQtyBasis:'IND', pegQtyInput:1 } };
 S.editState._initialAltRows = (Array.isArray(l.pricing?.altPegs) ? l.pricing.altPegs : []).map(a => ({
 itemName: a.itemName,
 ui: a.ui || { priceBasis:'IND', pegQtyBasis:'IND', pegQtyInput:1 }
 }));

 const soldNameGetter = () => {
 const lm = byId('editListingMode').value;
 return (lm === 'STORE') ? (byId('editItemStore').value.trim() || 'ITEM') : (byId('editItemCustom').value.trim() || 'ITEM');
 };
 const soldStackGetter = () => {
 const lm = byId('editListingMode').value;
 if (lm === 'STORE') {
 const it = O.findCatalogItem(byId('editItemStore').value.trim());
 return Number(it?.bundleSize ||1) ||1;
 }
 return Number(byId('editStack').value ||1) ||1;
 };

 renderEditPegBox_(soldNameGetter, soldStackGetter);
 syncEditModeUI_();

 // Refresh PEG statement favor labels when Type dropdown changes
 try {
 const typeEl = byId('editType');
 if (typeEl && !typeEl._ocmPegTypeRefreshHooked) {
 typeEl._ocmPegTypeRefreshHooked = true;
 typeEl.addEventListener('change', () => {
 try {
 if (S.editState?.primary?.refreshStatement) S.editState.primary.refreshStatement();
 (S.editState?.alts || []).forEach(r => r?.refreshStatement && r.refreshStatement());
 } catch { /* ignore */ }
 });
 }
 } catch { /* ignore */ }

 byId('dlgEditListing').showModal();
 }

 async function saveListingEdit() {
 if (!S.editingListing) return;
 const msg = byId('editListingMsg');
 msg.textContent = 'Saving...';

 try {
 const listingId = S.editingListing.listingId;

 const listingMode = byId('editListingMode').value;
 const type = byId('editType').value;
 const paused = byId('editPause').checked;

 let itemName = '';
 let stackSize =1;
 let sourceItemId = '';

 if (listingMode === 'STORE') {
 itemName = byId('editItemStore').value.trim();
 const it = O.findCatalogItem(itemName);
 if (!it) throw new Error('Store item not found in catalog');
 stackSize = Number(it.bundleSize ||1) ||1;
 sourceItemId = 'sheet:' + it.name;
 } else {
 const itemNameRaw = byId('editItemCustom').value.trim();
 if (!itemNameRaw) throw new Error('Item name required');
 if (!O.isLettersOnly_(itemNameRaw)) throw new Error('Custom item name must contain letters only (A-Z).');
 itemName = itemNameRaw;

 stackSize = Math.max(1, Math.round(Number(byId('editStack').value ||1) ||1));
 if (!isFinite(stackSize) || stackSize <=0) throw new Error('Invalid stack size');
 sourceItemId = '';
 }

 const remainingQuantity = Math.max(0, Math.round(Number(byId('editQty').value ||0) ||0));
 if (!isFinite(remainingQuantity) || remainingQuantity <0) throw new Error('Invalid remaining quantity');

 const pricingMode = byId('editPricingMode').value;

 const payload = {
 idToken: S.googleIdToken,
 listingId,
 merchantEditKind: 'FULL_EDIT',
 listingMode,
 type,
 itemName,
 stackSize,
 sourceItemId,
 remainingQuantity,
 quantityUnits: remainingQuantity,
 pricingMode
 };

 if (paused) payload.status = 'PAUSED';

 if (listingMode === 'FULL') {
 const fixedBTPerUnit = Number(byId('editFixedBTVal').value ||0);
 if (!isFinite(fixedBTPerUnit) || fixedBTPerUnit <=0) throw new Error('Fixed BT per unit must be >0');
 payload.pricingMode = 'FIXED_BT';
 payload.fixedBTPerUnit = fixedBTPerUnit;
 } else {
 if (pricingMode === 'FIXED_BT') throw new Error('FIXED_BT is only allowed for FULL listings.');
 if (!O.validatePegSet_(S.editState.primary, S.editState.alts, byId('editPegWarn'))) throw new Error('Fix peg inputs');
 const pegPayload = O.buildPegPayload_(S.editState.primary, S.editState.alts);
 payload.pricingMode = 'PEG';
 payload.primaryPeg = pegPayload.primaryPeg;
 payload.altPegs = pegPayload.altPegs;
 }

 await apiPost('ocmUpdateListingV2', payload);
 msg.textContent = 'Saved and sent for review.';
 await O.loadMyListings();
 setTimeout(() => byId('dlgEditListing').close(),350);
 } catch (e) {
 msg.textContent = 'Error: ' + (e.message || e);
 }
 }

 // ===== Restock dialog =====
 function openRestock(l) {
 S.restockingListing = l;
 byId('restockListingId').textContent = l.listingId;
 byId('restockQtyInput').value = String(Math.max(0, Math.round(Number(l.remainingQuantity ?? l.qtyAvailable ??0) ||0)));
 byId('restockQtyMode').value = 'IND';
 byId('restockMsg').textContent = '';
 byId('dlgRestock').showModal();
 }

 async function sendRestock() {
 if (!S.restockingListing) return;
 const msg = byId('restockMsg');
 msg.textContent = 'Saving...';

 try {
 const listingId = S.restockingListing.listingId;
 const qtyIn = Math.max(0, Math.round(Number(byId('restockQtyInput').value ||0) ||0));
 const mode = byId('restockQtyMode').value;
 const ss = Number(S.restockingListing.stackSize ||1) ||1;
 const remainingQuantity = O.computeQtyUnitsFromInput(qtyIn, mode, ss);

 await apiPost('ocmUpdateListingV2', {
 idToken: S.googleIdToken,
 listingId,
 merchantEditKind: 'RESTOCK_ONLY',
 remainingQuantity,
 quantityUnits: remainingQuantity
 });

 msg.textContent = 'Restock sent for review.';
 await O.loadMyListings();
 setTimeout(() => byId('dlgRestock').close(),350);
 } catch (e) {
 msg.textContent = 'Error: ' + (e.message || e);
 }
 }

 // exports
 O.setCreationTab = setCreationTab;
 O.createListingStore = createListingStore;
 O.createListingHalf = createListingHalf;
 O.createListingFull = createListingFull;
 O.loadMyListings = loadMyListings;

 O.openEditListing = openEditListing;
 O.saveListingEdit = saveListingEdit;
 O.openRestock = openRestock;
 O.sendRestock = sendRestock;
 O.syncEditModeUI_ = syncEditModeUI_;
 O.renderEditPegBox_ = renderEditPegBox_;
})();

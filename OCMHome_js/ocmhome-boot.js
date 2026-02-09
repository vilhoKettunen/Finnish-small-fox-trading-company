// Boot wiring for OCMHome
(function () {
 'use strict';

 const O = window.OCMHome;
 const S = O.state;
 const byId = O.byId;

 function nOrNull(v) {
 const n = Number(v);
 return isFinite(n) ? n : null;
 }

 function readDraftFromUi_() {
 S.draftFilters.type = String(byId('fltType')?.value || 'SELL').toUpperCase() === 'BUY' ? 'BUY' : 'SELL';
 S.draftFilters.itemText = String(byId('fltItem')?.value || '');
 S.draftFilters.merchantText = String(byId('fltMerchant')?.value || '');
 }

 function writeDraftToUi_() {
 byId('fltType').value = S.draftFilters.type;
 byId('fltItem').value = S.draftFilters.itemText || '';
 byId('fltMerchant').value = S.draftFilters.merchantText || '';
 O.renderPegChips && O.renderPegChips();
 }

 function readImmediateFromUi_() {
 S.onlyItemPayment = !!byId('fltOnlyItemPay')?.checked;
 const min = byId('fltStockMin')?.value;
 const max = byId('fltStockMax')?.value;
 S.stockMin = (min === '' || min == null) ? null : nOrNull(min);
 S.stockMax = (max === '' || max == null) ? null : nOrNull(max);
 S.sort = String(byId('fltSort')?.value || 'NONE');
 S.pageSize = Math.max(1, Number(byId('fltPageSize')?.value ||20) ||20);
 }

 function writeImmediateToUi_() {
 byId('fltOnlyItemPay').checked = !!S.onlyItemPayment;
 byId('fltStockMin').value = (S.stockMin == null) ? '' : String(S.stockMin);
 byId('fltStockMax').value = (S.stockMax == null) ? '' : String(S.stockMax);
 byId('fltSort').value = S.sort || 'NONE';
 byId('fltPageSize').value = String(S.pageSize ||20);
 }

 window.onload = () => {
 window.initSharedTopBar && window.initSharedTopBar();
 document.body.classList.add('withTopBar');

 // Default UI
 writeDraftToUi_();
 writeImmediateToUi_();

 // Wire search-applied controls
 byId('btnSearch').addEventListener('click', () => {
 readDraftFromUi_();
 S.appliedFilters = { ...S.draftFilters, pegNames: [...(S.draftFilters.pegNames || [])] };
 S.pageIndex =0;
 O.applyFiltersAndRender && O.applyFiltersAndRender();
 });

 byId('btnReset').addEventListener('click', () => {
 S.draftFilters = { type:'SELL', itemText:'', merchantText:'', pegNames:[] };
 writeDraftToUi_();
 // Does not apply until Search
 O.updateActiveFiltersUi && O.updateActiveFiltersUi();
 });

 byId('btnRefreshListings').addEventListener('click', async () => {
 await (O.fetchListingsOnceOrRefresh && O.fetchListingsOnceOrRefresh({ force:true }));
 });

 byId('btnAddPeg').addEventListener('click', () => O.addSelectedPegFromUi && O.addSelectedPegFromUi());
 byId('btnClearPegs').addEventListener('click', () => O.clearSelectedPegs && O.clearSelectedPegs());

 // Immediate controls
 const immediateRerender = () => {
 readImmediateFromUi_();
 O.applyFiltersAndRender && O.applyFiltersAndRender();
 };
 byId('fltOnlyItemPay').addEventListener('change', immediateRerender);
 byId('fltStockMin').addEventListener('input', immediateRerender);
 byId('fltStockMax').addEventListener('input', immediateRerender);
 byId('fltSort').addEventListener('change', immediateRerender);
 byId('fltPageSize').addEventListener('change', () => { immediateRerender(); });

 // Paging
 byId('btnPrevPage').addEventListener('click', () => { if (S.pageIndex >0) { S.pageIndex--; O.applyFiltersAndRender && O.applyFiltersAndRender(); } });
 byId('btnNextPage').addEventListener('click', () => { S.pageIndex++; O.applyFiltersAndRender && O.applyFiltersAndRender(); });

 // Pending trades
 byId('btnRefreshPending').addEventListener('click', () => O.loadMyPending());

 // Auth restore flow
 O.tryRestoreAuthOnLoad();

 const gsiWait = setInterval(() => {
 if (window.google && google.accounts && google.accounts.id) {
 O.initGoogleIdentity();
 clearInterval(gsiWait);
 }
 },200);
 setTimeout(() => clearInterval(gsiWait),4000);

 // Load catalog early even before login (needed for canonical BT once listings are fetched)
 O.ensureCatalogLoaded().catch(() => { });

 // Initial UI text
 O.updateActiveFiltersUi && O.updateActiveFiltersUi();
 };
})();

// Boot/wiring for OCMUser
(function () {
 'use strict';

 const O = window.OCMUser;
 const byId = O.byId;

 window.onload = () => {
 // Enforce letters-only custom item names (HALF + FULL + EDIT)
 O.enforceLettersOnlyInput_(byId('createItemHalf'));
 O.enforceLettersOnlyInput_(byId('createItemFull'));
 O.enforceLettersOnlyInput_(byId('editItemCustom'));

 try { window.initSharedTopBar && window.initSharedTopBar(); } catch (e) { console.warn('topbar init failed', e); }
 document.body.classList.add('withTopBar');

 byId('tabCreateStore').addEventListener('click', () => O.setCreationTab('store'));
 byId('tabCreateHalf').addEventListener('click', () => O.setCreationTab('half'));
 byId('tabCreateFull').addEventListener('click', () => O.setCreationTab('full'));

 byId('btnCreateStore').addEventListener('click', O.createListingStore);
 byId('btnCreateHalf').addEventListener('click', O.createListingHalf);
 byId('btnCreateFull').addEventListener('click', O.createListingFull);

 byId('btnCreateStoreAddAlt').addEventListener('click', () => O.addAltPeg_('store'));
 byId('btnCreateHalfAddAlt').addEventListener('click', () => O.addAltPeg_('half'));

 byId('editListingMode').addEventListener('change', () => {
 O.syncEditModeUI_();
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
 O.renderEditPegBox_(soldNameGetter, soldStackGetter);
 });

 byId('editPricingMode').addEventListener('change', O.syncEditModeUI_);

 byId('btnEditAddAlt').addEventListener('click', () => {
 if (O.state.editState.alts.length >=10) { byId('editPegWarn').textContent = 'Max10 alternative pegs.'; return; }

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

 const idx = O.state.editState.alts.length +1;
 const row = O.makePegRowDom_({
 title: `Alternative peg #${idx}`,
 canRemove: true,
 defaultRow: { itemName:'', ui:{ priceBasis:'IND', pegQtyBasis:'IND', pegQtyInput:1 } },
 getSoldName: soldNameGetter,
 getSoldStackSize: soldStackGetter,
 onRemove: () => {
 const i = O.state.editState.alts.indexOf(row);
 if (i >=0) O.state.editState.alts.splice(i,1);
 row.remove();
 O.validatePegSet_(O.state.editState.primary, O.state.editState.alts, byId('editPegWarn'));
 },
 onChange: () => O.validatePegSet_(O.state.editState.primary, O.state.editState.alts, byId('editPegWarn'))
 });

 O.state.editState.alts.push(row);
 byId('editPegBox').appendChild(row);
 O.validatePegSet_(O.state.editState.primary, O.state.editState.alts, byId('editPegWarn'));
 });

 byId('btnSaveListing').addEventListener('click', O.saveListingEdit);
 byId('btnCloseListing').addEventListener('click', () => byId('dlgEditListing').close());

 byId('btnSendRestock').addEventListener('click', O.sendRestock);
 byId('btnCloseRestock').addEventListener('click', () => byId('dlgRestock').close());

 byId('btnReloadMine').addEventListener('click', O.loadPendingRequests);
 byId('btnReloadIncoming').addEventListener('click', O.loadPendingRequests);

 byId('btnSaveTrade').addEventListener('click', O.saveTradeEdit);
 byId('btnCloseTrade').addEventListener('click', () => byId('dlgEditTrade').close());

 // Creator peg UI init after catalog loads
 O.ensureCatalogLoaded().then(() => {
 O.initCreatorPegUIs_();

 byId('createItemStore').addEventListener('input', () => O.validatePegSet_(O.state.createState.store.primary, O.state.createState.store.alts, byId('createStorePegWarn')));
 byId('createItemHalf').addEventListener('input', () => O.validatePegSet_(O.state.createState.half.primary, O.state.createState.half.alts, byId('createHalfPegWarn')));
 byId('createStackHalf').addEventListener('input', () => O.validatePegSet_(O.state.createState.half.primary, O.state.createState.half.alts, byId('createHalfPegWarn')));
 });

 O.bootAuth_();
 };
})();

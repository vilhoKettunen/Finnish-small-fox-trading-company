// Boot/wiring for OCMUser
(function () {
 'use strict';

 const O = window.OCMUser;
 const byId = O.byId;

 function on(el, ev, fn) {
 if (el && el.addEventListener) el.addEventListener(ev, fn);
 }

 window.onload = () => {
 // Enforce letters-only custom item names (HALF + FULL + EDIT)
 try { O.enforceLettersOnlyInput_(byId('createItemHalf')); } catch { }
 try { O.enforceLettersOnlyInput_(byId('createItemFull')); } catch { }
 try { O.enforceLettersOnlyInput_(byId('editItemCustom')); } catch { }

 try { window.initSharedTopBar && window.initSharedTopBar(); } catch (e) { console.warn('topbar init failed', e); }
 document.body.classList.add('withTopBar');

 on(byId('tabCreateStore'), 'click', () => O.setCreationTab('store'));
 on(byId('tabCreateHalf'), 'click', () => O.setCreationTab('half'));
 on(byId('tabCreateFull'), 'click', () => O.setCreationTab('full'));

 on(byId('btnCreateStore'), 'click', O.createListingStore);
 on(byId('btnCreateHalf'), 'click', O.createListingHalf);
 on(byId('btnCreateFull'), 'click', O.createListingFull);

 on(byId('btnCreateStoreAddAlt'), 'click', () => O.addAltPeg_('store'));
 on(byId('btnCreateHalfAddAlt'), 'click', () => O.addAltPeg_('half'));

 on(byId('editListingMode'), 'change', () => {
 O.syncEditModeUI_();
 const soldNameGetter = () => {
 const lm = byId('editListingMode')?.value;
 return (lm === 'STORE') ? (byId('editItemStore')?.value.trim() || 'ITEM') : (byId('editItemCustom')?.value.trim() || 'ITEM');
 };
 const soldStackGetter = () => {
 const lm = byId('editListingMode')?.value;
 if (lm === 'STORE') {
 const it = O.findCatalogItem(byId('editItemStore')?.value.trim());
 return Number(it?.bundleSize ||1) ||1;
 }
 return Number(byId('editStack')?.value ||1) ||1;
 };
 O.renderEditPegBox_(soldNameGetter, soldStackGetter);
 });

 on(byId('editPricingMode'), 'change', O.syncEditModeUI_);

 on(byId('btnEditAddAlt'), 'click', () => {
 if (O.state.editState.alts.length >=10) {
 const w = byId('editPegWarn');
 if (w) w.textContent = 'Max10 alternative pegs.';
 return;
 }

 const soldNameGetter = () => {
 const lm = byId('editListingMode')?.value;
 return (lm === 'STORE') ? (byId('editItemStore')?.value.trim() || 'ITEM') : (byId('editItemCustom')?.value.trim() || 'ITEM');
 };
 const soldStackGetter = () => {
 const lm = byId('editListingMode')?.value;
 if (lm === 'STORE') {
 const it = O.findCatalogItem(byId('editItemStore')?.value.trim());
 return Number(it?.bundleSize ||1) ||1;
 }
 return Number(byId('editStack')?.value ||1) ||1;
 };

 const idx = O.state.editState.alts.length +1;
 const row = O.makePegRowDom_({
 title: `Alternative peg #${idx}`,
 canRemove: true,
 defaultRow: { itemName: '', ui: { priceBasis: 'IND', pegQtyBasis: 'IND', pegQtyInput:1 } },
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
 const box = byId('editPegBox');
 if (box) box.appendChild(row);
 O.validatePegSet_(O.state.editState.primary, O.state.editState.alts, byId('editPegWarn'));
 });

 on(byId('btnSaveListing'), 'click', O.saveListingEdit);
 on(byId('btnCloseListing'), 'click', () => byId('dlgEditListing')?.close());

 on(byId('btnSendRestock'), 'click', O.sendRestock);
 on(byId('btnCloseRestock'), 'click', () => byId('dlgRestock')?.close());

 // Reload helpers
 on(byId('btnReloadMine'), 'click', O.loadMyListings);
 on(byId('btnReloadMineTrades'), 'click', O.loadPendingRequests);
 on(byId('btnReloadIncoming'), 'click', O.loadPendingRequests);

 on(byId('btnSaveTrade'), 'click', O.saveTradeEdit);
 on(byId('btnCloseTrade'), 'click', () => byId('dlgEditTrade')?.close());

 // Creator peg UI init after catalog loads
 O.ensureCatalogLoaded().then(() => {
 O.initCreatorPegUIs_();

 // Register OCMUser catalog lookup for shared trade-more-info renderer (More info details)
 try {
 if (window.TradeMoreInfo && typeof window.TradeMoreInfo.setCatalogLookup === 'function' && typeof O.findCatalogItem === 'function') {
 window.TradeMoreInfo.setCatalogLookup(O.findCatalogItem);
 }
 } catch { /* ignore */ }

 on(byId('createItemStore'), 'input', () => O.validatePegSet_(O.state.createState.store.primary, O.state.createState.store.alts, byId('createStorePegWarn')));
 on(byId('createItemHalf'), 'input', () => O.validatePegSet_(O.state.createState.half.primary, O.state.createState.half.alts, byId('createHalfPegWarn')));
 on(byId('createStackHalf'), 'input', () => O.validatePegSet_(O.state.createState.half.primary, O.state.createState.half.alts, byId('createHalfPegWarn')));
 }).catch(e => console.warn('catalog init failed', e));

 // Always boot auth last (must not be blocked by missing sections)
 try { O.bootAuth_(); } catch (e) { console.warn('auth boot failed', e); }
 };
})();

// Boot wiring for Admin panel
(function () {
    'use strict';

    const Admin = window.Admin;
    const byId = Admin.byId;

function wireEvents() {
    // Requests
        const btnLoadRequests = byId('btnLoadRequests');
   if (btnLoadRequests) btnLoadRequests.onclick = window.loadPendingRequests;

    // Players/Transfer
    const btnAdjust = byId('btnAdjust');
    if (btnAdjust) btnAdjust.onclick = window.adjustBalance;
        const btnTransfer = byId('btnTransfer');
        if (btnTransfer) btnTransfer.onclick = window.transferBT;

   // Trades
  byId('btnReloadAllPendingTrades')?.addEventListener('click', window.loadAdminAllPendingTrades);
  byId('btnFilterPendingTradesToTarget')?.addEventListener('click', window.filterPendingTradesToTarget_);
   byId('btnClearPendingTradesFilter')?.addEventListener('click', window.clearPendingTradesFilter_);

        byId('btnReloadReviewQueue')?.addEventListener('click', window.loadAdminReviewQueue);
        byId('btnFilterReviewQueueToTarget')?.addEventListener('click', window.filterReviewQueueToTarget_);
    byId('btnClearReviewQueueFilter')?.addEventListener('click', window.clearReviewQueueFilter_);

    // OCM create
  byId('btnCreateStore')?.addEventListener('click', window.adminCreateListingStore);
  byId('btnCreateHalf')?.addEventListener('click', window.adminCreateListingHalf);
  byId('btnCreateFull')?.addEventListener('click', window.adminCreateListingFull);

    byId('btnCreateStoreAddAlt')?.addEventListener('click', () => window.addAltPeg_('store'));
        byId('btnCreateHalfAddAlt')?.addEventListener('click', () => window.addAltPeg_('half'));

   // OCM listings & target pending
    byId('btnReloadTargetListings')?.addEventListener('click', window.loadAdminTargetListings);
  byId('btnReloadTargetMyPending')?.addEventListener('click', window.loadAdminTargetMyPendingTrades_);
    byId('btnReloadTargetIncomingPending')?.addEventListener('click', window.loadAdminTargetIncomingPendingTrades_);

   // OCM restock dialog
   byId('btnSendRestock')?.addEventListener('click', window.sendAdminRestock_);
   byId('btnCloseRestock')?.addEventListener('click', () => byId('dlgRestock')?.close());

   // OCM edit dialog
   byId('editPricingMode')?.addEventListener('change', Admin._syncEditPricingModeUI_);
   byId('editListingMode')?.addEventListener('change', Admin._syncEditPricingModeUI_);

  byId('btnEditAddAlt')?.addEventListener('click', () => {
   const editState = Admin.state.editState;
  if (editState.alts.length >= 10) { byId('editPegWarn').textContent = 'Max 10 alternative pegs.'; return; }

        const soldNameGetter = () => byId('editItemName').value.trim() || 'ITEM';
  const soldStackGetter = () => Number(byId('editStack').value || 1) || 1;

      const idx = editState.alts.length + 1;
   const row = window.makePegRowDom_({
     title: `Alternative peg #${idx}`,
 canRemove: true,
       defaultRow: { itemName: '', ui: { priceBasis: 'IND', pegQtyBasis: 'IND', pegQtyInput: 1 } },
     getSoldName: soldNameGetter,
 getSoldStackSize: soldStackGetter,
       onRemove: () => {
 const i = editState.alts.indexOf(row);
 if (i >= 0) editState.alts.splice(i, 1);
     row.remove();
     window.validatePegSet_(editState.primary, editState.alts, byId('editPegWarn'));
 },
 onChange: () => window.validatePegSet_(editState.primary, editState.alts, byId('editPegWarn'))
   });

 editState.alts.push(row);
   byId('editPegBox').appendChild(row);
 window.validatePegSet_(editState.primary, editState.alts, byId('editPegWarn'));
        });

        byId('btnSaveListing')?.addEventListener('click', window.saveAdminListingEdit_);
        byId('btnCloseListing')?.addEventListener('click', () => byId('dlgEditListing').close());

   // History paging
    byId('adminHistoryMode')?.addEventListener('change', () => { Admin.state.adminHistoryPage = 1; window.adminLoadHistory(); });
    byId('adminBtnLoadHistory')?.addEventListener('click', () => { Admin.state.adminHistoryPage = 1; window.adminLoadHistory(); });
   byId('adminPrevHistory')?.addEventListener('click', () => { if (Admin.state.adminHistoryPage > 1) { Admin.state.adminHistoryPage--; window.adminLoadHistory(); } });
        byId('adminNextHistory')?.addEventListener('click', () => { Admin.state.adminHistoryPage++; window.adminLoadHistory(); });

  // Init per-tab lightweight UI hooks
        Admin.initStockUI && Admin.initStockUI();
   Admin.initPlayersTransferUI && Admin.initPlayersTransferUI();
    Admin.initGlobalUserSearch && Admin.initGlobalUserSearch();
    }

window.onload = () => {
    wireEvents();

  window.initLogin && window.initLogin();

    const saved = window.getSavedIdToken && window.getSavedIdToken();
    if (saved) window.onLogin(saved, true);

        window.showTab && window.showTab('targetUser');

        const gsiWait = setInterval(() => {
      if (window.google && google.accounts && google.accounts.id) {
      window.initLogin && window.initLogin();
     clearInterval(gsiWait);
   }
    }, 200);
   setTimeout(() => clearInterval(gsiWait), 4000);
    };
})();

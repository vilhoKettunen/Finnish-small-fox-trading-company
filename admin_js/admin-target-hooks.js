// Shared hook for when Admin.state.globalTargetUser changes
(function () {
 'use strict';

 const Admin = window.Admin;
 const byId = Admin?.byId;

 window.onAdminTargetUserChanged_ = function onAdminTargetUserChanged_() {
 // Keep this safe (no throws) so target selection never breaks other tabs
 try {
 // OCM Admin enable/disable
 if (window.updateOcmActingUI) window.updateOcmActingUI();

 // Refresh other target-dependent UIs
 window.refreshAdminHistoryTargetUI_ && window.refreshAdminHistoryTargetUI_();
 window.refreshAdminAccountEditTargetUI_ && window.refreshAdminAccountEditTargetUI_();

 // If currently viewing OCM admin, reload lists (best-effort)
 if (byId && byId('ocmAdminSection')?.style.display !== 'none') {
 const p = window.ensureOcmCatalogLoaded ? window.ensureOcmCatalogLoaded() : Promise.resolve();
 Promise.resolve(p).then(() => {
 window.initCreatorPegUIs_ && window.initCreatorPegUIs_();
 window.loadAdminTargetListings && window.loadAdminTargetListings();
 });
 window.loadAdminTargetPendingTrades && window.loadAdminTargetPendingTrades();
 }
 } catch {
 // ignore
 }
 };
})();

// Admin auth (Google sign-in)
(function () {
    'use strict';

    const Admin = window.Admin;
    const byId = Admin.byId;

window.initLogin = function initLogin() {
   if (!window.google || !google.accounts || !google.accounts.id) return;
  google.accounts.id.initialize({
 client_id: Admin.OAUTH_CLIENT_ID,
      callback: cred => window.onLogin(cred.credential),
  ux_mode: 'popup'
  });
  const area = byId('loginBtnArea');
        if (area) google.accounts.id.renderButton(area, { theme: 'outline', size: 'medium' });
    };

    window.onLogin = async function onLogin(token, silent = false) {
   Admin.state.googleIdToken = token;
   try {
       const r = await window.apiGet('me', { idToken: token });
        const data = (r.data || r.result || r);

      Admin.state.currentUser = data.user;
        Admin.state.currentUser.isAdmin = !!data.isAdmin;
   if (!Admin.state.currentUser.isAdmin) { byId('authStatus').textContent = 'Not admin.'; return; }

      const bal = Number(Admin.state.currentUser.balanceBT || 0);
 if (window.topbarSetAuthState) window.topbarSetAuthState({ idToken: token, user: Admin.state.currentUser, isAdmin: true, balanceBT: bal });

  byId('authStatus').textContent = `Admin: ${Admin.state.currentUser.email}`;
  byId('logoutBtn').style.display = 'inline-block';
        byId('loginBtnArea').style.display = 'none';

        const ap = byId('adminPanelBtn');
   if (ap) ap.style.display = 'inline';

      await window.loadPlayers();
       await window.loadPendingRequests();
      await window.ensureOcmCatalogLoaded();

   window.initCreatorPegUIs_ && window.initCreatorPegUIs_();
        window.updateOcmActingUI && window.updateOcmActingUI();
 window.refreshAdminHistoryTargetUI_ && window.refreshAdminHistoryTargetUI_();
        } catch (e) {
   if (!silent) byId('authStatus').textContent = 'Auth failed: ' + e.message;
    }
    };

    window.logout = function logout() {
    Admin.state.googleIdToken = null;
    Admin.state.currentUser = null;
  window.clearSavedIdToken && window.clearSavedIdToken();

    byId('authStatus').textContent = 'Logged out.';
    byId('logoutBtn').style.display = 'none';
   byId('loginBtnArea').style.display = 'block';

    byId('tbRequests').innerHTML = '';
    byId('tbAllPendingTrades').innerHTML = '';
        byId('tbReviewQueue').innerHTML = '';

  byId('tbSellListings').innerHTML = '';
    byId('tbBuyListings').innerHTML = '';
    byId('tbOtherListings').innerHTML = '';
   byId('tbTargetMyPending').innerHTML = '';
  byId('tbTargetIncomingPending').innerHTML = '';

  byId('adminHistoryTb').innerHTML = '';
    byId('adminHistoryThead').innerHTML = '';
   byId('adminHistoryMsg').textContent = '';

        Admin.state.playersCache = [];
        Admin.state.globalTargetUser = null;

  Admin.state.ocmCatalog = [];
   Admin.state.adminTargetListings = [];
   Admin.state.adminAllPendingTrades = [];
  Admin.state.adminReviewQueue = [];
        Admin.state.ocmEditingListing = null;

        Admin.state.stockItems = [];
   byId('playerList').innerHTML = '';
   byId('balancesInfo').textContent = 'Balances will appear here.';
   const pc = byId('globalPlayersCount');
   if (pc) pc.textContent = 'Players loaded: 0';
    byId('stockTableBody').innerHTML = '';

   window.updateOcmActingUI && window.updateOcmActingUI();
  window.refreshAdminHistoryTargetUI_ && window.refreshAdminHistoryTargetUI_();
    };

    window.startLogin = function startLogin() {
        // noop; login button is rendered in loginBtnArea
    };
})();

// Boot wiring for OCMHome
(function () {
 'use strict';

 const O = window.OCMHome;
 const byId = O.byId;

 window.onload = () => {
 window.initSharedTopBar && window.initSharedTopBar();
 document.body.classList.add('withTopBar');

 byId('tabSell').addEventListener('click', () => O.setTab('sell'));
 byId('tabBuy').addEventListener('click', () => O.setTab('buy'));

 byId('btnSearchSell').addEventListener('click', () => { O.state.activeTab = 'sell'; O.loadListings(); });
 byId('btnSearchBuy').addEventListener('click', () => { O.state.activeTab = 'buy'; O.loadListings(); });
 byId('btnRefreshPending').addEventListener('click', () => O.loadMyPending());

 O.tryRestoreAuthOnLoad();

 const gsiWait = setInterval(() => {
 if (window.google && google.accounts && google.accounts.id) {
 O.initGoogleIdentity();
 clearInterval(gsiWait);
 }
 },200);
 setTimeout(() => clearInterval(gsiWait),4000);

 O.updateTabVisibility();

 // Load catalog early even before login
 O.ensureCatalogLoaded().catch(() => { });
 };
})();

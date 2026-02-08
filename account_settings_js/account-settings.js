// Account Settings page logic
(function () {
 'use strict';

 let googleIdToken = null;
 let currentUser = null;

 let statsState = {
 stats: null,
 top5: null,
 isComputing: false,
 statisticsUpdatedAt: null
 };

 const OAUTH_CLIENT_ID = window.OAUTH_CLIENT_ID;

 function byId(id) { return document.getElementById(id); }

 function setText(id, text) {
 const el = byId(id);
 if (el) el.textContent = text || '';
 }

 function setVisible(id, visible) {
 const el = byId(id);
 if (!el) return;
 el.style.display = visible ? 'block' : 'none';
 }

 function updateLoginTermsWarning_() {
 setVisible('loginTermsWarning', !googleIdToken);
 }

 function setBusy(isBusy) {
 const ids = [
 'btnSavePlayerName', 'btnSaveMailbox', 'btnSaveMallMailbox', 'btnClearMallMailbox',
 'btnDeleteAccount', 'btnConfirmDelete',
 'btnRefreshStats'
 ];
 ids.forEach(id => {
 const el = byId(id);
 if (el) el.disabled = !!isBusy;
 });
 }

 function normalizeUser(u) {
 const x = u && typeof u === 'object' ? u : {};
 return {
 userId: x.userId || '',
 email: x.email || '',
 playerName: x.playerName || '',
 mailbox: x.mailbox || '',
 mallMailbox: x.mallMailbox || ''
 };
 }

 function validatePlayerName(v) {
 let s = String(v || '').trim().replace(/\s+/g, ' ');
 if (!/^[A-Za-z0-9 _-]+$/.test(s)) throw new Error('Invalid username. Allowed: letters, numbers, spaces, "_" and "-".');
 if (s.length <2 || s.length >32) throw new Error('Invalid username length (2–32).');
 return s;
 }

 function validateMailbox(v) {
 let s = String(v || '').trim().toUpperCase();
 s = s.replace(/\s+/g, '');
 const m = s.match(/^(\d+)([AB])\/(\d+)([AB])\/F(\d+)$/);
 if (!m) throw new Error('Invalid mailbox format. Use "4A /1A / F1".');
 const n1 = Number(m[1]);
 const l1 = m[2];
 const n2 = Number(m[3]);
 const l2 = m[4];
 const f = Number(m[5]);
 if (!isFinite(n1) || n1 <1 || n1 >999) throw new Error('Invalid mailbox: first number out of range.');
 if (!isFinite(n2) || n2 <1 || n2 >999) throw new Error('Invalid mailbox: second number out of range.');
 if (!isFinite(f) || f <1 || f >999) throw new Error('Invalid mailbox: floor out of range.');
 return `${n1}${l1} / ${n2}${l2} / F${f}`;
 }

 function validateMallMailbox(v) {
 let s = String(v || '').trim().toUpperCase();
 if (!s) return '';
 s = s.replace(/\s+/g, '');
 const m = s.match(/^M(\d+)([AB])\/M(\d+)([AB])\/F(\d+)$/);
 if (!m) throw new Error('Invalid mall mailbox format. Use "M1A / M1A / F1".');
 const a = Number(m[1]);
 const aL = m[2];
 const b = Number(m[3]);
 const bL = m[4];
 const f = Number(m[5]);
 if (!isFinite(a) || a <1 || a >999) throw new Error('Invalid mall mailbox: first number out of range.');
 if (!isFinite(b) || b <1 || b >999) throw new Error('Invalid mall mailbox: second number out of range.');
 if (!isFinite(f) || f <1 || f >999) throw new Error('Invalid mall mailbox: floor out of range.');
 return `M${a}${aL} / M${b}${bL} / F${f}`;
 }

 function applyUserToForm(u) {
 byId('inpPlayerName').value = u.playerName || '';
 byId('inpMailbox').value = u.mailbox || '';
 byId('inpMallMailbox').value = u.mallMailbox || '';
 }

 function fmtNumber_(n, digs =0) {
 const v = Number(n);
 if (!isFinite(v)) return '—';
 return v.toFixed(digs);
 }

 function fmtIso_(iso) {
 const s = String(iso || '').trim();
 if (!s) return '—';
 const d = new Date(s);
 if (isNaN(d.getTime())) return s;
 return d.toISOString().replace('T', ' ').replace('Z', '');
 }

 function pickStoreFavorite_(side, mode) {
 const st = statsState.stats;
 const fav = st?.store?.favorites?.[side]?.[mode];
 return fav && typeof fav === 'object' ? fav : null;
 }

 function renderStoreFavorites_() {
 const buyMode = String(byId('selStoreBuyMode')?.value || 'byQty');
 const sellMode = String(byId('selStoreSellMode')?.value || 'byQty');

 const favBuy = pickStoreFavorite_('buy', buyMode);
 setText('st_storeFavBuyName', favBuy?.itemName || '—');
 setText('st_storeFavBuyQty', favBuy ? fmtNumber_(favBuy.totalQty,0) : '—');
 setText('st_storeFavBuyValue', favBuy ? fmtNumber_(favBuy.totalValueBT,2) : '—');
 setText('st_storeFavBuyRows', favBuy ? fmtNumber_(favBuy.rows,0) : '—');

 const favSell = pickStoreFavorite_('sell', sellMode);
 setText('st_storeFavSellName', favSell?.itemName || '—');
 setText('st_storeFavSellQty', favSell ? fmtNumber_(favSell.totalQty,0) : '—');
 setText('st_storeFavSellValue', favSell ? fmtNumber_(favSell.totalValueBT,2) : '—');
 setText('st_storeFavSellRows', favSell ? fmtNumber_(favSell.rows,0) : '—');
 }

 function fmtList_(arr, lineFn) {
 const a = Array.isArray(arr) ? arr : [];
 if (!a.length) return '—';
 return a.map((x, i) => lineFn(x, i)).join('\n');
 }

 function renderTop5_() {
 const t = statsState.top5;
 if (!t) {
 setText('top5_store_buy_byQty', '—');
 setText('top5_store_buy_byValue', '—');
 setText('top5_store_buy_byRows', '—');
 setText('top5_store_sell_byQty', '—');
 setText('top5_store_sell_byValue', '—');
 setText('top5_store_sell_byRows', '—');
 setText('top5_ocm_counterparties', '—');
 setText('top5_ocm_itemsSold_byCount', '—');
 setText('top5_ocm_itemsSold_byValue', '—');
 setText('top5_ocm_itemsBought_byCount', '—');
 setText('top5_ocm_itemsBought_byValue', '—');
 setText('top5_ocm_pegsUsed_byCount', '—');
 setText('top5_ocm_pegsUsed_byValue', '—');
 setText('top5_ocm_pegsRecv_byCount', '—');
 setText('top5_ocm_pegsRecv_byValue', '—');
 return;
 }

 const storeBuy = t?.storeTop5?.buy;
 const storeSell = t?.storeTop5?.sell;

 const fmtStoreItem_ = (x, i) => `${i +1}. ${x?.itemName || '—'} | qty=${fmtNumber_(x?.totalQty,0)} | value=${fmtNumber_(x?.totalValueBT,2)} | requests=${fmtNumber_(x?.rows,0)}`;

 setText('top5_store_buy_byQty', fmtList_(storeBuy?.byQty, fmtStoreItem_));
 setText('top5_store_buy_byValue', fmtList_(storeBuy?.byValue, fmtStoreItem_));
 setText('top5_store_buy_byRows', fmtList_(storeBuy?.byRows, fmtStoreItem_));

 setText('top5_store_sell_byQty', fmtList_(storeSell?.byQty, fmtStoreItem_));
 setText('top5_store_sell_byValue', fmtList_(storeSell?.byValue, fmtStoreItem_));
 setText('top5_store_sell_byRows', fmtList_(storeSell?.byRows, fmtStoreItem_));

 const fmtCp_ = (x, i) => `${i +1}. ${x?.playerName || x?.userId || '—'} | trades=${fmtNumber_(x?.tradesCount,0)} | value=${fmtNumber_(x?.totalValueBT,2)}`;
 setText('top5_ocm_counterparties', fmtList_(t?.ocmTop5?.counterparties, fmtCp_));

 const fmtOcmItem_ = (x, i) => `${i +1}. ${x?.itemName || '—'} | trades=${fmtNumber_(x?.tradesCount,0)} | value=${fmtNumber_(x?.totalValueBT,2)}`;
 setText('top5_ocm_itemsSold_byCount', fmtList_(t?.ocmTop5?.itemsSoldAsMerchant?.byCount, fmtOcmItem_));
 setText('top5_ocm_itemsSold_byValue', fmtList_(t?.ocmTop5?.itemsSoldAsMerchant?.byValueBT, fmtOcmItem_));

 setText('top5_ocm_itemsBought_byCount', fmtList_(t?.ocmTop5?.itemsBoughtAsBuyer?.byCount, fmtOcmItem_));
 setText('top5_ocm_itemsBought_byValue', fmtList_(t?.ocmTop5?.itemsBoughtAsBuyer?.byValueBT, fmtOcmItem_));

 const fmtPeg_ = (x, i) => `${i +1}. ${x?.itemName || '—'} | trades=${fmtNumber_(x?.tradesCount,0)} | value=${fmtNumber_(x?.totalValueBT,2)}`;
 setText('top5_ocm_pegsUsed_byCount', fmtList_(t?.ocmTop5?.pegsUsedAsBuyer?.byCount, fmtPeg_));
 setText('top5_ocm_pegsUsed_byValue', fmtList_(t?.ocmTop5?.pegsUsedAsBuyer?.byValueBT, fmtPeg_));

 setText('top5_ocm_pegsRecv_byCount', fmtList_(t?.ocmTop5?.pegsReceivedAsMerchant?.byCount, fmtPeg_));
 setText('top5_ocm_pegsRecv_byValue', fmtList_(t?.ocmTop5?.pegsReceivedAsMerchant?.byValueBT, fmtPeg_));
 }

 function renderStats_() {
 const st = statsState.stats;
 if (!st) {
 setText('statsStatus', googleIdToken ? 'No statistics yet.' : 'Login to see statistics.');
 setText('preStatsRaw', '—');
 renderTop5_();
 return;
 }

 // Meta
 setText('statsUpdatedAt', fmtIso_(statsState.statisticsUpdatedAt || st.computedAt));

 // Store
 setText('st_storeTrades', fmtNumber_(st?.store?.tradesWithStoreCount,0));
 setText('st_storeNet', fmtNumber_(st?.store?.netDeltaBT,2));
 setText('st_storeLast', fmtNumber_(st?.store?.lastStoreAt));
 setText('st_storeMaxBuy', fmtNumber_(st?.store?.maxBuyValueBT,2));
 setText('st_storeMaxSell', fmtNumber_(st?.store?.maxSellValueBT,2));
 renderStoreFavorites_();

 // OCM
 setText('st_ocmTrades', fmtNumber_(st?.ocm?.totalTradesCount,0));
 setText('st_ocmCompletedMerchant', fmtNumber_(st?.ocm?.completedByMerchantCount,0));
 setText('st_ocmCompletedAdmin', fmtNumber_(st?.ocm?.completedByAdminCount,0));
 // Customer/merchant terminology: keep ids unchanged for compatibility
 setText('st_ocmAsBuyer', fmtNumber_(st?.ocm?.asBuyerCount,0));
 setText('st_ocmAsMerchant', fmtNumber_(st?.ocm?.asMerchantCount,0));
 setText('st_ocmTotalValue', fmtNumber_(st?.ocm?.totalValueBT,2));
 setText('st_ocmFees', fmtNumber_(st?.ocm?.feesPaidBT,2));
 setText('st_ocmMax', fmtNumber_(st?.ocm?.maxTradeValueBT,2));
 setText('st_ocmLast', fmtIso_(st?.ocm?.lastTradeAt));
 setText('st_ocmActiveListings', fmtNumber_(st?.ocm?.activeListingsCount,0));

 // Counterparty
 const cp = st?.ocm?.favoriteCounterparty;
 setText('st_ocmFavCounterparty', cp?.playerName || '—');
 setText('st_ocmFavCounterpartyCount', cp ? fmtNumber_(cp.tradesCount,0) : '—');
 setText('st_ocmFavCounterpartyValue', cp ? fmtNumber_(cp.totalValueBT,2) : '—');

 // OCM favorites mirrored into core
 setText('st_ocmFavItemSold', st?.ocm?.favoriteItemSoldAsMerchant?.itemName || '—');
 setText('st_ocmFavItemBought', st?.ocm?.favoriteItemBoughtAsBuyer?.itemName || '—');
 setText('st_ocmFavPegUsed', st?.ocm?.favoritePegUsedAsBuyer?.itemName || '—');
 setText('st_ocmFavPegReceived', st?.ocm?.favoritePegReceivedAsMerchant?.itemName || '—');

 // Top5 panel
 renderTop5_();

 // Debug
 const dbg = {
 stats: statsState.stats,
 top5: statsState.top5,
 statisticsUpdatedAt: statsState.statisticsUpdatedAt,
 isComputing: statsState.isComputing
 };
 setText('preStatsRaw', JSON.stringify(dbg, null,2));
 }

 function applyStatsResponse_(d) {
 statsState.stats = d?.stats || null;
 statsState.top5 = d?.top5 || null;
 statsState.isComputing = !!d?.isComputing;
 statsState.statisticsUpdatedAt = d?.statisticsUpdatedAt || null;

 if (statsState.isComputing) {
 setText('statsStatus', 'Updating statistics… please wait.');
 } else {
 setText('statsStatus', 'Loaded.');
 }

 const refreshBtn = byId('btnRefreshStats');
 if (refreshBtn) refreshBtn.disabled = (!googleIdToken) || statsState.isComputing;

 renderStats_();
 }

 async function loadStats_(force) {
 if (!googleIdToken) {
 applyStatsResponse_({ stats: null, top5: null, isComputing: false, statisticsUpdatedAt: null });
 return;
 }

 const refreshBtn = byId('btnRefreshStats');
 if (refreshBtn) refreshBtn.disabled = true;

 setText('statsStatus', force ? 'Refreshing…' : 'Loading…');

 try {
 const r = await window.apiGet('getMyStatistics', { idToken: googleIdToken, force: force ? 'true' : '' });
 const d = r && (r.data || r.result || r);
 applyStatsResponse_(d);
 } catch (e) {
 setText('statsStatus', 'Error loading statistics: ' + (e.message || e));
 // keep old state visible
 if (refreshBtn) refreshBtn.disabled = false;
 }
 }

 async function loadMeAndApply_() {
 const me = await window.apiGet('me', { idToken: googleIdToken });
 const d = me && (me.data || me.result || me);
 const user = normalizeUser(d?.user || d?.data?.user || d?.result?.user || d?.user);

 currentUser = user;

 // Use getBalance for the chip
 let bal =0;
 try {
 const b = await window.apiGet('getBalance', { idToken: googleIdToken });
 const bd = b && (b.data || b.result || b);
 bal = Number(bd?.balanceBT ?? bd?.data?.balanceBT ??0) ||0;
 } catch {
 bal = Number(user.balanceBT ||0) ||0;
 }

 if (window.topbarSetAuthState) {
 window.topbarSetAuthState({
 idToken: googleIdToken,
 user: {
 ...user,
 balanceBT: bal
 },
 isAdmin: !!d?.isAdmin,
 balanceBT: bal
 });
 }

 setText('authStatus', 'Logged in as ' + (user.playerName || user.email || user.userId));
 applyUserToForm(user);

 // Now load statistics (cached)
 await loadStats_(false);
 }

 async function onLoginFromToken_(idToken, silent) {
 googleIdToken = idToken;
 updateLoginTermsWarning_();
 if (!googleIdToken) return;

 try {
 setText('loginStatus', silent ? 'Restoring session…' : 'Verifying token…');
 if (typeof window.verifyIdTokenInfo === 'function') {
 await window.verifyIdTokenInfo(googleIdToken);
 } else {
 const tResp = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(googleIdToken)}`);
 if (!tResp.ok) throw new Error('tokeninfo failed ' + tResp.status);
 const info = await tResp.json();
 if (info.aud !== OAUTH_CLIENT_ID) throw new Error('Invalid audience');
 }

 window.saveIdToken && window.saveIdToken(googleIdToken);

 setText('loginStatus', 'Loading profile…');
 await loadMeAndApply_();
 setText('loginStatus', 'Logged in.');
 updateLoginTermsWarning_();
 } catch (e) {
 setText('loginStatus', 'Login error: ' + (e.message || e));
 }
 }

 // ===== Google Identity =====
 window.initGoogleIdentity = function initGoogleIdentity() {
 if (!window.google || !google.accounts || !google.accounts.id) return;
 google.accounts.id.initialize({
 client_id: OAUTH_CLIENT_ID,
 callback: (resp) => window.onGoogleSignIn(resp),
 ux_mode: 'popup',
 auto_select: false,
 use_fedcm_for_prompt: true
 });
 google.accounts.id.renderButton(
 document.getElementById('googleBtn'),
 { theme: 'outline', size: 'large', type: 'standard', shape: 'rectangular', logo_alignment: 'left' }
 );
 };

 window.startFallbackLogin = function startFallbackLogin() {
 const nonce = crypto.getRandomValues(new Uint32Array(1))[0].toString(16);
 const redirectUri = location.origin + location.pathname;
 const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth'
 + '?client_id=' + encodeURIComponent(OAUTH_CLIENT_ID)
 + '&redirect_uri=' + encodeURIComponent(redirectUri)
 + '&response_type=id_token'
 + '&scope=' + encodeURIComponent('openid email profile')
 + '&nonce=' + encodeURIComponent(nonce)
 + '&prompt=select_account';
 window.location.href = authUrl;
 };

 window.onGoogleSignIn = function onGoogleSignIn(resp) {
 const token = resp && resp.credential;
 if (!token) {
 setText('loginStatus', 'Login error: no credential');
 return;
 }
 onLoginFromToken_(token, false);
 };

 function checkHashForIdToken_() {
 if (!location.hash) return;
 const params = new URLSearchParams(location.hash.slice(1));
 const idt = params.get('id_token');
 if (idt) {
 window.onGoogleSignIn({ credential: idt });
 history.replaceState({}, document.title, location.pathname + location.search);
 }
 }

 async function tryRestoreAuth_() {
 if (!window.initAuthFromStorage) return;
 const r = await window.initAuthFromStorage();
 if (r && r.ok && r.idToken) {
 await onLoginFromToken_(r.idToken, true);
 }
 }

 // ===== Save handlers =====
 async function saveProfile_(patch) {
 if (!googleIdToken) throw new Error('Not logged in');
 setBusy(true);
 setText('saveMsg', 'Saving…');
 try {
 await window.apiPost('updateMyProfile', {
 idToken: googleIdToken,
 payload: patch
 });
 await loadMeAndApply_();
 setText('saveMsg', 'Saved.');
 } catch (e) {
 setText('saveMsg', 'Error: ' + (e.message || e));
 } finally {
 setBusy(false);
 }
 }

 async function deleteAccount_() {
 if (!googleIdToken) throw new Error('Not logged in');
 setBusy(true);
 setText('deleteMsg', 'Deleting…');
 try {
 await window.apiPost('deleteMyAccount', {
 idToken: googleIdToken,
 confirm: true
 });

 // clear local auth
 window.clearSavedIdToken && window.clearSavedIdToken();
 googleIdToken = null;
 updateLoginTermsWarning_();
 currentUser = null;

 if (window.topbarSetAuthState) {
 window.topbarSetAuthState({ idToken: null, user: null, isAdmin: false, balanceBT: null });
 }

 setText('deleteMsg', 'Account deleted.');
 // Redirect home
 location.href = 'index.html';
 } catch (e) {
 setText('deleteMsg', 'Error: ' + (e.message || e));
 } finally {
 setBusy(false);
 }
 }

 function wireUi_() {
 byId('btnSavePlayerName').addEventListener('click', () => {
 try {
 const playerName = validatePlayerName(byId('inpPlayerName').value);
 saveProfile_({ playerName, mailbox: currentUser?.mailbox || '', mallMailbox: currentUser?.mallMailbox || '' });
 } catch (e) {
 setText('saveMsg', 'Error: ' + (e.message || e));
 }
 });

 byId('btnSaveMailbox').addEventListener('click', () => {
 try {
 const mailbox = validateMailbox(byId('inpMailbox').value);
 saveProfile_({ playerName: currentUser?.playerName || '', mailbox, mallMailbox: currentUser?.mallMailbox || '' });
 } catch (e) {
 setText('saveMsg', 'Error: ' + (e.message || e));
 }
 });

 byId('btnSaveMallMailbox').addEventListener('click', () => {
 try {
 const mallMailbox = validateMallMailbox(byId('inpMallMailbox').value);
 saveProfile_({ playerName: currentUser?.playerName || '', mailbox: currentUser?.mailbox || '', mallMailbox });
 } catch (e) {
 setText('saveMsg', 'Error: ' + (e.message || e));
 }
 });

 byId('btnClearMallMailbox').addEventListener('click', () => {
 byId('inpMallMailbox').value = '';
 saveProfile_({ playerName: currentUser?.playerName || '', mailbox: currentUser?.mailbox || '', mallMailbox: '' });
 });

 // Delete dialog
 const dlg = byId('dlgDelete');
 byId('btnDeleteAccount').addEventListener('click', () => {
 if (!dlg) return;
 dlg.showModal();
 });
 byId('btnCancelDelete').addEventListener('click', () => {
 if (!dlg) return;
 dlg.close();
 });
 byId('btnConfirmDelete').addEventListener('click', async () => {
 if (dlg) dlg.close();
 await deleteAccount_();
 });

 // Stats
 byId('btnRefreshStats')?.addEventListener('click', async () => {
 await loadStats_(true);
 });
 byId('selStoreBuyMode')?.addEventListener('change', () => {
 renderStoreFavorites_();
 });
 byId('selStoreSellMode')?.addEventListener('change', () => {
 renderStoreFavorites_();
 });
 }

 // ===== Boot =====
 window.addEventListener('load', async () => {
 window.initSharedTopBar && window.initSharedTopBar();
 document.body.classList.add('withTopBar');

 // initial warning state
 updateLoginTermsWarning_();

 wireUi_();
 checkHashForIdToken_();

 // init GSI
 const gsiWait = setInterval(() => {
 if (window.google && google.accounts && google.accounts.id) {
 window.initGoogleIdentity && window.initGoogleIdentity();
 clearInterval(gsiWait);
 }
 },200);
 setTimeout(() => clearInterval(gsiWait),4000);

 await tryRestoreAuth_();

 // If not logged in, still show stats placeholder
 if (!googleIdToken) {
 setText('statsStatus', 'Login to see statistics.');
 renderStats_();
 }
 });
})();

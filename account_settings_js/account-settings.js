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
 const incomplete = !googleIdToken ? true :
 (!String(currentUser?.playerName || '').trim() || !String(currentUser?.mailbox || '').trim());
 if (typeof window.setLoginTermsWarningVisible_ === 'function') {
 window.setLoginTermsWarningVisible_(!googleIdToken || incomplete);
 } else {
 setVisible('loginTermsWarning', !googleIdToken || incomplete);
 }
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
 mallMailbox: x.mallMailbox || '',
 leaderboardConsent: x.leaderboardConsent || 'OUT',
 leaderboardAnonLabel: x.leaderboardAnonLabel || ''
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

 const sel = byId('selLeaderboardConsent');
 if (sel) sel.value = String(u.leaderboardConsent || 'OUT');

 const anon = byId('lblAnonName');
 if (anon) anon.textContent = u.leaderboardAnonLabel || 'Anonymous';

 updateLeaderboardUi_(u);
 }

 function updateLeaderboardUi_(u) {
 const consent = String((u && u.leaderboardConsent) || byId('selLeaderboardConsent')?.value || 'OUT').toUpperCase();
 const showHalf = consent === 'HALF';
 setVisible('leaderboardHalfInfo', showHalf);
 if (showHalf) {
 const anon = byId('lblAnonName');
 const label = (u && u.leaderboardAnonLabel) || currentUser?.leaderboardAnonLabel || 'Anonymous';
 if (anon) anon.textContent = label;
 }
 }

 function getConsentFromUi_() {
 const sel = byId('selLeaderboardConsent');
 const v = String(sel ? sel.value : 'OUT').trim().toUpperCase();
 if (v !== 'OUT' && v !== 'HALF' && v !== 'FULL') return 'OUT';
 return v;
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

 // ── Store favorites: rank source label ──────────────────────────────────
 function modeLabel_(mode) {
 if (mode === 'byQty') return '#1 by quantity';
 if (mode === 'byValue') return '#1 by EW value';
 if (mode === 'byRows') return '#1 by distinct requests';
 return '#1';
 }

 // A2 fix: read from top5.storeTop5, not stats.store.favorites
 function renderStoreFavorites_() {
 const buyMode  = String(byId('selStoreBuyMode')?.value  || 'byValue');
 const sellMode = String(byId('selStoreSellMode')?.value || 'byValue');

 // Update rank source labels
 const buyRankEl = byId('st_storeFavBuyRank');
 if (buyRankEl) buyRankEl.textContent = modeLabel_(buyMode);
 const sellRankEl = byId('st_storeFavSellRank');
 if (sellRankEl) sellRankEl.textContent = modeLabel_(sellMode);

 const favBuy  = statsState.top5?.storeTop5?.buy?.[buyMode]?.[0]  ?? null;
 const favSell = statsState.top5?.storeTop5?.sell?.[sellMode]?.[0] ?? null;

 setText('st_storeFavBuyName',   favBuy?.itemName  || 'No data');
 setText('st_storeFavBuyQty',    favBuy  ? fmtNumber_(favBuy.totalQty,    0) : '0');
 setText('st_storeFavBuyValue',  favBuy  ? fmtNumber_(favBuy.totalValueEW, 2) : '0');
 setText('st_storeFavBuyRows',   favBuy  ? fmtNumber_(favBuy.rows,      0) : '0');

 setText('st_storeFavSellName',  favSell?.itemName || 'No data');
 setText('st_storeFavSellQty',   favSell ? fmtNumber_(favSell.totalQty,    0) : '0');
 setText('st_storeFavSellValue', favSell ? fmtNumber_(favSell.totalValueEW, 2) : '0');
 setText('st_storeFavSellRows',  favSell ? fmtNumber_(favSell.rows,         0) : '0');
 }

 // A6 fix: empty array returns "No data" instead of "—"
 function fmtList_(arr, lineFn) {
 const a = Array.isArray(arr) ? arr : [];
 if (!a.length) return 'No data';
 return a.map((x, i) => lineFn(x, i)).join('\n');
 }

 // A3 fix: corrected OCM property paths to match actual backend schema
 function renderTop5_() {
 const t = statsState.top5;
 if (!t) {
 setText('top5_store_buy_byQty',   'No data');
 setText('top5_store_buy_byValue', 'No data');
 setText('top5_store_buy_byRows',  'No data');
 setText('top5_store_sell_byQty',  'No data');
 setText('top5_store_sell_byValue', 'No data');
 setText('top5_store_sell_byRows', 'No data');
 setText('top5_ocm_favMerchants',         'No data');
 setText('top5_ocm_favCustomers',         'No data');
 setText('top5_ocm_itemsSold_byCount',    'No data');
 setText('top5_ocm_itemsSold_byValue',    'No data');
 setText('top5_ocm_itemsBought_byCount',  'No data');
 setText('top5_ocm_itemsBought_byValue',  'No data');
 setText('top5_ocm_pegsUsed_byCount',     'No data');
 setText('top5_ocm_pegsUsed_byValue',     'No data');
 setText('top5_ocm_pegsRecv_byCount',     'No data');
 setText('top5_ocm_pegsRecv_byValue','No data');
 return;
 }

 const storeBuy  = t?.storeTop5?.buy;
 const storeSell = t?.storeTop5?.sell;

 const fmtStoreItem_ = (x, i) => `${i + 1}. ${x?.itemName || '—'} | qty=${fmtNumber_(x?.totalQty, 0)} | value=${fmtNumber_(x?.totalValueEW, 2)} | requests=${fmtNumber_(x?.rows, 0)}`;

 setText('top5_store_buy_byQty',   fmtList_(storeBuy?.byQty,   fmtStoreItem_));
 setText('top5_store_buy_byValue', fmtList_(storeBuy?.byValue, fmtStoreItem_));
 setText('top5_store_buy_byRows',  fmtList_(storeBuy?.byRows,  fmtStoreItem_));

 setText('top5_store_sell_byQty', fmtList_(storeSell?.byQty,   fmtStoreItem_));
 setText('top5_store_sell_byValue', fmtList_(storeSell?.byValue, fmtStoreItem_));
 setText('top5_store_sell_byRows',  fmtList_(storeSell?.byRows,  fmtStoreItem_));

 // Counterparties: split schema — favoriteMerchants (you as buyer) and favoriteCustomers (you as seller)
 // Use Number() coercion to guarantee a real integer, avoiding NaN → '—' (U+2014) rendering as replacement char
 const fmtCp_ = (x, i) => `${i + 1}. ${x?.playerName || x?.userId || '—'} | trades=${Number(x?.count ?? 0)} | value=${fmtNumber_(x?.totalValueEW, 2)} EW`;
 const cpTop5 = t?.ocmTop5?.counterparties;
 const merchantsList = Array.isArray(cpTop5?.favoriteMerchants) ? cpTop5.favoriteMerchants : [];
 const customersList = Array.isArray(cpTop5?.favoriteCustomers)  ? cpTop5.favoriteCustomers  : [];

 setText('top5_ocm_favMerchants', fmtList_(merchantsList, fmtCp_));
 setText('top5_ocm_favCustomers', fmtList_(customersList, fmtCp_));

 // Use Number() coercion on count to guarantee a real integer, avoiding NaN → '—' rendering as replacement char
 const fmtOcmItem_ = (x, i) => `${i + 1}. ${x?.itemName || '—'} | trades=${Number(x?.count ?? 0)} | qty=${fmtNumber_(x?.totalQty, 0)} | value=${fmtNumber_(x?.totalValueEW, 2)} EW`;

 setText('top5_ocm_itemsSold_byCount', fmtList_(t?.ocmTop5?.itemsSoldAsMerchant?.byCount,     fmtOcmItem_));
 setText('top5_ocm_itemsSold_byValue', fmtList_(t?.ocmTop5?.itemsSoldAsMerchant?.byValueEW,   fmtOcmItem_));

 setText('top5_ocm_itemsBought_byCount', fmtList_(t?.ocmTop5?.itemsBoughtAsCustomer?.byCount,   fmtOcmItem_));
 setText('top5_ocm_itemsBought_byValue', fmtList_(t?.ocmTop5?.itemsBoughtAsCustomer?.byValueEW, fmtOcmItem_));

 const fmtPeg_ = (x, i) => `${i + 1}. ${x?.itemName || '—'} | trades=${Number(x?.count ?? 0)} | qty=${fmtNumber_(x?.totalQty, 0)} | value=${fmtNumber_(x?.totalValueEW, 2)} EW`;
 setText('top5_ocm_pegsUsed_byCount', fmtList_(t?.ocmTop5?.pegsUsedAsCustomer?.byCount,       fmtPeg_));
 setText('top5_ocm_pegsUsed_byValue', fmtList_(t?.ocmTop5?.pegsUsedAsCustomer?.byValueEW,     fmtPeg_));

 setText('top5_ocm_pegsRecv_byCount', fmtList_(t?.ocmTop5?.pegsReceivedAsMerchant?.byCount,   fmtPeg_));
 setText('top5_ocm_pegsRecv_byValue', fmtList_(t?.ocmTop5?.pegsReceivedAsMerchant?.byValueEW, fmtPeg_));
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
 setText('st_storeTrades',   fmtNumber_(st?.store?.tradesWithStoreCount, 0));
 setText('st_storeNet',      fmtNumber_(st?.store?.netDeltaBT, 2));
 // A1 fix: use fmtIso_ not fmtNumber_ for date field
 setText('st_storeLast',     fmtIso_(st?.store?.lastStoreAt));
 setText('st_storeMaxBuy',   fmtNumber_(st?.store?.maxBuyValueEW, 2));
 setText('st_storeMaxSell',  fmtNumber_(st?.store?.maxSellValueEW, 2));
 renderStoreFavorites_();

 // OCM
 setText('st_ocmTrades',  fmtNumber_(st?.ocm?.totalTradesCount, 0));
 setText('st_ocmCompletedMerchant',  fmtNumber_(st?.ocm?.completedByMerchantCount, 0));
 setText('st_ocmCompletedAdmin',     fmtNumber_(st?.ocm?.completedByAdminCount, 0));
 setText('st_ocmAsBuyer',    fmtNumber_(st?.ocm?.asCustomerCount, 0));
 setText('st_ocmAsMerchant',         fmtNumber_(st?.ocm?.asMerchantCount, 0));
 setText('st_ocmTotalValue',         fmtNumber_(st?.ocm?.totalValueEW, 2));
 setText('st_ocmFees',        fmtNumber_(st?.ocm?.feesPaidEW, 2));
 setText('st_ocmMax',     fmtNumber_(st?.ocm?.maxTradeValueEW, 2));
 setText('st_ocmLast',  fmtIso_(st?.ocm?.lastTradeAt));
 setText('st_ocmActiveListings',   fmtNumber_(st?.ocm?.activeListingsCount, 0));

 // Counterparties: read from new split schema
 const top5 = statsState.top5;
 const cpTop5 = top5?.ocmTop5?.counterparties;
 const favMerchant = (cpTop5?.favoriteMerchants ?? [])[0] ?? null;
 const favCustomer = (cpTop5?.favoriteCustomers ?? [])[0] ?? null;

 setText('st_ocmFavMerchant',      favMerchant?.playerName || favMerchant?.userId || 'No data');
 setText('st_ocmFavMerchantCount', favMerchant ? String(Number(favMerchant.count ?? 0)) : '0');
 setText('st_ocmFavMerchantValue', favMerchant ? fmtNumber_(favMerchant.totalValueEW, 2) : '0');

 setText('st_ocmFavCustomer',      favCustomer?.playerName || favCustomer?.userId || 'No data');
 setText('st_ocmFavCustomerCount', favCustomer ? String(Number(favCustomer.count ?? 0)) : '0');
 setText('st_ocmFavCustomerValue', favCustomer ? fmtNumber_(favCustomer.totalValueEW, 2) : '0');

 // A4 fix: pull item/peg favorites from sidecar top5[0]
 const favSold   = top5?.ocmTop5?.itemsSoldAsMerchant?.byCount?.[0]    ?? null;
 const favBought = top5?.ocmTop5?.itemsBoughtAsCustomer?.byCount?.[0]  ?? null;
 const favPegU   = top5?.ocmTop5?.pegsUsedAsCustomer?.byCount?.[0]     ?? null;
 const favPegR   = top5?.ocmTop5?.pegsReceivedAsMerchant?.byCount?.[0] ?? null;

 setText('st_ocmFavItemSold',    favSold?.itemName   || 'No data');
 setText('st_ocmFavItemBought',  favBought?.itemName || 'No data');
 setText('st_ocmFavPegUsed',     favPegU?.itemName   || 'No data');
 setText('st_ocmFavPegReceived', favPegR?.itemName   || 'No data');

 // Top5 panel
 renderTop5_();

 // Debug
 const dbg = {
 stats: statsState.stats,
 top5: statsState.top5,
 statisticsUpdatedAt: statsState.statisticsUpdatedAt,
 isComputing: statsState.isComputing
 };
 setText('preStatsRaw', JSON.stringify(dbg, null, 2));
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
 if (refreshBtn) refreshBtn.disabled = false;
 }
 }

 async function loadMeAndApply_() {
 const me = await window.apiGet('me', { idToken: googleIdToken });
 const d = me && (me.data || me.result || me);
 const user = normalizeUser(d?.user || d?.data?.user || d?.result?.user || d?.user);

 currentUser = user;

 let bal = 0;
 try {
 const b = await window.apiGet('getBalance', { idToken: googleIdToken });
 const bd = b && (b.data || b.result || b);
 bal = Number(bd?.balanceBT ?? bd?.data?.balanceBT ?? 0) || 0;
 } catch {
 bal = Number(user.balanceBT || 0) || 0;
 }

 if (window.topbarSetAuthState) {
 window.topbarSetAuthState({
 idToken: googleIdToken,
 user: { ...user, balanceBT: bal },
 isAdmin: !!d?.isAdmin,
 balanceBT: bal
 });
 }

 setText('authStatus', 'Logged in as ' + (user.playerName || user.email || user.userId));
 applyUserToForm(user);

 window.SharedLogin && window.SharedLogin.evaluateSetupForm(user);
 updateLoginTermsWarning_();

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

 function checkHashForIdToken_() {
 if (!location.hash) return;
 const params = new URLSearchParams(location.hash.slice(1));
 const idt = params.get('id_token');
 if (idt) {
 onLoginFromToken_(idt, false);
 history.replaceState({}, document.title, location.pathname + location.search);
 }
 }

 window.initGoogleIdentity = function initGoogleIdentity() {
 if (!window.google || !google.accounts || !google.accounts.id) return;
 google.accounts.id.initialize({
 client_id: OAUTH_CLIENT_ID,
 callback: (resp) => window.onGoogleSignIn(resp),
 ux_mode: 'popup',
 auto_select: true,
 use_fedcm_for_prompt: true
 });
 google.accounts.id.renderButton(
 document.getElementById('googleBtn'),
 { theme: 'outline', size: 'large', type: 'standard', shape: 'rectangular', logo_alignment: 'left' }
 );
 };

 window.onGoogleSignIn = function onGoogleSignIn(resp) {
 const token = resp && resp.credential;
 if (!token) {
 setText('loginStatus', 'Login error: no credential');
 return;
 }
 onLoginFromToken_(token, false);
 };

 async function tryRestoreAuth_() {
 if (!window.initAuthFromStorage) return;
 const r = await window.initAuthFromStorage();
 if (r && r.ok && r.idToken) {
 try {
 await onLoginFromToken_(r.idToken, true);
 window._autoLoginDone = true;
 } catch (e) {
 // leave _autoLoginDone false so GSI can retry
 }
 }
 }

 async function saveProfile_(patch) {
 if (!googleIdToken) throw new Error('Not logged in');
 setBusy(true);
 setText('saveMsg', 'Saving…');
 setText('leaderboardMsg', '');
 try {
 await window.apiPost('updateMyProfile', {
 idToken: googleIdToken,
 payload: patch
 });
 await loadMeAndApply_();
 setText('saveMsg', 'Saved.');
 } catch (e) {
 const msg = (e.message || e);
 if (patch && Object.prototype.hasOwnProperty.call(patch, 'leaderboardConsent')) {
 setText('leaderboardMsg', 'Error: ' + msg);
 }
 setText('saveMsg', 'Error: ' + msg);
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

 window.clearSavedIdToken && window.clearSavedIdToken();
 googleIdToken = null;
 updateLoginTermsWarning_();
 currentUser = null;

 if (window.topbarSetAuthState) {
 window.topbarSetAuthState({ idToken: null, user: null, isAdmin: false, balanceBT: null });
 }

 setText('deleteMsg', 'Account deleted.');
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
 saveProfile_({
 playerName,
 mailbox: currentUser?.mailbox || '',
 mallMailbox: currentUser?.mallMailbox || '',
 leaderboardConsent: getConsentFromUi_()
 });
 } catch (e) {
 setText('saveMsg', 'Error: ' + (e.message || e));
 }
 });

 byId('btnSaveMailbox').addEventListener('click', () => {
 try {
 const mailbox = validateMailbox(byId('inpMailbox').value);
 saveProfile_({
 playerName: currentUser?.playerName || '',
 mailbox,
 mallMailbox: currentUser?.mallMailbox || '',
 leaderboardConsent: getConsentFromUi_()
 });
 } catch (e) {
 setText('saveMsg', 'Error: ' + (e.message || e));
 }
 });

 byId('btnSaveMallMailbox').addEventListener('click', () => {
 try {
 const mallMailbox = validateMallMailbox(byId('inpMallMailbox').value);
 saveProfile_({
 playerName: currentUser?.playerName || '',
 mailbox: currentUser?.mailbox || '',
 mallMailbox,
     leaderboardConsent: getConsentFromUi_()
 });
     } catch (e) {
         setText('saveMsg', 'Error: ' + (e.message || e));
     }
 });

        byId('btnClearMallMailbox').addEventListener('click', () => {
            byId('inpMallMailbox').value = '';
            saveProfile_({
                playerName: currentUser?.playerName || '',
                mailbox: currentUser?.mailbox || '',
                mallMailbox: '',
                leaderboardConsent: getConsentFromUi_()
            });
        });

        byId('selLeaderboardConsent')?.addEventListener('change', () => {
            updateLeaderboardUi_({ leaderboardConsent: getConsentFromUi_() });
            setText('leaderboardMsg', '');
        });

        byId('btnSaveLeaderboardConsent')?.addEventListener('click', async () => {
            try {
                const consent = getConsentFromUi_();
                setText('leaderboardMsg', 'Saving…');
                await saveProfile_({
                    playerName: currentUser?.playerName || '',
                    mailbox: currentUser?.mailbox || '',
                    mallMailbox: currentUser?.mallMailbox || '',
                    leaderboardConsent: consent
                });
                setText('leaderboardMsg', 'Saved.');
            } catch (e) {
                setText('leaderboardMsg', 'Error: ' + (e.message || e));
            }
        });

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
        window.SharedLogin && window.SharedLogin.init({});
        document.body.classList.add('withTopBar');

        updateLoginTermsWarning_();

        wireUi_();
        checkHashForIdToken_();

        const gsiWait = setInterval(() => {
            if (!document.getElementById('googleBtn')) return;
            if (window.google && google.accounts && google.accounts.id) {
                window.initGoogleIdentity && window.initGoogleIdentity();
                clearInterval(gsiWait);
            }
        }, 200);
        setTimeout(() => clearInterval(gsiWait), 4000);

        await tryRestoreAuth_();

        if (!googleIdToken) {
            setText('statsStatus', 'Login to see statistics.');
            renderStats_();
        }
    });
})();

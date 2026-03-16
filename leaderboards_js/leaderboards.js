/* leaderboards_js/leaderboards.js
   Leaderboards page — auth-gated, always shows both current and record periods.
*/
(function () {
    'use strict';

    let cachedData      = null;
    let currentIdToken  = null;

  function byId(id)    { return document.getElementById(id); }
    function setText(id, t)  { const el = byId(id); if (el) el.textContent = t || ''; }

    // ?? Formatters ??????????????????????????????????????????????????????????
    function fmtNumber_(n, digs) {
        const v = Number(n);
  if (!isFinite(v)) return '0';
        return v.toFixed(Number(digs) || 0);
    }

    function fmtIso_(iso) {
        const s = String(iso || '').trim();
        if (!s) return '—';
        const d = new Date(s);
    if (isNaN(d.getTime())) return s;
        return d.toISOString().replace('T', ' ').replace('Z', '');
    }

    function escapeHtml_(s) {
        return String(s || '')
.replace(/&/g, '&amp;')
.replace(/</g,  '&lt;')
         .replace(/>/g,  '&gt;')
            .replace(/"/g, '&quot;')
       .replace(/'/g,  '&#39;');
    }

    // A7 fix: detect future end date ? label as "Ongoing"
    function isOngoing_(isoStr) {
      if (!isoStr) return false;
        const d = new Date(isoStr);
  return !isNaN(d.getTime()) && d.getTime() > Date.now();
    }

    // Q9 fix: detect if a record period is still accumulating (shorter than expected window).
    // windowDays: expected window size (7=week, 30=month, 365=year, 0=unknown).
    // Returns true when the period should show "Ongoing..." label.
    function isRecordOngoing_(startIso, endIso, windowDays) {
     if (!startIso) return false;
        const start = new Date(startIso);
        if (isNaN(start.getTime())) return false;
    // end date: if missing or in the future, use today as the effective end
        let effectiveEnd;
        if (!endIso) {
       effectiveEnd = new Date();
        } else {
            const parsedEnd = new Date(endIso);
         effectiveEnd = isNaN(parsedEnd.getTime()) ? new Date() : parsedEnd;
        }
 if (windowDays > 0) {
            const spanDays = (effectiveEnd.getTime() - start.getTime()) / 86400000;
         // tolerance: consider ongoing if span is less than 90 % of expected window
      if (spanDays < windowDays * 0.9) return true;
   }
        // also treat as ongoing if the effective end is in the future
        return effectiveEnd.getTime() > Date.now();
}

    // ?? Renderers ???????????????????????????????????????????????????????????
    function renderTable_(tbodyId, items, fmtValue) {
        const tb = byId(tbodyId);
        if (!tb) return;
        const arr = Array.isArray(items) ? items : [];
     if (!arr.length) {
         tb.innerHTML = '<tr><td class="rank">&mdash;</td><td class="muted">No data</td><td class="num">0</td></tr>';
          return;
    }
      tb.innerHTML = arr.map((x, idx) => {
  const name = (x && x.displayName) ? String(x.displayName) : 'No data';
 const raw  = x && (x.value ?? x.valueEW);
       const val  = fmtValue ? fmtValue(raw) : String(raw ?? 0);
  return `<tr><td class="rank">${idx + 1}</td><td>${escapeHtml_(name)}</td><td class="num">${escapeHtml_(val)}</td></tr>`;
        }).join('');
    }

    function renderTablePeriods_(tbodyId, items, fmtValue, windowDays) {
     const tb = byId(tbodyId);
        if (!tb) return;
        const arr = Array.isArray(items) ? items : [];
        if (!arr.length) {
      tb.innerHTML = '<tr><td class="rank">&mdash;</td><td class="muted">No data</td><td class="num">0</td><td class="mono muted">&mdash;</td><td class="mono muted">&mdash;</td></tr>';
            return;
     }
      tb.innerHTML = arr.map((x, idx) => {
       const name   = (x && x.displayName) ? String(x.displayName) : 'No data';
    const valRaw = x && (x.valueEW ?? x.value);
            const val    = fmtValue ? fmtValue(valRaw) : String(valRaw ?? 0);
const start  = fmtIso_(x && x.start);
       // A7 fix: show "Ongoing" for future end dates
            const end    = isOngoing_(x && x.end) ? 'Ongoing' : fmtIso_(x && x.end);
       return `<tr><td class="rank">${idx + 1}</td><td>${escapeHtml_(name)}</td><td class="num">${escapeHtml_(val)}</td><td class="mono">${escapeHtml_(start)}</td><td class="mono">${escapeHtml_(end)}</td></tr>`;
  }).join('');
    }

    // Record period variant: uses isRecordOngoing_ to detect an unfinished record window.
 function renderTableRecordPeriods_(tbodyId, items, fmtValue, windowDays) {
        const tb = byId(tbodyId);
      if (!tb) return;
 const arr = Array.isArray(items) ? items : [];
        if (!arr.length) {
  tb.innerHTML = '<tr><td class="rank">&mdash;</td><td class="muted">No data</td><td class="num">0</td><td class="mono muted">&mdash;</td><td class="mono muted">&mdash;</td></tr>';
          return;
      }
    tb.innerHTML = arr.map((x, idx) => {
    const name   = (x && x.displayName) ? String(x.displayName) : 'No data';
            const valRaw = x && (x.valueEW ?? x.value);
      const val    = fmtValue ? fmtValue(valRaw) : String(valRaw ?? 0);
            const start  = fmtIso_(x && x.start);
        // Q9 fix: show "Ongoing..." when record period span is shorter than intended window
  const endRaw = x && x.end;
   let end;
      if (isRecordOngoing_(x && x.start, endRaw, windowDays || 0)) {
             end = 'Ongoing...';
            } else {
             end = fmtIso_(endRaw);
            }
      return `<tr><td class="rank">${idx + 1}</td><td>${escapeHtml_(name)}</td><td class="num">${escapeHtml_(val)}</td><td class="mono">${escapeHtml_(start)}</td><td class="mono">${escapeHtml_(end)}</td></tr>`;
        }).join('');
    }

    function renderTableFavorites_(tbodyId, items) {
    const tb = byId(tbodyId);
   if (!tb) return;
    const arr = Array.isArray(items) ? items : [];
  if (!arr.length) {
      tb.innerHTML = '<tr><td class="rank">&mdash;</td><td class="muted">No data</td><td class="muted">&mdash;</td><td class="num">0</td><td class="num">0</td><td class="num">0</td></tr>';
 return;
        }
        tb.innerHTML = arr.map((x, idx) => {
  const name = (x && x.displayName) ? String(x.displayName) : 'No data';
       const item = (x && x.itemName) ? String(x.itemName) : '—';
   const qty = fmtNumber_(x && x.totalQty, 0);
        const val = fmtNumber_(x && (x.totalValueEW ?? x.valueEW), 2);
        const req = fmtNumber_(x && x.rows, 0);
 return `<tr><td class="rank">${idx + 1}</td><td>${escapeHtml_(name)}</td><td>${escapeHtml_(item)}</td><td class="num">${escapeHtml_(qty)}</td><td class="num">${escapeHtml_(val)}</td><td class="num">${escapeHtml_(req)}</td></tr>`;
    }).join('');
    }

    // A6 fix: render BOTH current and record sections without a mode parameter
    function renderLeaderboardsFull_() {
        if (!cachedData) return;

        const lb   = cachedData.leaderboards;
        const lbpC = cachedData.leaderboardsStoreParticipation?.current ?? null;
        const lbpR = cachedData.leaderboardsStoreParticipation?.record  ?? null;

        setText('lbUpdatedAt', fmtIso_(cachedData.updatedAt));

   // Store leaderboards
        renderTable_('tb_storeMaxBuyValueEW',      lb && lb.storeMaxBuyValueEW,      v => fmtNumber_(v, 2));
        renderTable_('tb_storeMaxSellValueEW',     lb && lb.storeMaxSellValueEW,     v => fmtNumber_(v, 2));
      renderTable_('tb_storeTradesWithStoreCount', lb && lb.storeTradesWithStoreCount, v => fmtNumber_(v, 0));
        renderTable_('tb_storeTotalBuyValueEW',    lb && lb.storeTotalBuyValueEW,    v => fmtNumber_(v, 2));
      renderTable_('tb_storeTotalSellValueEW',   lb && lb.storeTotalSellValueEW,   v => fmtNumber_(v, 2));
        renderTableFavorites_('tb_storeFavoriteBuyItemByValueEW',  lb && lb.storeFavoriteBuyItemByValueEW);
        renderTableFavorites_('tb_storeFavoriteSellItemByValueEW', lb && lb.storeFavoriteSellItemByValueEW);

  // OCM leaderboards
        renderTable_('tb_ocmAsCustomerCount',  lb && lb.ocmAsCustomerCount,  v => fmtNumber_(v, 0));
      renderTable_('tb_ocmAsMerchantCount',  lb && lb.ocmAsMerchantCount,  v => fmtNumber_(v, 0));
    renderTable_('tb_ocmFeesPaidEW',    lb && lb.ocmFeesPaidEW,       v => fmtNumber_(v, 2));
     renderTable_('tb_ocmMaxTradeValueEW',  lb && lb.ocmMaxTradeValueEW,  v => fmtNumber_(v, 2));
        renderTable_('tb_ocmTotalValueEW',     lb && lb.ocmTotalValueEW,     v => fmtNumber_(v, 2));

        // Store participation — Current period (ongoing periods show "Ongoing" for end)
        renderTablePeriods_('tb_weekBoughtEW',   lbpC && lbpC.weekBoughtEW,   v => fmtNumber_(v, 2), 7);
        renderTablePeriods_('tb_weekSoldEW',lbpC && lbpC.weekSoldEW,     v => fmtNumber_(v, 2), 7);
  renderTablePeriods_('tb_monthBoughtEW',  lbpC && lbpC.monthBoughtEW,  v => fmtNumber_(v, 2), 30);
        renderTablePeriods_('tb_monthSoldEW',    lbpC && lbpC.monthSoldEW,    v => fmtNumber_(v, 2), 30);
  renderTablePeriods_('tb_yearBoughtEW',   lbpC && lbpC.yearBoughtEW,   v => fmtNumber_(v, 2), 365);
     renderTablePeriods_('tb_yearSoldEW',     lbpC && lbpC.yearSoldEW,     v => fmtNumber_(v, 2), 365);

        // Store participation — Record period (show "Ongoing..." when not yet full-window)
        renderTableRecordPeriods_('tb_record_weekBoughtEW',   lbpR && lbpR.weekBoughtEW,   v => fmtNumber_(v, 2), 7);
        renderTableRecordPeriods_('tb_record_weekSoldEW',     lbpR && lbpR.weekSoldEW,     v => fmtNumber_(v, 2), 7);
    renderTableRecordPeriods_('tb_record_monthBoughtEW',  lbpR && lbpR.monthBoughtEW,  v => fmtNumber_(v, 2), 30);
        renderTableRecordPeriods_('tb_record_monthSoldEW',    lbpR && lbpR.monthSoldEW,    v => fmtNumber_(v, 2), 30);
    renderTableRecordPeriods_('tb_record_yearBoughtEW',   lbpR && lbpR.yearBoughtEW,   v => fmtNumber_(v, 2), 365);
        renderTableRecordPeriods_('tb_record_yearSoldEW', lbpR && lbpR.yearSoldEW,     v => fmtNumber_(v, 2), 365);
 }

    // A6 fix: added 6 record tbody IDs
    function renderAllEmpty_() {
        const simpleIds = [
        'tb_storeMaxBuyValueEW', 'tb_storeMaxSellValueEW', 'tb_storeTradesWithStoreCount',
        'tb_storeTotalBuyValueEW', 'tb_storeTotalSellValueEW',
        'tb_ocmAsCustomerCount', 'tb_ocmAsMerchantCount', 'tb_ocmFeesPaidEW',
  'tb_ocmMaxTradeValueEW', 'tb_ocmTotalValueEW'
 ];
        simpleIds.forEach(id => renderTable_(id, []));

        renderTableFavorites_('tb_storeFavoriteBuyItemByValueEW', []);
   renderTableFavorites_('tb_storeFavoriteSellItemByValueEW', []);

   const periodIds = [
     'tb_weekBoughtEW', 'tb_weekSoldEW',
 'tb_monthBoughtEW', 'tb_monthSoldEW',
    'tb_yearBoughtEW', 'tb_yearSoldEW',
      // record period tables
 'tb_record_weekBoughtEW', 'tb_record_weekSoldEW',
      'tb_record_monthBoughtEW', 'tb_record_monthSoldEW',
    'tb_record_yearBoughtEW', 'tb_record_yearSoldEW'
  ];
        periodIds.forEach(id => renderTablePeriods_(id, []));
    }

    // ?? Network load ?????????????????????????????????????????????????????????
    async function loadLeaderboards_(idToken) {
        if (idToken) currentIdToken = idToken;

        const btn = byId('btnRefreshLeaderboards');
        if (btn) btn.disabled = true;
    setText('lbStatus', 'Loading\u2026');

 try {
            const r = await window.apiGet('getLeaderboards', { idToken: currentIdToken });
     const payload = r && r.data ? r.data : r;

            if (!payload || (!payload.leaderboards && !payload.leaderboardsStoreParticipation)) {
    throw new Error(r && r.error ? r.error : 'Unexpected response shape');
            }

 cachedData = payload;
 // A6 fix: call renderLeaderboardsFull_ instead of renderLeaderboards_(getMode_())
      renderLeaderboardsFull_();
            setText('lbStatus', 'Loaded.');
      } catch (e) {
     setText('lbStatus', 'Error: ' + (e.message || e));
        } finally {
  if (btn) btn.disabled = !currentIdToken;
     }
    }

    // ?? Auth state helpers ???????????????????????????????????????????????????
    function showLoggedOutState_() {
    currentIdToken = null;
        const btn = byId('btnRefreshLeaderboards');
     if (btn) btn.disabled = true;
        setText('lbStatus', 'Please log in to view leaderboards.');
        setText('lbUpdatedAt', '—');
        renderAllEmpty_();
    }

    async function applyLogin_(idToken) {
        const statusEl = byId('loginStatus');
     if (statusEl) statusEl.textContent = 'Verifying\u2026';
     try {
   const r = await window.apiGet('me', { idToken });
          const d = r && r.data ? r.data : r;
         const user = d && d.user ? d.user : d;

         if (window.saveIdToken) window.saveIdToken(idToken);

            if (window.topbarSetAuthState) {
                window.topbarSetAuthState({
  idToken,
      user,
        isAdmin:   !!(d && d.isAdmin),
          balanceBT: (user && user.balanceBT) || 0
        });
       }

window._lbIdToken = idToken;

            if (statusEl) statusEl.textContent = '';

            window.SharedLogin && window.SharedLogin.evaluateSetupForm(user);

            await loadLeaderboards_(idToken);
        } catch (e) {
          if (statusEl) statusEl.textContent = 'Login failed: ' + (e.message || e);
        }
  }

    window.onGoogleSignIn = function (googleUser) {
        if (window._autoLoginDone) return;
        const credential = googleUser && (googleUser.credential || (googleUser.getAuthResponse && googleUser.getAuthResponse().id_token));
        if (credential) applyLogin_(credential);
  };

    window.logout = function () {
        if (window.clearSavedIdToken) window.clearSavedIdToken();
        if (window.topbarSetAuthState) window.topbarSetAuthState({ idToken: null });
        window.SharedLogin && window.SharedLogin.evaluateSetupForm(null);
        showLoggedOutState_();
    };

    // ?? Boot ?????????????????????????????????????????????????????????????????
    window.addEventListener('load', async () => {
        window.initSharedTopBar && window.initSharedTopBar();
 document.body.classList.add('withTopBar');

     window.SharedLogin && window.SharedLogin.init({});

     showLoggedOutState_();

        byId('btnRefreshLeaderboards')?.addEventListener('click', () => {
        if (currentIdToken) loadLeaderboards_(currentIdToken);
    });

      // A6 fix: lbMode change listener removed (dropdown is removed from HTML)

        try {
       const hash = String(location.hash || '');
   if (hash.includes('id_token=')) {
                const params = new URLSearchParams(hash.replace(/^#/, ''));
     const tok = params.get('id_token');
   if (tok) {
          history.replaceState(null, '', location.pathname + location.search);
         await applyLogin_(tok);
             return;
   }
            }
        } catch (_) { /* ignore */ }

      const stored = window.initAuthFromStorage ? await window.initAuthFromStorage() : null;
        if (stored && stored.ok && stored.idToken) {
        window._autoLoginDone = true;
            await applyLogin_(stored.idToken);
 return;
        }

        const gsiWait = setInterval(() => {
      if (window.google && google.accounts && google.accounts.id) {
         clearInterval(gsiWait);
     google.accounts.id.initialize({
      client_id: window.OAUTH_CLIENT_ID ||
   window.GOOGLE_CLIENT_ID ||
         (window.APP_CONFIG && window.APP_CONFIG.GOOGLE_CLIENT_ID) || '',
    callback: function (resp) {
if (window._autoLoginDone) return;
   if (resp && resp.credential) applyLogin_(resp.credential);
   },
     auto_select: true,
     ux_mode: 'popup',
                 use_fedcm_for_prompt: true
         });
 google.accounts.id.renderButton(
        byId('googleBtn'),
             { theme: 'outline', size: 'large', type: 'standard', shape: 'rectangular', logo_alignment: 'left' }
      );
 }
        }, 200);
        setTimeout(() => clearInterval(gsiWait), 6000);
    });
})();

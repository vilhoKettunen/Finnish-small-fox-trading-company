/* leaderboards_js/leaderboards.js
   Leaderboards page — auth-gated, dual-mode preload, no re-request on mode switch.
*/
(function () {
    'use strict';

    // ?? Module state ????????????????????????????????????????????????????????
    let cachedData      = null;   // full payload from last successful load
    let currentIdToken  = null;   // idToken of the currently logged-in user

 // ?? DOM helpers ?????????????????????????????????????????????????????????
    function byId(id)        { return document.getElementById(id); }
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
            .replace(/"/g,'&quot;')
            .replace(/'/g,  '&#39;');
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

  function renderTablePeriods_(tbodyId, items, fmtValue) {
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
            const end    = fmtIso_(x && x.end);
            return `<tr><td class="rank">${idx + 1}</td><td>${escapeHtml_(name)}</td><td class="num">${escapeHtml_(val)}</td><td class="mono">${escapeHtml_(start)}</td><td class="mono">${escapeHtml_(end)}</td></tr>`;
        }).join('');
    }

    // ?? Helpers ?????????????????????????????????????????????????????????????
    function getMode_() {
      const el = byId('lbMode');
        const v  = el ? String(el.value || '').trim().toLowerCase() : '';
        return (v === 'record') ? 'record' : 'current';
    }

    /** Render all tables from cachedData for the given mode. No network call. */
function renderLeaderboards_(mode) {
     if (!cachedData) return;

        const lb  = cachedData.leaderboards;
     const lbp = cachedData.leaderboardsStoreParticipation
        ? cachedData.leaderboardsStoreParticipation[mode]
        : null;

        setText('lbUpdatedAt', fmtIso_(cachedData.updatedAt));

        // Store
        renderTable_('tb_storeMaxBuyValueEW',      lb && lb.storeMaxBuyValueEW,      v => fmtNumber_(v, 2));
        renderTable_('tb_storeMaxSellValueEW',     lb && lb.storeMaxSellValueEW,     v => fmtNumber_(v, 2));
renderTable_('tb_storeTradesWithStoreCount', lb && lb.storeTradesWithStoreCount, v => fmtNumber_(v, 0));

        // OCM
        renderTable_('tb_ocmAsCustomerCount',  lb && lb.ocmAsCustomerCount,  v => fmtNumber_(v, 0));
        renderTable_('tb_ocmAsMerchantCount',  lb && lb.ocmAsMerchantCount,  v => fmtNumber_(v, 0));
   renderTable_('tb_ocmFeesPaidEW',       lb && lb.ocmFeesPaidEW,     v => fmtNumber_(v, 2));
        renderTable_('tb_ocmMaxTradeValueEW',  lb && lb.ocmMaxTradeValueEW,  v => fmtNumber_(v, 2));
        renderTable_('tb_ocmTotalValueEW',     lb && lb.ocmTotalValueEW,     v => fmtNumber_(v, 2));

        // Store participation (period-based, mode-specific)
     renderTablePeriods_('tb_weekBoughtEW',lbp && lbp.weekBoughtEW,  v => fmtNumber_(v, 2));
  renderTablePeriods_('tb_weekSoldEW',    lbp && lbp.weekSoldEW,    v => fmtNumber_(v, 2));
        renderTablePeriods_('tb_monthBoughtEW', lbp && lbp.monthBoughtEW, v => fmtNumber_(v, 2));
        renderTablePeriods_('tb_monthSoldEW',   lbp && lbp.monthSoldEW,   v => fmtNumber_(v, 2));
        renderTablePeriods_('tb_yearBoughtEW',  lbp && lbp.yearBoughtEW,  v => fmtNumber_(v, 2));
      renderTablePeriods_('tb_yearSoldEW',    lbp && lbp.yearSoldEW,    v => fmtNumber_(v, 2));
    }

    /** Show empty placeholder rows in every table (logged-out / error state). */
    function renderAllEmpty_() {
  const simpleIds = [
      'tb_storeMaxBuyValueEW', 'tb_storeMaxSellValueEW', 'tb_storeTradesWithStoreCount',
       'tb_ocmAsCustomerCount', 'tb_ocmAsMerchantCount', 'tb_ocmFeesPaidEW',
            'tb_ocmMaxTradeValueEW', 'tb_ocmTotalValueEW'
        ];
        simpleIds.forEach(id => renderTable_(id, []));

        const periodIds = [
     'tb_weekBoughtEW', 'tb_weekSoldEW',
            'tb_monthBoughtEW', 'tb_monthSoldEW',
            'tb_yearBoughtEW', 'tb_yearSoldEW'
        ];
        periodIds.forEach(id => renderTablePeriods_(id, []));
    }

    // ?? Network load (requires idToken) ?????????????????????????????????????
    async function loadLeaderboards_(idToken) {
        if (idToken) currentIdToken = idToken;

        const btn = byId('btnRefreshLeaderboards');
   if (btn) btn.disabled = true;
      setText('lbStatus', 'Loading\u2026');

        try {
            // Pass idToken to backend so it can verify the caller
     const r = await window.apiGet('getLeaderboards', { idToken: currentIdToken });

            // Direct unwrap: { ok, data: { updatedAt, leaderboards, leaderboardsStoreParticipation } }
            const payload = r && r.data ? r.data : r;

          if (!payload || (!payload.leaderboards && !payload.leaderboardsStoreParticipation)) {
    throw new Error(r && r.error ? r.error : 'Unexpected response shape');
       }

       cachedData = payload;
        renderLeaderboards_(getMode_());
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

            // Store idToken for submitSetup (login-panel.js uses window.getSavedIdToken)
        window._lbIdToken = idToken;

          if (statusEl) statusEl.textContent = '';

 window.SharedLogin && window.SharedLogin.evaluateSetupForm(user);

     await loadLeaderboards_(idToken);
        } catch (e) {
            if (statusEl) statusEl.textContent = 'Login failed: ' + (e.message || e);
    }
    }

    // ?? GSI callback (global, called by Google Sign-In library) ????????????
  window.onGoogleSignIn = function (googleUser) {
        // Ignore if auto-restore already completed
        if (window._autoLoginDone) return;
   const credential = googleUser && (googleUser.credential || (googleUser.getAuthResponse && googleUser.getAuthResponse().id_token));
        if (credential) applyLogin_(credential);
    };

    // ?? Logout (called by topbar) ????????????????????????????????????????????
    window.logout = function () {
        if (window.clearSavedIdToken) window.clearSavedIdToken();
     if (window.topbarSetAuthState) window.topbarSetAuthState({ idToken: null });
        window.SharedLogin && window.SharedLogin.evaluateSetupForm(null);
  showLoggedOutState_();
    };

    // ?? Boot ?????????????????????????????????????????????????????????????????
    window.addEventListener('load', async () => {
        // Topbar + body class
window.initSharedTopBar && window.initSharedTopBar();
 document.body.classList.add('withTopBar');

        // Login panel (injects authPanel into #loginPanelMount)
        window.SharedLogin && window.SharedLogin.init({});

    // Show logged-out placeholders immediately
        showLoggedOutState_();

        // Wire buttons
        byId('btnRefreshLeaderboards')?.addEventListener('click', () => {
            if (currentIdToken) loadLeaderboards_(currentIdToken);
        });

        byId('lbMode')?.addEventListener('change', () => {
    if (cachedData) {
       renderLeaderboards_(getMode_());
}
        });

   // Handle URL hash id_token (redirect-fallback flow)
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

        // Try restoring saved token
        const stored = window.initAuthFromStorage ? await window.initAuthFromStorage() : null;
  if (stored && stored.ok && stored.idToken) {
    window._autoLoginDone = true;
            await applyLogin_(stored.idToken);
            return;
        }

        // No stored token — wire GSI for manual login
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

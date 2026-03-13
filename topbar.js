// Lightweight, reusable top bar for all pages.
(function () {
    const css = `
  #topBar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 52px;
    background: #000 !important;
    color: #fff;
    display: flex;
    align-items: center;
    padding: 0 20px;
    z-index: 1000;
    font-size: 14px;
    gap: 12px;
  }
  #topBar button {
    color: #fff;
    background: none;
    border: none;
    cursor: pointer;
    margin-right: 16px;
    font-size: 14px;
  }
  #topBar .right {
    margin-left: auto;
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
  }
  body.withTopBar { padding-top: 72px; }
  .balance-chip {
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(255,255,255,0.08);
    white-space: nowrap;
  }
  .balance-you.positive { color: #2ecc71; }
  .balance-you.negative { color: #ff5252; }
  .balance-target { color: #f0c200; }
  #topUser { color: #fff; opacity: .9; }

  /* ── Mobile toggle buttons (hidden on PC) ── */
  .tb-mobile-toggle {
    display: none;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: #fff;
    cursor: pointer;
    font-size: 18px;
    padding: 6px 8px;
    margin-right: 0;
    line-height: 1;
    flex-shrink: 0;
  }

  /* ── Drawer base (both nav and user drawers) ── */
  .tb-drawer {
    display: flex;
    flex-direction: column;
    position: fixed;
    top: 52px;
    left: 0;
    right: 0;
    background: #000;
    border-top: 1px solid rgba(255,255,255,0.1);
    z-index: 998;
    padding: 4px 0;
    overflow: hidden;
    /* Slide animation */
    max-height: 0;
    transition: max-height 0.2s ease;
  }
  .tb-drawer.tb-open {
    max-height: 400px;
  }

  /* ── On PC (≥ 980px): drawers behave as inline flex — normal layout ── */
  @media (min-width: 980px) {
    .tb-drawer {
      position: static;
      flex-direction: row;
      align-items: center;
      flex-wrap: wrap;
      background: transparent;
      border-top: none;
      padding: 0;
      max-height: none;
      overflow: visible;
      z-index: auto;
    }
    .tb-drawer.tb-open {
      max-height: none;
    }
    /* Nav drawer: inline with the rest of the bar */
    #tbNavDrawer {
      display: flex;
      flex-direction: row;
      align-items: center;
      flex-wrap: wrap;
      gap: 0;
    }
    /* User drawer: inline inside .right */
    #tbUserDrawer {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 12px;
    }
  }

  /* ── Mobile (< 980px) ── */
  @media (max-width: 980px) {
    #topBar {
      height: 52px;
      flex-wrap: nowrap;
      gap: 8px;
      padding: 0 10px;
    }
    .tb-mobile-toggle {
      display: inline-flex;
    }
    .right {
      gap: 6px;
    }
    /* Balance chips: truncate if too wide */
    .balance-chip {
      max-width: 110px;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Drawers use a paper texture background on mobile so text is readable */
    #tbNavDrawer,
    #tbUserDrawer {
      background: url('/images/pack_Ground/paper.png') repeat #e8dcc8 !important;
      color: #1a1008;
      border-top: 2px solid rgba(0,0,0,0.15);
    }

    /* Nav drawer buttons: full-width list style with dark text */
    #tbNavDrawer button[data-nav] {
      width: 100%;
      text-align: left;
      padding: 12px 20px;
      margin-right: 0;
      border-bottom: 1px solid rgba(0,0,0,0.08);
      font-size: 15px;
      color: #000;
      /*background: transparent;*/
    }
    #tbNavDrawer button[data-nav]:last-child {
      border-bottom: none;
    }
    /* User drawer items */
    #tbUserDrawer {
      padding: 8px 20px;
      gap: 0;
    }
    #tbUserDrawer #topUser {
      display: block;
      padding: 8px 0 10px 0;
      font-weight: bold;
      border-bottom: 1px solid rgba(0,0,0,0.08);
      margin-bottom: 8px;
      width: 100%;
      color: #000;
    }
    #tbUserDrawer #btnSettings,
    #tbUserDrawer #btnLogin,
    #tbUserDrawer #btnLogout {
      display: inline-block;
      margin-right: 12px;
      padding: 6px 0;
      color: #000;
      background: transparent;
    }
  }
  `;

    const html = `
  <div id="topBar" role="navigation" aria-label="Main">
    <!-- Mobile NAV toggle -->
    <button id="tbMenuToggle" class="tb-mobile-toggle tb-menu-toggle" type="button"
            aria-expanded="false" aria-controls="tbNavDrawer">☰</button>

    <!-- Brand -->
    <div style="font-size:16px;font-weight:bold;margin-right:10px;flex-shrink:0;">Vak Store</div>

    <!-- NAV drawer (inline on PC, collapsible on mobile) -->
    <div id="tbNavDrawer" class="tb-drawer tb-nav-drawer">
      <button type="button" data-nav="store">Store</button>
      <button type="button" data-nav="history">Account History</button>
      <button type="button" data-nav="ocm">OCM</button>
      <button type="button" data-nav="Merchant">OCM Merchant</button>
      <button type="button" data-nav="leaderboards">Leaderboards</button>
      <button type="button" data-nav="workpay">Work Pay Rates</button>
      <button type="button" data-nav="bank">Bank</button>
      <button type="button" data-nav="instructions">Instructions</button>
      <button type="button" data-nav="whitepaper">Whitepaper</button>
      <button id="adminPanelBtn" style="display:none" type="button" data-nav="admin">Admin Panel</button>
    </div>

    <!-- Right area: always-visible balance chips + mobile user toggle -->
    <div class="right">
      <span id="topBalanceTarget" class="balance-chip balance-target" style="display:none;"></span>
      <span id="topBalance" class="balance-chip balance-you" style="display:none;"></span>
      <!-- Mobile USER toggle -->
      <button id="tbUserToggle" class="tb-mobile-toggle tb-user-toggle" type="button"
              aria-expanded="false" aria-controls="tbUserDrawer">👤 ▼</button>
    </div>

    <!-- USER drawer (inline on PC, collapsible on mobile) -->
    <div id="tbUserDrawer" class="tb-drawer tb-user-drawer">
      <span id="topUser"></span>
      <button id="btnSettings" type="button" style="display:none;">Settings</button>
      <button id="btnLogin" type="button">Login</button>
      <button id="btnLogout" type="button" style="display:none;">Logout</button>
    </div>
  </div>`;

    function ensureTopBar() {
        // Always ensure the shared top-bar stylesheet is present (but only insert it once)
if (!document.getElementById('topbar-shared-style')) {
            const s = document.createElement('style');
   s.id = 'topbar-shared-style';
        s.textContent = css;
            document.head.appendChild(s);
        }

        // If markup is missing, insert the default top bar HTML
        if (!document.getElementById('topBar')) {
            const wrap = document.createElement('div');
       wrap.innerHTML = html;
            document.body.insertBefore(wrap.firstElementChild, document.body.firstChild);
            document.body.classList.add('withTopBar');
        } else {
    // If page already provided markup, still ensure the body padding class is set
            document.body.classList.add('withTopBar');
    }
    }

    const state = {
      idToken: null,
        user: null,
        isAdmin: false,
        balanceBT: null,
     balanceLabel: null,
        targetUser: null,
        targetBalanceBT: null,
    targetLoading: false
    };

    function displayName(u) {
     if (!u) return '';
        const name = (u.playerName && u.playerName.trim()) || '';
        const email = (u.email && u.email.trim()) || '';
    if (name && email) return `${name} (${email})`;
   return email || name || '';
    }

    /** Returns true when the viewport is in mobile range (< 768px). */
    function isMobile() {
        return window.innerWidth < 768;
    }

    function updateTopBarAuth() {
    const logged = !!state.idToken;
   const admin = !!state.isAdmin;
        const balEl = document.getElementById('topBalance');
        const balTargetEl = document.getElementById('topBalanceTarget');
        const topUser = document.getElementById('topUser');
   const btnLogin = document.getElementById('btnLogin');
        const btnLogout = document.getElementById('btnLogout');
      const btnSettings = document.getElementById('btnSettings');
      const adminBtn = document.getElementById('adminPanelBtn');

        if (logged) {
 const b = Number(state.balanceBT); const safe = isFinite(b) ? b : 0;
   if (balEl) {
       balEl.style.display = 'inline-block';
       // Q4-B: shorten text on mobile — hide "Balance:" prefix
       if (isMobile()) {
        const labelSuffix = state.balanceLabel ? ` ${state.balanceLabel}` : '';
         balEl.textContent = `${safe.toFixed(0)} EW${labelSuffix}`;
       } else {
         const labelSuffix = state.balanceLabel ? ` ${state.balanceLabel}` : '';
 balEl.textContent = `Balance: ${safe.toFixed(0)} EW${labelSuffix}`;
       }
     balEl.classList.remove('positive', 'negative');
         balEl.classList.add(safe >= 0 ? 'positive' : 'negative');
            }
   if (topUser) topUser.textContent = displayName(state.user);
      if (btnSettings) btnSettings.style.display = 'inline-block';
      if (btnLogin) btnLogin.style.display = 'none';
            if (btnLogout) btnLogout.style.display = 'inline-block';

     // Target chip — shown when a target user is active (admin on-behalf)
   if (balTargetEl) {
              if (state.targetUser) {
    const tName = (state.targetUser.playerName || state.targetUser.email || 'Target');
        if (state.targetLoading) {
       balTargetEl.textContent = `${tName}: ... EW`;
  } else {
     const tb = Number(state.targetBalanceBT);
   const safeTb = isFinite(tb) ? tb : 0;
     // Q4-B: shorten on mobile
     if (isMobile()) {
      balTargetEl.textContent = `${tName}: ${safeTb.toFixed(0)} EW`;
     } else {
      balTargetEl.textContent = `${tName}: ${safeTb.toFixed(0)} EW`;
     }
    }
              balTargetEl.style.display = 'inline-block';
                } else {
      balTargetEl.style.display = 'none';
        balTargetEl.textContent = '';
              }
    }
        } else {
        if (balEl) { balEl.style.display = 'none'; balEl.textContent = ''; }
            if (balTargetEl) { balTargetEl.style.display = 'none'; balTargetEl.textContent = ''; }
      if (topUser) topUser.textContent = '';
   if (btnSettings) btnSettings.style.display = 'none';
     if (btnLogin) btnLogin.style.display = 'inline-block';
 if (btnLogout) btnLogout.style.display = 'none';
        }
 if (adminBtn) adminBtn.style.display = admin ? 'inline-block' : 'none';
    }

    // Re-render balance text on resize so "Balance:" prefix shows/hides correctly (Q4-B)
    window.addEventListener('resize', function () {
        if (state.idToken) updateTopBarAuth();
    });

    function scrollToGoogleButton() {
  // Prefer element with id="googleBtn" or any Google sign-in button container
   var el = document.getElementById('googleBtn') || document.querySelector('[data-google-login], .g_id_signin');
        if (el && el.scrollIntoView) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus && el.focus();
  }
    }

    function closeAllDrawers() {
        const navDrawer = document.getElementById('tbNavDrawer');
        const userDrawer = document.getElementById('tbUserDrawer');
        const menuToggle = document.getElementById('tbMenuToggle');
        const userToggle = document.getElementById('tbUserToggle');
        if (navDrawer) navDrawer.classList.remove('tb-open');
        if (userDrawer) userDrawer.classList.remove('tb-open');
        if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
        if (userToggle) userToggle.setAttribute('aria-expanded', 'false');
    }

    function wireTopbarEvents() {
        const root = document.getElementById('topBar');
 if (!root) return;

        // Guard: prevent double-registration (R5)
        if (root._topbarEventsWired) return;
        root._topbarEventsWired = true;

        // Stop outside-click handler from firing on topBar clicks
        root.addEventListener('click', ev => {
            ev.stopPropagation();

            const btn = ev.target.closest('button');
    if (!btn) return;

            // ── Mobile toggle: NAV drawer ──
            if (btn.id === 'tbMenuToggle') {
                const navDrawer = document.getElementById('tbNavDrawer');
                const userDrawer = document.getElementById('tbUserDrawer');
                const userToggle = document.getElementById('tbUserToggle');
                const isOpen = navDrawer && navDrawer.classList.contains('tb-open');
                closeAllDrawers();
                if (!isOpen && navDrawer) {
                    navDrawer.classList.add('tb-open');
                    btn.setAttribute('aria-expanded', 'true');
                }
                return;
            }

            // ── Mobile toggle: USER drawer ──
            if (btn.id === 'tbUserToggle') {
                const userDrawer = document.getElementById('tbUserDrawer');
                const isOpen = userDrawer && userDrawer.classList.contains('tb-open');
                closeAllDrawers();
                if (!isOpen && userDrawer) {
                    userDrawer.classList.add('tb-open');
                    btn.setAttribute('aria-expanded', 'true');
                }
                return;
            }

            // ── Login ──
            if (btn.id === 'btnLogin') {
                scrollToGoogleButton();
                closeAllDrawers();
                return;
            }

            // ── Settings ──
            if (btn.id === 'btnSettings') {
                if (!state.idToken) {
                    scrollToGoogleButton();
                    return;
                }
                window.location.href = 'AccountSettings.html';
                return;
            }

            // ── Logout ──
            if (btn.id === 'btnLogout') {
                if (typeof window.logout === 'function') window.logout();
                state.idToken = null; state.user = null; state.isAdmin = false; state.balanceBT = null;
        state.targetUser = null; state.targetBalanceBT = null; state.targetLoading = false;
                if (window.clearSavedIdToken) window.clearSavedIdToken();
                updateTopBarAuth();
                window.hideInfraSection?.();
                closeAllDrawers();
                return;
            }

            // ── Nav routing ──
            if (btn.dataset && btn.dataset.nav) {
    const nav = btn.dataset.nav;
       if (nav === 'store') window.location.href = 'index.html';
           else if (nav === 'history') window.location.href = 'AccountHistory.html';
        else if (nav === 'ocm') window.location.href = 'OCMHome.html';
      else if (nav === 'Merchant') window.location.href = 'OCMUser.html';
   else if (nav === 'leaderboards') window.location.href = 'Leaderboards.html';
                else if (nav === 'workpay') window.location.href = 'WorkPayRates.html';
          else if (nav === 'bank') window.location.href = 'Bank.html';
        else if (nav === 'instructions') window.location.href = 'Instructions.html';
     else if (nav === 'whitepaper') window.location.href = 'Whitepaper.html';
      else if (nav === 'admin') {
      if (!state.idToken || !state.isAdmin) { alert('Admin only'); return; }
         window.location.href = 'Admin.html';
     }
       }
        });

        // Outside-click: close both drawers when user clicks anywhere outside the top bar
        document.addEventListener('click', function () {
            closeAllDrawers();
        });
    }

    // Page calls this whenever auth or balance changes.
    // Accepts optional targetUser / targetBalanceBT / targetLoading for admin on-behalf chip.
    window.topbarSetAuthState = function (info) {
        state.idToken = info && info.idToken || null;
      state.user = info && info.user || null;
        state.isAdmin = !!(info && info.isAdmin);
        state.balanceBT = (info && info.balanceBT != null) ? info.balanceBT : null;
 state.balanceLabel = (info && info.balanceLabel) ? String(info.balanceLabel) : null;
        // Target chip fields (optional — other pages don't pass these and chip stays hidden)
        state.targetUser = (info && info.targetUser) || null;
        state.targetBalanceBT = (info && info.targetBalanceBT != null) ? info.targetBalanceBT : null;
      state.targetLoading = !!(info && info.targetLoading);
        updateTopBarAuth();
    };

    window.initSharedTopBar = function () {
        ensureTopBar();
        wireTopbarEvents();
        updateTopBarAuth();
        if (!window._autoLoginDone && typeof window.tryRestoreAuthGlobal === 'function') {
    window.tryRestoreAuthGlobal().catch(function () {});
        }
    };
})();
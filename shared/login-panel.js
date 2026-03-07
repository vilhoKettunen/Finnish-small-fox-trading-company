/**
 * shared/login-panel.js
 * Universal shared login panel component.
 * Injects the standard Google Sign-In panel into any page that has
 * <div id="loginPanelMount"></div>.
 *
 * API:
 *   window.SharedLogin.init(options)
 *   window.SharedLogin.evaluateSetupForm(user)
 *   window.SharedLogin.onSetupInput_()
 *   window.setLoginTermsWarningVisible_(bool)
 *   window.submitSetup()   ? moved here so all pages share one copy
 *
 * options:
 *   showRecaptcha  {boolean}  — include #recaptchaContainer (index.html only)
 */
(function () {
    'use strict';

    // ?? Inject styles once ??????????????????????????????????????????????????
    (function injectStyles_() {
        if (document.getElementById('shared-login-panel-style')) return;
        const style = document.createElement('style');
        style.id = 'shared-login-panel-style';
        style.textContent = [
     '#authPanel.section { max-width:520px; margin:20px auto 24px; padding:16px 20px; }',
   '#loginTermsWarning { margin-bottom:12px; }',
     '#googleLoginArea   { display:flex; flex-direction:column; align-items:flex-start; gap:8px; }',
        '#loginStatus       { color:#555; font-size:0.9rem; }',
            '#setupForm         { margin-top:14px; border-top:1px solid #eee; padding-top:12px; }',
         '#setupForm.setup-highlight { border:2px solid #f0a500; border-radius:6px; padding:12px; background:#fffbe6; }'
        ].join('\n');
        document.head.appendChild(style);
    })();

    // ?? init ????????????????????????????????????????????????????????????????
    /**
     * Build the panel HTML and replace the mount point.
     * @param {object} [options]
     * @param {boolean} [options.showRecaptcha]
     */
    function init(options) {
        options = options || {};

        const mount = document.getElementById('loginPanelMount');
        if (!mount) return;

        // Avoid double-init
        if (document.getElementById('authPanel')) return;

        const panel = document.createElement('div');
        panel.id = 'authPanel';
        panel.className = 'section';

    // --- Terms warning (display:block by default — always visible pre-login) ---
   const termsWarning = document.createElement('div');
        termsWarning.id = 'loginTermsWarning';
 termsWarning.style.display = 'block';
        termsWarning.innerHTML =
            '<strong>By logging in you accept the ' +
  '<a href="TermsAndConditions.html" rel="noopener" target="_blank">Terms and Conditions</a>' +
            ' of this page.</strong>' +
            '<div class="small">In short: we store your email for login identification, ' +
            'and we use trading data for transparency and research purposes.</div>';
        panel.appendChild(termsWarning);

     // --- Google login area ---
        const googleArea = document.createElement('div');
        googleArea.id = 'googleLoginArea';
        googleArea.innerHTML =
 '<div id="googleBtn"></div>' +
   '<div id="loginStatus" class="small"></div>';
 panel.appendChild(googleArea);

        // --- Recaptcha (index.html only, hidden by default) ---
        const recap = document.createElement('div');
        recap.id = 'recaptchaContainer';
        recap.style.display = 'none';
        recap.style.marginTop = '10px';
        panel.appendChild(recap);

        // --- Setup form (ALWAYS rendered; hidden by default; revealed by evaluateSetupForm) ---
        const setup = document.createElement('div');
        setup.id = 'setupForm';
    setup.style.display = 'none';
        setup.innerHTML =
 '<h3>Account Setup</h3>' +
     '<p class="small">Please set your player name and mailbox number before continuing.</p>' +
 '<label>Player Name:<br>' +
      '<input type="text" id="setupPlayerName" oninput="SharedLogin.onSetupInput_()"></label><br>' +
   '<label>Mailbox (e.g. 1A / 2B / F1):<br>' +
'<input type="text" id="setupMailbox" oninput="SharedLogin.onSetupInput_()"></label><br>' +
   '<button id="btnSaveSetup" onclick="submitSetup()" disabled>Save Setup</button>' +
            '<div id="setupMsg" class="small"></div>' +
            '<div id="setupDeletionNote" style="display:none;">' +
   'You can delete your account/email at any time from ' +
     '<a href="AccountSettings.html">Account Settings</a>' +
    ' (this disables login).' +
            '</div>';
        panel.appendChild(setup);

        mount.replaceWith(panel);
    }

    // ?? evaluateSetupForm ???????????????????????????????????????????????????
    /**
     * Called by every page's auth flow after login / profile load.
     * Shows/hides #setupForm and #loginTermsWarning based on profile completeness.
     *
     * Pages that should BLOCK content when profile incomplete:
     *   OCMHome.html, OCMUser.html, EWInsurance.html
     * Pages that should NOT block:
     *   AccountSettings.html, AccountHistory.html
     * index.html uses its own showSetupOnly / hideSetupShowApp hooks.
     *
     * @param {object|null} user
     */
    function evaluateSetupForm(user) {
        const loggedIn = !!(user);
        const incomplete = loggedIn && (
 !String(user.playerName || '').trim() ||
            !String(user.mailbox || '').trim()
        );

      // Show/hide setup form
        const setupEl = document.getElementById('setupForm');
 if (setupEl) setupEl.style.display = (loggedIn && incomplete) ? 'block' : 'none';

        // Terms: hide only when logged in AND profile is complete (plan Q9 answer B)
        setLoginTermsWarningVisible_(!loggedIn || incomplete);

// Reset save button state
 onSetupInput_();

        // --- Blocking logic for trading pages ---
        // We detect which page we're on by looking for known sentinel elements.
        const isIndex = !!document.getElementById('requestControls');
  const isOCMHome = !!document.getElementById('tbListings');
    const isOCMUser = !!document.getElementById('tbSellListings');
        const isEWInsurance = !!document.getElementById('policyList');

        if (isIndex) {
            // index.html manages its own gating via showSetupOnly / hideSetupShowApp
            if (loggedIn && incomplete) {
  try { window.showSetupOnly && window.showSetupOnly(); } catch { }
  try { window.showRecaptchaWidget && window.showRecaptchaWidget(); } catch { }
            } else if (loggedIn) {
       // Let legacy-auth handle hideSetupShowApp via its own captcha check
            }
return;
        }

        if (isOCMHome || isOCMUser || isEWInsurance) {
    // Blocking pages: show/hide main content
     _setPageContentBlocked(incomplete && loggedIn);
        }
        // AccountSettings and AccountHistory: non-blocking, nothing extra to do
    }

    /**
     * Show or hide a page-level blocking overlay for trading pages.
     * @param {boolean} blocked
     */
    function _setPageContentBlocked(blocked) {
        const OVERLAY_ID = 'setupBlockOverlay';
        let overlay = document.getElementById(OVERLAY_ID);

    if (blocked) {
       if (!overlay) {
    overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
 overlay.style.cssText =
          'position:fixed;top:0;left:0;right:0;bottom:0;' +
        'background:rgba(255,255,255,0.85);z-index:500;' +
      'display:flex;align-items:center;justify-content:center;';
      overlay.innerHTML =
               '<div style="text-align:center;padding:24px;max-width:400px;">' +
            '<strong>Account setup required</strong><br>' +
     '<p class="small">Please complete your account setup above (player name and mailbox) before using this page.</p>' +
      '</div>';
            document.body.appendChild(overlay);
       }
            overlay.style.display = 'flex';
        } else {
       if (overlay) overlay.style.display = 'none';
   }
    }

    // ?? onSetupInput_ ???????????????????????????????????????????????????????
    /**
     * Enables/disables #btnSaveSetup based on whether both fields are non-empty.
     * Called via oninput on the setup form fields.
     */
    function onSetupInput_() {
     const nameVal = String(document.getElementById('setupPlayerName')?.value || '').trim();
  const mboxVal = String(document.getElementById('setupMailbox')?.value || '').trim();
        const btn = document.getElementById('btnSaveSetup');
     if (btn) btn.disabled = !(nameVal && mboxVal);
    }

    // ?? setLoginTermsWarningVisible_ ????????????????????????????????????????
    /**
   * Show or hide the Terms warning inside the shared login panel.
   * @param {boolean} visible
     */
 function setLoginTermsWarningVisible_(visible) {
   const el = document.getElementById('loginTermsWarning');
        if (el) el.style.display = visible ? 'block' : 'none';
    }

    // ?? submitSetup (central copy for all pages) ????????????????????????????
    /**
     * Saves player name + mailbox via the backend, then re-evaluates the setup form.
     * index.html's legacy-auth.js no longer needs its own copy.
     * All other pages also use this via onclick="submitSetup()".
   */
 window.submitSetup = window.submitSetup || async function submitSetup() {
        const msg = document.getElementById('setupMsg');
  const playerName = String(document.getElementById('setupPlayerName')?.value || '').trim();
        const mailbox = String(document.getElementById('setupMailbox')?.value || '').trim();

        // Resolve idToken from whichever page's state holds it
        const idToken = window.googleIdToken ||
      (window.OCMHome && window.OCMHome.state && window.OCMHome.state.googleIdToken) ||
    (window.OCMUser && window.OCMUser.state && window.OCMUser.state.googleIdToken) ||
          (window.EWIns && window.EWIns.state && window.EWIns.state.idToken) ||
        (window.getSavedIdToken && window.getSavedIdToken()) ||
       null;

        if (!idToken) {
    if (msg) msg.textContent = 'You need to login first.';
   return;
        }
     if (!playerName || !mailbox) {
        if (msg) msg.textContent = 'Both player name and mailbox are required.';
    return;
        }

        if (msg) msg.textContent = 'Saving...';

        try {
         await window.apiPost('updateMyProfile', {
    idToken,
            payload: { playerName, mailbox }
     });

   // Refresh current user from backend
  const meResp = await fetch(`${window.WEB_APP_URL}?action=me&idToken=${encodeURIComponent(idToken)}`);
  const meJson = await meResp.json();
   if (!meJson.ok) throw new Error(meJson.error || 'Backend error');
            const freshUser = meJson.data.user || {};

            if (msg) msg.textContent = 'Saved!';

          // Re-evaluate — hides form if now complete
   evaluateSetupForm(freshUser);

            // Update page-specific state so the rest of the page reflects the new profile
     if (window.currentUser) {
         window.currentUser.playerName = freshUser.playerName;
   window.currentUser.mailbox = freshUser.mailbox;
      }
          if (window.OCMHome && window.OCMHome.state) {
    window.OCMHome.state.currentUser = Object.assign(window.OCMHome.state.currentUser || {}, freshUser);
    }
         if (window.OCMUser && window.OCMUser.state) {
     window.OCMUser.state.currentUser = Object.assign(window.OCMUser.state.currentUser || {}, freshUser);
   }
         if (window.EWIns && window.EWIns.state) {
 window.EWIns.state.user = Object.assign(window.EWIns.state.user || {}, freshUser);
     }

// index.html post-setup gating
       const hasSetup = !(!String(freshUser.playerName || '').trim() || !String(freshUser.mailbox || '').trim());
            const passedCaptcha = !!freshUser.captchaPassed;
        if (hasSetup && passedCaptcha) {
     localStorage.setItem('vak_captcha_ok', '1');
  try { window.hideRecaptchaWidget && window.hideRecaptchaWidget(); } catch { }
      try { window.hideSetupShowApp && window.hideSetupShowApp(); } catch { }
      }

            // Refresh topbar balances if available
   try { window.refreshTopBarBalances && await window.refreshTopBarBalances(); } catch { }
  try { window.refreshPinnedBalanceForActiveTarget && await window.refreshPinnedBalanceForActiveTarget(); } catch { }

        } catch (e) {
            if (msg) msg.textContent = 'Error: ' + (e.message || e);
        }
    };

    // ?? Expose ??????????????????????????????????????????????????????????????
    window.SharedLogin = {
    init: init,
    evaluateSetupForm: evaluateSetupForm,
  onSetupInput_: onSetupInput_
    };
    window.setLoginTermsWarningVisible_ = setLoginTermsWarningVisible_;

})();

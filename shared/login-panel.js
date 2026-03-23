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
 *   window.submitSetup()   ? central copy for all pages
 *
 * options:
 *   showRecaptcha  {boolean}  — include #recaptchaContainer
 */
(function () {
    'use strict';

    // ?? Inject styles once ??????????????????????????????????????????????????
    (function injectStyles_() {
        if (document.getElementById('shared-login-panel-style')) return;
    const style = document.createElement('style');
  style.id = 'shared-login-panel-style';
        style.textContent = [
  /* Panel wrapper — rounded corners matching index.css .section */
       '#authPanel.section {',
       '  max-width:520px; margin:20px auto 24px; padding:16px 20px;',
'  border-radius:8px;',
      '}',

/* Terms warning — red tint, matches index.css exactly */
          '#loginTermsWarning {',
    '  margin:0 0 10px 0; padding:10px 12px;',
            '  border:1px solid #f3b3b3; background:#fff2f2;',
 '  border-radius:8px; color:#a40000;',
            '  font-size:12px; line-height:1.35;',
  '}',
            '#loginTermsWarning a { color:#a40000; text-decoration:underline; }',

/* Google login area */
  '#googleLoginArea { display:flex; flex-direction:column; align-items:flex-start; gap:8px; }',
     '#loginStatus     { color:#555; font-size:0.9rem; }',

     /* Setup form — base (hidden state, no border) */
       '#setupForm { margin-top:14px; padding-top:12px; border-top:1px solid #eee; }',

            /* Setup form highlight — green border/bg/shadow, matches index.css exactly */
            '#setupForm.setup-highlight {',
            '  background:#eaffe7; border:1px solid #2e7d32;',
    '  border-radius:8px; padding:10px;',
'  box-shadow:0 4px 10px rgba(46,125,50,0.12);',
    '}',

/* Deletion note — always green when visible */
            '#setupDeletionNote {',
            '  margin-top:8px; font-size:12px; color:#2e7d32;',
       '}',
            '#setupDeletionNote a { color:#2e7d32; text-decoration:underline; }',

 /* Overlay dismiss button */
            '#setupBlockOverlay .overlay-dismiss {',
            '  margin-top:14px; padding:7px 20px;',
        '  background:#2e7d32; color:#fff;',
        '  border:none; border-radius:6px;',
      '  cursor:pointer; font-size:14px;',
    '}',
            '#setupBlockOverlay .overlay-dismiss:hover { background:#1b5e20; }'
   ].join('\n');
     document.head.appendChild(style);
  })();

    // ?? init ????????????????????????????????????????????????????????????????
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

        // --- Recaptcha (optional; hidden by default) ---
 if (options.showRecaptcha) {
 const recap = document.createElement('div');
        recap.id = 'recaptchaContainer';
 recap.style.display = 'none';
 recap.style.marginTop = '10px';
 recap.innerHTML =
 '<div class="small" style="margin-bottom:6px;"><b>Human verification required</b></div>' +
 // v2 widget target — grecaptcha.render will use this container
 '<div id="recaptchaWidget" style="margin-bottom:8px;"></div>' +
 '<label class="small" style="display:block;margin-bottom:6px;">' +
 '<input type="checkbox" id="recaptchaConsent"> I am not a bot' +
 '</label>' +
 '<button id="btnVerifyRecaptcha" type="button" onclick="SharedLogin.verifyCaptcha()" disabled>Verify</button>' +
 '<div id="recaptchaMsg" class="small" style="margin-top:6px;"></div>';
 panel.appendChild(recap);
 }

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
  /* Deletion note: always visible whenever the setup form is shown */
          '<div id="setupDeletionNote">' +
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
     * @param {object|null} user
     */
  function evaluateSetupForm(user) {
 const loggedIn = !!(user);
 const incomplete = loggedIn && (
 !String(user.playerName || '').trim() ||
 !String(user.mailbox || '').trim()
 );

 const setupEl = document.getElementById('setupForm');
 const shouldShowSetup = loggedIn && incomplete;

 if (setupEl) {
 setupEl.style.display = shouldShowSetup ? 'block' : 'none';
 setupEl.classList.toggle('setup-highlight', shouldShowSetup);
 }

 setLoginTermsWarningVisible_(!loggedIn || incomplete);
 onSetupInput_();

 // Captcha visibility: show when logged in, setup complete, but captcha not passed.
 const recapEl = document.getElementById('recaptchaContainer');
 if (recapEl) {
 const hasSetup = loggedIn && !incomplete;
 const passedCaptcha = !!user?.captchaPassed;

 recapEl.style.display = (hasSetup && !passedCaptcha) ? 'block' : 'none';

 // If it is now needed and grecaptcha is available, render explicit widget.
 if (hasSetup && !passedCaptcha) {
 try { window.initRecaptcha && window.initRecaptcha(); } catch { }
 try { window.vakRecaptcha && window.vakRecaptcha.renderIfNeeded && window.vakRecaptcha.renderIfNeeded(); } catch { }
 }

 // keep Verify button enabled only when consent checkbox is checked
 const cb = document.getElementById('recaptchaConsent');
 const btn = document.getElementById('btnVerifyRecaptcha');
 if (cb && btn) {
 btn.disabled = !cb.checked;
 cb.onchange = () => { btn.disabled = !cb.checked; };
 }
 }

        // --- Blocking logic for trading pages ---
        const isIndex       = !!document.getElementById('requestControls');
        const isOCMHome   = !!document.getElementById('tbListings');
        const isOCMUser     = !!document.getElementById('tbSellListings');
        const isEWInsurance = !!document.getElementById('policyList');

 if (isIndex) {
     if (loggedIn && incomplete) {
   try { window.showSetupOnly && window.showSetupOnly(); } catch { }
        try { window.showRecaptchaWidget && window.showRecaptchaWidget(); } catch { }
  }
      return;
        }

        if (isOCMHome || isOCMUser || isEWInsurance) {
            _setPageContentBlocked(shouldShowSetup);
        }
     // AccountSettings and AccountHistory: non-blocking, nothing extra to do
    }

    // ?? _setPageContentBlocked ??????????????????????????????????????????????
    /**
     * Creates/shows a dismissible overlay for blocking trading pages.
  * The OK button scrolls to the top of the page so the user can see the
     * setup form in the login panel, then hides the overlay.
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
            'background:rgba(255,255,255,0.88);z-index:500;' +
                    'display:flex;align-items:center;justify-content:center;';
      overlay.innerHTML =
  '<div style="text-align:center;padding:28px 24px;max-width:420px;' +
      'background:#fff;border-radius:10px;border:2px solid #2e7d32;' +
      'box-shadow:0 4px 24px rgba(46,125,50,0.15);">' +
     '<div style="font-size:1.15rem;font-weight:bold;color:#2e7d32;margin-bottom:8px;">' +
         'Account setup required</div>' +
      '<p class="small" style="color:#333;margin:0 0 16px 0;">' +
  'Please complete your account setup (player name and mailbox) ' +
        'in the login panel above before using this page.</p>' +
        '<button class="overlay-dismiss" onclick="SharedLogin._dismissSetupOverlay_()">' +
         'OK. (go to setup form)' +
           '</button>' +
     '</div>';
 document.body.appendChild(overlay);
            }
   overlay.style.display = 'flex';
   } else {
      if (overlay) overlay.style.display = 'none';
   }
    }

    // ?? _dismissSetupOverlay_ ???????????????????????????????????????????????
    /**
     * Called by the overlay OK button. Hides the overlay and scrolls the
     * login panel into view so the user can fill in their details.
     */
    function _dismissSetupOverlay_() {
   const overlay = document.getElementById('setupBlockOverlay');
     if (overlay) overlay.style.display = 'none';
        // Scroll the auth panel (or setup form) into view
        const target = document.getElementById('setupForm') ||
      document.getElementById('authPanel');
        if (target) {
         target.scrollIntoView({ behavior: 'smooth', block: 'start' });
     // Give a brief focus pulse so the user knows where to look
            const nameInput = document.getElementById('setupPlayerName');
      if (nameInput) setTimeout(() => nameInput.focus(), 400);
        }
    }

    // ?? onSetupInput_ ???????????????????????????????????????????????????????
  function onSetupInput_() {
        const nameVal = String(document.getElementById('setupPlayerName')?.value || '').trim();
        const mboxVal = String(document.getElementById('setupMailbox')?.value || '').trim();
        const btn = document.getElementById('btnSaveSetup');
        if (btn) btn.disabled = !(nameVal && mboxVal);
    }

    // ?? setLoginTermsWarningVisible_ ????????????????????????????????????????
    function setLoginTermsWarningVisible_(visible) {
        const el = document.getElementById('loginTermsWarning');
      if (el) el.style.display = visible ? 'block' : 'none';
    }

    // ?? submitSetup (central copy for all pages) ?????????????????????????????
  window.submitSetup = window.submitSetup || async function submitSetup() {
      const msg = document.getElementById('setupMsg');
    const playerName = String(document.getElementById('setupPlayerName')?.value || '').trim();
        const mailbox    = String(document.getElementById('setupMailbox')?.value    || '').trim();

        // Resolve idToken from whichever page's state holds it
        const idToken = window.googleIdToken ||
  (window.OCMHome && window.OCMHome.state && window.OCMHome.state.googleIdToken) ||
            (window.OCMUser && window.OCMUser.state && window.OCMUser.state.googleIdToken) ||
            (window.EWIns   && window.EWIns.state && window.EWIns.state.idToken)       ||
     (window.getSavedIdToken && window.getSavedIdToken())       ||
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

      // Re-evaluate — hides form and overlay if now complete
            evaluateSetupForm(freshUser);

     // Update page-specific state
      if (window.currentUser) {
          window.currentUser.playerName = freshUser.playerName;
        window.currentUser.mailbox    = freshUser.mailbox;
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
            const hasSetup     = !(!String(freshUser.playerName || '').trim() || !String(freshUser.mailbox || '').trim());
  const passedCaptcha = !!freshUser.captchaPassed;
          if (hasSetup && passedCaptcha) {
        localStorage.setItem('vak_captcha_ok', '1');
       try { window.hideRecaptchaWidget && window.hideRecaptchaWidget(); } catch { }
      try { window.hideSetupShowApp    && window.hideSetupShowApp(); } catch { }
            }

    // Refresh topbar balances if available
 try { window.refreshTopBarBalances      && await window.refreshTopBarBalances();       } catch { }
            try { window.refreshPinnedBalanceForActiveTarget && await window.refreshPinnedBalanceForActiveTarget(); } catch { }

        } catch (e) {
         if (msg) msg.textContent = 'Error: ' + (e.message || e);
        }
    };

    // ?? verifyCaptcha_ ??????????????????????????????????????????????????
    /**
     * Executes reCAPTCHA verification and reports result to the backend.
     */
    async function verifyCaptcha_() {
 const msg = document.getElementById('recaptchaMsg');
 const cb = document.getElementById('recaptchaConsent');
 if (!window.googleIdToken) {
 if (msg) msg.textContent = 'Login required.';
 return;
 }
 if (!cb?.checked) {
 if (msg) msg.textContent = 'Please tick the checkbox first.';
 return;
 }

 const btn = document.getElementById('btnVerifyRecaptcha');
 if (btn) btn.disabled = true;
 if (msg) msg.textContent = 'Verifying...';

 try {
 try { window.initRecaptcha && window.initRecaptcha(); } catch { }

 const token = (typeof window.recaptchaWrap === 'function')
 ? await window.recaptchaWrap('linkPlayer')
 : null;

 if (!token) {
 if (window.currentUser?.captchaPassed) {
 if (msg) msg.textContent = 'Already verified.';
 try { evaluateSetupForm(window.currentUser); } catch { }
 return;
 }
 if (msg) msg.textContent = 'Please complete the reCAPTCHA checkbox first.';
 return;
 }

 const playerName = String(window.currentUser?.playerName || '').trim();
 const mailbox = String(window.currentUser?.mailbox || '').trim();

 // Keep payload minimal: only fields required for onboarding.
 const payload = { playerName, mailbox, recaptchaToken: token };

 // NOTE: `linkPlayer` is routed through GET-bypass in `api-client.js`.
 const r = await window.apiPost('linkPlayer', {
 idToken: window.googleIdToken,
 payload
 });

 if (!r?.ok) throw new Error(r?.error || 'Captcha verification failed');

 // Refresh `me` so UI updates and captcha is permanently hidden.
 const me = await window.apiGet('me', { idToken: window.googleIdToken });
 const u = (me?.data?.user) || (me?.user) || {};
 window.currentUser = Object.assign(window.currentUser || {}, u);

 if (msg) msg.textContent = 'Verified.';
 try { evaluateSetupForm(window.currentUser); } catch { }

 localStorage.setItem('vak_captcha_ok', '1');

 try { window.hideRecaptchaWidget && window.hideRecaptchaWidget(); } catch { }
 try { window.hideSetupShowApp && window.hideSetupShowApp(); } catch { }
 } catch (e) {
 if (msg) msg.textContent = 'Error: ' + (e.message || e);
 } finally {
 if (btn && cb) btn.disabled = !cb.checked;
 }
    }

    // ?? Expose ??????????????????????????????????????????????????????????????
    window.SharedLogin = {
 init: init,
 evaluateSetupForm: evaluateSetupForm,
 onSetupInput_: onSetupInput_,
 _dismissSetupOverlay_: _dismissSetupOverlay_,
 // Fix: actual implementation is `verifyCaptcha_`.
 verifyCaptcha: verifyCaptcha_,
 showRecaptcha: function showRecaptcha() {
 const c = document.getElementById('recaptchaContainer');
 if (c) c.style.display = 'block';
 },
 hideRecaptcha: function hideRecaptcha() {
 const c = document.getElementById('recaptchaContainer');
 if (c) c.style.display = 'none';
 }
 };

    window.setLoginTermsWarningVisible_ = setLoginTermsWarningVisible_;

    // Provide a stable global for legacy/inline onclick usage.
    // Some pages/components may reference `verifyCaptcha()` directly.
 window.verifyCaptcha = window.verifyCaptcha || function verifyCaptcha() {
 try {
 if (window.SharedLogin && typeof window.SharedLogin.verifyCaptcha === 'function') {
 return window.SharedLogin.verifyCaptcha();
 }
 } catch { }
};

})();

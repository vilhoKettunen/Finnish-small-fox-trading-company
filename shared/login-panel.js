/**
 * shared/login-panel.js
 * Universal shared login panel component.
 * Injects the standard Google Sign-In panel into any page that has
 * <div id="loginPanelMount"></div>.
 *
 * API:
 *   window.SharedLogin.init(options)
 *   window.setLoginTermsWarningVisible_(bool)
 *
 * options:
 *   showRecaptcha  {boolean}  — include #recaptchaContainer
 *   showSetupForm  {boolean}  — include #setupForm (shows only when needed)
 */
(function () {
    'use strict';

    // Inject styles once
    (function injectStyles_() {
        if (document.getElementById('shared-login-panel-style')) return;
        const style = document.createElement('style');
        style.id = 'shared-login-panel-style';
        style.textContent = [
    '#authPanel.section { max-width:520px; margin:20px auto 24px; padding:16px 20px; }',
   '#loginTermsWarning { margin-bottom:12px; }',
            '#googleLoginArea   { display:flex; flex-direction:column; align-items:flex-start; gap:8px; }',
         '#loginStatus       { color:#555; font-size:0.9rem; }',
  '#setupForm         { margin-top:14px; border-top:1px solid #eee; padding-top:12px; }'
        ].join('\n');
     document.head.appendChild(style);
 })();

    /**
     * Build the panel HTML and replace the mount point.
     * @param {object} [options]
   * @param {boolean} [options.showRecaptcha]
     * @param {boolean} [options.showSetupForm]
     */
    function init(options) {
        options = options || {};

        const mount = document.getElementById('loginPanelMount');
        if (!mount) {
            // No mount point — nothing to do (page may not need shared panel)
      return;
        }

        const panel = document.createElement('div');
        panel.id = 'authPanel';
        panel.className = 'section';

 // --- Terms warning ---
        const termsWarning = document.createElement('div');
     termsWarning.id = 'loginTermsWarning';
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

        // --- Recaptcha (optional) ---
        if (options.showRecaptcha) {
   const recap = document.createElement('div');
         recap.id = 'recaptchaContainer';
        recap.style.marginTop = '10px';
            panel.appendChild(recap);
        }

        // --- Setup form (optional — shown only when account is incomplete) ---
        if (options.showSetupForm) {
            const setup = document.createElement('div');
      setup.id = 'setupForm';
setup.innerHTML =
          '<h3>Account Setup</h3>' +
   '<label>Player Name: <input type="text" id="setupPlayerName"></label><br>' +
     '<label>Mailbox (e.g. 1A / 2B / F1): <input type="text" id="setupMailbox"></label><br>' +
        '<button onclick="submitSetup()">Save Setup</button>' +
     '<div id="setupMsg" class="small"></div>' +
                '<div id="setupDeletionNote">' +
             'You can delete your account/email at any time from ' +
     '<a href="AccountSettings.html">Account Settings</a>' +
     ' (this disables login).' +
       '</div>';
 panel.appendChild(setup);
        }

  mount.replaceWith(panel);
    }

    /**
     * Show or hide the Terms warning inside the shared login panel.
     * Replaces page-specific helpers: updateTermsWarning_, updateLoginTermsWarning_,
     * setTermsWarningVisible_, etc.
     * @param {boolean} visible
     */
    function setLoginTermsWarningVisible_(visible) {
        const el = document.getElementById('loginTermsWarning');
        if (el) el.style.display = visible ? '' : 'none';
    }

    // Expose
    window.SharedLogin = { init: init };
    window.setLoginTermsWarningVisible_ = setLoginTermsWarningVisible_;

})();

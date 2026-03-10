// whitepaper_js/whitepaper-boot.js
// Minimal boot for Whitepaper.html.
// Responsibilities:
//   1) Ensure initSharedTopBar is called (injects shared top bar).
//   2) Silently restore auth if user is already logged in (action=me).
//   3) No forced login, no backend write calls.

window.addEventListener('load', function () {
  document.body.classList.add('withTopBar');
    if (window.initSharedTopBar) {
        window.initSharedTopBar();
    }

    // Silent auth restore — option (b) from plan: restore name/login state + EW balance.
    // tryRestoreAuthGlobal is defined in auth-storage.js and handles the full
    // token ? action=me ? topbarSetAuthState flow automatically.
    // initSharedTopBar already calls tryRestoreAuthGlobal internally, so this is
    // a no-op if it was already triggered; guard with _autoLoginDone.
    if (!window._autoLoginDone && window.tryRestoreAuthGlobal) {
    window.tryRestoreAuthGlobal().catch(function () {});
    }
});

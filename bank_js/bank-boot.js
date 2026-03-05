// bank_js/bank-boot.js
window.BankBoot = {
  init: function () {
    window.initSharedTopBar && window.initSharedTopBar();
    document.body.classList.add('withTopBar');

    // Auth restore (for balance display in topbar only — page is fully public)
    try {
      const saved = window.getSavedIdToken && window.getSavedIdToken();
 if (saved) {
        window.topbarSetAuthState && window.topbarSetAuthState({ idToken: saved, user: null, isAdmin: false, balanceBT: null });
    }
    } catch (e) {
  console.warn('BankBoot: auth restore failed:', e);
    }

    BankUI.init();
  }
};

window.onload = function () {
  BankBoot.init();
};

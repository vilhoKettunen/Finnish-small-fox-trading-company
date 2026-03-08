// bank_js/bank-boot.js
window.BankBoot = {
  init: function () {
    window.initSharedTopBar && window.initSharedTopBar();
    document.body.classList.add('withTopBar');
    // Auth restore is now handled by topbar.js via tryRestoreAuthGlobal().
    // The old partial restore (which only set idToken without user/balance) has been removed.
    BankUI.init();
  }
};

window.onload = function () {
  BankBoot.init();
};

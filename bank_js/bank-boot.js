// bank_js/bank-boot.js

/* ─── Chart.js dark-mode defaults ─────────────────────────────────────── */
(function applyChartTheme() {
  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (isDark && window.Chart) {
    Chart.defaults.color = '#d1d5db';
    Chart.defaults.borderColor = 'rgba(75,85,99,0.4)';
    Chart.defaults.plugins.legend.labels.color = '#d1d5db';
    Chart.defaults.plugins.tooltip.backgroundColor = '#374151';
    Chart.defaults.plugins.tooltip.titleColor = '#f3f4f6';
    Chart.defaults.plugins.tooltip.bodyColor = '#e5e7eb';
    Chart.defaults.plugins.tooltip.borderColor = '#4b5563';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
  }
})();

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

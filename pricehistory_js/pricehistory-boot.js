// pricehistory-boot.js
window.PriceHistory = window.PriceHistory || {};

(function () {
  function applyChartTheme() {
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    var textColor = isDark ? '#d1d5db' : '#666';
    var gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    Chart.defaults.color = textColor;
    Chart.defaults.borderColor = gridColor;
    Chart.defaults.scale.grid = Chart.defaults.scale.grid || {};
    Chart.defaults.scale.grid.color = gridColor;
  }
  applyChartTheme();

  // Re-apply when theme changes and redraw charts
  new MutationObserver(function () {
    applyChartTheme();
    var applyBtn = document.getElementById('applyItemsBtn');
    if (applyBtn) applyBtn.click();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
})();

window.onload = () => {
  window.initSharedTopBar && window.initSharedTopBar();
  document.body.classList.add('withTopBar');
  window.PriceHistory.UI.init();
};

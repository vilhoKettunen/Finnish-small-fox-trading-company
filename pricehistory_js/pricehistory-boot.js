// pricehistory-boot.js
window.PriceHistory = window.PriceHistory || {};

window.onload = () => {
  window.initSharedTopBar && window.initSharedTopBar();
  document.body.classList.add('withTopBar');
  window.PriceHistory.UI.init();
};

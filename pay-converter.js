(function () {
  // Minimal “Pay With” and “Converter” helpers so the page doesn’t crash and the UI works.

  function findItemByName(name) {
    if (!name) return null;
    const n = String(name).trim().toLowerCase();
    return (window.items || []).find(i => String(i.name || '').toLowerCase() === n) || null;
  }

  function perEachPriceFrom(item, side /* 'buy' | 'sell' */) {
    if (!item) return 0;
    if (side === 'sell') {
      if (item.sellEach) return Number(item.sellEach);
      if (item.sellStack && item.bundleSize) return Number(item.sellStack) / Number(item.bundleSize || 1);
    } else {
      if (item.buyEach) return Number(item.buyEach);
      if (item.buyStack && item.bundleSize) return Number(item.buyStack) / Number(item.bundleSize || 1);
    }
    return 0;
  }

  // Renders a simple row with item name + qty
  function renderRow(container, kind /* 'pay'|'conv' */) {
    const row = document.createElement('div');
    row.className = 'payRow';
    row.innerHTML = `
      <input type="text" class="${kind}-name" placeholder="Item name">
      ${kind === 'pay'
        ? '<input type="number" class="pay-qty" min="1" value="1" title="Quantity (each)">'
        : '<input type="number" class="conv-pct" min="1" max="100" value="10" title="% of positive Net Balance">'}
      <button type="button" class="remove" title="Remove">❌</button>
    `;
    row.querySelector('.remove').onclick = () => row.remove();
    container.appendChild(row);
  }

  // Expose API (called by index.html)
  window.addPayRow = function addPayRow() {
    const host = document.getElementById('payOptions');
    if (!host) return;
    renderRow(host, 'pay');
  };

  window.calculatePayment = function calculatePayment() {
    const host = document.getElementById('payOptions');
    const result = document.getElementById('paymentResult');
    if (!host) return;

    const netSpan = document.getElementById('netTotal');
    const netRaw = Number(netSpan?.dataset?.raw || 0);
    if (netRaw >= 0) {
      if (result) result.textContent = 'Nothing to pay. Net Balance is not negative.';
      return;
    }

    const rows = Array.from(host.querySelectorAll('.payRow'));
    if (!rows.length) {
      if (result) result.textContent = 'Add at least one item.';
      return;
    }

    let added = 0;
    rows.forEach(r => {
      const name = r.querySelector('.pay-name')?.value?.trim();
      const qty = Number(r.querySelector('.pay-qty')?.value || 0);
      if (!name || qty <= 0) return;
      const item = findItemByName(name);
      const priceEach = perEachPriceFrom(item, 'sell'); // paying with items you “sell” to cover negative net
      if (priceEach <= 0) return;

      // Push into sell cart as Pay With rows
      (window.sellCart = window.sellCart || []).push({
        name: item ? item.name : name,
        qty: qty,
        price: priceEach,
        source: 'PAYWITH',
        isPayWith: true
      });
      added++;
    });

    // Re-render carts and totals
    try { window.renderSellList && window.renderSellList(); } catch {}
    try { window.calculateNet && window.calculateNet(); } catch {}

    // Clear rows
    host.innerHTML = '';
    if (result) result.textContent = added > 0 ? `Added ${added} item(s) to Pay With.` : 'No valid items added.';
  };

  window.addConverterRow = function addConverterRow() {
    const host = document.getElementById('converterOptions');
    if (!host) return;
    renderRow(host, 'conv');
  };

  window.calculateConversion = function calculateConversion() {
    const host = document.getElementById('converterOptions');
    const result = document.getElementById('converterResult');
    if (!host) return;

    const netSpan = document.getElementById('netTotal');
    const netRaw = Number(netSpan?.dataset?.raw || 0);
    if (netRaw <= 0) {
      if (result) result.textContent = 'Nothing to convert. Net Balance is not positive.';
      return;
    }

    const rows = Array.from(host.querySelectorAll('.payRow'));
    if (!rows.length) {
      if (result) result.textContent = 'Add at least one converter row.';
      return;
    }

    let added = 0;
    rows.forEach(r => {
      const name = r.querySelector('.conv-name, .pay-name')?.value?.trim(); // tolerate either class name
      const pct = Number(r.querySelector('.conv-pct')?.value || 0);
      if (!name || pct <= 0) return;

      const item = findItemByName(name);
      const priceEach = perEachPriceFrom(item, 'buy'); // converting positive BT into items you “buy”
      if (priceEach <= 0) return;

      const budgetBT = (netRaw * pct) / 100;
      const qty = Math.floor(budgetBT / priceEach);
      if (qty <= 0) return;

      (window.buyCart = window.buyCart || []).push({
        name: item ? item.name : name,
        qty: qty,
        price: priceEach,
        source: 'CONVERTER',
        isConverter: true
      });
      added++;
    });

    try { window.renderBuyList && window.renderBuyList(); } catch {}
    try { window.calculateNet && window.calculateNet(); } catch {}

    host.innerHTML = '';
    if (result) result.textContent = added > 0 ? `Converted into ${added} item(s).` : 'No items converted.';
  };
})();
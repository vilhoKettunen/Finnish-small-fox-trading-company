(function () {
  // Pay With + Converter logic (ported from `admin_js_old _working/index_old.html`)
  // Default percent for new rows is100 (totals may exceed100).

  function ensureCartGlobals() {
    if (!Array.isArray(window.buyCart)) window.buyCart = [];
    if (!Array.isArray(window.sellCart)) window.sellCart = [];
    if (!Array.isArray(window.payItems)) window.payItems = Array.isArray(window.items) ? window.items.slice() : [];
  }

  function filterDropdownData(q) {
    const ql = String(q || '').toLowerCase();
    const dd = window.dropdownData || [];
    if (!ql) return dd.slice(0,200);
    return dd.filter(d => String(d.name || '').toLowerCase().includes(ql)).slice(0,200);
  }

  function findPayItem(rawName) {
    const name = String(rawName || '').trim();
    if (!name) return null;
    const low = name.toLowerCase();
    const arr = window.payItems || window.items || [];
    return (
      arr.find(i => String(i.name || '').toLowerCase() === low) ||
      arr.find(i => String(i.name || '').toLowerCase().includes(low)) ||
      null
    );
  }

  function getNetRaw() {
    const netSpan = document.getElementById('netTotal');
    const raw = Number(netSpan?.dataset?.raw);
    if (!isNaN(raw)) return raw;
    const fallback = parseFloat(String(netSpan?.textContent || '0').replace(/[^\d.-]/g, ''));
    return isNaN(fallback) ?0 : fallback;
  }

  function getAfterBalanceRaw() {
    // ensure totals are up to date
    try { window.calculateNet && window.calculateNet(); } catch { }
    try { window.updateCombinedTotals && window.updateCombinedTotals(); } catch { }
    const afterEl = document.getElementById('accountBalanceAfter');
    const raw = Number(afterEl?.dataset?.raw);
    if (!isNaN(raw)) return raw;
    const fallback = parseFloat(String(afterEl?.textContent || '0').replace(/[^\d.-]/g, ''));
    return isNaN(fallback) ?0 : fallback;
  }

  // payListMap keeps metadata for each generated payId so we can update the li text
  const payListMap = {};

  // Build per-row DOM to match the old page (dropdown-wrap + dropdown-list)
  window.addPayRow = function addPayRow() {
    ensureCartGlobals();

    const host = document.getElementById('payOptions');
    if (!host) return;

    const div = document.createElement('div');
    div.className = 'payRow';

    const unique = 'paySelect_' + Date.now() + '_' + Math.floor(Math.random() *10000);

    const input = document.createElement('input');
    input.id = unique;
    input.className = 'dropdown-input';
    input.placeholder = 'Item name';

    const list = document.createElement('div');
    list.id = unique + 'List';
    list.className = 'dropdown-list';
    list.style.display = 'none';

    const wrap = document.createElement('div');
    wrap.className = 'dropdown-wrap';
    wrap.appendChild(input);
    wrap.appendChild(list);

    const percent = document.createElement('input');
    percent.type = 'number';
    percent.value =100;
    percent.min =0;
    percent.max =100;
    percent.placeholder = '%';

    const removeRowBtn = document.createElement('button');
    removeRowBtn.type = 'button';
    removeRowBtn.textContent = '❌';
    removeRowBtn.onclick = () => {
      div.remove();
      window.calculatePayment();
    };

    div.appendChild(wrap);
    div.appendChild(document.createTextNode(' % of total: '));
    div.appendChild(percent);
    div.appendChild(removeRowBtn);
    host.appendChild(div);

    if (window.attachDropdownToElements) {
      window.attachDropdownToElements(input, list, filterDropdownData, () => { });
    } else if (window.attachSimpleItemDropdown) {
      window.attachSimpleItemDropdown(input, list);
    }
  };

  window.calculatePayment = function calculatePayment() {
    ensureCartGlobals();

    const payListEl = document.getElementById('payList');
    if (payListEl) payListEl.innerHTML = '';

    const totalNet = getNetRaw();
    if (totalNet >=0) {
      const paymentResult = document.getElementById('paymentResult');
      if (paymentResult) paymentResult.textContent = `✅ Net Balance is ${totalNet.toFixed(2)} BT. No payment needed.`;
      window.sellCart = window.sellCart.filter(e => !e.isPayWith);
      try { window.renderSellList && window.renderSellList(); } catch { }
      try { window.calculateNet && window.calculateNet(); } catch { }
      return;
    }

    const owed = -totalNet;
    let usedPercent =0;

    // Remove any previous pay-with-generated entries.
    window.sellCart = window.sellCart.filter(e => !e.isPayWith);
    // clear map
    for (const k in payListMap) delete payListMap[k];

    const curr = document.getElementById('currencySelect')?.value || window.BASE_CURRENCY;
    const rows = document.querySelectorAll('#payOptions .payRow');

    const generated = []; // store objects { payId, item, stacks, individuals, stackPrice, indivPrice }

    rows.forEach(row => {
      const inputEl = row.querySelector('input.dropdown-input');
      const percentEl = row.querySelector('input[type="number"]');
      const rawName = (inputEl?.value || '').trim();
      const percent = parseFloat(percentEl?.value) ||0;
      if (!rawName || percent <=0) return;

      const item = findPayItem(rawName);
      if (!item) return;

      usedPercent += percent;
      const portion = (percent /100) * owed;

      // IMPORTANT: Payment uses BUY prices exactly like old page.
      const stackPrice = item.buyStack || (item.buyEach && item.bundleSize ? item.buyEach * item.bundleSize :0);
      const indivPrice = item.buyEach || (item.buyStack && item.bundleSize ? item.buyStack / item.bundleSize :0);
      if ((!stackPrice || stackPrice <=0) && (!indivPrice || indivPrice <=0)) return;

      let stacks =0;
      let individuals =0;
      let leftover = portion;

      if (stackPrice >0) {
        stacks = Math.floor(portion / stackPrice);
        leftover -= stacks * stackPrice;
      }
      if (indivPrice >0 && leftover >0) {
        const addIndividuals = Math.floor(leftover / indivPrice);
        individuals += addIndividuals;
        leftover -= addIndividuals * indivPrice;
      }

      const payId = 'pay_' + Date.now() + '_' + Math.floor(Math.random() *10000);

      // Add rows to sellCart (mark with _payId)
      const entries = [];
      if (stacks >0) {
        const rowObj = { name: item.name, qty: stacks, price: stackPrice, bundleSize: item.bundleSize, isPayWith: true, _payId: payId };
        window.sellCart.push(rowObj);
        entries.push({ type: 'stack', ref: rowObj });
      }
      if (individuals >0) {
        const rowObj = { name: item.name, qty: individuals, price: indivPrice, isPayWith: true, _payId: payId };
        window.sellCart.push(rowObj);
        entries.push({ type: 'indiv', ref: rowObj });
      }

      // Build the li and keep metadata so we can update it later if we nudge quantity
      if (payListEl) {
        const li = document.createElement('li');
        li.dataset.payid = payId;
        li.dataset.percent = String(percent);

        function buildPayText(entriesList, pct) {
          let textParts = [];
          const s = entriesList.find(e => e.type === 'stack');
          const i = entriesList.find(e => e.type === 'indiv');
          if (s) textParts.push(`${s.ref.qty} x ${s.ref.bundleSize || item.bundleSize} ${item.name} (${s.ref.price.toFixed(2)} BT stack)`);
          if (i) textParts.push(`${i.ref.qty} x ${item.name} (${i.ref.price.toFixed(2)} BT each)`);
          const totalBT = (s ? s.ref.qty * s.ref.price :0) + (i ? i.ref.qty * i.ref.price :0);
          const prefix = (typeof pct === 'number') ? `${pct}% = ` : '';
          return prefix + textParts.join(' + ') + ` (${totalBT.toFixed(2)} BT)`;
        }

        li.textContent = buildPayText(entries, percent);

        const removeBtn = document.createElement('button');
        removeBtn.textContent = '❌';
        removeBtn.onclick = () => {
          // remove all sellCart entries with this payId
          window.sellCart = window.sellCart.filter(it => !(it.isPayWith && it._payId === payId));
          li.remove();
          try { window.renderSellList && window.renderSellList(); } catch { }
          try { window.calculateNet && window.calculateNet(); } catch { }
        };
        li.appendChild(removeBtn);
        payListEl.appendChild(li);

        // store metadata
        payListMap[payId] = { li, item, entries, percent };
      }

      generated.push({ payId, item, stackPrice, indivPrice, entries });
    });

    // Recompute totals now that we've added generated entries
    try { window.renderSellList && window.renderSellList(); } catch { }
    try { window.calculateNet && window.calculateNet(); } catch { }

    // Ensure Account Balance After Transaction is >=0 (barely positive)
    let after = getAfterBalanceRaw();
    if (after <0 && generated.length) {
      // find cheapest individual among generated; if none, find cheapest generated indivPrice to add
      let candidates = [];
      generated.forEach(g => {
        const meta = payListMap[g.payId];
        if (!meta) return;
        const indivEntry = meta.entries.find(en => en.type === 'indiv');
        if (indivEntry) {
          candidates.push({ payId: g.payId, price: indivEntry.ref.price, entry: indivEntry, meta });
        } else if (g.indivPrice && g.indivPrice >0) {
          candidates.push({ payId: g.payId, price: g.indivPrice, entry: null, meta });
        }
      });

      if (candidates.length) {
        candidates.sort((a,b) => a.price - b.price);
        const chosen = candidates[0];
        // If there's already an indiv entry, increment it
        if (chosen.entry) {
          chosen.entry.ref.qty +=1;
        } else {
          // push a new individual sellCart entry for this payId
          const newEntry = { name: chosen.meta.item.name, qty:1, price: chosen.price, isPayWith: true, _payId: chosen.payId };
          window.sellCart.push(newEntry);
          chosen.meta.entries.push({ type: 'indiv', ref: newEntry });
        }

        // Update the li text for the chosen payId to aggregate counts
        const meta = chosen.meta;
        if (meta && meta.li) {
          const newText = (function(){
            const sEntry = meta.entries.find(en => en.type === 'stack');
            const iEntry = meta.entries.find(en => en.type === 'indiv');
            const pct = meta.percent;
            const parts = [];
            if (sEntry) parts.push(`${sEntry.ref.qty} x ${sEntry.ref.bundleSize || meta.item.bundleSize} ${meta.item.name} (${sEntry.ref.price.toFixed(2)} BT stack)`);
            if (iEntry) parts.push(`${iEntry.ref.qty} x ${meta.item.name} (${iEntry.ref.price.toFixed(2)} BT each)`);
            const totalBT = (sEntry ? sEntry.ref.qty * sEntry.ref.price :0) + (iEntry ? iEntry.ref.qty * iEntry.ref.price :0);
            return `${pct}% = ` + parts.join(' + ') + ` (${totalBT.toFixed(2)} BT)`;
          })();
          // replace text node (first child) with new text while keeping button
          // remove all text nodes before button
          while (meta.li.firstChild && meta.li.firstChild.nodeType === Node.TEXT_NODE) meta.li.removeChild(meta.li.firstChild);
          meta.li.insertBefore(document.createTextNode(newText + ' '), meta.li.firstChild);
        }

        // Re-render totals and lists
        try { window.renderSellList && window.renderSellList(); } catch { }
        try { window.calculateNet && window.calculateNet(); } catch { }

        // recompute after
        after = getAfterBalanceRaw();
      }
    }

    const paymentResult = document.getElementById('paymentResult');
    if (paymentResult) {
      if (after <0) {
        paymentResult.textContent = `⚠️ Payment did not fully cover the balance. Remaining after: ${after.toFixed(2)} BT.`;
      } else {
        paymentResult.textContent = usedPercent !==100
          ? `⚠️ Warning: payment percentages total ${usedPercent}%, not100%.`
          : `To pay ${owed.toFixed(2)} BT, bring the items listed above.`;
      }
    }
  };

  window.addConverterRow = function addConverterRow() {
    ensureCartGlobals();

    const host = document.getElementById('converterOptions');
    if (!host) return;

    const div = document.createElement('div');
    div.className = 'payRow';

    const unique = 'convSelect_' + Date.now() + '_' + Math.floor(Math.random() *10000);

    const input = document.createElement('input');
    input.id = unique;
    input.className = 'dropdown-input';
    input.placeholder = 'Item name';

    const list = document.createElement('div');
    list.id = unique + 'List';
    list.className = 'dropdown-list';
    list.style.display = 'none';

    const wrap = document.createElement('div');
    wrap.className = 'dropdown-wrap';
    wrap.appendChild(input);
    wrap.appendChild(list);

    const percent = document.createElement('input');
    percent.type = 'number';
    percent.value =100;
    percent.min =0;
    percent.max =100;
    percent.placeholder = '%';

    const removeRowBtn = document.createElement('button');
    removeRowBtn.type = 'button';
    removeRowBtn.textContent = '❌';
    removeRowBtn.onclick = () => {
      div.remove();
      window.calculateConversion();
    };

    div.appendChild(wrap);
    div.appendChild(document.createTextNode(' % of Net Balance: '));
    div.appendChild(percent);
    div.appendChild(removeRowBtn);
    host.appendChild(div);

    if (window.attachDropdownToElements) {
      window.attachDropdownToElements(input, list, filterDropdownData, () => { });
    } else if (window.attachSimpleItemDropdown) {
      window.attachSimpleItemDropdown(input, list);
    }
  };

  window.calculateConversion = function calculateConversion() {
    ensureCartGlobals();

    const converterList = document.getElementById('converterListDisplay');
    if (converterList) converterList.innerHTML = '';

    const netBT = getNetRaw();
    if (netBT <=0) {
      const converterResult = document.getElementById('converterResult');
      if (converterResult) converterResult.textContent = '⚠️ Net Balance is not positive.';
      return;
    }

    // Remove previous converter-generated rows
    window.buyCart = window.buyCart.filter(e => !e.isConverter);

    const rows = document.querySelectorAll('#converterOptions .payRow');
    let usedPercent =0;

    rows.forEach(row => {
      const inputEl = row.querySelector('input.dropdown-input');
      const name = inputEl?.value.trim() || '';
      const percent = parseFloat(row.querySelector('input[type="number"]')?.value) ||0;

      const item = (window.items || []).find(i => i.name === name);
      if (!item || percent <=0) return;

      usedPercent += percent;
      const portion = (percent /100) * netBT;

      // IMPORTANT: Converter uses SELL prices exactly like old page.
      const stackPrice = item.sellStack || (item.sellEach && item.bundleSize ? item.sellEach * item.bundleSize :0);
      const indivPrice = item.sellEach || (item.sellStack && item.bundleSize ? item.sellStack / item.bundleSize :0);
      if ((!stackPrice || stackPrice <=0) && (!indivPrice || indivPrice <=0)) return;

      let stacks =0;
      let individuals =0;
      let leftover = portion;

      if (stackPrice >0) {
        stacks = Math.floor(portion / stackPrice);
        leftover -= stacks * stackPrice;
      }
      if (indivPrice >0) {
        const addIndividuals = Math.floor(leftover / indivPrice);
        individuals += addIndividuals;
        leftover -= addIndividuals * indivPrice;
      }

      const rowId = 'conv_' + Date.now() + '_' + Math.floor(Math.random() *10000);

      if (stacks >0) {
        window.buyCart.push({ name: item.name, qty: stacks, price: stackPrice, bundleSize: item.bundleSize, isConverter: true, _rowId: rowId });
      }
      if (individuals >0) {
        window.buyCart.push({ name: item.name, qty: individuals, price: indivPrice, isConverter: true, _rowId: rowId });
      }

      if (converterList) {
        const li = document.createElement('li');
        let txt = `${percent}% = `;
        if (stacks >0) txt += `${stacks} stack(s) × ${item.bundleSize} ${item.name} (${stackPrice.toFixed(2)} BT stack)`;
        if (individuals >0) {
          if (stacks >0) txt += ' + ';
          txt += `${individuals} × ${item.name} (${indivPrice.toFixed(2)} BT each)`;
        }
        const totalBT = stacks * stackPrice + individuals * indivPrice;
        txt += ` (${totalBT.toFixed(2)} BT)`;

        const curr = document.getElementById('currencySelect')?.value || window.BASE_CURRENCY;
        if (curr && curr !== window.BASE_CURRENCY && window.formatValue) {
          txt += ' ' + window.formatValue(totalBT, curr, true);
        }

        li.textContent = txt;

        const removeBtn = document.createElement('button');
        removeBtn.textContent = '❌';
        removeBtn.onclick = () => {
          window.buyCart = window.buyCart.filter(e => !(e.isConverter && e._rowId === rowId));
          li.remove();
          try { window.renderBuyList && window.renderBuyList(); } catch { }
          try { window.calculateNet && window.calculateNet(); } catch { }
        };
        li.appendChild(removeBtn);
        converterList.appendChild(li);
      }
    });

    try { window.renderBuyList && window.renderBuyList(); } catch { }

    const converterResult = document.getElementById('converterResult');
    if (converterResult) {
      converterResult.textContent = usedPercent ===0
        ? '⚠️ No allocations set.'
        : `✅ Conversion done. Allocated ${usedPercent}% of Net Balance.`;
    }
  };

  // Called after sheet loads to wire existing rows (if any)
  window.wirePayWithAndConverterDropdowns = function wirePayWithAndConverterDropdowns() {
    // Attach dropdowns to any existing payRow inputs that may have been created before data loaded
    const payRows = document.querySelectorAll('#payOptions .payRow');
    payRows.forEach(row => {
      const input = row.querySelector('input.dropdown-input');
      const list = row.querySelector('.dropdown-list');
      if (input && list && window.attachDropdownToElements) {
        // re-attach using the canonical helper and the proper filter
        window.attachDropdownToElements(input, list, filterDropdownData, () => {});
      }
    });

    const convRows = document.querySelectorAll('#converterOptions .payRow');
    convRows.forEach(row => {
      const input = row.querySelector('input.dropdown-input');
      const list = row.querySelector('.dropdown-list');
      if (input && list && window.attachDropdownToElements) {
        window.attachDropdownToElements(input, list, filterDropdownData, () => {});
      }
    });
  };
})();
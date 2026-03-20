// Cart operations: quick calcs, adders, row coloring and renderers
(function () {
    'use strict';

    const BASE_CURRENCY_ = () => window.BASE_CURRENCY || 'EW';
    const EXCESS_THRESHOLD_EW_ = 0.01;

    function getCurrencyItem_(currencyName) {
        const base = BASE_CURRENCY_();
        if (!currencyName || currencyName === base) return null;
        return (window.items || []).find(i => String(i.name || '').toLowerCase() === String(currencyName).toLowerCase()) || null;
    }

    function getRatePerEachEw_(currencyItem, mode /* 'BUY' | 'SELL' */) {
        // BUY: EW paid per each when buying the currency item from store.
        // SELL: EW gained per each when selling the currency item to store.
        if (!currencyItem) return null;

        const bundleSize = Math.max(1, Number(currencyItem.bundleSize) || 1);

        const nOrNull = (v) => {
            const n = Number(v);
            return (v != null && isFinite(n)) ? n : null;
        };

        if (mode === 'BUY') {
            const each = nOrNull(currencyItem.buyEach);
            if (each != null) return each;
            const stack = nOrNull(currencyItem.buyStack);
            if (stack != null) return stack / bundleSize;
            return null;
        }

        if (mode === 'SELL') {
            const each = nOrNull(currencyItem.sellEach);
            if (each != null) return each;
            const stack = nOrNull(currencyItem.sellStack);
            if (stack != null) return stack / bundleSize;
            return null;
        }

        return null;
    }

    function formatEwWithDisplayCurrencyBreakdown_(ewAmount, currencyName, opts) {
        const base = BASE_CURRENCY_();
        const ew = Number(ewAmount) || 0;

        // If Display Currency = EW, show just EW.
        if (!currencyName || currencyName === base) return `${ew.toFixed(2)} ${base}`;

        const currencyItem = getCurrencyItem_(currencyName);
        const ratePerEachEw = Number(opts?.ratePerEachEw) || 0;
        const roundMode = opts?.roundMode || 'FLOOR'; // 'CEIL' | 'FLOOR'

        if (!currencyItem || !(ratePerEachEw > 0)) {
            return `${ew.toFixed(2)} ${base} (N/A)`;
        }

        const stackSize = Math.max(1, Number(currencyItem.bundleSize) || 1);

        // counts are always integer (required)
        let eachCount = (roundMode === 'CEIL')
            ? Math.ceil(ew / ratePerEachEw)
            : Math.floor(ew / ratePerEachEw);

        eachCount = Math.max(0, eachCount);

        const stacks = Math.floor(eachCount / stackSize);
        const individuals = eachCount - (stacks * stackSize);

        // Excess EW rules:
        // - For CEIL: excess = itemsValue - ewAmount (you bring extra)
        // - For FLOOR: excess = ewAmount - itemsValue (remainder not representable)
        const itemsValueEw = eachCount * ratePerEachEw;
        const excess = (roundMode === 'CEIL') ? (itemsValueEw - ew) : (ew - itemsValueEw);

        let breakdown = `(${stacks}x${stackSize} stacks and ${individuals} ${currencyItem.name}`;
        if (excess >= EXCESS_THRESHOLD_EW_) breakdown += `, Excess EW ${excess.toFixed(2)}`;
        breakdown += ')';

        return `${ew.toFixed(2)} ${base} ${breakdown}`;
    }

    window.quickStackCalc = window.quickStackCalc || function quickStackCalc() {
        const name = document.getElementById('quickStackSelect').value;
        const qty = parseInt(document.getElementById('quickStackQty').value) || 0;
        const item = (window.items || []).find(i => i.name === name); if (!item) return;
        const buyText = item.buyStack ? `${qty} × ${item.bundleSize} ${item.name} buys for ${(qty * item.buyStack).toFixed(2)} EW` : '';
        const sellText = item.sellStack ? `${qty} × ${item.bundleSize} ${item.name} sells for ${(qty * item.sellStack).toFixed(2)} EW` : '';
        document.getElementById('quickStackResult').textContent = [buyText, sellText].filter(Boolean).join(' | ');
    };

    window.quickIndivCalc = window.quickIndivCalc || function quickIndivCalc() {
        const name = document.getElementById('quickIndivSelect').value;
        const qty = parseInt(document.getElementById('quickIndivQty').value) || 0;
        const item = (window.items || []).find(i => i.name === name); if (!item) return;

        // Determine per-individual buy/sell price.
        // Prefer explicit per-each price (buyEach / sellEach). If missing, fallback to stack price divided by bundleSize.
        const bundleSize = Number(item.bundleSize || 1) || 1;

        const perEachBuy = (item.buyEach != null && isFinite(Number(item.buyEach)))
            ? Number(item.buyEach)
            : (item.buyStack != null && isFinite(Number(item.buyStack))) ? (Number(item.buyStack) / bundleSize) : null;

        const perEachSell = (item.sellEach != null && isFinite(Number(item.sellEach)))
            ? Number(item.sellEach)
            : (item.sellStack != null && isFinite(Number(item.sellStack))) ? (Number(item.sellStack) / bundleSize) : null;

        const buyText = (perEachBuy != null) ? `${qty} × ${item.name} buys for ${(qty * perEachBuy).toFixed(2)} EW` : '';
        const sellText = (perEachSell != null) ? `${qty} × ${item.name} sells for ${(qty * perEachSell).toFixed(2)} EW` : '';
        document.getElementById('quickIndivResult').textContent = [buyText, sellText].filter(Boolean).join(' | ');
    };

    /* ===== Buy cart adders ===== */
    window.addStack = window.addStack || function addStack() {
        const name = document.getElementById('stackSelect').value;
        const qty = parseInt(document.getElementById('stackQty').value) || 0;
        const item = (window.items || []).find(i => i.name === name); if (!item || !item.sellStack) return;
        window.buyCart.push({ name: item.name, qty, price: item.sellStack, bundleSize: item.bundleSize, source: 'STORE' });
        window.renderBuyList && window.renderBuyList();
    };

    window.addIndividual = window.addIndividual || function addIndividual() {
        const name = document.getElementById('indivSelect').value;
        const qty = parseInt(document.getElementById('indivQty').value) || 0;
        const item = (window.items || []).find(i => i.name === name); if (!item || !item.sellEach) return;
        window.buyCart.push({ name: item.name, qty, price: item.sellEach, source: 'STORE' });
        window.renderBuyList && window.renderBuyList();
    };

    window.addBuyAccountBalance = window.addBuyAccountBalance || function addBuyAccountBalance() {
        const balance = parseFloat(document.getElementById('buyAccountBalanceInput').value) || 0;
        if (balance <= 0) return;
        window.buyCart.push({ name: 'Account Balance', qty: 1, price: balance, isBalance: true, source: 'BALANCE' });
        window.renderBuyList && window.renderBuyList();
    };

    window.addCustomBuyStack = window.addCustomBuyStack || function addCustomBuyStack() {
        const name = document.getElementById('customBuyStackSelect').value;
        const qty = parseInt(document.getElement.getElementById('customBuyStackQty').value) || 0;
        const price = parseFloat(document.getElementById('customBuyStackPrice').value) || 0;
        const item = (window.items || []).find(i => i.name === name);
        if (!item || qty <= 0 || price <= 0) return;
        window.buyCart.push({ name: item.name, qty, price, bundleSize: item.bundleSize, isCustom: true, source: 'STORE' });
        window.renderBuyList && window.renderBuyList();
    };

    window.addCustomBuyIndividual = window.addCustomBuyIndividual || function addCustomBuyIndividual() {
        const name = document.getElementById('customBuyIndivSelect').value;
        const qty = parseInt(document.getElementById('customBuyIndivQty').value) || 0;
        const price = parseFloat(document.getElementById('customBuyIndivPrice').value) || 0;
        const item = (window.items || []).find(i => i.name === name);
        if (!item || qty <= 0 || price <= 0) return;
        window.buyCart.push({ name: item.name, qty, price, isCustom: true, source: 'STORE' });
        window.renderBuyList && window.renderBuyList();
    };

    window.addFullyCustomBuy = window.addFullyCustomBuy || function addFullyCustomBuy() {
        const name = document.getElementById('customBuyName').value.trim();
        const qty = parseInt(document.getElementById('customBuyQty').value) || 0;
        const stackSize = parseInt(document.getElementById('customBuyStackSize').value) || 1;
        const price = parseFloat(document.getElementById('customBuyPrice').value) || 0;
        if (!name || qty <= 0 || price <= 0 || stackSize <= 0) return;
        window.buyCart.push({ name, qty, bundleSize: stackSize, price, isFullyCustom: true, source: 'CUSTOM' });
        window.renderBuyList && window.renderBuyList();
    };

    /* ===== Sell cart adders ===== */
    window.addSellStack = window.addSellStack || function addSellStack() {
        const name = document.getElementById('sellStackSelect').value;
        const qty = parseInt(document.getElementById('sellStackQty').value) || 0;
        const item = (window.items || []).find(i => i.name === name); if (!item || !item.buyStack) return;
        window.sellCart.push({ name: item.name, qty, price: item.buyStack, bundleSize: item.bundleSize, source: 'STORE' });
        window.renderSellList && window.renderSellList();
    };

    window.addSellIndividual = window.addSellIndividual || function addSellIndividual() {
        const name = document.getElementById('sellIndivSelect').value;
        const qty = parseInt(document.getElementById('sellIndivQty').value) || 0;
        const item = (window.items || []).find(i => i.name === name); if (!item || !item.buyEach) return;
        window.sellCart.push({ name: item.name, qty, price: item.buyEach, source: 'STORE' });
        window.renderSellList && window.renderSellList();
    };

    window.addAccountBalance = window.addAccountBalance || function addAccountBalance() {
        const balance = parseFloat(document.getElementById('accountBalanceInput').value) || 0;
        if (balance <= 0) return;
        window.sellCart.push({ name: 'Account Balance', qty: 1, price: balance, isBalance: true, source: 'BALANCE' });
        window.renderSellList && window.renderSellList();
    };

    window.addCustomSellStack = window.addCustomSellStack || function addCustomSellStack() {
        const name = document.getElementById('customSellStackSelect').value;
        const qty = parseInt(document.getElementById('customSellStackQty').value) || 0;
        const price = parseFloat(document.getElementById('customSellStackPrice').value) || 0;
        const item = (window.items || []).find(i => i.name === name);
        if (!item || qty <= 0 || price <= 0) return;
        window.sellCart.push({ name: item.name, qty, price, bundleSize: item.bundleSize, isCustom: true, source: 'STORE' });
        window.renderSellList && window.renderSellList();
    };

    window.addCustomSellIndividual = window.addCustomSellIndividual || function addCustomSellIndividual() {
        const name = document.getElementById('customSellIndivSelect').value;
        const qty = parseInt(document.getElementById('customSellIndivQty').value) || 0;
        const price = parseFloat(document.getElementById('customSellIndivPrice').value) || 0;
        const item = (window.items || []).find(i => i.name === name);
        if (!item || qty <= 0 || price <= 0) return;
        window.sellCart.push({ name: item.name, qty, price, isCustom: true, source: 'STORE' });
        window.renderSellList && window.renderSellList();
    };

    window.addFullyCustomSell = window.addFullyCustomSell || function addFullyCustomSell() {
        const name = document.getElementById('customSellName').value.trim();
        const qty = parseInt(document.getElementById('customSellQty').value) || 0;
        const stackSize = parseInt(document.getElementById('customSellStackSize').value) || 1;
        const price = parseFloat(document.getElementById('customSellPrice').value) || 0;
        if (!name || qty <= 0 || price <= 0 || stackSize <= 0) return;
        window.sellCart.push({ name, qty, bundleSize: stackSize, price, isFullyCustom: true, source: 'CUSTOM' });
        window.renderSellList && window.renderSellList();
    };

    /* ===== Row coloring ===== */
    window.evaluateRowColorBuy = window.evaluateRowColorBuy || function evaluateRowColorBuy(entry) {
        const item = (window.items || []).find(i => i.name === entry.name);
        const prog = (window.stockProgressCache || []).find(sp => sp.name === entry.name);
        if (!item && !prog) return null;
        if (entry.source === 'OCM') return null;
        const bundleSize = item ? (item.bundleSize || 1) : 1;
        const requestedStacks = entry.bundleSize ? Number(entry.qty || 0) : (Number(entry.qty || 0) / bundleSize);
        const availableStacks = item ? (Number(item.stackStock || 0) + (Number(item.indivStock || 0) / bundleSize)) : (prog ? prog.currentStacks : 0);
        if (availableStacks <= 0) return 'row-warning-red';
        const ratio = requestedStacks / availableStacks;
        if (ratio > 1) return 'row-warning-red';
        if (ratio > 0.5) return 'row-warning-yellow';
        return null;
    };

    window.evaluateRowColorSell = window.evaluateRowColorSell || function evaluateRowColorSell(entry) {
        const prog = (window.stockProgressCache || []).find(sp => sp.name === entry.name);
        const item = (window.items || []).find(i => i.name === entry.name);
        if (!prog || entry.source === 'OCM') return null;
        const bundleSize = item ? (Number(item.bundleSize || 1) || 1) : 1;
        const sellingStacks = entry.bundleSize ? Number(entry.qty || 0) : (Number(entry.qty || 0) / bundleSize);
        const currentStacks = Number(prog.currentStacks || 0);
        const projected = currentStacks + sellingStacks;
        const effectiveTarget = Number(item?.targetEach || 0);
        if (effectiveTarget > 0 && projected > effectiveTarget) return 'row-warning-red';
        return null;
    };

    /* ===== Render carts ===== */
    window.renderBuyList = window.renderBuyList || function renderBuyList() {
        const list = document.getElementById('buyList'); list.innerHTML = '';
        let total = 0; const curr = document.getElementById('currencySelect').value;
        (window.buyCart || []).forEach(e => {
            const li = document.createElement('li');
            let rowTotal = 0, rowText = '';
            if (e.bundleSize && e.isFullyCustom) {
                rowTotal = (e.qty / e.bundleSize) * e.price;
                rowText = `${e.qty} x ${e.name} (${e.price.toFixed(2)} EW per ${e.bundleSize}) (${rowTotal.toFixed(2)} EW)`;
            } else if (e.bundleSize) {
                rowTotal = e.qty * e.price;
                rowText = `${e.qty} x ${e.bundleSize} ${e.name} (${e.price.toFixed(2)} EW stack) (${rowTotal.toFixed(2)} EW)`;
            } else {
                rowTotal = e.qty * e.price;
                rowText = `${e.qty} x ${e.name} (${e.price.toFixed(2)} EW each) (${rowTotal.toFixed(2)} EW)`;
            }
            if (e.isBalance) { rowText = `Account Balance: ${rowTotal.toFixed(2)} EW`; if (e.isAccountBalancePinned) rowText += ' (auto)'; }
            total += rowTotal;
            if (e.isConverter) rowText += ' [Converted]';
            if (e.source === 'OCM') rowText += ' [OCM]';
            const colorClass = window.evaluateRowColorBuy(e);
            if (colorClass) li.classList.add(colorClass);
            if (curr && curr !== window.BASE_CURRENCY) rowText += ' ' + window.formatValue(rowTotal, curr, true);

            li.appendChild(document.createTextNode(rowText + ' '));
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'remove';
            removeBtn.textContent = '❌';
            removeBtn.onclick = () => {
                window.buyCart = (window.buyCart || []).filter(x => x !== e);
                window.renderBuyList();
                window.calculateNet && window.calculateNet();
            };
            li.appendChild(removeBtn);
            list.appendChild(li);
        });

        // Buy Total: should use BUY rate (was SELL rate). CEIL; show "Excess EW" if >= 0.01
        const currencyItem = getCurrencyItem_(curr);
        const ratePerEachEw = getRatePerEachEw_(currencyItem, 'BUY');
        document.getElementById('buyTotal').textContent = formatEwWithDisplayCurrencyBreakdown_(total, curr, {
            ratePerEachEw,
            roundMode: 'CEIL'
        });

        window.calculateNet && window.calculateNet();
        window.updateInfraCartPreview && window.updateInfraCartPreview();
    };

    window.renderSellList = window.renderSellList || function renderSellList() {
        const list = document.getElementById('sellList'); list.innerHTML = '';
        let total = 0; const curr = document.getElementById('currencySelect').value;
        (window.sellCart || []).slice().forEach(e => {
            if (e.isAccountBalancePinned) return;
            const li = document.createElement('li');
            let rowTotal = 0, rowText = '';
            if (e.bundleSize && e.isFullyCustom) {
                rowTotal = (e.qty / e.bundleSize) * e.price;
                rowText = `${e.qty} x ${e.name} (${e.price.toFixed(2)} EW per ${e.bundleSize}) (${rowTotal.toFixed(2)} EW)`;
            } else if (e.bundleSize) {
                rowTotal = e.qty * e.price;
                rowText = `${e.qty} x ${e.bundleSize} ${e.name} (${e.price.toFixed(2)} EW stack) (${rowTotal.toFixed(2)} EW)`;
            } else {
                rowTotal = e.qty * e.price;
                rowText = `${e.qty} x ${e.name} (${e.price.toFixed(2)} EW each) (${rowTotal.toFixed(2)} EW)`;
            }
            if (e.isBalance && !e.isAccountBalancePinned) { rowText = `Account Balance (manual): ${rowTotal.toFixed(2)} EW`; }
            total += rowTotal;
            if (e.isPayWith) rowText += ' [Pay With]';
            if (e.source === 'OCM') rowText += ' [OCM]';
            const colorClass = window.evaluateRowColorSell(e);
            if (colorClass) {
                li.classList.add(colorClass);
                if (colorClass === 'row-warning-red') {
                    const warn = document.createElement('span');
                    warn.className = 'small-note';
                    warn.textContent = 'over target stock';
                    li.appendChild(warn);
                }
            }
            if (curr && curr !== window.BASE_CURRENCY) rowText += ' ' + window.formatValue(rowTotal, curr, false);

            li.appendChild(document.createTextNode(rowText + ' '));
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'remove';
            removeBtn.textContent = '❌';
            removeBtn.onclick = () => {
                window.sellCart = (window.sellCart || []).filter(x => x !== e);
                window.renderSellList();
                window.calculateNet && window.calculateNet();
            };
            li.appendChild(removeBtn);
            list.appendChild(li);
        });

        // Sell Total: should use SELL rate (was BUY rate). CEIL; show "Excess EW" if >= 0.01
        const currencyItem = getCurrencyItem_(curr);
        const ratePerEachEw = getRatePerEachEw_(currencyItem, 'SELL');
        document.getElementById('sellTotal').textContent = formatEwWithDisplayCurrencyBreakdown_(total, curr, {
            ratePerEachEw,
            roundMode: 'CEIL'
        });

        window.calculateNet && window.calculateNet();
    };

    /* ===== Net calculation & combined totals ===== */
    window.calculateNet = window.calculateNet || function calculateNet() {
        const buyTotalRaw = (window.buyCart || []).reduce((sum, e) => {
            // balance rows have qty=1, price=balance
            let rowTotal;
            if (e.isBalance) rowTotal = (Number(e.price) || 0) * (Number(e.qty) || 1);
            else if (e.bundleSize && e.isFullyCustom) rowTotal = (Number(e.qty || 0) / Number(e.bundleSize || 1)) * Number(e.price || 0);
            else rowTotal = (Number(e.qty) || 0) * (Number(e.price) || 0);
            return sum + (isFinite(rowTotal) ? rowTotal : 0);
        }, 0);

        const sellTotalRaw = (window.sellCart || []).reduce((sum, e) => {
            if (e.isAccountBalancePinned) return sum;
            let rowTotal;
            if (e.isBalance) rowTotal = (Number(e.price) || 0) * (Number(e.qty) || 1);
            else if (e.bundleSize && e.isFullyCustom) rowTotal = (Number(e.qty || 0) / Number(e.bundleSize || 1)) * Number(e.price || 0);
            else rowTotal = (Number(e.qty) || 0) * (Number(e.price) || 0);
            return sum + (isFinite(rowTotal) ? rowTotal : 0);
        }, 0);

        const net = sellTotalRaw - buyTotalRaw;
        const netSpan = document.getElementById('netTotal');
        if (netSpan) netSpan.dataset.raw = String(net);
        window.updateCombinedTotals && window.updateCombinedTotals();
    };

    window.updateCombinedTotals = window.updateCombinedTotals || function updateCombinedTotals() {
        const curr = document.getElementById('currencySelect')?.value || window.BASE_CURRENCY;
        const netSpan = document.getElementById('netTotal');
        const netRaw = parseFloat(netSpan?.dataset?.raw ?? '0') || 0;

        const currencyItem = getCurrencyItem_(curr);
        const rateBuy = getRatePerEachEw_(currencyItem, 'BUY');
        const rateSell = getRatePerEachEw_(currencyItem, 'SELL');

        const abEl = document.getElementById('accountBalanceCurrent');
        if (abEl) {
            // Balance is always a "have" value, so keep its sign and use FLOOR.
            const rateForBalance = rateSell || rateBuy;
            let balText = formatEwWithDisplayCurrencyBreakdown_(window.currentBalanceBT || 0, curr, {
                ratePerEachEw: rateForBalance,
                roundMode: 'FLOOR'
            });
            if (window.submitForUser?.playerName) {
                balText += ` (${window.submitForUser.playerName})`;
            }
            abEl.textContent = balText;
        }

        if (netSpan) {
            if (netRaw >= 0) {
                // Positive net => you receive value; use "Buy Total" style (SELL rate), FLOOR.
                netSpan.textContent = formatEwWithDisplayCurrencyBreakdown_(netRaw, curr, {
                    ratePerEachEw: rateSell,
                    roundMode: 'FLOOR'
                });
                netSpan.className = 'positive';
            } else {
                // Negative net => debt; show required payment as a positive amount
                // and convert using the same rules as "Sell Total" (BUY rate; CEIL).
                const debtEw = (-netRaw);
                netSpan.textContent = formatEwWithDisplayCurrencyBreakdown_(debtEw, curr, {
                    ratePerEachEw: rateBuy,
                    roundMode: 'CEIL'
                });
                netSpan.className = 'negative';
            }
        }

        const after = (Number(window.currentBalanceBT) || 0) + netRaw;
        const afterEl = document.getElementById('accountBalanceAfter');
        if (afterEl) {
            afterEl.dataset.raw = String(after);

            if (after >= 0) {
                afterEl.textContent = formatEwWithDisplayCurrencyBreakdown_(after, curr, {
                    ratePerEachEw: rateSell,
                    roundMode: 'FLOOR'
                });
                afterEl.className = 'positive';
            } else {
                // If "after" is negative, show how much is needed to get back to 0 (payoff amount).
                const neededEw = (-after);
                afterEl.textContent = formatEwWithDisplayCurrencyBreakdown_(neededEw, curr, {
                    ratePerEachEw: rateBuy,
                    roundMode: 'CEIL'
                });
                afterEl.className = 'negative';
            }
        }
    };

})();
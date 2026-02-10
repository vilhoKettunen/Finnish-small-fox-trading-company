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
        if (!ql) return dd.slice(0, 200);
        return dd.filter(d => String(d.name || '').toLowerCase().includes(ql)).slice(0, 200);
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
        return isNaN(fallback) ? 0 : fallback;
    }

    function getAfterBalanceRaw() {
        // ensure totals are up to date
        try { window.calculateNet && window.calculateNet(); } catch { }
        try { window.updateCombinedTotals && window.updateCombinedTotals(); } catch { }
        const afterEl = document.getElementById('accountBalanceAfter');
        const raw = Number(afterEl?.dataset?.raw);
        if (!isNaN(raw)) return raw;
        const fallback = parseFloat(String(afterEl?.textContent || '0').replace(/[^\d.-]/g, ''));
        return isNaN(fallback) ? 0 : fallback;
    }

    function getResultMode_(selectId) {
        const v = String(document.getElementById(selectId)?.value || 'NET').toUpperCase();
        return (v === 'ACCOUNT') ? 'ACCOUNT' : 'NET';
    }

    function setMsg_(id, txt) {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = String(txt || '');
    }

    function round2_(n) {
        const v = Number(n);
        if (!isFinite(v)) return 0;
        return Math.round(v * 100) / 100;
    }

    function getRows_(hostId) {
        return Array.from(document.querySelectorAll(`#${hostId} .payRow`));
    }

    function getPercentInput_(row) {
        return row?.querySelector('input[type="number"]') || null;
    }

    function applyPresetToRows_(rows, preset) {
        if (!rows.length) return { ok: false, msg: 'No rows.' };

        if (preset === 'DEFAULT_100') {
            rows.forEach(r => {
                const p = getPercentInput_(r);
                if (p) p.value = 100;
            });
            return { ok: true, msg: 'Applied: Default100%.' };
        }

        if (preset === 'EQUALIZER') {
            const n = rows.length;
            if (n <= 0) return { ok: false, msg: 'No rows.' };

            const per = round2_(100 / n);
            // Distribute evenly; adjust last to force sum=100 (2 decimals)
            let sum = 0;
            rows.forEach((r, idx) => {
                const p = getPercentInput_(r);
                if (!p) return;
                if (idx < n - 1) {
                    p.value = per;
                    sum += per;
                } else {
                    const last = round2_(100 - sum);
                    p.value = last;
                }
            });
            return { ok: true, msg: `Applied: Equalizer across ${n} rows.` };
        }

        return { ok: false, msg: 'Unknown preset.' };
    }

    // Exposed: called by index.html Apply buttons
    window.applyPayWithPreset = function applyPayWithPreset() {
        const preset = String(document.getElementById('payWithPercentPreset')?.value || 'DEFAULT_100').toUpperCase();
        const rows = getRows_('payOptions');
        const r = applyPresetToRows_(rows, preset);
        setMsg_('payWithPresetMsg', r.msg);
    };

    window.applyConverterPreset = function applyConverterPreset() {
        const preset = String(document.getElementById('converterPercentPreset')?.value || 'DEFAULT_100').toUpperCase();
        const rows = getRows_('converterOptions');
        const r = applyPresetToRows_(rows, preset);
        setMsg_('converterPresetMsg', r.msg);
    };

    // payListMap keeps metadata for each generated payId so we can update the li text
    const payListMap = {};

    // Build per-row DOM to match the old page (dropdown-wrap + dropdown-list)
    window.addPayRow = function addPayRow() {
        ensureCartGlobals();

        const host = document.getElementById('payOptions');
        if (!host) return;

        const div = document.createElement('div');
        div.className = 'payRow';

        const unique = 'paySelect_' + Date.now() + '_' + Math.floor(Math.random() * 10000);

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
        percent.value = 100;
        percent.min = 0;
        percent.max = 100;
        percent.placeholder = '%';

        const removeRowBtn = document.createElement('button');
        removeRowBtn.type = 'button';
        removeRowBtn.textContent = '❌';
        removeRowBtn.onclick = () => {
            div.remove();
            window.calculatePayment && window.calculatePayment();
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

    function updatePayLiText_(meta) {
        if (!meta || !meta.li) return;
        const sEntry = meta.entries.find(en => en.type === 'stack');
        const iEntry = meta.entries.find(en => en.type === 'indiv');
        const pct = meta.percent;
        const parts = [];
        if (sEntry) parts.push(`${sEntry.ref.qty} x ${sEntry.ref.bundleSize || meta.item.bundleSize} ${meta.item.name} (${sEntry.ref.price.toFixed(2)} BT stack)`);
        if (iEntry) parts.push(`${iEntry.ref.qty} x ${meta.item.name} (${iEntry.ref.price.toFixed(2)} BT each)`);
        const totalBT = (sEntry ? sEntry.ref.qty * sEntry.ref.price : 0) + (iEntry ? iEntry.ref.qty * iEntry.ref.price : 0);
        const newText = `${pct}% = ` + parts.join(' + ') + ` (${totalBT.toFixed(2)} BT)`;

        // Remove leading text nodes (keep remove button)
        while (meta.li.firstChild && meta.li.firstChild.nodeType === Node.TEXT_NODE) meta.li.removeChild(meta.li.firstChild);
        meta.li.insertBefore(document.createTextNode(newText + ' '), meta.li.firstChild);
    }

    function pickCheapestIndivCandidate_(generated) {
        const candidates = [];
        generated.forEach(g => {
            const meta = payListMap[g.payId];
            if (!meta) return;
            const indivEntry = meta.entries.find(en => en.type === 'indiv');
            if (indivEntry) {
                candidates.push({ payId: g.payId, price: indivEntry.ref.price, entry: indivEntry, meta });
            } else if (g.indivPrice && g.indivPrice > 0) {
                candidates.push({ payId: g.payId, price: g.indivPrice, entry: null, meta });
            }
        });
        if (!candidates.length) return null;
        candidates.sort((a, b) => a.price - b.price);
        return candidates[0];
    }

    function getTargetMetric_(mode) {
        return (mode === 'ACCOUNT') ? getAfterBalanceRaw() : getNetRaw();
    }

    function computeOwedBT_(mode) {
        // How much value we need to add through Pay With.
        // NET: fix negative net: owed = -net
        // ACCOUNT: fix negative accountBalanceAfter: owed = -after
        const net = getNetRaw();
        const after = getAfterBalanceRaw();
        if (mode === 'ACCOUNT') return (after < 0) ? -after : 0;
        return (net < 0) ? -net : 0;
    }

    window.calculatePayment = function calculatePayment() {
        ensureCartGlobals();

        const mode = getResultMode_('payWithResultType');
        const payListEl = document.getElementById('payList');
        if (payListEl) payListEl.innerHTML = '';

        // Remove any previous pay-with-generated entries.
        window.sellCart = window.sellCart.filter(e => !e.isPayWith);
        for (const k in payListMap) delete payListMap[k];

        // Recompute baseline totals
        try { window.renderSellList && window.renderSellList(); } catch { }
        try { window.calculateNet && window.calculateNet(); } catch { }

        const t0 = getTargetMetric_(mode);
        if (t0 >= 0) {
            const paymentResult = document.getElementById('paymentResult');
            if (paymentResult) {
                const label = (mode === 'ACCOUNT') ? 'Account Balance After Transaction' : 'Net Balance';
                paymentResult.textContent = `✅ ${label} is ${t0.toFixed(2)} BT. No payment needed.`;
            }
            return;
        }

        const owed = computeOwedBT_(mode);
        let usedPercent = 0;

        const rows = document.querySelectorAll('#payOptions .payRow');
        const generated = []; // store objects { payId, item, stackPrice, indivPrice, entries }

        rows.forEach(row => {
            const inputEl = row.querySelector('input.dropdown-input');
            const percentEl = row.querySelector('input[type="number"]');
            const rawName = (inputEl?.value || '').trim();
            const percent = parseFloat(percentEl?.value) || 0;
            if (percent <= 0) return;

            // Allow empty item rows (equalizer may set % first)
            if (!rawName) return;

            const item = findPayItem(rawName);
            if (!item) return;

            usedPercent += percent;
            const portion = (percent / 100) * owed;

            // IMPORTANT: Payment uses BUY prices.
            const stackPrice = item.buyStack || (item.buyEach && item.bundleSize ? item.buyEach * item.bundleSize : 0);
            const indivPrice = item.buyEach || (item.buyStack && item.bundleSize ? item.buyStack / item.bundleSize : 0);
            if ((!stackPrice || stackPrice <= 0) && (!indivPrice || indivPrice <= 0)) return;

            let stacks = 0;
            let individuals = 0;
            let leftover = portion;

            if (stackPrice > 0) {
                stacks = Math.floor(portion / stackPrice);
                leftover -= stacks * stackPrice;
            }
            if (indivPrice > 0 && leftover > 0) {
                const addIndividuals = Math.floor(leftover / indivPrice);
                individuals += addIndividuals;
                leftover -= addIndividuals * indivPrice;
            }

            const payId = 'pay_' + Date.now() + '_' + Math.floor(Math.random() * 10000);

            const entries = [];
            if (stacks > 0) {
                const rowObj = { name: item.name, qty: stacks, price: stackPrice, bundleSize: item.bundleSize, isPayWith: true, _payId: payId };
                window.sellCart.push(rowObj);
                entries.push({ type: 'stack', ref: rowObj });
            }
            if (individuals > 0) {
                const rowObj = { name: item.name, qty: individuals, price: indivPrice, isPayWith: true, _payId: payId };
                window.sellCart.push(rowObj);
                entries.push({ type: 'indiv', ref: rowObj });
            }

            if (payListEl) {
                const li = document.createElement('li');
                li.dataset.payid = payId;
                li.dataset.percent = String(percent);

                const totalBT = (stacks * stackPrice) + (individuals * indivPrice);
                const parts = [];
                if (stacks > 0) parts.push(`${stacks} x ${item.bundleSize} ${item.name} (${stackPrice.toFixed(2)} BT stack)`);
                if (individuals > 0) parts.push(`${individuals} x ${item.name} (${indivPrice.toFixed(2)} BT each)`);
                li.textContent = `${percent}% = ${parts.join(' + ')} (${totalBT.toFixed(2)} BT)`;

                const removeBtn = document.createElement('button');
                removeBtn.textContent = '❌';
                removeBtn.onclick = () => {
                    window.sellCart = window.sellCart.filter(it => !(it.isPayWith && it._payId === payId));
                    li.remove();
                    try { window.renderSellList && window.renderSellList(); } catch { }
                    try { window.calculateNet && window.calculateNet(); } catch { }
                };
                li.appendChild(removeBtn);
                payListEl.appendChild(li);

                payListMap[payId] = { li, item, entries, percent };
            }

            generated.push({ payId, item, stackPrice, indivPrice, entries });
        });

        // Recompute totals now that we've added generated entries
        try { window.renderSellList && window.renderSellList(); } catch { }
        try { window.calculateNet && window.calculateNet(); } catch { }

        // Nudge loop: keep adding the cheapest individual until target metric >=0 or we hit bounds.
        const MAX_NUDGES = 50;
        for (let i = 0; i < MAX_NUDGES; i++) {
            const t = getTargetMetric_(mode);
            if (t >= 0) break;
            if (!generated.length) break;

            const chosen = pickCheapestIndivCandidate_(generated);
            if (!chosen) break;

            if (chosen.entry) {
                chosen.entry.ref.qty += 1;
            } else {
                const newEntry = { name: chosen.meta.item.name, qty: 1, price: chosen.price, isPayWith: true, _payId: chosen.payId };
                window.sellCart.push(newEntry);
                chosen.meta.entries.push({ type: 'indiv', ref: newEntry });
            }

            updatePayLiText_(chosen.meta);

            try { window.renderSellList && window.renderSellList(); } catch { }
            try { window.calculateNet && window.calculateNet(); } catch { }
        }

        const paymentResult = document.getElementById('paymentResult');
        if (paymentResult) {
            const t = getTargetMetric_(mode);
            const label = (mode === 'ACCOUNT') ? 'Account Balance After Transaction' : 'Net Balance';

            if (t < 0) {
                paymentResult.textContent = `⚠️ Payment did not fully cover the target. ${label}: ${t.toFixed(2)} BT.`;
            } else {
                const wanted = owed;
                paymentResult.textContent = usedPercent !== 100
                    ? `⚠️ Warning: payment percentages total ${usedPercent}%, not100%. Target: ${label} >=0.00.`
                    : `✅ Target reached (${label} >=0.00). Estimated covered: ${wanted.toFixed(2)} BT.`;
            }
        }
    };

    window.addConverterRow = function addConverterRow() {
        ensureCartGlobals();

        const host = document.getElementById('converterOptions');
        if (!host) return;

        const div = document.createElement('div');
        div.className = 'payRow';

        const unique = 'convSelect_' + Date.now() + '_' + Math.floor(Math.random() * 10000);

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
        percent.value = 100;
        percent.min = 0;
        percent.max = 100;
        percent.placeholder = '%';

        const removeRowBtn = document.createElement('button');
        removeRowBtn.type = 'button';
        removeRowBtn.textContent = '❌';
        removeRowBtn.onclick = () => {
            div.remove();
            window.calculateConversion && window.calculateConversion();
        };

        div.appendChild(wrap);
        div.appendChild(document.createTextNode(' % allocation: '));
        div.appendChild(percent);
        div.appendChild(removeRowBtn);
        host.appendChild(div);

        if (window.attachDropdownToElements) {
            window.attachDropdownToElements(input, list, filterDropdownData, () => { });
        } else if (window.attachSimpleItemDropdown) {
            window.attachSimpleItemDropdown(input, list);
        }
    };

    function getBalanceCurrentRaw_() {
        // accountBalanceCurrent renders with "0.00 BT" text; parse as float
        const el = document.getElementById('accountBalanceCurrent');
        const t = String(el?.textContent || '0');
        const n = parseFloat(t.replace(/[^\d.-]/g, ''));
        return isNaN(n) ? 0 : n;
    }

    function computeConvertBudgetBT_(mode) {
        // NET: budget is positive net
        // ACCOUNT: we want accountBalanceAfter >=0, i.e. (balance + netAfterConversion) >=0.
        // Conversion adds buys, decreasing net by convertedAmount => netAfter = net - convertedAmount.
        // So require: balance + (net - convertedAmount) >=0 => convertedAmount <= balance + net.
        // To get "near0", we try: convertedAmount = balance + net (clamped >=0).
        const net = getNetRaw();
        const bal = getBalanceCurrentRaw_();

        if (mode === 'ACCOUNT') {
            const maxSpend = bal + net;
            return maxSpend > 0 ? maxSpend : 0;
        }

        return net > 0 ? net : 0;
    }

    window.calculateConversion = function calculateConversion() {
        ensureCartGlobals();

        const mode = getResultMode_('converterResultType');

        const converterList = document.getElementById('converterListDisplay');
        if (converterList) converterList.innerHTML = '';

        // Remove previous converter-generated rows
        window.buyCart = window.buyCart.filter(e => !e.isConverter);

        // Ensure base totals are up to date before reading budget
        try { window.renderBuyList && window.renderBuyList(); } catch { }
        try { window.calculateNet && window.calculateNet(); } catch { }

        const netBT = getNetRaw();
        const budgetBT = computeConvertBudgetBT_(mode);

        if (mode === 'NET') {
            if (netBT <= 0) {
                const converterResult = document.getElementById('converterResult');
                if (converterResult) converterResult.textContent = '⚠️ Net Balance is not positive.';
                return;
            }
        } else {
            if (budgetBT <= 0) {
                const converterResult = document.getElementById('converterResult');
                if (converterResult) converterResult.textContent = '⚠️ Nothing to convert for Account Balance mode.';
                return;
            }
        }

        const rows = document.querySelectorAll('#converterOptions .payRow');
        let usedPercent = 0;

        rows.forEach(row => {
            const inputEl = row.querySelector('input.dropdown-input');
            const name = inputEl?.value.trim() || '';
            const percent = parseFloat(row.querySelector('input[type="number"]')?.value) || 0;

            // Allow percent presets before selecting item
            if (!name || percent <= 0) return;

            const item = (window.items || []).find(i => i.name === name);
            if (!item) return;

            usedPercent += percent;
            const portion = (percent / 100) * budgetBT;

            // IMPORTANT: Converter uses SELL prices.
            const stackPrice = item.sellStack || (item.sellEach && item.bundleSize ? item.sellEach * item.bundleSize : 0);
            const indivPrice = item.sellEach || (item.sellStack && item.bundleSize ? item.sellStack / item.bundleSize : 0);
            if ((!stackPrice || stackPrice <= 0) && (!indivPrice || indivPrice <= 0)) return;

            let stacks = 0;
            let individuals = 0;
            let leftover = portion;

            if (stackPrice > 0) {
                stacks = Math.floor(portion / stackPrice);
                leftover -= stacks * stackPrice;
            }
            if (indivPrice > 0) {
                const addIndividuals = Math.floor(leftover / indivPrice);
                individuals += addIndividuals;
                leftover -= addIndividuals * indivPrice;
            }

            const rowId = 'conv_' + Date.now() + '_' + Math.floor(Math.random() * 10000);

            if (stacks > 0) {
                window.buyCart.push({ name: item.name, qty: stacks, price: stackPrice, bundleSize: item.bundleSize, isConverter: true, _rowId: rowId });
            }
            if (individuals > 0) {
                window.buyCart.push({ name: item.name, qty: individuals, price: indivPrice, isConverter: true, _rowId: rowId });
            }

            if (converterList) {
                const li = document.createElement('li');
                let txt = `${percent}% = `;
                if (stacks > 0) txt += `${stacks} stack(s) × ${item.bundleSize} ${item.name} (${stackPrice.toFixed(2)} BT stack)`;
                if (individuals > 0) {
                    if (stacks > 0) txt += ' + ';
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
        try { window.calculateNet && window.calculateNet(); } catch { }

        // If Account mode and we overspent such that accountBalanceAfter <0, back off by removing cheapest indiv
        if (mode === 'ACCOUNT') {
            const MAX_BACKOFF = 200;
            for (let i = 0; i < MAX_BACKOFF; i++) {
                const after = getAfterBalanceRaw();
                if (after >= 0) break;

                // find cheapest individual converter item to remove one unit
                let best = null; // { idx, entry, pricePerUnit }
                for (let j = 0; j < window.buyCart.length; j++) {
                    const e = window.buyCart[j];
                    if (!e || !e.isConverter) continue;
                    const price = Number(e.price || 0);
                    if (!isFinite(price) || price <= 0) continue;
                    // Treat this row as per-unit price (it is already stack or each). Prefer smallest price.
                    if (!best || price < best.price) best = { idx: j, entry: e, price };
                }
                if (!best) break;

                // reduce qty by1; if hits0 remove row
                best.entry.qty = Number(best.entry.qty || 0) - 1;
                if (best.entry.qty <= 0) {
                    window.buyCart.splice(best.idx, 1);
                }

                try { window.renderBuyList && window.renderBuyList(); } catch { }
                try { window.calculateNet && window.calculateNet(); } catch { }
            }
        }

        const converterResult = document.getElementById('converterResult');
        if (converterResult) {
            const label = (mode === 'ACCOUNT') ? 'Account Balance After Transaction' : 'Net Balance';
            const t = (mode === 'ACCOUNT') ? getAfterBalanceRaw() : getNetRaw();

            converterResult.textContent = usedPercent === 0
                ? '⚠️ No allocations set.'
                : `✅ Conversion done. Target: ${label} >=0.00. Current: ${t.toFixed(2)} BT.`;
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
                window.attachDropdownToElements(input, list, filterDropdownData, () => { });
            }
        });

        const convRows = document.querySelectorAll('#converterOptions .payRow');
        convRows.forEach(row => {
            const input = row.querySelector('input.dropdown-input');
            const list = row.querySelector('.dropdown-list');
            if (input && list && window.attachDropdownToElements) {
                window.attachDropdownToElements(input, list, filterDropdownData, () => { });
            }
        });
    };

    // Ensure simple global wrapper names and default rows exist
    (function ensureGlobalsAndDefaults() {
        const implPay = window.addPayRow;
        const implConv = window.addConverterRow;

        // Create wrappers that call the internal implementations (if present)
        window.addPayRow = function () { return implPay ? implPay() : undefined; };
        window.addConverterRow = function () { return implConv ? implConv() : undefined; };

        // Ensure there is at least one slot for each tool after DOM ready
        
        document.addEventListener('DOMContentLoaded', () => {
            try {
                if (document.getElementById('payOptions') && !document.querySelector('#payOptions .payRow')) {
                    window.addPayRow();
                }
                if (document.getElementById('converterOptions') && !document.querySelector('#converterOptions .payRow')) {
                    window.addConverterRow();
                }
            } catch { }
        });
        
    })();
})();
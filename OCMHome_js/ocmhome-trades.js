// Listing loading + trade details + pending trades for OCMHome
(function () {
 'use strict';

 const O = window.OCMHome;
 const S = O.state;
 const byId = O.byId;
 const fmt2 = O.fmt2;

 async function fetchListingsOnceOrRefresh(opts) {
 const force = !!(opts && opts.force);
 if (!S.googleIdToken) {
 byId('msgTop').textContent = 'Login required to load listings.';
 // keep table empty when logged out
 if (O.clearListingsUi_) O.clearListingsUi_();
 return;
 }

 if (!force && S.listingsCache && Array.isArray(S.listingsCache.sell) && Array.isArray(S.listingsCache.buy) && S.listingsCache.fetchedAt) {
 O.applyFiltersAndRender && O.applyFiltersAndRender();
 return;
 }

 byId('msgTop').textContent = 'Loading listings...';
 try {
 const r = await apiGet('ocmListPublicListings', { q: '' });
 const d = r.data || r.result || r;

 S.listingsCache.sell = d.sell || [];
 S.listingsCache.buy = d.buy || [];
 S.listingsCache.fetchedAt = new Date().toISOString();

 byId('msgTop').textContent = `Loaded ${S.listingsCache.sell.length} sell, ${S.listingsCache.buy.length} buy.`;
 O.applyFiltersAndRender && O.applyFiltersAndRender();
 } catch (e) {
 byId('msgTop').textContent = 'Error: ' + (e.message || e);
 }
 }

 function getPrimaryPeg_(listing) {
 const p = listing?.pricing || {};
 if (p.primaryPeg && p.primaryPeg.itemName) return p.primaryPeg;
 if (p.pegItemName) return { itemName: p.pegItemName, pegQtyPerInd: p.pegQtyPerUnit, ui: { priceBasis: p.pricingBasis || 'IND' } };
 return null;
 }

 function getPrimaryPegBasis_(listing) {
 const p = listing?.pricing || {};
 const basis = p.primaryPeg?.ui?.priceBasis || p.pricingBasis || 'IND';
 return String(basis).toUpperCase();
 }

 function computeUnits_(td, listing) {
 const qtyMode = td.querySelector(`input[name="qtym_${listing.listingId}"]:checked`)?.value || 'IND';
 const qtyInput = td.querySelector('input[data-qty]');
 const qtyVal = Number(qtyInput?.value ||0);
 if (!qtyVal || qtyVal <=0) return null;
 const units = (qtyMode === 'STACK') ? (qtyVal * (Number(listing.stackSize ||1) ||1)) : qtyVal;
 return { qtyMode, qtyVal, units: Math.ceil(units -1e-12) };
 }

 function computeEstimate_(listing, u, paymentChoice, payPegName, primaryPeg, altPegs) {
 const listingSide = (listing.type === 'BUY') ? 'BUY' : 'SELL';

 // Store value of traded item (if it exists in catalog)
 const tradedItemPerUnit = O.perIndPriceFromCatalog_(listing.itemName, listingSide);
 const tradedBT = (tradedItemPerUnit != null) ? (u.units * tradedItemPerUnit) : null;

 const primaryName = primaryPeg?.itemName || listing.pricing?.pegItemName || null;
 const primaryRatio = Number(primaryPeg?.pegQtyPerInd ?? listing.pricing?.pegQtyPerUnit ??0);
 const primarySide = listingSide;
 const primaryEach = (primaryName && primaryRatio) ? O.perIndPriceFromCatalog_(primaryName, primarySide) : null;
 const canonicalBT = (primaryEach != null && primaryRatio) ? (u.units * primaryRatio * primaryEach) : null;

 if (paymentChoice === 'ITEM') {
 const selName = payPegName || primaryName;
 const selPeg = (selName && primaryName && String(selName).toLowerCase() === String(primaryName).toLowerCase())
 ? primaryPeg
 : (altPegs || []).find(x => x && x.itemName && String(x.itemName).toLowerCase() === String(selName || '').toLowerCase()) || null;

 const selRatio = Number(selPeg?.pegQtyPerInd ??0);
 const payItems = Math.ceil((selRatio * u.units) -1e-12);

 const selEach = selName ? O.perIndPriceFromCatalog_(selName, primarySide) : null;
 const selBT = (selEach != null && selRatio) ? (u.units * selRatio * selEach) : null;

 return {
 units: u.units,
 paymentChoice: 'ITEM',
 payPegName: selName,
 payItems,
 tradedBT,
 canonicalBT,
 selectedPegBT: selBT,
 selectedPegQty: selRatio * u.units
 };
 }

 return { units: u.units, paymentChoice: 'BT', tradedBT, canonicalBT };
 }

 function computeValueLinesForTrade_(listing, u, selectedPegName, selectedPegRatio) {
 const listingName = String(listing?.itemName || '').trim();
 const pegName = String(selectedPegName || '').trim();
 if (!listingName || !pegName) return { buy: 'BUY: �', sell: 'SELL: �' };

 const leftQty = u.units;
 const rightQty = Math.ceil((Number(selectedPegRatio ||0) * u.units) -1e-12);

 function perInd(name, side) {
 const it = O.findCatalogItem(name);
 if (!it) return null;
 const each = O.getStoreEachPrice_(it, side);
 if (each != null) return each;
 const stk = O.getStoreStackPrice_(it, side);
 const bs = Number(it.bundleSize ||1) ||1;
 if (stk != null) return stk / bs;
 return null;
 }

 const soldBuy = perInd(listingName, 'BUY');
 const soldSell = perInd(listingName, 'SELL');
 const pegBuy = perInd(pegName, 'BUY');
 const pegSell = perInd(pegName, 'SELL');

 const buy = (soldBuy != null && pegBuy != null)
 ? `BUY: ${fmt2(leftQty * soldBuy)} BT (${listingName}) | ${fmt2(rightQty * pegBuy)} BT (${pegName})`
 : 'BUY: �';

 const sell = (soldSell != null && pegSell != null)
 ? `SELL: ${fmt2(leftQty * soldSell)} BT (${listingName}) | ${fmt2(rightQty * pegSell)} BT (${pegName})`
 : 'SELL: �';

 return { buy, sell };
 }

 function toggleTradeDetails(mainRow, listing) {
 const nxt = mainRow.nextElementSibling;
 if (nxt && nxt.classList.contains('details-row')) { nxt.remove(); return; }

 const tb = mainRow.parentElement;
 Array.from(tb.querySelectorAll('tr.details-row')).forEach(r => r.remove());

 const detailsTr = document.createElement('tr');
 detailsTr.className = 'details-row';
 const td = document.createElement('td');
 td.colSpan =7;

 const p = listing.pricing || {};
 const supportsItem = !!p.supportsItemPayment;

 const primaryPeg = getPrimaryPeg_(listing);
 const altPegs = Array.isArray(p.altPegs) ? p.altPegs : [];
 const basis = getPrimaryPegBasis_(listing);

 const isBuyListing = String(listing.type || '').toUpperCase() === 'BUY';
 const verbMain = isBuyListing ? 'receive' : 'pay';
 const verbTitle = isBuyListing ? 'Receive in' : 'Pay with';

 const payPegSelect = (() => {
 if (!supportsItem || !primaryPeg || !primaryPeg.itemName) return '';

 const options = [];
 options.push({ name: primaryPeg.itemName, kind: 'PRIMARY' });
 altPegs.forEach(a => { if (a && a.itemName) options.push({ name: a.itemName, kind: 'ALT' }); });

 const seen = new Set();
 const uniq = [];
 options.forEach(o => {
 const k = String(o.name).trim().toLowerCase();
 if (!k || seen.has(k)) return;
 seen.add(k);
 uniq.push(o);
 });

 const items = uniq.map(o => {
 const it = O.findCatalogItem(o.name);
 const side = listing.type === 'BUY' ? 'BUY' : 'SELL';

 const each = O.getStoreEachPrice_(it, side);
 const stk = O.getStoreStackPrice_(it, side);
 const bs = Number(it?.bundleSize ||1) ||1;

 const labelParts = [];
 if (each != null) labelParts.push(`each:${fmt2(each)}`);
 if (stk != null) labelParts.push(`stk:${fmt2(stk)}`);
 const priceLabel = labelParts.length ? ` (${labelParts.join(', ')}, bs:${bs})` : '';

 const prefix = (o.kind === 'PRIMARY') ? 'Primary: ' : 'Alt: ';
 return `<option value="${O.escapeHtml_(o.name)}">${prefix}${O.escapeHtml_(o.name)}${O.escapeHtml_(priceLabel)}</option>`;
 }).join('');

 return `
 <div class="notice">
 <div class="small"><strong>Item payment peg</strong></div>
 <div class="small muted">Canonical BT and admin fee are based on the <strong>primary</strong> peg store price.</div>
 <div class="field" style="margin-top:6px;">
 <label>${verbTitle}
 <select data-pay-peg style="min-width:260px;">
 ${items}
 </select>
 </label>
 </div>
 </div>
 `;
 })();

 const payOptions = supportsItem
 ? `<label><input type="radio" name="pay_${listing.listingId}" value="ITEM"> Item payment</label>
 <label><input type="radio" name="pay_${listing.listingId}" value="BT" checked> BT payment</label>`
 : `<div class="small">This listing only supports BT payment.</div>
 <input type="hidden" name="pay_${listing.listingId}" value="BT">`;

 const stackOnly = (String(basis).toUpperCase() === 'STACK');
 const qtyModeHtml = stackOnly
 ? `<div class="field">
 <label><input type="radio" name="qtym_${listing.listingId}" value="STACK" checked> stack</label>
 <label>Amount <input type="number" min="1" value="1" style="width:90px" data-qty="1"></label>
 </div>
 <div class="small muted">This listing is stack-priced. You can only trade in stacks.</div>`
 : `<div class="field">
 <label><input type="radio" name="qtym_${listing.listingId}" value="IND" checked> individual</label>
 <label><input type="radio" name="qtym_${listing.listingId}" value="STACK"> stack</label>
 <label>Amount <input type="number" min="1" value="1" style="width:90px" data-qty="1"></label>
 </div>`;

 td.innerHTML = `
 <div class="details-box" role="group" aria-label="Trade options">
 <div class="details-grid">
 <div>
 <div class="small">Listing</div>
 <div><strong>${O.escapeHtml_(listing.itemName)}</strong> (${O.escapeHtml_(listing.type)})</div>
 <div class="small">Merchant: ${O.escapeHtml_(listing.playerName || 'Unknown')}</div>
 <div class="small muted">Stack size: <span class="mono">${Number(listing.stackSize ||1) ||1}</span></div>
 </div>

 <div>
 <div class="small">Payment method</div>
 <div class="field">${payOptions}</div>
 ${payPegSelect}
 </div>

 <div>
 <div class="small">Quantity</div>
 ${qtyModeHtml}
 </div>

 <div>
 <div class="small">Estimate</div>
 <div class="mono" data-estimate>�</div>
 <div class="small muted" data-value-lines>�</div>
 <div class="small" data-fee-note>Fee:0% if seller completes,10% if admin completes.</div>
 <div class="trade-favor" data-favor-customer style="display:none;"></div>
 <div class="trade-favor" data-favor-merchant style="display:none;"></div>
 </div>
 </div>

 <div class="toolbar" style="margin-top:10px;">
 <button type="button" data-calc>Calculate</button>
 <button type="button" data-send>Send transaction</button>
 <span class="small" data-msg></span>
 </div>
 </div>
 `;

 detailsTr.appendChild(td);
 mainRow.parentNode.insertBefore(detailsTr, mainRow.nextSibling);

 const qtyInput = td.querySelector('input[data-qty]');
 const calcBtn = td.querySelector('button[data-calc]');
 const sendBtn = td.querySelector('button[data-send]');
 const msgEl = td.querySelector('[data-msg]');
 const estEl = td.querySelector('[data-estimate]');
 const valueEl = td.querySelector('[data-value-lines]');
 const customerFavorEl = td.querySelector('[data-favor-customer]');
 const merchantFavorEl = td.querySelector('[data-favor-merchant]');
 const payPegSel = td.querySelector('select[data-pay-peg]');

        function getPaymentChoice() {
            const r = td.querySelector(`input[name="pay_${listing.listingId}"]:checked`);
            if (r) return r.value;
            const h = td.querySelector(`input[name="pay_${listing.listingId}"][type="hidden"]`);
            return h ? h.value : 'BT';
        }

        function getQtyMode() { return td.querySelector(`input[name="qtym_${listing.listingId}"]:checked`)?.value || 'IND'; }
        function getPayPegName() { return payPegSel ? (String(payPegSel.value || '').trim() || null) : null; }

        function showEstimate() {
            const qtyMode = getQtyMode();
            const u = computeUnits_(td, listing);
            if (!u) {
                estEl.textContent = '—';
                valueEl.textContent = '—';
                if (customerFavorEl) customerFavorEl.style.display = 'none';
                if (merchantFavorEl) merchantFavorEl.style.display = 'none';
                return;
            }

            const paymentChoice = getPaymentChoice();
            const payPegName = getPayPegName();

            // Enforce stack-only listings
            if (stackOnly && qtyMode !== 'STACK') {
                estEl.textContent = 'This listing is stack-priced. Choose stack quantity.';
                valueEl.textContent = '—';
                if (customerFavorEl) customerFavorEl.style.display = 'none';
                if (merchantFavorEl) merchantFavorEl.style.display = 'none';
                return;
            }

            const est = computeEstimate_(listing, u, paymentChoice, payPegName, primaryPeg, altPegs);
            if (!est) {
                estEl.textContent = '—';
                valueEl.textContent = '—';
                if (customerFavorEl) customerFavorEl.style.display = 'none';
                if (merchantFavorEl) merchantFavorEl.style.display = 'none';
                return;
            }

            const parts = [];

            if (est.paymentChoice === 'ITEM') {
                // Render stk/ind breakdown for payment item using catalog bundle size (if available)
                let payQtyLabel = `~${est.payItems}`;
                try {
                    const payName = String(est.payPegName || '').trim();
                    const it = payName ? O.findCatalogItem(payName) : null;
                    const bs = Number(it?.bundleSize || 1) || 1;
                    const n = Math.max(0, Math.round(Number(est.payItems || 0) || 0));
                    if (bs > 1 && n > 0) {
                        const stk = Math.floor(n / bs);
                        const ind = n % bs;
                        const partsQty = [];
                        if (stk > 0) partsQty.push(`${stk} stk`);
                        if (ind > 0) partsQty.push(`${ind} ind`);
                        if (partsQty.length) payQtyLabel = partsQty.join(' + ');
                        else payQtyLabel = `${n} ind`;
                    } else if (n > 0) {
                        payQtyLabel = `${n} ind`;
                    }
                } catch { /* ignore */ }

                parts.push(`You ${verbMain} ${payQtyLabel} ${est.payPegName} (rounded up).`);
                if (est.canonicalBT != null) parts.push(`Canonical BT (primary-based): ${fmt2(est.canonicalBT)} BT.`);
                if (est.selectedPegBT != null) parts.push(`BT eq (selected-peg store price): ${fmt2(est.selectedPegBT)} BT.`);
                if (est.tradedBT != null) parts.push(`Traded item store BT: ${fmt2(est.tradedBT)} BT.`);
            } else {
                if (est.canonicalBT != null) parts.push(`You ${verbMain} ${fmt2(est.canonicalBT)} BT (primary-based).`);
                if (est.tradedBT != null) parts.push(`Traded item store BT: ${fmt2(est.tradedBT)} BT.`);
            }

            estEl.textContent = parts.join(' ');

            // Value comparison lines are based on the "chosen peg" (for item payment we use selected peg; for BT it's still useful).
            const chosenPegName = (paymentChoice === 'ITEM') ? (est.payPegName || primaryPeg?.itemName) : (primaryPeg?.itemName || '');
            const chosenRatio = (paymentChoice === 'ITEM')
                ? Number((paymentChoice === 'ITEM' && chosenPegName && String(chosenPegName).toLowerCase() === String(primaryPeg?.itemName || '').toLowerCase())
                    ? (primaryPeg?.pegQtyPerInd ?? 0)
                    : ((altPegs || []).find(a => String(a?.itemName || '').toLowerCase() === String(chosenPegName || '').toLowerCase())?.pegQtyPerInd ?? 0))
                : Number(primaryPeg?.pegQtyPerInd ?? 0);

            const v = computeValueLinesForTrade_(listing, u, chosenPegName, chosenRatio);
            valueEl.innerHTML = `${O.escapeHtml_(v.buy)}<br>${O.escapeHtml_(v.sell)}`;

            // ===== Customer favor / Merchant favor =====
            // Totals match the value lines shown.
            // SELL listings: keep existing behavior.
            // BUY listings: use new rules:
            // - Customer:
            // * ITEM: (1 - traded BUY total / peg SELL total)*100
            // * BT: (1 - traded BUY total / peg BUY total)*100
            // - Merchant (both): (1 - peg BUY total / traded SELL total)*100
            try {
                const listingName = String(listing?.itemName || '').trim();
                const pegName = String(chosenPegName || '').trim();

                // Quantities (must match computeValueLinesForTrade_)
                const leftQty = u.units;
                const rightQty = Math.ceil((Number(chosenRatio || 0) * u.units) - 1e-12);

                function perInd(name, side) {
                    const it = O.findCatalogItem(name);
                    if (!it) return null;
                    const each = O.getStoreEachPrice_(it, side);
                    if (each != null) return each;
                    const stk = O.getStoreStackPrice_(it, side);
                    const bs = Number(it.bundleSize || 1) || 1;
                    if (stk != null) return stk / bs;
                    return null;
                }

                const tradedBuyPer = listingName ? perInd(listingName, 'BUY') : null;
                const tradedSellPer = listingName ? perInd(listingName, 'SELL') : null;
                const pegBuyPer = pegName ? perInd(pegName, 'BUY') : null;
                const pegSellPer = pegName ? perInd(pegName, 'SELL') : null;

                const tradedBuyTotal = (tradedBuyPer != null) ? (leftQty * tradedBuyPer) : null;
                const tradedSellTotal = (tradedSellPer != null) ? (leftQty * tradedSellPer) : null;
                const pegBuyTotal = (pegBuyPer != null) ? (rightQty * pegBuyPer) : null;
                const pegSellTotal = (pegSellPer != null) ? (rightQty * pegSellPer) : null;

                const listingType = String(listing?.type || '').toUpperCase();

                let customerPct = null;
                let merchantPct = null;

                if (listingType === 'BUY') {
                    // BUY rules
                    const denomCustomer = (paymentChoice === 'ITEM') ? pegSellTotal : pegBuyTotal;

                    if (tradedBuyTotal != null && denomCustomer != null && isFinite(tradedBuyTotal) && isFinite(denomCustomer) && denomCustomer > 0) {
                        customerPct = (1 - (Number(tradedBuyTotal) / Number(denomCustomer))) * 100;
                    }

                    if (pegBuyTotal != null && tradedSellTotal != null && isFinite(pegBuyTotal) && isFinite(tradedSellTotal) && tradedSellTotal > 0) {
                        merchantPct = (1 - (Number(pegBuyTotal) / Number(tradedSellTotal))) * 100;
                    }
                } else {
                    // SELL rules (keep existing behavior)
                    const customerNumerator = (paymentChoice === 'ITEM') ? pegBuyTotal : pegSellTotal;
                    if (tradedSellTotal != null && customerNumerator != null && isFinite(tradedSellTotal) && tradedSellTotal > 0 && isFinite(customerNumerator)) {
                        customerPct = (1 - (Number(customerNumerator) / Number(tradedSellTotal))) * 100;
                    }

                    if (tradedBuyTotal != null && pegSellTotal != null && isFinite(tradedBuyTotal) && tradedBuyTotal > 0 && isFinite(pegSellTotal)) {
                        merchantPct = (1 - (Number(tradedBuyTotal) / Number(pegSellTotal))) * 100;
                    }
                }

                function renderFavorLine_(el, who, pct) {
                    if (!el || pct == null || !isFinite(pct)) { if (el) el.style.display = 'none'; return; }
                    const good = pct >= 0;
                    const label = good ? `${who} favor` : `${who} disfavor`;
                    const word = good ? 'cheaper' : 'more expensive';
                    const magTxt = Math.abs(pct).toFixed(1);

                    el.classList.remove('good', 'bad');
                    el.classList.add(good ? 'good' : 'bad');
                    el.textContent = `${label}: ${magTxt}% ${word} compared to store`;
                    el.style.display = '';
                }

                renderFavorLine_(customerFavorEl, 'Customer', customerPct);
                renderFavorLine_(merchantFavorEl, 'Merchant', merchantPct);
            } catch {
                if (customerFavorEl) customerFavorEl.style.display = 'none';
                if (merchantFavorEl) merchantFavorEl.style.display = 'none';
            }
        }

        calcBtn.addEventListener('click', () => {
            msgEl.textContent = '';
            showEstimate();
        });

        qtyInput?.addEventListener('input', showEstimate);
        td.querySelectorAll(`input[name="qtym_${listing.listingId}"]`).forEach(r => r.addEventListener('change', showEstimate));
        td.querySelectorAll(`input[name="pay_${listing.listingId}"]`).forEach(r => r.addEventListener('change', showEstimate));
        payPegSel?.addEventListener('change', showEstimate);

        sendBtn.addEventListener('click', async () => {
            msgEl.textContent = '';
            if (!S.googleIdToken) { msgEl.textContent = 'Login required.'; return; }
            const u = computeUnits_(td, listing);
            if (!u) { msgEl.textContent = 'Invalid quantity.'; return; }

            if (stackOnly && getQtyMode() !== 'STACK') {
                msgEl.textContent = 'This listing is stack-priced. Choose stack quantity.';
                return;
            }

            msgEl.textContent = 'Sending...';
            try {
                const paymentChoice = getPaymentChoice();
                const payPegName = (paymentChoice === 'ITEM') ? getPayPegName() : null;

                const payload = {
                    idToken: S.googleIdToken,
                    listingId: listing.listingId,
                    qtyMode: (u.qtyMode === 'STACK') ? 'STACK' : 'IND',
                    qty: u.qtyVal,
                    paymentChoice
                };
                if (paymentChoice === 'ITEM' && payPegName) payload.paymentPegName = payPegName;

                const r = await apiPost('ocmCreateTradeRequestV2', payload);
                const d = r.data || r.result || r;
                msgEl.textContent = 'Sent. TradeId: ' + (d.tradeId || '');
                await loadMyPending();
            } catch (e) {
                msgEl.textContent = 'Error: ' + (e.message || e);
            }
        });

        // initial
        showEstimate();
    }

    async function loadMyPending() {
        if (!S.googleIdToken) {
            byId('tbMyPending').innerHTML = '';
            byId('msgPending').textContent = 'Login required.';
            return;
        }

        byId('msgPending').textContent = 'Loading...';
        try {
            const r = await apiGet('ocmMyPendingTradesV2', { idToken: S.googleIdToken });
            const d = r.data || r.result || r;
            renderMyPending(d.trades || []);
            byId('msgPending').textContent = `Loaded ${(d.trades || []).length}.`;
        } catch (e) {
            byId('msgPending').textContent = 'Error: ' + e.message;
        }
    }

    function extractTradeSummary(tr) {
        const snap = O.safeJsonParse(tr.detailsJson || '{}') || {};
        const item = snap.listing?.itemName || '';
        const who = snap.seller?.playerName || '';
        const payment = snap.payment?.method || '';
        const units = Number(snap.request?.requestedUnits || tr.quantity || 0);

        const totalBT = Number(
            snap.payment?.canonicalBT
            ?? snap.payment?.payTotalBT
            ?? snap.pricing?.tradeValueBT
            ?? 0
        );

        const payItem = snap.payment?.payItemName ? `${snap.payment.payItemQty} ${snap.payment.payItemName}` : '';
        const payInfo = (payment === 'ITEM') ? `ITEM (${payItem})` : payment;

        return { snap, item, who, payment: payInfo, units, totalBT };
    }

    function renderMyPending(arr) {
        const tb = byId('tbMyPending');
        tb.innerHTML = '';

        (arr || []).forEach(tr => {
            const { item, who, payment, units, totalBT } = extractTradeSummary(tr);

            const row = document.createElement('tr');
            row.innerHTML = `
 <td class="mono">${tr.tradeId}</td>
 <td>${O.escapeHtml_(item)}</td>
 <td>${O.escapeHtml_(who)}</td>
 <td class="mono">${units}</td>
 <td class="mono">${O.escapeHtml_(payment)}</td>
 <td class="mono">${fmt2(totalBT)} BT</td>
 <td class="mono">${O.escapeHtml_(tr.status || '')}</td>
 <td><button type="button" data-edit="1">Edit</button> <button type="button" data-cancel="1">Cancel</button></td>
 `;

            row.querySelector('button[data-cancel]')?.addEventListener('click', async () => {
                if (!confirm('Cancel trade ' + tr.tradeId + '?')) return;
                try {
                    await apiPost('ocmCancelTradeRequestV2', { idToken: S.googleIdToken, tradeId: tr.tradeId });
                    await loadMyPending();
                } catch (e) { alert(e.message); }
            });

            tb.appendChild(row);
        });
    }

    O.fetchListingsOnceOrRefresh = fetchListingsOnceOrRefresh;
    O.loadListings = function loadListingsCompat() { return fetchListingsOnceOrRefresh({ force:false }); };
    O.toggleTradeDetails = toggleTradeDetails;
    O.loadMyPending = loadMyPending;
})();

// Shared “More info” trade summary renderer (Admin + OCMUser)
// Provides the exact layout/wording used in OCMUser Pending requests.

(function () {
    'use strict';

    const esc = (s) => String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    function safeJsonParse(s, fallback = null) {
        try { return JSON.parse(s); } catch { return fallback; }
    }

    function sanitizeItemName(name) {
        if (name == null) return '';
        try {
            return String(name)
                .replace(/\uFFFD/g, '')
                .replace(/\s+/g, ' ')
                .trim();
        } catch {
            return String(name || '').trim();
        }
    }

    function normQty(units, stackSize) {
        const u = Number(units || 0);
        if (!isFinite(u)) return '0';
        const ss = Number(stackSize || 1) || 1;
        if (ss > 1) return `${u} (${Math.ceil(u / ss)} stack @${ss})`;
        return String(u);
    }

    function renderRawJsonToggleHtml(obj, toggleId) {
        const tid = toggleId || ('raw_' + Math.random().toString(36).slice(2));
        const bodyId = tid + '_body';
        const raw = esc(typeof obj === 'string' ? obj : JSON.stringify(obj || {}, null, 2));
        return `
<div style="margin-top:10px;">
 <button type="button" data-raw-toggle="${esc(tid)}">Show raw details</button>
 <div id="${esc(bodyId)}" style="display:none; margin-top:8px;">
 <pre class="mono" style="white-space:pre-wrap;margin:0;">${raw}</pre>
 </div>
</div>`;
    }

    function hookRawToggle(container) {
        container.querySelectorAll('button[data-raw-toggle]').forEach(btn => {
            btn.addEventListener('click', () => {
                const tid = btn.getAttribute('data-raw-toggle');
                const body = container.querySelector('#' + tid + '_body');
                if (!body) return;
                const open = body.style.display !== 'none';
                body.style.display = open ? 'none' : 'block';
                btn.textContent = open ? 'Show raw details' : 'Hide raw details';
            });
        });
    }

    function computeItemPayQtyFromSnap_(payment, pricing, requestedUnits) {
        const direct = payment?.payItemQty;
        if (direct != null && isFinite(Number(direct))) return Number(direct);

        const perInd = payment?.pegQtyPerInd ?? pricing?.primaryPeg?.pegQtyPerInd ?? pricing?.pegQtyPerInd;
        const per = Number(perInd);
        if (isFinite(per) && per > 0) {
            const ru = Number(requestedUnits || 0) || 0;
            return per * ru;
        }

        return Number(payment?.payItemQty || 0) || 0;
    }

    // buyerLabel/sellerLabel should *already* include mailbox wording:
    // "vak (Mailbox N/A)"
    // This renderer will prepend "Merchant:"/"Customer:" just like OCMUser.
    function renderTradeNiceHtml(snap, buyerLabel, sellerLabel) {
        const listing = snap?.listing || {};
        const request = snap?.request || {};
        const payment = snap?.payment || {};
        const pricing = snap?.pricing || {};

        const listingType = String(listing.type || '').toUpperCase();
        const itemName = sanitizeItemName(listing.itemName || '');
        const stackSize = Number(listing.stackSize || 1) || 1;
        const requestedUnits = Number(request.requestedUnits || 0) || 0;

        // Per requirement: keep roles consistent
        // Merchant = seller, Customer = buyer (matches OCMUser behavior)
        const merchantLabel = sellerLabel || '';
        const customerLabel = buyerLabel || '';

        const leftLines = [];
        const rightLines = [];

        const tradedLine = `${esc(normQty(requestedUnits, stackSize))} ${esc(itemName)}`;
        if (listingType === 'SELL' || listingType === 'BUY') leftLines.push(tradedLine);

        const method = String(payment.method || 'BT').toUpperCase();
        if (method === 'ITEM') {
            const payItemName = sanitizeItemName(payment.payItemName || payment.payItem || '');
            const payItemQty = computeItemPayQtyFromSnap_(payment, pricing, requestedUnits);
            rightLines.push(`${esc(payItemQty)} ${esc(payItemName)}`);
        } else {
            const bt = Number(payment.canonicalBT ?? payment.payTotalBT ?? 0) || 0;
            rightLines.push(`${bt.toFixed(2)} BT`);
        }

        const leftHeader = (listingType === 'BUY') ? 'Merchant takes' : 'Merchant gives';
        const rightHeader = (listingType === 'BUY') ? 'Customer receives' : 'Customer pays';

        const primaryBasis = esc(String(pricing.pricingBasis || ''));
        const canonicalBT = payment.canonicalBT != null ? Number(payment.canonicalBT || 0) : null;
        const selectedPegBT = payment.selectedPegBT != null ? Number(payment.selectedPegBT || 0) : null;

        const listHtml = (arr) => arr.length
            ? `<div>${arr.map(x => `<div class="picklist-item">${x}</div>`).join('')}</div>`
            : `<div class="picklist-empty">Nothing</div>`;

        const rawToggle = renderRawJsonToggleHtml(snap, 'trade_raw_' + Math.random().toString(36).slice(2));

        return `
<div class="details-box">
 <div class="small"><strong>Trade summary</strong></div>
 <div class="small" style="margin-top:6px;">
 <span class="pill-lite">${esc(listingType || '—')}</span>
 <span class="pill-lite">Payment: ${esc(method)}</span>
 ${primaryBasis ? `<span class="pill-lite">Basis: ${primaryBasis}</span>` : ''}
 </div>

 <div class="details-grid" style="margin-top:10px;">
 <div class="picklist-col give">
 <h4>${esc(leftHeader)}</h4>
 <div class="small">Merchant: ${esc(merchantLabel)}</div>
 ${listHtml(leftLines)}
 </div>
 <div class="picklist-col take">
 <h4>${esc(rightHeader)}</h4>
 <div class="small">Customer: ${esc(customerLabel)}</div>
 ${listHtml(rightLines)}
 </div>
 </div>

 <div class="small" style="margin-top:10px;">
 ${canonicalBT != null ? `Canonical BT: <strong>${canonicalBT.toFixed(2)} BT</strong>` : ''}
 ${selectedPegBT != null ? ` &nbsp;|&nbsp; Selected-peg BT: <strong>${selectedPegBT.toFixed(2)} BT</strong>` : ''}
 </div>

 ${rawToggle}
</div>`;
    }

    function toggleDetailsRow(mainRow, snapObj, buyerLabel, sellerLabel, colSpan) {
        const nxt = mainRow.nextElementSibling;
        if (nxt && nxt.classList.contains('details-row')) {
            nxt.remove();
            return;
        }

        const detailsTr = document.createElement('tr');
        detailsTr.className = 'details-row';

        const td = document.createElement('td');
        td.colSpan = Number(colSpan || 1);

        td.innerHTML = renderTradeNiceHtml(snapObj || {}, buyerLabel, sellerLabel);
        detailsTr.appendChild(td);

        mainRow.parentNode.insertBefore(detailsTr, mainRow.nextSibling);
        hookRawToggle(td);
    }

    window.TradeMoreInfo = {
        esc,
        safeJsonParse,
        sanitizeItemName,
        normQty,
        renderTradeNiceHtml,
        toggleDetailsRow
    };
    // Load marker / diagnostics
    window.__TradeMoreInfoLoaded = true;
})();
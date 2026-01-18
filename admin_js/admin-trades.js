// Trades tab (pending trades + review queue)
(function () {
    'use strict';

    const Admin = window.Admin;
    const byId = Admin.byId;
    const esc = Admin.esc;
    const safeJsonParse = Admin.safeJsonParse;

    function statusPill(statusRaw) {
        const s = String(statusRaw || '').toUpperCase();
        if (s === 'ACTIVE') return '<span class="pill pill-active">ACTIVE</span>';
        if (s === 'PENDING_REVIEW') return '<span class="pill pill-pending">PENDING_REVIEW</span>';
        if (s === 'PAUSED') return '<span class="pill pill-paused">PAUSED</span>';
        if (s === 'REJECTED') return '<span class="pill pill-rejected">REJECTED</span>';
        if (s === 'DELETED') return '<span class="pill">DELETED</span>';
        return `<span class="pill">${esc(s || '—')}</span>`;
    }

    function parseDetailsJsonSafe_(s) {
        return safeJsonParse(String(s || ''), null) || null;
    }

    function renderRawJsonToggleHtml_(obj, toggleId) {
        const tid = toggleId || ('raw_' + Math.random().toString(36).slice(2));
        const bodyId = tid + '_body';
        const raw = esc(typeof obj === 'string' ? obj : JSON.stringify(obj || {}, null, 2));
        return `
 <div style="margin-top:10px;">
 <button type="button" data-raw-toggle="${esc(tid)}">Show raw details</button>
 <div id="${esc(bodyId)}" style="display:none; margin-top:8px;">
 <pre class="mono" style="white-space:pre-wrap;margin:0;">${raw}</pre>
 </div>
 </div>
 `;
    }

    function hookRawToggle_(container) {
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

    function updateTradeFilterIndicators_() {
        const filtName = Admin.state.adminPendingTradesFilterUserId
            ? (window.resolveNameMailbox_(Admin.state.adminPendingTradesFilterUserId).name)
            : 'All users';
        byId('pendingTradesFilterIndicator').textContent = `Filtered to: ${esc(filtName)}`;
    }

    window.loadAdminAllPendingTrades = async function loadAdminAllPendingTrades() {
        if (!Admin.state.googleIdToken) return;
        byId('pendingTradesMsg').textContent = 'Loading...';
        updateTradeFilterIndicators_();

        try {
            const r = await window.apiGet('ocmAdminListAllPendingTradesV2', {
                idToken: Admin.state.googleIdToken,
                userId: Admin.state.adminPendingTradesFilterUserId || ''
            });
            const d = r.data || r.result || r;
            Admin.state.adminAllPendingTrades = d.trades || [];
            renderAdminAllPendingTrades_();
            byId('pendingTradesMsg').textContent = `Loaded ${Admin.state.adminAllPendingTrades.length}.`;
        } catch (e) {
            Admin.state.adminAllPendingTrades = [];
            renderAdminAllPendingTrades_();
            byId('pendingTradesMsg').textContent = 'Error: ' + e.message;
        }
    };

    function tradeSnapshotSummary_(tr) {
        const snap = parseDetailsJsonSafe_(tr.detailsJson) || {};
        const item = snap.listing?.itemName || '';
        const qty = Number(snap.request?.requestedUnits || tr.quantity || 0);
        const payment = snap.payment?.method || '';
        const updatedAt = tr.updatedAt || '';
        return { snap, item, qty, payment, updatedAt };
    }

    function isActionablePendingTrade_(tr) {
        const s = String(tr?.status || '').toUpperCase();
        const bad = new Set(['CANCELLED', 'CANCELED', 'EXPIRED', 'COMplete', 'COMPLETED', 'DENIED', 'REJECTED', 'FAILED']);
        if (!s) return true;
        if (bad.has(s)) return false;
        return s.includes('PENDING');
    }

    function renderAdminAllPendingTrades_() {
        const tb = byId('tbAllPendingTrades');
        tb.innerHTML = '';

        (Admin.state.adminAllPendingTrades || []).forEach(tr => {
            const { snap, item, qty, payment, updatedAt } = tradeSnapshotSummary_(tr);

            const b = window.resolveNameMailbox_(tr.buyerUserId);
            const s = window.resolveNameMailbox_(tr.sellerUserId);

            const actionable = isActionablePendingTrade_(tr);

            const row = document.createElement('tr');
            row.innerHTML = `
 <td class="mono">${esc(tr.tradeId)}</td>
 <td>${esc(item)}</td>
 <td>${esc(b.name)}<div class="small">Mailbox: <span class="mono">${esc(b.mailbox)}</span></div></td>
 <td>${esc(s.name)}<div class="small">Mailbox: <span class="mono">${esc(s.mailbox)}</span></div></td>
 <td class="mono">${esc(qty)}</td>
 <td class="mono">${esc(payment)}</td>
 <td class="status-pending">${esc(tr.status || 'PENDING')}</td>
 <td class="mono">${esc(updatedAt)}</td>
 <td>
 ${actionable ? '<button type="button" data-more="1">More info</button>' : ''}
 ${actionable ? '<button type="button" data-accept="1">Accept (Admin10%)</button>' : ''}
 ${actionable ? '<button type="button" data-deny="1">Deny</button>' : ''}
 ${!actionable ? '<span class="small">Not actionable</span>' : ''}
 </td>
 `;

            if (actionable) {
                row.querySelector('button[data-accept]')?.addEventListener('click', async () => {
                    if (!confirm(`Accept trade ${tr.tradeId} as admin? (10% fee)`)) return;
                    try {
                        await window.apiPost('ocmAcceptTradeAsAdminV2', { idToken: Admin.state.googleIdToken, tradeId: tr.tradeId });
                        await window.loadAdminAllPendingTrades();
                    } catch (e) { alert(e.message); }
                });

                row.querySelector('button[data-deny]')?.addEventListener('click', async () => {
                    if (!confirm(`Deny trade ${tr.tradeId}?`)) return;
                    try {
                        await window.apiPost('ocmDenyTradeV2', { idToken: Admin.state.googleIdToken, tradeId: tr.tradeId });
                        await window.loadAdminAllPendingTrades();
                    } catch (e) { alert(e.message); }
                });

                row.querySelector('button[data-more]')?.addEventListener('click', () => {
                    const tmi = window.TradeMoreInfo;

                    if (!tmi || typeof tmi.toggleDetailsRow !== 'function') {
                        const marker = window.__TradeMoreInfoLoaded ? 'script executed but window.TradeMoreInfo missing' : 'script likely not loaded';
                        alert('TradeMoreInfo helper is not loaded (' + marker + '). Check Network tab for shared/trade-more-info.js and Console for errors.');
                        return;
                    }

                    const snapObj = snap || parseDetailsJsonSafe_(tr.detailsJson) || {};
                    const buyerLabel = `${b?.name || ''} (Mailbox ${b?.mailbox || 'N/A'})`;
                    const sellerLabel = `${s?.name || ''} (Mailbox ${s?.mailbox || 'N/A'})`;
                    tmi.toggleDetailsRow(row, snapObj, buyerLabel, sellerLabel, 9);
                });
            }

            tb.appendChild(row);
        });
    }

    function updateReviewQueueIndicator_() {
        const filtName = Admin.state.adminReviewQueueFilterUserId
            ? (window.resolveNameMailbox_(Admin.state.adminReviewQueueFilterUserId).name)
            : 'All users';
        byId('reviewQueueFilterIndicator').textContent = `Filtered to: ${esc(filtName)}`;
    }

    window.loadAdminReviewQueue = async function loadAdminReviewQueue() {
        if (!Admin.state.googleIdToken) return;
        byId('reviewQueueMsg').textContent = 'Loading...';
        updateReviewQueueIndicator_();

        try {
            const r = await window.apiGet('ocmListListingReviewQueue', {
                idToken: Admin.state.googleIdToken,
                userId: Admin.state.adminReviewQueueFilterUserId || ''
            });
            const d = r.data || r.result || r;
            Admin.state.adminReviewQueue = d.listings || [];
            renderAdminReviewQueue_();
            byId('reviewQueueMsg').textContent = `Loaded ${Admin.state.adminReviewQueue.length}.`;
        } catch (e) {
            Admin.state.adminReviewQueue = [];
            renderAdminReviewQueue_();
            byId('reviewQueueMsg').textContent = 'Error: ' + e.message;
        }
    };

    function renderAdminReviewQueue_() {
        const tb = byId('tbReviewQueue');
        tb.innerHTML = '';

        (Admin.state.adminReviewQueue || []).forEach(l => {
            const seller = window.resolveNameMailbox_(l.sellerUserId);
            const notes = [];
            if (l.isInvalidQty) notes.push('<span class="warn">INVALID QTY</span>');

            const row = document.createElement('tr');
            row.innerHTML = `
 <td class="mono">${esc(l.listingId)}</td>
 <td>${esc(l.itemName || '')}</td>
 <td>${l.type === 'SELL' ? '<span class="pill pill-sell">SELL</span>' : '<span class="pill pill-buy">BUY</span>'}</td>
 <td>${statusPill(l.status || l.statusRaw)}</td>
 <td class="mono">${esc(l.remainingQuantity)}</td>
 <td class="mono">${esc(Number(l.stackSize || 1) || 1)}</td>
 <td>${esc(seller.name)}<div class="small">Mailbox: <span class="mono">${esc(seller.mailbox)}</span> ${notes.length ? (' | ' + notes.join(' ')) : ''}</div></td>
 <td class="mono">${esc(l.updatedAt || '')}</td>
 <td>
 <button type="button" data-more="1">Show more info</button>
 <button type="button" data-approve="1">Approve</button>
 <button type="button" data-reject="1">Reject</button>
 </td>
 `;

            row.querySelector('button[data-approve]')?.addEventListener('click', async () => {
                if (!confirm(`Approve listing ${l.listingId}? (becomes ACTIVE)`)) return;
                try {
                    await window.apiPost('ocmApproveListingV2', { idToken: Admin.state.googleIdToken, listingId: l.listingId });
                    await window.loadAdminReviewQueue();
                } catch (e) { alert(e.message); }
            });

            row.querySelector('button[data-reject]')?.addEventListener('click', async () => {
                if (!confirm(`Reject listing ${l.listingId}? (becomes REJECTED)`)) return;
                try {
                    await window.apiPost('ocmRejectListingV2', { idToken: Admin.state.googleIdToken, listingId: l.listingId });
                    await window.loadAdminReviewQueue();
                } catch (e) { alert(e.message); }
            });

            row.querySelector('button[data-more]')?.addEventListener('click', () => toggleListingDetailsRow_(row, l, seller));

            tb.appendChild(row);
        });
    }

    function toggleListingDetailsRow_(mainRow, listingObj, seller) {
        const lmi = window.ListingMoreInfo;
        if (!lmi || typeof lmi.toggleDetailsRow !== 'function') {
            const marker = window.__ListingMoreInfoLoaded ? 'script executed but window.ListingMoreInfo missing' : 'script likely not loaded';
            alert('ListingMoreInfo helper is not loaded (' + marker + '). Check Network tab for shared/listing-more-info.js and Console for errors.');
            return;
        }

        const sellerLabel = `${seller?.name || ''} (Mailbox ${seller?.mailbox || 'N/A'})`;
        lmi.toggleDetailsRow(mainRow, listingObj, sellerLabel,9);
    }

    window.filterReviewQueueToTarget_ = function filterReviewQueueToTarget_() {
        if (!Admin.state.globalTargetUser) { alert('Select a target user first.'); return; }
        Admin.state.adminReviewQueueFilterUserId = Admin.state.globalTargetUser.userId;
        window.loadAdminReviewQueue();
    };

    window.clearReviewQueueFilter_ = function clearReviewQueueFilter_() {
        Admin.state.adminReviewQueueFilterUserId = null;
        window.loadAdminReviewQueue();
    };

    window.filterPendingTradesToTarget_ = function filterPendingTradesToTarget_() {
        if (!Admin.state.globalTargetUser) { alert('Select a target user first.'); return; }
        Admin.state.adminPendingTradesFilterUserId = Admin.state.globalTargetUser.userId;
        window.loadAdminAllPendingTrades();
    };

    window.clearPendingTradesFilter_ = function clearPendingTradesFilter_() {
        Admin.state.adminPendingTradesFilterUserId = null;
        window.loadAdminAllPendingTrades();
    };
})();
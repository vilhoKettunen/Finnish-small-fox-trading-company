// Tabs + sub-tabs
(function () {
    'use strict';

    const Admin = window.Admin;
    const byId = Admin.byId;

    // Expose for inline onclick
    window.showTab = function showTab(name) {
        const mapping = {
            targetUser: 'targetUserSection',
            requests: 'requestsSection',
            trades: 'tradesSection',
            players: 'playersSection',
            ocmAdmin: 'ocmAdminSection',
            accountHistory: 'accountHistorySection',
            accountEdit: 'accountEditSection',
            stock: 'stockSection'
        };

        Object.keys(mapping).forEach(k => {
            const el = byId(mapping[k]);
            if (!el) return;
            el.style.display = (k === name) ? 'block' : 'none';
        });

        const tabMap = {
            TargetUser: 'targetUser',
            Requests: 'requests',
            Trades: 'trades',
            Players: 'players',
            Ocm: 'ocmAdmin',
            AccountHistory: 'accountHistory',
            AccountEdit: 'accountEdit',
            Stock: 'stock'
        };

        Object.keys(tabMap).forEach(suf => {
            const btn = byId('tab' + suf);
            if (!btn) return;
            btn.classList.toggle('active', tabMap[suf] === name);
        });

        if (name === 'stock') window.reloadStock && window.reloadStock();

        if (name === 'trades') {
            window.showTradesSubTab && window.showTradesSubTab('pendingTrades');
            window.loadAdminAllPendingTrades && window.loadAdminAllPendingTrades();
        }

        if (name === 'ocmAdmin') {
            window.updateOcmActingUI && window.updateOcmActingUI();
            if (Admin.state.globalTargetUser) {
                const p = window.ensureOcmCatalogLoaded ? window.ensureOcmCatalogLoaded() : Promise.resolve();
                Promise.resolve(p).then(() => {
                    window.initCreatorPegUIs_ && window.initCreatorPegUIs_();
                    window.loadAdminTargetListings && window.loadAdminTargetListings();
                });
                window.loadAdminTargetPendingTrades && window.loadAdminTargetPendingTrades();
            }
        }

        if (name === 'accountHistory') {
            window.refreshAdminHistoryTargetUI_ && window.refreshAdminHistoryTargetUI_();
            Admin.state.adminHistoryPage = 1;
            if (Admin.state.globalTargetUser) window.adminLoadHistory && window.adminLoadHistory();
        }

        if (name === 'accountEdit') {
            window.refreshAdminAccountEditTargetUI_ && window.refreshAdminAccountEditTargetUI_();
        }
    };

    // Expose for inline onclick
    window.showTradesSubTab = function showTradesSubTab(which) {
        const isPending = which === 'pendingTrades';
        byId('panelPendingTrades').style.display = isPending ? 'block' : 'none';
        byId('panelReviewQueue').style.display = isPending ? 'none' : 'block';
        byId('subtabPendingTrades').setAttribute('aria-selected', isPending ? 'true' : 'false');
        byId('subtabReviewQueue').setAttribute('aria-selected', isPending ? 'false' : 'true');

        if (isPending) window.loadAdminAllPendingTrades && window.loadAdminAllPendingTrades();
        else window.loadAdminReviewQueue && window.loadAdminReviewQueue();
    };
})();
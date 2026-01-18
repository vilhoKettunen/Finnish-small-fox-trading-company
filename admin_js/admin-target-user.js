// Target User selection/search
(function () {
    'use strict';

    const Admin = window.Admin;
    const byId = Admin.byId;
    const esc = Admin.esc;

    function fireTargetChanged_() {
        // Central place to refresh any UI that depends on Admin.state.globalTargetUser
        try { window.onAdminTargetUserChanged_ && window.onAdminTargetUserChanged_(); } catch { /* ignore */ }

        // Back-compat: keep existing direct calls
        window.updateOcmActingUI && window.updateOcmActingUI();
        window.refreshAdminHistoryTargetUI_ && window.refreshAdminHistoryTargetUI_();
        window.refreshAdminAccountEditTargetUI_ && window.refreshAdminAccountEditTargetUI_();
    }

    window.clearGlobalTarget = function clearGlobalTarget() {
        Admin.state.globalTargetUser = null;
        byId('globalUserInput').value = '';
        byId('globalUserSelected').textContent = 'No user selected';

        byId('playerSearch').dataset.selectedUser = '';
        byId('playerSearch').value = '';
        byId('transferTarget').value = '';
        byId('balancesInfo').textContent = 'Balances will appear here.';

        fireTargetChanged_();
    };

    window.selectGlobalUserById = function selectGlobalUserById(uid) {
        const pl = Admin.state.playersCache.find(p => p.userId === uid);
        if (!pl) return;
        Admin.state.globalTargetUser = pl;

        byId('globalUserSelected').textContent = pl.playerName || pl.email || uid;

        byId('playerSearch').dataset.selectedUser = uid;
        byId('playerSearch').value = pl.playerName || '';
        byId('transferTarget').value = pl.playerName || '';
        byId('balancesInfo').textContent = `Selected: ${pl.playerName} | Balance: ${(Number(pl.balanceBT) || 0).toFixed(2)} BT`;

        fireTargetChanged_();

        if (byId('ocmAdminSection')?.style.display !== 'none') {
            const p = window.ensureOcmCatalogLoaded ? window.ensureOcmCatalogLoaded() : Promise.resolve();
            Promise.resolve(p).then(() => {
                window.initCreatorPegUIs_ && window.initCreatorPegUIs_();
                window.loadAdminTargetListings && window.loadAdminTargetListings();
            });
            window.loadAdminTargetPendingTrades && window.loadAdminTargetPendingTrades();
        }

        if (byId('accountHistorySection').style.display !== 'none') {
            window.refreshAdminHistoryTargetUI_ && window.refreshAdminHistoryTargetUI_();
            Admin.state.adminHistoryPage = 1;
            window.adminLoadHistory && window.adminLoadHistory();
        }

        if (byId('accountEditSection')?.style.display !== 'none') {
            window.refreshAdminAccountEditTargetUI_ && window.refreshAdminAccountEditTargetUI_();
        }
    };

    function initGlobalUserSearch() {
        const input = byId('globalUserInput');
        const box = byId('globalUserSuggestions');
        if (!input || !box) return;

        input.addEventListener('input', () => {
            const q = input.value.trim().toLowerCase();
            if (!q || !Admin.state.playersCache.length) { box.style.display = 'none'; box.innerHTML = ''; return; }

            const hits = Admin.state.playersCache.map(p => {
                const n = (p.playerName || '').toLowerCase();
                let sc = 0;
                if (n.startsWith(q)) sc = 100 - (n.length - q.length);
                else {
                    const idx = n.indexOf(q);
                    if (idx >= 0) sc = 60 - idx;
                }
                return { p, sc };
            }).filter(h => h.sc > 0).sort((a, b) => b.sc - a.sc).slice(0, 25);

            if (!hits.length) { box.style.display = 'none'; box.innerHTML = ''; return; }
            box.innerHTML = hits.map(h => `<div class="sugg" data-uid="${h.p.userId}">${esc(h.p.playerName)}</div>`).join('');
            box.style.display = 'block';
        });

        box.addEventListener('click', ev => {
            const d = ev.target.closest('.sugg'); if (!d) return;
            const uid = d.dataset.uid;
            window.selectGlobalUserById(uid);
            box.style.display = 'none';
            box.innerHTML = '';
        });
    }

    Admin.initGlobalUserSearch = initGlobalUserSearch;
})();

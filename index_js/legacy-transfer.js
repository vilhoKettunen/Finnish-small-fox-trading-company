// Direct BT transfer UI and actions
(function () {
    'use strict';

    window.openTransferModal = window.openTransferModal || function openTransferModal() {
        if (!window.googleIdToken) { alert('Login first'); return; }
        const err = document.getElementById('transferError');
        const ok = document.getElementById('transferSuccess');
        if (err) err.textContent = '';
        if (ok) ok.textContent = '';
        document.getElementById('transferAmountInput').value = '';
        document.getElementById('transferNoteInput').value = '';
        document.getElementById('transferPlayerNameInput').value = '';
        const balEl = document.getElementById('transferYourBalance');
        if (balEl) balEl.textContent = (window.topBalanceSelfBT != null ? window.topBalanceSelfBT : window.currentBalanceBT).toFixed(2);
        const modal = document.getElementById('transferModal');
        if (modal) modal.style.display = 'block';
        window.setupTransferSuggestions && window.setupTransferSuggestions();
    };

    window.closeTransferModal = window.closeTransferModal || function closeTransferModal() {
        const modal = document.getElementById('transferModal');
        if (modal) modal.style.display = 'none';
    };

    window.setupTransferSuggestions = window.setupTransferSuggestions || function setupTransferSuggestions() {
        const input = document.getElementById('transferPlayerNameInput');
        const box = document.getElementById('transferSuggestions');
        if (!input || !box) return;

        // Only admins have a players cache in this build.
        if (!window.currentUser?.isAdmin || !Array.isArray(window.__playersCache) || !window.__playersCache.length) {
            box.style.display = 'none';
            box.innerHTML = '';
            return;
        }

        // Avoid double-wiring if modal opened multiple times
        if (input.dataset.suggWired === '1') return;
        input.dataset.suggWired = '1';

        input.addEventListener('input', () => {
            const q = input.value.trim().toLowerCase();
            if (!q) { box.style.display = 'none'; box.innerHTML = ''; return; }

            const hits = window.__playersCache
                .map(p => {
                    const name = (p.playerName || '').toLowerCase();
                    let sc = 0;
                    if (name.startsWith(q)) sc = 100 - (name.length - q.length);
                    else {
                        const idx = name.indexOf(q);
                        if (idx >= 0) sc = 60 - idx;
                    }
                    return { p, sc };
                })
                .filter(x => x.sc > 0)
                .sort((a, b) => b.sc - a.sc)
                .slice(0, 25);

            if (!hits.length) { box.style.display = 'none'; box.innerHTML = ''; return; }

            box.innerHTML = hits
                .map(h => {
                    const n = (h.p.playerName || '').replace(/"/g, '&quot;');
                    return `<div class="transfer-sugg" data-n="${n}" style="padding:2px 4px;cursor:pointer;border-radius:4px;">${h.p.playerName}</div>`;
                })
                .join('');

            box.style.display = 'block';
        });

        box.addEventListener('click', ev => {
            const el = ev.target.closest('.transfer-sugg');
            if (!el) return;
            input.value = el.dataset.n || '';
            box.style.display = 'none';
            box.innerHTML = '';
            input.focus();
        });

        input.addEventListener('focus', () => input.dispatchEvent(new Event('input')));
        input.addEventListener('blur', () => setTimeout(() => { box.style.display = 'none'; }, 200));
    };

    window.performDirectTransfer = window.performDirectTransfer || async function performDirectTransfer() {
        const errEl = document.getElementById('transferError');
        const okEl = document.getElementById('transferSuccess');
        if (errEl) errEl.textContent = '';
        if (okEl) okEl.textContent = '';

        if (!window.googleIdToken) { if (errEl) errEl.textContent = 'Login required'; return; }
        if (typeof window.apiPost !== 'function') { if (errEl) errEl.textContent = 'apiPost not available (api-client.js not loaded)'; return; }

        const targetName = document.getElementById('transferPlayerNameInput').value.trim();
        const amtRaw = document.getElementById('transferAmountInput').value.trim();
        const note = document.getElementById('transferNoteInput').value.trim();

        if (!targetName) { if (errEl) errEl.textContent = 'Enter target player name'; return; }

        const amount = Number(amtRaw);
        if (!isFinite(amount) || amount < 0.01) { if (errEl) errEl.textContent = 'Minimum 0.01 BT'; return; }

        const balance = window.topBalanceSelfBT != null ? window.topBalanceSelfBT : window.currentBalanceBT;
        if (amount > balance) { if (errEl) errEl.textContent = 'Not enough funds'; return; }

        if (window.currentUser?.playerName && window.currentUser.playerName.trim().toLowerCase() === targetName.toLowerCase()) {
            if (errEl) errEl.textContent = 'Cannot transfer to yourself';
            return;
        }

        // If admin has the players cache, resolve to userId for perfect matching.
        let targetUserId = null;
        if (window.currentUser?.isAdmin && Array.isArray(window.__playersCache)) {
            const hit = window.__playersCache.find(p => (p.playerName || '').trim().toLowerCase() === targetName.toLowerCase());
            if (hit?.userId) targetUserId = String(hit.userId);
        }

        try {
            if (errEl) errEl.textContent = 'Sending...';

            // Use apiPost so GET-bypass is used for 'transferBT' (api-client.js handles this)
            await window.apiPost('transferBT', {
                idToken: window.googleIdToken,
                targetUserId: targetUserId || '',
                targetPlayerName: targetUserId ? '' : targetName,
                amountBT: +amount.toFixed(2),
                note: note || ''
            });

            if (errEl) errEl.textContent = '';
            if (okEl) okEl.textContent = 'Transfer complete.';

            // Refresh balances in UI after server confirms
            try { await (window.refreshTopBarBalances && window.refreshTopBarBalances()); } catch { }
            try { await (window.refreshPinnedBalanceForActiveTarget && window.refreshPinnedBalanceForActiveTarget()); } catch { }
        } catch (e) {
            if (errEl) errEl.textContent = (e && e.message) ? e.message : String(e);
        }
    };

})();
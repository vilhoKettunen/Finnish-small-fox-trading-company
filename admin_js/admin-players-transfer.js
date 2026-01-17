// Players/Transfer tab
(function () {
    'use strict';

const Admin = window.Admin;
    const byId = Admin.byId;
    const esc = Admin.esc;

    function fuzzyPlayers(q) {
        q = q.trim().toLowerCase();
    if (!q) return [];
        return Admin.state.playersCache.map(p => {
       const base = (p.playerName || '').toLowerCase();
 let score = 0;
       if (base.startsWith(q)) score = 100 - (base.length - q.length);
 else {
 const idx = base.indexOf(q);
       if (idx >= 0) score = 60 - idx;
   }
   return { ...p, _score: score };
    }).filter(p => p._score > 0).sort((a, b) => b._score - a._score).slice(0, 30);
    }

    function initPlayersTransferUI() {
   const search = byId('playerSearch');
   const list = byId('playerList');
    if (!search || !list) return;

        search.addEventListener('input', () => {
   const q = search.value;
  const arr = fuzzyPlayers(q);
 const out = arr.map(p => `<div data-user="${esc(p.userId)}" class="player-row">${esc(p.playerName || '(no name)')} <span class="small">(${(Number(p.balanceBT) || 0).toFixed(2)} BT)</span></div>`).join('');
 list.innerHTML = out || '<div class="small">No matches</div>';
  });

  list.addEventListener('click', ev => {
        const row = ev.target.closest('.player-row');
  if (!row) return;
        const userId = row.dataset.user;
        const player = Admin.state.playersCache.find(p => p.userId === userId);
      if (player) {
 byId('balancesInfo').textContent = `Selected: ${player.playerName} | Balance: ${(Number(player.balanceBT) || 0).toFixed(2)} BT`;
 byId('transferTarget').value = player.playerName || '';
       search.dataset.selectedUser = userId;
  }
  });
    }

    window.adjustBalance = async function adjustBalance() {
    const userName = byId('playerSearch').value.trim();
   const delta = Number(byId('adjAmount').value || 0);
   const reason = byId('adjReason').value.trim();

    if (!Admin.state.googleIdToken || !Admin.state.currentUser?.isAdmin) { byId('adjMsg').textContent = 'Admin login required'; return; }
  if (!userName || !delta) { byId('adjMsg').textContent = 'Fill player and delta'; return; }

        const target = Admin.state.playersCache.find(p => p.playerName && p.playerName.toLowerCase() === userName.toLowerCase());
   if (!target) { byId('adjMsg').textContent = 'Player not found'; return; }

    byId('adjMsg').textContent = 'Applying...';
   try {
 await window.apiPost('adjustBalance', { idToken: Admin.state.googleIdToken, userId: target.userId, deltaBT: delta, reason });
  byId('adjMsg').textContent = 'Done.';
   window.loadPlayers();
   } catch (e) {
   byId('adjMsg').textContent = 'Error: ' + e.message;
   }
    };

    window.transferBT = async function transferBT() {
   const targetName = byId('transferTarget').value.trim();
  const amount = Number(byId('transferAmount').value || 0);
    const note = byId('transferNote').value.trim();

    if (!Admin.state.googleIdToken) { byId('transferMsg').textContent = 'Login required'; return; }
    if (!targetName || !amount || amount < 0.01) { byId('transferMsg').textContent = 'Invalid input'; return; }

    byId('transferMsg').textContent = 'Sending...';
        try {
        await window.apiPost('transferBT', { idToken: Admin.state.googleIdToken, targetPlayerName: targetName, amountBT: amount, note });
 byId('transferMsg').textContent = 'Transfer complete.';
   window.loadPlayers();
   } catch (e) {
        byId('transferMsg').textContent = 'Error: ' + e.message;
        }
    };

    Admin.initPlayersTransferUI = initPlayersTransferUI;
})();

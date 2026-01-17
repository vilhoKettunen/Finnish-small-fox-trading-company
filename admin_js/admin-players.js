// Players list cache + shared helpers
(function () {
'use strict';

    const Admin = window.Admin;
    const byId = Admin.byId;

    window.loadPlayers = async function loadPlayers() {
  if (!Admin.state.googleIdToken) return;
    try {
   const r = await window.apiGet('adminListPlayers', { idToken: Admin.state.googleIdToken });
        const arr = (r.data || r.result || r);
 Admin.state.playersCache = Array.isArray(arr) ? arr : (arr.players || []);
       const pc = byId('globalPlayersCount');
  if (pc) pc.textContent = `Players loaded: ${Admin.state.playersCache.length}`;
        } catch (e) {
 console.warn('loadPlayers', e.message);
    }
    };

    window.resolvePlayerById_ = function resolvePlayerById_(uid) {
        if (!uid) return null;
    return Admin.state.playersCache.find(p => String(p.userId) === String(uid)) || null;
    };

    window.resolveNameMailbox_ = function resolveNameMailbox_(uid) {
        const p = window.resolvePlayerById_(uid);
    return {
   name: p?.playerName || p?.email || String(uid || ''),
  mailbox: (p && p.mailbox) ? p.mailbox : 'N/A'
        };
    };
})();

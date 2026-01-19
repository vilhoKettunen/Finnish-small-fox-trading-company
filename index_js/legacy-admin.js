// Admin helpers (on-behalf, players list)
(function(){
 'use strict';

 function normalizeStr(s) { return (s || '').toLowerCase().trim(); }
 function score(candidate, query) {
 const c = normalizeStr(candidate);
 const q = normalizeStr(query);
 if (!q) return 0;
 if (c.startsWith(q)) return 100 - (c.length - q.length);
 const idx = c.indexOf(q);
 if (idx >=0) return 60 - idx;
 const tokens = q.split(/\s+/).filter(Boolean);
 let hits =0;
 tokens.forEach(t => { if (c.indexOf(t) >=0) hits++; });
 return hits >0 ?30 + hits : -1;
 }

 // Player search dropdown (admin on-behalf). Ported from `admin_js_old _working/index.html`.
 window.attachOnBehalfSearch = window.attachOnBehalfSearch || function attachOnBehalfSearch() {
 const input = document.getElementById('obPlayerSearchInput');
 const list = document.getElementById('obPlayerSearchList');
 if (!input || !list) return;

 // ensure players cache exists
 window.__playersCache = window.__playersCache || [];

 input.addEventListener('input', () => {
 const q = input.value;
 const filtered = (window.__playersCache || []).map(p => ({
 ...p,
 _score: Math.max(
 score(`${p.playerName || ''}`, q),
 score(`${p.email || ''}`, q),
 score(`${p.userId || ''}`, q)
 )
 }))
 .filter(p => p._score >=0)
 .sort((a, b) => b._score - a._score)
 .slice(0,200);

 list.innerHTML = '';
 if (!filtered.length) { list.style.display = 'none'; return; }

 filtered.forEach(p => {
 const div = document.createElement('div');
 div.className = 'dropdown-item';
 div.innerHTML = `<div><strong>${p.playerName || '(no name)'}</strong><br><small>${p.email || ''}</small></div>`;
 div.onclick = () => {
 input.value = p.playerName || p.email || p.userId;
 input.dataset.userId = p.userId || '';
 list.style.display = 'none';
 };
 list.appendChild(div);
 });

 list.style.display = 'block';
 });

 input.addEventListener('focus', () => input.dispatchEvent(new Event('input')));
 input.addEventListener('blur', () => setTimeout(() => list.style.display = 'none',200));
 };

 window.adminLoadPlayers = window.adminLoadPlayers || async function adminLoadPlayers() {
 const st = document.getElementById('onBehalfStatus');
 try {
 if (!window.googleIdToken) return;
 const r = await fetch(`${window.WEB_APP_URL}?action=adminListPlayers&idToken=${encodeURIComponent(window.googleIdToken)}`);
 const j = await r.json();
 if (j && j.ok === false) throw new Error(j.error || 'adminListPlayers failed');

 let arr = [];
 if (Array.isArray(j.data)) arr = j.data;
 else if (Array.isArray(j.players)) arr = j.players;
 else if (j.data && Array.isArray(j.data.players)) arr = j.data.players;

 window.__playersCache = window.__playersCache || [];
 window.__playersCache.length =0;
 arr.forEach(p => window.__playersCache.push({
 userId: p.userId,
 email: p.email,
 playerName: p.playerName,
 mailbox: p.mailbox
 }));

 if (st) st.textContent = `Loaded ${window.__playersCache.length} players.`;
 } catch (e) {
 if (st) st.textContent = 'Load players failed: ' + e.message;
 }
 };

 window.setOnBehalfTarget = window.setOnBehalfTarget || async function setOnBehalfTarget() {
 if (!window.currentUser?.isAdmin) return alert('Admin only');
 const input = document.getElementById('obPlayerSearchInput');
 const userId = input?.dataset?.userId || '';
 const st = document.getElementById('onBehalfStatus');
 if (!userId) { if (st) st.textContent = 'Select a player from the list first.'; return; }
 const u = (window.__playersCache || []).find(p => p.userId === userId);
 if (!u) { if (st) st.textContent = 'Selected player not found.'; return; }
 window.submitForUser = { userId: u.userId, email: u.email || null, playerName: u.playerName || null, mailbox: u.mailbox || null };
 if (st) st.textContent = `Target set: ${u.playerName || u.email || u.userId}. Loading balance...`;
 await window.refreshPinnedBalanceForActiveTarget();
 await window.refreshTopBarBalances();
 };

 window.clearOnBehalfTarget = window.clearOnBehalfTarget || async function clearOnBehalfTarget() {
 window.submitForUser = null;
 const st = document.getElementById('onBehalfStatus');
 if (st) st.textContent = 'On-behalf target cleared. Loading your balance...';
 await window.refreshPinnedBalanceForActiveTarget();
 await window.refreshTopBarBalances();
 const input = document.getElementById('obPlayerSearchInput');
 if (input) { input.value = ''; input.dataset.userId = ''; }
 };

})();
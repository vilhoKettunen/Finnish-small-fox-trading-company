// Utility functions extracted from legacy app
(function(){
 'use strict';

 window.normalizeUser = window.normalizeUser || function normalizeUser(u) {
 if (!u) return u;
 const cand = (u.playerName && u.playerName.trim())
 || (u.player && u.player.trim())
 || (u.name && u.name.trim())
 || (u.displayName && u.displayName.trim()) || null;
 u.playerName = cand || null;
 return u;
 };

 // cryptoRandomId lives in index-core; keep a fallback
 window.cryptoRandomId = window.cryptoRandomId || function cryptoRandomId() { return (crypto.getRandomValues(new Uint32Array(4))).join('-'); };
})();
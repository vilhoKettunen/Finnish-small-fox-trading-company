// Core shared state + helpers for Admin panel (classic scripts)
// Exposes a minimal shared surface on window.Admin.

(function () {
    'use strict';

    const Admin = (window.Admin = window.Admin || {});

    // Config (from app-config.js)
    Admin.WEB_APP_URL = window.WEB_APP_URL || '';
    Admin.OAUTH_CLIENT_ID = window.OAUTH_CLIENT_ID || '';

    // Shared state
    Admin.state = {
   googleIdToken: null,
   currentUser: null,

   playersCache: [],
    globalTargetUser: null,

        ocmCatalog: [],
    adminTargetListings: [],
   adminAllPendingTrades: [],
        adminReviewQueue: [],
    ocmEditingListing: null,

   stockItems: [],

    // Peg UI state (create + edit)
        createState: {
 store: { primary: null, alts: [] },
  half: { primary: null, alts: [] }
        },
  editState: { primary: null, alts: [] },

    // Admin history
  adminHistoryPage: 1,

    // Filters
   adminPendingTradesFilterUserId: null,
   adminReviewQueueFilterUserId: null
    };

    // DOM helpers
    Admin.byId = function byId(id) { return document.getElementById(id); };
    Admin.fmt2 = function fmt2(v) { v = Number(v) || 0; return v.toFixed(2); };
    Admin.safeJsonParse = function safeJsonParse(s, fallback = null) {
  try { return JSON.parse(s); } catch { return fallback; }
};
    Admin.esc = function esc(s) {
        return String(s || '')
  .replace(/&/g, '&amp;')
   .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
   .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    };
})();

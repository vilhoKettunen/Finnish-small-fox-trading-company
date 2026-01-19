// Core boot + shared state for index.html
// Exposes globals expected by existing UI code.

/* ===== CONFIG / CONSTANTS ===== */
const WEB_APP_URL = window.WEB_APP_URL || 'https://yellow-king-52c6.vilhokettu1.workers.dev/exec';
const RECAPTCHA_SITE_KEY = window.RECAPTCHA_SITE_KEY || '6LdjcAgsAAAAABWoHl5dmFjbJQL61kOu7ddvkUZF';
const OAUTH_CLIENT_ID = window.OAUTH_CLIENT_ID || '857098772457-kuvq861sa844esf2jc4b7av1pnlmnn1c.apps.googleusercontent.com';
const sheetURL = "https://docs.google.com/spreadsheets/d/1_meliJtuKSDwEWRDh1gldcsD-pSjDgIND3dcE1mCjCo/gviz/tq?tqx=out:json&gid=0";
const BASE_CURRENCY = "BT";

// State (kept on window to preserve legacy globals)
window.items = window.items || [];
window.payItems = window.payItems || [];
window.buyCart = window.buyCart || [];
window.sellCart = window.sellCart || [];
window.stockProgressCache = window.stockProgressCache || [];
window.dropdownData = window.dropdownData || [];
window.currentUser = window.currentUser || null;
window.googleIdToken = window.googleIdToken || null;
window.recaptchaWidgetId = window.recaptchaWidgetId ?? null;
window.lastRecaptchaToken = window.lastRecaptchaToken || null;
window.ocmListingsCacheBuy = window.ocmListingsCacheBuy || [];
window.ocmListingsCacheSell = window.ocmListingsCacheSell || [];
window.editedFromRequestId = window.editedFromRequestId || null;
window.submitForUser = window.submitForUser || null;
window.__playersCache = window.__playersCache || [];

window.currentBalanceBT = window.currentBalanceBT ||0;

/* Top bar balance state */
window.topBalanceSelfBT = window.topBalanceSelfBT ?? null;
window.topBalanceTargetBT = window.topBalanceTargetBT ?? null;

// Expose constants used elsewhere
window.WEB_APP_URL = WEB_APP_URL;
window.RECAPTCHA_SITE_KEY = RECAPTCHA_SITE_KEY;
window.OAUTH_CLIENT_ID = OAUTH_CLIENT_ID;
window.BASE_CURRENCY = BASE_CURRENCY;
window.sheetURL = sheetURL;

window.cryptoRandomId = window.cryptoRandomId || function cryptoRandomId() {
 return (crypto.getRandomValues(new Uint32Array(4))).join('-');
};

window.scrollIntoViewSmooth = window.scrollIntoViewSmooth || function scrollIntoViewSmooth(id) {
 const el = document.getElementById(id);
 if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.updateAllDisplays = window.updateAllDisplays || function updateAllDisplays() {
 try { window.renderBuyList && window.renderBuyList(); } catch { }
 try { window.renderSellList && window.renderSellList(); } catch { }
 try { window.calculateNet && window.calculateNet(); } catch { }
};

window.toggleInfo = window.toggleInfo || function toggleInfo(id) {
 const el = document.getElementById(id);
    if (el) el.style.display = el.style.display === 'block' ? 'none' : 'block';
    // Compatibility shim: legacy code expects `window.updateTopBarAuth()`.
    // `topbar.js` owns the real state via `window.topbarSetAuthState(...)`.
    window.updateTopBarAuth = window.updateTopBarAuth || function updateTopBarAuth() {
        if (typeof window.topbarSetAuthState === 'function') {
            window.topbarSetAuthState({
                idToken: window.googleIdToken,
                user: window.currentUser,
                isAdmin: !!window.currentUser?.isAdmin,
                balanceBT: window.currentBalanceBT
            });
        }
    };

};

// Compatibility shim: legacy code expects `window.updateTopBarAuth()`.
// `topbar.js` owns the real state via `window.topbarSetAuthState(...)`.
window.updateTopBarAuth = window.updateTopBarAuth || function updateTopBarAuth() {
 if (typeof window.topbarSetAuthState === 'function') {
 window.topbarSetAuthState({
 idToken: window.googleIdToken,
 user: window.currentUser,
 isAdmin: !!window.currentUser?.isAdmin,
 balanceBT: window.currentBalanceBT
 });
 }
};

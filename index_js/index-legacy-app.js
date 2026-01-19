// Legacy app aggregator (keeps only core state and navigation). Detailed logic moved to focused modules.
(function () {
    'use strict';

    // ...state remains on window (helpers and functions moved to other files)
    window.currentUser = window.currentUser || null;
    window.googleIdToken = window.googleIdToken || null;
    window.recaptchaWidgetId = window.recaptchaWidgetId ?? null;
    window.lastRecaptchaToken = window.lastRecaptchaToken || null;
    window.ocmListingsCacheBuy = window.ocmListingsCacheBuy || [];
    window.ocmListingsCacheSell = window.ocmListingsCacheSell || [];
    window.editedFromRequestId = window.editedFromRequestId || null;
    window.submitForUser = window.submitForUser || null;
    window.__playersCache = window.__playersCache || [];

    window.currentBalanceBT = Number(window.currentBalanceBT || 0);
    window.topBalanceSelfBT = window.topBalanceSelfBT ?? null;
    window.topBalanceTargetBT = window.topBalanceTargetBT ?? null;

    // Navigation gating
    window.navigateStore = function navigateStore() { window.scrollIntoViewSmooth('buySection'); };
    window.navigateHistory = function navigateHistory() { if (!window.googleIdToken) { alert('You need to login for this tool'); return; } window.location.href = 'AccountHistory.html'; };
    window.navigateOCM = function navigateOCM() { window.location.href = 'OCMHome.html'; };
    window.navigateMerchant = function navigateMerchant() { if (!window.googleIdToken) { alert('You need to login for this tool'); return; } window.location.href = 'OCMUser.html'; };
    window.navigateAdmin = function navigateAdmin() { if (!window.googleIdToken || !window.currentUser?.isAdmin) { alert('Admin only'); return; } window.location.href = 'Admin.html'; };

})();
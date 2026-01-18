/* api-client.js
   Shared API helper for pages outside index.html.
   Requires app-config.js to define window.WEB_APP_URL.
   Integrates GET Bypass logic for write actions. */

(function () {
    const BASE = (window.WEB_APP_URL || '').replace(/\/+$/, '');

    // Actions that must be sent via GET to bypass POST blocks
    const BYPASS_ACTIONS = [
        'createRequest', 'createTradeRequest', 'cancelRequest',
        'approveRequest', 'denyRequest',
        'approveTrade', 'denyTrade',
        'adjustBalance', 'transferBT',
        'createListing', 'updateListing', 'deleteListing', 'toggleListingStatus',
        'adjustStock',

        // Account setup (NEW)
        'linkPlayer',

        // Admin account editing
        'adminUpdateUserProfile',

        // OCM v2 (new)
        'ocmCreateListingV2', 'ocmUpdateListingV2',
        'ocmCreateTradeRequestV2', 'ocmUpdateTradeRequestV2', 'ocmCancelTradeRequestV2',
        'ocmApproveListingV2', 'ocmRejectListingV2',
        'ocmAcceptTradeAsSellerV2', 'ocmAcceptTradeAsAdminV2', 'ocmDenyTradeV2','ocmAdminCreateListingV2',

        // Admin OCM v2
        'ocmAdminUpdateListingV2',

        // Optional: mailbox/details enrichment endpoints (add these actions on backend if you implement them)
        'ocmEnrichTradeDetailsMailboxesV2',
        'ocmRepairTradeDetailsMailboxesV2'
    ];

    function normalize(j) {
        if (!j) return j;
        // Standard error throwing
        if (typeof j === 'object' && 'ok' in j && j.ok === false) {
            const err = new Error(j.error || 'Backend error');
            err.extra = j.extra;
            throw err;
        }
        // Support both .result and .data consumers
        if (j && j.ok === true && j.data !== undefined && j.result === undefined) {
            j.result = j.data;
        }
        // Legacy support for plain return
        if (j && j.ok === true && !j.data && !j.result && Object.keys(j).length > 1) {
            // e.g. { ok: true, balanceAfter: 100 }
            j.result = j;
        }
        return j;
    }
    async function readJsonOrThrow_(r) {
        const txt = await r.text();
        try {
            return JSON.parse(txt);
        } catch {
            const snippet = txt.slice(0, 400);
            const err = new Error(`Backend returned non-JSON response (HTTP ${r.status}). Body: ${snippet}`);
            err.httpStatus = r.status;
            err.bodySnippet = snippet;
            throw err;
        }
    }
    async function apiGet(action, params) {
        const url = new URL(BASE);
        url.searchParams.set('action', action);
        if (params && typeof params === 'object') {
            for (const [k, v] of Object.entries(params)) {
                if (v !== undefined && v !== null && v !== '') {
                    url.searchParams.set(k, String(v));
                }
            }
        }
        // in apiGet:
        const r = await fetch(url.toString(), { method: 'GET' });
        const j = await readJsonOrThrow_(r);
        return normalize(j);
    }

    // Uses GET bypass if action is in list, otherwise standard POST
    async function apiPost(action, body) {
        if (BYPASS_ACTIONS.includes(action)) {
            return apiGetBypass(action, body);
        }

        const payload = { ...(body || {}), action };
        const r = await fetch(BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // Use text/plain to avoid OPTIONS preflight
            body: JSON.stringify(payload)
        });
        // in apiPost:
        const j = await readJsonOrThrow_(r);
        return normalize(j);
    }

    async function apiGetBypass(action, body) {
        const url = new URL(BASE);
        url.searchParams.append('action', action);

        if (body) {
            for (const [key, value] of Object.entries(body)) {
                // Stringify complex objects (payloads) so GAS can parse them
                if (typeof value === 'object' && value !== null) {
                    url.searchParams.append(key, JSON.stringify(value));
                } else if (value !== undefined && value !== null) {
                    url.searchParams.append(key, String(value));
                }
            }
        }

        // Safety check
        if (url.toString().length > 2000) {
            console.warn('URL length exceeds 2000 chars. Request might fail via Bypass.');
        }

        const r = await fetch(url.toString(), { method: 'GET' });
        const j = await readJsonOrThrow_(r);
        return normalize(j);
    }
    
    // expose
    window.apiGet = apiGet;
    window.apiPost = apiPost;
})();
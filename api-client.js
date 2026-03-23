/* api-client.js
   Shared API helper for pages outside index.html.
   Requires app-config.js to define window.WEB_APP_URL.
   Integrates GET Bypass logic for write actions. */

(function () {
    const RAW_BASE = String(window.WEB_APP_URL || '').trim();
    // IMPORTANT: only remove trailing slashes/whitespace. Do NOT strip all slashes (breaks https://).
    const BASE = RAW_BASE.replace(/\/+$/g, '').replace(/\s+$/g, '');
    const BASE_OK = /^https?:\/\//i.test(BASE);

    // =========================
    // DEBUG (testing)
    // Set to true to print backend-provided `debugLog` arrays to the browser console.
    // Backend debug is enabled per-call (example): apiGet('ocmListMyListingsV2', { ..., dbg:1 })
    // =========================
    const API_DEBUG_LOGGING = false;

    function printBackendDebugLog_(label, resp) {
        if (!API_DEBUG_LOGGING) return;
        try {
            const d = resp?.data || resp?.result || resp;
            const lines = d?.debugLog;
            if (!Array.isArray(lines) || !lines.length) return;
            console.groupCollapsed(label);
            lines.forEach(l => console.log(l));
            console.groupEnd();
        } catch { /* ignore */ }
    }

    function missingBaseError_() {
        return new Error('WEB_APP_URL is not configured (missing app-config.js or empty WEB_APP_URL).');
    }

    // Actions that must be sent via GET to bypass POST blocks
    const BYPASS_ACTIONS = [
        'createRequest', 'createTradeRequest', 'cancelRequest',
        'approveRequest', 'denyRequest',
        'approveTrade', 'denyTrade',
        'adjustBalance', 'transferBT',
        'createListing', 'updateListing', 'deleteListing', 'toggleListingStatus',
        'adjustStock',

        // Account setup
        'linkPlayer',

        // Self account settings (NEW)
        'updateMyProfile',
        'deleteMyAccount',

        // Admin account editing
        'adminUpdateUserProfile',

        // OCM v2 (new)
        'ocmCreateListingV2', 'ocmUpdateListingV2',
        'ocmCreateTradeRequestV2', 'ocmUpdateTradeRequestV2', 'ocmCancelTradeRequestV2',
        'ocmApproveListingV2', 'ocmRejectListingV2', 'ocmCancelPendingListingV2',
      'ocmAcceptTradeAsSellerV2', 'ocmAcceptTradeAsAdminV2', 'ocmDenyTradeV2', 'ocmAdminCreateListingV2',

        // Admin OCM v2
        'ocmAdminUpdateListingV2',

        // Optional: mailbox/details enrichment endpoints (add these actions on backend if you implement them)
        'ocmEnrichTradeDetailsMailboxesV2',
        'ocmRepairTradeDetailsMailboxesV2',

        // Work pay rates (admin write)
        'workPayUpsert',

        // Infrastructure investment submission (admin-only)
        'submitInfraInvestment',

        // Insurance policy management
        'insuranceCreate',
        'insuranceRenamePolicy',
        'insuranceUpdateAllocation',
        'insuranceRequestDeposit',
        'insuranceRequestWithdrawUnits',
        'insuranceCancelPending',
        'insuranceAdminApprove',
        'insuranceAdminDeny',
        'insuranceRequestWithdrawMetals',
        'insuranceAdminForceWithdrawMetals',
        'insuranceAdminRenamePolicy',
        'insuranceAdminUpdateAllocation',
        'insuranceAdminDeposit',
        'insuranceAdminWithdrawUnits',
        'insuranceAdminCancelPending',
        'insuranceAdminCreate',
        'insuranceDelete',
        'insuranceAdminDelete',
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

        // Test/debug support: if backend included a debugLog array, optionally print it.
        printBackendDebugLog_('Backend debugLog', j);

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
        if (!BASE_OK) throw missingBaseError_();

        const url = new URL(BASE);
        url.searchParams.set('action', action);
        if (params && typeof params === 'object') {
            for (const [k, v] of Object.entries(params)) {
                if (v !== undefined && v !== null && v !== '') {
                    url.searchParams.set(k, String(v));
                }
            }
        }
        const r = await fetch(url.toString(), { method: 'GET' });
        const j = await readJsonOrThrow_(r);
        return normalize(j);
    }

    // Uses GET bypass if action is in list, otherwise standard POST
    async function apiPost(action, body) {
        if (!BASE_OK) throw missingBaseError_();

        if (BYPASS_ACTIONS.includes(action)) {
            return apiGetBypass(action, body);
        }

        const payload = { ...(body || {}), action };
        const r = await fetch(BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // Use text/plain to avoid OPTIONS preflight
            body: JSON.stringify(payload)
        });
        const j = await readJsonOrThrow_(r);
        return normalize(j);
    }

    function _encodeValueForBypass_(value) {
        if (typeof value === 'object' && value !== null) return JSON.stringify(value);
        if (value === undefined || value === null) return '';
        return String(value);
    }

    // Chunk large string into smaller pieces (for GET URL limits)
    function _chunkString_(s, chunkSize) {
        const out = [];
        for (let i =0; i < s.length; i += chunkSize) out.push(s.slice(i, i + chunkSize));
        return out;
    }

    // Send bypass using one or more GETs (chunked mode for big payloads).
    async function apiGetBypass(action, body) {
        if (!BASE_OK) throw missingBaseError_();

        // First try: single request (existing behavior)
        const trySingle = async () => {
            const url = new URL(BASE);
            url.searchParams.append('action', action);
            if (body) {
                for (const [key, value] of Object.entries(body)) {
                    const enc = _encodeValueForBypass_(value);
                    if (enc !== '') url.searchParams.append(key, enc);
                }
            }
            return url;
        };

        const url = await trySingle();
        if (url.toString().length <=1900) {
            const r = await fetch(url.toString(), { method: 'GET' });
            const j = await readJsonOrThrow_(r);
            return normalize(j);
        }

        // Chunk fallback: split `payload` only (common large field). Requires backend support.
        const payloadStr = body && Object.prototype.hasOwnProperty.call(body, 'payload')
? _encodeValueForBypass_(body.payload)
: '';

        if (!payloadStr) {
            console.warn('URL length exceeds limit but no `payload` field to chunk. Request may fail.');
            const r = await fetch(url.toString(), { method: 'GET' });
            const j = await readJsonOrThrow_(r);
            return normalize(j);
        }

        const reqId = 'bp_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        const chunks = _chunkString_(payloadStr,800);

        //1) send chunks
        for (let i =0; i < chunks.length; i++) {
            const u = new URL(BASE);
            u.searchParams.set('action', 'bypassChunk');
            u.searchParams.set('targetAction', action);
            u.searchParams.set('reqId', reqId);
            u.searchParams.set('i', String(i));
            u.searchParams.set('n', String(chunks.length));
            u.searchParams.set('payloadChunk', chunks[i]);

            // include small fields on every chunk (idToken, recaptchaToken etc.)
            if (body) {
                for (const [key, value] of Object.entries(body)) {
                    if (key === 'payload') continue;
                    const enc = _encodeValueForBypass_(value);
                    if (enc !== '') u.searchParams.set(key, enc);
                }
            }

            if (u.toString().length >2000) {
                throw new Error('Chunk URL still exceeds2000 chars. Reduce chunk size.');
            }

            const rr = await fetch(u.toString(), { method: 'GET' });
            const jj = await readJsonOrThrow_(rr);
            if (!jj || jj.ok !== true) {
                return normalize(jj);
            }
        }

        //2) finalize (executes upstream action with reassembled payload)
        const fin = new URL(BASE);
        fin.searchParams.set('action', 'bypassChunkFinalize');
        fin.searchParams.set('targetAction', action);
        fin.searchParams.set('reqId', reqId);
        if (body) {
            for (const [key, value] of Object.entries(body)) {
                if (key === 'payload') continue;
                const enc = _encodeValueForBypass_(value);
                if (enc !== '') fin.searchParams.set(key, enc);
            }
        }

        const r = await fetch(fin.toString(), { method: 'GET' });
        const j = await readJsonOrThrow_(r);
        return normalize(j);
    }

    // expose
    window.apiGet = apiGet;
    window.apiPost = apiPost;
})();
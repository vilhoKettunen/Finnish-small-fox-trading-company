// Request payload, submit, import/export, and open orders
(function () {
    'use strict';

    // --- Submit guard state ---
    let _submitCooldownUntil = 0;
    let _submitInFlight = false;

    function _getSubmitBtn() {
     return document.getElementById('btnSubmitRequest');
    }

    function _setSubmitBtnDisabled(disabled) {
        const btn = _getSubmitBtn();
        if (btn) btn.disabled = disabled;
    }

  window.buildRequestPayload = window.buildRequestPayload || function buildRequestPayload() {
        const mapRow = r => ({
            name: r.name,
            qty: r.qty,
        priceBT: r.price,
   bundleSize: r.bundleSize || null,
     source: r.source || 'STORE',
  isBalance: !!r.isBalance
     });

      const buyRowsForSend = (window.buyCart || []).filter(r => !r.isAccountBalancePinned).map(mapRow);
        const sellRowsForSend = (window.sellCart || []).filter(r => !r.isAccountBalancePinned).map(mapRow);

        const buyEW = buyRowsForSend.reduce((s, i) => s + (i.priceBT * i.qty), 0);
        const sellEW = sellRowsForSend.reduce((s, i) => s + (i.priceBT * i.qty), 0);
        const netEW = sellEW - buyEW;

        // Read expected balance-after from the Combined Totals DOM element
        const afterEl = document.getElementById('accountBalanceAfter');
        const afterEW = afterEl ? (parseFloat(afterEl.dataset.raw) || null) : null;

    const manualBuyBal = (window.buyCart || []).filter(r => r.isBalance && !r.isAccountBalancePinned).reduce((s, r) => s + (r.price * r.qty), 0);
        const manualSellBal = (window.sellCart || []).filter(r => r.isBalance && !r.isAccountBalancePinned).reduce((s, r) => s + (r.price * r.qty), 0);
        const manualBalanceDeltaBT = manualSellBal - manualBuyBal;

    const isAdminOnBehalf = !!(window.currentUser?.isAdmin && window.submitForUser);

        const baseUser = isAdminOnBehalf
            ? window.submitForUser
       : {
        userId: window.currentUser?.userId,
         email: window.currentUser?.email,
        playerName: window.currentUser?.playerName,
                mailbox: window.currentUser?.mailbox
            };

        return {
          requestId: window.cryptoRandomId(),
            createdAt: new Date().toISOString(),
       user: baseUser,
         carts: { buy: buyRowsForSend, sell: sellRowsForSend },
     totals: { buyEW, sellEW, netEW, afterEW },
      creator: isAdminOnBehalf ? 'Admin' : 'User',
            manualBalanceDeltaBT,
         priceSource: { sheetId: 'PRICE_SHEET', asOf: new Date().toISOString() },
            editedFromRequestId: window.editedFromRequestId || null,
            meta: isAdminOnBehalf ? {
      submittedByAdmin: true,
      adminEmail: window.currentUser?.email
    } : null
        };
    };

    window.guardedSubmitPurchaseRequest = window.guardedSubmitPurchaseRequest || function guardedSubmitPurchaseRequest() {
        // Guard: require login
        if (!window.googleIdToken) { alert('You need to login for this tool'); return; }

        const isAdmin = !!(window.currentUser?.isAdmin);

        // Admins are unrestricted for rate-limit/cooldown; keep existing behavior for them.
        if (!isAdmin) {
            // If a submission is already in-flight, ignore extra clicks.
            if (_submitInFlight) return;

            // If client-side cooldown is active, show remaining time and stop.
            if (Date.now() < _submitCooldownUntil) {
                const secsLeft = Math.ceil((_submitCooldownUntil - Date.now()) / 1000);
                document.getElementById('requestMsg').textContent =
                    `⏳ Please wait ${secsLeft} second(s) before sending another request.`;
                return;
            }

            // NEW: Ask user to confirm or cancel submission.
            // This uses the native confirm dialog to keep integration minimal.
            const confirmMsg = 'Confirm submit transaction request?\n\nClick OK to send the request now, or Cancel to return and review your request.';
            const ok = window.confirm(confirmMsg);

            if (!ok) {
                // User cancelled — show an informative message and do nothing.
                const el = document.getElementById('requestMsg');
                if (el) el.textContent = 'Submission canceled.';
                return;
            }

            // User confirmed — give immediate feedback while submitPurchaseRequest
            // prepares/enters the in-flight state.
            const el = document.getElementById('requestMsg');
            if (el) el.textContent = '📤 Sending request... (please wait)';
        } else {
            // Optional: admins may want an explicit quick visual as well.
            const el = document.getElementById('requestMsg');
            if (el) el.textContent = '📤 Sending request... (admin)';
        }

        // Trigger the actual submit handler (it contains the existing in-flight/cooldown logic).
        window.submitPurchaseRequest();
    };

    window.guardedCopyTransactionData = window.guardedCopyTransactionData || function guardedCopyTransactionData() {
        if (!window.googleIdToken) { alert('You need to login for this tool'); return; }
        window.copyTransactionData();
 };

    window.submitPurchaseRequest = window.submitPurchaseRequest || function submitPurchaseRequest() {
        const payload = window.buildRequestPayload();
        const skipCaptcha = window.currentUser && window.currentUser.captchaPassed;
        const isAdmin = !!(window.currentUser?.isAdmin);

        const msgEl = document.getElementById('requestMsg');

   // --- Enter in-flight state (non-admin only) ---
        if (!isAdmin) {
         _submitInFlight = true;
            _setSubmitBtnDisabled(true);
    if (msgEl) msgEl.textContent = '📤 Sending request...';
    }

   const doRequestViaGet = (tokenOrNull) => {
        if (tokenOrNull) payload.recaptchaToken = tokenOrNull;

      const url = new URL(window.WEB_APP_URL);
         url.searchParams.append('action', 'createRequest');
 url.searchParams.append('idToken', window.googleIdToken);
        url.searchParams.append('payload', JSON.stringify(payload));

            if (window.currentUser?.isAdmin && window.submitForUser) {
  url.searchParams.append('onBehalfOf', JSON.stringify(payload.user));
     }

   return fetch(url.toString(), {
method: 'GET',
      headers: { 'Content-Type': 'text/plain' }
    });
    };

        const getCaptchaToken = () => {
 if (skipCaptcha) return Promise.resolve(null);
 if (typeof window.recaptchaWrap === 'function') return window.recaptchaWrap('createRequest');
 return Promise.resolve(null);
 };

 getCaptchaToken()
 .then(token => doRequestViaGet(token))
 .then(r => r.json())
            .then(j => {
        // Backend rate-limited: the first request already went through
  if (!j.ok && j.error === 'RATE_LIMITED') {
       if (msgEl) msgEl.textContent =
        '✅ Your request was already submitted and is being processed. ID: ' + (payload.requestId || '');
       if (!isAdmin) {
       _submitCooldownUntil = Date.now() + 60000;
    }
      return;
    }

        if (!j.ok) throw new Error(j.error);

      const responseData = j.data || j.result || {};
    const finalId = responseData.requestId || payload.requestId;

    if (msgEl) msgEl.textContent = '✅ Request submitted. ID: ' + finalId;
                window.editedFromRequestId = null;
       window.refreshOpenOrders && window.refreshOpenOrders();

                // Start cooldown for non-admin users
     if (!isAdmin) {
    _submitCooldownUntil = Date.now() + 60000;
    }
   })
       .catch(e => {
console.error(e);
                if (msgEl) msgEl.textContent = 'Error: ' + e.message;
    // No cooldown on network/server errors — let user retry immediately
      })
            .finally(() => {
  // Always release in-flight lock and re-enable button
       if (!isAdmin) {
        _submitInFlight = false;
   _setSubmitBtnDisabled(false);
         }
            });
    };

    window.copyTransactionData = window.copyTransactionData || function copyTransactionData() {
        const payload = window.buildRequestPayload();
        navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
     .then(() => document.getElementById('requestMsg').textContent = 'Transaction data copied.')
            .catch(e => document.getElementById('requestMsg').textContent = 'Copy failed: ' + e.message);
    };

    window.clearAllCarts = window.clearAllCarts || function clearAllCarts() {
        // Clear both buy and sell carts (preserving no rows, including any stale pinned rows).
        window.buyCart = [];
        window.sellCart = [];
   try { window.renderBuyList && window.renderBuyList(); } catch { }
 try { window.renderSellList && window.renderSellList(); } catch { }
        try { window.calculateNet && window.calculateNet(); } catch { }
        const msgEl = document.getElementById('requestMsg');
  if (msgEl) msgEl.textContent = 'Carts cleared.';
    };

    window.importTransactionData = window.importTransactionData || async function importTransactionData() {
        if (!window.googleIdToken) { alert('You need to login for this tool'); return; }
        try {
     if (navigator.clipboard?.readText) {
     const txt = (await navigator.clipboard.readText()) || '';
 if (txt.trim()) { await window.importTransactionDataFromText(txt); return; }
         }
    } catch { }

    const pasted = window.prompt('Paste transaction JSON (from Copy Transaction Data), or leave empty to choose a file:');
        if (pasted && pasted.trim()) { await window.importTransactionDataFromText(pasted); return; }
        const fileEl = document.getElementById('importFile');
   if (fileEl) fileEl.click(); else alert('File input not found.');
    };

    window.importTransactionDataFromFile = window.importTransactionDataFromFile || async function importTransactionDataFromFile(file) {
        if (!file) return;
     try {
            const txt = await file.text();
     await window.importTransactionDataFromText(txt);
        } catch (e) {
    document.getElementById('requestMsg').textContent = 'Import failed: ' + e.message;
        } finally {
         const fileEl = document.getElementById('importFile');
     if (fileEl) fileEl.value = '';
        }
    };

    window.importTransactionDataFromText = window.importTransactionDataFromText || async function importTransactionDataFromText(txt) {
        try {
 const payload = JSON.parse(txt);
    window.loadTransactionPayloadIntoEditor(payload);
   document.getElementById('requestMsg').textContent = 'Transaction data imported.';
   } catch (e) {
       document.getElementById('requestMsg').textContent = 'Invalid JSON: ' + e.message;
        }
    };

 window.loadTransactionPayloadIntoEditor = window.loadTransactionPayloadIntoEditor || function loadTransactionPayloadIntoEditor(payload) {
        const asNumber = v => { const n = Number(v); return isFinite(n) ? n : 0; };

        let buyRows = [];
    let sellRows = [];

        if (payload && payload.carts && (Array.isArray(payload.carts.buy) || Array.isArray(payload.carts.sell))) {
     buyRows = (payload.carts.buy || []).map(r => ({
      name: r.name,
   qty: asNumber(r.qty),
  price: asNumber(r.priceBT),
     bundleSize: r.bundleSize || null,
                source: r.source || 'STORE',
     isBalance: !!r.isBalance
         }));
            sellRows = (payload.carts.sell || []).map(r => ({
             name: r.name,
      qty: asNumber(r.qty),
            price: asNumber(r.priceBT),
 bundleSize: r.bundleSize || null,
                source: r.source || 'STORE',
    isBalance: !!r.isBalance
    }));
        } else if (Array.isArray(payload?.items)) {
 payload.items.forEach(it => {
    const row = {
  name: it.itemName || it.name || 'Unknown',
       qty: asNumber(it.quantity ?? it.qty),
  price: asNumber(it.price ?? it.priceBT),
           bundleSize: it.bundleSize || null,
       source: it.source || 'STORE',
            isBalance: !!it.isBalance
                };
      if (String(it.side).toLowerCase() === 'buy') buyRows.push(row);
                else if (String(it.side).toLowerCase() === 'sell') sellRows.push(row);
          });
} else {
            document.getElementById('requestMsg').textContent = 'Unsupported payload shape.';
 return;
        }

        window.buyCart = [];
        window.sellCart = [];

      const pinned = window.sellCart.find(r => r.isAccountBalancePinned);

      buyRows.forEach(r => {
 if (r.bundleSize && !isNaN(r.bundleSize) && r.bundleSize > 0) {
         window.buyCart.push({ name: r.name, qty: r.qty, bundleSize: r.bundleSize, price: r.price, source: r.source || 'CUSTOM' });
   } else {
         window.buyCart.push({ name: r.name, qty: r.qty, price: r.price, source: r.source || 'STORE' });
            }
        });

        let importedSell = sellRows.map(r => {
          const row = r.bundleSize && !isNaN(r.bundleSize) && r.bundleSize > 0
   ? { name: r.name, qty: r.qty, bundleSize: r.bundleSize, price: r.price, source: r.source || 'CUSTOM' }
  : { name: r.name, qty: r.qty, price: r.price, source: r.source || 'STORE' };
    if (r.isBalance || r.name === 'Account Balance') { row.isBalance = true; row.source = 'BALANCE'; }
 return row;
        });

        if (pinned) {
            window.sellCart.push(pinned);
            importedSell = importedSell.filter(r => !r.isAccountBalancePinned);
        }

        window.sellCart.push(...importedSell);

        window.editedFromRequestId = payload.requestId || payload.editedFromRequestId || null;

      if (window.currentUser?.isAdmin && payload.user && (payload.user.userId || payload.user.email || payload.user.playerName)) {
     window.submitForUser = {
                userId: payload.user.userId || null,
   email: payload.user.email || null,
      playerName: payload.user.playerName || null,
       mailbox: payload.user.mailbox || null
        };
            window.refreshPinnedBalanceForActiveTarget().catch(() => { });
     window.refreshTopBarBalances().catch(() => { });
      }

 window.updateAllDisplays();
    };

})();
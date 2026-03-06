// index_js/index-infra.js
// Admin-only Infrastructure Investment submission tool (shown on index.html).
(function () {
    'use strict';

    window.showInfraSection = function showInfraSection() {
     const el = document.getElementById('infraInvestSection');
        if (el) el.style.display = 'block';
    };

    window.hideInfraSection = function hideInfraSection() {
        const el = document.getElementById('infraInvestSection');
        if (el) el.style.display = 'none';
    };

    window.updateInfraCartPreview = function updateInfraCartPreview() {
        const preview = document.getElementById('infraCartPreview');
        if (!preview) return;

 const cart = window.buyCart || [];
        const storeItems = cart.filter(e => !e.isBalance && e.source !== 'OCM');

        if (storeItems.length === 0) {
            preview.textContent = 'No items in buy cart yet.';
   return;
        }

        const lines = storeItems.map(e => {
       if (e.bundleSize && e.bundleSize > 1) {
          return `${e.qty} x ${e.bundleSize} ${e.name}`;
      }
            return `${e.qty} x ${e.name}`;
  });

        const ewTotal = storeItems.reduce((sum, e) => {
        const rowTotal = (e.bundleSize && !e.isFullyCustom)
    ? e.qty * e.price
      : (e.bundleSize && e.isFullyCustom)
                ? (e.qty / e.bundleSize) * e.price
      : e.qty * e.price;
            return sum + (isFinite(rowTotal) ? rowTotal : 0);
        }, 0);

      preview.innerHTML = `<strong>Cart items:</strong> ${lines.join(', ')}<br>
          <strong>EW Total:</strong> ${ewTotal.toFixed(2)} EW`;
    };

    window.submitInfraInvestment = async function submitInfraInvestment() {
        const msgEl    = document.getElementById('infraMsg');
        const btn      = document.getElementById('btnInfraSubmit');
   const shortEl  = document.getElementById('infraShortDesc');
        const longEl   = document.getElementById('infraLongDesc');

        if (!msgEl || !btn || !shortEl || !longEl) return;

        const shortDescription = shortEl.value.trim();
     const longDescription  = longEl.value.trim();

        if (!shortDescription) { msgEl.textContent = 'Short description is required.'; return; }
        if (shortDescription.length > 100) { msgEl.textContent = 'Short description must be ? 100 chars.'; return; }
        if (!longDescription)  { msgEl.textContent = 'Long description is required.'; return; }
        if (longDescription.length > 2000) { msgEl.textContent = 'Long description must be ? 2000 chars.'; return; }

        if (!window.googleIdToken) { msgEl.textContent = 'You must be logged in as admin.'; return; }

        const cart = window.buyCart || [];
        const storeItems = cart.filter(e => !e.isBalance && e.source !== 'OCM');
   if (storeItems.length === 0) {
    msgEl.textContent = 'Add at least one item to the Buy cart before submitting.';
         return;
        }

        // Build itemsJson array
    const itemsJson = storeItems.map(e => ({
     name:    e.name,
      qty:   e.qty,
        bundleSize: e.bundleSize || 1,
   priceBT:    e.price
        }));

     const ewTotal = storeItems.reduce((sum, e) => {
            const rowTotal = (e.bundleSize && !e.isFullyCustom)
    ? e.qty * e.price
        : (e.bundleSize && e.isFullyCustom)
         ? (e.qty / e.bundleSize) * e.price
            : e.qty * e.price;
    return sum + (isFinite(rowTotal) ? rowTotal : 0);
  }, 0);

     // Disable button to prevent double-submit
        btn.disabled = true;
    msgEl.textContent = 'Submitting…';

  try {
            const result = await window.apiPost('submitInfraInvestment', {
   idToken: window.googleIdToken,
     payload: {
          shortDescription,
longDescription,
      itemsJson,
      ewTotal: parseFloat(ewTotal.toFixed(2))
           }
            });

            if (!result || !result.ok) throw new Error(result && result.error ? result.error : 'Unknown error');

msgEl.style.color = '#2e7d32';
            msgEl.textContent = `? Investment submitted (ID: ${result.investmentId}). Cart cleared.`;

   // Clear the buy cart store items
          window.buyCart = (window.buyCart || []).filter(e => e.isBalance || e.source === 'OCM');
          window.renderBuyList && window.renderBuyList();
  window.updateInfraCartPreview && window.updateInfraCartPreview();

shortEl.value = '';
            longEl.value  = '';
        } catch (e) {
            msgEl.style.color = '#c00';
    msgEl.textContent = 'Error: ' + (e.message || e);
       btn.disabled = false;
        }
    };

})();

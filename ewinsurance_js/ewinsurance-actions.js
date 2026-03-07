/* ewinsurance_js/ewinsurance-actions.js
   Event wiring for EW Insurance page.
   Depends on ewinsurance-core.js and ewinsurance-ui.js
*/

(function () {
    'use strict';

    // ===== Helpers =====

    function idToken() { return window.EWIns.state.idToken; }

    function safeJsonParse(s, fb) {
  try { return JSON.parse(s); } catch (e) { return fb; }
    }

    function validatePolicyName_(name) {
      return /^[a-zA-Z0-9 ]{1,40}$/.test(String(name || ''));
    }

    async function reloadPage_() {
     await window.EWIns.loadPolicies();
    window.EWIns.renderAll();
    }

    // ===== Create Policy =====

  async function createPolicy() {
  try {
    await window.apiPost('insuranceCreate', { idToken: idToken() });
         await reloadPage_();
        } catch (e) {
       alert('Error creating policy: ' + e.message);
        }
    }

    // ===== Rename Policy =====

    async function renamePolicy(inner) {
 const insuranceId = inner.dataset.id;
        const inp      = inner.querySelector('.policy-name-input');
        const notifier = inner.querySelector('.rename-notifier');
        const name     = inp ? inp.value.trim() : '';

        if (!validatePolicyName_(name)) {
    if (notifier) { notifier.textContent = 'Error: Name may only contain letters, numbers and spaces (max 40 chars).'; notifier.style.color = '#c00'; }
    else alert('Policy name may only contain letters, numbers and spaces (max 40 characters).');
         return;
     }

        if (notifier) { notifier.textContent = 'Now saving...'; notifier.style.color = '#888'; }

      try {
            await window.apiPost('insuranceRenamePolicy', {
      idToken: idToken(),
       insuranceId,
            policyName: name
        });
    if (notifier) { notifier.textContent = 'Now saved as ' + name; notifier.style.color = '#155724'; }
       // Update the row label without full reload to keep notifier visible
      await window.EWIns.loadPolicies();
   window.EWIns.renderAll();
        } catch (e) {
        if (notifier) { notifier.textContent = 'Error: ' + e.message; notifier.style.color = '#c00'; }
     else alert('Rename failed: ' + e.message);
        }
    }

    // ===== Save Allocation =====

    async function saveAllocation(inner) {
 const insuranceId = inner.dataset.id;
        const notifier    = inner.querySelector('.alloc-notifier');
const inputs   = inner.querySelectorAll('.alloc-input');
        const allocObj    = {};
        let sum = 0;

        inputs.forEach(inp => {
            const metal = inp.dataset.metal;
     const val   = parseFloat(inp.value) || 0;
            if (val > 0) allocObj[metal] = val;
            sum += val;
     });

        if (sum > 100) {
      if (notifier) { notifier.textContent = 'Error: Allocation exceeds 100%.'; notifier.style.color = '#c00'; }
     else alert('Allocation exceeds 100%.');
            return;
   }

        if (notifier) { notifier.textContent = 'Now saving...'; notifier.style.color = '#888'; }

        try {
            await window.apiPost('insuranceUpdateAllocation', {
 idToken:        idToken(),
                insuranceId,
            allocationJson: JSON.stringify(allocObj)
            });

     // Build summary string for notifier
   const summary = Object.entries(allocObj)
      .filter(([, v]) => Number(v) > 0)
    .map(([k, v]) => k + ' ' + v + '%')
      .join(', ');

     if (notifier) { notifier.textContent = 'Now saved: ' + (summary || '(empty)'); notifier.style.color = '#155724'; }
        await window.EWIns.loadPolicies();
            window.EWIns.renderAll();
        } catch (e) {
            if (notifier) { notifier.textContent = 'Error: ' + e.message; notifier.style.color = '#c00'; }
      else alert('Save allocation failed: ' + e.message);
        }
    }

    // ===== Request Deposit =====

    async function requestDeposit(inner) {
     const insuranceId = inner.dataset.id;
    const inp   = inner.querySelector('.deposit-units-input');
        const units = parseInt(inp ? inp.value : 1, 10);
        const cost  = units * 500;
  const balance = window.EWIns.state.balance || 0;

      if (!Number.isInteger(units) || units < 1) {
            alert('Units must be a positive integer.');
   return;
        }

   if (balance < cost) {
     alert(`Insufficient balance. You need ${cost} EW but have ${balance} EW.`);
return;
     }

        try {
   await window.apiPost('insuranceRequestDeposit', {
         idToken:     idToken(),
       insuranceId,
  requestedUnits: units
      });
  await reloadPage_();
    } catch (e) {
    alert('Deposit request failed: ' + e.message);
   }
    }

    // ===== Request Withdrawal =====

    async function requestWithdraw(inner) {
  const insuranceId = inner.dataset.id;
    const inp   = inner.querySelector('.withdraw-units-input');
        const units = parseInt(inp ? inp.value : 1, 10);

  if (!Number.isInteger(units) || units < 1) {
  alert('Withdraw units must be a positive integer.');
      return;
      }

        const stored = safeJsonParse(
    (window.EWIns.state.policies.find(p => p.InsuranceID === insuranceId) || {}).StoredJson,
  { units: 0 }
     );
   if (units > stored.units) {
    alert(`Cannot withdraw more than ${stored.units} unit(s).`);
          return;
   }

    try {
await window.apiPost('insuranceRequestWithdrawUnits', {
      idToken:      idToken(),
   insuranceId,
       withdrawUnits: units
   });
     await reloadPage_();
     } catch (e) {
 alert('Withdrawal request failed: ' + e.message);
        }
    }

    // ===== Request Metals Withdrawal =====

    async function requestWithdrawMetals(inner) {
        const insuranceId = inner.dataset.id;
        if (!confirm('Are you sure? Your EW balance will NOT be credited. This closes the insured position after admin approval.')) return;
        try {
         await window.apiPost('insuranceRequestWithdrawMetals', {
    idToken: idToken(),
            insuranceId
       });
 await reloadPage_();
   } catch (e) {
            alert('Metals withdrawal request failed: ' + e.message);
      }
    }

  // ===== Cancel Pending =====

    async function cancelPending(inner) {
     const insuranceId = inner.dataset.id;
if (!confirm('Cancel the pending request for this policy?')) return;
        try {
  await window.apiPost('insuranceCancelPending', {
        idToken: idToken(),
      insuranceId
      });
      await reloadPage_();
 } catch (e) {
  alert('Cancel failed: ' + e.message);
 }
 }

    // ===== Delete Policy =====

    async function deletePolicy(inner) {
     const insuranceId = inner.dataset.id;
        if (!confirm('Permanently delete this policy? This cannot be undone.')) return;
        try {
await window.apiPost('insuranceDelete', { idToken: idToken(), insuranceId });
            await reloadPage_();
        } catch (e) {
   alert('Delete failed: ' + e.message);
        }
 }

    // ===== Wire Events to a details inner container =====

  function wireInner_(inner) {
        inner.querySelector('.btn-rename')?.addEventListener('click', () => renamePolicy(inner));
    inner.querySelector('.btn-save-alloc')?.addEventListener('click', () => saveAllocation(inner));
        inner.querySelector('.btn-deposit')?.addEventListener('click', () => requestDeposit(inner));
     inner.querySelector('.btn-withdraw')?.addEventListener('click', () => requestWithdraw(inner));
    inner.querySelector('.btn-withdraw-metals')?.addEventListener('click', () => requestWithdrawMetals(inner));
    inner.querySelector('.btn-cancel-pending')?.addEventListener('click', () => cancelPending(inner));
      inner.querySelector('.btn-delete-policy')?.addEventListener('click', () => deletePolicy(inner));
    }

  function wireAll_() {
   document.querySelectorAll('.ins-details-inner').forEach(wireInner_);

   // Create button — clone to remove stale listeners
const createBtn = document.getElementById('btnCreatePolicy');
   if (createBtn) {
const fresh = createBtn.cloneNode(true);
     createBtn.parentNode.replaceChild(fresh, createBtn);
  fresh.addEventListener('click', createPolicy);
  }
    }

    // Override renderAll to also wire after render
    const _origRenderAll = window.EWIns.renderAll;
    window.EWIns.renderAll = function () {
    _origRenderAll();
     wireAll_();
    };

 // Wire on DOM ready
    document.addEventListener('DOMContentLoaded', wireAll_);
    if (document.readyState !== 'loading') wireAll_();

})();

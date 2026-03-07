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
        // wireAll_ is called inside the overridden renderAll below
    }

    function showMsg_(el, txt, isErr) {
     if (!el) return;
     el.textContent = txt;
        el.style.color = isErr ? '#c00' : '#155724';
        setTimeout(() => { if (el.textContent === txt) el.textContent = ''; }, 4000);
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
        const inp  = inner.querySelector('.policy-name-input');
  const name = inp ? inp.value.trim() : '';
   if (!validatePolicyName_(name)) {
   alert('Policy name may only contain letters, numbers and spaces (max 40 characters).');
   return;
        }
   try {
    await window.apiPost('insuranceRenamePolicy', {
   idToken: idToken(),
      insuranceId,
       policyName: name
    });
   await reloadPage_();
 } catch (e) {
     alert('Rename failed: ' + e.message);
        }
    }

    // ===== Save Allocation =====

    async function saveAllocation(inner) {
        const insuranceId = inner.dataset.id;
   const inputs = inner.querySelectorAll('.alloc-input');
        const allocObj = {};
    let sum = 0;
        inputs.forEach(inp => {
      const metal = inp.dataset.metal;
    const val   = parseFloat(inp.value) || 0;
   if (val > 0) allocObj[metal] = val;
       sum += val;
        });

        if (sum > 100) {
          alert('Allocation exceeds 100%.');
            return;
        }

  try {
         await window.apiPost('insuranceUpdateAllocation', {
        idToken:        idToken(),
    insuranceId,
      allocationJson: JSON.stringify(allocObj)
       });
     await reloadPage_();
        } catch (e) {
   alert('Save allocation failed: ' + e.message);
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

        // Client-side guard vs stored units
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

    // ===== Wire Events to a details inner container =====

  function wireInner_(inner) {
        inner.querySelector('.btn-rename')?.addEventListener('click', () => renamePolicy(inner));
    inner.querySelector('.btn-save-alloc')?.addEventListener('click', () => saveAllocation(inner));
        inner.querySelector('.btn-deposit')?.addEventListener('click', () => requestDeposit(inner));
     inner.querySelector('.btn-withdraw')?.addEventListener('click', () => requestWithdraw(inner));
    inner.querySelector('.btn-cancel-pending')?.addEventListener('click', () => cancelPending(inner));
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

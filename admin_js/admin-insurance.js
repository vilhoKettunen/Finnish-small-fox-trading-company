// admin_js/admin-insurance.js
// Admin: Insurance Requests tab
(function () {
    'use strict';

    const Admin = window.Admin;
    const byId = Admin.byId;
    const esc = Admin.esc;
    const safeJsonParse = Admin.safeJsonParse;

    function fmtMetalsList_(metalsObj) {
     if (!metalsObj || !Object.keys(metalsObj).length) return '<em>None</em>';
  const parts = [];
   for (const [name, data] of Object.entries(metalsObj)) {
   if (!data) continue;
         const ingots  = Number(data.ingots  || 0);
      const nuggets = Number(data.nuggets || 0);
            const insEW   = Number(data.insuredEW  || 0);
   const leftEW  = Number(data.leftoverEW || 0);
     let line = `<strong>${esc(name)}</strong>: ${ingots} ingot${ingots !== 1 ? 's' : ''}`;
         if (nuggets > 0) line += `, ${nuggets} nugget${nuggets !== 1 ? 's' : ''}`;
        line += ` (${insEW} EW covered`;
            if (leftEW > 0) line += `, <span class="warn">${leftEW} EW uninsured</span>`;
      line += ')';
    parts.push('<div>' + line + '</div>');
   }
        return parts.join('') || '<em>None</em>';
    }

function renderInsurancePendingTable_(policies) {
        const tb = byId('tbInsuranceRequests');
        tb.innerHTML = '';

        if (!policies || !policies.length) {
        tb.innerHTML = '<tr><td colspan="11" class="small">No pending insurance requests.</td></tr>';
  return;
  }

        policies.forEach(policy => {
            const temp  = safeJsonParse(policy.TempJson   || '{}', {});
            const stored  = safeJsonParse(policy.StoredJson || '{}', {});
    const liveMetals  = policy.liveMetals  || { metals: {} };
const oldMetals   = policy.oldMetals   || stored.metals || {};
  const liveBalance = policy.liveBalance != null ? policy.liveBalance : '?';

    // Units change display
let unitsChange = '?';
 if (temp.type === 'DEPOSIT') {
      unitsChange = '+' + (temp.requestedUnits || 0) + ' unit(s)';
         } else if (temp.type === 'WITHDRAW_ALL') {
      unitsChange = '-' + (stored.units || 0) + ' unit(s) (all)';
            } else if (temp.type === 'WITHDRAW_PARTIAL') {
        unitsChange = '-' + (temp.withdrawUnits || 0) + ' unit(s)';
 } else if (temp.type === 'REALLOC') {
      unitsChange = 'Reallocation';
            } else if (temp.type === 'WITHDRAW_METALS') {
     unitsChange = '-' + (stored.units || 0) + ' unit(s) (metals withdrawal)';
}

         // Cost for DEPOSIT (to colour balance)
    const depositCost = temp.type === 'DEPOSIT'
      ? (Number(temp.requestedUnits || 0) * 500)
          : 0;
    const balanceLow = temp.type === 'DEPOSIT' &&
      typeof liveBalance === 'number' && liveBalance < depositCost;

        // Request type badge
   const typeColors = {
      DEPOSIT:          'background:#c3e6cb;color:#155724',
          WITHDRAW_PARTIAL: 'background:#ffeeba;color:#856404',
           WITHDRAW_ALL:     'background:#f5c6cb;color:#721c24',
       REALLOC:    'background:#bee5eb;color:#0c5460',
       WITHDRAW_METALS:  'background:#e2d9f3;color:#4a235a'
   };
       const typeBadge = `<span class="pill" style="${typeColors[temp.type] || ''};padding:2px 8px;border-radius:10px;">${esc(temp.type || '?')}</span>`;

        // Extra note for WITHDRAW_METALS
        const typeNote = temp.type === 'WITHDRAW_METALS'
            ? '<br><span style="font-size:0.8em;color:#4a235a;">No EW credited &mdash; physical metals collected</span>'
    : (temp.type === 'REALLOC' ? '<br><span style="font-size:0.8em;color:#856404;">&#x26A0; Physical metals change required</span>' : '');

     // Player display
  const playerName = esc(policy.Username || policy.UserID || '?');

   const row = document.createElement('tr');
       row.innerHTML = `
     <td class="mono" style="font-size:0.78em;">${esc(policy.InsuranceID || '?')}</td>
    <td>${playerName}</td>
      <td>${esc(policy.PolicyName || '?')}</td>
  <td>${typeBadge}${typeNote}</td>
          <td class="mono">${esc(policy.InsuranceEW || 0)} EW</td>
 <td class="mono">${esc(unitsChange)}</td>
      <td class="mono" style="${balanceLow ? 'color:#c00;font-weight:bold;' : ''}">${esc(String(liveBalance))} EW${balanceLow ? ' &#x26A0; LOW' : ''}</td>
 <td>
  <details>
           <summary class="small">Previous metals</summary>
   <div class="small">${fmtMetalsList_(oldMetals)}</div>
  </details>
         </td>
<td>
    <details>
            <summary class="small">New metals</summary>
    <div class="small">${fmtMetalsList_(liveMetals.metals || {})}</div>
  ${(liveMetals.totalLeftoverEW > 0) ? `<div class="small warn">Uninsured EW: ${liveMetals.totalLeftoverEW}</div>` : ''}
   </details>
  </td>
       <td class="small mono">${esc(temp.submittedAt || '?')}</td>
          <td>
     <button type="button" data-approve="1">Approve</button>
    <button type="button" data-deny="1" style="background:#e74c3c;">Deny</button>
       </td>
  `;

       row.querySelector('[data-approve]').addEventListener('click', async () => {
         if (!confirm('Approve insurance request for policy ' + (policy.PolicyName || policy.InsuranceID) + '?')) return;
    try {
     await window.apiPost('insuranceAdminApprove', {
            idToken:     Admin.state.googleIdToken,
        insuranceId: policy.InsuranceID
 });
         await window.loadAdminInsurancePending();
    } catch (e) {
          alert('Error: ' + e.message);
       }
      });

   row.querySelector('[data-deny]').addEventListener('click', async () => {
     if (!confirm('Deny insurance request for policy ' + (policy.PolicyName || policy.InsuranceID) + '?')) return;
    try {
     await window.apiPost('insuranceAdminDeny', {
        idToken:   Admin.state.googleIdToken,
  insuranceId: policy.InsuranceID
       });
    await window.loadAdminInsurancePending();
      } catch (e) {
      alert('Error: ' + e.message);
          }
        });

     tb.appendChild(row);
      });
    }

    function renderForceWithdrawUI_() {
        const container = byId('insuranceForceWithdrawSection');
  if (!container) return;
        container.innerHTML = `
<div style="margin-top:18px;padding:12px 16px;border:1px solid #e0c36a;border-radius:6px;background:rgba(255,243,205,0.85);">
  <strong>Force Metals Withdrawal</strong>
  <p class="small" style="margin:4px 0 8px;">Use when a player collected insured metals without submitting a request.
  No EW is credited. The policy is immediately set to Empty.</p>
  <label style="font-size:0.9rem;">Policy ID:
    <input id="forceWithdrawPolicyId" type="text" placeholder="ins:..." style="margin-left:6px;min-width:260px;padding:3px 6px;">
  </label>
  <button id="btnForceWithdrawMetals" type="button" style="margin-left:8px;background:#856404;color:#fff;border:none;padding:4px 14px;border-radius:4px;cursor:pointer;">
    Force Metals Withdrawal
  </button>
  <span id="forceWithdrawMsg" style="margin-left:10px;font-size:0.88em;"></span>
</div>`;

        byId('btnForceWithdrawMetals').addEventListener('click', async () => {
        const insuranceId = (byId('forceWithdrawPolicyId').value || '').trim();
            const msgEl = byId('forceWithdrawMsg');
if (!insuranceId) { msgEl.textContent = 'Please enter a policy ID.'; msgEl.style.color = '#c00'; return; }
if (!confirm('Force metals withdrawal for policy ' + insuranceId + '? No EW will be credited.')) return;
  msgEl.textContent = 'Processing...'; msgEl.style.color = '#888';
          try {
         await window.apiPost('insuranceAdminForceWithdrawMetals', {
        idToken: Admin.state.googleIdToken,
   insuranceId
          });
         msgEl.textContent = 'Done. Policy set to Empty.'; msgEl.style.color = '#155724';
              byId('forceWithdrawPolicyId').value = '';
          await window.loadAdminInsurancePending();
      } catch (e) {
         msgEl.textContent = 'Error: ' + e.message; msgEl.style.color = '#c00';
}
        });
    }

  window.loadAdminInsurancePending = async function loadAdminInsurancePending() {
   if (!Admin.state.googleIdToken) return;
  byId('insuranceMsg').textContent = 'Loading...';
        try {
    const r = await window.apiGet('insuranceAdminListPending', {
     idToken: Admin.state.googleIdToken
});
     const policies = (r.data || {}).policies || [];
        renderInsurancePendingTable_(policies);
        renderForceWithdrawUI_();
   byId('insuranceMsg').textContent = 'Loaded ' + policies.length + ' pending request(s).';
        } catch (e) {
     byId('insuranceMsg').textContent = 'Error: ' + e.message;
  }
    };

})();

/* ewinsurance_js/ewinsurance-ui.js
   DOM rendering for EW Insurance page.
*/

(function () {
    'use strict';

    const METALS_LIST = [
'Silver', 'Gold', 'Steel', 'Copper', 'Iron',
 'Tin', 'Zinc', 'Bismuth', 'Nickel', 'Lead', 'Meteoric Iron'
    ];

  function esc(s) {
        return String(s == null ? '' : s)
 .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
.replace(/"/g, '&quot;');
    }

    function safeJsonParse(s, fallback) {
        try { return JSON.parse(s); } catch (e) { return fallback; }
    }

    // ===== Create button state =====

    function updateCreateBtn() {
  const btn = document.getElementById('btnCreatePolicy');
  if (!btn) return;
        const count = (window.EWIns.state.policies || []).length;
        if (count >= 5) {
          btn.disabled = true;
   btn.title = 'You already have 5 policies';
        } else {
      btn.disabled = false;
    btn.title = '';
        }
    }

    // ===== Allocation editor =====

    function renderAllocationEditor(policy, card) {
        const alloc    = safeJsonParse(policy.AllocationJson, {});
   const activity = String(policy.Activity || 'Empty');
     const isPending = activity === 'Pending';
        const container = card.querySelector('.alloc-rows');
      if (!container) return;

        container.innerHTML = '';
      let sumPct = 0;

  METALS_LIST.forEach(metal => {
     const val = Number(alloc[metal] || 0);
     sumPct += val;
     container.insertAdjacentHTML('beforeend', `
   <div class="alloc-row">
   <label class="alloc-row">${esc(metal)}</label>
    <input type="number" min="0" max="100" step="1" class="alloc-input"
      data-metal="${esc(metal)}" value="${val}" ${isPending ? 'disabled' : ''}>
    <span>%</span>
</div>
       `);
 });

        updateAllocSum_(card, sumPct);
    }

    function updateAllocSum_(card, sum) {
  const el  = card.querySelector('.alloc-total');
    const warn = card.querySelector('.alloc-warn');
       if (el) el.textContent = sum;
        if (warn) warn.style.display = sum > 100 ? '' : 'none';
    }

    // ===== Metal estimate table =====

  function renderMetalEstimate(policy, card) {
        const tbody = card.querySelector('.estimate-tbody');
        const totalInsured = card.querySelector('.total-insured');
    const totalUninsured = card.querySelector('.total-uninsured');
        if (!tbody) return;

        const alloc   = safeJsonParse(policy.AllocationJson, {});
       const stored  = safeJsonParse(policy.StoredJson,   { units: 0 });
    const ewAmount  = (stored.units || 0) * 500;
        const hasAlloc  = Object.values(alloc).some(v => Number(v) > 0);

        tbody.innerHTML = '';

   if (!hasAlloc || ewAmount <= 0) {
  tbody.innerHTML = '<tr><td colspan="7" class="small">Set allocation and deposit EW to see an estimate.</td></tr>';
  if (totalInsured) totalInsured.textContent = '–';
   if (totalUninsured) totalUninsured.textContent = '–';
  return;
        }

        // Use policy's currentEstimate if available (from server), otherwise calc locally
        const est = policy.currentEstimate || window.EWIns.calcEstimate(ewAmount, alloc);

   let ti = 0, tu = 0;
        for (const [metal, pct] of Object.entries(alloc)) {
  const p = Number(pct);
  if (!p || p <= 0) continue;
        const ewForMetal = (p / 100) * ewAmount;
      const key     = metal + ' Ingot';
       const data   = (est.metals && est.metals[key]) || {};
          const ingots  = data.ingots    || 0;
   const nuggets = data.nuggets   || 0;
       const insEW   = data.insuredEW  || 0;
  const leftEW  = data.leftoverEW || 0;
  ti += insEW;
  tu += leftEW;
            const tr = document.createElement('tr');
         tr.innerHTML = `
      <td>${esc(metal)}</td>
             <td>${p}%</td>
   <td>${ewForMetal.toFixed(0)} EW</td>
           <td>${ingots}</td>
    <td>${metal === 'Steel' ? '—' : nuggets}</td>
   <td>${insEW.toFixed(0)} EW</td>
              <td>${leftEW > 0 ? `<span class="deposit-warn">${leftEW.toFixed(0)}</span>` : '—'} EW</td>
       `;
  tbody.appendChild(tr);
        }
        if (totalInsured) totalInsured.textContent = ti.toFixed(0) + ' EW';
if (totalUninsured) totalUninsured.textContent = tu > 0 ? tu.toFixed(0) + ' EW' : '—';
    }

    // ===== Deposit section =====

    function renderDepositSection(policy, card) {
        const section = card.querySelector('.deposit-section');
      if (!section) return;
     const activity = String(policy.Activity || 'Empty');
        const isPending = activity === 'Pending';

       section.style.display = isPending ? 'none' : '';
        if (isPending) return;

   const costEl= section.querySelector('.deposit-cost-display');
       const balEl     = section.querySelector('.deposit-balance-display');
       const warnEl    = section.querySelector('.deposit-warn');
     const unitsInput = section.querySelector('.deposit-units-input');
     const balance = window.EWIns.state.balance || 0;

function update() {
            const units = parseInt(unitsInput.value, 10) || 1;
    const cost  = units * 500;
   if (costEl) costEl.textContent = `Cost: ${units} × 500 = ${cost} EW`;
   if (balEl)  balEl.textContent  = `Your balance: ${balance} EW`;
if (warnEl) warnEl.style.display = balance < cost ? '' : 'none';
    }

        unitsInput.value = 1;
     unitsInput.addEventListener('input', update);
      update();
    }

    // ===== Withdraw section =====

    function renderWithdrawSection(policy, card) {
        const section = card.querySelector('.withdraw-section');
   if (!section) return;
     const activity  = String(policy.Activity || 'Empty');
      const isPending = activity === 'Pending';
  const stored    = safeJsonParse(policy.StoredJson, { units: 0 });
   const maxUnits  = stored.units || 0;

  // Show only when Active and not pending
        section.style.display = (activity === 'Active' && !isPending) ? '' : 'none';
       if (activity !== 'Active' || isPending) return;

     const valEl     = section.querySelector('.withdraw-value-display');
        const unitsInput = section.querySelector('.withdraw-units-input');
      const maxHint   = section.querySelector('.withdraw-max-hint');

        if (unitsInput) {
   unitsInput.max   = maxUnits;
   unitsInput.value = 1;
        }
    if (maxHint) maxHint.textContent = maxUnits;

        function update() {
   const units = parseInt(unitsInput ? unitsInput.value : 1, 10) || 1;
     if (valEl) valEl.textContent = `You receive: ${units} × 500 = ${units * 500} EW`;
       }

        if (unitsInput) unitsInput.addEventListener('input', update);
        update();
    }

    // ===== Pending section =====

    function renderPendingSection(policy, card) {
        const section = card.querySelector('.pending-section');
        if (!section) return;
      const activity = String(policy.Activity || 'Empty');
 section.style.display = activity === 'Pending' ? '' : 'none';
        if (activity !== 'Pending') return;

     const banner = section.querySelector('.pending-banner');
        const temp = safeJsonParse(policy.TempJson, {});
        if (banner) {
            const submitted = temp.submittedAt ? new Date(temp.submittedAt).toLocaleString() : '?';
   banner.innerHTML = `? Pending: <strong>${esc(temp.type || '?')}</strong> submitted ${esc(submitted)}`;
    }
    }

    // ===== Alloc sum live updater =====

 function attachAllocInputListeners_(policy, card) {
        const inputs  = card.querySelectorAll('.alloc-input');
        const saveBtn = card.querySelector('.btn-save-alloc');
        const activity = String(policy.Activity || 'Empty');

     if (saveBtn) {
     saveBtn.textContent = activity === 'Active'
      ? 'Request Reallocation (needs admin approval)'
    : 'Save Allocation';
  }

      inputs.forEach(inp => {
     inp.addEventListener('input', () => {
   let sum = 0;
      card.querySelectorAll('.alloc-input').forEach(i => sum += parseFloat(i.value) || 0);
     updateAllocSum_(card, sum);
      });
        });
    }

    // ===== Full policy card builder =====

    function renderPolicyCard(policy, idx) {
    const stored    = safeJsonParse(policy.StoredJson,   { units: 0 });
const activity  = String(policy.Activity || 'Empty');
     const isPending = activity === 'Pending';

        const card = document.createElement('div');
 card.className = 'policy-card section';
      card.dataset.id = policy.InsuranceID;

        card.innerHTML = `
     <div class="policy-header">
     <input class="policy-name-input" value="${esc(policy.PolicyName || 'Policy ' + (idx + 1))}" maxlength="40">
      <button class="btn-rename">Save Name</button>
       <span class="status-badge ${activity.toLowerCase()}">${esc(activity)}</span>
       </div>

     <div class="policy-stats">
   Insurance EW: <strong>${esc(policy.InsuranceEW || 0)} EW</strong> &nbsp;|&nbsp; Units: <strong>${esc(stored.units || 0)}</strong>
        </div>

        <!-- Allocation editor -->
       <details class="alloc-editor"${activity === 'Empty' ? ' open' : ''}>
   <summary>Metal Allocations</summary>
           <div class="alloc-rows"></div>
   <div class="alloc-sum">Total: <span class="alloc-total">0</span>% (max 100%)</div>
 <div class="alloc-warn" style="display:none;">?? Allocation exceeds 100%</div>
   <button class="btn-save-alloc" ${isPending ? 'disabled' : ''}>Save Allocation</button>
 <div class="small">When Active: saving sends a reallocation request to admin.</div>
        </details>

   <!-- Metal estimate -->
   <details class="metal-estimate">
 <summary>?? Metal Estimate (current prices)</summary>
   <div class="small estimate-note">Estimate based on current sell prices. Final amounts decided at admin approval.</div>
            <table class="metal-estimate-table">
  <thead>
 <tr>
        <th>Metal</th><th>%</th><th>EW Alloc</th>
  <th>Ingots</th><th>Nuggets</th>
  <th>Covered EW</th><th>Uninsured EW</th>
          </tr>
  </thead>
 <tbody class="estimate-tbody"></tbody>
           <tfoot>
         <tr>
 <td colspan="5"><strong>Total</strong></td>
      <td class="total-insured"></td>
  <td class="total-uninsured"></td>
          </tr>
            </tfoot>
      </table>
     </details>

     <!-- Deposit section -->
   <div class="deposit-section">
    <h4>Deposit</h4>
<label>Units to deposit: (1 unit = 500 EW)
          <input type="number" class="deposit-units-input" min="1" step="1" value="1">
        </label>
   <div class="deposit-cost-display">Cost: 1 × 500 = 500 EW</div>
          <div class="deposit-balance-display">Your balance: ${esc(window.EWIns.state.balance || 0)} EW</div>
          <div class="deposit-warn" style="display:none;">?? Insufficient balance</div>
    <button class="btn-deposit" ${isPending ? 'disabled' : ''}>Request Deposit</button>
       </div>

        <!-- Withdraw section -->
        <div class="withdraw-section" style="display:none;">
        <h4>Withdraw</h4>
         <label>Units to withdraw: (1 unit = 500 EW, max <span class="withdraw-max-hint">${esc(stored.units || 0)}</span>)
     <input type="number" class="withdraw-units-input" min="1" step="1" max="${esc(stored.units || 0)}" value="1">
            </label>
  <div class="withdraw-value-display">You receive: 1 × 500 = 500 EW</div>
  <button class="btn-withdraw">Request Withdrawal</button>
            <div class="small">Withdrawing all units closes the policy (Activity ? Empty).</div>
       </div>

       <!-- Pending section -->
        <div class="pending-section" style="display:none;">
  <div class="pending-banner"></div>
   <button class="btn-cancel-pending">Cancel Pending Request</button>
    </div>
        `;

        // Fill sub-sections
  renderAllocationEditor(policy, card);
        renderMetalEstimate(policy, card);
        renderDepositSection(policy, card);
        renderWithdrawSection(policy, card);
        renderPendingSection(policy, card);
        attachAllocInputListeners_(policy, card);

        return card;
    }

    function renderPolicies(arr) {
        const list = document.getElementById('policyList');
   if (!list) return;
        list.innerHTML = '';
        if (!arr || !arr.length) {
         list.innerHTML = '<div class="small">No policies yet. Click "+ Create New Policy" to get started.</div>';
            updateCreateBtn();
            return;
        }
        arr.forEach((policy, idx) => list.appendChild(renderPolicyCard(policy, idx)));
    updateCreateBtn();
    }

    // Public API
    window.EWIns.renderAll  = function () { renderPolicies(window.EWIns.state.policies); };
    window.EWIns.updateCreateBtn = updateCreateBtn;

    // expose esc for other modules
    window.EWIns._esc = esc;
    window.EWIns._safeJsonParse = safeJsonParse;

})();

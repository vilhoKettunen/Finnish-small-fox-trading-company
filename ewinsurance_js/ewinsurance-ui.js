/* ewinsurance_js/ewinsurance-ui.js
   DOM rendering for EW Insurance page.
   Policies rendered as a compact table; each row has a "More Info" toggle
   that expands an inline details row containing all editors.
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

    function shortId(id) {
        const s = String(id || '');
        return s.length > 8 ? '...' + s.slice(-8) : s;
    }

    function allocSummary(allocJson) {
        const alloc = safeJsonParse(allocJson, {});
        const parts = [];
        for (const [metal, pct] of Object.entries(alloc)) {
         const p = Number(pct);
     if (p > 0) parts.push(metal + ' ' + p + '%');
        }
        return parts.length ? parts.join(', ') : '&mdash;';
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

    function renderAllocationEditor(policy, container) {
        const alloc    = safeJsonParse(policy.AllocationJson, {});
        const activity = String(policy.Activity || 'Empty');
        const isPending = activity === 'Pending';
    const rowsEl = container.querySelector('.alloc-rows');
    if (!rowsEl) return;

        rowsEl.innerHTML = '';
        let sumPct = 0;

  METALS_LIST.forEach(metal => {
            const val = Number(alloc[metal] || 0);
         sumPct += val;
     rowsEl.insertAdjacentHTML('beforeend', `
<div class="alloc-row">
  <label>${esc(metal)}</label>
  <input type="number" min="0" max="100" step="1" class="alloc-input"
    data-metal="${esc(metal)}" value="${val}" ${isPending ? 'disabled' : ''}>
  <span>%</span>
</div>`);
        });

        updateAllocSum_(container, sumPct);

        const saveBtn = container.querySelector('.btn-save-alloc');
      if (saveBtn) {
            saveBtn.textContent = activity === 'Active'
   ? 'Request Reallocation (needs admin approval)'
         : 'Save Allocation';
         saveBtn.disabled = isPending;
   }

        container.querySelectorAll('.alloc-input').forEach(inp => {
      inp.addEventListener('input', () => {
let sum = 0;
    container.querySelectorAll('.alloc-input').forEach(i => sum += parseFloat(i.value) || 0);
updateAllocSum_(container, sum);
});
        });
    }

    function updateAllocSum_(container, sum) {
        const el   = container.querySelector('.alloc-total');
        const warn = container.querySelector('.alloc-warn');
     if (el) el.textContent = sum;
        if (warn) warn.style.display = sum > 100 ? '' : 'none';
    }

    // ===== Metal estimate table =====

    function renderMetalEstimate(policy, container) {
   const tbody     = container.querySelector('.estimate-tbody');
      const totalInsured = container.querySelector('.total-insured');
        const totalUnins   = container.querySelector('.total-uninsured');
      if (!tbody) return;

        const alloc   = safeJsonParse(policy.AllocationJson, {});
     const stored  = safeJsonParse(policy.StoredJson, { units: 0 });
     const ewAmount = (stored.units || 0) * 500;
        const hasAlloc = Object.values(alloc).some(v => Number(v) > 0);

        tbody.innerHTML = '';

        if (!hasAlloc || ewAmount <= 0) {
  tbody.innerHTML = '<tr><td colspan="7" class="small">Set allocation and deposit EW to see an estimate.</td></tr>';
      if (totalInsured) totalInsured.textContent = '--';
            if (totalUnins)   totalUnins.textContent   = '--';
            return;
    }

        // Prefer server-computed estimate; fall back to local calc (no prices = zeroes)
        const est = policy.currentEstimate || window.EWIns.calcEstimate(ewAmount, alloc, []);

let ti = 0, tu = 0;
    for (const [metal, pct] of Object.entries(alloc)) {
            const p = Number(pct);
if (!p || p <= 0) continue;
          const ewForMetal = (p / 100) * ewAmount;
  const key  = metal + ' Ingot';
 const data = (est.metals && est.metals[key]) || {};
  const ingots  = data.ingots    || 0;
            const nuggets = data.nuggets   || 0;
       const insEW   = data.insuredEW|| 0;
      const leftEW  = data.leftoverEW || 0;
     ti += insEW;
            tu += leftEW;
          const tr = document.createElement('tr');
      tr.innerHTML = `
<td>${esc(metal)}</td>
<td>${p}%</td>
<td>${ewForMetal.toFixed(0)} EW</td>
<td>${ingots}</td>
<td>${metal === 'Steel' ? '&mdash;' : nuggets}</td>
<td>${insEW.toFixed(0)} EW</td>
<td>${leftEW > 0 ? `<span class="uninsured-warn">${leftEW.toFixed(0)}</span>` : '&mdash;'} EW</td>`;
   tbody.appendChild(tr);
        }
        if (totalInsured) totalInsured.textContent = ti.toFixed(0) + ' EW';
        if (totalUnins)   totalUnins.textContent   = tu > 0 ? tu.toFixed(0) + ' EW' : '&mdash;';
    }

    // ===== Deposit section =====

    function renderDepositSection(policy, container) {
        const section = container.querySelector('.deposit-section');
        if (!section) return;
        const activity  = String(policy.Activity || 'Empty');
        const isPending = activity === 'Pending';

        section.style.display = isPending ? 'none' : '';
        if (isPending) return;

        const costEl     = section.querySelector('.deposit-cost-display');
        const balEl  = section.querySelector('.deposit-balance-display');
 const warnEl     = section.querySelector('.deposit-warn');
        const unitsInput = section.querySelector('.deposit-units-input');
        const balance    = window.EWIns.state.balance || 0;

    function update() {
            const units = parseInt(unitsInput.value, 10) || 1;
            const cost  = units * 500;
      if (costEl) costEl.textContent = `Cost: ${units} x 500 = ${cost} EW`;
            if (balEl)  balEl.textContent  = `Your balance: ${balance} EW`;
   if (warnEl) warnEl.style.display = balance < cost ? '' : 'none';
        }

        unitsInput.value = 1;
        unitsInput.addEventListener('input', update);
        update();
    }

 // ===== Withdraw section =====

    function renderWithdrawSection(policy, container) {
        const section = container.querySelector('.withdraw-section');
        if (!section) return;
        const activity  = String(policy.Activity || 'Empty');
        const isPending = activity === 'Pending';
        const stored    = safeJsonParse(policy.StoredJson, { units: 0 });
        const maxUnits  = stored.units || 0;

        section.style.display = (activity === 'Active' && !isPending) ? '' : 'none';
        if (activity !== 'Active' || isPending) return;

        const valEl      = section.querySelector('.withdraw-value-display');
        const unitsInput = section.querySelector('.withdraw-units-input');
        const maxHint  = section.querySelector('.withdraw-max-hint');

        if (unitsInput) { unitsInput.max = maxUnits; unitsInput.value = 1; }
        if (maxHint)    maxHint.textContent = maxUnits;

        function update() {
            const units = parseInt(unitsInput ? unitsInput.value : 1, 10) || 1;
    if (valEl) valEl.textContent = `You receive: ${units} x 500 = ${units * 500} EW`;
        }
        if (unitsInput) unitsInput.addEventListener('input', update);
     update();
    }

    // ===== Pending section =====

    function renderPendingSection(policy, container) {
        const section = container.querySelector('.pending-section');
        if (!section) return;
      const activity = String(policy.Activity || 'Empty');
        section.style.display = activity === 'Pending' ? '' : 'none';
        if (activity !== 'Pending') return;

        const banner = section.querySelector('.pending-banner');
        const temp   = safeJsonParse(policy.TempJson, {});
        if (banner) {
       const submitted = temp.submittedAt ? new Date(temp.submittedAt).toLocaleString() : '?';
          banner.innerHTML = `&#x23F3; Pending: <strong>${esc(temp.type || '?')}</strong> submitted ${esc(submitted)}`;
        }
    }

    // ===== Build the inner details HTML =====

    function buildDetailsHTML(policy) {
        const stored    = safeJsonParse(policy.StoredJson, { units: 0 });
        const activity  = String(policy.Activity || 'Empty');
        const isPending = activity === 'Pending';

        return `
<div class="ins-details-inner" data-id="${esc(policy.InsuranceID)}">

<!-- Rename + status -->
  <div class="ins-details-header">
    <label>Policy Name:
  <input class="policy-name-input" value="${esc(policy.PolicyName || '')}" maxlength="40" ${isPending ? 'disabled' : ''}>
    </label>
    <button class="btn-rename" ${isPending ? 'disabled' : ''}>Save Name</button>
    <span class="status-badge ${activity.toLowerCase()}">${esc(activity)}</span>
    <span class="ins-full-id small">ID: ${esc(policy.InsuranceID)}</span>
  </div>

  <!-- Allocation editor -->
  <details class="alloc-editor"${activity === 'Empty' ? ' open' : ''}>
    <summary>Metal Allocations</summary>
    <div class="alloc-rows"></div>
    <div class="alloc-sum">Total: <span class="alloc-total">0</span>% (max 100%)</div>
    <div class="alloc-warn" style="display:none;">&#x26A0; Allocation exceeds 100%</div>
    <button class="btn-save-alloc" ${isPending ? 'disabled' : ''}>Save Allocation</button>
    <div class="small">When Active: saving sends a reallocation request to admin.</div>
  </details>

  <!-- Metal estimate -->
  <details class="metal-estimate">
    <summary>&#x1F4CA; Metal Estimate (current prices, from last load)</summary>
    <div class="small estimate-note">Estimate computed server-side at last load. Final amounts set at admin approval.</div>
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
    <label>Units to deposit (1 unit = 500 EW):
      <input type="number" class="deposit-units-input" min="1" step="1" value="1">
    </label>
    <div class="deposit-cost-display">Cost: 1 x 500 = 500 EW</div>
    <div class="deposit-balance-display">Your balance: ${esc(window.EWIns.state.balance || 0)} EW</div>
<div class="deposit-warn" style="display:none;">&#x26A0; Insufficient balance</div>
    <button class="btn-deposit" ${isPending ? 'disabled' : ''}>Request Deposit</button>
  </div>

  <!-- Withdraw section -->
  <div class="withdraw-section" style="display:none;">
    <h4>Withdraw</h4>
    <label>Units to withdraw (1 unit = 500 EW, max <span class="withdraw-max-hint">${esc(stored.units || 0)}</span>):
      <input type="number" class="withdraw-units-input" min="1" step="1"
        max="${esc(stored.units || 0)}" value="1">
    </label>
    <div class="withdraw-value-display">You receive: 1 x 500 = 500 EW</div>
    <button class="btn-withdraw">Request Withdrawal</button>
    <div class="small">Withdrawing all units closes the policy (status becomes Empty).</div>
  </div>

  <!-- Pending section -->
  <div class="pending-section" style="display:none;">
    <div class="pending-banner"></div>
    <button class="btn-cancel-pending">Cancel Pending Request</button>
  </div>

</div>`;
    }

    // ===== Main table renderer =====

    function renderPolicies(arr) {
        const list = document.getElementById('policyList');
        if (!list) return;
        list.innerHTML = '';

 if (!arr || !arr.length) {
     list.innerHTML = '<div class="small" style="margin-top:10px;">No policies yet. Click "+ Create New Policy" to get started.</div>';
  updateCreateBtn();
            return;
        }

      const table = document.createElement('table');
     table.id = 'policyTable';
   table.innerHTML = `
<thead>
  <tr>
    <th>ID</th>
    <th>Policy Name</th>
    <th>Status</th>
  <th>Units</th>
    <th>Total EW</th>
    <th>Metals %</th>
    <th>More Info</th>
  </tr>
</thead>`;

     const tbody = document.createElement('tbody');
        table.appendChild(tbody);

        arr.forEach(policy => {
          const stored   = safeJsonParse(policy.StoredJson, { units: 0 });
            const activity = String(policy.Activity || 'Empty');

         // Main policy row
      const tr = document.createElement('tr');
     tr.dataset.id = policy.InsuranceID;
            tr.innerHTML = `
<td class="mono small">${esc(shortId(policy.InsuranceID))}</td>
<td>${esc(policy.PolicyName || '')}</td>
<td><span class="status-badge ${activity.toLowerCase()}">${esc(activity)}</span></td>
<td>${esc(stored.units || 0)}</td>
<td>${esc(policy.InsuranceEW || 0)} EW</td>
<td class="small">${allocSummary(policy.AllocationJson)}</td>
<td><button class="btn-more-info" type="button">More Info &#x25BC;</button></td>`;

    tbody.appendChild(tr);

            // Hidden details row
       const detailsTr = document.createElement('tr');
          detailsTr.className = 'ins-details-row';
  detailsTr.dataset.id = policy.InsuranceID;
    detailsTr.style.display = 'none';
            const detailsTd = document.createElement('td');
            detailsTd.colSpan = 7;
 detailsTd.innerHTML = buildDetailsHTML(policy);
   detailsTr.appendChild(detailsTd);
       tbody.appendChild(detailsTr);

        // Fill sub-sections into the details row
        const inner = detailsTd.querySelector('.ins-details-inner');
            renderAllocationEditor(policy, inner);
            renderMetalEstimate(policy, inner);
  renderDepositSection(policy, inner);
            renderWithdrawSection(policy, inner);
            renderPendingSection(policy, inner);

         // Toggle logic
        const moreBtn = tr.querySelector('.btn-more-info');
            moreBtn.addEventListener('click', () => {
  const isOpen = detailsTr.style.display !== 'none';
        // Close all other open rows first
       tbody.querySelectorAll('.ins-details-row').forEach(r => {
 r.style.display = 'none';
     const mainTr = r.previousElementSibling;
        const btn = mainTr && mainTr.querySelector('.btn-more-info');
      if (btn) btn.textContent = 'More Info \u25BC';
                });
            if (!isOpen) {
        detailsTr.style.display = '';
 moreBtn.textContent = 'Hide \u25B2';
  }
          });
        });

        list.appendChild(table);
        updateCreateBtn();
    }

  // Public API
    window.EWIns.renderAll       = function () { renderPolicies(window.EWIns.state.policies); };
    window.EWIns.updateCreateBtn = updateCreateBtn;

    // Expose helpers for actions module
    window.EWIns._esc  = esc;
    window.EWIns._safeJsonParse = safeJsonParse;

})();

// admin_js/admin-insurance.js
// Admin: Insurance Requests tab + Insurance (User) full management UI
(function () {
    'use strict';

    const Admin = window.Admin;
    const byId = Admin.byId;
const esc = Admin.esc;
    const safeJsonParse = Admin.safeJsonParse;

    // ============================================================
    // CONSTANTS
    // ============================================================
    const METALS_LIST = [
        'Silver', 'Gold', 'Steel', 'Copper', 'Iron',
        'Tin', 'Zinc', 'Bismuth', 'Nickel', 'Lead', 'Meteoric Iron'
    ];
    const INS_EW_PER_UNIT = 500;
    const PUBLIC_PRICE_CATALOG_ID = '1_meliJtuKSDwEWRDh1gldcsD-pSjDgIND3dcE1mCjCo';

    let _adminInsPriceItems = null; // cached price items for estimate preview

    // ============================================================
    // HELPERS
  // ============================================================

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

  async function fetchAdminInsPriceItems_() {
        if (_adminInsPriceItems) return _adminInsPriceItems;
    try {
   const url = 'https://docs.google.com/spreadsheets/d/' +
     PUBLIC_PRICE_CATALOG_ID + '/gviz/tq?tqx=out:json';
            const resp = await fetch(url);
    const text = await resp.text();
            const start = text.indexOf('(');
            const json = JSON.parse(text.substring(start + 1, text.length - 2));
            const rows = (json.table && json.table.rows) || [];
     _adminInsPriceItems = rows.map(r => {
         const c = i => (r.c && r.c[i] && r.c[i].v !== undefined) ? r.c[i].v : null;
         const name = c(0) ? String(c(0)).trim() : null;
  if (!name) return null;
    return {
  name,
       bundleSize: parseFloat(c(4)) || 1,
            buyEW:      parseFloat(c(5)) || 0,
sellEW:     parseFloat(c(6)) || 0
          };
  }).filter(Boolean);
      } catch (e) {
            _adminInsPriceItems = [];
  }
        return _adminInsPriceItems;
    }

    function calcInsEstimate_(ewAmount, allocObj, priceItems) {
        const items = Array.isArray(priceItems) ? priceItems : [];
        const metals = {};
        let totalInsuredEW  = 0;
        let totalLeftoverEW = 0;

        for (const [metal, pct] of Object.entries(allocObj)) {
            const p = Number(pct);
      if (!p || p <= 0) continue;
     const ewForMetal = (p / 100) * ewAmount;
            const ingotItem  = items.find(pi => pi.name.includes(metal + ' Ingot'));
            const nuggetItem = (metal !== 'Steel')
       ? items.find(pi => pi.name.includes(metal + ' Nuggets') || pi.name.includes(metal + ' Nugget'))
          : null;
        const ingotPrice  = ingotItem  ? ingotItem.sellEW  : 0;
            const nuggetPrice = nuggetItem ? nuggetItem.sellEW : 0;
       const ingots  = ingotPrice  > 0 ? Math.floor(ewForMetal / ingotPrice)  : 0;
       const rem     = ewForMetal - (ingots * ingotPrice);
            const nuggets = nuggetPrice > 0 ? Math.floor(rem / nuggetPrice) : 0;
            const insured = (ingots * ingotPrice) + (nuggets * nuggetPrice);
         const leftover = ewForMetal - insured;
      metals[metal + ' Ingot'] = { ingots, nuggets, insuredEW: insured, leftoverEW: leftover };
            totalInsuredEW  += insured;
   totalLeftoverEW += leftover;
        }
        return { metals, totalInsuredEW, totalLeftoverEW };
    }

    // ============================================================
 // PENDING TABLE (unchanged)
    // ============================================================

    function renderInsurancePendingTable_(policies) {
        const tb = byId('tbInsuranceRequests');
     tb.innerHTML = '';

        if (!policies || !policies.length) {
       tb.innerHTML = '<tr><td colspan="11" class="small">No pending insurance requests.</td></tr>';
            return;
        }

     policies.forEach(policy => {
            const temp        = safeJsonParse(policy.TempJson   || '{}', {});
            const stored      = safeJsonParse(policy.StoredJson || '{}', {});
        const liveMetals  = policy.liveMetals  || { metals: {} };
    const oldMetals   = policy.oldMetals   || stored.metals || {};
         const liveBalance = policy.liveBalance != null ? policy.liveBalance : '?';

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

 const depositCost = temp.type === 'DEPOSIT'
 ? (Number(temp.requestedUnits || 0) * 500) : 0;
      const balanceLow = temp.type === 'DEPOSIT' &&
   typeof liveBalance === 'number' && liveBalance < depositCost;

          const typeColors = {
                DEPOSIT:       'background:#c3e6cb;color:#155724',
    WITHDRAW_PARTIAL: 'background:#ffeeba;color:#856404',
         WITHDRAW_ALL:     'background:#f5c6cb;color:#721c24',
    REALLOC:  'background:#bee5eb;color:#0c5460',
        WITHDRAW_METALS:  'background:#e2d9f3;color:#4a235a'
            };
    const typeBadge = `<span class="pill" style="${typeColors[temp.type] || ''};padding:2px 8px;border-radius:10px;">${esc(temp.type || '?')}</span>`;

            const typeNote = temp.type === 'WITHDRAW_METALS'
            ? '<br><span style="font-size:0.8em;color:#4a235a;">No EW credited &mdash; physical metals collected</span>'
     : (temp.type === 'REALLOC' ? '<br><span style="font-size:0.8em;color:#856404;">&#x26A0; Physical metals change required</span>' : '');

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
</td>`;

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
       idToken:     Admin.state.googleIdToken,
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

    // ============================================================
    // ADMIN PER-USER POLICY DETAILS BUILDERS
    // ============================================================

    function buildAdminPolicyDetailsHTML_(policy) {
        const stored   = safeJsonParse(policy.StoredJson || '{}', { units: 0 });
        const activity = String(policy.Activity || 'Empty');
  const isPending = activity === 'Pending';
        const isActive  = activity === 'Active';
        const isEmpty   = activity === 'Empty';

    return `<div class="admin-ins-policy-inner" data-id="${esc(policy.InsuranceID)}">

  <!-- 1) Rename section -->
  <div class="admin-ins-rename-section" style="margin-bottom:12px;">
    <label><strong>Policy Name:</strong>
      <input class="admin-ins-name-input" type="text" value="${esc(policy.PolicyName || '')}" maxlength="40" style="margin-left:6px;min-width:200px;" ${isPending ? 'disabled' : ''}>
    </label>
    <button class="btn-admin-ins-rename" type="button" style="margin-left:6px;" ${isPending ? 'disabled' : ''}>Save Name</button>
    <span class="admin-ins-notifier rename-notifier" style="margin-left:8px;font-size:0.87em;"></span>
  </div>

  <!-- 2) Allocation editor -->
  <div class="admin-ins-alloc-section" style="margin-bottom:12px;">
    <strong>Metal Allocation</strong>
    <div class="admin-ins-alloc-rows" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:4px;margin:6px 0;"></div>
    <div>Total: <span class="admin-ins-alloc-total">0</span>% (max 100%)</div>
<div class="admin-ins-alloc-warn" style="display:none;color:#c00;">&#x26A0; Allocation exceeds 100%</div>
    <button class="btn-admin-ins-save-alloc" type="button" style="margin-top:6px;" ${isPending ? 'disabled' : ''}>Save Allocation</button>
    <span class="admin-ins-notifier alloc-notifier" style="margin-left:8px;font-size:0.87em;"></span>
    ${isPending ? '<div class="small" style="color:#888;">Allocation locked while Pending.</div>' : ''}
  </div>

  <!-- 3) Metal estimate table -->
  <div class="admin-ins-estimate-section" style="margin-bottom:12px;">
    <details>
      <summary><strong>&#x1F4CA; Current Metal Estimate</strong></summary>
      <div class="admin-ins-estimate-content" style="margin-top:6px;"></div>
    </details>
  </div>

  <!-- 4) Deposit section -->
  <div class="admin-ins-deposit-section" style="margin-bottom:12px;">
  <strong>Deposit Units (Admin)</strong>
    <div style="margin:6px 0;">
      <label>Units (1 unit = ${INS_EW_PER_UNIT} EW):
        <input type="number" class="admin-ins-deposit-units" min="1" step="1" value="1" style="width:80px;margin-left:4px;">
      </label>
      <span class="admin-ins-deposit-cost" style="margin-left:10px;font-size:0.9em;"></span>
    </div>
    <div class="admin-ins-deposit-balance" style="font-size:0.88em;margin-bottom:4px;"></div>
    <div class="admin-ins-deposit-warn" style="display:none;color:#c00;font-size:0.88em;">&#x26A0; Insufficient balance</div>
    <div class="admin-ins-deposit-preview" style="margin:6px 0;"></div>
    <button class="btn-admin-ins-deposit" type="button" ${isPending ? 'disabled' : ''}>Deposit Now (admin)</button>
    <span class="admin-ins-notifier deposit-notifier" style="margin-left:8px;font-size:0.87em;"></span>
  </div>

  <!-- 5) Withdraw Units section -->
  <div class="admin-ins-withdraw-section" style="margin-bottom:12px;${!isActive ? 'display:none;' : ''}">
    <strong>Withdraw Units (Admin)</strong>
  <div style="margin:6px 0;">
  <label>Units (max <span class="admin-ins-withdraw-max">${esc(stored.units || 0)}</span>):
 <input type="number" class="admin-ins-withdraw-units" min="1" step="1" value="1" max="${esc(stored.units || 0)}" style="width:80px;margin-left:4px;">
      </label>
      <span class="admin-ins-withdraw-credit" style="margin-left:10px;font-size:0.9em;"></span>
    </div>
    <button class="btn-admin-ins-withdraw" type="button">Withdraw Now (admin)</button>
    <span class="admin-ins-notifier withdraw-notifier" style="margin-left:8px;font-size:0.87em;"></span>
  </div>

  <!-- 6) Force Metals Withdrawal (inline, instant, no confirm dialog) -->
  <div class="admin-ins-metals-withdraw-section" style="margin-bottom:12px;${!isActive ? 'display:none;' : ''}">
    <strong>Force Metals Withdrawal</strong>
    <p class="small" style="margin:4px 0;">Player physically collected metals. No EW credited. Policy set to Empty instantly.</p>
    <button class="btn-admin-ins-force-metals" type="button" style="background:#856404;color:#fff;border:none;padding:4px 14px;border-radius:4px;cursor:pointer;">
      Force Metals Withdrawal &mdash; INSTANT
    </button>
    <span class="admin-ins-notifier metals-notifier" style="margin-left:8px;font-size:0.87em;"></span>
  </div>

  <!-- 7) Cancel Pending section -->
  <div class="admin-ins-cancel-section" style="margin-bottom:12px;${!isPending ? 'display:none;' : ''}">
    <strong>Cancel Pending Request</strong>
    <p class="small" style="margin:4px 0;">Reverts the policy to its previous state.</p>
    <button class="btn-admin-ins-cancel-pending" type="button" style="background:#6c757d;color:#fff;">Cancel Pending Request</button>
    <span class="admin-ins-notifier cancel-notifier" style="margin-left:8px;font-size:0.87em;"></span>
  </div>

  <!-- 8) Delete Policy section -->
  <div class="admin-ins-delete-section" style="margin-bottom:12px;">
    <strong>Delete Policy</strong>
    <p class="small" style="margin:4px 0;">Policy can only be deleted when it is Empty (no units, no pending requests).</p>
    <button class="btn-admin-ins-delete" type="button"
      style="background:${isEmpty ? '#c0392b' : '#aaa'};color:#fff;border:none;padding:4px 14px;border-radius:4px;cursor:${isEmpty ? 'pointer' : 'not-allowed'};"
      ${isEmpty ? '' : 'disabled title="Policy must be Empty to delete"'}>
      Delete Policy
    </button>
    <span class="admin-ins-notifier delete-notifier" style="margin-left:8px;font-size:0.87em;"></span>
  </div>

</div>`;
    }

    function renderAdminAllocEditor_(policy, inner) {
        const alloc    = safeJsonParse(policy.AllocationJson || '{}', {});
    const activity = String(policy.Activity || 'Empty');
        const isPending = activity === 'Pending';
      const rowsEl   = inner.querySelector('.admin-ins-alloc-rows');
        const totalEl  = inner.querySelector('.admin-ins-alloc-total');
    const warnEl   = inner.querySelector('.admin-ins-alloc-warn');
        if (!rowsEl) return;

        rowsEl.innerHTML = '';
        let sumPct = 0;

    METALS_LIST.forEach(metal => {
   const val = Number(alloc[metal] || 0);
            sumPct += val;
 const div = document.createElement('div');
    div.style.display = 'flex';
        div.style.alignItems = 'center';
            div.style.gap = '4px';
div.innerHTML = `<label style="min-width:105px;font-size:0.88em;">${esc(metal)}</label>
<input type="number" min="0" max="100" step="1" class="admin-ins-alloc-input"
  data-metal="${esc(metal)}" value="${val}" style="width:62px;" ${isPending ? 'disabled' : ''}>
<span style="font-size:0.85em;">%</span>`;
 rowsEl.appendChild(div);
        });

        if (totalEl) totalEl.textContent = sumPct;
        if (warnEl)  warnEl.style.display = sumPct > 100 ? '' : 'none';

        rowsEl.querySelectorAll('.admin-ins-alloc-input').forEach(inp => {
         inp.addEventListener('input', () => {
                let sum = 0;
           rowsEl.querySelectorAll('.admin-ins-alloc-input').forEach(i => sum += parseFloat(i.value) || 0);
      if (totalEl) totalEl.textContent = sum;
if (warnEl)  warnEl.style.display = sum > 100 ? '' : 'none';
            });
        });
    }

    function renderAdminMetalEstimate_(policy, inner) {
        const container = inner.querySelector('.admin-ins-estimate-content');
        if (!container) return;

      const alloc   = safeJsonParse(policy.AllocationJson || '{}', {});
        const stored= safeJsonParse(policy.StoredJson || '{}', { units: 0 });
        const ewAmount = (stored.units || 0) * INS_EW_PER_UNIT;
        const hasAlloc = Object.values(alloc).some(v => Number(v) > 0);

    if (!hasAlloc || ewAmount <= 0) {
            container.innerHTML = '<div class="small">Set allocation and deposit EW to see an estimate.</div>';
  return;
        }

        const est = policy.currentEstimate || { metals: {}, totalInsuredEW: 0, totalLeftoverEW: 0 };
        let rows = '';
        for (const [metal, pct] of Object.entries(alloc)) {
            const p = Number(pct);
       if (!p || p <= 0) continue;
            const ewForMetal = (p / 100) * ewAmount;
     const key  = metal + ' Ingot';
 const data = (est.metals && est.metals[key]) || {};
        const ingots  = data.ingots    || 0;
        const nuggets = data.nuggets   || 0;
 const insEW   = data.insuredEW || 0;
            const leftEW  = data.leftoverEW || 0;
   rows += `<tr>
<td>${esc(metal)}</td><td>${p}%</td><td>${ewForMetal.toFixed(0)} EW</td>
<td>${ingots}</td><td>${metal === 'Steel' ? '&mdash;' : nuggets}</td>
<td>${insEW.toFixed(0)} EW</td>
<td>${leftEW > 0 ? `<span class="warn">${leftEW.toFixed(0)}</span>` : '&mdash;'} EW</td>
</tr>`;
        }
        container.innerHTML = `<table style="font-size:0.85em;border-collapse:collapse;width:100%;">
<thead><tr><th>Metal</th><th>%</th><th>EW Alloc</th><th>Ingots</th><th>Nuggets</th><th>Covered EW</th><th>Uninsured EW</th></tr></thead>
<tbody>${rows}</tbody>
<tfoot><tr><td colspan="5"><strong>Total</strong></td>
<td><strong>${est.totalInsuredEW ? est.totalInsuredEW.toFixed(0) : 0} EW</strong></td>
<td>${est.totalLeftoverEW > 0 ? `<span class="warn">${est.totalLeftoverEW.toFixed(0)} EW</span>` : '&mdash;'}</td>
</tr></tfoot></table>`;
    }

    function renderAdminDepositSection_(policy, inner, liveBalance) {
        const costEl     = inner.querySelector('.admin-ins-deposit-cost');
        const balEl      = inner.querySelector('.admin-ins-deposit-balance');
      const warnEl     = inner.querySelector('.admin-ins-deposit-warn');
        const unitsInput = inner.querySelector('.admin-ins-deposit-units');
        const previewEl  = inner.querySelector('.admin-ins-deposit-preview');
   if (!unitsInput) return;

      const alloc = safeJsonParse(policy.AllocationJson || '{}', {});
        const stored = safeJsonParse(policy.StoredJson || '{}', { units: 0 });

     function update(priceItems) {
   const units = parseInt(unitsInput.value, 10) || 1;
            const cost  = units * INS_EW_PER_UNIT;
 if (costEl) costEl.textContent = `Cost: ${units} × ${INS_EW_PER_UNIT} = ${cost} EW`;
         if (balEl)  balEl.textContent  = `Target user balance: ${liveBalance != null ? liveBalance : '?'} EW`;
            if (warnEl) warnEl.style.display = (liveBalance != null && liveBalance < cost) ? '' : 'none';

            if (!previewEl) return;
      const hasAlloc = Object.values(alloc).some(v => Number(v) > 0);
            if (!hasAlloc) {
     previewEl.innerHTML = '<span class="small" style="color:#888;">Set allocation to see estimate preview.</span>';
      return;
            }
        const currentEW = (stored.units || 0) * INS_EW_PER_UNIT;
const afterEW   = ((stored.units || 0) + units) * INS_EW_PER_UNIT;
            if (!priceItems || !priceItems.length) {
  previewEl.innerHTML = '<span class="small" style="color:#888;">Loading prices...</span>';
     return;
        }
            const curEst   = currentEW  > 0 ? calcInsEstimate_(currentEW,  alloc, priceItems) : { metals: {}, totalInsuredEW: 0, totalLeftoverEW: 0 };
    const afterEst = afterEW    > 0 ? calcInsEstimate_(afterEW,    alloc, priceItems) : { metals: {}, totalInsuredEW: 0, totalLeftoverEW: 0 };

 function metalSummary(est) {
       const parts = [];
   for (const [key, data] of Object.entries(est.metals || {})) {
      if (!data) continue;
            const metalName = key.replace(' Ingot', '');
              let s = `${metalName}: ${data.ingots || 0} ingot(s)`;
          if (data.nuggets > 0) s += `, ${data.nuggets} nugget(s)`;
          parts.push(s);
    }
        return parts.length ? parts.join('; ') : '&mdash;';
  }

  previewEl.innerHTML = `<table class="deposit-estimate-table" style="font-size:0.84em;border-collapse:collapse;">
<thead><tr><th></th><th>Total EW</th><th>Insured EW</th><th>Metals</th></tr></thead>
<tbody>
<tr><td><strong>Current</strong></td><td>${currentEW} EW</td><td>${curEst.totalInsuredEW.toFixed(0)} EW</td><td class="small">${metalSummary(curEst)}</td></tr>
<tr><td><strong>After deposit</strong></td><td>${afterEW} EW</td><td>${afterEst.totalInsuredEW.toFixed(0)} EW</td><td class="small">${metalSummary(afterEst)}</td></tr>
</tbody></table>`;
   }

        unitsInput.value = 1;
   // Try cached prices first
   if (_adminInsPriceItems && _adminInsPriceItems.length) {
         update(_adminInsPriceItems);
      } else {
            update(null);
    fetchAdminInsPriceItems_().then(items => update(items));
        }
        unitsInput.addEventListener('input', () => {
       if (_adminInsPriceItems) update(_adminInsPriceItems);
            else fetchAdminInsPriceItems_().then(items => update(items));
        });
    }

    function renderAdminWithdrawSection_(policy, inner) {
  const maxEl  = inner.querySelector('.admin-ins-withdraw-max');
        const inp    = inner.querySelector('.admin-ins-withdraw-units');
        const credEl = inner.querySelector('.admin-ins-withdraw-credit');
    const stored = safeJsonParse(policy.StoredJson || '{}', { units: 0 });
        const maxUnits = stored.units || 0;

      if (inp) { inp.max = maxUnits; inp.value = 1; }
        if (maxEl) maxEl.textContent = maxUnits;

        function update() {
       const units = parseInt(inp ? inp.value : 1, 10) || 1;
    if (credEl) credEl.textContent = `You return: ${units} × ${INS_EW_PER_UNIT} = ${units * INS_EW_PER_UNIT} EW to user`;
        }
      if (inp) inp.addEventListener('input', update);
  update();
    }

    // ============================================================
    // EVENT WIRING FOR POLICY INNER
    // ============================================================

    function wireAdminPolicyInner_(inner, policy, liveBalance) {
        const id = policy.InsuranceID;
        const idToken = Admin.state.googleIdToken;

        function notify(selector, msg, color) {
  const el = inner.querySelector(selector);
  if (el) { el.textContent = msg; el.style.color = color || '#888'; }
     }

      async function doAction(action, params, notifierSel) {
            notify(notifierSel, 'Working...', '#888');
  try {
      await window.apiPost(action, Object.assign({ idToken }, params));
    notify(notifierSel, 'Done.', '#155724');
           await window.loadAdminInsuranceUser();
            } catch (e) {
      notify(notifierSel, 'Error: ' + e.message, '#c00');
         }
   }

     // Rename
      inner.querySelector('.btn-admin-ins-rename')?.addEventListener('click', () => {
       const name = (inner.querySelector('.admin-ins-name-input')?.value || '').trim();
   if (!/^[a-zA-Z0-9 ]{1,40}$/.test(name)) {
          notify('.rename-notifier', 'Invalid name (letters/numbers/spaces, max 40).', '#c00');
          return;
      }
   doAction('insuranceAdminRenamePolicy', { insuranceId: id, policyName: name }, '.rename-notifier');
     });

 // Save Allocation
 inner.querySelector('.btn-admin-ins-save-alloc')?.addEventListener('click', () => {
       const allocObj = {};
        let sum = 0;
            inner.querySelectorAll('.admin-ins-alloc-input').forEach(inp => {
     const metal = inp.dataset.metal;
      const val   = parseFloat(inp.value) || 0;
        if (val > 0) allocObj[metal] = val;
  sum += val;
            });
        if (sum > 100) {
      notify('.alloc-notifier', 'Allocation exceeds 100%.', '#c00');
        return;
     }
            doAction('insuranceAdminUpdateAllocation', { insuranceId: id, allocationJson: JSON.stringify(allocObj) }, '.alloc-notifier');
     });

        // Deposit
        inner.querySelector('.btn-admin-ins-deposit')?.addEventListener('click', () => {
     const units = parseInt(inner.querySelector('.admin-ins-deposit-units')?.value || 1, 10);
          if (!Number.isInteger(units) || units < 1) {
 notify('.deposit-notifier', 'Units must be a positive integer.', '#c00');
          return;
            }
        const cost = units * INS_EW_PER_UNIT;
            if (liveBalance != null && liveBalance < cost) {
    notify('.deposit-notifier', `Insufficient balance (${liveBalance} EW < ${cost} EW).`, '#c00');
          return;
 }
 doAction('insuranceAdminDeposit', { insuranceId: id, requestedUnits: units }, '.deposit-notifier');
        });

        // Withdraw Units
      inner.querySelector('.btn-admin-ins-withdraw')?.addEventListener('click', () => {
    const units = parseInt(inner.querySelector('.admin-ins-withdraw-units')?.value || 1, 10);
   if (!Number.isInteger(units) || units < 1) {
  notify('.withdraw-notifier', 'Units must be a positive integer.', '#c00');
 return;
     }
  doAction('insuranceAdminWithdrawUnits', { insuranceId: id, withdrawUnits: units }, '.withdraw-notifier');
    });

        // Force Metals Withdrawal — INSTANT, no confirm dialog
   inner.querySelector('.btn-admin-ins-force-metals')?.addEventListener('click', () => {
    doAction('insuranceAdminForceWithdrawMetals', { insuranceId: id }, '.metals-notifier');
        });

        // Cancel Pending
        inner.querySelector('.btn-admin-ins-cancel-pending')?.addEventListener('click', () => {
    doAction('insuranceAdminCancelPending', { insuranceId: id }, '.cancel-notifier');
        });

        // Delete Policy
        inner.querySelector('.btn-admin-ins-delete')?.addEventListener('click', async () => {
if (!confirm('Permanently delete policy ' + id + '? This cannot be undone.')) return;
            doAction('insuranceAdminDelete', { insuranceId: id }, '.delete-notifier');
        });
    }

 // ============================================================
    // INSURANCE USER TABLE — Full management UI
  // ============================================================

function renderInsuranceUserTable_(policies, liveBalance) {
     const tb = byId('tbInsuranceUser');
        tb.innerHTML = '';

        if (!policies || !policies.length) {
      tb.innerHTML = '<tr><td colspan="7" class="small">No policies for this user.</td></tr>';
   return;
        }

        policies.forEach(policy => {
       const stored   = safeJsonParse(policy.StoredJson || '{}', { units: 0, metals: {} });
            const alloc    = safeJsonParse(policy.AllocationJson || '{}', {});
   const activity = String(policy.Activity || 'Empty');

            // Main row
            const tr = document.createElement('tr');
tr.dataset.id = policy.InsuranceID;
            tr.innerHTML = `
<td class="mono" style="font-size:0.78em;">${esc(policy.InsuranceID || '?')}</td>
<td>${esc(policy.PolicyName || '')}</td>
<td>${esc(activity)}</td>
<td class="mono">${esc(String((stored && stored.units) || 0))}</td>
<td class="mono">${esc(String(policy.InsuranceEW || (stored.units || 0) * INS_EW_PER_UNIT))} EW</td>
<td class="small">${esc(Object.keys(alloc).length ? Object.entries(alloc).filter(([,v]) => Number(v)>0).map(([k,v])=>k+' '+v+'%').join(', ') : '-')}</td>
<td><button type="button" class="btn-admin-more-info">More Info &#x25BC;</button></td>`;

            tb.appendChild(tr);

// Hidden details row
        const detailsTr = document.createElement('tr');
    detailsTr.className = 'admin-ins-details-row';
   detailsTr.dataset.id = policy.InsuranceID;
       detailsTr.style.display = 'none';
const detailsTd = document.createElement('td');
            detailsTd.colSpan = 7;
            detailsTd.style.padding = '10px 16px';
  detailsTd.style.background = '#f8f9fa';
   detailsTd.innerHTML = buildAdminPolicyDetailsHTML_(policy);
            detailsTr.appendChild(detailsTd);
            tb.appendChild(detailsTr);

     // Fill sub-sections
            const inner = detailsTd.querySelector('.admin-ins-policy-inner');
        renderAdminAllocEditor_(policy, inner);
        renderAdminMetalEstimate_(policy, inner);
   renderAdminDepositSection_(policy, inner, liveBalance);
renderAdminWithdrawSection_(policy, inner);
            wireAdminPolicyInner_(inner, policy, liveBalance);

      // Toggle logic — single open at a time
        const moreBtn = tr.querySelector('.btn-admin-more-info');
            moreBtn.addEventListener('click', () => {
      const isOpen = detailsTr.style.display !== 'none';
     // Close all
    tb.querySelectorAll('.admin-ins-details-row').forEach(r => {
     r.style.display = 'none';
        const mainTr = r.previousElementSibling;
                 const btn = mainTr && mainTr.querySelector('.btn-admin-more-info');
       if (btn) btn.textContent = 'More Info \u25BC';
    });
    if (!isOpen) {
 detailsTr.style.display = '';
     moreBtn.textContent = 'Hide \u25B2';
        }
   });
        });
    }

    // ============================================================
    // LOAD FUNCTIONS
    // ============================================================

    window.loadAdminInsurancePending = async function loadAdminInsurancePending() {
 if (!Admin.state.googleIdToken) return;
        byId('insuranceMsg').textContent = 'Loading...';
        try {
const r = await window.apiGet('insuranceAdminListPending', {
          idToken: Admin.state.googleIdToken
          });
            const policies = (r.data || {}).policies || [];
            renderInsurancePendingTable_(policies);
     byId('insuranceMsg').textContent = 'Loaded ' + policies.length + ' pending request(s).';
     } catch (e) {
       byId('insuranceMsg').textContent = 'Error: ' + e.message;
     }
    };

    window.loadAdminInsuranceUser = async function loadAdminInsuranceUser() {
        try {
      const sec   = byId('insuranceUserSection');
 const noTarget  = byId('insuranceUserNoTarget');
const content   = byId('insuranceUserContent');
   const label     = byId('insuranceUserLabel');
    const msg       = byId('insuranceUserMsg');
            const btn       = byId('btnReloadInsuranceUser');

  if (!sec || !noTarget || !content || !label || !msg) {
           console.debug('loadAdminInsuranceUser: missing DOM elements');
                return;
         }

         let target = Admin.state.globalTargetUser;
            if (!target) {
        const ps = byId('playerSearch');
       const uid = ps?.dataset?.selectedUser;
      if (uid) {
 target = window.resolvePlayerById_ ? window.resolvePlayerById_(uid) : null;
       if (target) Admin.state.globalTargetUser = target;
}
            }
            if (!target) {
    const gu = byId('globalUserSelected');
           const ginput = byId('globalUserInput');
      const nameToFind = (gu?.textContent || ginput?.value || '').trim();
    if (nameToFind) {
       if (!Admin.state.playersCache || !Admin.state.playersCache.length) {
    try { await window.loadPlayers(); } catch (e) { /* ignore */ }
   }
           const found = (Admin.state.playersCache || []).find(p =>
             (p.playerName || '').toLowerCase() === nameToFind.toLowerCase() ||
    (p.email || '').toLowerCase() === nameToFind.toLowerCase());
        if (found) { target = found; Admin.state.globalTargetUser = found; }
     }
      }

  if (!target) {
        noTarget.style.display = '';
                content.style.display = 'none';
    label.textContent = '-';
     return;
     }

     noTarget.style.display = 'none';
 content.style.display = '';
            label.textContent = target.playerName || target.email || target.userId || '-';

            if (!Admin.state.googleIdToken) { msg.textContent = 'Not logged in.'; return; }

            msg.textContent = 'Loading...';
            if (btn) btn.disabled = true;

        try {
  const r = await window.apiGet('insuranceAdminListByUser', {
                idToken: Admin.state.googleIdToken,
  userId:  target.userId
                });
      const policies    = (r.data || {}).policies || [];
    const liveBalance = (r.data || {}).liveBalance;
        renderInsuranceUserTable_(policies, liveBalance);

                // Wire "Create Policy for User" button
   const createBtn = byId('btnAdminInsCreatePolicy');
       if (createBtn) {
 const fresh = createBtn.cloneNode(true);
   createBtn.parentNode.replaceChild(fresh, createBtn);
 fresh.disabled = policies.length >= 5;
      fresh.title = policies.length >= 5 ? 'User already has 5 policies' : '';
     fresh.addEventListener('click', async () => {
        if (!confirm('Create a new insurance policy for ' + (target.playerName || target.userId) + '?')) return;
       try {
         await window.apiPost('insuranceAdminCreate', {
      idToken: Admin.state.googleIdToken,
          userId:  target.userId
     });
await window.loadAdminInsuranceUser();
  } catch (e) {
    alert('Error creating policy: ' + e.message);
          }
      });
       }

           msg.textContent = 'Loaded ' + policies.length + ' policy(ies).';
            } catch (e) {
 msg.textContent = 'Error: ' + e.message;
console.error('loadAdminInsuranceUser error', e);
      } finally {
            if (btn) btn.disabled = false;
         }
   } catch (err) {
            console.error('loadAdminInsuranceUser unexpected error', err);
        }
    };

    // Wire reload button and create button on DOMContentLoaded
    document.addEventListener('DOMContentLoaded', () => {
        const btn = byId('btnReloadInsuranceUser');
        if (btn) btn.addEventListener('click', () => window.loadAdminInsuranceUser());
    });

})();

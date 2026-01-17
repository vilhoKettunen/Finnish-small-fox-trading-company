// Stock tab
(function () {
    'use strict';

    const Admin = window.Admin;
    const byId = Admin.byId;
    const esc = Admin.esc;

    async function adjustStock(itemName, delta, inputEl) {
    if (!Admin.state.googleIdToken) { alert('Login required'); return; }
    if (!Admin.WEB_APP_URL) { alert('Error: WEB_APP_URL is missing in app-config.js'); return; }

    byId('stockMsg').textContent = `Sending request for "${itemName}"...`;
        try {
      await window.apiPost('adjustStock', { idToken: Admin.state.googleIdToken, itemName, delta });
  inputEl.value = '';
        byId('stockMsg').textContent = 'Success. Reloading table...';
        await window.reloadStock();
        } catch (e) {
   console.error(e);
   byId('stockMsg').textContent = 'Error: ' + e.message;
  alert('Error: ' + e.message);
        }
    }

    window.reloadStock = async function reloadStock() {
  if (!Admin.state.googleIdToken) { byId('stockMsg').textContent = 'Login required'; return; }

        byId('stockMsg').textContent = 'Requesting stock list...';
    try {
   const r = await window.apiGet('listStock', { idToken: Admin.state.googleIdToken });
      const payload = r.data || r.result || r;
   Admin.state.stockItems = payload.items || payload || [];
        renderStockTable();
   byId('stockMsg').textContent = `Rendered ${Admin.state.stockItems.length} items.`;
   } catch (e) {
   byId('stockMsg').textContent = 'Error during reloadStock: ' + e.message;
  Admin.state.stockItems = [];
      renderStockTable();
  }
    };

    function renderStockTable() {
   const q = (byId('stockSearch').value || '').trim().toLowerCase();
   const body = byId('stockTableBody');
        body.innerHTML = '';

  (Admin.state.stockItems || [])
       .filter(it => !q || String(it.itemName || '').toLowerCase().includes(q))
   .forEach(it => {
       const tr = document.createElement('tr');
       tr.innerHTML = `
 <td>${esc(it.itemName)}</td>
     <td class="mono">${esc(it.rawStock)}</td>
     <td class="mono">${esc(it.targetStockStack)}</td>
     <td class="mono">${esc(it.currentStockStack)}</td>
     <td class="mono">${esc(it.bundleSize)}</td>
 <td>
     <input type="number" step="1" style="width:90px;" placeholder="? individuals" data-stock-delta="${esc(it.itemName)}">
     <button type="button" data-stock-apply="${esc(it.itemName)}">Apply</button>
     </td>`;
       body.appendChild(tr);
      });
    }

    function hookupStockApplyButtons() {
    const body = byId('stockTableBody');
    if (!body) return;

    body.addEventListener('click', ev => {
 const btn = ev.target.closest('button[data-stock-apply]');
   if (!btn) return;

 const tr = btn.closest('tr');
       if (!tr) return;

 const input = tr.querySelector('input[data-stock-delta]');
   if (!input) { alert('Input not found'); return; }

      const itemName = btn.dataset.stockApply;
   const delta = Number(input.value || 0);
  if (!delta) { alert('Enter a non-zero delta'); return; }

 adjustStock(itemName, delta, input);
  });
    }

    function initStockUI() {
   const s = byId('stockSearch');
    if (s) s.addEventListener('input', renderStockTable);
    hookupStockApplyButtons();
    }

    Admin.initStockUI = initStockUI;
})();

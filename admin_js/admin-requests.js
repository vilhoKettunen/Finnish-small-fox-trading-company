// Requests tab
(function () {
    'use strict';

    const Admin = window.Admin;
    const byId = Admin.byId;
    const esc = Admin.esc;

    window.loadPendingRequests = async function loadPendingRequests() {
    if (!Admin.state.googleIdToken) return;
   const msgEl = byId('reqMsg');
    const tableEl = byId('tbRequests');
    msgEl.textContent = 'Loading...';

    try {
   const response = await window.apiGet('listPendingRequests', { idToken: Admin.state.googleIdToken, status: 'PENDING' });
        const dataObj = response.data || response.result || response;
        const requestsList = Array.isArray(dataObj) ? dataObj : (dataObj.requests || []);

 if (requestsList.length === 0) {
 tableEl.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#777;">0 pending requests</td></tr>';
     msgEl.textContent = 'Loaded 0';
      return;
   }

       renderRequests(requestsList);
   msgEl.textContent = `Loaded ${requestsList.length}`;
        } catch (e) {
   console.error(e);
   msgEl.textContent = 'Error: ' + e.message;
        tableEl.innerHTML = `<tr><td colspan="8" style="color:red; text-align:center;">Error: ${esc(e.message)}</td></tr>`;
  }
    };

function renderRequests(arr) {
        const tb = byId('tbRequests');
   tb.innerHTML = '';
    arr.forEach(r => {
   const net = Number(r.totals?.netBT || 0);
  const mailbox = r.user?.mailbox || '-';
   const tr = document.createElement('tr');
  tr.innerHTML = `
 <td><button type="button" onclick="showRequestDetails('${esc(r.requestId)}')">${esc(r.requestId)}</button></td>
      <td>${esc(r.user?.playerName || '')}</td>
      <td style="font-weight:bold; color:#0066cc;">${esc(mailbox)}</td>
     <td>
     <div class="small">Buy: ${(Number(r.totals?.buyBT || 0)).toFixed(2)}</div>
     <div class="small">Sell: ${(Number(r.totals?.sellBT || 0)).toFixed(2)}</div>
       </td>
 <td class="mono">${(Number(r.manualBalanceDeltaBT || 0)).toFixed(2)}</td>
      <td class="mono" style="color:${net >= 0 ? 'green' : 'red'}">${net.toFixed(2)}</td>
      <td class="small">${new Date(r.createdAt).toLocaleString()}</td>
     <td>
     <button type="button" onclick="approveRequest('${esc(r.requestId)}')" style="background:#dff0d8;">? Approve</button>
     <button type="button" onclick="denyRequest('${esc(r.requestId)}')" style="background:#f2dede;">? Deny</button>
      </td>`;
   tb.appendChild(tr);
   });
    }

    window.showRequestDetails = async function showRequestDetails(id) {
  if (!Admin.state.googleIdToken) return;
    const container = byId('reqDetails');
    container.innerHTML = 'Loading details...';

  try {
  const r = await window.apiGet('getRequest', { idToken: Admin.state.googleIdToken, requestId: id });
       const data = r.data || r.result || r;
  const details = data.details || {};
   const user = data.user || details.user || {};
        const carts = details.carts || { buy: [], sell: [] };
 const buyItems = carts.buy || [];
      const sellItems = carts.sell || [];

        const buildList = (items) => {
       if (!items.length) return '<div class="picklist-empty">Nothing</div>';
       return items.map(it => {
     let qtyDisp = `${it.qty}x`;
     if (it.bundleSize && it.bundleSize > 1) qtyDisp = `${it.qty}x${it.bundleSize}`;
     return `
   <div class="picklist-item">
  <span class="picklist-qty">${esc(qtyDisp)}</span>
   ${esc(it.itemName || it.name)}
   <span class="small" style="color:#777">(${esc(it.priceBT || it.price)} BT)</span>
    </div>`;
      }).join('');
  };

        container.innerHTML = `
     <div class="picklist-container">
     <div class="picklist-header">
    <div>
  <div style="font-size:1.1em; font-weight:bold;">${esc(user.playerName || 'Unknown Player')}</div>
    <div class="small">Request ID: ${esc(id)}</div>
    </div>
    <div>
  <span style="margin-right:8px;">Mailbox:</span>
   <span class="mailbox-badge">${esc(user.mailbox || '???')}</span>
     </div>
     </div>
 <div class="picklist-grid">
         <div class="picklist-col give">
  <h4>?? GIVE TO PLAYER</h4>
    <div class="small" style="margin-bottom:8px;">Put these items into <b>Box ${esc(user.mailbox)}</b></div>
  ${buildList(buyItems)}
   </div>
     <div class="picklist-col take">
         <h4>?? TAKE FROM PLAYER</h4>
   <div class="small" style="margin-bottom:8px;">Collect these from <b>Box ${esc(user.mailbox)}</b></div>
   ${buildList(sellItems)}
    </div>
     </div>
     <div style="margin-top:15px; text-align:right; border-top:1px solid #eee; padding-top:10px;">
     <strong>Net Balance Change: </strong>
    <span style="font-size:1.2em; color:${details.totals?.netBT >= 0 ? 'green' : 'red'}">
   ${(Number(details.totals?.netBT || 0)).toFixed(2)} BT
    </span>
     </div>
 </div>`;
    } catch (e) {
  container.textContent = 'Error loading details: ' + e.message;
  }
    };

    window.approveRequest = async function approveRequest(id) {
   if (!confirm('Approve request ' + id + '?')) return;
        try {
      await window.apiPost('approveRequest', { idToken: Admin.state.googleIdToken, requestId: id });
  window.loadPendingRequests();
  } catch (e) {
   alert(e.message);
   }
    };

    window.denyRequest = async function denyRequest(id) {
        if (!confirm('Deny request ' + id + '?')) return;
        try {
      await window.apiPost('denyRequest', { idToken: Admin.state.googleIdToken, requestId: id });
      window.loadPendingRequests();
   } catch (e) {
        alert(e.message);
    }
    };
})();

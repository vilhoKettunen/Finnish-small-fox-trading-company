// Account History tab (admin viewing target user's history)
(function () {
    'use strict';

    const Admin = window.Admin;
    const byId = Admin.byId;
    const esc = Admin.esc;

    // OCM catalog cache for stk/ind display
    let ocmCatalog = null;

    function adminNormalizeResult(j) {
    if (j && j.data != null) return j.data;
    if (j && j.result != null) return j.result;
  return j;
    }

    function formatDatePretty(iso) {
    if (!iso) return '';
    const d = new Date(iso);
   if (isNaN(d.getTime())) return iso;
   const dd = String(d.getDate()).padStart(2, '0');
   const mm = String(d.getMonth() +1).padStart(2, '0');
   const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${dd}-${mm}-${yyyy}, ${hh}:${mi}`;
    }

    function tryParseDetails(detailsJson) {
    if (!detailsJson) return null;
  try { return JSON.parse(detailsJson); } catch { return null; }
    }

function formatQtyStkInd_(qty, stackSize) {
 const qRaw = Number(qty ||0);
 const q = isFinite(qRaw) ? Math.max(0, Math.round(qRaw)) :0;
 const ssRaw = Number(stackSize ||1);
 const ss = (isFinite(ssRaw) && ssRaw >1) ? Math.round(ssRaw) :1;

 if (ss <=1) return `${q} ind`;

 const stk = Math.floor(q / ss);
 const ind = q % ss;
 if (stk >0 && ind >0) return `${stk} stk + ${ind} ind`;
 if (stk >0 && ind ===0) return `${stk} stk`;
 return `${ind} ind`;
}

 async function ensureOcmCatalogLoadedForAdminHistory_() {
 if (Array.isArray(ocmCatalog) && ocmCatalog.length) return;
 try {
 const r = await window.apiGet('ocmGetCatalogSnapshot', {});
 const d = adminNormalizeResult(r);
 const items = d?.items || [];
 ocmCatalog = items.map(x => ({
 name: String(x?.name || '').trim(),
 bundleSize: Number(x?.bundleSize ||1) ||1
 }));
 } catch {
 ocmCatalog = [];
 }
 }

 function getBundleSizeFromCatalog_(name) {
 const q = String(name || '').trim().toLowerCase();
 if (!q || !Array.isArray(ocmCatalog)) return null;
 const it = ocmCatalog.find(i => String(i.name || '').trim().toLowerCase() === q);
 const bs = Number(it?.bundleSize ||0) ||0;
 return bs >1 ? bs : null;
 }

    function buildItemsListHtml(items) {
    if (!Array.isArray(items) || !items.length) return '<div class="history-empty-msg">Nothing</div>';
   return items.map(it => {
      const name = it.itemName || it.name || 'Unknown item';
   const qty = Number(it.qty || it.quantity ||0);
   const bundle = it.bundleSize && Number(it.bundleSize) >1 ? `x${Number(it.bundleSize)}` : 'x';
 const price = it.priceBT || it.price;
  const qtyStr = `${qty}${bundle}`;
        const priceStr = price != null ? ` (${price} BT)` : '';
      return `<div class="history-item-line"><span class="qty">${esc(qtyStr)}</span>${esc(name)}<span class="small">${esc(priceStr)}</span></div>`;
   }).join('');
    }

    function adminSetHistoryHeaders() {
    const mode = byId('adminHistoryMode').value;
  const thead = byId('adminHistoryThead');

    if (mode === 'OCM') {
   thead.innerHTML = `
 <tr>
     <th>Date</th>
 <th>TradeId</th>
     <th>Trader</th>
 <th>Completed By</th>
     <th>Total Value (BT)</th>
 <th>Details</th>
 </tr>`;
   } else {
      thead.innerHTML = `
 <tr>
     <th>Date</th>
     <th>TxId</th>
     <th>Type</th>
     <th>Delta BT</th>
     <th>Balance After</th>
     <th>Details</th>
     </tr>`;
    }
    }

    function adminRenderDetailsRow(mainRow, html) {
        const existing = mainRow.nextElementSibling;
   if (existing && existing.classList.contains('history-details-row')) {
  existing.remove();
        const btn = mainRow.querySelector('button[data-details-toggle]');
   if (btn) btn.textContent = 'See details';
  return;
    }

    const detailsTr = document.createElement('tr');
        detailsTr.className = 'history-details-row';
   const td = document.createElement('td');
  td.colSpan = 6;
   td.innerHTML = html;
   detailsTr.appendChild(td);
        mainRow.parentNode.insertBefore(detailsTr, mainRow.nextSibling);

    const btn = mainRow.querySelector('button[data-details-toggle]');
    if (btn) btn.textContent = 'Hide details';
    }

    function renderAccountDetailsHtml(h) {
    const d = tryParseDetails(h.detailsJson);
   const hasStructured = d && (d.carts || d.totals || d.manualBalanceDeltaBT != null || d.kind);
    if (!hasStructured) return '<div class="history-details-box"><div class="history-empty-msg">No detailed breakdown is available for this transaction.</div></div>';

    const carts = d.carts || {};
        const buy = carts.buy || [];
    const sell = carts.sell || [];
  const totals = d.totals || {};
   const net = Number(totals.netBT || 0);
  const manual = d.manualBalanceDeltaBT != null ? Number(d.manualBalanceDeltaBT) : null;

    const prettyAt = formatDatePretty(h.at || '');

    return `<div class="history-details-box">
      <div class="small" style="margin-bottom:6px;">Date: <strong>${esc(prettyAt || (h.at || ''))}</strong></div>
        <div class="history-details-grid">
     <div class="history-details-col">
     <h4>Items bought</h4>
     ${buildItemsListHtml(buy)}
       </div>
 <div class="history-details-col">
     <h4>Items sold</h4>
     ${buildItemsListHtml(sell)}
       </div>
      </div>
        <div class="small" style="margin-top:6px;">
       Net from items: <strong>${net.toFixed(2)} BT</strong>${manual != null ? ` &nbsp;|&nbsp; Manual adj: <strong>${manual.toFixed(2)} BT</strong>` : ''}
   </div>
   </div>`;
    }

    function renderOcmDetailsHtml(h) {
  const d = tryParseDetails(h.detailsJson);
    if (!d) return '<div class="history-details-box"><div class="history-empty-msg">No details JSON.</div></div>';

        const side = d.side || '';
    const listing = d.listing || {};
  const payment = d.payment || {};
        const req = d.request || {};
    const pricing = d.pricing || {};
    const prettyAt = formatDatePretty(h.at || '');

    const tradedItemName = String(listing.itemName || '').trim();
 const tradedQty = Number(req.requestedUnits ||0) ||0;

 // Traded item: always use catalog bundleSize when possible; if custom item not in catalog use listing.stackSize; else1
 const tradedCatalogBs = getBundleSizeFromCatalog_(tradedItemName);
 const tradedFallbackSs = Number(listing.stackSize ||1) ||1;
 const tradedStackSize = (tradedCatalogBs && tradedCatalogBs >1) ? tradedCatalogBs : (tradedFallbackSs >1 ? tradedFallbackSs :1);
 const tradedQtyLabel = formatQtyStkInd_(tradedQty, tradedStackSize);

 // Payment item: always catalog bundleSize (default1)
 let payItemPart = '';
 if (String(payment.method || '').toUpperCase() === 'ITEM') {
 const payName = String(payment.payItemName || payment.payItem || '').trim();
 const payQty = Number(payment.payItemQty ||0) ||0;
 const payBs = getBundleSizeFromCatalog_(payName) ||1;
 const payQtyLabel = formatQtyStkInd_(payQty, payBs);
 payItemPart = ` (${esc(payQtyLabel)} ${esc(payName)})`;
 }

 return `<div class="history-details-box">
       <div class="small" style="margin-bottom:6px;">Date: <strong>${esc(prettyAt || (h.at || ''))}</strong> <span class="pill-lite">${esc(side)}</span></div>
  <div class="small" style="margin-bottom:6px;">
       Item: <strong>${esc(tradedItemName)}</strong> &nbsp;|&nbsp;
      Qty: <strong>${esc(tradedQtyLabel)}</strong> &nbsp;|&nbsp;
 Type: <strong>${esc(listing.type || '')}</strong>
        </div>
   <div class="small" style="margin-bottom:6px;">
 Payment: <strong>${esc(payment.method || 'BT')}</strong>
 ${payItemPart}
       &nbsp;|&nbsp; Total: <strong>${(Number(payment.canonicalBT ?? payment.payTotalBT ?? h.totalValueBT ??0)).toFixed(2)} BT</strong>
  </div>
   <div class="small">
 Pricing basis: <strong>${esc(pricing.pricingBasis || '')}</strong>
   </div>
   </div>`;
    }

    window.refreshAdminHistoryTargetUI_ = function refreshAdminHistoryTargetUI_() {
  const noTarget = byId('adminHistoryNoTarget');
        const userLabel = byId('adminHistoryUser');

    if (!Admin.state.globalTargetUser) {
       noTarget.style.display = 'block';
 userLabel.textContent = '-';
    } else {
 noTarget.style.display = 'none';
 userLabel.textContent = Admin.state.globalTargetUser.playerName || Admin.state.globalTargetUser.email || Admin.state.globalTargetUser.userId;
  }
    };

window.adminLoadHistory = async function adminLoadHistory() {
  adminSetHistoryHeaders();

    const msg = byId('adminHistoryMsg');
    const tb = byId('adminHistoryTb');
    const pgInfo = byId('adminHistoryPgInfo');

  if (!Admin.state.googleIdToken) { msg.textContent = 'Login required.'; return; }
  if (!Admin.state.globalTargetUser) { msg.textContent = 'Select a target user first.'; tb.innerHTML = ''; pgInfo.textContent = ''; return; }

  msg.textContent = 'Loading...';

  const size = Number(byId('adminPgSize').value || 50);
        const since = byId('adminDtFrom').value || '';
        const until = byId('adminDtTo').value || '';
    const mode = byId('adminHistoryMode').value;

 // Ensure catalog present if admin is in OCM mode
 if (mode === 'OCM') await ensureOcmCatalogLoadedForAdminHistory_();

    const action = (mode === 'OCM') ? 'ocmGetHistory' : 'getHistory';

    try {
        const r = await window.apiGet(action, {
 idToken: Admin.state.googleIdToken,
       userId: Admin.state.globalTargetUser.userId,
 page: Admin.state.adminHistoryPage,
      pageSize: size,
       since,
 until
   });

       const d = adminNormalizeResult(r);
 const arr = d?.items || [];
   const total = Number(d?.total || 0);

  tb.innerHTML = '';

        arr.forEach(h => {
       const tr = document.createElement('tr');
       const prettyAt = formatDatePretty(h.at || '');

     if (mode === 'OCM') {
     const detailsRaw = h.detailsJson || '';
     const hasDetails = !!tryParseDetails(detailsRaw);

     tr.innerHTML = `
    <td>${esc(prettyAt || (h.at || ''))}</td>
     <td>${esc(h.tradeId || '')}</td>
   <td>${esc(h.traderName || '')}</td>
   <td>${esc(h.completedBy || '')}</td>
     <td>${(Number(h.totalValueBT || 0)).toFixed(2)}</td>
     <td>${hasDetails ? `<button type="button" data-details-toggle="1">See details</button>` : `<span class="small">No details</span>`}</td>
     `;

     if (hasDetails) {
   tr.querySelector('button[data-details-toggle]').addEventListener('click', () => {
   adminRenderDetailsRow(tr, renderOcmDetailsHtml(h));
     });
     }
      } else {
     const detailsRaw = h.detailsJson || '';
     const hasDetails = !!tryParseDetails(detailsRaw);

     tr.innerHTML = `
   <td>${esc(prettyAt || (h.at || ''))}</td>
    <td>${esc(h.txId || '')}</td>
     <td>${esc(h.type || '')}</td>
   <td>${(Number(h.deltaBT || 0)).toFixed(2)}</td>
    <td>${(Number(h.balanceAfterBT || 0)).toFixed(2)}</td>
   <td>${hasDetails ? `<button type="button" data-details-toggle="1">See details</button>` : `<span class="small">No details</span>`}</td>
     `;

     if (hasDetails) {
    tr.querySelector('button[data-details-toggle]').addEventListener('click', () => {
  adminRenderDetailsRow(tr, renderAccountDetailsHtml(h));
     });
     }
      }

       tb.appendChild(tr);
 });

  const pages = total && size ? Math.ceil(total / size) : (arr.length < size ? Admin.state.adminHistoryPage : Admin.state.adminHistoryPage + 1);
   pgInfo.textContent = `Page ${Admin.state.adminHistoryPage} / ${pages || '?'}`;
   msg.textContent = `Loaded ${arr.length}.`;
    } catch (e) {
 msg.textContent = 'Error: ' + (e.message || e);
      tb.innerHTML = '';
  pgInfo.textContent = '';
    }
    };
})();

// Leaderboards page logic
(function () {
 'use strict';

 function byId(id){ return document.getElementById(id); }
 function setText(id, t){ const el=byId(id); if(el) el.textContent = t || ''; }

 function fmtNumber_(n, digs){
 const v = Number(n);
 if (!isFinite(v)) return '—';
 const d = Number(digs||0);
 return v.toFixed(d);
 }

 function fmtIso_(iso){
 const s = String(iso || '').trim();
 if (!s) return '—';
 const d = new Date(s);
 if (isNaN(d.getTime())) return s;
 return d.toISOString().replace('T',' ').replace('Z','');
 }

 function renderTable_(tbodyId, items, fmtValue){
 const tb = byId(tbodyId);
 if (!tb) return;
 const arr = Array.isArray(items) ? items : [];
 if (!arr.length){
 tb.innerHTML = '<tr><td class="rank">—</td><td class="muted">No data</td><td class="num">—</td></tr>';
 return;
 }
 tb.innerHTML = arr.map((x, idx) => {
 const name = (x && x.displayName) ? String(x.displayName) : '—';
 const val = fmtValue ? fmtValue(x && x.value) : String(x && x.value);
 return `<tr><td class="rank">${idx+1}</td><td>${escapeHtml_(name)}</td><td class="num">${escapeHtml_(val)}</td></tr>`;
 }).join('');
 }

 function escapeHtml_(s){
 return String(s||'')
 .replace(/&/g,'&amp;')
 .replace(/</g,'&lt;')
 .replace(/>/g,'&gt;')
 .replace(/"/g,'&quot;')
 .replace(/'/g,'&#39;');
 }

 async function loadLeaderboards_(){
 const btn = byId('btnRefreshLeaderboards');
 if (btn) btn.disabled = true;
 setText('lbStatus','Loading…');
 try {
 const r = await window.apiGet('getLeaderboards', {});
 const d = r && (r.data || r.result || r);
 const data = d && (d.data || d.result || d) || d;
 const payload = data && data.leaderboards ? data : (d && d.leaderboards ? d : null);
 const lb = payload ? payload.leaderboards : (d && d.leaderboards) || null;
 const updatedAt = payload ? payload.updatedAt : (d && d.updatedAt);

 setText('lbUpdatedAt', fmtIso_(updatedAt));

 renderTable_('tb_storeMaxBuyValueBT', lb?.storeMaxBuyValueBT, v => fmtNumber_(v,2));
 renderTable_('tb_storeMaxSellValueBT', lb?.storeMaxSellValueBT, v => fmtNumber_(v,2));
 renderTable_('tb_storeTradesWithStoreCount', lb?.storeTradesWithStoreCount, v => fmtNumber_(v,0));

 renderTable_('tb_ocmAsBuyerCount', lb?.ocmAsBuyerCount, v => fmtNumber_(v,0));
 renderTable_('tb_ocmAsMerchantCount', lb?.ocmAsMerchantCount, v => fmtNumber_(v,0));
 renderTable_('tb_ocmFeesPaidBT', lb?.ocmFeesPaidBT, v => fmtNumber_(v,2));
 renderTable_('tb_ocmMaxTradeValueBT', lb?.ocmMaxTradeValueBT, v => fmtNumber_(v,2));
 renderTable_('tb_ocmTotalValueBT', lb?.ocmTotalValueBT, v => fmtNumber_(v,2));

 setText('lbStatus','Loaded.');
 } catch (e) {
 setText('lbStatus','Error: ' + (e.message || e));
 }
 finally {
 if (btn) btn.disabled = false;
 }
 }

 window.addEventListener('load', async () => {
 window.initSharedTopBar && window.initSharedTopBar();
 document.body.classList.add('withTopBar');
 byId('btnRefreshLeaderboards')?.addEventListener('click', loadLeaderboards_);
 await loadLeaderboards_();
 });
})();

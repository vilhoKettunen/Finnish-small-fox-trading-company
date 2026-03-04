// Leaderboards page logic
(function () {
 'use strict';

 // Ensure `apiGet` exists. Some pages rely on `api-client.js`, but Leaderboards may be used standalone.
 // This prevents runtime errors like "Failed to construct 'URL': Invalid URL" in environments where
 // a helper tries to build URLs from an undefined base.
 if (typeof window.apiGet !== 'function') {
 const base = String(window.WEB_APP_URL || '').trim();
 const baseOk = /^https?:\/\//i.test(base);
 window.apiGet = async function (action, params) {
 if (!baseOk) throw new Error('WEB_APP_URL is not configured');
 const qs = new URLSearchParams({ action, ...(params || {}) });
 const resp = await fetch(base + '?' + qs.toString());
 return await resp.json();
 };
 }

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

 function escapeHtml_(s){
 return String(s||'')
 .replace(/&/g,'&amp;')
 .replace(/</g,'&lt;')
 .replace(/>/g,'&gt;')
 .replace(/"/g,'&quot;')
 .replace(/'/g,'&#39;');
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
 const val = fmtValue ? fmtValue(x && (x.value ?? x.valueEW)) : String(x && (x.value ?? x.valueEW));
 return `<tr><td class="rank">${idx+1}</td><td>${escapeHtml_(name)}</td><td class="num">${escapeHtml_(val)}</td></tr>`;
 }).join('');
 }

 function renderTablePeriods_(tbodyId, items, fmtValue){
 const tb = byId(tbodyId);
 if (!tb) return;
 const arr = Array.isArray(items) ? items : [];
 if (!arr.length){
 tb.innerHTML = '<tr><td class="rank">—</td><td class="muted">No data</td><td class="num">—</td><td class="mono muted">—</td><td class="mono muted">—</td></tr>';
 return;
 }
 tb.innerHTML = arr.map((x, idx) => {
 const name = (x && x.displayName) ? String(x.displayName) : '—';
 const valRaw = x && (x.valueEW ?? x.value);
 const val = fmtValue ? fmtValue(valRaw) : String(valRaw);
 const start = fmtIso_(x && x.start);
 const end = fmtIso_(x && x.end);
 return `<tr><td class="rank">${idx+1}</td><td>${escapeHtml_(name)}</td><td class="num">${escapeHtml_(val)}</td><td class="mono">${escapeHtml_(start)}</td><td class="mono">${escapeHtml_(end)}</td></tr>`;
 }).join('');
 }

 function getMode_(){
 const el = byId('lbMode');
 const v = el ? String(el.value||'').trim().toLowerCase() : '';
 return (v === 'record') ? 'record' : 'current';
 }

 async function loadLeaderboards_(){
 const btn = byId('btnRefreshLeaderboards');
 if (btn) btn.disabled = true;
 setText('lbStatus','Loading…');
 try {
 const r = await window.apiGet('getLeaderboards', { mode: getMode_() });
 const d = r && (r.data || r.result || r);
 const data = d && (d.data || d.result || d) || d;
 const payload = data && (data.leaderboards || data.leaderboardsStoreParticipation) ? data : (d && (d.leaderboards || d.leaderboardsStoreParticipation) ? d : null);
 const lb = payload ? payload.leaderboards : (d && d.leaderboards) || null;
 const lbp = payload ? payload.leaderboardsStoreParticipation : (d && d.leaderboardsStoreParticipation) || null;
 const updatedAt = payload ? payload.updatedAt : (d && d.updatedAt);

 setText('lbUpdatedAt', fmtIso_(updatedAt));

 // Store
 renderTable_('tb_storeMaxBuyValueBT', lb?.storeMaxBuyValueEW, v => fmtNumber_(v,2));
 renderTable_('tb_storeMaxSellValueBT', lb?.storeMaxSellValueEW, v => fmtNumber_(v,2));
 renderTable_('tb_storeTradesWithStoreCount', lb?.storeTradesWithStoreCount, v => fmtNumber_(v,0));

 // OCM (EW naming)
 renderTable_('tb_ocmAsCustomerCount', lb?.ocmAsCustomerCount, v => fmtNumber_(v,0));
 renderTable_('tb_ocmAsMerchantCount', lb?.ocmAsMerchantCount, v => fmtNumber_(v,0));
 renderTable_('tb_ocmFeesPaidEW', lb?.ocmFeesPaidEW, v => fmtNumber_(v,2));
 renderTable_('tb_ocmMaxTradeValueEW', lb?.ocmMaxTradeValueEW, v => fmtNumber_(v,2));
 renderTable_('tb_ocmTotalValueEW', lb?.ocmTotalValueEW, v => fmtNumber_(v,2));

 // Store participation (optional UI)
 if (lbp){
 renderTablePeriods_('tb_weekBoughtEW', lbp.weekBoughtEW, v => fmtNumber_(v,2));
 renderTablePeriods_('tb_weekSoldEW', lbp.weekSoldEW, v => fmtNumber_(v,2));
 renderTablePeriods_('tb_monthBoughtEW', lbp.monthBoughtEW, v => fmtNumber_(v,2));
 renderTablePeriods_('tb_monthSoldEW', lbp.monthSoldEW, v => fmtNumber_(v,2));
 renderTablePeriods_('tb_yearBoughtEW', lbp.yearBoughtEW, v => fmtNumber_(v,2));
 renderTablePeriods_('tb_yearSoldEW', lbp.yearSoldEW, v => fmtNumber_(v,2));
 }

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
 byId('lbMode')?.addEventListener('change', loadLeaderboards_);
 await loadLeaderboards_();
 });
})();

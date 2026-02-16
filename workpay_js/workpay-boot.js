(function(){
 const S = {
 idToken:null,
 user:null,
 isAdmin:false,
 balanceBT:null,
 catalog:null,
 jobsPublic:[],
 jobsPublicComputed:[]
 };

 function el(id){ return document.getElementById(id); }

 // ===== Debug panel helpers =====
 const DBG = { lines: [], last: {}, isAdmin:false };
 function dbgLine(msg){
 DBG.lines.push(`[${new Date().toISOString()}] ${msg}`);
 const t = el('workpayDebugText');
 if (t) t.textContent = DBG.lines.join('\n');
 }
 function dbgSet(k,v){ DBG.last[k]=v; }
 function dbgErr(prefix, e){
 const isAdmin = !!S.isAdmin;
 const msg = (e && (e.stack || e.message)) ? String(e.stack || e.message) : String(e);
 dbgLine(prefix + (isAdmin ? (': ' + msg) : ': An error occurred. Please contact support.'));
 }
 function dbgInitLinks(){
 try {
 const base = String(window.WEB_APP_URL||'').trim();
 const cat = el('dbgCatalogLink');
 const wp = el('dbgWorkpayLink');
 if (cat) cat.href = base ? `${base}?action=ocmGetCatalogSnapshot` : '#';
 if (wp) wp.href = base ? `${base}?action=workPayList` : '#';
 } catch {}
 }

 async function fetchBalanceIfLoggedIn(){
 if(!S.idToken) return null;
 try {
 const r = await window.apiGet('getBalance', { idToken: S.idToken });
 const b = (r && r.result && r.result.balanceBT!=null) ? r.result.balanceBT : (r && r.data && r.data.balanceBT!=null) ? r.data.balanceBT : null;
 return b;
 } catch { return null; }
 }

 function setTopbar(){
 if(window.topbarSetAuthState){
 window.topbarSetAuthState({ idToken: S.idToken, user: S.user, isAdmin: S.isAdmin, balanceBT: S.balanceBT });
 }
 }

 function showLoginStatus(msg){
 const ls = el('loginStatus');
 if(ls) ls.textContent = msg || '';
 }

 function escapeHtml(s){
 return String(s||'').replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 }

 function rangeSep(){
 // Use HTML entity so encoding is reliable even if file encoding is not UTF-8.
 return '&ndash;';
 }

 function renderPublic(){
 const tbody = el('jobsTbody');
 if(!tbody) return;
 tbody.innerHTML='';

 const q = el('searchBox')?.value || '';
 const sort = el('sortSelect')?.value || 'highest';

 let list = (S.jobsPublicComputed||[]);
 list = window.workpayCore.filterJobsByQuery(list, q);
 list = window.workpayCore.sortJobsComputed(list, sort);

 el('publicHint').textContent = list.length ? `${list.length} jobs shown.` : 'No active jobs configured yet.';

 list.forEach(j=>{
 const tr = document.createElement('tr');

 const payout = j._computed ? `${window.workpayCore.fmt2(j._computed.payoutPerStackBT)} BT/stack` : 'N/A';
 const unit = String(j.rateUnit||'STACKS_PER_HOUR').toUpperCase() === 'IND_PER_HOUR' ? 'items/h' : 'stacks/h';

 const rateTxt = `${escapeHtml(j.minRate)}${rangeSep()}${escapeHtml(j.maxRate)} ${escapeHtml(unit)}`;
 const bthTxt = j._computed
 ? `${escapeHtml(window.workpayCore.fmt2(j._computed.minBTPerHour))}${rangeSep()}${escapeHtml(window.workpayCore.fmt2(j._computed.maxBTPerHour))} BT/h`
 : 'N/A';

 // Compact layout without headers
 tr.innerHTML = `
 <td style="width:45%;">
 <div style="font-weight:bold;">${escapeHtml(j.itemName||'')}</div>
 <div class="muted">${escapeHtml(payout)}</div>
 </td>
 <td>
 <div><span class="muted">Rate:</span> ${rateTxt}</div>
 <div><span class="muted">Pay:</span> ${bthTxt}</div>
 <div style="margin-top:6px;" data-info-host="1"></div>
 </td>
 `;

 const infoHost = tr.querySelector('[data-info-host]');
 if(infoHost){
 const hasDesc = j.description && String(j.description).trim();
 if(hasDesc){
 const btn = document.createElement('button');
 btn.type='button';
 btn.textContent='More info';
 let expanded=false;
 btn.onclick=()=>{
 expanded=!expanded;
 if(expanded){
 const d=document.createElement('div');
 d.className='desc';
 d.textContent=String(j.description||'');
 infoHost.appendChild(d);
 btn.textContent='Hide info';
 } else {
 const d=infoHost.querySelector('.desc');
 if(d) d.remove();
 btn.textContent='More info';
 }
 };
 infoHost.appendChild(btn);
 }
 }

 tbody.appendChild(tr);
 });
 }

 function computeAndFilterPublic(){
 const map = S.catalog && S.catalog.map ? S.catalog.map : {};
 const out = [];
 let missingCatalog =0;
 let missingPayout =0;
 let computedOk =0;
 (S.jobsPublic||[]).forEach(j=>{
 const key = window.workpayCore.normKey(j.itemKey || j.itemName);
 const it = map[key];
 if(!it) { missingCatalog++; return; } // hide invalid catalog entries
 const buyStack = Number(it.buyStack);
 if(!isFinite(buyStack) || buyStack ===0) { missingPayout++; return; } // hide if no payout
 const c = window.workpayCore.computeBtPerHourRange(j, it);
 if(!c) return;
 out.push({ ...j, _computed: c });
 computedOk++;
 });
 S.jobsPublicComputed = out;

 // expose to debug panel
 dbgSet('public.totalJobsFromBackend', (S.jobsPublic||[]).length);
 dbgSet('public.missingCatalog', missingCatalog);
 dbgSet('public.missingPayout', missingPayout);
 dbgSet('public.computedOk', computedOk);
 dbgSet('public.shown', out.length);
 dbgLine(`Public join: jobs=${(S.jobsPublic||[]).length}, shown=${out.length}, missingCatalog=${missingCatalog}, missingPayout=${missingPayout}`);
 }

 async function loadPublicData(){
 dbgInitLinks();
 dbgLine('Boot: loadPublicData start');

 el('catalogStatus').textContent = 'Loading...';
 try {
 dbgLine('Fetch: ocmGetCatalogSnapshot');
 S.catalog = await window.workpayCore.loadCatalogSnapshot();
 const n = (S.catalog.items||[]).length;
 dbgSet('catalog.count', n);
 dbgLine(`Catalog OK: ${n} items`);
 el('catalogStatus').textContent = `Catalog loaded (${n} items)`;
 } catch(e){
 el('catalogStatus').textContent = 'Catalog load failed';
 dbgErr('Catalog FAIL', e);
 S.catalog = { items:[], map:{} };
 }

 try {
 dbgLine('Fetch: workPayList (public)');
 S.jobsPublic = await window.workpayCore.loadWorkPayJobsPublic();
 dbgSet('workpay.public.count', (S.jobsPublic||[]).length);
 dbgLine(`WorkPay public OK: ${(S.jobsPublic||[]).length} rows`);
 } catch(e){
 dbgErr('WorkPay public FAIL', e);
 S.jobsPublic = [];
 }

 computeAndFilterPublic();
 renderPublic();
 dbgLine('Boot: loadPublicData end');
 }

 async function restoreAuth(){
 if(!window.initAuthFromStorage) return;
 const r = await window.initAuthFromStorage();
 if(!(r && r.ok && r.idToken)) return;
 await applyAuthFromToken(r.idToken, true);
 }

 async function applyAuthFromToken(idToken, silent){
 try {
 dbgLine('Auth: applying token');
 S.idToken = idToken;
 const me = await window.apiGet('me', { idToken });
 const user = (me && me.result && me.result.user) ? me.result.user : (me && me.data && me.data.user) ? me.data.user : null;
 const isAdmin = !!((me && me.result && me.result.isAdmin) ? me.result.isAdmin : (me && me.data && me.data.isAdmin));

 S.user = user;
 S.isAdmin = isAdmin;

 dbgSet('auth.isAdmin', isAdmin);
 dbgLine(`Auth OK: isAdmin=${isAdmin ? 'true' : 'false'}`);

 const b = await fetchBalanceIfLoggedIn();
 S.balanceBT = (b!=null) ? Number(b) : (user && user.balanceBT!=null) ? Number(user.balanceBT) :0;

 setTopbar();
 showLoginStatus(isAdmin ? 'Logged in (admin).' : 'Logged in.');

 // init admin module
 if(window.workpayAdmin){
 window.workpayAdmin.setAuth(S.idToken, S.isAdmin);
 if(S.isAdmin){
 try {
 dbgLine('Fetch: workPayList (admin includeInactive=1)');
 const all = await window.workpayCore.loadWorkPayJobsAdminAll(S.idToken);
 dbgSet('workpay.admin.count', (all||[]).length);
 dbgLine(`WorkPay admin OK: ${(all||[]).length} rows`);
 window.workpayAdmin.setJobsAdminAll(all);
 } catch(e){
 dbgErr('WorkPay admin FAIL', e);
 window.workpayAdmin.setJobsAdminAll([]);
 }
 }
 }
 } catch(e){
 dbgErr('Auth FAIL', e);
 if(!silent) showLoginStatus(e.message||String(e));
 }
 }

 function wireUI(){
 el('searchBox').addEventListener('input', renderPublic);
 el('sortSelect').addEventListener('change', renderPublic);
 el('refreshBtn').onclick = loadPublicData;
 }

 window.addEventListener('load', async ()=>{
 // note: initSharedTopBar is called by inline login script, but calling twice is safe
 wireUI();

 dbgLine('Boot: window load');

 // admin init early (no auth yet)
 if(window.workpayAdmin) window.workpayAdmin.init({ idToken:null, isAdmin:false, catalog:null });

 await loadPublicData();
 await restoreAuth();

 // If admin after restore, set catalog into admin module and load entries
 if(window.workpayAdmin){
 window.workpayAdmin.setCatalog(S.catalog);
 if(S.isAdmin){
 try {
 dbgLine('Fetch: workPayList (admin includeInactive=1) post-restore');
 const all = await window.workpayCore.loadWorkPayJobsAdminAll(S.idToken);
 dbgSet('workpay.admin.count', (all||[]).length);
 dbgLine(`WorkPay admin OK(post-restore): ${(all||[]).length} rows`);
 window.workpayAdmin.setJobsAdminAll(all);
 } catch(e){
 dbgErr('WorkPay admin FAIL(post-restore)', e);
 window.workpayAdmin.setJobsAdminAll([]);
 }
 }
 }

 const copyBtn = el('workpayDebugCopyBtn');
 if (copyBtn && !copyBtn._workpayDbgWired) {
 copyBtn._workpayDbgWired = true;
 copyBtn.addEventListener('click', async ()=>{
 try {
 const payload = { last: DBG.last, log: DBG.lines };
 await navigator.clipboard.writeText(JSON.stringify(payload, null,2));
 dbgLine('Debug copied to clipboard');
 } catch(e){
 dbgErr('Copy debug FAIL', e);
 }
 });
 }
 });

 // Expose for possible GSI callback integration later
 window.workpayApplyAuthFromToken = applyAuthFromToken;
})();

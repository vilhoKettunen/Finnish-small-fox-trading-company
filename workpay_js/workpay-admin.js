(function(){
 const S = {
 idToken: null,
 isAdmin: false,
 catalog: null,
 jobsPublic: [],
 jobsAdminAll: [],
 selectedJobKey: null,
 selectedCatalogKey: null
 };

 function el(id){ return document.getElementById(id); }

 function setAdminVisible(v){
 const btn = el('adminToggleBtn');
 if(btn) btn.style.display = v ? 'inline-block' : 'none';
 }

 function setAdminAreaOn(v){
 const area = el('adminArea');
 if(!area) return;
 if(v) area.classList.add('active');
 else area.classList.remove('active');
 }

 function setStatus(msg){
 const s = el('adminStatus');
 if(s) s.textContent = msg || '';
 }

 function renderEntriesList(){
 const host = el('entriesList');
 if(!host) return;
 const q = String(el('adminEntriesSearch')?.value||'').trim().toLowerCase();
 host.innerHTML = '';

 const jobs = (S.jobsAdminAll||[]).slice();
 jobs.sort((a,b)=> String(a.itemName||'').localeCompare(String(b.itemName||'')));

 jobs.filter(j=>{
 if(!q) return true;
 return String(j.itemName||'').toLowerCase().includes(q) || String(j.itemKey||'').toLowerCase().includes(q);
 }).forEach(j=>{
 const btn = document.createElement('button');
 const active = String(j.isActive||'1')==='1';
 const name = j.itemName || j.itemKey || '(unnamed)';
 btn.textContent = `${active?'[ON]':'[OFF]'} ${name}`;
 btn.onclick = ()=> selectExistingJob(j.itemKey);
 host.appendChild(btn);
 });
 }

    function renderCatalogPickList() {
        const host = el('catalogPickList');
        if (!host) return;
        const q = String(el('catalogItemSearch')?.value || '').trim().toLowerCase();
        host.innerHTML = '';
        const items = (S.catalog && S.catalog.items) ? S.catalog.items : [];

        // simple search: substring match (index-like feel without coupling)
        // Increased limit from 200 to 1000
        items.filter(it => {
            const name = String(it && it.name || '').toLowerCase();
            if (!q) return true;
            return name.includes(q);
        }).slice(0, 1000).forEach(it => {
            const key = window.workpayCore.normKey(it.name);
            const btn = document.createElement('button');
            btn.textContent = it.name;
            btn.onclick = () => selectCatalogItemForNew(key);
            host.appendChild(btn);
        });
    }

 function clearEditor(){
 S.selectedJobKey = null;
 S.selectedCatalogKey = null;
 el('editorKey').style.display = 'none';
 el('editorInvalid').style.display = 'none';
 el('editorItemName').value = '';
 el('editorMinRate').value = '';
 el('editorMaxRate').value = '';
 el('editorRateUnit').value = 'STACKS_PER_HOUR';
 el('editorIsActive').value = '1';
 el('editorDescription').value = '';
 syncDescCount();
 }

 function syncDescCount(){
 const t = String(el('editorDescription')?.value||'');
 const c = el('descCount');
 if(c) c.textContent = String(t.length);
 }

 function selectExistingJob(itemKey){
 const key = String(itemKey||'');
 const j = (S.jobsAdminAll||[]).find(x=>String(x.itemKey||'')===key);
 if(!j) return;

 S.selectedJobKey = key;
 S.selectedCatalogKey = null;

 el('editorKey').style.display = 'inline-block';
 el('editorKey').textContent = key;

 el('editorItemName').value = j.itemName || '';
 el('editorMinRate').value = j.minRate;
 el('editorMaxRate').value = j.maxRate;
 el('editorRateUnit').value = j.rateUnit || 'STACKS_PER_HOUR';
 el('editorIsActive').value = String(j.isActive||'1')==='0' ? '0':'1';
 el('editorDescription').value = j.description || '';
 syncDescCount();

 const catHit = S.catalog && S.catalog.map ? S.catalog.map[key] : null;
 el('editorInvalid').style.display = catHit ? 'none' : 'inline-block';
 }

 function selectCatalogItemForNew(itemKey){
 const key = String(itemKey||'');
 const it = S.catalog && S.catalog.map ? S.catalog.map[key] : null;
 if(!it) return;

 S.selectedCatalogKey = key;
 S.selectedJobKey = null;

 el('editorKey').style.display = 'inline-block';
 el('editorKey').textContent = key;
 el('editorInvalid').style.display = 'none';

 el('editorItemName').value = it.name;
 el('editorMinRate').value = '';
 el('editorMaxRate').value = '';
 el('editorRateUnit').value = 'STACKS_PER_HOUR';
 el('editorIsActive').value = '1';
 el('editorDescription').value = '';
 syncDescCount();
 }

 function readEditorPayload(){
 const itemName = String(el('editorItemName').value||'').trim();
 const minRate = Number(el('editorMinRate').value);
 const maxRate = Number(el('editorMaxRate').value);
 const rateUnit = String(el('editorRateUnit').value||'STACKS_PER_HOUR');
 const description = String(el('editorDescription').value||'');
 const isActive = el('editorIsActive').value === '0' ? '0' : '1';

 return { itemName, minRate, maxRate, rateUnit, description, isActive };
 }

 function validateEditor(payload){
 if(!payload.itemName) throw new Error('Missing item name (select from catalog).');
 if(!Number.isFinite(payload.minRate) || payload.minRate<=0 || Math.floor(payload.minRate)!==payload.minRate) throw new Error('minRate must be integer >0');
 if(!Number.isFinite(payload.maxRate) || payload.maxRate<=0 || Math.floor(payload.maxRate)!==payload.maxRate) throw new Error('maxRate must be integer >0');
 if(payload.maxRate < payload.minRate) throw new Error('maxRate must be >= minRate');
 const u = String(payload.rateUnit||'').toUpperCase();
 if(u !== 'STACKS_PER_HOUR' && u !== 'IND_PER_HOUR') throw new Error('Invalid unit');
 if(String(payload.description||'').length >500) throw new Error('Description too long');
 }

 async function saveCurrent(disableOnly){
 if(!S.isAdmin || !S.idToken) throw new Error('Admin only');
 setStatus('Saving...');

 const p = readEditorPayload();
 if(disableOnly) p.isActive = '0';
 validateEditor(p);

 const itemKeyExisting = S.selectedJobKey;
 const itemKeyNew = S.selectedCatalogKey;

 const payload = { ...p };
 if(itemKeyExisting){
 payload.itemKey = itemKeyExisting;
 // v1: do not allow changing name; enforce stored name from existing record
 const existing = (S.jobsAdminAll||[]).find(x=>String(x.itemKey||'')===String(itemKeyExisting));
 if(existing && existing.itemName) payload.itemName = String(existing.itemName);
 }

 // create requires catalog selection (avoid free typing)
 if(!itemKeyExisting){
 if(!itemKeyNew) throw new Error('To create a new entry, select an item from the catalog list.');
 // backend will compute itemKey from itemName; we still pass itemName only
 }

 const r = await window.apiPost('workPayUpsert', { idToken: S.idToken, payload });
 if(!(r && r.ok)) throw new Error('Save failed');

 setStatus('Saved.');
 return r.result && r.result.job ? r.result.job : null;
 }

 async function reloadAdminAll(){
 if(!S.isAdmin || !S.idToken) return;
 S.jobsAdminAll = await window.workpayCore.loadWorkPayJobsAdminAll(S.idToken);
 renderEntriesList();
 }

 function wire(){
 const adminToggleBtn = el('adminToggleBtn');
 const adminArea = el('adminArea');
 if(adminToggleBtn){
 adminToggleBtn.onclick = ()=>{
 const on = adminArea && adminArea.classList.contains('active');
 setAdminAreaOn(!on);
 };
 }

 el('adminEntriesSearch').addEventListener('input', renderEntriesList);
 el('catalogItemSearch').addEventListener('input', renderCatalogPickList);
 el('editorDescription').addEventListener('input', syncDescCount);

 el('newBlankBtn').onclick = ()=>{
 // hint: user must pick from catalog
 clearEditor();
 setStatus('Pick an item from catalog to create a new entry.');
 };

 el('saveBtn').onclick = async ()=>{
 try {
 await saveCurrent(false);
 await reloadAdminAll();
 } catch(e){
 setStatus(e.message||String(e));
 }
 };

 el('disableBtn').onclick = async ()=>{
 try {
 await saveCurrent(true);
 await reloadAdminAll();
 } catch(e){
 setStatus(e.message||String(e));
 }
 };
 }

 window.workpayAdmin = {
 state: S,
 init: function(opts){
 S.idToken = opts && opts.idToken || null;
 S.isAdmin = !!(opts && opts.isAdmin);
 S.catalog = opts && opts.catalog || null;
 setAdminVisible(S.isAdmin);
 setAdminAreaOn(false);
 wire();
 renderCatalogPickList();
 clearEditor();
 },
 setAuth: function(idToken, isAdmin){
 S.idToken = idToken || null;
 S.isAdmin = !!isAdmin;
 setAdminVisible(S.isAdmin);
 },
 setCatalog: function(catalog){
 S.catalog = catalog;
 renderCatalogPickList();
 },
 setJobsAdminAll: function(jobs){
 S.jobsAdminAll = jobs||[];
 renderEntriesList();
 },
 selectExistingJob
 };
})();

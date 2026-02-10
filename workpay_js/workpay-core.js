(function(){
 function normKey(name){
 return String(name||'').trim().toLowerCase();
 }

 function fmt2(n){
 const x = Number(n);
 const safe = isFinite(x) ? x :0;
 return safe.toFixed(2);
 }

 function computeEffectiveStacksPerHour(rate, unit, bundleSize){
 const r = Number(rate);
 if(!isFinite(r) || r<=0) return null;
 const u = String(unit||'').toUpperCase();
 const bs = Number(bundleSize);
 if(u === 'IND_PER_HOUR'){
 if(!isFinite(bs) || bs<=0) return null;
 return r / bs;
 }
 return r; // STACKS_PER_HOUR default
 }

 function computeBtPerHourRange(job, catalogItem){
 if(!job || !catalogItem) return null;
 // Use the store "buy" stack price (what the store pays the player)
 let payoutPerStack = Number(catalogItem.buyStack);
 // Fallback: if buyStack missing, use buyEach * bundleSize if available
 if((!isFinite(payoutPerStack) || payoutPerStack ===0) && isFinite(Number(catalogItem.buyEach))) {
 const bs = Number(catalogItem.bundleSize ||1) ||1;
 payoutPerStack = Number(catalogItem.buyEach) * bs;
 }
 if(!isFinite(payoutPerStack) || payoutPerStack ===0) return null;

 const bs = Number(catalogItem.bundleSize||1) ||1;

 const minEff = computeEffectiveStacksPerHour(job.minRate, job.rateUnit, bs);
 const maxEff = computeEffectiveStacksPerHour(job.maxRate, job.rateUnit, bs);
 if(minEff==null || maxEff==null) return null;

 return {
 payoutPerStackBT: payoutPerStack,
 minBTPerHour: minEff * payoutPerStack,
 maxBTPerHour: maxEff * payoutPerStack
 };
 }

 async function loadCatalogSnapshot(){
 const r = await window.apiGet('ocmGetCatalogSnapshot');
 const items = (r && r.result && r.result.items) ? r.result.items : (r && r.data && r.data.items) ? r.data.items : [];
 const map = {};
 (items||[]).forEach(it=>{
 const key = normKey(it && it.name);
 if(key) map[key] = it;
 });
 return { items: items||[], map };
 }

 async function loadWorkPayJobsPublic(){
 const r = await window.apiGet('workPayList');
 const jobs = (r && r.result && r.result.jobs) ? r.result.jobs : (r && r.data && r.data.jobs) ? r.data.jobs : [];
 return jobs||[];
 }

 async function loadWorkPayJobsAdminAll(idToken){
 const r = await window.apiGet('workPayList', { includeInactive:'1', idToken: idToken || '' });
 const jobs = (r && r.result && r.result.jobs) ? r.result.jobs : (r && r.data && r.data.jobs) ? r.data.jobs : [];
 return jobs||[];
 }

 function sortJobsComputed(list, sortMode){
 const mode = String(sortMode||'').toLowerCase();
 const arr = (list||[]).slice();
 if(mode === 'lowest'){
 arr.sort((a,b)=> (a._computed?.minBTPerHour||0) - (b._computed?.minBTPerHour||0));
 } else {
 arr.sort((a,b)=> (b._computed?.maxBTPerHour||0) - (a._computed?.maxBTPerHour||0));
 }
 return arr;
 }

 function filterJobsByQuery(list, q){
 const needle = String(q||'').trim().toLowerCase();
 if(!needle) return list||[];
 return (list||[]).filter(j=> normKey(j.itemName).includes(needle));
 }

 window.workpayCore = {
 normKey,
 fmt2,
 computeBtPerHourRange,
 loadCatalogSnapshot,
 loadWorkPayJobsPublic,
 loadWorkPayJobsAdminAll,
 sortJobsComputed,
 filterJobsByQuery
 };
})();

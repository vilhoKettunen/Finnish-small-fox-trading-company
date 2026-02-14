// Catalog + store dropdown helpers for OCMUser
(function () {
 'use strict';

 const O = window.OCMUser;
 const S = O.state;
 const byId = O.byId;
 const esc = O.esc;

 function findCatalogItem(name) {
 const q = String(name || '').trim().toLowerCase();
 return (S.catalog || []).find(i => String(i.name || '').trim().toLowerCase() === q) || null;
 }

 function bundleSizeOfName(name) {
 const it = findCatalogItem(name);
 return it ? (Number(it.bundleSize ||1) ||1) :1;
 }

 function computeQtyUnitsFromInput(value, mode, stackSize) {
 const v = Math.max(0, Number(value ||0) ||0);
 if (!isFinite(v)) return0;
 const ss = Number(stackSize ||1) ||1;
 if (String(mode || 'IND').toUpperCase() === 'STACK') return Math.round(v) * ss;
 return Math.round(v);
 }

 // supports IDs OR elements
 function attachStoreDropdown(inputOrId, listOrId, onPick) {
 const input = (typeof inputOrId === 'string') ? byId(inputOrId) : inputOrId;
 const list = (typeof listOrId === 'string') ? byId(listOrId) : listOrId;
 if (!input || !list) return;

 // Prefer shared universal dropdown if present (adds favorites)
 if (window.universalDropdown && typeof window.universalDropdown.attach === 'function') {
 window.universalDropdown.attach({
 inputEl: input,
 listEl: list,
 getItems: () => (S.catalog || []),
 getLabel: (it) => String(it?.name || ''),
 getExtraText: (it) => `stk:${Number(it?.bundleSize ||1) ||1}`,
 showProgress: false,
 onSelect: (name) => {
 input.value = name;
 const it = findCatalogItem(name);
 if (onPick) onPick(it);
 }
 });
 return;
 }

 // Fallback: old local dropdown
 function setActiveIndex(idx) {
 const els = Array.from(list.querySelectorAll('.dropdown-item'));
 els.forEach(e => e.classList.remove('active'));
 if (idx >=0 && idx < els.length) {
 els[idx].classList.add('active');
 els[idx].scrollIntoView({ block: 'nearest' });
 input._dropIndex = idx;
 } else {
 input._dropIndex = -1;
 }
 }

 function renderAndShow() {
 const q = String(input.value || '').trim().toLowerCase();
 const filtered = (S.catalog || [])
 .map(it => ({ it, name: String(it.name || '') }))
 .filter(x => !q || x.name.toLowerCase().includes(q))
 .slice(0,200);

 list.innerHTML = '';
 filtered.forEach(x => {
 const div = document.createElement('div');
 div.className = 'dropdown-item';
 div.innerHTML = `<strong>${esc(x.name)}</strong> <span class="small">(stk:${Number(x.it.bundleSize ||1) ||1})</span>`;
 div.onclick = () => {
 input.value = x.name;
 list.style.display = 'none';
 input._dropIndex = -1;
 if (onPick) onPick(x.it);
 };
 list.appendChild(div);
 });

 input._dropIndex = -1;
 list.style.display = list.children.length ? 'block' : 'none';
 }

 input.addEventListener('input', renderAndShow);
 input.addEventListener('focus', renderAndShow);
 input.addEventListener('keydown', ev => {
 const els = Array.from(list.querySelectorAll('.dropdown-item'));
 if (!els.length) return;
 if (ev.key === 'ArrowDown') { ev.preventDefault(); setActiveIndex(Math.min((input._dropIndex || -1) +1, els.length -1)); }
 else if (ev.key === 'ArrowUp') { ev.preventDefault(); setActiveIndex(Math.max((input._dropIndex || -1) -1,0)); }
 else if (ev.key === 'Enter') {
 if (typeof input._dropIndex === 'number' && input._dropIndex >=0) { ev.preventDefault(); els[input._dropIndex].click(); }
 } else if (ev.key === 'Escape') {
 list.style.display = 'none';
 input._dropIndex = -1;
 }
 });

 input.addEventListener('blur', () => setTimeout(() => { list.style.display = 'none'; input._dropIndex = -1; },200));
 }

 function normalizeCatalogItem_(it) {
 if (!it) return it;
 const out = Object.assign({}, it);

 // Ensure bundle size is a number
 out.bundleSize = Number(out.bundleSize ||1) ||1;

 // Normalize numeric prices consistently
 const norm = (v) => (O.parseMaybeScaledBt_ ? O.parseMaybeScaledBt_(v) : (v == null ? null : Number(v)));

 if (out.buyEach != null) out.buyEach = norm(out.buyEach);
 if (out.sellEach != null) out.sellEach = norm(out.sellEach);
 if (out.buyStack != null) out.buyStack = norm(out.buyStack);
 if (out.sellStack != null) out.sellStack = norm(out.sellStack);

 return out;
 }

 async function ensureCatalogLoaded() {
 if (S.catalog && S.catalog.length) return;
 try {
 const r = await apiGet('ocmGetCatalogSnapshot', {});
 const d = r.data || r.result || r;
 const raw = d.items || [];
 S.catalog = raw.map(normalizeCatalogItem_);
 } catch {
 S.catalog = [];
 }

 attachStoreDropdown('createItemStore', 'createItemStoreList');
 attachStoreDropdown('editItemStore', 'editItemStoreList');
 }

 // exports
 O.attachStoreDropdown = attachStoreDropdown;
 O.ensureCatalogLoaded = ensureCatalogLoaded;
 O.findCatalogItem = findCatalogItem;
 O.bundleSizeOfName = bundleSizeOfName;
 O.computeQtyUnitsFromInput = computeQtyUnitsFromInput;
})();

// OCM helpers + listing create/edit UI
(function () {
 'use strict';

 const Admin = window.Admin;
 const byId = Admin.byId;
 const esc = Admin.esc;
 const fmt2 = Admin.fmt2;
 const safeJsonParse = Admin.safeJsonParse;

    // Insert this small helper block near the top of admin-ocm.js (immediately after
    // the `safeJsonParse`/helper declarations) so the functions exist before they're called.

    function assertIntegerQty_(val, fieldLabel, allowZero) {
        const n = Number(val);
        if (!isFinite(n)) throw new Error(`${fieldLabel} must be a number`);
        if (!Number.isInteger(n)) throw new Error(`${fieldLabel} must be an integer`);
        if (!allowZero && n <= 0) throw new Error(`${fieldLabel} must be > 0`);
        if (allowZero && n < 0) throw new Error(`${fieldLabel} must be >= 0`);
        return n;
    }

    function syncEditPricingModeUI_() {
        const mEl = byId('editPricingMode');
        const lmEl = byId('editListingMode');

        const m = mEl ? String(mEl.value || 'PEG').toUpperCase() : 'PEG';
        if (byId('editPegFields')) byId('editPegFields').style.display = (m === 'PEG') ? '' : 'none';
        if (byId('editFixedFields')) byId('editFixedFields').style.display = (m === 'FIXED_BT') ? '' : 'none';

        const lm = lmEl ? String(lmEl.value || '').toUpperCase() : '';
        if (lm === 'FULL') {
            if (mEl) { mEl.value = 'FIXED_BT'; mEl.disabled = true; }
            if (byId('editPegFields')) byId('editPegFields').style.display = 'none';
            if (byId('editFixedFields')) byId('editFixedFields').style.display = '';
        } else {
            if (mEl) mEl.disabled = false;
        }
    }

    // optional: expose for boot wiring (older admin-boot expects Admin._syncEditPricingMode)
    if (window.Admin) window.Admin._syncEditPricingModeUI_ = syncEditPricingModeUI_;
 // Only show More info for actionable pending trades
 function isActionablePendingTrade_(tr) {
 const s = String(tr?.status || '').toUpperCase();
 const bad = new Set(['CANCELLED', 'CANCELED', 'EXPIRED', 'COMplete', 'COMPLETED', 'DENIED', 'REJECTED', 'FAILED']);
 if (!s) return true;
 if (bad.has(s)) return false;
 return s.includes('PENDING');
 }

 function labelFromUserId_(uid) {
 const r = window.resolveNameMailbox_ ? window.resolveNameMailbox_(uid) : { name: String(uid || ''), mailbox: 'N/A' };
 return `${r?.name || ''} (Mailbox ${r?.mailbox || 'N/A'})`;
 }

 // Robust BT number parser (handles "," decimals and thousands separators)
 function parseBtNumber_(v) {
 if (v == null || v === '') return null;
 if (typeof v === 'number') return isFinite(v) ? v : null;

 let s = String(v).trim();
 if (!s) return null;
 s = s.replace(/\s+/g, '');

 const hasDot = s.includes('.');
 const hasComma = s.includes(',');

 if (hasDot && hasComma) {
 const lastDot = s.lastIndexOf('.');
 const lastComma = s.lastIndexOf(',');
 if (lastComma > lastDot) {
 s = s.replace(/\./g, '');
 s = s.replace(',', '.');
 } else {
 s = s.replace(/,/g, '');
 }
 } else if (hasComma) {
 s = s.replace(',', '.');
 }

 const n = Number(s);
 return isFinite(n) ? n : null;
 }

 // Handle legacy "x10" scaling bug for some catalog payloads
 function parseMaybeScaledBt_(raw) {
 const n = parseBtNumber_(raw);
 if (n == null || !isFinite(n)) return null;
 if (Number.isInteger(n) && n >=10) return n /10;
 return n;
 }

 function perIndPriceFromCatalogSide_(itemName, side) {
 const it = findCatalogItem(itemName);
 if (!it) return null;

 const eachRaw = (side === 'BUY') ? it.buyEach : it.sellEach;
 const each = parseMaybeScaledBt_(eachRaw);
 if (each != null) return each;

 const stkRaw = (side === 'BUY') ? it.buyStack : it.sellStack;
 const stk = parseMaybeScaledBt_(stkRaw);
 const bs = Number(it.bundleSize ||1) ||1;
 if (stk != null) return stk / bs;

 return null;
 }

 // ===== Catalog =====
 window.ensureOcmCatalogLoaded = async function ensureOcmCatalogLoaded() {
 if (Admin.state.ocmCatalog && Admin.state.ocmCatalog.length) return;
 try {
 const r = await window.apiGet('ocmGetCatalogSnapshot', {});
 const d = r.data || r.result || r;
 const raw = d.items || [];

 // Normalize loaded catalog so all UI sees consistent numeric prices
 Admin.state.ocmCatalog = raw.map(x => {
 const it = Object.assign({}, x);
 it.bundleSize = Number(it.bundleSize ||1) ||1;
 if (it.buyEach != null) it.buyEach = parseMaybeScaledBt_(it.buyEach);
 if (it.sellEach != null) it.sellEach = parseMaybeScaledBt_(it.sellEach);
 if (it.buyStack != null) it.buyStack = parseMaybeScaledBt_(it.buyStack);
 if (it.sellStack != null) it.sellStack = parseMaybeScaledBt_(it.sellStack);
 return it;
 });
 } catch {
 Admin.state.ocmCatalog = [];
 }

 window.attachStoreDropdown('createItemStore', 'createItemStoreList');

 // Register admin catalog lookup for shared TradeMoreInfo renderer.
 try {
 if (window.TradeMoreInfo && typeof window.TradeMoreInfo.setCatalogLookup === 'function') {
 // findCatalogItem is defined in this module
 window.TradeMoreInfo.setCatalogLookup(findCatalogItem);
 }
 } catch { /* ignore */ }

 };

 function findCatalogItem(name) {
 const q = String(name || '').trim().toLowerCase();
 return (Admin.state.ocmCatalog || []).find(i => String(i.name || '').trim().toLowerCase() === q) || null;
 }

 function bundleSizeOfName(name) {
 const it = findCatalogItem(name);
 return it ? (Number(it.bundleSize ||1) ||1) :1;
 }

 function computeQtyUnitsFromInput(value, mode, stackSize) {
 const v = Math.max(0, Number(value ||0) ||0);
 if (!isFinite(v)) return 0;
 const ss = Number(stackSize ||1) ||1;
 if (String(mode || 'IND').toUpperCase() === 'STACK') return Math.round(v) * ss;
 return Math.round(v);
 }

 window.attachStoreDropdown = function attachStoreDropdown(inputOrId, listOrId, onPick) {
 const input = (typeof inputOrId === 'string') ? byId(inputOrId) : inputOrId;
 const list = (typeof listOrId === 'string') ? byId(listOrId) : listOrId;
 if (!input || !list) return;

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
 const filtered = (Admin.state.ocmCatalog || [])
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
 };

 // ===== Peg row rendering =====
 window.makePegRowDom_ = function makePegRowDom_(cfg) {
 const row = cfg.defaultRow || { itemName: '', ui: { priceBasis: 'IND', pegQtyBasis: 'IND', pegQtyInput:1 } };

 const wrap = document.createElement('div');
 wrap.className = 'peg-row';

 const head = document.createElement('div');
 head.className = 'peg-row-head';

 const title = document.createElement('div');
 title.innerHTML = `<strong>${esc(cfg.title || 'Peg')}</strong>`;
 head.appendChild(title);

 if (cfg.canRemove) {
 const btn = document.createElement('button');
 btn.type = 'button';
 btn.textContent = 'Remove';
 btn.addEventListener('click', () => cfg.onRemove && cfg.onRemove());
 head.appendChild(btn);
 }

 const grid = document.createElement('div');
 grid.className = 'peg-row-grid';

 // item dropdown
 const itemWrap = document.createElement('div');
 itemWrap.innerHTML = `<div class="small">Peg item (store item)</div>`;
 const dw = document.createElement('div');
 dw.className = 'dropdown-wrap';
 const input = document.createElement('input');
 input.className = 'dropdown-input';
 input.type = 'text';
 input.autocomplete = 'off';
 input.value = row.itemName || '';
 input.placeholder = 'Type to search';
 const list = document.createElement('div');
 list.className = 'dropdown-list';
 dw.appendChild(input);
 dw.appendChild(list);
 itemWrap.appendChild(dw);

 const priceInfo = document.createElement('div');
 priceInfo.className = 'small';
 priceInfo.style.color = '#666';
 priceInfo.textContent = '—';
 itemWrap.appendChild(priceInfo);

 grid.appendChild(itemWrap);

 // priceBasis
 const priceBasis = document.createElement('select');
 priceBasis.innerHTML = `<option value="IND">IND</option><option value="STACK">STACK</option>`;
 priceBasis.value = String(row.ui?.priceBasis || 'IND').toUpperCase();
 const pbWrap = document.createElement('div');
 pbWrap.innerHTML = `<div class="small">Price basis (sold item)</div>`;
 pbWrap.appendChild(priceBasis);
 grid.appendChild(pbWrap);

 // pegQtyInput + pegQtyBasis
 const qtyInput = document.createElement('input');
 qtyInput.type = 'number';
 qtyInput.min = '1';
 qtyInput.step = '1';
 qtyInput.value = String(Math.round(Number(row.ui?.pegQtyInput ||1) ||1));

 const qtyBasis = document.createElement('select');
 qtyBasis.innerHTML = `<option value="IND">IND</option><option value="STACK">STACK</option>`;
 qtyBasis.value = String(row.ui?.pegQtyBasis || 'IND').toUpperCase();

 const qtyWrap = document.createElement('div');
 qtyWrap.innerHTML = `<div class="small">Peg qty</div>`;
 const inline = document.createElement('div');
 inline.className = 'inline-row';
 inline.appendChild(qtyInput);
 inline.appendChild(qtyBasis);
 qtyWrap.appendChild(inline);
 const hint = document.createElement('div');
 hint.className = 'small';
 hint.style.color = '#666';
 hint.textContent = 'Integer only.';
 qtyWrap.appendChild(hint);
 grid.appendChild(qtyWrap);

 const statement = document.createElement('div');
 statement.className = 'small';
 statement.style.marginTop = '6px';
 statement.textContent = '—';

 wrap.appendChild(head);
 wrap.appendChild(grid);
 wrap.appendChild(statement);

 function updatePriceInfo_() {
 const it = findCatalogItem(input.value);
 if (!it) { priceInfo.textContent = '—'; return; }
 const bs = Number(it.bundleSize ||1) ||1;
 const parts = [];
 if (it.buyEach != null) parts.push(`buyEach:${fmt2(it.buyEach)}`);
 if (it.sellEach != null) parts.push(`sellEach:${fmt2(it.sellEach)}`);
 if (it.buyStack != null) parts.push(`buyStack:${fmt2(it.buyStack)}`);
 if (it.sellStack != null) parts.push(`sellStack:${fmt2(it.sellStack)}`);
 priceInfo.textContent = `${parts.join(', ')} (bs:${bs})`;
 }

     function updateStatement_(getSoldName, getSoldStackSize) {
         const soldName = getSoldName ? getSoldName() : 'ITEM';
         const soldSS = Number(getSoldStackSize ? getSoldStackSize() :1) ||1;
         const pb = String(priceBasis.value || 'IND').toUpperCase();
         const pegName = input.value || 'PEG';
         const q = Math.max(1, Math.round(Number(qtyInput.value || 1) || 1));
         const qb = String(qtyBasis.value || 'IND').toUpperCase();
         const pegBS = bundleSizeOfName(pegName);
         const pegQtyInd = (qb === 'STACK') ? (q * pegBS) : q;

         // Equation quantities
         const leftQtyInd = (pb === 'STACK') ? soldSS :1;
         const rightQtyInd = pegQtyInd;

         const eqLine = (pb === 'STACK')
             ? `${leftQtyInd} x ${soldName} = ${rightQtyInd} x ${pegName}`
             : `1 x ${soldName} = ${rightQtyInd} x ${pegName}`;

         const soldBuy = perIndPriceFromCatalogSide_(soldName, 'BUY');
         const soldSell = perIndPriceFromCatalogSide_(soldName, 'SELL');
         const pegBuy = perIndPriceFromCatalogSide_(pegName, 'BUY');
         const pegSell = perIndPriceFromCatalogSide_(pegName, 'SELL');

         function line(label, l, r) {
             if (l == null || r == null) return `${label}:  (missing catalog price)`;
             const leftBt = leftQtyInd * l;
             const rightBt = rightQtyInd * r;
             return `${label}: ${fmt2(leftBt)} BT (${soldName}) | ${fmt2(rightBt)} BT (${pegName})`;
         }

         const buyLine = line('BUY', soldBuy, pegBuy);
         const sellLine = line('SELL', soldSell, pegSell);

         // ----- Favor calculations (match OCMUser behavior) -----
         function pctLine_(who, pct) {
             if (pct == null || !isFinite(pct)) return '';
             const p = Number(pct);
             const abs = Math.abs(p).toFixed(1);
             if (p >=0) {
                 return `<span class="trade-favor good">${esc(who)} favor: ${esc(abs)}% cheaper compared to store</span>`;
             }
             return `<span class="trade-favor bad">${esc(who)} disfavor: ${esc(abs)}% more expensive compared to store</span>`;
         }

         let customerPctRaw = null;
         let merchantPctRaw = null;
         try {
             const soldBuyTotal = (soldBuy == null) ? null : (leftQtyInd * soldBuy);
             const soldSellTotal = (soldSell == null) ? null : (leftQtyInd * soldSell);
             const pegBuyTotal = (pegBuy == null) ? null : (rightQtyInd * pegBuy);
             const pegSellTotal = (pegSell == null) ? null : (rightQtyInd * pegSell);

             const listingType = String((cfg.getListingType && cfg.getListingType()) || (cfg.listingType || 'SELL')).toUpperCase();

             if (listingType === 'BUY') {
                 // BUY (PEG statement uses ITEM-style formulas by requirement)
                 // Customer: (1 - (soldBuyTotal / pegSellTotal))*100
                 if (soldBuyTotal != null && pegSellTotal != null && isFinite(soldBuyTotal) && isFinite(pegSellTotal) && pegSellTotal >0) {
                     customerPctRaw = (1 - (Number(soldBuyTotal) / Number(pegSellTotal))) *100;
                 }

                 // Merchant: (1 - (pegBuyTotal / soldSellTotal))*100
                 if (pegBuyTotal != null && soldSellTotal != null && isFinite(pegBuyTotal) && isFinite(soldSellTotal) && soldSellTotal >0) {
                     merchantPctRaw = (1 - (Number(pegBuyTotal) / Number(soldSellTotal))) *100;
                 }
             } else {
                 // SELL (keep existing behavior)
                 // Customer: (1 - (pegBuyTotal / soldSellTotal))*100
                 if (soldSellTotal != null && pegBuyTotal != null && isFinite(soldSellTotal) && soldSellTotal >0 && isFinite(pegBuyTotal)) {
                     customerPctRaw = (1 - (Number(pegBuyTotal) / Number(soldSellTotal))) *100;
                 }

                 // Merchant: (1 - (soldBuyTotal / pegSellTotal))*100
                 if (soldBuyTotal != null && pegSellTotal != null && isFinite(pegSellTotal) && pegSellTotal >0 && isFinite(soldBuyTotal)) {
                     merchantPctRaw = (1 - (Number(soldBuyTotal) / Number(pegSellTotal))) *100;
                 }
             }
         } catch { customerPctRaw = null; merchantPctRaw = null; }

         const customerHtml = pctLine_('Customer', customerPctRaw);
         const merchantHtml = pctLine_('Merchant', merchantPctRaw);

         statement.innerHTML = `${esc(eqLine)}<br><span class="muted">${esc(buyLine)}</span><br><span class="muted">${esc(sellLine)}</span>${customerHtml ? `<br>${customerHtml}` : ''}${merchantHtml ? `<br>${merchantHtml}` : ''}`;
     }

 window.attachStoreDropdown(input, list, (it) => {
 input.value = it.name;
 updatePriceInfo_();
 updateStatement_(cfg.getSoldName, cfg.getSoldStackSize);
 cfg.onChange && cfg.onChange();
 });

 input.addEventListener('input', () => { updatePriceInfo_(); updateStatement_(cfg.getSoldName, cfg.getSoldStackSize); cfg.onChange && cfg.onChange(); });
 priceBasis.addEventListener('change', () => { updateStatement_(cfg.getSoldName, cfg.getSoldStackSize); cfg.onChange && cfg.onChange(); });
 qtyInput.addEventListener('input', () => { updateStatement_(cfg.getSoldName, cfg.getSoldStackSize); cfg.onChange && cfg.onChange(); });
 qtyBasis.addEventListener('change', () => { updateStatement_(cfg.getSoldName, cfg.getSoldStackSize); cfg.onChange && cfg.onChange(); });

 updatePriceInfo_();
 updateStatement_(cfg.getSoldName, cfg.getSoldStackSize);

// Expose refresh hook so sold-side inputs can trigger recompute
 wrap.refreshStatement = () => updateStatement_(cfg.getSoldName, cfg.getSoldStackSize);

 wrap.getValue = () => {
 const itemName = String(input.value || '').trim();
 const ui = {
 priceBasis: String(priceBasis.value || 'IND').toUpperCase(),
 pegQtyBasis: String(qtyBasis.value || 'IND').toUpperCase(),
 pegQtyInput: Math.max(1, Math.round(Number(qtyInput.value ||1) ||1))
 };
 return { itemName, ui };
 };

 return wrap;
 };

    // ===== Peg set validation and payload building =====
    window.validatePegSet_ = function validatePegSet_(primaryRow, altRows, warnEl) {
        warnEl.textContent = '';

    const allNames = [];
    const p = primaryRow.getValue();
  if (!p.itemName) { warnEl.textContent = 'Primary peg item is required.'; return false; }
   if (!findCatalogItem(p.itemName)) { warnEl.textContent = 'Primary peg item not found in catalog.'; return false; }
        allNames.push(p.itemName.toLowerCase());

    for (let i =0; i < altRows.length; i++) {
      const a = altRows[i].getValue();
      if (!a.itemName) continue;
       if (!findCatalogItem(a.itemName)) { warnEl.textContent = `Alt peg "${a.itemName}" not found in catalog.`; return false; }
 const key = a.itemName.toLowerCase();
  if (allNames.includes(key)) { warnEl.textContent = 'Duplicate peg items are not allowed.'; return false; }
  allNames.push(key);
    }

        if (altRows.length >10) { warnEl.textContent = 'Too many alternative pegs (max10).'; return false; }
   return true;
    };

    function buildPegPayload_(primaryRow, altRows) {
    const primary = primaryRow.getValue();
   const alts = altRows.map(r => r.getValue()).filter(p => p.itemName);
   return { primaryPeg: primary, altPegs: alts };
}

    window.initCreatorPegUIs_ = function initCreatorPegUIs_() {
 const createState = Admin.state.createState;

 const storeBox = byId('createStorePegBox');
 storeBox.innerHTML = '';
 createState.store.alts = [];

 createState.store.primary = window.makePegRowDom_({
 title: 'Primary peg (required)',
 canRemove: false,
 defaultRow: { itemName: '', ui: { priceBasis: 'IND', pegQtyBasis: 'IND', pegQtyInput:1 } },
 getSoldName: () => byId('createItemStore').value.trim() || 'ITEM',
 getSoldStackSize: () => {
 const it = findCatalogItem(byId('createItemStore').value.trim());
 return Number(it?.bundleSize ||1) ||1;
 },
 getListingType: () => byId('createTypeStore')?.value || 'SELL',
 onChange: () => window.validatePegSet_(createState.store.primary, createState.store.alts, byId('createStorePegWarn'))
 });
 storeBox.appendChild(createState.store.primary);

 const halfBox = byId('createHalfPegBox');
 halfBox.innerHTML = '';
 createState.half.alts = [];

 createState.half.primary = window.makePegRowDom_({
 title: 'Primary peg (required)',
 canRemove: false,
 defaultRow: { itemName: '', ui: { priceBasis: 'IND', pegQtyBasis: 'IND', pegQtyInput:1 } },
 getSoldName: () => byId('createItemHalf').value.trim() || 'ITEM',
 getSoldStackSize: () => Number(byId('createStackHalf').value ||1) ||1,
 getListingType: () => byId('createTypeHalf')?.value || 'SELL',
 onChange: () => window.validatePegSet_(createState.half.primary, createState.half.alts, byId('createHalfPegWarn'))
 });
 halfBox.appendChild(createState.half.primary);

 // Ensure type dropdown changes refresh PEG statements (favor labels are type-dependent)
 try {
 const hookType = (el, modeKey) => {
 if (!el || el._ocmPegTypeRefreshHooked) return;
 el._ocmPegTypeRefreshHooked = true;
 el.addEventListener('change', () => {
 try {
 const st = Admin.state?.createState?.[modeKey];
 if (st?.primary?.refreshStatement) st.primary.refreshStatement();
 (st?.alts || []).forEach(r => r?.refreshStatement && r.refreshStatement());
 } catch { /* ignore */ }
 });
 };
 hookType(byId('createTypeStore'), 'store');
 hookType(byId('createTypeHalf'), 'half');
 } catch { /* ignore */ }
 };

 // ===== Edit dialog =====
 function renderEditPegBox_(soldNameGetter, soldStackGetter) {
 const box = byId('editPegBox');
 box.innerHTML = '';

 const editState = Admin.state.editState;
 editState.alts = [];

 editState.primary = window.makePegRowDom_({
 title: 'Primary peg (required)',
 canRemove: false,
 defaultRow: editState.primary || { itemName: '', ui: { priceBasis: 'IND', pegQtyBasis: 'IND', pegQtyInput:1 } },
 getSoldName: soldNameGetter,
 getSoldStackSize: soldStackGetter,
 getListingType: () => {
 // In admin editor, Type is stored on the listing being edited (source of truth)
 const t = String(Admin.state?.ocmEditingListing?.type || '').toUpperCase();
 return t || 'SELL';
 },
 onChange: () => window.validatePegSet_(editState.primary, editState.alts, byId('editPegWarn'))
 });
 box.appendChild(editState.primary);

 const existingAlts = (editState._initialAltRows || []);
 editState._initialAltRows = null;

 existingAlts.forEach((a, i) => {
 const row = window.makePegRowDom_({
 title: `Alternative peg #${i +1}`,
 canRemove: true,
 defaultRow: a,
 getSoldName: soldNameGetter,
 getSoldStackSize: soldStackGetter,
 getListingType: () => {
 const t = String(Admin.state?.ocmEditingListing?.type || '').toUpperCase();
 return t || 'SELL';
 },
 onRemove: () => {
 const idx = editState.alts.indexOf(row);
 if (idx >=0) editState.alts.splice(idx,1);
 row.remove();
 window.validatePegSet_(editState.primary, editState.alts, byId('editPegWarn'));
 },
 onChange: () => window.validatePegSet_(editState.primary, editState.alts, byId('editPegWarn'))
 });
 editState.alts.push(row);
 box.appendChild(row);
 });

 window.validatePegSet_(editState.primary, editState.alts, byId('editPegWarn'));
 }

 window.openAdminEditListing_ = function openAdminEditListing_(l) {
 Admin.state.ocmEditingListing = l;

 byId('editListingId').textContent = l.listingId;
 byId('editQty').value = String(Number(l.quantity ?? l.qtyAvailable ??1) ||1);
 byId('editRemainingQty').value = (l.remainingQuantity == null || l.remainingQuantity === '') ? '' : String(l.remainingQuantity);
 byId('editStack').value = String(Number(l.stackSize ||1) ||1);

 const listingMode = String(l.pricing?.listingMode || (safeJsonParse(l.extraJson || '{}') || {}).listingMode || '').toUpperCase() || (String(l.sourceItemId || '').startsWith('sheet:') ? 'STORE' : 'HALF');
 byId('editListingMode').value = (listingMode === 'FULL') ? 'FULL' : (listingMode === 'STORE' ? 'STORE' : 'HALF');

 byId('editItemName').value = l.itemName || '';
 byId('editSourceItemId').value = l.sourceItemId || '';

 const mode = String(l.pricing?.mode || 'PEG').toUpperCase();
 byId('editPricingMode').value = (mode === 'FIXED_BT') ? 'FIXED_BT' : 'PEG';
 byId('editFixedBTVal').value = String(l.pricing?.fixedBTPerUnit ??1);

 const prim = l.pricing?.primaryPeg || (l.pricing?.pegItemName ? {
 itemName: l.pricing.pegItemName,
 ui: {
 priceBasis: l.pricing.pricingBasis || 'IND',
 pegQtyBasis: 'IND',
 pegQtyInput: Math.max(1, Math.round(Number(l.pricing.pegQtyPerUnit ||1) ||1))
 }
 } : null);

 const editState = Admin.state.editState;
 editState.primary = prim || { itemName: '', ui: { priceBasis: 'IND', pegQtyBasis: 'IND', pegQtyInput:1 } };
 editState._initialAltRows = (Array.isArray(l.pricing?.altPegs) ? l.pricing.altPegs : []).map(a => ({
 itemName: a.itemName,
 ui: a.ui || { priceBasis: 'IND', pegQtyBasis: 'IND', pegQtyInput:1 }
 }));

 const soldNameGetter = () => byId('editItemName').value.trim() || 'ITEM';
 const soldStackGetter = () => Number(byId('editStack').value ||1) ||1;

 renderEditPegBox_(soldNameGetter, soldStackGetter);

 // NEW: sold-side changes should refresh peg statements (favor lines depend on sold-side)
 try {
 const editItem = byId('editItemName');
 const editStack = byId('editStack');
 const hookEdit = (el) => {
 if (!el || el._ocmPegRefreshHooked) return;
 el._ocmPegRefreshHooked = true;
 el.addEventListener('input', () => {
 try {
 const st = Admin.state.editState;
 if (st?.primary?.refreshStatement) st.primary.refreshStatement();
 (st?.alts || []).forEach(r => r?.refreshStatement && r.refreshStatement());
 } catch { /* ignore */ }
 });
 };
 hookEdit(editItem);
 hookEdit(editStack);
 } catch { /* ignore */ }

 byId('editPause').checked = String(l.statusRaw || l.status || '').toUpperCase() === 'PAUSED';
 byId('editRejectedWarning').style.display = (String(l.statusRaw || l.status || '').toUpperCase() === 'REJECTED') ? 'block' : 'none';
 byId('editListingMsg').textContent = '';

 syncEditPricingModeUI_();
 byId('dlgEditListing').showModal();
 };

    window.saveAdminListingEdit_ = async function saveAdminListingEdit_() {
    if (!Admin.state.ocmEditingListing) return;
   if (!Admin.state.googleIdToken) return;
  if (!Admin.state.globalTargetUser) return;

   const msg = byId('editListingMsg');
   msg.textContent = 'Saving...';

    try {
   await window.ensureOcmCatalogLoaded();

  const listingId = Admin.state.ocmEditingListing.listingId;

  const quantityUnits = assertIntegerQty_(byId('editQty').value, 'Quantity', false);
   const stackSize = assertIntegerQty_(byId('editStack').value, 'Stack size', false);

      let remainingQuantity = byId('editRemainingQty').value;
   if (remainingQuantity !== '') remainingQuantity = assertIntegerQty_(remainingQuantity, 'Remaining quantity', true);

        const listingMode = byId('editListingMode').value;
   const itemName = byId('editItemName').value.trim();
      if (!itemName) throw new Error('Item name required');

   const sourceItemId = byId('editSourceItemId').value.trim();

   const paused = byId('editPause').checked;
   const pricingModeUi = String(byId('editPricingMode').value || 'PEG').toUpperCase();

 // Build payload for admin endpoint
 const payload = {
 idToken: Admin.state.googleIdToken,
 userId: Admin.state.globalTargetUser.userId,
 listingId,
 approveNow: true,
 listingMode,
 itemName,
 sourceItemId,
 quantityUnits,
 stackSize
 };

 if (remainingQuantity !== '') payload.remainingQuantity = remainingQuantity;
 if (paused) payload.status = 'PAUSED';

 if (listingMode === 'FULL') {
 const fixedBTPerUnit = Number(byId('editFixedBTVal').value ||0);
 if (!isFinite(fixedBTPerUnit) || fixedBTPerUnit <=0) throw new Error('Fixed BT per unit must be >0');
 payload.pricingMode = 'FIXED_BT';
 payload.fixedBTPerUnit = fixedBTPerUnit;
 } else {
 if (pricingModeUi === 'FIXED_BT') throw new Error('FIXED_BT is only allowed for FULL listings.');

 const editState = Admin.state.editState;
 if (!window.validatePegSet_(editState.primary, editState.alts, byId('editPegWarn'))) throw new Error('Fix peg inputs');
 const pegPayload = buildPegPayload_(editState.primary, editState.alts);

 payload.pricingMode = 'PEG';
 payload.primaryPeg = pegPayload.primaryPeg;
 payload.altPegs = pegPayload.altPegs;

 // Back-compat fields required by some server versions
 payload.pegItemName = String(pegPayload.primaryPeg?.itemName || '').trim();

 // Prefer computed pegQtyPerInd (from UI conversion), but fall back to legacy server fields when UI row doesn't provide it
 const legacyQty = Number(
 Admin.state.ocmEditingListing?.pricing?.pegQtyPerUnit
 ?? Admin.state.ocmEditingListing?.pricing?.pegQtyPerInd
 ?? Admin.state.ocmEditingListing?.pricing?.primaryPeg?.pegQtyPerInd
 ??0
 );
 payload.pegQtyPerUnit = Number(pegPayload.primaryPeg?.pegQtyPerInd ?? legacyQty);

 payload.pricingBasis = String(
 pegPayload.primaryPeg?.ui?.priceBasis
 ?? Admin.state.ocmEditingListing?.pricing?.pricingBasis
 ?? Admin.state.ocmEditingListing?.pricing?.primaryPeg?.ui?.priceBasis
 ?? 'IND'
 ).toUpperCase();

 if (!payload.pegItemName) throw new Error('Primary peg item is required.');
 if (!isFinite(payload.pegQtyPerUnit) || payload.pegQtyPerUnit <=0) throw new Error('Primary peg quantity must be >0.');
 }

 await window.apiPost('ocmAdminUpdateListingV2', payload);

 msg.textContent = 'Saved.';
 await window.loadAdminTargetListings();
 const updated = (Admin.state.adminTargetListings || []).find(x => x.listingId === listingId);
 if (updated) window.openAdminEditListing_(updated);
 } catch (e) {
 msg.textContent = 'Error: ' + (e?.message || e);
 }
 };

 // ===== Target pending trades =====
 window.loadAdminTargetPendingTrades = async function loadAdminTargetPendingTrades() {
    await window.loadAdminTargetMyPendingTrades_();
    await window.loadAdminTargetIncomingPendingTrades_();
    };

    window.loadAdminTargetMyPendingTrades_ = async function loadAdminTargetMyPendingTrades_() {
   if (!Admin.state.googleIdToken || !Admin.state.globalTargetUser) return;
  byId('msgTargetMyPending').textContent = 'Loading...';
    try {
   const r = await window.apiGet('ocmAdminMyPendingTradesV2', { idToken: Admin.state.googleIdToken, userId: Admin.state.globalTargetUser.userId });
      const d = r.data || r.result || r;
  renderTargetPendingTradesTable_(byId('tbTargetMyPending'), d.trades || [], true);
   byId('msgTargetMyPending').textContent = `Loaded ${(d.trades || []).length}.`;
    } catch (e) {
  byId('tbTargetMyPending').innerHTML = '';
 byId('msgTargetMyPending').textContent = 'Error: ' + e.message;
        }
    };

    window.loadAdminTargetIncomingPendingTrades_ = async function loadAdminTargetIncomingPendingTrades_() {
    if (!Admin.state.googleIdToken || !Admin.state.globalTargetUser) return;
  byId('msgTargetIncomingPending').textContent = 'Loading...';
   try {
       const r = await window.apiGet('ocmAdminIncomingPendingTradesV2', { idToken: Admin.state.googleIdToken, userId: Admin.state.globalTargetUser.userId });
       const d = r.data || r.result || r;
 renderTargetPendingTradesTable_(byId('tbTargetIncomingPending'), d.trades || [], false);
       byId('msgTargetIncomingPending').textContent = `Loaded ${(d.trades || []).length}.`;
  } catch (e) {
       byId('tbTargetIncomingPending').innerHTML = '';
 byId('msgTargetIncomingPending').textContent = 'Error: ' + e.message;
    }
    };

    function renderTargetPendingTradesTable_(tb, arr, mine) {
 tb.innerHTML = '';
 (arr || []).forEach(tr => {
 const snap = safeJsonParse(tr.detailsJson || '{}') || {};
 const item = snap.listing?.itemName || '';
 const counterparty = mine ? (snap.seller?.playerName || '') : (snap.buyer?.playerName || '');
 const payment = snap.payment?.method || '';
 const qty = Number(snap.request?.requestedUnits || tr.quantity ||0);

 const actionable = isActionablePendingTrade_(tr);

 const row = document.createElement('tr');
 row.innerHTML = `
 <td class="mono">${esc(tr.tradeId)}</td>
 <td>${esc(item)}</td>
 <td>${esc(counterparty)}</td>
 <td class="mono">${esc(qty)}</td>
 <td class="mono">${esc(payment)}</td>
 <td>
 ${actionable ? '<button type="button" data-more="1">More info</button> ' : ''}
 ${mine
 ? '<span class="small">Read-only in admin UI</span>'
 : (actionable
 ? '<button type="button" data-accept="1">Accept (Admin10%)</button> <button type="button" data-deny="1">Deny</button>'
 : '<span class="small">Not actionable</span>')}
 </td>
 `;

 if (actionable) {
 row.querySelector('button[data-more]')?.addEventListener('click', () => {
 const tmi = window.TradeMoreInfo;
 if (!tmi || typeof tmi.toggleDetailsRow !== 'function') {
 const marker = window.__TradeMoreInfoLoaded ? 'script executed but window.TradeMoreInfo missing' : 'script likely not loaded';
 alert('TradeMoreInfo helper is not loaded (' + marker + '). Check Network tab for shared/trade-more-info.js and Console for errors.');
 return;
 }

 const buyerLabel = labelFromUserId_(tr.buyerUserId);
 const sellerLabel = labelFromUserId_(tr.sellerUserId);
 tmi.toggleDetailsRow(row, snap || {}, buyerLabel, sellerLabel,6);
 });
 }

 if (!mine && actionable) {
 row.querySelector('button[data-accept]')?.addEventListener('click', async () => {
 if (!confirm(`Accept trade ${tr.tradeId} as admin? (10% fee)`)) return;
 try { await window.apiPost('ocmAcceptTradeAsAdminV2', { idToken: Admin.state.googleIdToken, tradeId: tr.tradeId }); await window.loadAdminTargetPendingTrades(); }
 catch (e) { alert(e.message); }
 });

 row.querySelector('button[data-deny]')?.addEventListener('click', async () => {
 if (!confirm(`Deny trade ${tr.tradeId}?`)) return;
 try { await window.apiPost('ocmDenyTradeV2', { idToken: Admin.state.googleIdToken, tradeId: tr.tradeId }); await window.loadAdminTargetPendingTrades(); }
 catch (e) { alert(e.message); }
 });
 }

 tb.appendChild(row);
 });
 }
    // Helper: visual status pill used in listing rows
    function statusPill(statusRaw) {
        const s = String(statusRaw || '').toUpperCase();
        if (s === 'ACTIVE') return '<span class="pill pill-active">ACTIVE</span>';
        if (s === 'PENDING_REVIEW') return '<span class="pill pill-pending">PENDING_REVIEW</span>';
        if (s === 'PAUSED') return '<span class="pill pill-paused">PAUSED</span>';
        if (s === 'REJECTED') return '<span class="pill pill-rejected">REJECTED</span>';
        if (s === 'DELETED') return '<span class="pill">DELETED</span>';
        return `<span class="pill">${esc(s || '—')}</span>`;
    }

    // Helper: short pricing summary shown in listing rows
    function pricingLabel(l) {
        const p = l.pricing || {};
        if (p.mode === 'FIXED_BT') return `FIXED ${fmt2(p.fixedBTPerUnit)} BT/unit`;

        const prim = p.primaryPeg || (p.pegItemName ? {
            itemName: p.pegItemName,
            pegQtyPerInd: p.pegQtyPerUnit,
            ui: { priceBasis: p.pricingBasis || 'IND' }
        } : null);

        if (!prim || !prim.itemName) return '—';

        const alts = Array.isArray(p.altPegs) ? p.altPegs : [];
        const altCount = alts.length;
        const basis = String(prim.ui?.priceBasis || p.pricingBasis || 'IND').toUpperCase();
        const basisLabel = (basis === 'STACK') ? 'STACK' : 'IND';
        return `${fmt2(Number(prim.pegQtyPerInd || 0))} ${esc(prim.itemName)} (${basisLabel}${altCount ? ` +${altCount} alts` : ''})`;
    }

    // Full renderListingRow_ used by the listing editor tables.
    // Place this function in `admin_js/admin-ocm.js` above `renderAdminTargetListings_` or
    // anywhere before it's referenced.
    function renderListingRow_(tb, l) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
<td class="mono">${esc(l.listingId)}</td>
<td>${esc(l.itemName || '')}</td>
<td>${statusPill(l.statusRaw || l.status)}</td>
<td class="mono">${(l.qtyAvailable == null ? '' : esc(l.qtyAvailable))}</td>
<td class="mono">${esc(Number(l.stackSize || 1) || 1)}</td>
<td class="mono">${esc(pricingLabel(l))}</td>
<td>
    <button type="button" data-edit="1">Edit</button>
    <button type="button" data-restock="1">Restock</button>
</td>
`.trim();

        // Wire Edit -> opens edit dialog (if available)
        const editBtn = tr.querySelector('button[data-edit]');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                if (typeof window.openAdminEditListing_ === 'function') {
                    window.openAdminEditListing_(l);
                } else {
                    console.warn('openAdminEditListing_ is not available');
                }
            });
        }

        // Wire Restock -> opens restock dialog (if available)
        const restockBtn = tr.querySelector('button[data-restock]');
        if (restockBtn) {
            restockBtn.addEventListener('click', () => {
                if (typeof window.openAdminRestock_ === 'function') {
                    window.openAdminRestock_(l);
                } else {
                    console.warn('openAdminRestock_ is not available');
                }
            });
        }

        tb.appendChild(tr);
    }
 // expose for boot wiring
 Admin._syncEditPricingModeUI_ = syncEditPricingModeUI_;

 function renderAdminTargetListings_() {
 // Scope to OCM admin section to avoid collisions with same IDs in other tabs/pages
 const root = byId('ocmAdminSection') || document;
 const sellTb = root.querySelector('#tbSellListings');
 const buyTb = root.querySelector('#tbBuyListings');
 const otherTb = root.querySelector('#tbOtherListings');
 if (!sellTb || !buyTb || !otherTb) return;

 sellTb.innerHTML = '';
 buyTb.innerHTML = '';
 otherTb.innerHTML = '';

 (Admin.state.adminTargetListings || []).forEach(l => {
 const status = String(l.statusRaw || l.status || '').toUpperCase();
 if (status === 'ACTIVE' || status === 'PAUSED') {
 if (l.type === 'SELL') return renderListingRow_(sellTb, l);
 return renderListingRow_(buyTb, l);
 }

 const tr = document.createElement('tr');
 const notes = [];
 if (l.isInvalidQty) notes.push('INVALID QTY');
 if (status === 'REJECTED') notes.push('Admin save will activate immediately');
 tr.innerHTML = `
 <td class="mono">${esc(l.listingId)}</td>
 <td>${esc(l.itemName || '')}</td>
 <td>${esc(l.type || '')}</td>
 <td>${statusPill(status)}</td>
 <td class="mono">${esc(l.updatedAt || '')}</td>
 <td class="mono">${esc(l.approvedBy || '')}</td>
 <td class="small">${esc(notes.join(' | '))}</td>`;
 otherTb.appendChild(tr);
 });
 }

 window.loadAdminTargetListings = async function loadAdminTargetListings() {
 if (!Admin.state.googleIdToken) return;
 if (!Admin.state.globalTargetUser) return;

 const root = byId('ocmAdminSection') || document;
 const msgEl = root.querySelector('#msgTargetListings') || byId('msgTargetListings');
 if (msgEl) msgEl.textContent = 'Loading...';

 try {
 const r = await window.apiGet('ocmAdminListUserListingsV2', { idToken: Admin.state.googleIdToken, userId: Admin.state.globalTargetUser.userId });
 const d = r.data || r.result || r;
 Admin.state.adminTargetListings = d.listings || [];
 renderAdminTargetListings_();
 if (msgEl) msgEl.textContent = `Loaded ${Admin.state.adminTargetListings.length} listings.`;
 } catch (e) {
 Admin.state.adminTargetListings = [];
 renderAdminTargetListings_();
 if (msgEl) msgEl.textContent = 'Error: ' + (e?.message || e);
 }
 };

 // Enable/disable OCM Admin tools based on selected target user
 window.updateOcmActingUI = function updateOcmActingUI() {
 const banner = byId('ocmActingBanner');
 const noTarget = byId('ocmActingNoTarget');
 const content = byId('ocmActingContent');
 if (!banner || !noTarget || !content) return;

 const hasTarget = !!Admin.state.globalTargetUser;

 if (!hasTarget) {
 banner.style.display = 'none';
 noTarget.style.display = 'block';
 content.classList.add('disabled');
 return;
 }

 // Prefer the same mailbox resolver path used in the old working version
 const uid = Admin.state.globalTargetUser.userId;
 let name = Admin.state.globalTargetUser.playerName || Admin.state.globalTargetUser.email || String(uid || '');
 let mailbox = Admin.state.globalTargetUser.mailbox || 'N/A';
 try {
 if (typeof window.resolveNameMailbox_ === 'function') {
 const r = window.resolveNameMailbox_(uid) || {};
 name = r.name || name;
 mailbox = r.mailbox || mailbox;
 }
 } catch { /* ignore */ }

 banner.style.display = 'block';
 banner.innerHTML = `<div><strong>Acting as:</strong> ${esc(name)} <span class="small">(mailbox ${esc(mailbox)})</span></div>`;
 noTarget.style.display = 'none';
 content.classList.remove('disabled');
};

 // ===== Create peg UI helpers (ensure globals exist) =====
 // These must be inside this module scope so they can see `byId`.
 window.addAltPeg_ = function addAltPeg_(mode) {
 const createState = Admin.state.createState;
 const st = createState?.[mode];
 const warn = byId(mode === 'store' ? 'createStorePegWarn' : 'createHalfPegWarn');
 const box = byId(mode === 'store' ? 'createStorePegBox' : 'createHalfPegBox');

 if (!st || !warn || !box) return;
 if (st.alts.length >=10) { warn.textContent = 'Max10 alternative pegs.'; return; }

 const idx = st.alts.length +1;
 const row = window.makePegRowDom_({
 title: `Alternative peg #${idx}`,
 canRemove: true,
 defaultRow: { itemName: '', ui: { priceBasis: 'IND', pegQtyBasis: 'IND', pegQtyInput:1 } },
 getSoldName: mode === 'store'
 ? () => byId('createItemStore').value.trim() || 'ITEM'
 : () => byId('createItemHalf').value.trim() || 'ITEM',
 getSoldStackSize: mode === 'store'
 ? () => {
 const it = findCatalogItem(byId('createItemStore').value.trim());
 return Number(it?.bundleSize ||1) ||1;
 }
 : () => Number(byId('createStackHalf').value ||1) ||1,
 getListingType: mode === 'store'
 ? () => byId('createTypeStore')?.value || 'SELL'
 : () => byId('createTypeHalf')?.value || 'SELL',
 onRemove: () => {
 const i = st.alts.indexOf(row);
 if (i >=0) st.alts.splice(i,1);
 row.remove();
 window.validatePegSet_(st.primary, st.alts, warn);
 },
 onChange: () => window.validatePegSet_(st.primary, st.alts, warn)
 });

 st.alts.push(row);
 box.appendChild(row);
 window.validatePegSet_(st.primary, st.alts, warn);
 };

 // ===== Restock dialog (Admin OCM) =====
 window.openAdminRestock_ = function openAdminRestock_(l) {
 Admin.state.ocmRestockingListing = l;
 byId('restockListingId').textContent = l.listingId;
 const current = (l.remainingQuantity == null || l.remainingQuantity === '') ? (l.qtyAvailable ??0) : l.remainingQuantity;
 byId('restockQtyInput').value = String(Math.max(0, Math.round(Number(current ||0) ||0)));
 byId('restockQtyMode').value = 'IND';
 byId('restockMsg').textContent = '';
 byId('dlgRestock')?.showModal();
 };

 window.sendAdminRestock_ = async function sendAdminRestock_() {
 if (!Admin.state.ocmRestockingListing) return;
 if (!Admin.state.googleIdToken) return;
 if (!Admin.state.globalTargetUser) return;

 const msg = byId('restockMsg');
 msg.textContent = 'Saving...';

 try {
 const listingId = Admin.state.ocmRestockingListing.listingId;
 const qtyIn = assertIntegerQty_(byId('restockQtyInput').value, 'New stock value', true);
 const mode = byId('restockQtyMode').value;
 const ss = Number(Admin.state.ocmRestockingListing.stackSize ||1) ||1;
 const remainingQuantity = computeQtyUnitsFromInput(qtyIn, mode, ss);

 await window.apiPost('ocmAdminUpdateListingV2', {
 idToken: Admin.state.googleIdToken,
 userId: Admin.state.globalTargetUser.userId,
 listingId,
 approveNow: true,
 remainingQuantity,
 quantityUnits: remainingQuantity
 });

 msg.textContent = 'Restocked and activated.';
 await window.loadAdminTargetListings();
 setTimeout(() => byId('dlgRestock')?.close(),350);
 } catch (e) {
 msg.textContent = 'Error: ' + (e?.message || e);
 }
 };

 // ===== Create tab switching (admin) =====
 // Admin.html uses inline onclick="setAdminCreateTab('store'|'half'|'full')".
 // If this function is missing, the create UI feels "dead" (no console error because inline handler resolves late).
 window.setAdminCreateTab = function setAdminCreateTab(which) {
 const map = {
 store: { tab: 'tabCreateStore', panel: 'panelCreateStore' },
 half: { tab: 'tabCreateHalf', panel: 'panelCreateHalf' },
 full: { tab: 'tabCreateFull', panel: 'panelCreateFull' }
 };
 Object.keys(map).forEach(k => {
 const p = byId(map[k].panel);
 const t = byId(map[k].tab);
 if (p) p.style.display = (k === which) ? 'block' : 'none';
 if (t) t.setAttribute('aria-selected', (k === which) ? 'true' : 'false');
 });
 };

 // ===== Create listings (Admin -> on behalf of target user) =====
 // These are wired from `admin_js/admin-boot.js` to the Create buttons.

 function extractListingId_(resp) {
 const d = resp?.data || resp?.result || resp;
 return d?.listingId || d?.id || d?.listing?.listingId || null;
 }

 window.adminCreateListingStore = async function adminCreateListingStore() {
 if (!Admin.state.googleIdToken) return;
 if (!Admin.state.globalTargetUser) {
 const m = byId('createMsgStore');
 if (m) m.textContent = 'Select a target user first.';
 return;
 }

 const msg = byId('createMsgStore');
 if (msg) msg.textContent = 'Creating...';

 try {
 await window.ensureOcmCatalogLoaded();

 const type = byId('createTypeStore')?.value || 'SELL';
 const listingMode = 'STORE';

 const itemName = String(byId('createItemStore')?.value || '').trim();
 const item = findCatalogItem(itemName);
 if (!item) throw new Error('Store item not found in catalog');

 const stackSize = Number(item.bundleSize ||1) ||1;

 const qtyIn = Number(byId('createQtyUnitsStore')?.value ||0);
 const qtyMode = byId('createQtyModeStore')?.value || 'IND';
 const quantityUnits = computeQtyUnitsFromInput(qtyIn, qtyMode, stackSize);
 assertIntegerQty_(quantityUnits, 'Quantity', false);

 const createState = Admin.state.createState;
 if (!window.validatePegSet_(createState.store.primary, createState.store.alts, byId('createStorePegWarn'))) {
 throw new Error('Fix peg inputs');
 }
 const pegPayload = buildPegPayload_(createState.store.primary, createState.store.alts);

 const r = await window.apiPost('ocmAdminCreateListingV2', {
 idToken: Admin.state.googleIdToken,
 userId: Admin.state.globalTargetUser.userId,
 listingMode,
 type,
 itemName,
 sourceItemId: 'sheet:' + item.name,
 stackSize,
 quantityUnits,
 pricingMode: 'PEG',
 primaryPeg: pegPayload.primaryPeg,
 altPegs: pegPayload.altPegs,
 // This is the key requirement: create and approve immediately (bypass review-queue).
 approveNow: true
 });

 const listingId = extractListingId_(r);
 if (!listingId) throw new Error('No listingId returned from server.');

 if (msg) msg.textContent = 'Created. ListingId: ' + listingId;
 await window.loadAdminTargetListings();
 } catch (e) {
 if (msg) msg.textContent = 'Error: ' + (e?.message || e);
 }
 };

 window.adminCreateListingHalf = async function adminCreateListingHalf() {
 if (!Admin.state.googleIdToken) return;
 if (!Admin.state.globalTargetUser) {
 const m = byId('createMsgHalf');
 if (m) m.textContent = 'Select a target user first.';
 return;
 }

 const msg = byId('createMsgHalf');
 if (msg) msg.textContent = 'Creating...';

 try {
 await window.ensureOcmCatalogLoaded();

 const type = byId('createTypeHalf')?.value || 'SELL';
 const listingMode = 'HALF';

 const itemName = String(byId('createItemHalf')?.value || '').trim();
 if (!itemName) throw new Error('Item name required');

 const stackSize = assertIntegerQty_(byId('createStackHalf')?.value, 'Stack size', false);

 const qtyIn = Number(byId('createQtyUnitsHalf')?.value ||0);
 const qtyMode = byId('createQtyModeHalf')?.value || 'IND';
 const quantityUnits = computeQtyUnitsFromInput(qtyIn, qtyMode, stackSize);
 assertIntegerQty_(quantityUnits, 'Quantity', false);

 const createState = Admin.state.createState;
 if (!window.validatePegSet_(createState.half.primary, createState.half.alts, byId('createHalfPegWarn'))) {
 throw new Error('Fix peg inputs');
 }
 const pegPayload = buildPegPayload_(createState.half.primary, createState.half.alts);

 const r = await window.apiPost('ocmAdminCreateListingV2', {
 idToken: Admin.state.googleIdToken,
 userId: Admin.state.globalTargetUser.userId,
 listingMode,
 type,
 itemName,
 sourceItemId: '',
 stackSize,
 quantityUnits,
 pricingMode: 'PEG',
 primaryPeg: pegPayload.primaryPeg,
 altPegs: pegPayload.altPegs,
 approveNow: true
 });

 const listingId = extractListingId_(r);
 if (!listingId) throw new Error('No listingId returned from server.');

 if (msg) msg.textContent = 'Created. ListingId: ' + listingId;
 await window.loadAdminTargetListings();
 } catch (e) {
 if (msg) msg.textContent = 'Error: ' + (e?.message || e);
 }
 };

 window.adminCreateListingFull = async function adminCreateListingFull() {
 if (!Admin.state.googleIdToken) return;
 if (!Admin.state.globalTargetUser) {
 const m = byId('createMsgFull');
 if (m) m.textContent = 'Select a target user first.';
 return;
 }

 const msg = byId('createMsgFull');
 if (msg) msg.textContent = 'Creating...';

 try {
 const type = byId('createTypeFull')?.value || 'SELL';
 const listingMode = 'FULL';

 const itemName = String(byId('createItemFull')?.value || '').trim();
 if (!itemName) throw new Error('Item name required');

 const stackSize = assertIntegerQty_(byId('createStackFull')?.value, 'Stack size', false);
 const quantityUnits = assertIntegerQty_(byId('createQtyUnitsFull')?.value, 'Quantity', false);

 const fixedBTPerUnit = Number(byId('createFixedBT')?.value ||0);
 if (!isFinite(fixedBTPerUnit) || fixedBTPerUnit <=0) throw new Error('Fixed BT per unit must be >0');

 const r = await window.apiPost('ocmAdminCreateListingV2', {
 idToken: Admin.state.googleIdToken,
 userId: Admin.state.globalTargetUser.userId,
 listingMode,
 type,
 itemName,
 sourceItemId: '',
 stackSize,
 quantityUnits,
 pricingMode: 'FIXED_BT',
 fixedBTPerUnit,
 approveNow: true
 });

 const listingId = extractListingId_(r);
 if (!listingId) throw new Error('No listingId returned from server.');

 if (msg) msg.textContent = 'Created. ListingId: ' + listingId;
 await window.loadAdminTargetListings();
 } catch (e) {
 if (msg) msg.textContent = 'Error: ' + (e?.message || e);
 }
 };

})();
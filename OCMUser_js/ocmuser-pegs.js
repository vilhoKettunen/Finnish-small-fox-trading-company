// PEG UI components for OCMUser (creator + editor)
(function () {
 'use strict';

 const O = window.OCMUser;
 const S = O.state;
 const byId = O.byId;
 const esc = O.esc;
 const fmt2 = O.fmt2;

 function makePegRowDom_(cfg) {
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
 priceInfo.className = 'small muted';
 priceInfo.textContent = '—';
 itemWrap.appendChild(priceInfo);
 grid.appendChild(itemWrap);

 const priceBasis = document.createElement('select');
 priceBasis.innerHTML = `<option value="IND">IND</option><option value="STACK">STACK</option>`;
 priceBasis.value = String(row.ui?.priceBasis || 'IND').toUpperCase();
 const pbWrap = document.createElement('div');
 pbWrap.innerHTML = `<div class="small">Price basis (sold item)</div>`;
 pbWrap.appendChild(priceBasis);
 grid.appendChild(pbWrap);

 const qtyInput = document.createElement('input');
 qtyInput.type = 'number';
 qtyInput.min = '1';
 qtyInput.step = '1';
 qtyInput.value = String(Math.max(1, Math.round(Number(row.ui?.pegQtyInput ||1) ||1)));

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
 qtyWrap.appendChild(document.createElement('div')).className = 'small muted';
 qtyWrap.lastChild.textContent = 'Integer only.';
 grid.appendChild(qtyWrap);

 const statement = document.createElement('div');
 statement.className = 'small';
 statement.style.marginTop = '6px';
 statement.textContent = '—';

 wrap.appendChild(head);
 wrap.appendChild(grid);
 wrap.appendChild(statement);

 function updatePriceInfo_() {
 const it = O.findCatalogItem(input.value);
 if (!it) { priceInfo.textContent = '—'; return; }
 const bs = Number(it.bundleSize ||1) ||1;
 const parts = [];
 if (it.buyEach != null) parts.push(`buyEach:${fmt2(O.parseMaybeScaledBt_(it.buyEach))}`);
 if (it.sellEach != null) parts.push(`sellEach:${fmt2(O.parseMaybeScaledBt_(it.sellEach))}`);
 if (it.buyStack != null) parts.push(`buyStack:${fmt2(O.parseMaybeScaledBt_(it.buyStack))}`);
 if (it.sellStack != null) parts.push(`sellStack:${fmt2(O.parseMaybeScaledBt_(it.sellStack))}`);
 priceInfo.textContent = `${parts.join(', ')} (bs:${bs})`;
 }

 function updateStatement_() {
 const soldName = cfg.getSoldName ? cfg.getSoldName() : 'ITEM';
 const soldSS = Number(cfg.getSoldStackSize ? cfg.getSoldStackSize() :1) ||1;
 const pb = String(priceBasis.value || 'IND').toUpperCase();
 const pegName = input.value || 'PEG';
 const q = Math.max(1, Math.round(Number(qtyInput.value ||1) ||1));
 const qb = String(qtyBasis.value || 'IND').toUpperCase();
 const pegBS = O.bundleSizeOfName(pegName);
 const pegQtyInd = (qb === 'STACK') ? (q * pegBS) : q;

 // Equation quantities
 const leftQtyInd = (pb === 'STACK') ? soldSS :1;
 const rightQtyInd = pegQtyInd;

 // Base equation line
 const eqLine = (pb === 'STACK')
 ? `${leftQtyInd} x ${soldName} = ${rightQtyInd} x ${pegName}`
 : `1 x ${soldName} = ${rightQtyInd} x ${pegName}`;

 // Value lines: show BUY then SELL, both sides.
 function perIndPrice(name, side) {
 const it = O.findCatalogItem(name);
 if (!it) return null;
 const v = (side === 'BUY') ? it.buyEach : it.sellEach;
 const n = O.parseMaybeScaledBt_ ? O.parseMaybeScaledBt_(v) : (v == null ? null : Number(v));
 if (n != null) return n;
 // fallback to stack price / bundle
 const st = (side === 'BUY') ? it.buyStack : it.sellStack;
 const sn = O.parseMaybeScaledBt_ ? O.parseMaybeScaledBt_(st) : (st == null ? null : Number(st));
 const bs = Number(it.bundleSize ||1) ||1;
 if (sn != null) return sn / bs;
 return null;
 }

 const soldBuy = perIndPrice(soldName, 'BUY');
 const soldSell = perIndPrice(soldName, 'SELL');
 const pegBuy = perIndPrice(pegName, 'BUY');
 const pegSell = perIndPrice(pegName, 'SELL');

 function valueLine(label, leftPerInd, rightPerInd) {
 if (leftPerInd == null || rightPerInd == null) return `${label}: — (missing catalog price)`;
 const leftBt = leftQtyInd * leftPerInd;
 const rightBt = rightQtyInd * rightPerInd;
 return `${label}: ${fmt2(leftBt)} BT (sold) | ${fmt2(rightBt)} BT (peg)`;
 }

 const buyLine = valueLine('BUY', soldBuy, pegBuy);
 const sellLine = valueLine('SELL', soldSell, pegSell);

 // Render3-line statement
 statement.innerHTML = `${esc(eqLine)}<br><span class="muted">${esc(buyLine)}</span><br><span class="muted">${esc(sellLine)}</span>`;
 }

 O.attachStoreDropdown(input, list, (it) => {
 input.value = it.name;
 updatePriceInfo_();
 updateStatement_();
 cfg.onChange && cfg.onChange();
 });

 input.addEventListener('input', () => { updatePriceInfo_(); updateStatement_(); cfg.onChange && cfg.onChange(); });
 priceBasis.addEventListener('change', () => { updateStatement_(); cfg.onChange && cfg.onChange(); });
 qtyInput.addEventListener('input', () => { updateStatement_(); cfg.onChange && cfg.onChange(); });
 qtyBasis.addEventListener('change', () => { updateStatement_(); cfg.onChange && cfg.onChange(); });

 updatePriceInfo_();
 updateStatement_();

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
 }

 function validatePegSet_(primaryRow, altRows, warnEl) {
 warnEl.textContent = '';

 const allNames = [];
 const p = primaryRow.getValue();
 if (!p.itemName) { warnEl.textContent = 'Primary peg item is required.'; return false; }
 if (!O.findCatalogItem(p.itemName)) { warnEl.textContent = 'Primary peg item not found in catalog.'; return false; }
 allNames.push(p.itemName.toLowerCase());

 for (let i=0;i<altRows.length;i++) {
 const a = altRows[i].getValue();
 if (!a.itemName) continue;
 if (!O.findCatalogItem(a.itemName)) { warnEl.textContent = `Alt peg "${a.itemName}" not found in catalog.`; return false; }
 const key = a.itemName.toLowerCase();
 if (allNames.includes(key)) { warnEl.textContent = 'Duplicate peg items are not allowed.'; return false; }
 allNames.push(key);
 }

 if (altRows.length >10) { warnEl.textContent = 'Too many alternative pegs (max10).'; return false; }
 return true;
 }

 function buildPegPayload_(primaryRow, altRows) {
 const primary = primaryRow.getValue();
 const alts = altRows.map(r => r.getValue()).filter(p => p.itemName);
 return { primaryPeg: primary, altPegs: alts };
 }

 function initCreatorPegUIs_() {
 // STORE
 const storeBox = byId('createStorePegBox');
 storeBox.innerHTML = '';
 S.createState.store.alts = [];

 S.createState.store.primary = makePegRowDom_({
 title: 'Primary peg (required)',
 canRemove: false,
 defaultRow: { itemName: '', ui: { priceBasis: 'IND', pegQtyBasis: 'IND', pegQtyInput:1 } },
 getSoldName: () => byId('createItemStore').value.trim() || 'ITEM',
 getSoldStackSize: () => {
 const it = O.findCatalogItem(byId('createItemStore').value.trim());
 return Number(it?.bundleSize ||1) ||1;
 },
 onChange: () => validatePegSet_(S.createState.store.primary, S.createState.store.alts, byId('createStorePegWarn'))
 });
 storeBox.appendChild(S.createState.store.primary);

 // HALF
 const halfBox = byId('createHalfPegBox');
 halfBox.innerHTML = '';
 S.createState.half.alts = [];

 S.createState.half.primary = makePegRowDom_({
 title: 'Primary peg (required)',
 canRemove: false,
 defaultRow: { itemName: '', ui: { priceBasis: 'IND', pegQtyBasis: 'IND', pegQtyInput:1 } },
 getSoldName: () => byId('createItemHalf').value.trim() || 'ITEM',
 getSoldStackSize: () => Number(byId('createStackHalf').value ||1) ||1,
 onChange: () => validatePegSet_(S.createState.half.primary, S.createState.half.alts, byId('createHalfPegWarn'))
 });
 halfBox.appendChild(S.createState.half.primary);
 }

 function addAltPeg_(mode) {
 const st = S.createState[mode];
 const warn = byId(mode === 'store' ? 'createStorePegWarn' : 'createHalfPegWarn');
 const box = byId(mode === 'store' ? 'createStorePegBox' : 'createHalfPegBox');

 if (st.alts.length >=10) { warn.textContent = 'Max10 alternative pegs.'; return; }

 const idx = st.alts.length +1;
 const row = makePegRowDom_({
 title: `Alternative peg #${idx}`,
 canRemove: true,
 onRemove: () => {
 const i = st.alts.indexOf(row);
 if (i >=0) st.alts.splice(i,1);
 row.remove();
 validatePegSet_(st.primary, st.alts, warn);
 },
 defaultRow: { itemName: '', ui: { priceBasis: 'IND', pegQtyBasis: 'IND', pegQtyInput:1 } },
 getSoldName: mode === 'store'
 ? () => byId('createItemStore').value.trim() || 'ITEM'
 : () => byId('createItemHalf').value.trim() || 'ITEM',
 getSoldStackSize: mode === 'store'
 ? () => {
 const it = O.findCatalogItem(byId('createItemStore').value.trim());
 return Number(it?.bundleSize ||1) ||1;
 }
 : () => Number(byId('createStackHalf').value ||1) ||1,
 onChange: () => validatePegSet_(st.primary, st.alts, warn)
 });

 st.alts.push(row);
 box.appendChild(row);
 validatePegSet_(st.primary, st.alts, warn);
 }

 // exports
 O.makePegRowDom_ = makePegRowDom_;
 O.validatePegSet_ = validatePegSet_;
 O.buildPegPayload_ = buildPegPayload_;
 O.initCreatorPegUIs_ = initCreatorPegUIs_;
 O.addAltPeg_ = addAltPeg_;
})();

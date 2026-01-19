// Cart operations: quick calcs, adders, row coloring and renderers
(function(){
 'use strict';

 window.quickStackCalc = window.quickStackCalc || function quickStackCalc() {
 const name = document.getElementById('quickStackSelect').value;
 const qty = parseInt(document.getElementById('quickStackQty').value) ||0;
 const item = (window.items || []).find(i => i.name === name); if (!item) return;
 const buyText = item.buyStack ? `${qty} × ${item.bundleSize} ${item.name} buys for ${(qty * item.buyStack).toFixed(2)} BT` : '';
 const sellText = item.sellStack ? `${qty} × ${item.bundleSize} ${item.name} sells for ${(qty * item.sellStack).toFixed(2)} BT` : '';
 document.getElementById('quickStackResult').textContent = [buyText, sellText].filter(Boolean).join(' | ');
 };

 window.quickIndivCalc = window.quickIndivCalc || function quickIndivCalc() {
 const name = document.getElementById('quickIndivSelect').value;
 const qty = parseInt(document.getElementById('quickIndivQty').value) ||0;
 const item = (window.items || []).find(i => i.name === name); if (!item) return;
 const buyText = item.buyEach ? `${qty} × ${item.name} buys for ${(qty * item.buyEach).toFixed(2)} BT` : '';
 const sellText = item.sellEach ? `${qty} × ${item.name} sells for ${(qty * item.sellEach).toFixed(2)} BT` : '';
 document.getElementById('quickIndivResult').textContent = [buyText, sellText].filter(Boolean).join(' | ');
 };

 /* ===== Buy cart adders ===== */
 window.addStack = window.addStack || function addStack() {
 const name = document.getElementById('stackSelect').value;
 const qty = parseInt(document.getElementById('stackQty').value) ||0;
 const item = (window.items || []).find(i => i.name === name); if (!item || !item.sellStack) return;
 window.buyCart.push({ name: item.name, qty, price: item.sellStack, bundleSize: item.bundleSize, source: 'STORE' });
 window.renderBuyList && window.renderBuyList();
 };

 window.addIndividual = window.addIndividual || function addIndividual() {
 const name = document.getElementById('indivSelect').value;
 const qty = parseInt(document.getElementById('indivQty').value) ||0;
 const item = (window.items || []).find(i => i.name === name); if (!item || !item.sellEach) return;
 window.buyCart.push({ name: item.name, qty, price: item.sellEach, source: 'STORE' });
 window.renderBuyList && window.renderBuyList();
 };

 window.addBuyAccountBalance = window.addBuyAccountBalance || function addBuyAccountBalance() {
 const balance = parseFloat(document.getElementById('buyAccountBalanceInput').value) ||0;
 if (balance <=0) return;
 window.buyCart.push({ name: 'Account Balance', qty:1, price: balance, isBalance: true, source: 'BALANCE' });
 window.renderBuyList && window.renderBuyList();
 };

 window.addCustomBuyStack = window.addCustomBuyStack || function addCustomBuyStack() {
 const name = document.getElementById('customBuyStackSelect').value;
 const qty = parseInt(document.getElementById('customBuyStackQty').value) ||0;
 const price = parseFloat(document.getElementById('customBuyStackPrice').value) ||0;
 const item = (window.items || []).find(i => i.name === name);
 if (!item || qty <=0 || price <=0) return;
 window.buyCart.push({ name: item.name, qty, price, bundleSize: item.bundleSize, isCustom: true, source: 'STORE' });
 window.renderBuyList && window.renderBuyList();
 };

 window.addCustomBuyIndividual = window.addCustomBuyIndividual || function addCustomBuyIndividual() {
 const name = document.getElementById('customBuyIndivSelect').value;
 const qty = parseInt(document.getElementById('customBuyIndivQty').value) ||0;
 const price = parseFloat(document.getElementById('customBuyIndivPrice').value) ||0;
 const item = (window.items || []).find(i => i.name === name);
 if (!item || qty <=0 || price <=0) return;
 window.buyCart.push({ name: item.name, qty, price, isCustom: true, source: 'STORE' });
 window.renderBuyList && window.renderBuyList();
 };

 window.addFullyCustomBuy = window.addFullyCustomBuy || function addFullyCustomBuy() {
 const name = document.getElementById('customBuyName').value.trim();
 const qty = parseInt(document.getElementById('customBuyQty').value) ||0;
 const stackSize = parseInt(document.getElementById('customBuyStackSize').value) ||1;
 const price = parseFloat(document.getElementById('customBuyPrice').value) ||0;
 if (!name || qty <=0 || price <=0 || stackSize <=0) return;
 window.buyCart.push({ name, qty, bundleSize: stackSize, price, isFullyCustom: true, source: 'CUSTOM' });
 window.renderBuyList && window.renderBuyList();
 };

 /* ===== Sell cart adders ===== */
 window.addSellStack = window.addSellStack || function addSellStack() {
 const name = document.getElementById('sellStackSelect').value;
 const qty = parseInt(document.getElementById('sellStackQty').value) ||0;
 const item = (window.items || []).find(i => i.name === name); if (!item || !item.buyStack) return;
 window.sellCart.push({ name: item.name, qty, price: item.buyStack, bundleSize: item.bundleSize, source: 'STORE' });
 window.renderSellList && window.renderSellList();
 };

 window.addSellIndividual = window.addSellIndividual || function addSellIndividual() {
 const name = document.getElementById('sellIndivSelect').value;
 const qty = parseInt(document.getElementById('sellIndivQty').value) ||0;
 const item = (window.items || []).find(i => i.name === name); if (!item || !item.buyEach) return;
 window.sellCart.push({ name: item.name, qty, price: item.buyEach, source: 'STORE' });
 window.renderSellList && window.renderSellList();
 };

 window.addAccountBalance = window.addAccountBalance || function addAccountBalance() {
 const balance = parseFloat(document.getElementById('accountBalanceInput').value) ||0;
 if (balance <=0) return;
 window.sellCart.push({ name: 'Account Balance', qty:1, price: balance, isBalance: true, source: 'BALANCE' });
 window.renderSellList && window.renderSellList();
 };

 window.addCustomSellStack = window.addCustomSellStack || function addCustomSellStack() {
 const name = document.getElementById('customSellStackSelect').value;
 const qty = parseInt(document.getElementById('customSellStackQty').value) ||0;
 const price = parseFloat(document.getElementById('customSellStackPrice').value) ||0;
 const item = (window.items || []).find(i => i.name === name);
 if (!item || qty <=0 || price <=0) return;
 window.sellCart.push({ name: item.name, qty, price, bundleSize: item.bundleSize, isCustom: true, source: 'STORE' });
 window.renderSellList && window.renderSellList();
 };

 window.addCustomSellIndividual = window.addCustomSellIndividual || function addCustomSellIndividual() {
 const name = document.getElementById('customSellIndivSelect').value;
 const qty = parseInt(document.getElementById('customSellIndivQty').value) ||0;
 const price = parseFloat(document.getElementById('customSellIndivPrice').value) ||0;
 const item = (window.items || []).find(i => i.name === name);
 if (!item || qty <=0 || price <=0) return;
 window.sellCart.push({ name: item.name, qty, price, isCustom: true, source: 'STORE' });
 window.renderSellList && window.renderSellList();
 };

 window.addFullyCustomSell = window.addFullyCustomSell || function addFullyCustomSell() {
 const name = document.getElementById('customSellName').value.trim();
 const qty = parseInt(document.getElementById('customSellQty').value) ||0;
 const stackSize = parseInt(document.getElementById('customSellStackSize').value) ||1;
 const price = parseFloat(document.getElementById('customSellPrice').value) ||0;
 if (!name || qty <=0 || price <=0 || stackSize <=0) return;
 window.sellCart.push({ name, qty, bundleSize: stackSize, price, isFullyCustom: true, source: 'CUSTOM' });
 window.renderSellList && window.renderSellList();
 };

 /* ===== Row coloring ===== */
 window.evaluateRowColorBuy = window.evaluateRowColorBuy || function evaluateRowColorBuy(entry) {
 const item = (window.items || []).find(i => i.name === entry.name);
 const prog = (window.stockProgressCache || []).find(sp => sp.name === entry.name);
 if (!item && !prog) return null;
 if (entry.source === 'OCM') return null;
 const bundleSize = item ? (item.bundleSize ||1) :1;
 const requestedStacks = entry.bundleSize ? Number(entry.qty ||0) : (Number(entry.qty ||0) / bundleSize);
 const availableStacks = item ? (Number(item.stackStock ||0) + (Number(item.indivStock ||0) / bundleSize)) : (prog ? prog.currentStacks :0);
 if (availableStacks <=0) return 'row-warning-red';
 const ratio = requestedStacks / availableStacks;
 if (ratio >1) return 'row-warning-red';
 if (ratio >0.5) return 'row-warning-yellow';
 return null;
 };

 window.evaluateRowColorSell = window.evaluateRowColorSell || function evaluateRowColorSell(entry) {
 const prog = (window.stockProgressCache || []).find(sp => sp.name === entry.name);
 const item = (window.items || []).find(i => i.name === entry.name);
 if (!prog || entry.source === 'OCM') return null;
 const bundleSize = item ? (Number(item.bundleSize ||1) ||1) :1;
 const sellingStacks = entry.bundleSize ? Number(entry.qty ||0) : (Number(entry.qty ||0) / bundleSize);
 const currentStacks = Number(prog.currentStacks ||0);
 const projected = currentStacks + sellingStacks;
 const effectiveTarget = Number(item?.targetEach ||0);
 if (effectiveTarget >0 && projected > effectiveTarget) return 'row-warning-red';
 return null;
 };

 /* ===== Render carts ===== */
 window.renderBuyList = window.renderBuyList || function renderBuyList() {
 const list = document.getElementById('buyList'); list.innerHTML = '';
 let total =0; const curr = document.getElementById('currencySelect').value;
 (window.buyCart || []).forEach(e => {
 const li = document.createElement('li');
 let rowTotal =0, rowText = '';
 if (e.bundleSize && e.isFullyCustom) {
 rowTotal = (e.qty / e.bundleSize) * e.price;
 rowText = `${e.qty} x ${e.name} (${e.price.toFixed(2)} BT per ${e.bundleSize}) (${rowTotal.toFixed(2)} BT)`;
 } else if (e.bundleSize) {
 rowTotal = e.qty * e.price;
 rowText = `${e.qty} x ${e.bundleSize} ${e.name} (${e.price.toFixed(2)} BT stack) (${rowTotal.toFixed(2)} BT)`;
 } else {
 rowTotal = e.qty * e.price;
 rowText = `${e.qty} x ${e.name} (${e.price.toFixed(2)} BT each) (${rowTotal.toFixed(2)} BT)`;
 }
 if (e.isBalance) { rowText = `Account Balance: ${rowTotal.toFixed(2)} BT`; if (e.isAccountBalancePinned) rowText += ' (auto)'; }
 total += rowTotal;
 if (e.isConverter) rowText += ' [Converted]';
 if (e.source === 'OCM') rowText += ' [OCM]';
 const colorClass = window.evaluateRowColorBuy(e);
 if (colorClass) li.classList.add(colorClass);
 if (curr && curr !== window.BASE_CURRENCY) rowText += ' ' + window.formatValue(rowTotal, curr, true);

 li.appendChild(document.createTextNode(rowText + ' '));
 const removeBtn = document.createElement('button');
 removeBtn.type = 'button';
 removeBtn.className = 'remove';
 removeBtn.textContent = '?';
 removeBtn.onclick = () => {
 window.buyCart = (window.buyCart || []).filter(x => x !== e);
 window.renderBuyList();
 window.calculateNet && window.calculateNet();
 };
 li.appendChild(removeBtn);
 list.appendChild(li);
 });
 document.getElementById('buyTotal').textContent = window.formatValue(total, curr, true);
 window.calculateNet && window.calculateNet();
 };

 window.renderSellList = window.renderSellList || function renderSellList() {
 const list = document.getElementById('sellList'); list.innerHTML = '';
 let total =0; const curr = document.getElementById('currencySelect').value;
 (window.sellCart || []).slice().forEach(e => {
 if (e.isAccountBalancePinned) return;
 const li = document.createElement('li');
 let rowTotal =0, rowText = '';
 if (e.bundleSize && e.isFullyCustom) {
 rowTotal = (e.qty / e.bundleSize) * e.price;
 rowText = `${e.qty} x ${e.name} (${e.price.toFixed(2)} BT per ${e.bundleSize}) (${rowTotal.toFixed(2)} BT)`;
 } else if (e.bundleSize) {
 rowTotal = e.qty * e.price;
 rowText = `${e.qty} x ${e.bundleSize} ${e.name} (${e.price.toFixed(2)} BT stack) (${rowTotal.toFixed(2)} BT)`;
 } else {
 rowTotal = e.qty * e.price;
 rowText = `${e.qty} x ${e.name} (${e.price.toFixed(2)} BT each) (${rowTotal.toFixed(2)} BT)`;
 }
 if (e.isBalance && !e.isAccountBalancePinned) { rowText = `Account Balance (manual): ${rowTotal.toFixed(2)} BT`; }
 total += rowTotal;
 if (e.isPayWith) rowText += ' [Pay With]';
 if (e.source === 'OCM') rowText += ' [OCM]';
 const colorClass = window.evaluateRowColorSell(e);
 if (colorClass) {
 li.classList.add(colorClass);
 if (colorClass === 'row-warning-red') {
 const warn = document.createElement('span');
 warn.className = 'small-note';
 warn.textContent = 'over target stock';
 li.appendChild(warn);
 }
 }
 if (curr && curr !== window.BASE_CURRENCY) rowText += ' ' + window.formatValue(rowTotal, curr, false);

 li.appendChild(document.createTextNode(rowText + ' '));
 const removeBtn = document.createElement('button');
 removeBtn.type = 'button';
 removeBtn.className = 'remove';
 removeBtn.textContent = '?';
 removeBtn.onclick = () => {
 window.sellCart = (window.sellCart || []).filter(x => x !== e);
 window.renderSellList();
 window.calculateNet && window.calculateNet();
 };
 li.appendChild(removeBtn);
 list.appendChild(li);
 });
 document.getElementById('sellTotal').textContent = window.formatValue(total, curr, false);
 window.calculateNet && window.calculateNet();
 };

 /* ===== Net calculation & combined totals ===== */
 window.calculateNet = window.calculateNet || function calculateNet() {
 const buyTotalRaw = (window.buyCart || []).reduce((sum, e) => {
 // balance rows have qty=1, price=balance
 let rowTotal;
 if (e.isBalance) rowTotal = (Number(e.price) ||0) * (Number(e.qty) ||1);
 else if (e.bundleSize && e.isFullyCustom) rowTotal = (Number(e.qty ||0) / Number(e.bundleSize ||1)) * Number(e.price ||0);
 else rowTotal = (Number(e.qty) ||0) * (Number(e.price) ||0);
 return sum + (isFinite(rowTotal) ? rowTotal :0);
 },0);

 const sellTotalRaw = (window.sellCart || []).reduce((sum, e) => {
 if (e.isAccountBalancePinned) return sum;
 let rowTotal;
 if (e.isBalance) rowTotal = (Number(e.price) ||0) * (Number(e.qty) ||1);
 else if (e.bundleSize && e.isFullyCustom) rowTotal = (Number(e.qty ||0) / Number(e.bundleSize ||1)) * Number(e.price ||0);
 else rowTotal = (Number(e.qty) ||0) * (Number(e.price) ||0);
 return sum + (isFinite(rowTotal) ? rowTotal :0);
 },0);

 const net = sellTotalRaw - buyTotalRaw;
 const netSpan = document.getElementById('netTotal');
 if (netSpan) netSpan.dataset.raw = String(net);
 window.updateCombinedTotals && window.updateCombinedTotals();
 };

 window.updateCombinedTotals = window.updateCombinedTotals || function updateCombinedTotals() {
 const curr = document.getElementById('currencySelect')?.value || window.BASE_CURRENCY;
 const netSpan = document.getElementById('netTotal');
 const netRaw = parseFloat(netSpan?.dataset?.raw ?? '0') ||0;

 const abEl = document.getElementById('accountBalanceCurrent');
 if (abEl && window.formatValue) abEl.textContent = window.formatValue(window.currentBalanceBT ||0, curr, false);

 if (netSpan && window.formatValue) {
 netSpan.textContent = window.formatValue(netRaw, curr, netRaw <0);
 netSpan.className = netRaw >=0 ? 'positive' : 'negative';
 }

 const after = (Number(window.currentBalanceBT) ||0) + netRaw;
 const afterEl = document.getElementById('accountBalanceAfter');
 if (afterEl && window.formatValue) {
 afterEl.dataset.raw = String(after);
 afterEl.textContent = window.formatValue(after, curr, after <0);
 afterEl.className = after >=0 ? 'positive' : 'negative';
 }
 };

})();

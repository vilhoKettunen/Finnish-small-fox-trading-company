// pricehistory-ui.js
window.PriceHistory = window.PriceHistory || {};
window.PriceHistory.UI = (function () {
 const { LIMITS, COMBINED_COLOR, DEFAULTS } = window.PriceHistory.Config;
 const { itemColor, assignUniqueColors, hexToRgba, dateFmt } = window.PriceHistory.Utils;
 const { loadAllSheets, buildUniqueItems } = window.PriceHistory.Data;
 const Proc = window.PriceHistory.Processing;
 const Charts = window.PriceHistory.Charts;
 const Storage = window.PriceHistory.Storage;

 let uniqueItems = [];

 // state
 let stagedItems = [];
 let appliedItems = [];

 let showCombinedPrice = DEFAULTS.showCombinedPrice;
 let normalizeCombinedTo100 = DEFAULTS.normalizeCombinedTo100;
 let showCombinedMiddleSum = DEFAULTS.showCombinedMiddleSum;

 function $(id) {
 return document.getElementById(id);
 }

 function el(tag, attrs, children) {
 const e = document.createElement(tag);
 if (attrs) {
 for (const [k, v] of Object.entries(attrs)) {
 if (k === 'className') e.className = v;
 else if (k === 'text') e.textContent = v;
 else if (k === 'style') e.setAttribute('style', v);
 else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.substring(2), v);
 else e.setAttribute(k, v);
 }
 }
 if (children) {
 for (const c of children) e.appendChild(c);
 }
 return e;
 }

 function showWarning(msg) {
 const box = $('warningBox');
 if (!box) return;
 box.textContent = msg;
 box.style.display = msg ? 'block' : 'none';
 }

 function validateItems(items) {
 const set = new Set(uniqueItems);
 return (items || []).filter(it => set.has(it));
 }

 function ensureDefaultAppliedSelection() {
 if (appliedItems.length) return;
 if (!uniqueItems.length) return;
 appliedItems = [uniqueItems[0]];
 stagedItems = [uniqueItems[0]];
 }

 function renderChips() {
 const container = $('selectedItemsChips');
 if (!container) return;
 container.innerHTML = '';

 const colors = assignUniqueColors(stagedItems);

 stagedItems.forEach(item => {
 const color = itemColor(item, colors);
 const chip = el('span', { className: 'chip', title: item }, [
 el('span', { className: 'chipColor', style: `background:${color}` }),
 el('span', { className: 'chipText', text: item, style: `color:${color}` }),
 el(
 'button',
 {
 className: 'chipRemove',
 type: 'button',
 title: 'Remove',
 onclick: () => {
 stagedItems = stagedItems.filter(x => x !== item);
 renderChips();
 }
 },
 [document.createTextNode('X')]
 )
 ]);
 container.appendChild(chip);
 });
 }

 function renderAppliedImages() {
 const container = $('selectedItemImages');
 if (!container) return;
 container.innerHTML = '';

 const max =5;
 const show = appliedItems.slice(0, max);
 for (const item of show) {
 const img = el('img', {
 className: 'itemThumb',
 src: `images/${item}.png`,
 title: item
 });
 img.onerror = () => (img.style.display = 'none');
 container.appendChild(img);
 }

 if (appliedItems.length > max) {
 container.appendChild(el('span', { className: 'moreCount', text: `+${appliedItems.length - max} more` }));
 }
 }

 function buildDatasetsForPerItemSeries(axisDates, perItemMap, opts) {
 const options = opts || {};
 const datasets = [];

 const colors = assignUniqueColors(appliedItems);

 for (const item of appliedItems) {
 const series = perItemMap.get(item) || [];
 const c = itemColor(item, colors);
 datasets.push({
 label: item,
 data: series,
 borderColor: c,
 backgroundColor: hexToRgba(c,0.12),
 borderWidth:2,
 tension:0.2,
 fill: false,
 pointRadius:3,
 spanGaps: false
 });
 }

 if (options.includeCombined && options.combinedSeries) {
 datasets.push({
 label: options.combinedLabel || 'Combined',
 data: options.combinedSeries,
 borderColor: COMBINED_COLOR,
 backgroundColor: hexToRgba(COMBINED_COLOR,0.10),
 borderWidth:2,
 tension:0.2,
 fill: false,
 pointRadius:0,
 spanGaps: false
 });
 }

 return datasets;
 }

 function renderLegend(containerId, datasets) {
 const container = $(containerId);
 if (!container) return;
 container.innerHTML = '';

 datasets.forEach(ds => {
 const row = el('div', { className: 'legendRow' }, [
 el('span', { className: 'legendSwatch', style: `background:${ds.borderColor}` }),
 el('span', { className: 'legendLabel', text: ds.label, style: `color:${ds.borderColor}` })
 ]);
 container.appendChild(row);
 });
 }

 function updatePriceChart() {
 const range = $('rangeSelect').value;

 if (!appliedItems.length) {
 Charts.drawPriceChartMulti([], []);
 renderLegend('priceLegend', []);
 return;
 }

 const model = Proc.processPriceSeriesMulti(appliedItems, range, {
 normalizeCombinedTo100
 });

 const datasets = buildDatasetsForPerItemSeries(model.axisDates, model.perItemPrices, {
 includeCombined: showCombinedPrice,
 combinedSeries: model.combined,
 combinedLabel: normalizeCombinedTo100 ? 'Combined (Normalized=100)' : 'Combined'
 });

 Charts.drawPriceChartMulti(model.axisDates, datasets, {
 perItemLastKnown: model.perItemLastKnown
 });
 renderLegend('priceLegend', datasets);
 }

 function updateMiddleChart() {
 const range = $('rangeSelect').value;
 const metric = $('metricSelect').value;

 const titles = {
 stock: 'Stock History',
 change: 'Daily Price Volatility',
 changePct: 'Daily Price Volatility (%)',
 valuation: 'Total Asset Valuation',
 goal: '% of Goal Reached',
 targetStock: 'Target Stock Stack History'
 };

 // Keep embedded button inside #middleChartTitle
 const titleEl = $('middleChartTitle');
 if (titleEl) {
 const desiredText = titles[metric] || 'Metric';
 const firstNode = [...titleEl.childNodes].find(n => n.nodeType === Node.TEXT_NODE);
 if (firstNode) {
 firstNode.nodeValue = desiredText + ' ';
 } else {
 titleEl.insertBefore(document.createTextNode(desiredText + ' '), titleEl.firstChild);
 }
 }

 if (!appliedItems.length) {
 Charts.drawMiddleChartMulti([], 'line', [], metric);
 renderLegend('middleLegend', []);
 return;
 }

 const model = Proc.processMiddleMetricSeriesMulti(appliedItems, range, metric);

 const isSingle = appliedItems.length ===1;
 const chartType = metric === 'change' || metric === 'changePct' ? (isSingle ? 'bar' : 'line') : 'line';

 const includeCombinedSum = model.canCombineSum && showCombinedMiddleSum;
 const datasets = buildDatasetsForPerItemSeries(model.axisDates, model.perItemSeries, {
 includeCombined: includeCombinedSum,
 combinedSeries: includeCombinedSum ? model.combinedSum : null,
 combinedLabel: 'Combined sum'
 });

 Charts.drawMiddleChartMulti(model.axisDates, chartType, datasets, metric, {
 perItemLastKnown: model.perItemLastKnown
 });
 renderLegend('middleLegend', datasets);
 }

 function updateInflationChart() {
 const range = $('rangeSelect').value;
 const category = $('indexSelect').value;
 const sheet = $('typeSelect').value;

 const s = Proc.processInflationIndexSeries(range, category, {
 sheet,
 range,
 appliedItems
 });

 Charts.drawInflationChart(s.axisDates, s.indexValues, s.contributingCounts, category, s);
 }

 function updateAll() {
 updatePriceChart();
 updateMiddleChart();
 updateInflationChart();
 }

 function getStateForSave() {
 return {
 version:1,
 appliedItems,
 settings: {
 type: $('typeSelect').value,
 range: $('rangeSelect').value,
 metric: $('metricSelect').value,
 index: $('indexSelect').value
 },
 toggles: {
 showCombinedPrice,
 normalizeCombinedTo100,
 showCombinedMiddleSum
 }
 };
 }

 function saveState() {
 Storage.savePreset(getStateForSave());
 }

 function applyAndRender() {
 appliedItems = [...stagedItems];
 renderAppliedImages();
 showWarning('');
 saveState();
 updatePriceChart();
 updateMiddleChart();
 updateInflationChart(); // selected-index depends on applied items
 }

 function addStagedItem(item) {
 const trimmed = String(item || '').trim();
 if (!trimmed) return;

 if (!uniqueItems.includes(trimmed)) {
 showWarning(`Unknown item: ${trimmed}`);
 return;
 }

 if (stagedItems.includes(trimmed)) return;

 if (stagedItems.length >= LIMITS.MAX_ITEMS) {
 showWarning(`You can select up to ${LIMITS.MAX_ITEMS} items.`);
 return;
 }

 stagedItems.push(trimmed);
 showWarning('');
 renderChips();
 }

 function modalFillFromHelpText(helpKey) {
 const modal = $('infoModal');
 const title = $('infoModalTitle');
 const body = $('infoModalBody');
 if (!modal || !title || !body) return;

 const t = window.PriceHistory.HelpText?.[helpKey];
 if (!t) return;

 title.textContent = t.title || 'Info';
 body.innerHTML = '';

 if (t.bullets && Array.isArray(t.bullets)) {
 const ul = el('ul');
 t.bullets.forEach(b => ul.appendChild(el('li', { text: b })));
 body.appendChild(ul);
 }

 if (t.example) {
 body.appendChild(
 el('div', { className: 'helpExample' }, [
 el('div', { className: 'helpExampleTitle', text: 'Example' }),
 el('div', { text: t.example })
 ])
 );
 }

 modal.style.display = 'flex';
 }

 function openInfo(key) {
 if (key === 'controls' || key === 'price' || key === 'metricSystem' || key === 'indexSystem') {
 modalFillFromHelpText(key);
 return;
 }

 if (key === 'middleDynamic') {
 const metric = $('metricSelect')?.value || 'stock';

 const metricNameMap = {
 stock: 'Stock Amount',
 change: 'Daily Price Change (+/-)',
 changePct: 'Daily Price Change (%)',
 valuation: 'Total Valuation',
 goal: 'Goal Stock %',
 targetStock: 'Target stock stack'
 };

 const metricHelp = window.PriceHistory.HelpText?.middleMetricHelp?.[metric];

 const modal = $('infoModal');
 const title = $('infoModalTitle');
 const body = $('infoModalBody');
 if (!modal || !title || !body || !metricHelp) return;

 title.textContent = 'Middle Chart';
 body.innerHTML = '';

 body.appendChild(
 el('div', { className: 'helpExample' }, [
 el('div', { className: 'helpExampleTitle', text: `Current metric: ${metricNameMap[metric] || metric}` }),
 el('div', { text: `Best for: ${metricHelp.bestFor}` })
 ])
 );

 const ul = el('ul');
 (metricHelp.bullets || []).forEach(b => ul.appendChild(el('li', { text: b })));
 body.appendChild(ul);

 if (metricHelp.example) {
 body.appendChild(
 el('div', { className: 'helpExample' }, [
 el('div', { className: 'helpExampleTitle', text: 'Example' }),
 el('div', { text: metricHelp.example })
 ])
 );
 }

 modal.style.display = 'flex';
 return;
 }

 if (key === 'inflationDynamic') {
 const category = $('indexSelect')?.value || 'median';
 const categoryNameMap = {
 median: 'Median Item Inflation Index (Weighted)',
 metals: 'Metal Index (Weighted)',
 common: 'Common Items Index (Weighted)',
 selected: 'Selected items index (Weighted)'
 };

 const catHelp = window.PriceHistory.HelpText?.inflationCategoryHelp?.[category];

 const modal = $('infoModal');
 const title = $('infoModalTitle');
 const body = $('infoModalBody');
 if (!modal || !title || !body || !catHelp) return;

 title.textContent = 'Inflation Index';
 body.innerHTML = '';

 body.appendChild(
 el('div', { className: 'helpExample' }, [
 el('div', { className: 'helpExampleTitle', text: `Current category: ${categoryNameMap[category] || category}` }),
 el('div', { text: `Best for: ${catHelp.bestFor}` })
 ])
 );

 const ul = el('ul');
 (catHelp.bullets || []).forEach(b => ul.appendChild(el('li', { text: b })));
 body.appendChild(ul);

 const itemList = Proc.getInflationCategoryItemList(category, appliedItems);
 if (itemList && itemList.length) {
 const listWrap = el('div', { className: 'helpExample' }, [
 el('div', { className: 'helpExampleTitle', text: 'Items in this category' })
 ]);

 const itemsUl = el('ul');
 itemList.forEach(name => itemsUl.appendChild(el('li', { text: String(name) })));
 listWrap.appendChild(itemsUl);
 body.appendChild(listWrap);
 }

 if (catHelp.example) {
 body.appendChild(
 el('div', { className: 'helpExample' }, [
 el('div', { className: 'helpExampleTitle', text: 'Example' }),
 el('div', { text: catHelp.example })
 ])
 );
 }

 modal.style.display = 'flex';
 return;
 }
 }

 function closeInfo() {
 const modal = $('infoModal');
 if (modal) modal.style.display = 'none';
 }

 async function loadDataAndCatalog() {
 const sheet = $('typeSelect').value;
 const { main } = await loadAllSheets(sheet);

 uniqueItems = buildUniqueItems(main);

 const dl = $('itemDatalist');
 if (dl) {
 dl.innerHTML = '';
 uniqueItems.forEach(item => {
 const opt = document.createElement('option');
 opt.value = item;
 dl.appendChild(opt);
 });
 }

 stagedItems = validateItems(stagedItems);
 appliedItems = validateItems(appliedItems);

 ensureDefaultAppliedSelection();
 if (!stagedItems.length) stagedItems = [...appliedItems];

 renderChips();
 renderAppliedImages();
 }

 function applyPresetIfAny(preset) {
 if (!preset) return;

 const settings = preset.settings || {};
 const toggles = preset.toggles || {};

 if (settings.type) $('typeSelect').value = settings.type;
 if (settings.range) $('rangeSelect').value = settings.range;
 if (settings.metric) $('metricSelect').value = settings.metric;
 if (settings.index) $('indexSelect').value = settings.index;

 showCombinedPrice = !!toggles.showCombinedPrice;
 normalizeCombinedTo100 = !!toggles.normalizeCombinedTo100;
 showCombinedMiddleSum = !!toggles.showCombinedMiddleSum;

 $('toggleCombinedPrice').checked = showCombinedPrice;
 $('toggleNormalizeCombined').checked = normalizeCombinedTo100;
 $('toggleCombinedMiddle').checked = showCombinedMiddleSum;

 appliedItems = Array.isArray(preset.appliedItems) ? preset.appliedItems.map(String) : [];
 stagedItems = [...appliedItems];
 }

 async function init() {
 const preset = Storage.loadPreset();
 applyPresetIfAny(preset);

 await loadDataAndCatalog();

 stagedItems = validateItems(stagedItems);
 appliedItems = validateItems(appliedItems);
 ensureDefaultAppliedSelection();
 if (!stagedItems.length) stagedItems = [...appliedItems];

 renderChips();
 renderAppliedImages();

 // wire events
 $('addItemBtn').addEventListener('click', () => {
 addStagedItem($('itemSearchInput').value);
 $('itemSearchInput').value = '';
 });

 $('itemSearchInput').addEventListener('keydown', (e) => {
 if (e.key === 'Enter') {
 e.preventDefault();
 addStagedItem($('itemSearchInput').value);
 $('itemSearchInput').value = '';
 }
 });

 $('clearItemsBtn').addEventListener('click', () => {
 stagedItems = [];
 renderChips();
 });

 $('applyItemsBtn').addEventListener('click', () => applyAndRender());

 $('typeSelect').addEventListener('change', async () => {
 await loadDataAndCatalog();
 saveState();
 updateAll();
 });

 $('rangeSelect').addEventListener('change', () => {
 saveState();
 updateAll();
 });

 $('metricSelect').addEventListener('change', () => {
 saveState();
 updateMiddleChart();
 });

 $('indexSelect').addEventListener('change', () => {
 saveState();
 updateInflationChart();
 });

 $('toggleCombinedPrice').addEventListener('change', (e) => {
 showCombinedPrice = !!e.target.checked;
 saveState();
 updatePriceChart();
 });

 $('toggleNormalizeCombined').addEventListener('change', (e) => {
 normalizeCombinedTo100 = !!e.target.checked;
 saveState();
 updatePriceChart();
 });

 $('toggleCombinedMiddle').addEventListener('change', (e) => {
 showCombinedMiddleSum = !!e.target.checked;
 saveState();
 updateMiddleChart();
 });

 // Info buttons
 document.querySelectorAll('[data-info]')?.forEach(btn => {
 btn.addEventListener('click', () => openInfo(btn.getAttribute('data-info')));
 });

 $('infoModalClose').addEventListener('click', closeInfo);
 $('infoModal').addEventListener('click', (e) => {
 if (e.target && e.target.id === 'infoModal') closeInfo();
 });
 document.addEventListener('keydown', (e) => {
 if (e.key === 'Escape') closeInfo();
 });

 try {
 updateAll();
 } catch (e) {
 console.error('PriceHistory updateAll failed', e);
 }
 }

 return { init };
})();

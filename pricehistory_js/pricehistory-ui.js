// pricehistory-ui.js
window.PriceHistory = window.PriceHistory || {};
window.PriceHistory.UI = (function () {
 const { LIMITS, COMBINED_COLOR, DEFAULTS } = window.PriceHistory.Config;
 const { itemColor, assignUniqueColors, hexToRgba } = window.PriceHistory.Utils;
 const { loadAllSheets, buildUniqueItems, loadVelocitySheet } = window.PriceHistory.Data;
 const Proc = window.PriceHistory.Processing;
 const Charts = window.PriceHistory.Charts;
 const Storage = window.PriceHistory.Storage;

 let uniqueItems = [];

 // state
 let stagedItems = [];
 let appliedItems = [];

 let showCombinedPrice = DEFAULTS.showCombinedPrice;
 let normalizeCombinedTo100 = DEFAULTS.normalizeCombinedTo100;
 let normalizePriceItemsTo100 = DEFAULTS.normalizePriceItemsTo100;
 let showCombinedMiddleSum = DEFAULTS.showCombinedMiddleSum;

 // velocity (shared metric)
 let velocityMetric = DEFAULTS.velocityMetric;

 // Per-chart velocity toggles
 let velocityItemToggles = {
 showBreakdown: DEFAULTS.velocityShowBreakdown,
 normalizeTo100: DEFAULTS.velocityNormalizeTo100,
 showA: DEFAULTS.velocityShowA,
 showB: DEFAULTS.velocityShowB
 };

 // Combined defaults: breakdown OFF for simplicity
 let velocityCombinedToggles = {
 showBreakdown: false,
 normalizeTo100: DEFAULTS.velocityNormalizeTo100,
 showA: DEFAULTS.velocityShowA,
 showB: DEFAULTS.velocityShowB
 };

 // Remember last ShowB state when a B-less metric is selected
 let velRememberedShowB_Item = true;
 let velRememberedShowB_Combined = true;

 let dropdownApi = null;

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
 normalizeCombinedTo100,
 normalizeItemsTo100: normalizePriceItemsTo100
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

 function velocitySheetKeyFromUi_(metricUi) {
 if (metricUi === 'ewVelocity') return 'EwVelocity';
 if (metricUi === 'storeVolume') return 'VelocityVolume';
 if (metricUi === 'ocmVolume') return 'OcmVolume';
 if (metricUi === 'uniqueTraders') return 'UniqueTraders';
 if (metricUi === 'tradeCount') return 'TradeCount';
 return 'EwVelocity';
 }

 function velocityLineLabels_(metricUi) {
 // A/B labels and title text
 if (metricUi === 'ewVelocity') return { a: 'EW Buy', b: 'EW Sell', title: 'EW Velocity' };
 if (metricUi === 'storeVolume') return { a: 'Bought', b: 'Sold', title: 'Store Volume' };
 if (metricUi === 'uniqueTraders') return { a: 'Store', b: 'OCM', title: 'Unique Traders' };
 if (metricUi === 'tradeCount') return { a: 'Store', b: 'OCM', title: 'Trade Count' };
 if (metricUi === 'ocmVolume') return { a: 'OCM Volume', b: null, title: 'OCM Volume' };
 return { a: 'A', b: 'B', title: 'Velocity' };
 }

 function buildVelocityDatasets_(perItemSeriesA, perItemSeriesB, perItemCombined, metricUi, toggles) {
 const { a: aName, b: bName } = velocityLineLabels_(metricUi);
 const colors = assignUniqueColors(appliedItems);

 const datasets = [];
 const dashed = [6,4];

 if (toggles.showBreakdown) {
 for (const item of appliedItems) {
 const c = itemColor(item, colors);
 if (toggles.showA) {
 datasets.push({
 label: `${item} (${aName})`,
 data: perItemSeriesA.get(item) || [],
 borderColor: c,
 backgroundColor: hexToRgba(c,0.08),
 borderWidth:2,
 tension:0.2,
 fill: false,
 pointRadius:3,
 spanGaps: false
 });
 }
 if (bName && toggles.showB) {
 datasets.push({
 label: `${item} (${bName})`,
 data: perItemSeriesB.get(item) || [],
 borderColor: c,
 backgroundColor: hexToRgba(c,0.08),
 borderWidth:2,
 tension:0.2,
 fill: false,
 pointRadius:3,
 spanGaps: false,
 borderDash: dashed
 });
 }
 }
 } else {
 for (const item of appliedItems) {
 const c = itemColor(item, colors);
 datasets.push({
 label: `${item} (Total)`,
 data: perItemCombined.get(item) || [],
 borderColor: c,
 backgroundColor: hexToRgba(c,0.08),
 borderWidth:2,
 tension:0.2,
 fill: false,
 pointRadius:3,
 spanGaps: false
 });
 }
 }

 return datasets;
 }

 function setToggleLabelText_(labelEl, text) {
 if (!labelEl) return;
 // Try to find an existing text node; else append.
 const tn = [...labelEl.childNodes].find(n => n.nodeType === Node.TEXT_NODE);
 if (tn) tn.nodeValue = ' ' + text;
 else labelEl.appendChild(document.createTextNode(' ' + text));
 }

 function updateVelocitySubToggleLabels_() {
 const { a, b } = velocityLineLabels_(velocityMetric);

 const itemA = $('toggleVelocityItemShowA')?.closest('label');
 const itemB = $('toggleVelocityItemShowB')?.closest('label');
 const combA = $('toggleVelocityCombinedShowA')?.closest('label');
 const combB = $('toggleVelocityCombinedShowB')?.closest('label');

 setToggleLabelText_(itemA, `Show ${a}`);
 setToggleLabelText_(combA, `Show ${a}`);

 if (!b) {
 // Remember previous B states, then force hide/disable B
 velRememberedShowB_Item = velocityItemToggles.showB;
 velRememberedShowB_Combined = velocityCombinedToggles.showB;

 velocityItemToggles.showB = false;
 velocityCombinedToggles.showB = false;

 const itemBInput = $('toggleVelocityItemShowB');
 const combBInput = $('toggleVelocityCombinedShowB');
 if (itemBInput) itemBInput.checked = false;
 if (combBInput) combBInput.checked = false;

 if (itemB) itemB.style.display = 'none';
 if (combB) combB.style.display = 'none';
 } else {
 // Restore remembered B states when switching back to a two-field metric
 if (!velocityItemToggles.showB && velRememberedShowB_Item) velocityItemToggles.showB = true;
 if (!velocityCombinedToggles.showB && velRememberedShowB_Combined) velocityCombinedToggles.showB = true;

 const itemBInput = $('toggleVelocityItemShowB');
 const combBInput = $('toggleVelocityCombinedShowB');
 if (itemBInput) itemBInput.checked = !!velocityItemToggles.showB;
 if (combBInput) combBInput.checked = !!velocityCombinedToggles.showB;

 if (itemB) {
 itemB.style.display = '';
 setToggleLabelText_(itemB, `Show ${b}`);
 }
 if (combB) {
 combB.style.display = '';
 setToggleLabelText_(combB, `Show ${b}`);
 }
 }
 }

 async function getVelocityModel_() {
 const range = $('rangeSelect')?.value;
 if (!range) return null;

 if (!appliedItems.length) return { axisDates: [], perItemA: new Map(), perItemB: new Map(), perItemCombined: new Map(), combinedSum: [] };

 const sheetKey = velocitySheetKeyFromUi_(velocityMetric);
 await loadVelocitySheet(sheetKey);

 // We compute model twice if normalizations differ; keep this helper to minimize duplication.
 return { range, sheetKey };
 }

 async function updateVelocityItemChart() {
 const range = $('rangeSelect')?.value;
 if (!range) return;

 if (!appliedItems.length) {
 Charts.drawVelocityChartMulti([], [], velocityMetric);
 renderLegend('velocityLegend', []);
 return;
 }

 const sheetKey = velocitySheetKeyFromUi_(velocityMetric);
 await loadVelocitySheet(sheetKey);

 const model = Proc.processVelocitySeriesMulti(appliedItems, range, sheetKey, {
 normalizeTo100: velocityItemToggles.normalizeTo100
 });

 const datasets = buildVelocityDatasets_(model.perItemA, model.perItemB, model.perItemCombined, velocityMetric, velocityItemToggles);
 Charts.drawVelocityChartMulti(model.axisDates, datasets, velocityMetric);
 renderLegend('velocityLegend', datasets);
 }

 async function updateVelocityCombinedChart() {
 const range = $('rangeSelect')?.value;
 if (!range) return;

 if (!appliedItems.length) {
 Charts.drawVelocityCombinedChart([], [], velocityMetric);
 renderLegend('velocityCombinedLegend', []);
 return;
 }

 const sheetKey = velocitySheetKeyFromUi_(velocityMetric);
 await loadVelocitySheet(sheetKey);

 const model = Proc.processVelocitySeriesMulti(appliedItems, range, sheetKey, {
 normalizeTo100: velocityCombinedToggles.normalizeTo100
 });

 const labels = velocityLineLabels_(velocityMetric);
 const dashed = [6,4];
 const combinedDatasets = [];

 // If breakdown OFF, just show total sum.
 if (velocityCombinedToggles.showBreakdown) {
 if (velocityCombinedToggles.showA) {
 const sumA = model.axisDates.map((_, i) => {
 let s =0;
 for (const item of appliedItems) s += model.perItemA.get(item)?.[i] ||0;
 return s;
 });
 combinedDatasets.push({
 label: `${labels.a} (Sum)`,
 data: sumA,
 borderColor: COMBINED_COLOR,
 backgroundColor: hexToRgba(COMBINED_COLOR,0.08),
 borderWidth:2,
 tension:0.2,
 fill: false,
 pointRadius:0,
 spanGaps: false
 });
 }

 if (labels.b && velocityCombinedToggles.showB) {
 const sumB = model.axisDates.map((_, i) => {
 let s =0;
 for (const item of appliedItems) s += model.perItemB.get(item)?.[i] ||0;
 return s;
 });
 combinedDatasets.push({
 label: `${labels.b} (Sum)`,
 data: sumB,
 borderColor: COMBINED_COLOR,
 backgroundColor: hexToRgba(COMBINED_COLOR,0.08),
 borderWidth:2,
 tension:0.2,
 fill: false,
 pointRadius:0,
 spanGaps: false,
 borderDash: dashed
 });
 }
 }

 // Total always included
 combinedDatasets.push({
 label: 'Total (Sum)',
 data: model.combinedSum,
 borderColor: COMBINED_COLOR,
 backgroundColor: hexToRgba(COMBINED_COLOR,0.12),
 borderWidth:3,
 tension:0.2,
 fill: false,
 pointRadius:0,
 spanGaps: false
 });

 Charts.drawVelocityCombinedChart(model.axisDates, combinedDatasets, velocityMetric);
 renderLegend('velocityCombinedLegend', combinedDatasets);
 }

 async function updateVelocityCharts() {
 await updateVelocityItemChart();
 await updateVelocityCombinedChart();
 }

 function updateAll() {
 updatePriceChart();
 updateMiddleChart();
 updateInflationChart();
 updateVelocityCharts();
 }

 function getStateForSave() {
 const safeVal = (id, fallback) => {
 const el = $(id);
 if (!el) return fallback;
 const v = el.value;
 return (v === undefined || v === null || v === '') ? fallback : v;
 };

 return {
 version:3,
 appliedItems,
 settings: {
 type: safeVal('typeSelect', 'SellHistory'),
 range: safeVal('rangeSelect', 'all'),
 metric: safeVal('metricSelect', 'stock'),
 index: safeVal('indexSelect', 'median'),
 velocityMetric
 },
 toggles: {
 showCombinedPrice,
 normalizeCombinedTo100,
 normalizePriceItemsTo100,
 showCombinedMiddleSum,

 // New: split velocity toggles
 velocityItemShowBreakdown: !!velocityItemToggles.showBreakdown,
 velocityItemNormalizeTo100: !!velocityItemToggles.normalizeTo100,
 velocityItemShowA: !!velocityItemToggles.showA,
 velocityItemShowB: !!velocityItemToggles.showB,

 velocityCombinedShowBreakdown: !!velocityCombinedToggles.showBreakdown,
 velocityCombinedNormalizeTo100: !!velocityCombinedToggles.normalizeTo100,
 velocityCombinedShowA: !!velocityCombinedToggles.showA,
 velocityCombinedShowB: !!velocityCombinedToggles.showB
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
 updateInflationChart();
 updateVelocityCharts();
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
 if (key === 'controls' || key === 'price' || key === 'metricSystem' || key === 'indexSystem' || key === 'velocitySystem' || key === 'velocityDynamic') {
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

 stagedItems = validateItems(stagedItems);
 appliedItems = validateItems(appliedItems);

 ensureDefaultAppliedSelection();
 if (!stagedItems.length) stagedItems = [...appliedItems];

 renderChips();
 renderAppliedImages();

 wireUniversalItemDropdown_();
 }

 function wireUniversalItemDropdown_() {
 const input = $('itemSearchInput');
 const list = $('itemSearchInputList');
 if (!input || !list) return;

 if (!(window.universalDropdown && typeof window.universalDropdown.attach === 'function')) return;

 if (dropdownApi && typeof dropdownApi.refresh === 'function') {
 dropdownApi.refresh();
 return;
 }

 dropdownApi = window.universalDropdown.attach({
 inputEl: input,
 listEl: list,
 getItems: () => uniqueItems.map(name => ({ name })),
 getLabel: (it) => String(it?.name || ''),
 getExtraText: () => '',
 showProgress: false,
 onSelect: (name) => {
 addStagedItem(name);
 input.value = '';
 try { input.focus(); } catch { }
 setTimeout(() => {
 try { input.dispatchEvent(new Event('input')); } catch { }
 },0);
 }
 });
 }

 function applyPresetIfAny(preset) {
 if (!preset) return;

 const settings = preset.settings || {};
 const toggles = preset.toggles || {};

 const typeEl = $('typeSelect');
 const rangeEl = $('rangeSelect');
 const metricEl = $('metricSelect');
 const indexEl = $('indexSelect');
 const velEl = $('velocityMetricSelect');

 if (settings.type && typeEl) typeEl.value = settings.type;
 if (settings.range && rangeEl) rangeEl.value = settings.range;
 if (settings.metric && metricEl) metricEl.value = settings.metric;
 if (settings.index && indexEl) indexEl.value = settings.index;

 velocityMetric = settings.velocityMetric || velocityMetric;
 if (velEl && velocityMetric) velEl.value = velocityMetric;

 showCombinedPrice = !!toggles.showCombinedPrice;
 normalizeCombinedTo100 = !!toggles.normalizeCombinedTo100;
 normalizePriceItemsTo100 = !!toggles.normalizePriceItemsTo100;
 showCombinedMiddleSum = !!toggles.showCombinedMiddleSum;

 // Backward compatibility: old single velocity toggle keys
 const oldBreak = toggles.velocityShowBreakdown;
 const oldNorm = toggles.velocityNormalizeTo100;
 const oldA = toggles.velocityShowA;
 const oldB = toggles.velocityShowB;
 const hasOld = oldBreak !== undefined || oldNorm !== undefined || oldA !== undefined || oldB !== undefined;

 if (hasOld) {
 velocityItemToggles.showBreakdown = oldBreak !== undefined ? !!oldBreak : velocityItemToggles.showBreakdown;
 velocityItemToggles.normalizeTo100 = oldNorm !== undefined ? !!oldNorm : velocityItemToggles.normalizeTo100;
 velocityItemToggles.showA = oldA !== undefined ? !!oldA : velocityItemToggles.showA;
 velocityItemToggles.showB = oldB !== undefined ? !!oldB : velocityItemToggles.showB;

 // Apply same old values to combined, but keep default breakdown OFF unless explicitly set
 velocityCombinedToggles.showBreakdown = oldBreak !== undefined ? !!oldBreak : velocityCombinedToggles.showBreakdown;
 velocityCombinedToggles.normalizeTo100 = oldNorm !== undefined ? !!oldNorm : velocityCombinedToggles.normalizeTo100;
 velocityCombinedToggles.showA = oldA !== undefined ? !!oldA : velocityCombinedToggles.showA;
 velocityCombinedToggles.showB = oldB !== undefined ? !!oldB : velocityCombinedToggles.showB;
 } else {
 velocityItemToggles.showBreakdown = toggles.velocityItemShowBreakdown !== undefined ? !!toggles.velocityItemShowBreakdown : velocityItemToggles.showBreakdown;
 velocityItemToggles.normalizeTo100 = toggles.velocityItemNormalizeTo100 !== undefined ? !!toggles.velocityItemNormalizeTo100 : velocityItemToggles.normalizeTo100;
 velocityItemToggles.showA = toggles.velocityItemShowA !== undefined ? !!toggles.velocityItemShowA : velocityItemToggles.showA;
 velocityItemToggles.showB = toggles.velocityItemShowB !== undefined ? !!toggles.velocityItemShowB : velocityItemToggles.showB;

 velocityCombinedToggles.showBreakdown = toggles.velocityCombinedShowBreakdown !== undefined ? !!toggles.velocityCombinedShowBreakdown : velocityCombinedToggles.showBreakdown;
 velocityCombinedToggles.normalizeTo100 = toggles.velocityCombinedNormalizeTo100 !== undefined ? !!toggles.velocityCombinedNormalizeTo100 : velocityCombinedToggles.normalizeTo100;
 velocityCombinedToggles.showA = toggles.velocityCombinedShowA !== undefined ? !!toggles.velocityCombinedShowA : velocityCombinedToggles.showA;
 velocityCombinedToggles.showB = toggles.velocityCombinedShowB !== undefined ? !!toggles.velocityCombinedShowB : velocityCombinedToggles.showB;
 }

 const tPrice = $('toggleCombinedPrice');
 const tNorm = $('toggleNormalizeCombined');
 const tNormItems = $('toggleNormalizePriceItems');
 const tMiddle = $('toggleCombinedMiddle');

 if (tPrice) tPrice.checked = showCombinedPrice;
 if (tNorm) tNorm.checked = normalizeCombinedTo100;
 if (tNormItems) tNormItems.checked = normalizePriceItemsTo100;
 if (tMiddle) tMiddle.checked = showCombinedMiddleSum;

 // velocity control checkboxes
 const itBreak = $('toggleVelocityItemBreakdown');
 const itNorm = $('toggleVelocityItemNormalizeTo100');
 const itA = $('toggleVelocityItemShowA');
 const itB = $('toggleVelocityItemShowB');

 if (itBreak) itBreak.checked = !!velocityItemToggles.showBreakdown;
 if (itNorm) itNorm.checked = !!velocityItemToggles.normalizeTo100;
 if (itA) itA.checked = !!velocityItemToggles.showA;
 if (itB) itB.checked = !!velocityItemToggles.showB;

 const cbBreak = $('toggleVelocityCombinedBreakdown');
 const cbNorm = $('toggleVelocityCombinedNormalizeTo100');
 const cbA = $('toggleVelocityCombinedShowA');
 const cbB = $('toggleVelocityCombinedShowB');

 if (cbBreak) cbBreak.checked = !!velocityCombinedToggles.showBreakdown;
 if (cbNorm) cbNorm.checked = !!velocityCombinedToggles.normalizeTo100;
 if (cbA) cbA.checked = !!velocityCombinedToggles.showA;
 if (cbB) cbB.checked = !!velocityCombinedToggles.showB;

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

 updateVelocitySubToggleLabels_();

 // wire events
 $('addItemBtn').addEventListener('click', () => {
 addStagedItem($('itemSearchInput').value);
 $('itemSearchInput').value = '';
 });

 $('itemSearchInput').addEventListener('keydown', (e) => {
 if (e.key === 'Enter') {
 const hasActive = typeof $('itemSearchInput')._dropIndex === 'number' && $('itemSearchInput')._dropIndex >=0;
 if (hasActive) return;

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

 $('velocityMetricSelect')?.addEventListener('change', async (e) => {
 velocityMetric = String(e.target.value || 'ewVelocity');
 updateVelocitySubToggleLabels_();
 saveState();
 await updateVelocityCharts();
 });

 // per-item velocity toggles
 $('toggleVelocityItemBreakdown')?.addEventListener('change', async (e) => {
 velocityItemToggles.showBreakdown = !!e.target.checked;
 saveState();
 await updateVelocityItemChart();
 });
 $('toggleVelocityItemShowA')?.addEventListener('change', async (e) => {
 velocityItemToggles.showA = !!e.target.checked;
 saveState();
 await updateVelocityItemChart();
 });
 $('toggleVelocityItemShowB')?.addEventListener('change', async (e) => {
 velocityItemToggles.showB = !!e.target.checked;
 velRememberedShowB_Item = velocityItemToggles.showB;
 saveState();
 await updateVelocityItemChart();
 });
 $('toggleVelocityItemNormalizeTo100')?.addEventListener('change', async (e) => {
 velocityItemToggles.normalizeTo100 = !!e.target.checked;
 saveState();
 await updateVelocityItemChart();
 });

 // combined velocity toggles
 $('toggleVelocityCombinedBreakdown')?.addEventListener('change', async (e) => {
 velocityCombinedToggles.showBreakdown = !!e.target.checked;
 saveState();
 await updateVelocityCombinedChart();
 });
 $('toggleVelocityCombinedShowA')?.addEventListener('change', async (e) => {
 velocityCombinedToggles.showA = !!e.target.checked;
 saveState();
 await updateVelocityCombinedChart();
 });
 $('toggleVelocityCombinedShowB')?.addEventListener('change', async (e) => {
 velocityCombinedToggles.showB = !!e.target.checked;
 velRememberedShowB_Combined = velocityCombinedToggles.showB;
 saveState();
 await updateVelocityCombinedChart();
 });
 $('toggleVelocityCombinedNormalizeTo100')?.addEventListener('change', async (e) => {
 velocityCombinedToggles.normalizeTo100 = !!e.target.checked;
 saveState();
 await updateVelocityCombinedChart();
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

 $('toggleNormalizePriceItems')?.addEventListener('change', (e) => {
 normalizePriceItemsTo100 = !!e.target.checked;
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

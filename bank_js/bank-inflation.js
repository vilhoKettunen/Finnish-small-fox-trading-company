// bank_js/bank-inflation.js
// Self-contained module for the Inflation Index chart inside the
// Velocity & Inflation collapsible section on the Bank page.
//
// Depends on (loaded before this file):
//   bank-config.js  ? BankConfig
//   bank-data.js    ? BankData
//   bank-charts.js  ? BankCharts
//   shared/universal-dropdown.js  ? window.universalDropdown

window.BankInflation = (function () {
    'use strict';

    // ??? Constants ?????????????????????????????????????????????????????????
    const STORAGE_KEY = BankConfig.INFLATION_STORAGE_KEY; // 'bank:inflation:preset:v1'
    const MAX_ITEMS   = BankConfig.LIMITS.MAX_INFLATION_ITEMS; // 10

    // Price history sheets (SellHistory = store sell prices = player buy prices)
    const PRICE_SHEETS = BankConfig.PRICE_HISTORY_SHEETS;

    // Inflation item lists (mirrors pricehistory-config.js)
    const INFLATION_LISTS = BankConfig.INFLATION_LISTS;

    // Color palette (reuse bank's palette for chips)
    const PALETTE = BankConfig.METAL_COLOR_PALETTE;

    // ??? Module state ???????????????????????????????????????????????????????
    let _inited        = false;
    let _uniqueItems   = [];
    let _stagedItems   = [];
    let _appliedItems  = [];
    let _priceRows     = null;   // cached SellHistory rows
    let _dropdownApi   = null;

    // ??? Helpers ????????????????????????????????????????????????????????????
    function $(id) { return document.getElementById(id); }

  function normalizeName(s) {
  return String(s || '').trim().toLowerCase();
    }

    function csvToNormalizedSet(csv) {
    const set = new Set();
  (csv || '').split(',').forEach(s => {
   const n = normalizeName(s);
            if (n) set.add(n);
        });
        return set;
    }

    // Assign a color from the palette deterministically by item index
    function itemColor(item) {
        const idx = _uniqueItems.indexOf(item);
    return PALETTE[(idx >= 0 ? idx : 0) % PALETTE.length];
    }

    // ??? CSV helpers (self-contained copies of BankData internals) ??????????
    function csvUrlFor(spreadsheetId, tabName) {
        return 'https://docs.google.com/spreadsheets/d/' + spreadsheetId +
     '/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent(tabName);
    }

    function parseLocalNum(s) {
        if (s == null || s === '') return NaN;
        let str = String(s).trim().replace(/^"|"$/g, '');
        if (str === '' || str === '-') return NaN;
   const lastComma  = str.lastIndexOf(',');
        const lastPeriod = str.lastIndexOf('.');
   if (lastComma > -1 && lastPeriod > -1) {
  if (lastComma > lastPeriod) str = str.replace(/\./g, '').replace(',', '.');
            else str = str.replace(/,/g, '');
        } else if (lastComma > -1 && lastPeriod === -1) {
  str = str.replace(',', '.');
        }
  str = str.replace(/[^0-9.\-]/g, '');
 const n = parseFloat(str);
   return isNaN(n) ? NaN : n;
    }

    function parseDateStr(s) {
        if (!s) return null;
        const str = String(s).trim().replace(/^"|"$/g, '');
  if (!str) return null;
        const isoM = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (isoM) return new Date(Date.UTC(+isoM[1], +isoM[2] - 1, +isoM[3]));
        const usM = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (usM) {
 const month = +usM[1]; const day = +usM[2]; const year = +usM[3];
 if (month >= 1 && month <= 12 && day >= 1 && day <= 31)
     return new Date(Date.UTC(year, month - 1, day));
        }
        const euM = str.match(/^(\d{1,2})[-.](\d{1,2})[-.](\d{4})/);
      if (euM) return new Date(Date.UTC(+euM[3], +euM[2] - 1, +euM[1]));
        return null;
  }

    function parseCsvLine(line) {
        return line
          .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
    .map(s => s.replace(/^"|"$/g, '').trim());
    }

    // ??? Storage ?????????????????????????????????????????????????????????????
    function loadPreset() {
        try {
        const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
  const p = JSON.parse(raw);
            return p && typeof p === 'object' ? p : null;
        } catch { return null; }
    }

    function savePreset() {
        try {
       const indexCat = ($('bankInflIndexSelect') || {}).value || 'median';
     localStorage.setItem(STORAGE_KEY, JSON.stringify({
  version: 1,
                appliedItems: _appliedItems.slice(),
        indexCategory: indexCat
    }));
        } catch { /* ignore */ }
    }

// ??? Item catalog ?????????????????????????????????????????????????????????
    // Build the list of selectable items from ValuationHistory (already cached)
    function loadItemCatalog() {
        const rows = BankData.cache.valuationHistory || [];
 const seen = new Set();
        const items = [];
        rows.forEach(r => {
       if (r.item && !seen.has(r.item)) {
       seen.add(r.item);
                items.push(r.item);
       }
        });
   // Fallback to metals list if cache empty
     if (!items.length) {
         BankConfig.METALS_LIST.forEach(m => {
        if (!seen.has(m)) { seen.add(m); items.push(m); }
    });
        }
 _uniqueItems = items;
    }

    // ??? Price history fetch ??????????????????????????????????????????????????
    async function fetchPriceHistory() {
        if (_priceRows) return _priceRows; // cached
      const cfg = PRICE_SHEETS.SellHistory;
        const res = await fetch(csvUrlFor(cfg.spreadsheetId, cfg.tabName));
if (!res.ok) throw new Error('BankInflation: SellHistory fetch failed: ' + res.status);
        const text = await res.text();
        const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim() !== '');
        // Columns: Timestamp, Item, Price, Stock
        const rows = lines.slice(1).map(line => {
            const p = parseCsvLine(line);
            return {
                ts:    parseDateStr(p[0]),
      item:  p[1] ? p[1].trim() : '',
      value: parseLocalNum(p[2]),
            stock: parseLocalNum(p[3])
        };
        }).filter(r => r.ts && r.item);
        _priceRows = rows;
        return rows;
    }

    // ??? Range filtering ??????????????????????????????????????????????????????
    function getCutoff(range) {
  if (!range || range === 'all') return null;
     const now = new Date();
        if (range === '7d')  return new Date(now - 7   * 86400000);
    if (range === '30d') return new Date(now - 30  * 86400000);
        if (range === '90d') return new Date(now - 90  * 86400000);
        if (range === '1y')  return new Date(now - 365 * 86400000);
        return null;
    }

    // ??? Inflation processing (port of pricehistory-processing.js) ????????????

    function groupByItemNormalized(rows) {
        const m = new Map();
for (const r of rows || []) {
 const key = normalizeName(r.item);
    if (!key) continue;
    if (!m.has(key)) m.set(key, []);
            m.get(key).push(r);
        }
        for (const arr of m.values()) arr.sort((a, b) => a.ts - b.ts);
        return m;
    }

    function pickDisplayName(key, mainByItem) {
        const rows = mainByItem.get(key);
        if (rows && rows.length) return String(rows[0].item || '').trim();
        return key;
    }

    function buildAsOfSeries(rowsSorted, axisDates, selectorFn) {
   const out = new Array(axisDates.length).fill(null);
        if (!rowsSorted || !rowsSorted.length) return out;
    let j = 0; let cur = null;
  for (let i = 0; i < axisDates.length; i++) {
  const d = axisDates[i];
            while (j < rowsSorted.length && rowsSorted[j].ts <= d) { cur = rowsSorted[j]; j++; }
         out[i] = cur ? selectorFn(cur) : null;
     }
     return out;
    }

    function processInflationIndex(priceRows, valRows, cutoff, categoryKey, selectedItems) {
        // Filter to range
        const filteredPrice = cutoff ? priceRows.filter(r => r.ts >= cutoff) : priceRows;
        const filteredVal   = cutoff ? valRows.filter(r => r.ts  >= cutoff) : valRows;

        // Build axis dates (union of price and val timestamps)
        const axisSet = new Set();
        filteredPrice.forEach(r => axisSet.add(+r.ts));
      filteredVal.forEach(r => axisSet.add(+r.ts));
        const axisDates = [...axisSet].sort((a, b) => a - b).map(ms => new Date(ms));

        if (!axisDates.length) {
    return { axisDates: [], indexValues: [], contributingCounts: [],
  totalWeightPerDay: [], top5ByWeightPerDay: [],
         missingCountByDay: [], missingNamesByDay: [],
          existingCategoryCount: null, medianFactorPerDay: [] };
        }

  const mainByItem = groupByItemNormalized(filteredPrice);
   const valByItem  = groupByItemNormalized(filteredVal);

      // Determine which items are in scope
     const metalsSet  = csvToNormalizedSet(INFLATION_LISTS.metalsCsv);
     const commonSet  = csvToNormalizedSet(INFLATION_LISTS.commonCsv);
        let includedSet  = null;

        if (categoryKey === 'metals')   includedSet = metalsSet;
     else if (categoryKey === 'common')  includedSet = commonSet;
        else if (categoryKey === 'selected') {
 includedSet = new Set((selectedItems || []).map(normalizeName).filter(Boolean));
     }

        // All candidate keys from price history
    const candidateKeys = [...new Set(filteredPrice.map(r => normalizeName(r.item)).filter(Boolean))];

        const existingCategoryKeys = includedSet ? (() => {
  const keys = [];
            includedSet.forEach(k => { if (mainByItem.has(k)) keys.push(k); });
  return keys;
        })() : null;

    // Per-item cache (avoids rebuilding as-of series multiple times)
   const perItemCache = new Map();
 function getPerItem(key) {
       if (perItemCache.has(key)) return perItemCache.get(key);
        const pRows = mainByItem.get(key) || [];
            const vRows = valByItem.get(key)  || [];
         const priceAsOf     = buildAsOfSeries(pRows, axisDates, r => r.value);
            const stockAsOf     = buildAsOfSeries(pRows, axisDates, r => r.stock);
        const valuationAsOf = buildAsOfSeries(vRows, axisDates, r => r.value);
            let baselinePrice = null;
        for (const p of priceAsOf) {
    if (p != null && isFinite(p) && p > 0) { baselinePrice = p; break; }
}
        const v = { priceAsOf, stockAsOf, valuationAsOf, baselinePrice };
   perItemCache.set(key, v);
return v;
        }

        const indexValues       = new Array(axisDates.length).fill(null);
        const contributingCounts = new Array(axisDates.length).fill(0);
        const totalWeightPerDay  = new Array(axisDates.length).fill(0);
        const top5ByWeightPerDay = new Array(axisDates.length).fill(null);
        const missingCountByDay  = new Array(axisDates.length).fill(null);
        const missingNamesByDay  = new Array(axisDates.length).fill(null);
        const medianFactorPerDay = new Array(axisDates.length).fill(null);

  const iterKeys = includedSet ? existingCategoryKeys : candidateKeys;

        for (let k = 0; k < axisDates.length; k++) {
            const pairs = [];

for (const key of iterKeys || []) {
                if (includedSet && !includedSet.has(key)) continue;
          const s = getPerItem(key);
       const baseline = s.baselinePrice;
     if (baseline == null || !isFinite(baseline) || baseline <= 0) continue;
            const price = s.priceAsOf[k];
                if (price == null || !isFinite(price) || price <= 0) continue;
     const factor = price / baseline;
   if (!isFinite(factor) || factor <= 0) continue;

        let stockVal = s.valuationAsOf[k];
           if (stockVal == null || !isFinite(stockVal) || stockVal <= 0) {
    const stockStacks = s.stockAsOf[k];
   if (stockStacks != null && isFinite(stockStacks) && stockStacks > 0)
stockVal = stockStacks * price;
       else stockVal = null;
            }
     if (stockVal == null || !isFinite(stockVal) || stockVal <= 0) continue;

      const w = stockVal / 1000;
      if (!isFinite(w) || w <= 0) continue;
          pairs.push({ x: factor, w, key });
        }

            if (!pairs.length) {
        indexValues[k] = null;
  top5ByWeightPerDay[k] = [];
         continue;
 }

            // Weighted mean
            const totalW = pairs.reduce((s, p) => s + p.w, 0);
            if (!isFinite(totalW) || totalW <= 0) { indexValues[k] = null; top5ByWeightPerDay[k] = []; continue; }

   const weightedSum = pairs.reduce((s, p) => s + p.x * p.w, 0);
   const mean = weightedSum / totalW;
            if (!isFinite(mean) || mean <= 0) { indexValues[k] = null; top5ByWeightPerDay[k] = []; continue; }

       indexValues[k]        = mean * 100;
            medianFactorPerDay[k] = mean;
     contributingCounts[k] = pairs.length;
 totalWeightPerDay[k]  = totalW;

            const top = pairs.slice().sort((a, b) => b.w - a.w).slice(0, 5).map(p => ({
    name:     pickDisplayName(p.key, mainByItem),
         weight:   p.w,
            sharePct: totalW > 0 ? (p.w / totalW) * 100 : 0
        }));
            top5ByWeightPerDay[k] = top;

      if (includedSet && Array.isArray(existingCategoryKeys)) {
        const present    = new Set(pairs.map(p => p.key));
                const missingKeys = existingCategoryKeys.filter(key => !present.has(key));
            missingCountByDay[k]  = missingKeys.length;
                missingNamesByDay[k]  = missingKeys.slice(0, 5).map(k2 => pickDisplayName(k2, mainByItem));
    }
    }

        return {
        axisDates,
      indexValues,
            contributingCounts,
            totalWeightPerDay,
            top5ByWeightPerDay,
   existingCategoryCount: existingCategoryKeys ? existingCategoryKeys.length : null,
 missingCountByDay,
            missingNamesByDay,
 medianFactorPerDay
        };
    }

    // ??? Chart rendering ??????????????????????????????????????????????????????
    async function renderInflationChart() {
        const canvasId  = 'bankInflationChart';
     const container = $('bankInflationBlock');
        const range   = ($('bankRangeSelect') || {}).value || 'all';
        const category  = ($('bankInflIndexSelect') || {}).value || 'median';

        // "selected" category with no items ? show message
        if (category === 'selected' && !_appliedItems.length) {
            BankCharts.destroy(canvasId);
   const ctx = document.getElementById(canvasId);
            if (ctx) {
      const parent = ctx.parentElement;
       let msg = parent.querySelector('.bank-infl-empty-msg');
          if (!msg) {
            msg = document.createElement('div');
   msg.className = 'bank-infl-empty-msg small';
        msg.style.cssText = 'padding:20px;text-align:center;color:#6b7280;';
       parent.appendChild(msg);
  }
        msg.textContent = 'No items selected — add items and click Apply, or choose a different category.';
              ctx.style.display = 'none';
 }
    return;
        }

        // Restore canvas visibility (might have been hidden by empty-state above)
 const canvasEl = document.getElementById(canvasId);
        if (canvasEl) {
            canvasEl.style.display = '';
      const msg = canvasEl.parentElement && canvasEl.parentElement.querySelector('.bank-infl-empty-msg');
       if (msg) msg.remove();
      }

        // Show loading indicator
        let loadingEl = container && container.querySelector('.bank-infl-loading');
        if (!loadingEl && container) {
            loadingEl = document.createElement('div');
            loadingEl.className = 'bank-infl-loading small';
            loadingEl.style.cssText = 'padding:8px 0;color:#6b7280;';
    loadingEl.textContent = 'Loading inflation data\u2026';
        const chartCtr = container.querySelector('.bank-chart-container');
            if (chartCtr) chartCtr.insertAdjacentElement('beforebegin', loadingEl);
        }

        let priceRows;
        try {
            priceRows = await fetchPriceHistory();
   } catch (e) {
    console.error('BankInflation: failed to fetch price history', e);
            if (loadingEl) loadingEl.textContent = 'Failed to load inflation data.';
            return;
        }

  if (loadingEl) loadingEl.remove();

    const valRows = BankData.cache.valuationHistory || [];
        const cutoff  = getCutoff(range);

        const result = processInflationIndex(priceRows, valRows, cutoff, category, _appliedItems);

        BankCharts.drawBankInflationChart(
   canvasId,
            result.axisDates,
            result.indexValues,
  result.contributingCounts,
            category,
    'all', // range filtering already applied in processInflationIndex
     {
    totalWeightPerDay: result.totalWeightPerDay,
      top5ByWeightPerDay:   result.top5ByWeightPerDay,
                missingCountByDay:    result.missingCountByDay,
     missingNamesByDay:    result.missingNamesByDay,
       existingCategoryCount: result.existingCategoryCount,
           medianFactorPerDay:   result.medianFactorPerDay
       }
     );
    }

    // ??? Chips ????????????????????????????????????????????????????????????????
    function renderChips() {
   const container = $('bankInflChips');
        if (!container) return;
        container.innerHTML = '';
        _stagedItems.forEach(item => {
       const color = itemColor(item);
            const chip = document.createElement('span');
    chip.className = 'chip';
 chip.title = item;
    chip.innerHTML =
           '<span class="chipColor" style="background:' + color + '"></span>' +
   '<span class="chipText" style="color:' + color + '">' + item + '</span>';
      const removeBtn = document.createElement('button');
   removeBtn.type = 'button';
  removeBtn.className = 'chipRemove';
      removeBtn.title = 'Remove';
     removeBtn.textContent = '\u00d7';
            removeBtn.addEventListener('click', () => {
       _stagedItems = _stagedItems.filter(x => x !== item);
     renderChips();
      });
 chip.appendChild(removeBtn);
            container.appendChild(chip);
        });
    }

    function addStagedItem(name) {
   const trimmed = String(name || '').trim();
        if (!trimmed) return;
    if (!_uniqueItems.includes(trimmed)) return; // unknown item
        if (_stagedItems.includes(trimmed)) return;
  if (_stagedItems.length >= MAX_ITEMS) return;
        _stagedItems.push(trimmed);
        renderChips();
    }

  function applyAndRender() {
        _appliedItems = [..._stagedItems];
   savePreset();
        renderInflationChart();
        // Also update the per-item velocity chart so it shows the new selection
        if (window.BankUI && typeof BankUI.renderVelocityItem === 'function') {
            BankUI.renderVelocityItem();
        }
    }

    // ??? Item selector wiring ?????????????????????????????????????????????????
    function wireItemSelector() {
const input   = $('bankInflItemInput');
const listEl  = $('bankInflItemList');
        const addBtn  = $('bankInflAddBtn');
     const applyBtn = $('bankInflApplyBtn');
        const clearBtn = $('bankInflClearBtn');
      const indexSel = $('bankInflIndexSelect');

      // Attach universal-dropdown autocomplete
        if (input && listEl && window.universalDropdown && typeof window.universalDropdown.attach === 'function') {
            _dropdownApi = window.universalDropdown.attach({
          inputEl:  input,
                listEl:   listEl,
    getItems: () => _uniqueItems.map(n => ({ name: n })),
  getLabel: it => String(it && it.name || ''),
 getExtraText: () => '',
  showProgress: false,
 onSelect: name => {
       addStagedItem(name);
input.value = '';
    try { input.focus(); } catch { }
  setTimeout(() => {
                try { input.dispatchEvent(new Event('input')); } catch { }
        }, 0);
     }
          });
        }

        if (addBtn) {
        addBtn.addEventListener('click', () => {
  if (input) { addStagedItem(input.value); input.value = ''; }
   });
        }

        if (input) {
            input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
            const hasActive = typeof input._dropIndex === 'number' && input._dropIndex >= 0;
         if (hasActive) return;
   e.preventDefault();
        addStagedItem(input.value);
      input.value = '';
      }
            });
   }

    if (applyBtn)  applyBtn.addEventListener('click', () => applyAndRender());
   if (clearBtn)  clearBtn.addEventListener('click', () => { _stagedItems = []; renderChips(); });
        if (indexSel)  indexSel.addEventListener('change', () => { savePreset(); renderInflationChart(); });
    }

    // ??? Init ?????????????????????????????????????????????????????????????????
    async function init() {
        if (_inited) return;
        _inited = true;

        // 1. Build item catalog from already-cached valuation data
     loadItemCatalog();

        // 2. Restore preset from localStorage
        const preset = loadPreset();
        if (preset) {
        if (Array.isArray(preset.appliedItems)) {
     // Validate against known items
       _appliedItems = preset.appliedItems.filter(it => _uniqueItems.includes(it));
      }
     _stagedItems = [..._appliedItems];

  const indexSel = $('bankInflIndexSelect');
       if (indexSel && preset.indexCategory) indexSel.value = preset.indexCategory;
   }

    // 3. Wire the item selector UI
        wireItemSelector();
        renderChips();

     // 4. Render the chart (will fetch price history on first call)
await renderInflationChart();
    }

    // ??? Re-render hook (called by BankUI on global range change) ?????????????
    async function onRangeChange() {
      if (!_inited) return;
        await renderInflationChart();
    }

    function isInited() { return _inited; }

    function getAppliedItems() { return _appliedItems.slice(); }

    return { init, onRangeChange, isInited, getAppliedItems };

})();

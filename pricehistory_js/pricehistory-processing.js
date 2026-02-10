// pricehistory-processing.js
window.PriceHistory = window.PriceHistory || {};
window.PriceHistory.Processing = (function () {
  const { CACHE } = window.PriceHistory.Data;
  const { computeCutoff, normalizeName, csvToNormalizedSet } = window.PriceHistory.Utils;
  const { DEBUG_INFLATION, INFLATION_LISTS } = window.PriceHistory.Config;

  function filterSortItem(dataset, item, cutoff) {
    return (dataset || [])
      .filter(r => r.item === item && r.ts && r.ts >= cutoff)
      .sort((a, b) => a.ts - b.ts);
  }

  // --- Single-item series (kept for parity / reuse) ---
  function processPriceSeries(item, rangeDays) {
    const cutoff = computeCutoff(rangeDays);
    const mainData = filterSortItem(CACHE.main, item, cutoff);
    return {
      labels: mainData.map(r => r.ts),
      prices: mainData.map(r => r.value)
    };
  }

  function processMiddleMetricSeries(item, rangeDays, metric) {
    const cutoff = computeCutoff(rangeDays);
    const mainData = filterSortItem(CACHE.main, item, cutoff);

    const labels = mainData.map(r => r.ts);
    const prices = mainData.map(r => r.value);

    let midLabels = labels;
    let midValues = [];
    let chartType = 'line';

    if (metric === 'stock') {
      midValues = mainData.map(r => r.stock);
    } else if (metric === 'change') {
      chartType = 'bar';
  midValues = prices.map((price, i) => {
    if (i === 0) return 0;
   return parseFloat((price - prices[i - 1]).toFixed(2));
      });
    } else if (metric === 'changePct') {
  chartType = 'bar';
midValues = prices.map((price, i) => {
        if (i === 0) return 0;
    const prev = prices[i - 1];
   if (prev === 0 || prev == null || price == null) return 0;
    const pct = ((price - prev) / prev) * 100;
   return parseFloat(pct.toFixed(2));
 });
    } else if (metric === 'valuation') {
      const valData = filterSortItem(CACHE.valuation, item, cutoff);
      midLabels = valData.map(r => r.ts);
 midValues = valData.map(r => r.value);
    } else if (metric === 'goal') {
      const goalData = filterSortItem(CACHE.goal, item, cutoff);
 midLabels = goalData.map(r => r.ts);
      midValues = goalData.map(r => r.value * 100);
    } else if (metric === 'targetStock') {
const tData = filterSortItem(CACHE.targetStock, item, cutoff);
 midLabels = tData.map(r => r.ts);
  midValues = tData.map(r => r.value);
    }

    return { midLabels, midValues, chartType };
  }

  // --- Multi-item support ---
  function buildUnionAxisDatesForItems(items, rangeDays, useValuationAxis) {
    const cutoff = computeCutoff(rangeDays);
    const set = new Set();

    const wanted = new Set((items || []).map(String));
    for (const r of CACHE.main || []) {
 if (!r.ts || r.ts < cutoff) continue;
 if (wanted.size && !wanted.has(r.item)) continue;
  set.add(+r.ts);
    }

    if (useValuationAxis) {
      for (const r of CACHE.valuation || []) {
   if (!r.ts || r.ts < cutoff) continue;
        if (wanted.size && !wanted.has(r.item)) continue;
        set.add(+r.ts);
  }
    }

    return [...set].sort((a, b) => a - b).map(ms => new Date(ms));
  }

  function rowsByDateMap(rows) {
    const m = new Map();
    for (const r of rows || []) {
      if (!r.ts) continue;
      m.set(+r.ts, r);
}
    return m;
  }

  // Gap-based alignment (no fill-forward)
  function alignSeriesToAxis(rowsSorted, axisDates, selectorFn) {
    const m = rowsByDateMap(rowsSorted);
    return axisDates.map(d => {
      const r = m.get(+d);
 return r ? selectorFn(r) : null;
    });
  }

  // As-of fill-forward (used only for weights / tooltip context)
  function buildAsOfSeries(rowsSorted, axisDates, selectorFn) {
    const out = new Array(axisDates.length).fill(null);
    if (!rowsSorted || rowsSorted.length === 0) return out;

    let j = 0;
    let cur = null;
    for (let i = 0; i < axisDates.length; i++) {
      const d = axisDates[i];
while (j < rowsSorted.length && rowsSorted[j].ts <= d) {
    cur = rowsSorted[j];
    j++;
      }
      out[i] = cur ? selectorFn(cur) : null;
    }
    return out;
  }

  function computeChangeSeries(values) {
    return (values || []).map((v, i) => {
 if (i === 0) return 0;
 const prev = values[i - 1];
      if (v == null || prev == null || !isFinite(v) || !isFinite(prev)) return null;
 return parseFloat((v - prev).toFixed(2));
    });
  }

  function computeChangePctSeries(values) {
    return (values || []).map((v, i) => {
      if (i === 0) return 0;
      const prev = values[i - 1];
      if (v == null || prev == null || !isFinite(v) || !isFinite(prev) || prev === 0) return null;
      const pct = ((v - prev) / prev) * 100;
      return parseFloat(pct.toFixed(2));
    });
  }

  function normalizeTo100(values) {
    const first = (values || []).find(v => v != null && isFinite(v));
    if (first == null || !isFinite(first) || first === 0) return values;
    return values.map(v => (v == null || !isFinite(v) ? null : (v / first) * 100));
  }

  function computeCombinedWeightedPrice(axisDates, items, perItemPriceGapSeries) {
    // Weight per item/day:
    // prefer valuation as-of, else fallback to (stock as-of * price as-of), else no weight.
    // Use PRICE at the axis date; if the price is null (gap), do not contribute to combined.

    const cutoffItems = new Set((items || []).map(String));

    // Prebuild as-of series for weights
    const valuationByItem = new Map();
    const stockByItem = new Map();
const priceAsOfByItem = new Map();

    for (const item of cutoffItems) {
      const priceRows = (CACHE.main || []).filter(r => r.item === item).sort((a, b) => a.ts - b.ts);
 const valuationRows = (CACHE.valuation || []).filter(r => r.item === item).sort((a, b) => a.ts - b.ts);

      valuationByItem.set(item, buildAsOfSeries(valuationRows, axisDates, r => r.value));
      stockByItem.set(item, buildAsOfSeries(priceRows, axisDates, r => r.stock));
      priceAsOfByItem.set(item, buildAsOfSeries(priceRows, axisDates, r => r.value));
    }

    const combined = new Array(axisDates.length).fill(null);
    for (let k = 0; k < axisDates.length; k++) {
 let wSum = 0;
let pWsum = 0;

 let atLeastOne = false;
 for (const item of cutoffItems) {
    const priceGap = perItemPriceGapSeries.get(item)?.[k];
   if (priceGap == null || !isFinite(priceGap) || priceGap <= 0) continue; // gap or invalid => don't contribute

        // weight preference: valuation, else stock*price(as-of)
    let w = valuationByItem.get(item)?.[k];
    if (w == null || !isFinite(w) || w <= 0) {
    const stock = stockByItem.get(item)?.[k];
 const priceAsOf = priceAsOfByItem.get(item)?.[k];
     if (stock != null && isFinite(stock) && stock > 0 && priceAsOf != null && isFinite(priceAsOf) && priceAsOf > 0) {
      w = stock * priceAsOf;
      } else {
       w = null;
      }
  }

        if (w == null || !isFinite(w) || w <= 0) continue;

  atLeastOne = true;
        wSum += w;
    pWsum += priceGap * w;
  }

if (!atLeastOne || !isFinite(wSum) || wSum <= 0) {
  combined[k] = null;
      } else {
  combined[k] = pWsum / wSum;
  }
    }

    return combined;
  }

  function processPriceSeriesMulti(items, rangeDays, opts) {
    const options = opts || {};
    const axisDates = buildUnionAxisDatesForItems(items, rangeDays, true);

    const perItemPrices = new Map();
    const perItemLastKnown = new Map(); // for tooltip “last known value/date”

    const cutoff = computeCutoff(rangeDays);

    for (const item of items || []) {
      const rows = (CACHE.main || [])
    .filter(r => r.item === item && r.ts && r.ts >= cutoff)
        .sort((a, b) => a.ts - b.ts);

      const pricesGap = alignSeriesToAxis(rows, axisDates, r => r.value);
      perItemPrices.set(item, pricesGap);

      // last-known series for tooltip context
 const lastVal = buildAsOfSeries(rows, axisDates, r => ({ v: r.value, ts: r.ts }));
 perItemLastKnown.set(item, lastVal);
    }

    const combined = computeCombinedWeightedPrice(axisDates, items, perItemPrices);
    const combinedOut = options.normalizeCombinedTo100 ? normalizeTo100(combined) : combined;

    return {
  axisDates,
      perItemPrices,
      combined: combinedOut,
      perItemLastKnown
    };
  }

  function processMiddleMetricSeriesMulti(items, rangeDays, metric) {
    const cutoff = computeCutoff(rangeDays);

    // Axis based on underlying data source for the metric.
    // For stock/change/changePct: main axis
    // For valuation/goal/targetStock: use respective axis but keep union across items
    const usesVal = metric === 'valuation';
    const usesGoal = metric === 'goal';
    const usesTarget = metric === 'targetStock';

    const axisDates = (() => {
      if (usesVal) return buildUnionAxisDatesForItems(items, rangeDays, true);
      if (usesGoal) {
   const set = new Set();
        for (const r of CACHE.goal || []) {
    if (!r.ts || r.ts < cutoff) continue;
      if (items && items.length && !items.includes(r.item)) continue;
      set.add(+r.ts);
  }
   return [...set].sort((a, b) => a - b).map(ms => new Date(ms));
  }
if (usesTarget) {
   const set = new Set();
        for (const r of CACHE.targetStock || []) {
      if (!r.ts || r.ts < cutoff) continue;
     if (items && items.length && !items.includes(r.item)) continue;
     set.add(+r.ts);
    }
        return [...set].sort((a, b) => a - b).map(ms => new Date(ms));
      }
      return buildUnionAxisDatesForItems(items, rangeDays, false);
    })();

    const perItemSeries = new Map();
const perItemLastKnown = new Map();

    for (const item of items || []) {
      if (metric === 'stock') {
        const rows = (CACHE.main || [])
    .filter(r => r.item === item && r.ts && r.ts >= cutoff)
      .sort((a, b) => a.ts - b.ts);
  perItemSeries.set(item, alignSeriesToAxis(rows, axisDates, r => r.stock));
   perItemLastKnown.set(item, buildAsOfSeries(rows, axisDates, r => ({ v: r.stock, ts: r.ts })));
      } else if (metric === 'valuation') {
   const rows = (CACHE.valuation || [])
     .filter(r => r.item === item && r.ts && r.ts >= cutoff)
.sort((a, b) => a.ts - b.ts);
        perItemSeries.set(item, alignSeriesToAxis(rows, axisDates, r => r.value));
    perItemLastKnown.set(item, buildAsOfSeries(rows, axisDates, r => ({ v: r.value, ts: r.ts })));
  } else if (metric === 'targetStock') {
    const rows = (CACHE.targetStock || [])
     .filter(r => r.item === item && r.ts && r.ts >= cutoff)
.sort((a, b) => a.ts - b.ts);
        perItemSeries.set(item, alignSeriesToAxis(rows, axisDates, r => r.value));
    perItemLastKnown.set(item, buildAsOfSeries(rows, axisDates, r => ({ v: r.value, ts: r.ts })));
  } else if (metric === 'goal') {
  const rows = (CACHE.goal || [])
     .filter(r => r.item === item && r.ts && r.ts >= cutoff)
      .sort((a, b) => a.ts - b.ts);
        perItemSeries.set(item, alignSeriesToAxis(rows, axisDates, r => (r.value != null && isFinite(r.value) ? r.value * 100 : null)));
  perItemLastKnown.set(item, buildAsOfSeries(rows, axisDates, r => ({ v: r.value != null && isFinite(r.value) ? r.value * 100 : null, ts: r.ts })));
  } else {
   // change/changePct derived from per-item price gap series
  const priceRows = (CACHE.main || [])
      .filter(r => r.item === item && r.ts && r.ts >= cutoff)
     .sort((a, b) => a.ts - b.ts);
    const prices = alignSeriesToAxis(priceRows, axisDates, r => r.value);
   const derived = metric === 'change' ? computeChangeSeries(prices) : computeChangePctSeries(prices);
        perItemSeries.set(item, derived);
   perItemLastKnown.set(item, buildAsOfSeries(priceRows, axisDates, r => ({ v: r.value, ts: r.ts })));
      }
    }

    // combined sum only meaningful for stock/valuation/targetStock
    const canCombineSum = metric === 'stock' || metric === 'valuation' || metric === 'targetStock';
    const combinedSum = canCombineSum
      ? axisDates.map((_, i) => {
 let sum = 0;
let any = false;
    for (const item of items || []) {
  const v = perItemSeries.get(item)?.[i];
   if (v == null || !isFinite(v)) continue;
  any = true;
 sum += v;
      }
      return any ? sum : null;
   })
  : null;

return { axisDates, perItemSeries, perItemLastKnown, combinedSum, canCombineSum };
  }

  // --- Inflation logic ---
  function groupByItemNormalized(rows) {
    const m = new Map();
    for (const r of rows || []) {
 const key = normalizeName(r.item);
      if (!key) continue;
  if (!m.has(key)) m.set(key, []);
      m.get(key).push(r);
    }
    for (const arr of m.values()) {
 arr.sort((a, b) => a.ts - b.ts);
    }
    return m;
  }

  function pickDisplayNameForKey(key, mainByItem) {
    const rows = mainByItem.get(key);
if (rows && rows.length) return String(rows[0].item || '').trim();
    return key;
  }

  function weightedMeanWithPivot(pairs) {
    const valid = (pairs || []).filter(p => p && isFinite(p.x) && isFinite(p.w) && p.w >0);
    if (!valid.length) return { mean: null, pivot: null, totalW:0 };

    const totalW = valid.reduce((s, p) => s + p.w,0);
    if (!isFinite(totalW) || totalW <=0) return { mean: null, pivot: null, totalW:0 };

    const weightedSum = valid.reduce((s, p) => s + p.x * p.w,0);
    const mean = weightedSum / totalW;
    if (!isFinite(mean) || mean <=0) return { mean: null, pivot: null, totalW };

    const pivot = valid.slice().sort((a, b) => b.w - a.w)[0] || null;
    return { mean, pivot, totalW };
  }

  function getInflationCategoryKeys(categoryKey, appliedItems) {
    const metalsSet = csvToNormalizedSet(INFLATION_LISTS.metalsCsv);
    const commonSet = csvToNormalizedSet(INFLATION_LISTS.commonCsv);

    if (categoryKey === 'metals') return { includedSet: metalsSet, isSelection: false };
    if (categoryKey === 'common') return { includedSet: commonSet, isSelection: false };
    if (categoryKey === 'selected') {
 const sel = new Set((appliedItems || []).map(normalizeName).filter(Boolean));
 return { includedSet: sel, isSelection: true };
 }
    return { includedSet: null, isSelection: false };
  }

  // Expose exact item lists for help UI
  function getInflationCategoryItemList(categoryKey, appliedItems) {
    const metals = (INFLATION_LISTS.metalsCsv || '').split(',').map(s => s.trim()).filter(Boolean);
    const common = (INFLATION_LISTS.commonCsv || '').split(',').map(s => s.trim()).filter(Boolean);

    if (categoryKey === 'metals') return metals;
    if (categoryKey === 'common') return common;
    if (categoryKey === 'selected') return (appliedItems || []).slice();
    return null;
  }

  function processInflationIndexSeries(rangeDays, categoryKey, debugInfo) {
    const cutoff = computeCutoff(rangeDays);

    const mainRows = (CACHE.main || []).filter(r => r.ts && r.ts >= cutoff);
    const valRows = (CACHE.valuation || []).filter(r => r.ts && r.ts >= cutoff);

    const axisMsSet = new Set();
    for (const r of mainRows) axisMsSet.add(+r.ts);
    for (const r of valRows) axisMsSet.add(+r.ts);
    const axisDates = [...axisMsSet].sort((a, b) => a - b).map(ms => new Date(ms));

    const mainByItem = groupByItemNormalized(mainRows);
    const valByItem = groupByItemNormalized(valRows);

    const { includedSet } = getInflationCategoryKeys(categoryKey, debugInfo?.appliedItems);

    const candidateKeys = [...new Set(mainRows.map(r => normalizeName(r.item)).filter(Boolean))];

    const existingCategoryKeys = (() => {
      if (!includedSet) return null;
  const keys = [];
      includedSet.forEach(k => {
    if (mainByItem.has(k)) keys.push(k);
  });
return keys;
    })();

    const indexValues = new Array(axisDates.length).fill(null);
    const contributingCounts = new Array(axisDates.length).fill(0);
    const totalWeightPerDay = new Array(axisDates.length).fill(0);
    const top5ByWeightPerDay = new Array(axisDates.length).fill(null);
    const missingCountByDay = new Array(axisDates.length).fill(null);
    const missingNamesByDay = new Array(axisDates.length).fill(null);
    const medianFactorPerDay = new Array(axisDates.length).fill(null);

    const perItemCache = new Map();

    function getPerItemSeries(key) {
if (perItemCache.has(key)) return perItemCache.get(key);

  const priceRows = mainByItem.get(key) || [];
      const valuationRows = valByItem.get(key) || [];

 const priceAsOf = buildAsOfSeries(priceRows, axisDates, r => r.value);
      const stockAsOf = buildAsOfSeries(priceRows, axisDates, r => r.stock);
      const valuationAsOf = buildAsOfSeries(valuationRows, axisDates, r => r.value);

      let baselinePrice = null;
      for (const p of priceAsOf) {
   if (p != null && isFinite(p) && p >0) {
    baselinePrice = p;
    break;
        }
      }

      const v = { priceAsOf, stockAsOf, valuationAsOf, baselinePrice };
  perItemCache.set(key, v);
 return v;
    }

    for (let k =0; k < axisDates.length; k++) {
 const pairs = [];

      const iterKeys = includedSet ? existingCategoryKeys : candidateKeys;
      for (const key of iterKeys || []) {
    if (includedSet && !includedSet.has(key)) continue;

   const s = getPerItemSeries(key);

   const baseline = s.baselinePrice;
    if (baseline == null || !isFinite(baseline) || baseline <=0) continue;

  const price = s.priceAsOf[k];
   if (price == null || !isFinite(price) || price <=0) continue;

   const factor = price / baseline;
    if (!isFinite(factor) || factor <=0) continue;

    let stockValueBT = s.valuationAsOf[k];
    let usedFallback = false;
    if (stockValueBT == null || !isFinite(stockValueBT) || stockValueBT <=0) {
      const stockStacks = s.stockAsOf[k];
      if (stockStacks != null && isFinite(stockStacks) && stockStacks >0) {
 stockValueBT = stockStacks * price;
 usedFallback = true;
      } else {
       stockValueBT = null;
      }
    }

    if (stockValueBT == null || !isFinite(stockValueBT) || stockValueBT <=0) continue;

   const w = stockValueBT /1000;
    if (!isFinite(w) || w <=0) continue;

   pairs.push({ x: factor, w, key, usedFallback });
      }

      const meanInfo = weightedMeanWithPivot(pairs);
      const mean = meanInfo.mean;

  if (mean == null) {
   indexValues[k] = null;
   medianFactorPerDay[k] = null;
    contributingCounts[k] =0;
   totalWeightPerDay[k] =0;
  top5ByWeightPerDay[k] = [];
  } else {
   indexValues[k] = mean *100;
  medianFactorPerDay[k] = mean;
   contributingCounts[k] = pairs.length;

  const totalWDay = pairs.reduce((s, p) => s + p.w,0);
        totalWeightPerDay[k] = isFinite(totalWDay) ? totalWDay :0;

        const top = pairs
     .slice()
    .sort((a, b) => b.w - a.w)
     .slice(0,5)
      .map(p => {
 const name = pickDisplayNameForKey(p.key, mainByItem);
        const sharePct = totalWDay >0 ? (p.w / totalWDay) *100 :0;
        return { name, weight: p.w, sharePct, usedFallback: !!p.usedFallback };
     });

        top5ByWeightPerDay[k] = top;
  }

      if (includedSet && Array.isArray(existingCategoryKeys)) {
    const present = new Set(pairs.map(p => p.key));
    const missingKeys = existingCategoryKeys.filter(key => !present.has(key));

  missingCountByDay[k] = missingKeys.length;
    missingNamesByDay[k] = missingKeys.slice(0,5).map(k2 => pickDisplayNameForKey(k2, mainByItem));
      } else {
   missingCountByDay[k] = null;
        missingNamesByDay[k] = null;
 }
    }

    if (DEBUG_INFLATION && debugInfo && (categoryKey === 'common' || categoryKey === 'metals' || categoryKey === 'selected')) {
  try {
    const counts = contributingCounts.slice();
        const min = counts.length ? Math.min(...counts) :0;
  const max = counts.length ? Math.max(...counts) :0;
  const avg = counts.length ? counts.reduce((s, n) => s + n,0) / counts.length :0;

    console.log('[Inflation DEBUG]', {
     sheet: debugInfo.sheet,
range: debugInfo.range,
 category: categoryKey,
     axisDays: axisDates.length,
      contributors: { min, avg, max },
      daysWithNoPairs: counts.filter(x => x ===0).length,
 existingCategoryDenominator: existingCategoryKeys ? existingCategoryKeys.length : null
    });
      } catch (e) {
    console.warn('Inflation DEBUG failed', e);
      }
    }

    return {
      axisDates,
      indexValues,
  contributingCounts,
      totalWeightPerDay,
      top5ByWeightPerDay,
      missingCountByDay,
      missingNamesByDay,
      existingCategoryCount: existingCategoryKeys ? existingCategoryKeys.length : null,
      medianFactorPerDay
    };
  }

  return {
    processPriceSeries,
    processMiddleMetricSeries,
    processPriceSeriesMulti,
    processMiddleMetricSeriesMulti,
    processInflationIndexSeries,
    getInflationCategoryItemList
  };
})();

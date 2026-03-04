// pricehistory-data.js
window.PriceHistory = window.PriceHistory || {};
window.PriceHistory.Data = (function () {
  const { csvUrlFor, parseLocalNum, parseDateStrict } = window.PriceHistory.Utils;
  const { HISTORY_SHEETS } = window.PriceHistory.Config;

  const CACHE = { main: [], valuation: [], goal: [], targetStock: [], velocity: {} };

  function resolveHistorySource_(sheetKey) {
    const src = HISTORY_SHEETS && HISTORY_SHEETS[sheetKey];
    if (!src || !src.spreadsheetId || !src.tabName) {
      throw new Error(`Missing HISTORY_SHEETS mapping for ${sheetKey}`);
    }
    return src;
  }

  async function fetchCSV(sheetKey) {
    try {
      const src = resolveHistorySource_(sheetKey);
      const res = await fetch(csvUrlFor(src.spreadsheetId, src.tabName));
      if (!res.ok) throw new Error('Fetch failed');
      const text = await res.text();
      const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim() !== '');
      if (lines.length <= 1) return [];

      return lines
        .slice(1)
        .map(line => {
          const parts = line
            .split(/,(?=(?:(?:[^\"]*\"){2})*[^\"]*$)/)
            .map(s => s.replace(/^\"|\"$/g, '').trim());

          const dateStr = parts[0];
          const item = parts[1];

          const valCol = parseLocalNum(parts[2]);
          const stockCol = parseLocalNum(parts[3]);
          const ts = parseDateStrict(dateStr);

          // 3-column sheets: Timestamp, Item, Value
          if (sheetKey.includes('Valuation') || sheetKey.includes('Goal') || sheetKey.includes('TargetStock')) {
            return { ts, item, value: valCol };
          }

          // 4-column sheets: Timestamp, Item, Price, Stock
          return { ts, item, value: valCol, stock: stockCol };
        })
        .filter(r => r.item && r.ts);
    } catch (e) {
      console.error('Error loading sheet:', sheetKey, e);
      return [];
    }
  }

  function parseCsvLineParts_(line) {
    return line
      .split(/,(?=(?:(?:[^\"]*\"){2})*[^\"]*$)/)
      .map(s => s.replace(/^\"|\"$/g, '').trim());
  }

  async function fetchVelocityCSV(sheetKey) {
    try {
      const src = resolveHistorySource_(sheetKey);
      const res = await fetch(csvUrlFor(src.spreadsheetId, src.tabName));
      if (!res.ok) throw new Error('Fetch failed');

      const text = await res.text();
      const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim() !== '');
      if (lines.length <= 1) return [];

      return lines
        .slice(1)
        .map(line => {
          const parts = parseCsvLineParts_(line);
          const ts = parseDateStrict(parts[0]);
          const item = parts[1];

          // Most velocity sheets are 4 columns (Timestamp, Item, A, B)
          const a = parseLocalNum(parts[2]);
          const b = parseLocalNum(parts[3]);

          // OcmVolume is 3 columns (Timestamp, Item, A)
          if (sheetKey === 'OcmVolume') {
            return { ts, item, a: isFinite(a) ? a : 0 };
          }

          return { ts, item, a: isFinite(a) ? a : 0, b: isFinite(b) ? b : 0 };
        })
        .filter(r => r.item && r.ts);
    } catch (e) {
      console.error('Error loading velocity sheet:', sheetKey, e);
      return [];
    }
  }

  async function loadVelocitySheet(sheetKey) {
    if (CACHE.velocity && Array.isArray(CACHE.velocity[sheetKey])) return CACHE.velocity[sheetKey];
    const rows = await fetchVelocityCSV(sheetKey);
    CACHE.velocity[sheetKey] = rows;
    return rows;
  }

  async function loadAllSheets(mainSheetKey) {
    const [main, val, goal, targetStock] = await Promise.all([
      fetchCSV(mainSheetKey),
      fetchCSV('ValuationHistory'),
      fetchCSV('GoalHistory'),
      fetchCSV('TargetStockHistory')
    ]);

    CACHE.main = main;
    CACHE.valuation = val;
    CACHE.goal = goal;
    CACHE.targetStock = targetStock;

    return { main, valuation: val, goal, targetStock };
  }

  function buildUniqueItems(mainRows) {
    return [...new Set((mainRows || []).map(r => r.item))].sort();
  }

  return {
    CACHE,
    fetchCSV,
    fetchVelocityCSV,
    loadVelocitySheet,
    loadAllSheets,
    buildUniqueItems
  };
})();

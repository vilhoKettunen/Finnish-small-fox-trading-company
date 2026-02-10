// pricehistory-data.js
window.PriceHistory = window.PriceHistory || {};
window.PriceHistory.Data = (function () {
  const { csvUrl, parseLocalNum, parseDateStrict } = window.PriceHistory.Utils;

  const CACHE = { main: [], valuation: [], goal: [], targetStock: [] };

  async function fetchCSV(sheetName) {
    try {
      const res = await fetch(csvUrl(sheetName));
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

      if (sheetName.includes('Valuation') || sheetName.includes('Goal')) {
   return { ts, item, value: valCol };
     }
     return { ts, item, value: valCol, stock: stockCol };
        })
   .filter(r => r.item && r.ts);
    } catch (e) {
      console.error('Error loading sheet:', sheetName, e);
      return [];
    }
  }

  async function loadAllSheets(mainSheetName) {
    const [main, val, goal, targetStock] = await Promise.all([
      fetchCSV(mainSheetName),
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
    loadAllSheets,
    buildUniqueItems
  };
})();

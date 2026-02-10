// pricehistory-utils.js
window.PriceHistory = window.PriceHistory || {};
window.PriceHistory.Utils = (function () {
  const { SPREADSHEET_ID, USER_LOCALE, ITEM_COLOR_PALETTE } = window.PriceHistory.Config;

  function csvUrl(sheet) {
return `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}`;
  }

  function normalizeName(name) {
    return String(name || '')
 .trim()
 .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  function csvToNormalizedSet(csv) {
    const out = new Set();
    String(csv || '')
 .split(',')
      .map(s => s.trim())
 .filter(Boolean)
  .forEach(s => out.add(normalizeName(s)));
    return out;
  }

  function parseLocalNum(str) {
    if (!str) return null;
    let clean = str.toString().trim().replace(/[^\d.,\-]/g, '');
    if (!clean) return null;

    if (clean.includes(',') && clean.includes('.')) {
      const lastComma = clean.lastIndexOf(',');
      const lastDot = clean.lastIndexOf('.');
      if (lastComma > lastDot) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else {
    clean = clean.replace(/,/g, '');
      }
    } else if (clean.includes(',')) {
  clean = clean.replace(',', '.');
    }

    const result = parseFloat(clean);
    return isNaN(result) ? null : result;
  }

  function parseDateStrict(str) {
    if (!str) return null;
    const s = str.trim();

    const parts = s.split(/[\/\-\.]/);
    if (parts.length === 3) {
 const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      let year = parseInt(parts[2], 10);
  if (year < 100) year += 2000;
      return new Date(year, month - 1, day);
    }

    const fallback = new Date(s);
    return isNaN(fallback.getTime()) ? null : fallback;
  }

  function computeCutoff(rangeDays) {
    const now = new Date();
    return rangeDays === 'all' ? new Date(0) : new Date(now - rangeDays * 24 * 60 * 60 * 1000);
  }

  const dateFmt = (d) => (d ? d.toLocaleDateString(USER_LOCALE, { day: 'numeric', month: 'short' }) : '');

  function hashStringToInt(s) {
    let h = 0;
    const str = String(s || '');
for (let i = 0; i < str.length; i++) {
  h = (h * 31 + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }

  // Deterministic base color for an item name.
  function baseItemColor(itemName) {
    const idx = hashStringToInt(normalizeName(itemName)) % ITEM_COLOR_PALETTE.length;
    return ITEM_COLOR_PALETTE[idx];
  }

  // For a given selection, assign unique colors without reuse.
  // If two items hash to the same palette entry, the later item is assigned the next free color.
  function assignUniqueColors(items) {
    const out = new Map();
    const used = new Set();
    const palette = ITEM_COLOR_PALETTE.slice();

    for (const item of items || []) {
      const desired = baseItemColor(item);
      let chosen = desired;

      if (used.has(chosen)) {
        // pick next free, stable by hashing start position
        const startIdx = palette.indexOf(desired);
        let found = null;
        for (let step = 1; step <= palette.length; step++) {
          const c = palette[(startIdx + step) % palette.length];
          if (!used.has(c)) {
 found = c;
 break;
 }
        }
        chosen = found || desired;
      }

      used.add(chosen);
      out.set(item, chosen);
    }

    return out;
  }

  function itemColor(itemName, colorMap) {
    if (colorMap && colorMap instanceof Map) {
      const c = colorMap.get(itemName);
      if (c) return c;
    }
    return baseItemColor(itemName);
  }

  function hexToRgba(hex, alpha) {
    const h = String(hex || '').replace('#', '');
    if (h.length !== 6) return `rgba(0,0,0,${alpha})`;
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function clamp01(x) {
    if (!isFinite(x)) return 0;
return Math.max(0, Math.min(1, x));
  }

  return {
csvUrl,
    normalizeName,
    csvToNormalizedSet,
    parseLocalNum,
    parseDateStrict,
    computeCutoff,
dateFmt,
    baseItemColor,
assignUniqueColors,
    itemColor,
hexToRgba,
    clamp01
  };
})();

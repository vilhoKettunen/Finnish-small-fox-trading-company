// bank_js/bank-data.js
window.BankData = (function () {
  'use strict';

  const cache = {};

  // ??? GViz CSV helpers ?????????????????????????????????????????????????????

  function csvUrlFor(spreadsheetId, tabName) {
    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
  }

  // Parse a number from a Google Sheets CSV cell.
  // Google Sheets exports numbers in the spreadsheet's locale, which may use
  // comma as the DECIMAL separator (e.g. "0,5" = 0.5) and period or space as
  // the thousands separator (e.g. "1.234,56" or "1 234,56").
  // Strategy:
  // 1. If BOTH comma and period are present, the one that appears last is the
  //      decimal separator (e.g. "1.234,56" ? decimal=comma; "1,234.56" ? decimal=period).
  //   2. If only comma is present, treat it as the decimal separator.
  //   3. If only period is present (or neither), treat period as decimal (standard).
  function parseLocalNum(s) {
  if (s == null || s === '') return NaN;
    let str = String(s).trim();

    // Strip any surrounding quotes
    str = str.replace(/^"|"$/g, '');
    if (str === '' || str === '-') return NaN;

    const lastComma  = str.lastIndexOf(',');
    const lastPeriod = str.lastIndexOf('.');

    if (lastComma > -1 && lastPeriod > -1) {
      // Both separators present — whichever is last is the decimal separator
    if (lastComma > lastPeriod) {
  // e.g. "1.234,56" — period = thousands, comma = decimal
  str = str.replace(/\./g, '').replace(',', '.');
      } else {
      // e.g. "1,234.56" — comma = thousands, period = decimal
        str = str.replace(/,/g, '');
 }
    } else if (lastComma > -1 && lastPeriod === -1) {
      // Only comma present — treat as decimal separator (European format)
      // But if it looks like a thousands separator (e.g. "1,234" with 3 digits after)
      // we still treat it as decimal to be safe; large integers without decimals
 // are not normally stored with a thousands-comma in raw sheet exports.
      str = str.replace(',', '.');
    }
    // else: only period or neither — already in standard form

    // Strip any remaining non-numeric chars (spaces, currency symbols, etc.)
    // but preserve leading minus and the decimal point we just normalised.
    str = str.replace(/[^0-9.\-]/g, '');

    const n = parseFloat(str);
    return isNaN(n) ? NaN : n;
  }

  // Parse a date string coming from Google Sheets GViz CSV export.
  // Google Sheets GViz always exports dates in US locale as M/D/YYYY (no zero-padding).
  // e.g. "1/5/2025" = January 5 2025  (NOT 1st of May).
  // We also accept ISO 8601 (YYYY-MM-DD) which is unambiguous.
  function parseDateStr(s) {
    if (!s) return null;
    const str = String(s).trim().replace(/^"|"$/g, '');
    if (!str) return null;

    // 1. ISO date: YYYY-MM-DD (possibly with time)
    const isoM = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoM) return new Date(Date.UTC(+isoM[1], +isoM[2] - 1, +isoM[3]));

    // 2. Google Sheets GViz export: M/D/YYYY or M/D/YYYY H:MM:SS
    //    Always US locale from the GViz endpoint regardless of sheet locale.
    const usM = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (usM) {
      const month = +usM[1]; // 1-based month  (US format: M first)
      const day   = +usM[2];
      const year  = +usM[3];
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return new Date(Date.UTC(year, month - 1, day));
      }
    }

    // 3. DD-MM-YYYY or DD.MM.YYYY fallback
    const euM = str.match(/^(\d{1,2})[-.](\d{1,2})[-.](\d{4})/);
    if (euM) {
      return new Date(Date.UTC(+euM[3], +euM[2] - 1, +euM[1]));
    }

    return null;
  }

  // Split a CSV line respecting quoted fields that may contain commas.
  // After splitting we strip surrounding double-quotes and trim whitespace.
  function parseCsvLine(line) {
    return line
 .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
      .map(s => s.replace(/^"|"$/g, '').trim());
  }

  async function fetchRawCsv(spreadsheetId, tabName) {
    const res = await fetch(csvUrlFor(spreadsheetId, tabName));
    if (!res.ok) throw new Error(`CSV fetch failed for sheet ${tabName}: ${res.status}`);
    const text = await res.text();
    return text.replace(/\r/g, '').split('\n').filter(l => l.trim() !== '');
  }

  // ??? Typed sheet fetchers ?????????????????????????????????????????????????

  // Chart 1: EW in Circulation ? [{ts, totalEwInCirculation}]
  async function fetchEwCirculation() {
    if (cache.ewCirculation) return cache.ewCirculation;
    const cfg = BankConfig.SHEETS.EwInCirculation;
    const lines = await fetchRawCsv(cfg.spreadsheetId, cfg.tabName);
    const rows = lines.slice(1).map(line => {
 const p = parseCsvLine(line);
      return { ts: parseDateStr(p[0]), totalEwInCirculation: parseLocalNum(p[1]) };
    }).filter(r => r.ts);
    cache.ewCirculation = rows;
    return rows;
  }

  // Chart 2 (destruction): EW Destroyed History ? [{ts, totalEwDestroyed, ewBuyTotal, ocmFeesTotal}]
  async function fetchEwDestroyed() {
  if (cache.ewDestroyed) return cache.ewDestroyed;
    const cfg = BankConfig.SHEETS.EwDestroyedHistory;
    const lines = await fetchRawCsv(cfg.spreadsheetId, cfg.tabName);
    const rows = lines.slice(1).map(line => {
      const p = parseCsvLine(line);
      return {
     ts:     parseDateStr(p[0]),
      totalEwDestroyed: parseLocalNum(p[1]),
      ewBuyTotal:       parseLocalNum(p[2]),
 ocmFeesTotal:     parseLocalNum(p[3])
      };
    }).filter(r => r.ts);
    cache.ewDestroyed = rows;
    return rows;
  }

  // Charts 3 & 4 & 5: ValuationHistory ? [{ts, item, valuation, totalValuation}]
  async function fetchValuationHistory() {
    if (cache.valuationHistory) return cache.valuationHistory;
    const cfg = BankConfig.SHEETS.ValuationHistory;
    const lines = await fetchRawCsv(cfg.spreadsheetId, cfg.tabName);
    // Columns: Timestamp, Item, Valuation, TotalValuation
    const rows = lines.slice(1).map(line => {
      const p = parseCsvLine(line);
      return {
        ts:             parseDateStr(p[0]),
        item:           p[1],
     valuation:      parseLocalNum(p[2]),
        totalValuation: parseLocalNum(p[3])
      };
    }).filter(r => r.ts && r.item);
    cache.valuationHistory = rows;
  return rows;
  }

  // Chart 2 (issuance): EwVelocity ? [{ts, item, ewBuyTotal, ewSellTotal}]
  async function fetchEwVelocity() {
  if (cache.ewVelocity) return cache.ewVelocity;
    const cfg = BankConfig.SHEETS.EwVelocity;
    const lines = await fetchRawCsv(cfg.spreadsheetId, cfg.tabName);
    // Columns: Timestamp, Item, ewBuyTotal, ewSellTotal
    const rows = lines.slice(1).map(line => {
      const p = parseCsvLine(line);
      return {
     ts:        parseDateStr(p[0]),
   item:        p[1],
  ewBuyTotal:  parseLocalNum(p[2]),
        ewSellTotal: parseLocalNum(p[3])
      };
    }).filter(r => r.ts && r.item);
    cache.ewVelocity = rows;
    return rows;
  }

  // Chart 6: Wealth Distribution ? [{ts, top1, next9, next20, bot70, totalEW, N}]
  async function fetchWealthDist() {
    if (cache.wealthDist) return cache.wealthDist;
    const cfg = BankConfig.SHEETS.WealthDistribution;
    const lines = await fetchRawCsv(cfg.spreadsheetId, cfg.tabName);
    // Columns: Timestamp, Top1Pct, Next9Pct, Next20Pct, Bottom70Pct, TotalEW, PlayerCount
    const rows = lines.slice(1).map(line => {
      const p = parseCsvLine(line);
      return {
        ts:    parseDateStr(p[0]),
        top1:  parseLocalNum(p[1]),
        next9:   parseLocalNum(p[2]),
        next20:  parseLocalNum(p[3]),
        bot70:   parseLocalNum(p[4]),
        totalEW: parseLocalNum(p[5]),
     N:    parseLocalNum(p[6])
      };
    }).filter(r => r.ts);
cache.wealthDist = rows;
    return rows;
  }

  // Section 7: generic velocity sheet fetch
  async function fetchVelocitySheet(sheetKey) {
    if (cache['vel_' + sheetKey]) return cache['vel_' + sheetKey];
    const cfg = BankConfig.SHEETS[sheetKey];
    if (!cfg) throw new Error('Unknown velocity sheetKey: ' + sheetKey);
    const lines = await fetchRawCsv(cfg.spreadsheetId, cfg.tabName);
    const rows = lines.slice(1).map(line => {
      const p = parseCsvLine(line);
      const ts   = parseDateStr(p[0]);
      const item = p[1];
      const a    = parseLocalNum(p[2]);
      const b    = parseLocalNum(p[3]);
      if (sheetKey === 'OcmVolume') return { ts, item, a: isFinite(a) ? a : 0 };
      return { ts, item, a: isFinite(a) ? a : 0, b: isFinite(b) ? b : 0 };
    }).filter(r => r.ts && r.item);
    cache['vel_' + sheetKey] = rows;
    return rows;
  }

  // ??? Backend API fetchers (through api-client.js) ?????????????????????????

async function apiGetInfraInvestments() {
    const url = `${window.WEB_APP_URL}?action=getInfraInvestments`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('getInfraInvestments fetch failed: ' + res.status);
    return res.json();
  }

  async function apiGetInfraInvestmentDetail(investmentId) {
    const url = `${window.WEB_APP_URL}?action=getInfraInvestmentDetail&investmentId=${encodeURIComponent(investmentId)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('getInfraInvestmentDetail fetch failed: ' + res.status);
  return res.json();
  }

  return {
    cache,
    fetchEwCirculation,
    fetchEwDestroyed,
    fetchValuationHistory,
    fetchEwVelocity,
    fetchVelocitySheet,
    fetchWealthDist,
    apiGetInfraInvestments,
    apiGetInfraInvestmentDetail
  };
})();

// bank_js/bank-data.js
window.BankData = (function () {
  'use strict';

  const cache = {};

  // ??? GViz CSV helpers ?????????????????????????????????????????????????????

  function csvUrlFor(spreadsheetId, tabName) {
    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
  }

  function parseLocalNum(s) {
    if (s == null || s === '') return NaN;
    const cleaned = String(s).replace(/[^0-9.\-]/g, '');
    const n = parseFloat(cleaned);
    return isNaN(n) ? NaN : n;
  }

  function parseDateStr(s) {
    if (!s) return null;
    // Accept ISO strings (full or date-only)
 const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
 // Try plain Date parse as fallback
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

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
        ts: parseDateStr(p[0]),
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
        ts:       parseDateStr(p[0]),
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
        ts:          parseDateStr(p[0]),
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
      next9: parseLocalNum(p[2]),
        next20:parseLocalNum(p[3]),
        bot70: parseLocalNum(p[4]),
        totalEW: parseLocalNum(p[5]),
     N:     parseLocalNum(p[6])
      };
    }).filter(r => r.ts);
    cache.wealthDist = rows;
    return rows;
  }

  // Section 7: generic velocity sheet fetch (mirrors pricehistory-data.js)
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
      const b  = parseLocalNum(p[3]);
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

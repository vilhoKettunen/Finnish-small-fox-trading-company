// bank_js/bank-ui.js
window.BankUI = (function () {
  'use strict';

  // ??? State ???????????????????????????????????????????????????????????????
  const state = {
    range: BankConfig.DEFAULT_RANGE,
    backingMode: 'raw',          // 'raw' | 'ratio'
    backingShowMetal: true,
    backingShowCirc: true,
issuanceShowDestroyed: true, // combined destroyed (default ON)
    issuanceShowStoreBuy: false, // breakdown: store buy
    issuanceShowOcmFees: false,  // breakdown: ocm fees
    issuanceShowNet: false,      // net EW change
    metalAllocMode: 'line',    // 'line' | 'stacked'
  wealthMode: 'pct',   // 'pct' | 'raw'
    wealthSelectedDate: null,
    velLoaded: false,
    inflationLoaded: false
  };

  // Cached processed data
  let ewCircRows   = null;
  let ewDestRows   = null;
  let valRows      = null;
  let ewVelRows    = null;
  let wealthRows   = null;

  // ??? Date key helper ?????????????????????????????????????????????????????
  function dateKey(ts) {
    if (!ts) return '';
    try { return ts.toISOString().slice(0, 10); } catch { return ''; }
  }

  // ??? Range filter ?????????????????????????????????????????????????????????
  function filterByRange(rows, range) {
    if (!range || range === 'all') return rows;
    const now = new Date();
    let cutoff;
 if      (range === '7d')  cutoff = new Date(now - 7   * 86400000);
    else if (range === '30d') cutoff = new Date(now - 30  * 86400000);
    else if (range === '90d') cutoff = new Date(now - 90  * 86400000);
    else if (range === '1y')  cutoff = new Date(now - 365 * 86400000);
    else return rows;
    return rows.filter(r => r.ts >= cutoff);
  }

  // ??? Init ?????????????????????????????????????????????????????????????????
  async function init() {
    wireRangeSelector();
    wireIssuanceToggles();
    wireBackingControls();
    wireMetalAllocMode();
    wireWealthControls();
    wireVelocitySection();

    await loadCoreData();
    renderAll();
  }

  async function loadCoreData() {
    try {
      [ewCircRows, ewDestRows, valRows, ewVelRows, wealthRows] = await Promise.all([
      BankData.fetchEwCirculation(),
        BankData.fetchEwDestroyed(),
BankData.fetchValuationHistory(),
        BankData.fetchEwVelocity(),
        BankData.fetchWealthDist()
  ]);
    } catch (e) {
      console.error('BankUI loadCoreData error:', e);
    }
  }

  function renderAll() {
    renderCirculation();
    renderIssuanceDestruction();
    renderBacking();
    renderStoreNetWorth();
 renderMetalAllocation();
    renderWealthDist();
    BankInfra.loadAndRender();
  }

  // ??? Chart 1: EW Circulation ??????????????????????????????????????????????
function renderCirculation() {
    if (!ewCircRows) return;
    const filtered = filterByRange(ewCircRows, state.range);
    const dates  = filtered.map(r => r.ts);
    const values = filtered.map(r => r.totalEwInCirculation);
    BankCharts.drawCirculationChart('bankCircChart', dates, values, 'all');
  }

  // ??? Chart 2: Issuance & Destruction ??????????????????????????????????????
  function renderIssuanceDestruction() {
    if (!ewVelRows || !ewDestRows) return;

    // Group ewVelocity by date: sum ewSellTotal (issued) and ewBuyTotal across all items
 const velByDate = {};
    ewVelRows.forEach(r => {
      const k = dateKey(r.ts);
      if (!velByDate[k]) velByDate[k] = { ts: r.ts, ewSell: 0, ewBuy: 0 };
      velByDate[k].ewSell += isFinite(r.ewSellTotal) ? r.ewSellTotal : 0;
      velByDate[k].ewBuy  += isFinite(r.ewBuyTotal)  ? r.ewBuyTotal  : 0;
    });

  // Group ewDestroyed by date
    const destByDate = {};
  ewDestRows.forEach(r => {
      const k = dateKey(r.ts);
 destByDate[k] = { ts: r.ts, ewBuyTotal: r.ewBuyTotal, ocmFeesTotal: r.ocmFeesTotal };
    });

    // Merge all known dates
    const allKeys = [...new Set([...Object.keys(velByDate), ...Object.keys(destByDate)])].sort();
    const dates = allKeys.map(k => {
      const v = velByDate[k]; const d = destByDate[k];
      return (v && v.ts) || (d && d.ts) || new Date(k);
    });

    const issuedData   = allKeys.map(k => (velByDate[k] && velByDate[k].ewSell)  || null);
    const destroyedData= allKeys.map(k => {
      const d = destByDate[k]; const v = velByDate[k];
      const storeBuy   = d ? (d.ewBuyTotal   || 0) : 0;
      const ocmFees    = d ? (d.ocmFeesTotal || 0) : 0;
    const velBuy     = v ? (v.ewBuy      || 0) : 0;
      // Prefer dedicated destroyed history; fall back to velocity ewBuyTotal if no destroyed record
      return (d ? storeBuy + ocmFees : velBuy) || null;
    });
    const storeBuyData = allKeys.map(k => { const d = destByDate[k]; return d ? (d.ewBuyTotal || 0) : null; });
    const ocmFeesData  = allKeys.map(k => { const d = destByDate[k]; return d ? (d.ocmFeesTotal || 0) : null; });
    const netData      = allKeys.map((k, i) => {
      const iss = issuedData[i]; const des = destroyedData[i];
    return (iss != null && des != null) ? iss - des : null;
    });

    const datasets = [];
    datasets.push({ label: 'EW Issued', data: issuedData, borderColor: '#16A34A', backgroundColor: 'transparent', tension: 0.2, pointRadius: 2, hidden: false });
    if (state.issuanceShowDestroyed && !state.issuanceShowStoreBuy && !state.issuanceShowOcmFees) {
      datasets.push({ label: 'EW Destroyed (total)', data: destroyedData, borderColor: '#DC2626', backgroundColor: 'transparent', tension: 0.2, pointRadius: 2 });
    }
    if (state.issuanceShowStoreBuy) {
      datasets.push({ label: 'Store Buy', data: storeBuyData, borderColor: '#DC2626', backgroundColor: 'transparent', tension: 0.2, pointRadius: 2 });
    }
    if (state.issuanceShowOcmFees) {
      datasets.push({ label: 'OCM Fees', data: ocmFeesData, borderColor: '#EA580C', backgroundColor: 'transparent', tension: 0.2, pointRadius: 2 });
    }
    if (state.issuanceShowNet) {
      datasets.push({ label: 'Net EW Change', data: netData, borderColor: '#7C3AED', borderDash: [5, 3], backgroundColor: 'transparent', tension: 0.2, pointRadius: 2 });
    }

    BankCharts.drawIssuanceDestructionChart('bankIssuanceChart', dates, datasets, state.range);
  }

  // ??? Chart 3: Metal Backing ????????????????????????????????????????????????
  function renderBacking() {
    if (!valRows || !ewCircRows) return;
    const metals = BankConfig.METALS_LIST.map(m => m.toLowerCase());

    // Sum metal valuations per date
    const metalByDate = {};
    valRows.forEach(r => {
      if (!metals.includes(String(r.item || '').toLowerCase())) return;
      const k = dateKey(r.ts);
      if (!metalByDate[k]) metalByDate[k] = { ts: r.ts, sum: 0 };
      metalByDate[k].sum += isFinite(r.valuation) ? r.valuation : 0;
    });

    // Circulation by date
    const circByDate = {};
ewCircRows.forEach(r => { circByDate[dateKey(r.ts)] = r.totalEwInCirculation; });

    const allKeys = [...new Set([...Object.keys(metalByDate), ...Object.keys(circByDate)])].sort();
    const dates   = allKeys.map(k => (metalByDate[k] && metalByDate[k].ts) || new Date(k));
    const metalVals = allKeys.map(k => (metalByDate[k] && metalByDate[k].sum) || null);
    const circVals  = allKeys.map(k => circByDate[k] != null ? circByDate[k] : null);

    let datasets;
    if (state.backingMode === 'ratio') {
      const ratioData = allKeys.map((k, i) => {
      const m = metalVals[i]; const c = circVals[i];
        return (m != null && c != null && c > 0) ? (m / c) * 100 : null;
      });
      datasets = [{ label: 'Backing % of EW in Circulation', data: ratioData, borderColor: '#7C3AED', backgroundColor: 'transparent', tension: 0.2, pointRadius: 2 }];
    } else {
      datasets = [];
   if (state.backingShowMetal) datasets.push({ label: 'Metal Backing (EW)', data: metalVals, borderColor: '#CA8A04', backgroundColor: 'transparent', tension: 0.2, pointRadius: 2 });
      if (state.backingShowCirc)  datasets.push({ label: 'EW in Circulation',  data: circVals,  borderColor: '#2563EB', backgroundColor: 'transparent', tension: 0.2, pointRadius: 2 });
    }

    // Update toggle button visibility
    const toggleWrap = document.getElementById('backingToggleWrap');
    if (toggleWrap) toggleWrap.style.display = state.backingMode === 'raw' ? 'flex' : 'none';

    BankCharts.drawBackingChart('bankBackingChart', dates, datasets, state.range);
  }

  // ??? Chart 4: Store Net Worth ??????????????????????????????????????????????
  function renderStoreNetWorth() {
    if (!valRows) return;
    const sentinel = BankConfig.NET_WORTH_SENTINEL_ITEM.toLowerCase();
    // Filter to sentinel item; use totalValuation column
    const sentinelRows = valRows
      .filter(r => String(r.item || '').toLowerCase() === sentinel && r.totalValuation != null && isFinite(r.totalValuation))
      .sort((a, b) => a.ts - b.ts);

    if (sentinelRows.length === 0) { console.info('BankUI: No Resin rows found yet for Chart 4'); return; }
    const dates  = sentinelRows.map(r => r.ts);
    const values = sentinelRows.map(r => r.totalValuation);
  BankCharts.drawStoreNetWorthChart('bankStoreNetWorthChart', dates, values, state.range);
  }

  // ??? Chart 5: Metal Allocation ????????????????????????????????????????????
  function renderMetalAllocation() {
    if (!valRows) return;
    const metals = BankConfig.METALS_LIST;
    const metalsLower = metals.map(m => m.toLowerCase());

    // Collect per-date per-metal valuations
    const dataByDate = {}; // dateKey ? { ts, metalMap }
    valRows.forEach(r => {
      const idx = metalsLower.indexOf(String(r.item || '').toLowerCase());
      if (idx < 0) return;
      const k = dateKey(r.ts);
      if (!dataByDate[k]) dataByDate[k] = { ts: r.ts, metalMap: {} };
      dataByDate[k].metalMap[metals[idx]] = isFinite(r.valuation) ? r.valuation : 0;
    });

    const allKeys = Object.keys(dataByDate).sort();
    const dates = allKeys.map(k => dataByDate[k].ts);
    const perMetalPct = {};
    metals.forEach(m => { perMetalPct[m] = []; });

    allKeys.forEach(k => {
      const mm = dataByDate[k].metalMap;
      const daySum = metals.reduce((s, m) => s + (mm[m] || 0), 0);
   metals.forEach(m => {
      perMetalPct[m].push(daySum > 0 ? ((mm[m] || 0) / daySum) * 100 : null);
      });
 });

    BankCharts.drawMetalAllocationChart('bankMetalAllocChart', dates, perMetalPct, metals, state.metalAllocMode, state.range);
  }

  // ??? Chart 6: Wealth Distribution ?????????????????????????????????????????
  function renderWealthDist() {
    if (!wealthRows || wealthRows.length === 0) return;
    const filtered = filterByRange(wealthRows, state.range).sort((a, b) => a.ts - b.ts);
    const dates = filtered.map(r => r.ts);

    let top1, next9, next20, bot70;
    if (state.wealthMode === 'pct') {
      top1  = filtered.map(r => r.totalEW > 0 ? (r.top1  / r.totalEW) * 100 : null);
      next9 = filtered.map(r => r.totalEW > 0 ? (r.next9 / r.totalEW) * 100 : null);
      next20= filtered.map(r => r.totalEW > 0 ? (r.next20/ r.totalEW) * 100 : null);
      bot70 = filtered.map(r => r.totalEW > 0 ? (r.bot70 / r.totalEW) * 100 : null);
    } else {
      top1  = filtered.map(r => r.top1);
      next9 = filtered.map(r => r.next9);
      next20= filtered.map(r => r.next20);
      bot70 = filtered.map(r => r.bot70);
    }

    BankCharts.drawWealthDistChart('bankWealthChart', dates, { top1, next9, next20, bot70 }, state.wealthMode, state.range);

    // Populate date picker
  const picker = document.getElementById('wealthDatePicker');
    if (picker) {
      const all = wealthRows.slice().sort((a, b) => b.ts - a.ts);
      picker.innerHTML = '';
      all.forEach((r, i) => {
        const opt = document.createElement('option');
        opt.value = dateKey(r.ts);
        opt.textContent = dateKey(r.ts);
        if (i === 0) opt.selected = true;
        picker.appendChild(opt);
      });
      // Draw donut for default date
  if (all.length > 0) {
        state.wealthSelectedDate = dateKey(all[0].ts);
        renderWealthDonut(state.wealthSelectedDate);
      }
    }
  }

  function renderWealthDonut(dateStr) {
    if (!wealthRows) return;
    const row = wealthRows.find(r => dateKey(r.ts) === dateStr);
    if (!row) { BankCharts.destroy('bankWealthDonut'); return; }
    const colors = BankConfig.WEALTH_COLORS;
BankCharts.drawWealthDonut(
      'bankWealthDonut',
      ['Top 1%', 'Next 9%', 'Next 20%', 'Bottom 70%'],
      [row.top1, row.next9, row.next20, row.bot70],
      [colors.top1, colors.next9, colors.next20, colors.bot70]
    );
    const label = document.getElementById('wealthDonutLabel');
    if (label) label.textContent = `Wealth snapshot: ${dateStr}`;
  }

  // ??? Wiring ???????????????????????????????????????????????????????????????
  function wireRangeSelector() {
    const sel = document.getElementById('bankRangeSelect');
    if (!sel) return;
    // Populate options
    BankConfig.RANGE_OPTIONS.forEach(r => {
  const o = document.createElement('option');
    o.value = r; o.textContent = r === 'all' ? 'All' : r.toUpperCase();
      if (r === BankConfig.DEFAULT_RANGE) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', () => {
      state.range = sel.value;
    renderAll();
    });
  }

  function wireIssuanceToggles() {
    function bindToggle(id, stateKey) {
      const btn = document.getElementById(id); if (!btn) return;
 btn.addEventListener('click', () => {
        state[stateKey] = !state[stateKey];
        btn.classList.toggle('active', state[stateKey]);
     renderIssuanceDestruction();
   });
    }
    bindToggle('btnIssuanceDestroyed', 'issuanceShowDestroyed');
    bindToggle('btnIssuanceStoreBuy',  'issuanceShowStoreBuy');
    bindToggle('btnIssuanceOcmFees',   'issuanceShowOcmFees');
    bindToggle('btnIssuanceNet',       'issuanceShowNet');
 // Set initial active states
    const def = document.getElementById('btnIssuanceDestroyed');
    if (def) def.classList.add('active');
  }

  function wireBackingControls() {
    const modeSelect = document.getElementById('backingModeSelect');
    if (modeSelect) {
      modeSelect.addEventListener('change', () => {
        state.backingMode = modeSelect.value;
     renderBacking();
      });
 }
    function bindToggle(id, stateKey) {
      const btn = document.getElementById(id); if (!btn) return;
      btn.classList.add('active');
      btn.addEventListener('click', () => {
        state[stateKey] = !state[stateKey];
        btn.classList.toggle('active', state[stateKey]);
   renderBacking();
      });
    }
    bindToggle('btnBackingMetal', 'backingShowMetal');
    bindToggle('btnBackingCirc',  'backingShowCirc');
  }

  function wireMetalAllocMode() {
    const sel = document.getElementById('metalAllocModeSelect');
    if (!sel) return;
    sel.addEventListener('change', () => {
      state.metalAllocMode = sel.value;
      renderMetalAllocation();
    });
  }

  function wireWealthControls() {
    const modeBtn = document.getElementById('btnWealthMode');
    if (modeBtn) {
      modeBtn.addEventListener('click', () => {
        state.wealthMode = state.wealthMode === 'pct' ? 'raw' : 'pct';
        modeBtn.textContent = state.wealthMode === 'pct' ? 'Switch to Raw EW' : 'Switch to % of Total';
        renderWealthDist();
 });
    }
    const picker = document.getElementById('wealthDatePicker');
    if (picker) {
      picker.addEventListener('change', () => {
        state.wealthSelectedDate = picker.value;
    renderWealthDonut(picker.value);
      });
    }
  }

  function wireVelocitySection() {
    const header = document.getElementById('velInflHeader');
    if (!header) return;
    header.addEventListener('click', async () => {
      const content = document.getElementById('velInflContent');
      if (!content) return;
      const isOpen = content.style.display !== 'none';
      content.style.display = isOpen ? 'none' : 'block';
      header.setAttribute('aria-expanded', String(!isOpen));
      if (!isOpen && !state.velLoaded) {
        state.velLoaded = true;
        await renderVelocitySection();
      }
    });

    // Velocity metric selector
    const metricSel = document.getElementById('bankVelMetricSelect');
    if (metricSel) {
  metricSel.addEventListener('change', () => {
        if (state.velLoaded) renderVelocitySection();
      });
  }
  }

  async function renderVelocitySection() {
    const metricSel = document.getElementById('bankVelMetricSelect');
    const metricKey = metricSel ? metricSel.value : 'ewVelocity';

    const sheetKeyMap = {
      ewVelocity:    'EwVelocity',
      storeVolume:   'VelocityVolume',
      ocmVolume:     'OcmVolume',
  uniqueTraders: 'UniqueTraders',
      tradeCount:    'TradeCount'
    };

    const sheetKey = sheetKeyMap[metricKey] || 'EwVelocity';

    try {
   const rows = await BankData.fetchVelocitySheet(sheetKey);

      // Get unique items from selected chips or use all
      const chipContainer = document.getElementById('bankVelItemChips');
      const selectedItems = chipContainer
   ? [...chipContainer.querySelectorAll('.bank-item-chip.selected')].map(c => c.dataset.item)
        : [];

      const items = selectedItems.length > 0
        ? selectedItems
        : [...new Set(rows.map(r => r.item))].slice(0, 10);

      // Build per-item datasets
      const palette = BankConfig.METAL_COLOR_PALETTE;
      const dates   = [...new Set(rows.map(r => r.ts && r.ts.toISOString().slice(0, 10)))].sort().map(d => new Date(d));

      const datasets = items.map((item, i) => {
        const itemRows = rows.filter(r => r.item === item);
        const byDate = {};
        itemRows.forEach(r => { byDate[r.ts && r.ts.toISOString().slice(0, 10)] = r.a; });
        return {
          label: item,
          data: dates.map(d => byDate[d.toISOString().slice(0, 10)] != null ? byDate[d.toISOString().slice(0, 10)] : null),
          borderColor: palette[i % palette.length],
      backgroundColor: 'transparent',
       tension: 0.2,
          pointRadius: 1
        };
      });

      BankCharts.drawBankVelocityChart('bankVelocityItemChart', dates, datasets, state.range);

      // Combined chart: sum across items per date
      const sumByDate = {};
      rows.forEach(r => {
        const dk = r.ts && r.ts.toISOString().slice(0, 10);
   if (!dk) return;
        if (!sumByDate[dk]) sumByDate[dk] = { ts: new Date(dk), sum: 0 };
 sumByDate[dk].sum += isFinite(r.a) ? r.a : 0;
    });
      const combDates = Object.keys(sumByDate).sort().map(k => sumByDate[k].ts);
      const combData  = Object.keys(sumByDate).sort().map(k => sumByDate[k].sum);
  BankCharts.drawBankVelocityChart('bankVelocityCombinedChart', combDates, [{ label: 'All Items Combined', data: combData, borderColor: '#111827', backgroundColor: 'transparent', tension: 0.2, pointRadius: 1 }], state.range);

    } catch (e) {
      console.error('BankUI renderVelocitySection error:', e);
    }
  }

  return { init, renderWealthDonut };
})();

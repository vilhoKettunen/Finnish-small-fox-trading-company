// bank_js/bank-ui.js
window.BankUI = (function () {
    'use strict';

    // ─── State ───────────────────────────────────────────────────────────────
    const state = {
        range: BankConfig.DEFAULT_RANGE,
        backingMode: 'raw',
        backingShowMetal: true,
        backingShowCirc: true,
        issuanceShowDestroyed: true,
issuanceShowStoreBuy: false,
      issuanceShowOcmFees: false,
        issuanceShowNet: false,
 metalAllocMode: 'line',
        wealthMode: 'pct',
    wealthChartStyle: 'line',   // NEW: 'stacked' | 'line'
        wealthSelectedDate: null,
        velLoaded: false,
        // Per-item velocity toggles
        velItem: { breakdown: true, showA: true, showB: true, norm: false, top10: false },
        // Combined velocity toggles
    velComb: { breakdown: false, showA: true, showB: true, norm: false }
 };

    // Cached processed data
let ewCircRows = null;
    let ewDestRows = null;
    let valRows = null;
    let ewVelRows = null;
  let wealthRows = null;

    // ─── Helpers ──────────────────────────────────────────────────────────────
    function $(id) { return document.getElementById(id); }

    // Produce a YYYY-MM-DD key using UTC fields so UTC-midnight dates are never
    // shifted by the viewer's local timezone.
    function dateKey(ts) {
        if (!ts) return '';
        try {
      const y = ts.getUTCFullYear();
            const m = String(ts.getUTCMonth() + 1).padStart(2, '0');
         const d = String(ts.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
        } catch { return ''; }
    }

    // Display a YYYY-MM-DD ISO string as DD/MM/YYYY for the user.
    function fmtDateDisplay(isoStr) {
        if (!isoStr) return '';
        const [y, m, d] = isoStr.split('-');
     return `${d}/${m}/${y}`;
    }

    function filterByRange(rows, range) {
        if (!range || range === 'all') return rows;
      const now = new Date();
  let cutoff;
        if (range === '7d') cutoff = new Date(now - 7 * 86400000);
   else if (range === '30d') cutoff = new Date(now - 30 * 86400000);
        else if (range === '90d') cutoff = new Date(now - 90 * 86400000);
        else if (range === '1y') cutoff = new Date(now - 365 * 86400000);
        else return rows;
        return rows.filter(r => r.ts >= cutoff);
    }

    // ─── Velocity label helpers ───────────────────────────────────────────────
    function velLineLabels(metricKey) {
        if (metricKey === 'ewVelocity') return { a: 'EW Buy', b: 'EW Sell' };
     if (metricKey === 'storeVolume') return { a: 'Bought', b: 'Sold' };
        if (metricKey === 'uniqueTraders') return { a: 'Store', b: 'OCM' };
        if (metricKey === 'tradeCount') return { a: 'Store', b: 'OCM' };
  if (metricKey === 'ocmVolume') return { a: 'OCM Volume', b: null };
        return { a: 'A', b: 'B' };
    }

    function velSheetKey(metricKey) {
      const map = {
            ewVelocity: 'EwVelocity',
  storeVolume: 'VelocityVolume',
            ocmVolume: 'OcmVolume',
     uniqueTraders: 'UniqueTraders',
  tradeCount: 'TradeCount'
        };
        return map[metricKey] || 'EwVelocity';
    }

    // ─── Init ─────────────────────────────────────────────────────────────────
    async function init() {
     wireSectionPanel();   // must run first so sections are visible before data loads
  wireRangeSelector();
        wireIssuanceToggles();
  wireBackingControls();
     wireMetalAllocMode();
        wireWealthControls();
        wireVelocitySection();
        wireInfoModal();
      wireIntroGuide();

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
  if (window.BankInflation) BankInflation.onRangeChange();
    }

    // ─── Chart 1: EW Circulation ──────────────────────────────────────────────
    function renderCirculation() {
if (!ewCircRows) return;
        const filtered = filterByRange(ewCircRows, state.range);
        BankCharts.drawCirculationChart('bankCircChart', filtered.map(r => r.ts), filtered.map(r => r.totalEwInCirculation), 'all');
    }

    // ─── Chart 2: Issuance & Destruction ──────────────────────────────────────
    function renderIssuanceDestruction() {
        if (!ewVelRows || !ewDestRows) return;

  const velByDate = {};
   ewVelRows.forEach(r => {
     const k = dateKey(r.ts);
        if (!velByDate[k]) velByDate[k] = { ts: r.ts, ewSell: 0, ewBuy: 0 };
      velByDate[k].ewSell += isFinite(r.ewSellTotal) ? r.ewSellTotal : 0;
            velByDate[k].ewBuy += isFinite(r.ewBuyTotal) ? r.ewBuyTotal : 0;
        });

        const destByDate = {};
        ewDestRows.forEach(r => {
          const k = dateKey(r.ts);
            destByDate[k] = { ts: r.ts, ewBuyTotal: r.ewBuyTotal, ocmFeesTotal: r.ocmFeesTotal };
      });

        const allKeys = [...new Set([...Object.keys(velByDate), ...Object.keys(destByDate)])].sort();
        const dates = allKeys.map(k => (velByDate[k] && velByDate[k].ts) || (destByDate[k] && destByDate[k].ts) || new Date(k));

        const issuedData = allKeys.map(k => (velByDate[k] && velByDate[k].ewSell) || null);
        const destroyedData = allKeys.map(k => {
    const d = destByDate[k]; const v = velByDate[k];
   const storeBuy = d ? (d.ewBuyTotal || 0) : 0;
            const ocmFees = d ? (d.ocmFeesTotal || 0) : 0;
         const velBuy = v ? (v.ewBuy || 0) : 0;
        return (d ? storeBuy + ocmFees : velBuy) || null;
  });
        const storeBuyData = allKeys.map(k => { const d = destByDate[k]; return d ? (d.ewBuyTotal || 0) : null; });
        const ocmFeesData = allKeys.map(k => { const d = destByDate[k]; return d ? (d.ocmFeesTotal || 0) : null; });
        const netData = allKeys.map((k, i) => {
            const iss = issuedData[i]; const des = destroyedData[i];
   return (iss != null && des != null) ? iss - des : null;
});

        const datasets = [];
        datasets.push({ label: 'EW Issued', data: issuedData, borderColor: '#16A34A', backgroundColor: 'transparent', tension: 0.2, pointRadius: 2 });
        if (state.issuanceShowDestroyed && !state.issuanceShowStoreBuy && !state.issuanceShowOcmFees)
            datasets.push({ label: 'EW Destroyed (total)', data: destroyedData, borderColor: '#DC2626', backgroundColor: 'transparent', tension: 0.2, pointRadius: 2 });
        if (state.issuanceShowStoreBuy)
  datasets.push({ label: 'Store Buy', data: storeBuyData, borderColor: '#DC2626', backgroundColor: 'transparent', tension: 0.2, pointRadius: 2 });
      if (state.issuanceShowOcmFees)
      datasets.push({ label: 'OCM Fees', data: ocmFeesData, borderColor: '#EA580C', backgroundColor: 'transparent', tension: 0.2, pointRadius: 2 });
        if (state.issuanceShowNet)
datasets.push({ label: 'Net EW Change', data: netData, borderColor: '#7C3AED', borderDash: [5, 3], backgroundColor: 'transparent', tension: 0.2, pointRadius: 2 });

      BankCharts.drawIssuanceDestructionChart('bankIssuanceChart', dates, datasets, state.range);
    }

    // ─── Chart 3: Metal Backing ────────────────────────────────────────────────
    function renderBacking() {
        if (!valRows || !ewCircRows) return;
     const metals = BankConfig.METALS_LIST.map(m => m.toLowerCase());

        const metalByDate = {};
        valRows.forEach(r => {
            if (!metals.includes(String(r.item || '').toLowerCase())) return;
            const k = dateKey(r.ts);
            if (!metalByDate[k]) metalByDate[k] = { ts: r.ts, sum: 0 };
      metalByDate[k].sum += isFinite(r.valuation) ? r.valuation : 0;
        });

const circByDate = {};
        ewCircRows.forEach(r => { circByDate[dateKey(r.ts)] = r.totalEwInCirculation; });

        const allKeys = [...new Set([...Object.keys(metalByDate), ...Object.keys(circByDate)])].sort();
        const dates = allKeys.map(k => (metalByDate[k] && metalByDate[k].ts) || new Date(k));
        const metalVals = allKeys.map(k => (metalByDate[k] && metalByDate[k].sum) || null);
        const circVals = allKeys.map(k => circByDate[k] != null ? circByDate[k] : null);

 let datasets;
  if (state.backingMode === 'ratio') {
            datasets = [{
    label: 'Backing % of EW in Circulation', data: allKeys.map((k, i) => {
 const m = metalVals[i]; const c = circVals[i];
              return (m != null && c != null && c > 0) ? (m / c) * 100 : null;
    }), borderColor: '#7C3AED', backgroundColor: 'transparent', tension: 0.2, pointRadius: 2
            }];
        } else {
          datasets = [];
            if (state.backingShowMetal) datasets.push({ label: 'Metal Backing (EW)', data: metalVals, borderColor: '#CA8A04', backgroundColor: 'transparent', tension: 0.2, pointRadius: 2 });
            if (state.backingShowCirc) datasets.push({ label: 'EW in Circulation', data: circVals, borderColor: '#2563EB', backgroundColor: 'transparent', tension: 0.2, pointRadius: 2 });
}

  const toggleWrap = $('backingToggleWrap');
   if (toggleWrap) toggleWrap.style.display = state.backingMode === 'raw' ? 'flex' : 'none';

        BankCharts.drawBackingChart('bankBackingChart', dates, datasets, state.range);
    }

 // ─── Chart 4: Store Net Worth ──────────────────────────────────────────────
    function renderStoreNetWorth() {
      if (!valRows) return;
        const sentinel = BankConfig.NET_WORTH_SENTINEL_ITEM.toLowerCase();
     const sentinelRows = valRows
   .filter(r => String(r.item || '').toLowerCase() === sentinel && r.totalValuation != null && isFinite(r.totalValuation))
        .sort((a, b) => a.ts - b.ts);
     if (!sentinelRows.length) return;
        BankCharts.drawStoreNetWorthChart('bankStoreNetWorthChart', sentinelRows.map(r => r.ts), sentinelRows.map(r => r.totalValuation), state.range);
    }

    // ─── Chart 5: Metal Allocation ────────────────────────────────────────────
    function renderMetalAllocation() {
        if (!valRows) return;
        const metals = BankConfig.METALS_LIST;
        const metalsLower = metals.map(m => m.toLowerCase());

    const dataByDate = {};
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
        metals.forEach(m => { perMetalPct[m].push(daySum > 0 ? ((mm[m] || 0) / daySum) * 100 : null); });
        });

        BankCharts.drawMetalAllocationChart('bankMetalAllocChart', dates, perMetalPct, metals, state.metalAllocMode, state.range);
    }

    // ─── Chart 6: Wealth Distribution ─────────────────────────────────────────
    function renderWealthDist() {
        if (!wealthRows || !wealthRows.length) return;
        const filtered = filterByRange(wealthRows, state.range).sort((a, b) => a.ts - b.ts);

   let top1, next9, next20, bot70;
        if (state.wealthMode === 'pct') {
    top1 = filtered.map(r => r.totalEW > 0 ? (r.top1 / r.totalEW) * 100 : null);
      next9 = filtered.map(r => r.totalEW > 0 ? (r.next9 / r.totalEW) * 100 : null);
          next20 = filtered.map(r => r.totalEW > 0 ? (r.next20 / r.totalEW) * 100 : null);
        bot70 = filtered.map(r => r.totalEW > 0 ? (r.bot70 / r.totalEW) * 100 : null);
    } else {
 top1 = filtered.map(r => r.top1);
            next9 = filtered.map(r => r.next9);
    next20 = filtered.map(r => r.next20);
    bot70 = filtered.map(r => r.bot70);
        }

        // Pass wealthChartStyle as new 6th argument
        BankCharts.drawWealthDistChart(
            'bankWealthChart',
  filtered.map(r => r.ts),
  { top1, next9, next20, bot70 },
         state.wealthMode,
    state.range,
 state.wealthChartStyle
    );

     const picker = $('wealthDatePicker');
        if (picker) {
  const sorted = wealthRows.slice().sort((a, b) => b.ts - a.ts);
          picker.innerHTML = '';
            sorted.forEach((r, i) => {
        const iso = dateKey(r.ts);
       const opt = document.createElement('option');
           opt.value = iso;
      opt.textContent = fmtDateDisplay(iso);
         if (i === 0) opt.selected = true;
    picker.appendChild(opt);
 });
            if (sorted.length > 0) {
      state.wealthSelectedDate = dateKey(sorted[0].ts);
     renderWealthDonut(state.wealthSelectedDate);
     }
        }
    }

  function renderWealthDonut(isoDateStr) {
        if (!wealthRows) return;
   const row = wealthRows.find(r => dateKey(r.ts) === isoDateStr);
        if (!row) { BankCharts.destroy('bankWealthDonut'); return; }
        const colors = BankConfig.WEALTH_COLORS;
      BankCharts.drawWealthDonut(
        'bankWealthDonut',
            ['Top 1%', 'Next 9%', 'Next 20%', 'Bottom 70%'],
     [row.top1, row.next9, row.next20, row.bot70],
            [colors.top1, colors.next9, colors.next20, colors.bot70]
    );
     const label = $('wealthDonutLabel');
        if (label) label.textContent = `Wealth snapshot: ${fmtDateDisplay(isoDateStr)}`;
  }

    // ─── Wiring ───────────────────────────────────────────────────────────────
    function wireRangeSelector() {
  const sel = $('bankRangeSelect');
        if (!sel) return;
        BankConfig.RANGE_OPTIONS.forEach(r => {
            const o = document.createElement('option');
 o.value = r; o.textContent = r === 'all' ? 'All' : r.toUpperCase();
            if (r === BankConfig.DEFAULT_RANGE) o.selected = true;
            sel.appendChild(o);
        });
        sel.addEventListener('change', () => { state.range = sel.value; renderAll(); });
    }

    function wireIssuanceToggles() {
        function bind(id, key) {
            const btn = $(id); if (!btn) return;
            btn.addEventListener('click', () => {
                state[key] = !state[key];
    btn.classList.toggle('active', state[key]);
     renderIssuanceDestruction();
            });
        }
     bind('btnIssuanceDestroyed', 'issuanceShowDestroyed');
        bind('btnIssuanceStoreBuy', 'issuanceShowStoreBuy');
        bind('btnIssuanceOcmFees', 'issuanceShowOcmFees');
        bind('btnIssuanceNet', 'issuanceShowNet');
    }

    function wireBackingControls() {
        const sel = $('backingModeSelect');
        if (sel) sel.addEventListener('change', () => { state.backingMode = sel.value; renderBacking(); });

function bindToggle(id, key) {
            const btn = $(id); if (!btn) return;
            btn.addEventListener('click', () => {
           state[key] = !state[key];
     btn.classList.toggle('active', state[key]);
     renderBacking();
      });
    }
        bindToggle('btnBackingMetal', 'backingShowMetal');
     bindToggle('btnBackingCirc', 'backingShowCirc');
    }

  function wireMetalAllocMode() {
        const sel = $('metalAllocModeSelect');
        if (sel) sel.addEventListener('change', () => { state.metalAllocMode = sel.value; renderMetalAllocation(); });
    }

    function wireWealthControls() {
   // Raw/Pct toggle button
 const btn = $('btnWealthMode');
        if (btn) {
            btn.addEventListener('click', () => {
              state.wealthMode = state.wealthMode === 'pct' ? 'raw' : 'pct';
      btn.textContent = state.wealthMode === 'pct' ? 'Switch to Raw EW' : 'Switch to % of Total';
    renderWealthDist();
          });
        }

        // Chart style selector (new)
   const styleSel = $('wealthChartStyleSelect');
        if (styleSel) {
            // Set initial value to match state
       styleSel.value = state.wealthChartStyle;
        styleSel.addEventListener('change', () => {
    state.wealthChartStyle = styleSel.value;
                renderWealthDist();
      });
     }

     const picker = $('wealthDatePicker');
        if (picker) picker.addEventListener('change', () => { state.wealthSelectedDate = picker.value; renderWealthDonut(picker.value); });
    }

    // ─── Section Toggle Panel ─────────────────────────────────────────────────
    const SECTION_STORAGE_KEY = 'bank:sections:v1';

    const SECTION_DEFS = [
        { id: 'ewCircSection',       label: 'EW Circulation' },
        { id: 'issuanceSection',     label: 'Issuance & Destruction' },
        { id: 'backingSection',      label: 'Metal Backing' },
        { id: 'storeNetWorthSection',label: 'Store Net Worth' },
        { id: 'metalAllocSection',   label: 'Metal Allocation' },
        { id: 'wealthDistSection',   label: 'Wealth Distribution' },
        { id: 'infraSection',        label: 'Infrastructure' },
        { id: 'bankInflationBlock',  label: 'Inflation Index' },
    { id: 'bankVelItemBlock', label: 'Velocity (per item)' },
    { id: 'bankVelCombBlock',    label: 'Velocity (combined)' }
    ];

    function loadSectionPrefs() {
        try {
     const raw = localStorage.getItem(SECTION_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
     } catch { return {}; }
    }

    function saveSectionPrefs(prefs) {
        try { localStorage.setItem(SECTION_STORAGE_KEY, JSON.stringify(prefs)); } catch {}
    }

    function wireSectionPanel() {
        const panel = $('bankSectionPanel');
const toggleBtn = $('bankPanelToggle');
    const openBtn = $('bankPanelOpenBtn');
        if (!panel) return;

    // Inject buttons into the inner container, not the panel root
        const inner = panel.querySelector('.bank-section-panel-inner');
        if (!inner) return;

    const prefs = loadSectionPrefs();

      // Build buttons
        SECTION_DEFS.forEach(def => {
    const btn = document.createElement('button');
btn.type = 'button';
        btn.className = 'bank-toggle-btn bank-section-toggle-btn';
  btn.dataset.section = def.id;
            btn.textContent = def.label;

     const visible = prefs[def.id] !== false; // default: visible
            btn.classList.toggle('active', visible);
     setSectionVisible(def.id, visible);

btn.addEventListener('click', () => {
      const isNowActive = btn.classList.toggle('active');
    setSectionVisible(def.id, isNowActive);
         const updated = loadSectionPrefs();
           updated[def.id] = isNowActive;
     saveSectionPrefs(updated);
        });

            inner.appendChild(btn);
        });

  // Collapse/expand the panel itself (desktop)
        if (toggleBtn) {
      const updateArrow = () => {
     const collapsed = panel.classList.contains('collapsed');
        toggleBtn.textContent = collapsed ? '›' : '‹';
  toggleBtn.title = collapsed ? 'Show section panel' : 'Hide section panel';
   };
            toggleBtn.addEventListener('click', () => {
              panel.classList.toggle('collapsed');
        updateArrow();
   });
            updateArrow();
        }

        // Mobile: floating open button toggles mobile-open class
        if (openBtn) {
   openBtn.addEventListener('click', () => {
  panel.classList.toggle('mobile-open');
    });
   // Close panel when clicking outside on mobile
       document.addEventListener('click', (e) => {
    if (panel.classList.contains('mobile-open') &&
            !panel.contains(e.target) &&
     e.target !== openBtn) {
         panel.classList.remove('mobile-open');
       }
            });
     }
    }

    function setSectionVisible(sectionId, visible) {
        const el = document.getElementById(sectionId);
     if (!el) return;
     el.style.display = visible ? '' : 'none';
    }

    // ─── Intro: currency "More info" modal + page guide panel ─────────────────
    function wireIntroGuide() {
const btnMoreInfo = $('btnIntroMoreInfo');
        if (btnMoreInfo) {
     btnMoreInfo.addEventListener('click', () => openInfo('ewCurrency'));
        }

        const btnGuide = $('btnPageGuide');
        const panel = $('bankPageGuidePanel');
        const body = $('bankPageGuideBody');
        if (!btnGuide || !panel || !body) return;

        const t = window.BankHelpText && window.BankHelpText.pageGuide;
        if (t && t.bullets && t.bullets.length) {
      const ul = document.createElement('ul');
      t.bullets.forEach(b => {
      const li = document.createElement('li');
       const dashIdx = b.indexOf(' \u2014 ');
       const colonIdx = b.indexOf(': ');
         const splitAt = dashIdx > -1 ? dashIdx : (colonIdx > -1 ? colonIdx : -1);
                if (splitAt > -1) {
          const strong = document.createElement('strong');
                strong.textContent = b.slice(0, splitAt);
      li.appendChild(strong);
        li.appendChild(document.createTextNode(b.slice(splitAt)));
                } else {
   li.textContent = b;
    }
        ul.appendChild(li);
          });
  body.appendChild(ul);
        }

      btnGuide.addEventListener('click', () => {
     const isOpen = panel.style.display !== 'none';
      panel.style.display = isOpen ? 'none' : 'block';
        panel.setAttribute('aria-hidden', String(isOpen));
         btnGuide.setAttribute('aria-expanded', String(!isOpen));
     const arrow = !isOpen ? '\u25BC' : '\u25BA';
 btnGuide.innerHTML = `${arrow}\u00A0What can I do on this page? (page guide)`;
  });
    }

    // ─── Velocity section wiring ──────────────────────────────────────────────
    function wireVelocitySection() {
        // Metric selector
        const metricSel = $('bankVelMetricSelect');
        if (metricSel) {
            metricSel.addEventListener('change', () => {
         updateVelToggleBLabels();
            if (state.velLoaded) renderVelocitySection();
            });
        }

        // Per-item toggles
        function bindCheck(id, stateObj, key, renderFn) {
            const el = $(id); if (!el) return;
            el.addEventListener('change', () => { stateObj[key] = el.checked; renderFn(); });
        }
      bindCheck('bankVelItemBreakdown', state.velItem, 'breakdown', () => state.velLoaded && renderVelocityItem());
        bindCheck('bankVelItemShowA', state.velItem, 'showA', () => state.velLoaded && renderVelocityItem());
        bindCheck('bankVelItemShowB', state.velItem, 'showB', () => state.velLoaded && renderVelocityItem());
        bindCheck('bankVelItemNorm', state.velItem, 'norm', () => state.velLoaded && renderVelocityItem());

        const btnTop10 = $('bankVelItemTop10');
      if (btnTop10) {
    btnTop10.addEventListener('click', () => {
      state.velItem.top10 = !state.velItem.top10;
     btnTop10.classList.toggle('active', state.velItem.top10);
       if (state.velLoaded) renderVelocityItem();
      });
      }

        // Combined toggles
        bindCheck('bankVelCombBreakdown', state.velComb, 'breakdown', () => state.velLoaded && renderVelocityCombined());
        bindCheck('bankVelCombShowA', state.velComb, 'showA', () => state.velLoaded && renderVelocityCombined());
        bindCheck('bankVelCombShowB', state.velComb, 'showB', () => state.velLoaded && renderVelocityCombined());
        bindCheck('bankVelCombNorm', state.velComb, 'norm', () => state.velLoaded && renderVelocityCombined());

   // Auto-load when the vel/infl section is first shown (now no longer
        // gated on a collapse click — the section panel handles visibility).
        // We lazy-load on first render request instead.
        _triggerVelLoad();
    }

    // Lazy-load velocity data the first time either vel block becomes needed.
    function _triggerVelLoad() {
        // Use an IntersectionObserver to detect when the vel blocks first become
        // visible, or fall back to loading immediately.
        const itemBlock = $('bankVelItemBlock');
        if (!itemBlock) { return; }

        const observer = new IntersectionObserver(entries => {
  if (entries.some(e => e.isIntersecting) && !state.velLoaded) {
    state.velLoaded = true;
         renderVelocitySection().catch(() => {});
        if (window.BankInflation && !BankInflation.isInited()) {
            BankInflation.init().catch(() => {});
      }
          observer.disconnect();
     }
        }, { threshold: 0.01 });
    observer.observe(itemBlock);

        // Also watch combined block
 const combBlock = $('bankVelCombBlock');
        if (combBlock) observer.observe(combBlock);

        // And inflation block
        const inflBlock = $('bankInflationBlock');
        if (inflBlock) observer.observe(inflBlock);
    }

    function updateVelToggleBLabels() {
    const metricKey = ($('bankVelMetricSelect') || {}).value || 'ewVelocity';
        const { a, b } = velLineLabels(metricKey);

        const itemLabelA = $('bankVelItemLabelA');
        if (itemLabelA) itemLabelA.childNodes[itemLabelA.childNodes.length - 1].nodeValue = ` Show ${a}`;
     if ($('bankVelCombLabelA')) $('bankVelCombLabelA').childNodes[$('bankVelCombLabelA').childNodes.length - 1].nodeValue = ` Show ${a}`;

        const itemLabelB = $('bankVelItemLabelB');
        const combLabelB = $('bankVelCombLabelB');

        if (!b) {
        if (itemLabelB) itemLabelB.style.display = 'none';
    if (combLabelB) combLabelB.style.display = 'none';
            state.velItem.showB = false;
        state.velComb.showB = false;
  const ib = $('bankVelItemShowB'); if (ib) ib.checked = false;
  const cb = $('bankVelCombShowB'); if (cb) cb.checked = false;
        } else {
         if (itemLabelB) { itemLabelB.style.display = ''; }
  if (combLabelB) { combLabelB.style.display = ''; }
   }
    }

    // ─── Velocity rendering ───────────────────────────────────────────────────
    let _velRows = null;
    let _velMetricKey = null;

    async function renderVelocitySection() {
        const metricKey = ($('bankVelMetricSelect') || {}).value || 'ewVelocity';
    try {
          _velRows = await BankData.fetchVelocitySheet(velSheetKey(metricKey));
     _velMetricKey = metricKey;
            updateVelToggleBLabels();
     renderVelocityItem();
      renderVelocityCombined();
        } catch (e) {
            console.error('BankUI renderVelocitySection error:', e);
        }
    }

    function buildVelDatasets(rows, items, toggles, metricKey) {
const palette = BankConfig.METAL_COLOR_PALETTE;
        const { a: aName, b: bName } = velLineLabels(metricKey);

        const allDates = [...new Set(rows.map(r => dateKey(r.ts)))].sort();
        const dates = allDates.map(d => new Date(d));

 const datasets = [];

   items.forEach((item, i) => {
 const c = palette[i % palette.length];
const itemRows = rows.filter(r => r.item === item);
   const byDate = {};
            itemRows.forEach(r => { byDate[dateKey(r.ts)] = r; });

            const aData = allDates.map(d => { const r = byDate[d]; return r ? r.a : null; });
   const bData = bName ? allDates.map(d => { const r = byDate[d]; return (r && r.b != null) ? r.b : null; }) : null;
            const total = allDates.map((d, j) => {
   const av = aData[j]; const bv = bData ? bData[j] : null;
      if (av == null && bv == null) return null;
return (av || 0) + (bv || 0);
         });

         function maybeNorm(series) {
                if (!toggles.norm) return series;
       const first = series.find(v => v != null && v !== 0);
      if (!first) return series;
    return series.map(v => v != null ? (v / first) * 100 : null);
            }

       if (toggles.breakdown) {
        if (toggles.showA)
           datasets.push({ label: `${item} (${aName})`, data: maybeNorm(aData), borderColor: c, backgroundColor: 'transparent', tension: 0.2, pointRadius: 2, borderWidth: 2, spanGaps: false });
 if (bName && toggles.showB)
      datasets.push({ label: `${item} (${bName})`, data: maybeNorm(bData), borderColor: c, backgroundColor: 'transparent', tension: 0.2, pointRadius: 2, borderWidth: 2, borderDash: [5, 4], spanGaps: false });
    } else {
       datasets.push({ label: `${item} (Total)`, data: maybeNorm(total), borderColor: c, backgroundColor: 'transparent', tension: 0.2, pointRadius: 2, borderWidth: 2, spanGaps: false });
  }
        });

        return { dates, datasets };
    }

    function renderVelocityItem() {
 if (!_velRows) return;
        const metricKey = _velMetricKey || 'ewVelocity';

        const subtitle = $('velItemSubtitle');

        if (state.velItem.top10) {
       const totals = {};
        _velRows.forEach(r => {
   if (!totals[r.item]) totals[r.item] = 0;
      totals[r.item] += (isFinite(r.a) ? r.a : 0) + (isFinite(r.b) ? r.b : 0);
            });
       const items = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
      .map(([name]) => name);

    if (subtitle) subtitle.textContent = 'Top 10 most active items';

            const { dates, datasets } = buildVelDatasets(_velRows, items, state.velItem, metricKey);
            BankCharts.drawBankVelocityChart('bankVelocityItemChart', dates, datasets, state.range);
  return;
        }

        const selectedItems = (window.BankInflation && BankInflation.isInited())
         ? BankInflation.getAppliedItems()
      : [];

        const items = selectedItems.length
 ? selectedItems.filter(name => _velRows.some(r => r.item === name))
      : [...new Set(_velRows.map(r => r.item))].slice(0, 10);

    if (subtitle) {
 subtitle.textContent = selectedItems.length
     ? 'Showing ' + items.length + ' selected item' + (items.length !== 1 ? 's' : '')
     : 'Showing top 10 items (no selection \u2014 use the item selector above)';
        }

        const { dates, datasets } = buildVelDatasets(_velRows, items, state.velItem, metricKey);
      BankCharts.drawBankVelocityChart('bankVelocityItemChart', dates, datasets, state.range);
    }

    function renderVelocityCombined() {
        if (!_velRows) return;
        const metricKey = _velMetricKey || 'ewVelocity';
        const { a: aName, b: bName } = velLineLabels(metricKey);
        const allDates = [...new Set(_velRows.map(r => dateKey(r.ts)))].sort();
      const dates = allDates.map(d => new Date(d));

        function sumSeries(colKey) {
         return allDates.map(dk => {
 const day = _velRows.filter(r => dateKey(r.ts) === dk);
    if (!day.length) return null;
        return day.reduce((acc, r) => acc + (isFinite(r[colKey]) ? r[colKey] : 0), 0);
            });
        }

        function maybeNorm(series, norm) {
            if (!norm) return series;
       const first = series.find(v => v != null && v !== 0);
  if (!first) return series;
            return series.map(v => v != null ? (v / first) * 100 : null);
        }

        const datasets = [];
    const toggles = state.velComb;

        if (toggles.breakdown) {
            if (toggles.showA) {
        const s = maybeNorm(sumSeries('a'), toggles.norm);
   datasets.push({ label: `${aName} (Sum)`, data: s, borderColor: '#111827', backgroundColor: 'transparent', tension: 0.2, pointRadius: 1, borderWidth: 2, spanGaps: false });
       }
            if (bName && toggles.showB) {
    const s = maybeNorm(sumSeries('b'), toggles.norm);
         datasets.push({ label: `${bName} (Sum)`, data: s, borderColor: '#111827', backgroundColor: 'transparent', tension: 0.2, pointRadius: 1, borderWidth: 2, borderDash: [5, 4], spanGaps: false });
  }
        }

        const totalSum = allDates.map(dk => {
            const day = _velRows.filter(r => dateKey(r.ts) === dk);
            return day.length ? day.reduce((acc, r) => acc + (r.a || 0) + (r.b || 0), 0) : null;
        });
        datasets.push({ label: 'Total (All Items)', data: maybeNorm(totalSum, toggles.norm), borderColor: '#2563EB', backgroundColor: 'transparent', tension: 0.2, pointRadius: 1, borderWidth: 3, spanGaps: false });

    BankCharts.drawBankVelocityChart('bankVelocityCombinedChart', dates, datasets, state.range);
    }

    // ─── Info Modal ────────────────────────────────────────────────────────────
    function wireInfoModal() {
    document.querySelectorAll('[data-bank-info]').forEach(btn => {
     btn.addEventListener('click', (e) => {
 e.stopPropagation();
    openInfo(btn.getAttribute('data-bank-info'));
    });
        });

        const closeBtn = $('bankInfoModalClose');
   if (closeBtn) closeBtn.addEventListener('click', closeInfo);

   const modal = $('bankInfoModal');
        if (modal) {
   modal.addEventListener('click', (e) => { if (e.target === modal) closeInfo(); });
        }
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeInfo(); });
}

    function openInfo(key) {
        const t = window.BankHelpText && window.BankHelpText[key];
        if (!t) return;

  const modal = $('bankInfoModal');
        const title = $('bankInfoModalTitle');
 const body = $('bankInfoModalBody');
   if (!modal || !title || !body) return;

  title.textContent = t.title || 'Info';
        body.innerHTML = '';

        if (t.bullets && t.bullets.length) {
 const ul = document.createElement('ul');
            t.bullets.forEach(b => {
     const li = document.createElement('li');
      li.textContent = b;
  ul.appendChild(li);
});
        body.appendChild(ul);
    }

        if (t.example) {
            const ex = document.createElement('div');
         ex.className = 'helpExample';
         const exTitle = document.createElement('div');
            exTitle.className = 'helpExampleTitle';
        exTitle.textContent = 'Example';
   const exText = document.createElement('div');
     exText.textContent = t.example;
         ex.appendChild(exTitle);
         ex.appendChild(exText);
     body.appendChild(ex);
        }

    modal.style.display = 'flex';
    }

    function closeInfo() {
        const modal = $('bankInfoModal');
        if (modal) modal.style.display = 'none';
    }

    return { init, renderWealthDonut, renderVelocityItem };
})();
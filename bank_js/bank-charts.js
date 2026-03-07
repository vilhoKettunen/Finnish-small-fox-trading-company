// bank_js/bank-charts.js
window.BankCharts = (function () {
  'use strict';

  const instances = {};

  function destroy(id) {
    if (instances[id]) { instances[id].destroy(); delete instances[id]; }
  }

  // Format a Date object as DD/MM/YYYY using UTC fields so that UTC-midnight
  // dates (created with Date.UTC) are never shifted by the viewer's timezone.
  function fmtDate(ts) {
    if (!ts) return '';
    try {
      const d = String(ts.getUTCDate()).padStart(2, '0');
      const m = String(ts.getUTCMonth() + 1).padStart(2, '0');
   const y = ts.getUTCFullYear();
      return `${d}/${m}/${y}`;
    } catch { return String(ts); }
  }

  function applyRangeFilter(axisDates, datasets, rangeOption) {
    if (!rangeOption || rangeOption === 'all') return { labels: axisDates, datasets };
    const now = new Date();
 let cutoff;
    if (rangeOption === '7d')  cutoff = new Date(now - 7  * 86400000);
    else if (rangeOption === '30d') cutoff = new Date(now - 30 * 86400000);
    else if (rangeOption === '90d') cutoff = new Date(now - 90 * 86400000);
    else if (rangeOption === '1y')  cutoff = new Date(now - 365 * 86400000);
    else return { labels: axisDates, datasets };

    const indices = axisDates.reduce((a, d, i) => { if (d >= cutoff) a.push(i); return a; }, []);
    const filteredLabels = indices.map(i => axisDates[i]);
    const filteredDatasets = datasets.map(ds => ({
      ...ds,
      data: indices.map(i => ds.data[i])
    }));
    return { labels: filteredLabels, datasets: filteredDatasets };
  }

  // ??? Chart 1: EW in Circulation ???????????????????????????????????????????
  function drawCirculationChart(canvasId, axisDates, values, range) {
    destroy(canvasId);
    const ctx = document.getElementById(canvasId); if (!ctx) return;
const raw = { labels: axisDates, datasets: [{ label: 'EW in Circulation', data: values, borderColor: '#2563EB', backgroundColor: 'rgba(37,99,235,0.08)', fill: true, tension: 0.2, pointRadius: 2 }] };
    const filtered = applyRangeFilter(raw.labels, raw.datasets, range);
    instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: { labels: filtered.labels.map(fmtDate), datasets: filtered.datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
      legend: { display: false },
          tooltip: {
    mode: 'index',
            intersect: false,
            callbacks: {
          title: items => items[0].label,
     label: i => `EW in Circulation: ${Number(i.parsed.y).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
      }
      }
    },
      scales: { y: { ticks: { callback: v => v.toLocaleString() } } }
      }
    });
  }

  // ??? Chart 2: Issuance & Destruction ??????????????????????????????????????
  function drawIssuanceDestructionChart(canvasId, axisDates, datasets, range) {
    destroy(canvasId);
    const ctx = document.getElementById(canvasId); if (!ctx) return;
    const filtered = applyRangeFilter(axisDates, datasets, range);
    instances[canvasId] = new Chart(ctx, {
  type: 'line',
      data: { labels: filtered.labels.map(fmtDate), datasets: filtered.datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
     plugins: { legend: { display: true, position: 'top' }, tooltip: { mode: 'index', intersect: false } },
        scales: { y: { ticks: { callback: v => v.toLocaleString() } } }
  }
    });
  }

  // ??? Chart 3: Metal Backing vs EW in Circulation ??????????????????????????
  function drawBackingChart(canvasId, axisDates, datasets, range) {
    destroy(canvasId);
    const ctx = document.getElementById(canvasId); if (!ctx) return;
    const filtered = applyRangeFilter(axisDates, datasets, range);
    instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: { labels: filtered.labels.map(fmtDate), datasets: filtered.datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: true, position: 'top' }, tooltip: { mode: 'index', intersect: false } },
        scales: { y: { ticks: { callback: v => v.toLocaleString() } } }
      }
    });
  }

  // ??? Chart 4: Store Net Worth ?????????????????????????????????????????????
  function drawStoreNetWorthChart(canvasId, axisDates, values, range) {
    destroy(canvasId);
    const ctx = document.getElementById(canvasId); if (!ctx) return;
    const raw = { labels: axisDates, datasets: [{ label: 'Store Net Worth (EW)', data: values, borderColor: '#16A34A', backgroundColor: 'rgba(22,163,74,0.08)', fill: true, tension: 0.2, pointRadius: 2 }] };
    const filtered = applyRangeFilter(raw.labels, raw.datasets, range);
    instances[canvasId] = new Chart(ctx, {
      type: 'line',
  data: { labels: filtered.labels.map(fmtDate), datasets: filtered.datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
       tooltip: {
  mode: 'index',
 intersect: false,
            callbacks: {
      title: i => i[0].label,
          label: i => `Store Net Worth: ${Number(i.parsed.y).toLocaleString(undefined, { maximumFractionDigits: 2 })} EW`
        }
          }
      },
     scales: { y: { ticks: { callback: v => v.toLocaleString() } } }
      }
    });
  }

  // ??? Chart 5: Metal Allocation ????????????????????????????????????????????
  function drawMetalAllocationChart(canvasId, axisDates, perMetalPct, metalNames, mode, range) {
    destroy(canvasId);
    const ctx = document.getElementById(canvasId); if (!ctx) return;
    const palette = BankConfig.METAL_COLOR_PALETTE;
  const datasets = metalNames.map((name, i) => ({
      label: name,
      data: perMetalPct[name] || [],
      borderColor: palette[i % palette.length],
      backgroundColor: mode === 'stacked' ? palette[i % palette.length] : 'transparent',
      fill: mode === 'stacked',
      tension: 0.2,
pointRadius: 1
    }));
    const filtered = applyRangeFilter(axisDates, datasets, range);
    instances[canvasId] = new Chart(ctx, {
 type: 'line',
      data: { labels: filtered.labels.map(fmtDate), datasets: filtered.datasets },
    options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'right' },
      tooltip: {
         mode: 'index', intersect: false,
  callbacks: { label: i => `${i.dataset.label}: ${Number(i.parsed.y || 0).toFixed(1)}%` }
      }
        },
        scales: {
          y: { stacked: mode === 'stacked', ticks: { callback: v => v.toFixed(1) + '%' }, min: 0, max: mode === 'stacked' ? 100 : undefined }
        }
      }
    });
  }

  // ??? Chart 6: Wealth Distribution ????????????????????????????????????????
  // chartStyle: 'stacked' = stacked bar (original), 'line' = multi-line
  function drawWealthDistChart(canvasId, axisDates, perClassSeries, mode, range, chartStyle) {
    destroy(canvasId);
    const ctx = document.getElementById(canvasId); if (!ctx) return;
    const colors = BankConfig.WEALTH_COLORS;
    const isLine = chartStyle === 'line';

    const datasets = [
      { label: 'Top 1%',     data: perClassSeries.top1,  borderColor: colors.top1,  backgroundColor: isLine ? 'transparent' : colors.top1,  stack: 'w', fill: false, tension: 0.2, pointRadius: isLine ? 2 : undefined, borderWidth: isLine ? 2 : undefined },
      { label: 'Next 9%',    data: perClassSeries.next9,  borderColor: colors.next9,  backgroundColor: isLine ? 'transparent' : colors.next9,  stack: 'w', fill: false, tension: 0.2, pointRadius: isLine ? 2 : undefined, borderWidth: isLine ? 2 : undefined },
      { label: 'Next 20%',   data: perClassSeries.next20, borderColor: colors.next20, backgroundColor: isLine ? 'transparent' : colors.next20, stack: 'w', fill: false, tension: 0.2, pointRadius: isLine ? 2 : undefined, borderWidth: isLine ? 2 : undefined },
      { label: 'Bottom 70%', data: perClassSeries.bot70,  borderColor: colors.bot70,  backgroundColor: isLine ? 'transparent' : colors.bot70,  stack: 'w', fill: false, tension: 0.2, pointRadius: isLine ? 2 : undefined, borderWidth: isLine ? 2 : undefined }
    ];

    const filtered = applyRangeFilter(axisDates, datasets, range);

    instances[canvasId] = new Chart(ctx, {
      type: isLine ? 'line' : 'bar',
    data: { labels: filtered.labels.map(fmtDate), datasets: filtered.datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
       legend: { display: true, position: 'top' },
          tooltip: {
    mode: 'index',
  intersect: false,
            callbacks: { label: i => `${i.dataset.label}: ${Number(i.parsed.y || 0).toFixed(mode === 'pct' ? 1 : 0)}${mode === 'pct' ? '%' : ' EW'}` }
          }
        },
        scales: {
      x: { stacked: !isLine },
   y: {
            stacked: !isLine,
            ticks: { callback: v => mode === 'pct' ? v.toFixed(0) + '%' : v.toLocaleString() },
    max: (mode === 'pct' && !isLine) ? 100 : undefined
     }
        }
   }
    });
  }

  // Wealth donut for selected date
  function drawWealthDonut(canvasId, labels, values, colors) {
    destroy(canvasId);
    const ctx = document.getElementById(canvasId); if (!ctx) return;
    const totalEW = values.reduce((s, v) => s + (Number(v) || 0), 0);
    instances[canvasId] = new Chart(ctx, {
  type: 'doughnut',
      data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 2 }] },
      options: {
  responsive: true, maintainAspectRatio: false,
 plugins: {
        legend: { position: 'right' },
      tooltip: {
            callbacks: {
       label: i => {
    const v = Number(i.parsed) || 0;
         const pct = totalEW > 0 ? ((v / totalEW) * 100).toFixed(1) : '0.0';
      return `${i.label}: ${pct}% (${v.toLocaleString(undefined, { maximumFractionDigits: 0 })} EW)`;
    }
            }
          }
  }
      }
    });
  }

  // ??? Section 7: Velocity & Inflation ?????????????????????????????????????
  function drawBankVelocityChart(canvasId, axisDates, datasets, range) {
    destroy(canvasId);
 const ctx = document.getElementById(canvasId); if (!ctx) return;
    const filtered = applyRangeFilter(axisDates, datasets, range);
    instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: { labels: filtered.labels.map(fmtDate), datasets: filtered.datasets },
      options: {
 responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: true, position: 'top' }, tooltip: { mode: 'index', intersect: false } },
        scales: { y: { ticks: { callback: v => v.toLocaleString() } } }
   }
    });
  }

  function drawBankInflationChart(canvasId, axisDates, indexValues, contributingCounts, categoryKey, range, tooltipModel) {
 destroy(canvasId);
    const ctx = document.getElementById(canvasId); if (!ctx) return;

 const isListCategory = categoryKey === 'common' || categoryKey === 'metals';

    let filteredDates = axisDates;
    let filteredValues = indexValues;
    let filteredCounts = contributingCounts;

    if (range && range !== 'all') {
      const now = new Date();
      let cutoff;
      if (range === '7d')  cutoff = new Date(now - 7   * 86400000);
      else if (range === '30d') cutoff = new Date(now - 30* 86400000);
      else if (range === '90d') cutoff = new Date(now - 90  * 86400000);
      else if (range === '1y')  cutoff = new Date(now - 365 * 86400000);

      if (cutoff) {
     const indices = axisDates.reduce((a, d, i) => { if (d >= cutoff) a.push(i); return a; }, []);
   filteredDates  = indices.map(i => axisDates[i]);
        filteredValues = indices.map(i => indexValues[i]);
        filteredCounts = indices.map(i => contributingCounts[i]);
        if (tooltipModel) {
 tooltipModel = {
            totalWeightPerDay:   indices.map(i => tooltipModel.totalWeightPerDay[i]),
   top5ByWeightPerDay:  indices.map(i => tooltipModel.top5ByWeightPerDay[i]),
            missingCountByDay:   indices.map(i => tooltipModel.missingCountByDay[i]),
    missingNamesByDay:   indices.map(i => tooltipModel.missingNamesByDay[i]),
            existingCategoryCount: tooltipModel.existingCategoryCount,
            medianFactorPerDay:  indices.map(i => tooltipModel.medianFactorPerDay[i])
          };
        }
      }
    }

    instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: filteredDates.map(fmtDate),
        datasets: [{
       label: 'Inflation Index (base=100)',
    data: filteredValues,
   borderColor: '#111827',
          backgroundColor: 'rgba(17,24,39,0.08)',
          borderWidth: 2,
        tension: 0.2,
  fill: true,
          pointRadius: 3,
   spanGaps: false
      }]
      },
 options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
      tooltip: {
            intersect: false,
       mode: 'index',
         callbacks: {
   label: function (ctx) {
    const v = ctx.parsed.y;
       if (v == null) return 'No data';
   return 'Index: ' + Number(v).toFixed(2);
        },
    afterBody: function (tooltipItems) {
   if (!tooltipItems || !tooltipItems.length || !tooltipModel) return [];
       const idx = tooltipItems[0].dataIndex;
        const lines = [];
                const n = filteredCounts && isFinite(filteredCounts[idx]) ? filteredCounts[idx] : 0;
         const totalW = tooltipModel.totalWeightPerDay && tooltipModel.totalWeightPerDay[idx] != null ? tooltipModel.totalWeightPerDay[idx] : 0;
     const medFactor = tooltipModel.medianFactorPerDay && tooltipModel.medianFactorPerDay[idx];
      const denom = isListCategory ? (tooltipModel.existingCategoryCount != null ? tooltipModel.existingCategoryCount : null) : null;

    lines.push('Items: ' + n + ' | Total weight: ' + Number(totalW).toFixed(2));
      if (isFinite(medFactor)) lines.push('Median factor: ' + Number(medFactor).toFixed(4));

         const top = (tooltipModel.top5ByWeightPerDay && tooltipModel.top5ByWeightPerDay[idx]) || [];
      if (top.length) {
      lines.push('Top 5 by weight:');
                  top.forEach(function (t, i) {
     const pct = isFinite(t.sharePct) ? t.sharePct : 0;
            const w = isFinite(t.weight) ? t.weight : 0;
        lines.push((i + 1) + ') ' + t.name + ' \u2014 ' + pct.toFixed(1) + '% (w=' + w.toFixed(2) + ')');
 });
      }

     if (isListCategory) {
            const missingCount = tooltipModel.missingCountByDay && tooltipModel.missingCountByDay[idx];
           const missingNames = (tooltipModel.missingNamesByDay && tooltipModel.missingNamesByDay[idx]) || [];
         if (isFinite(denom) && isFinite(missingCount)) lines.push('Missing: ' + missingCount + '/' + denom);
         if (missingNames.length) {
     let missLine = 'Missing: ' + missingNames.join(', ');
               if (isFinite(missingCount) && missingCount > missingNames.length) missLine += ' (+' + (missingCount - missingNames.length) + ' more)';
         lines.push(missLine);
        }
      }

         if (n <= 2 && (denom == null || denom > n)) lines.push('Warning: very few items contributing today; index may look flat.');
    return lines;
              }
 }
        }
        },
        scales: { y: { beginAtZero: false, ticks: { callback: v => Number(v).toFixed(1) } } }
      }
    });
  }

  return {
    destroy,
    drawCirculationChart,
    drawIssuanceDestructionChart,
    drawBackingChart,
    drawStoreNetWorthChart,
  drawMetalAllocationChart,
    drawWealthDistChart,
    drawWealthDonut,
    drawBankVelocityChart,
    drawBankInflationChart
  };
})();

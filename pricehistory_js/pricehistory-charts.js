// pricehistory-charts.js
window.PriceHistory = window.PriceHistory || {};
window.PriceHistory.Charts = (function () {
  const { dateFmt, hexToRgba } = window.PriceHistory.Utils;

  let priceChartInstance = null;
  let middleChartInstance = null;
  let inflationChartInstance = null;

  function destroyAll() {
    if (priceChartInstance) priceChartInstance.destroy();
    if (middleChartInstance) middleChartInstance.destroy();
    if (inflationChartInstance) inflationChartInstance.destroy();
    priceChartInstance = null;
    middleChartInstance = null;
    inflationChartInstance = null;
  }

  function formatLastKnownValue(metric, v) {
    if (v == null || !isFinite(v)) return null;

    if (metric === 'valuation') return Math.round(v).toLocaleString();
    if (metric === 'goal') return Number(v).toFixed(1) + '%';
    if (metric === 'change') return (v > 0 ? '+' : '') + Number(v).toFixed(2);
    if (metric === 'changePct') return (v > 0 ? '+' : '') + Number(v).toFixed(2) + '%';

    if (metric === 'targetStock') return String(Math.round(v));
    if (metric === 'stock') return String(Number(v).toFixed(2));

    // price chart
    if (metric === 'price') return Number(v).toFixed(2);

    return String(v);
  }

  function makeLastKnownAfterBodyCallback(metric, perItemLastKnown) {
    return function (tooltipItems) {
      const lines = [];
      try {
        const idx = tooltipItems?.[0]?.dataIndex;
        if (idx == null) return lines;

        for (const ti of tooltipItems || []) {
          const label = ti.dataset.label;
          const val = ti.parsed?.y;
          if (val != null) continue; // only for gaps

          const last = perItemLastKnown?.get(label)?.[idx];
          const lastV = last?.v;
          const lastD = last?.ts;

          const formatted = formatLastKnownValue(metric, lastV);
          if (!formatted || !lastD) continue;

          lines.push(`${label}: last known ${formatted} on ${dateFmt(lastD)}`);
        }
      } catch {
        // ignore
      }
      return lines;
    };
  }

  function drawPriceChartMulti(axisDates, datasets, tooltipContext) {
    const ctx = document.getElementById('priceChart').getContext('2d');
    if (priceChartInstance) priceChartInstance.destroy();

    const perItemLastKnown = tooltipContext?.perItemLastKnown;

    priceChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: axisDates.map(dateFmt),
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            intersect: false,
            mode: 'index',
            callbacks: perItemLastKnown
              ? {
                  afterBody: makeLastKnownAfterBodyCallback('price', perItemLastKnown)
                }
              : undefined
          }
        },
        interaction: { mode: 'nearest', axis: 'x', intersect: false },
        scales: { y: { beginAtZero: false } }
      }
    });
  }

  function drawMiddleChartMulti(axisDates, chartType, datasets, metric, tooltipContext) {
    const ctx = document.getElementById('metricChart').getContext('2d');
    if (middleChartInstance) middleChartInstance.destroy();

    const perItemLastKnown = tooltipContext?.perItemLastKnown;

    // If bar chart, dataset backgroundColor can be per-bar. For multi-item line charts we just use rgba fill.
    const ds = datasets.map(d => {
      const copy = { ...d };
      if (chartType === 'line') {
        copy.fill = false;
        copy.tension = 0.2;
        copy.pointRadius = 3;
        copy.backgroundColor = hexToRgba(copy.borderColor, 0.12);
      } else {
        copy.borderWidth = 1;
      }
      return copy;
    });

    middleChartInstance = new Chart(ctx, {
      type: chartType,
      data: {
        labels: axisDates.map(dateFmt),
        datasets: ds
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            intersect: false,
            mode: 'index',
            callbacks: {
              label: function (ctx) {
                const v = ctx.parsed.y;
                if (v == null) return `${ctx.dataset.label}: No data`;
                if (metric === 'change') return `${ctx.dataset.label}: ${(v > 0 ? '+' : '') + v}`;
                if (metric === 'changePct') return `${ctx.dataset.label}: ${(v > 0 ? '+' : '') + Number(v).toFixed(2)}%`;
                if (metric === 'goal') return `${ctx.dataset.label}: ${Number(v).toFixed(1)}%`;
                if (metric === 'valuation') return `${ctx.dataset.label}: ${Math.round(v).toLocaleString()}`;
                return `${ctx.dataset.label}: ${v}`;
              },
              ...(perItemLastKnown
                ? { afterBody: makeLastKnownAfterBodyCallback(metric, perItemLastKnown) }
                : {})
            }
          }
        },
        interaction: { mode: 'nearest', axis: 'x', intersect: false },
        scales: {
          y: {
            beginAtZero: metric !== 'valuation',
            ticks: {
              callback: function (value) {
                if (metric === 'changePct' || metric === 'goal') return value + '%';
                return value;
              }
            }
          }
        }
      }
    });
  }

  function drawInflationChart(axisDates, indexValues, contributingCounts, categoryKey, tooltipModel) {
    const ctx = document.getElementById('inflationChart').getContext('2d');

    const titleMap = {
      median: 'Median Item Inflation Index (Weighted median)',
      metals: 'Metal Index (Weighted median)',
      common: 'Common Items Index (Weighted median)',
      selected: 'Selected items index (Weighted median)'
    };

    const subtitle =
      'Index base=100. Per-item baseline=first price in selected range. ' +
      'Weight=stock value (BT)/1000 (ValuationHistory preferred; fallback stock*price).';

    const titleEl = document.getElementById('inflationChartTitle');
    const descEl = document.getElementById('inflationChartDesc');

    // Preserve embedded button
    if (titleEl) {
      const desiredText = titleMap[categoryKey] || 'Inflation Index (base=100)';
      const firstNode = [...titleEl.childNodes].find(n => n.nodeType === Node.TEXT_NODE);
      if (firstNode) {
        firstNode.nodeValue = desiredText + ' ';
      } else {
        titleEl.insertBefore(document.createTextNode(desiredText + ' '), titleEl.firstChild);
      }
    }

    if (descEl) descEl.textContent = subtitle;

    const isListCategory = categoryKey === 'common' || categoryKey === 'metals';

    if (inflationChartInstance) inflationChartInstance.destroy();
    inflationChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: axisDates.map(dateFmt),
        datasets: [
          {
            label: 'Inflation Index (base=100)',
            data: indexValues,
            borderColor: '#111827',
            backgroundColor: 'rgba(17,24,39,0.08)',
            borderWidth: 2,
            tension: 0.2,
            fill: true,
            pointRadius: 3,
            spanGaps: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            intersect: false,
            mode: 'index',
            callbacks: {
              label: function (ctx) {
                const v = ctx.parsed.y;
                if (v == null) return 'No data';
                return `Index: ${v.toFixed(2)}`;
              },
              afterBody: function (tooltipItems) {
                if (!tooltipItems || !tooltipItems.length) return [];
                const idx = tooltipItems[0].dataIndex;

                const lines = [];

                const n = contributingCounts && isFinite(contributingCounts[idx]) ? contributingCounts[idx] : 0;
                const totalW = tooltipModel?.totalWeightPerDay?.[idx] ?? 0;
                const medFactor = tooltipModel?.medianFactorPerDay?.[idx];

                const denom = isListCategory ? tooltipModel?.existingCategoryCount ?? null : null;

                lines.push(`Items: ${n} | Total weight: ${Number(totalW).toFixed(2)}`);
                if (isFinite(medFactor)) lines.push(`Median factor: ${Number(medFactor).toFixed(4)}`);

                const top = tooltipModel?.top5ByWeightPerDay?.[idx] || [];
                if (top.length) {
                  lines.push('Top5 by weight:');
                  top.forEach((t, i) => {
                    const pct = isFinite(t.sharePct) ? t.sharePct : 0;
                    const w = isFinite(t.weight) ? t.weight : 0;
                    lines.push(`${i + 1}) ${t.name} — ${pct.toFixed(1)}% (w=${w.toFixed(2)})`);
                  });
                }

                if (isListCategory) {
                  const missingCount = tooltipModel?.missingCountByDay?.[idx];
                  const missingNames = tooltipModel?.missingNamesByDay?.[idx] || [];

                  if (isFinite(denom) && isFinite(missingCount)) lines.push(`Missing: ${missingCount}/${denom}`);

                  if (missingNames.length) {
                    let missLine = `Missing items: ${missingNames.join(', ')}`;
                    if (isFinite(missingCount) && missingCount > missingNames.length) {
                      missLine += ` (+${missingCount - missingNames.length} more)`;
                    }
                    lines.push(missLine);
                  }
                }

                if (n <= 2 && (denom == null || denom > n)) {
                  lines.push('Warning: very few items contributing today; index may look flat.');
                }

                return lines;
              }
            }
          }
        },
        interaction: { mode: 'nearest', axis: 'x', intersect: false },
        scales: { y: { beginAtZero: false } }
      }
    });
  }

  return {
    destroyAll,
    drawPriceChartMulti,
    drawMiddleChartMulti,
    drawInflationChart
  };
})();

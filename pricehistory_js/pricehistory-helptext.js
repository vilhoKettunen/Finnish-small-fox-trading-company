// pricehistory-helptext.js
// Content-only file.
// Editing this file should NOT require changes to UI logic.
window.PriceHistory = window.PriceHistory || {};
window.PriceHistory.HelpText = {
  controls: {
    title: 'How to use this page',
    bullets: [
      'Pick Buy/Sell sheet to choose which price history to display.',
      'Add up to10 items into your selection, then click Apply to load charts for those items.',
      'Time Range changes apply immediately to all charts.',
      'Middle Chart Metric only changes the middle chart and updates immediately.',
      'Inflation Index Category only changes the inflation chart and updates immediately.'
    ],
    example: 'Example: Add “Flax Twine” and “Leather”, click Apply, then switch Middle Metric to “Valuation” to compare their value over time.'
  },
  price: {
    title: 'Price Trend',
    bullets: [
      'Shows the recorded price history for each applied item.',
      'Each item has its own color so you can compare trends.',
      'You can optionally show a Combined line which is a valuation-weighted average price of your selected items.',
      'If “Normalize combined to100” is enabled, the combined line starts at100 so you can compare relative change.'
    ],
    example: 'Example: If you enable Combined, the combined price is pulled more towards items that make up more total value that day.'
  },
  middle: {
    title: 'Middle Chart',
    bullets: [
      'Shows a second metric for the same applied items (stock, valuation, goal progress, etc.).',
      'Some metrics support an optional Combined Sum line (stock / valuation / target stock).',
      'For multi-item daily change charts, the view switches to lines for readability.'
    ],
    example: 'Example: Pick “Stock Amount” to see each item’s stock line. Enable “Combined sum” to see the total stock across all selected items.'
  },
  metric: {
    title: 'Middle Chart Metric (how it works)',
    bullets: [
      'Stock Amount: how many stacks are recorded for each item on each day.',
      'Daily Price Change (+/-): day-to-day price difference for each item (today minus yesterday).',
      'Daily Price Change (%): day-to-day percent change for each item.',
      'Total Valuation: the recorded total value of the item’s held stock (from ValuationHistory).',
      'Goal Stock %: how close each item is to its target goal (shown as a percent).',
      'Target stock stack: the target stock level for the item (from TargetStockHistory).'
    ],
    example: 'Tip: Use “Valuation” to see which items contribute most to your inventory value, and “Change %” to see which items are most volatile.'
  },
  index: {
    title: 'Inflation Index Category (how it works)',
    bullets: [
      'The inflation index is calculated across many items (not just your selected items).',
      'Each item’s baseline is its first price inside the selected time range.',
      'Per-item inflation factor = (current price / baseline price).',
      'Items are weighted by how much value they represent in stock ( ValuationHistory preferred; fallback stock * price ).',
      'Median Item Inflation Index: uses all items available in the selected sheet and range.',
      'Metal Index / Common Items Index: uses only a predefined allowlist of items (and shows missing counts in tooltip).'
    ],
    example: 'Example: If most metal items are20% higher than their baseline, the Metal Index will trend toward ~120.'
  },
  inflation: {
    title: 'Inflation Index',
    bullets: [
      'This index is calculated across many items (not just your selected items).',
      'It compares today’s prices to each item’s first price in the selected range.',
      'Heavier items (more value in stock) affect the index more.'
    ],
    example: 'Example: If metal prices rise across the board, the Metal Index will trend upward.'
  },
  // Base text used by the dynamic middle-chart "More info" button.
  // The UI will prepend the currently selected metric name and then append metric-specific details.
  middleDynamicBase: {
    title: 'Middle Chart',
    bullets: [
      'The middle chart shows a second metric for the SAME applied item selection as the price chart.',
      'Changing the metric updates the middle chart immediately (no need to click Apply again).',
      'Some metrics can optionally show a Combined sum line (stock / valuation / target stock).',
      'Missing values are shown as gaps (nulls). A gap means there was no recorded value for that day (not zero).'
    ],
    example: 'Tip: Use “Valuation” to compare total value. Use “Stock Amount” to compare inventory levels.'
  },

  // Base text used by the dynamic inflation "More info" button.
  // The UI will prepend the currently selected category name and then append category-specific details.
  inflationDynamicBase: {
    title: 'Inflation Index',
    bullets: [
      'The inflation index is calculated across many items (not just your selected items), unless you choose the “Selected items index”.',
      'Each item’s baseline is its first price inside the selected time range.',
      'Per-item inflation factor = (current price / baseline price).',
      'Weights prefer ValuationHistory; if missing, weight falls back to stock × price (less accurate).'
    ],
    example: 'Example: If most items are20% higher than their baseline, the index trends toward ~120.'
  },
  metricSystem: {
    title: 'More info (metrics)',
    bullets: [
      'Stock Amount: shows the recorded stock stacks for each item.',
      'Daily Price Change (+/-): day-to-day price difference for each item (today minus yesterday).',
      'Daily Price Change (%): day-to-day percent change for each item.',
      'Total Valuation: recorded total value for the item (from ValuationHistory).',
      'Goal Stock %: progress toward the goal (shown as percent).',
      'Target stock stack: the target stock value (from TargetStockHistory).'
    ],
    example: 'Tip: “Change %” helps find volatility. “Valuation” helps find what parts of your inventory are most valuable.'
  },
  indexSystem: {
    title: 'More info (categories)',
    bullets: [
      'Median Item Inflation Index: uses all items available in the selected sheet and range.',
      'Metal Index: uses a predefined allowlist of metal items.',
      'Common Items Index: uses a predefined allowlist of common items.',
      'Selected items index: uses ONLY your currently applied item selection (your “basket”).',
      'Tooltips may show missing items for list-based categories if some allowlist items are not present today.'
    ],
    example: 'Tip: Use “Selected items index” to track inflation for the same items you are charting above.'
  }
};

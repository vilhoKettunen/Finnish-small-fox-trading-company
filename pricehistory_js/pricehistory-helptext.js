// pricehistory-helptext.js
// Content-only file.
// Keep this file UTF-8 and prefer plain ASCII quotes to avoid encoding issues.
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
 example:
 'Example: Add "Flax Twine" and "Leather", click Apply, then switch Middle Metric to "Valuation" to compare their value over time.'
 },

 price: {
 title: 'Price Trend',
 bullets: [
 'Shows the recorded price history for each applied item.',
 'Each item has its own color so you can compare trends.',
 'You can optionally show a Combined line which is a valuation-weighted average price of your selected items.',
 'If "Normalize combined to100" is enabled, the combined line starts at100 so you can compare relative change.'
 ],
 example:
 'Example: If you enable Combined, the combined price is pulled more towards items that make up more total value that day.'
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
 example:
 'Tip: "Change %" helps find volatility. "Valuation" helps find what parts of your inventory are most valuable.'
 },

 indexSystem: {
 title: 'More info (categories)',
 bullets: [
 'Median Item Inflation Index: uses all items available in the selected sheet and range.',
 'Metal Index: uses a predefined allowlist of metal items.',
 'Common Items Index: uses a predefined allowlist of common items.',
 'Selected items index: uses ONLY your currently applied item selection (your "basket").',
 'Tooltips may show missing items for list-based categories if some allowlist items are not present today.'
 ],
 example:
 'Tip: Use "Selected items index" to track inflation for the same items you are charting above.'
 },

 // Dynamic info base blocks (still used for high-level framing)
 middleDynamicBase: {
 title: 'Middle Chart',
 bullets: [
 'The middle chart shows a second metric for the SAME applied item selection as the price chart.',
 'Changing the metric updates the middle chart immediately (no need to click Apply again).',
 'Missing values are shown as gaps (nulls). A gap means there was no recorded value (not zero).'
 ]
 },

 inflationDynamicBase: {
 title: 'Inflation Index',
 bullets: [
 'The inflation index is calculated across many items (not just your selected items), unless you choose the "Selected items index".',
 'Each item baseline is its first price inside the selected time range.',
 'Per-item inflation factor = current price / baseline price.',
 'Weights: ValuationHistory preferred; fallback stock x price if valuation is missing (less accurate).'
 ]
 },

 // Per-metric dynamic help registry
 middleMetricHelp: {
 stock: {
 bestFor: 'Tracking inventory levels over time (how much you have).',
 bullets: [
 'Data source: StockHistory (stacks recorded each day).',
 'Missing values: gaps mean no stock was recorded that day.',
 'Interpretation: fractional stacks are allowed and mean partial stacks.'
 ],
 example: 'Example: Use Stock Amount to see if you are steadily consuming an item faster than you restock it.'
 },
 valuation: {
 bestFor: 'Comparing your inventory value over time and which items matter most by value.',
 bullets: [
 'Data source: ValuationHistory (BT value recorded for the item).',
 'Missing values: gaps mean ValuationHistory has no record for that day (it is not treated as0).',
 'Interpretation: valuation is the preferred value signal when available.'
 ],
 example: 'Example: If valuation spikes while stock stays flat, the market price likely increased.'
 },
 targetStock: {
 bestFor: 'Visualizing your target stock plan (goal stacks) and when it changes.',
 bullets: [
 'Data source: TargetStockHistory (target stacks recorded).',
 'Missing values: gaps mean no target was recorded / changed on that day.',
 'Interpretation: targets are usually whole stacks and may change in steps.'
 ],
 example: 'Example: If Target Stock jumps up, it usually means you increased your desired inventory buffer.'
 },
 goal: {
 bestFor: 'Seeing how close you are to a goal as a percentage.',
 bullets: [
 'Data source: GoalHistory (stored as a fraction) and displayed as percent (value x100).',
 'Missing values: gaps mean no goal record exists for that day.',
 'Interpretation:100% means the goal is reached.'
 ],
 example: 'Example: If Goal % drops while stock is steady, the goal target may have increased.'
 },
 change: {
 bestFor: 'Spotting price spikes and dips quickly (absolute change).',
 bullets: [
 'Formula: change[t] = price[t] - price[t-1] per item.',
 'Missing values: if either day price is missing, change is shown as a gap.',
 'Chart behavior: single item may be shown as bars; multiple items shown as lines for readability.'
 ],
 example: 'Example: A +20 change means the item price jumped by20 compared to the previous day.'
 },
 changePct: {
 bestFor: 'Comparing volatility between cheap and expensive items (relative change).',
 bullets: [
 'Formula: changePct[t] = ((price[t] - price[t-1]) / price[t-1]) x100 per item.',
 'Missing values: gaps happen when yesterday price is missing or0.',
 'Chart behavior: single item may be shown as bars; multiple items shown as lines for readability.'
 ],
 example: 'Example: +10% means today is10% higher than yesterday, regardless of absolute price level.'
 }
 },

 // Per-category dynamic help registry
 inflationCategoryHelp: {
 median: {
 bestFor: 'A broad "whole market" inflation signal across all items in the sheet.',
 bullets: [
 'Items used: all items with prices in the selected sheet and time range.',
 'Behavior: tends to be smoother because many items contribute each day.',
 'Use when: you want a general inflation trend rather than a focused basket.'
 ],
 example: 'Example: If most items drift up over time, the median index rises steadily.'
 },
 metals: {
 bestFor: 'Tracking inflation specifically for metal-related items.',
 bullets: [
 'Items used: the configured metals allowlist (listed below).',
 'Missing: if some allowlist items have no price/weight that day, the index composition changes (see tooltip missing info).',
 'Use when: metal prices behave differently from common materials.'
 ],
 example: 'Example: If metal ingots rise due to demand, Metals index increases even if common items stay flat.'
 },
 common: {
 bestFor: 'Tracking inflation for common materials used frequently.',
 bullets: [
 'Items used: the configured common items allowlist (listed below).',
 'Missing: if allowlist items are missing that day, the index may be less stable and composition changes.',
 'Use when: you want a signal closer to "everyday crafting" material costs.'
 ],
 example: 'Example: If common crafting materials become scarce, the Common index trends upward.'
 },
 selected: {
 bestFor: 'Tracking inflation for your own applied item basket (the same items you are charting).',
 bullets: [
 'Items used: your currently applied item selection.',
 'Warning: if you change applied items, this index changes composition and is not comparable to earlier runs unless the basket stays the same.',
 'Use when: you want to measure how your tracked items inflate relative to their baselines.'
 ],
 example: 'Example: If you track only building materials, the Selected index shows inflation for that specific basket.'
 }
 }
};

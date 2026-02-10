// pricehistory-config.js
// Global namespace
window.PriceHistory = window.PriceHistory || {};
window.PriceHistory.Config = {
  USER_LOCALE: (navigator.languages && navigator.languages[0]) || 'en-GB',
  SPREADSHEET_ID: '1_meliJtuKSDwEWRDh1gldcsD-pSjDgIND3dcE1mCjCo',

  // Keep true only when debugging inflation behavior.
  DEBUG_INFLATION: true,

  INFLATION_LISTS: {
    metalsCsv:
      'SILVER INGOT,GOLD INGOT,STEEL INGOT,COPPER INGOT,IRON INGOT,TIN INGOT,ZINK INGOT,BISMUTH INGOT,NICKEL INGOT,LEAD INGOT,meteoric iron INGOT',
    commonCsv:
      '(RG) RUSTY GEARS,FLAX TWINE,Beeswax,Candles,Fat,Leather,Linen,Resin,BLUE CLAY,FIRE CLAY,RED CLAY,charcoal'
  },

  LIMITS: {
    MAX_ITEMS: 10
  },

  STORAGE_KEYS: {
    PRESET: 'pricehistory:preset:v1'
  },

  // Deterministic palette for items. Colors should be distinct and readable.
  // Must contain at least 10 distinct colors.
  ITEM_COLOR_PALETTE: [
    '#2563EB', // blue
    '#DC2626', // red
    '#16A34A', // green
    '#7C3AED', // purple
    '#EA580C', // orange
    '#0891B2', // cyan
    '#DB2777', // pink
    '#4B5563', // gray
    '#CA8A04', // amber
    '#0F766E', // teal
    '#9333EA', // violet
    '#1D4ED8', // indigo
    '#BE123C', // rose
    '#15803D' // dark green
  ],

  // Combined line styling
  COMBINED_COLOR: '#111827',

  DEFAULTS: {
    showCombinedPrice: false,
    normalizeCombinedTo100: false,
    showCombinedMiddleSum: false,
    // For multi-item change/changePct readability
    multiItemChangeChartType: 'line'
  }
};

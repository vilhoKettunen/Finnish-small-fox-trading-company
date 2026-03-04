// pricehistory-config.js
// Global namespace
window.PriceHistory = window.PriceHistory || {};
window.PriceHistory.Config = {
  USER_LOCALE: (navigator.languages && navigator.languages[0]) || 'en-GB',

  // Legacy default spreadsheet id. Kept for backwards compatibility in older pages/utilities.
  SPREADSHEET_ID: '1_meliJtuKSDwEWRDh1gldcsD-pSjDgIND3dcE1mCjCo',

  // New: each history dataset lives in its own spreadsheet.
  // All destination spreadsheets use tab name `History`.
  HISTORY_SHEETS: {
    BuyHistory:         { spreadsheetId: '1B3uNkzsep1JdZxTtBTL0xwm1-hhoJKh2pTtMzRmkuHY', tabName: 'History' },
    SellHistory:        { spreadsheetId: '1siICPt1qzBfJFlXTtTWlwwZw4cUw0p9g3zoe2cUouBI', tabName: 'History' },
    ValuationHistory:   { spreadsheetId: '14fHs-CDv53F4ZynAGem1ESKz-kngjjf0Tj0_K1OygsM', tabName: 'History' },
    GoalHistory:        { spreadsheetId: '1DkPjABNTCqbOkasPnTI7DF9C8GNafujqWAuMb9SY4zk', tabName: 'History' },
    TargetStockHistory: { spreadsheetId: '13TxnisJImLlYwDTme9ihuHj9CPRubFfAyYFWcPm-RmE', tabName: 'History' },

    // Velocity histories
    EwVelocity:         { spreadsheetId: '1frHtigWQ6Tz_7rd14pkqGqKiQwMXfcZ4Ttb385luJDY', tabName: 'History' },
    VelocityVolume:     { spreadsheetId: '1VWSnlydtB_x49X5R0nj7la0LaxQiorq9dlMBslMVRXw', tabName: 'History' },
    OcmVolume:          { spreadsheetId: '1yDJ7qH6Kky58Ar5ft9WyAlEx-XfHOcV3mrp4Q67YQAQ', tabName: 'History' },
    UniqueTraders:      { spreadsheetId: '1XvwJHZh1aLYU2ckikUNCTbSO0_obAOiG7HvHQH-AGq0', tabName: 'History' },
    TradeCount:         { spreadsheetId: '1ea803qSnyaxmiJILcgdOJYVWd4Kl7vTOCrbVKNkJh48', tabName: 'History' }
  },

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
    // New: normalize each item line to base=100 for the visible range
    normalizePriceItemsTo100: false,

    showCombinedMiddleSum: false,
    // For multi-item change/changePct readability
    multiItemChangeChartType: 'line',

    // Velocity defaults
    velocityMetric: 'ewVelocity',
    velocityShowBreakdown: true,
    velocityShowCombinedSum: false,
    velocityNormalizeTo100: false,
    velocityShowA: true,
    velocityShowB: true
  }
};

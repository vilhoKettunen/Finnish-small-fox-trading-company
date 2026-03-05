// bank_js/bank-config.js
window.BankConfig = {
  METALS_LIST: [
    'Silver Ingot', 'Gold Ingot', 'Steel Ingot', 'Copper Ingot', 'Iron Ingot',
    'Tin Ingot', 'Zink Ingot', 'Bismuth Ingot', 'Nickel Ingot', 'Lead Ingot',
    'Meteoric Iron Ingot'
  ],
  // Used by Chart 4 (Store Net Worth sentinel).
  // NOTE: if "Resin" is ever removed from the Items sheet, Chart 4 will return no data.
  NET_WORTH_SENTINEL_ITEM: 'Resin',

  SHEETS: {
    EwInCirculation:    { spreadsheetId: '12RYKtKASvZyDyfcuZ0UugH_A-qB3MuulPQ1pIZk2ipI', tabName: 'History' },
WealthDistribution: { spreadsheetId: '1cs84NhesNLULSfRKz_u3GM7sDv-kq3o2qlg9qpBvsIc', tabName: 'History' },
    EwDestroyedHistory: { spreadsheetId: '1U1aCNTuRPM47qEte6dJHd2wVTMP-BtcUgIUsWw2lQBE', tabName: 'History' },
    ValuationHistory:   { spreadsheetId: '14fHs-CDv53F4ZynAGem1ESKz-kngjjf0Tj0_K1OygsM', tabName: 'History' },
    EwVelocity:         { spreadsheetId: '1frHtigWQ6Tz_7rd14pkqGqKiQwMXfcZ4Ttb385luJDY', tabName: 'History' },
    VelocityVolume:     { spreadsheetId: '1VWSnlydtB_x49X5R0nj7la0LaxQiorq9dlMBslMVRXw', tabName: 'History' },
    OcmVolume:        { spreadsheetId: '1yDJ7qH6Kky58Ar5ft9WyAlEx-XfHOcV3mrp4Q67YQAQ', tabName: 'History' },
    UniqueTraders:      { spreadsheetId: '1XvwJHZh1aLYU2ckikUNCTbSO0_obAOiG7HvHQH-AGq0', tabName: 'History' },
    TradeCount: { spreadsheetId: '1ea803qSnyaxmiJILcgdOJYVWd4Kl7vTOCrbVKNkJh48', tabName: 'History' }
  },

  WEALTH_COLORS: {
    top1:   '#16A34A',  // green
    next9:  '#2563EB',  // blue
    next20: '#CA8A04',  // yellow/amber
 bot70:  '#DC2626'   // red
  },

  METAL_COLOR_PALETTE: [
    '#2563EB', '#DC2626', '#16A34A', '#7C3AED', '#EA580C',
    '#0891B2', '#DB2777', '#4B5563', '#CA8A04', '#0F766E', '#9333EA'
  ],

  RANGE_OPTIONS: ['7d', '30d', '90d', '1y', 'all'],
  DEFAULT_RANGE: 'all'
};

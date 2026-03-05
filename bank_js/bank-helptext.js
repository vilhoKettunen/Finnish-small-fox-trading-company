// bank_js/bank-helptext.js
// Help text for the Bank page info modal.
// Keep this file UTF-8 and prefer plain ASCII quotes to avoid encoding issues.
window.BankHelpText = {

    // ─── Intro panel: EW currency explanation (inline collapsible) ──────────
    ewCurrency: {
        title: 'About EW (Exchange Weight)',
        bullets: [
            'EW is a fully liquid in-game trading currency. It is not permanently pegged to any single item or metal.',
            'You earn EW by selling items to the store, and spend EW to buy items from the store.',
            'EW allows players to trade across different item categories without needing to barter item-for-item.',
            'The value of EW is maintained through the store\'s metal reserves and controlled issuance.',
            'Insurance / backing: when the store has sufficient reserves, holding more than 500 EW gives you the option to request the equivalent value in metals, delivered to your deposit box.',
            'Long-term goal: keep metal reserves above 100% of total EW in circulation so the system remains solvent even in worst-case scenarios.',
            'This goal was achieved during the last wipe. The 2026 wipe outcome depends on how quickly reserves build back up.'
        ],
        example: 'Example: You sell 10 Steel Ingots and receive 200 EW. You then spend 150 EW to buy food items you need. If you hold 600 EW, you can optionally convert back to metals via the insurance option.'
    },

    // ─── Intro panel: full page guide ───────────────────────────────────────
    pageGuide: {
        title: 'Page Guide',
        bullets: [
            'TIME RANGE selector (top of page): filters ALL charts to the chosen window (7d / 30d / 90d / 1y / All). Change it once and every chart updates.',
            'CHART 1 — EW in Circulation: shows the total EW held by all active players each day. Tracks whether the money supply is growing or shrinking.',
            'CHART 2 — Issuance & Destruction: shows daily EW created (store sells) vs destroyed (store buys + OCM fees). Use the toggle buttons to isolate Store Buy, OCM Fees, or Net Change.',
            'CHART 3 — Metal Backing vs Circulation: compare the metal reserve value against total EW. Switch between raw EW values or a backing-% ratio. Use the toggle buttons to show/hide each line.',
            'CHART 4 — Store Net Worth: total EW-equivalent value of everything in the store inventory, measured daily. Includes all items, not just metals.',
            'CHART 5 — Metal Allocation %: shows which metals make up the store\'s reserve and in what proportion. Switch between a multi-line view and a stacked-area view.',
            'CHART 6 — Wealth Distribution: stacked bar chart showing how EW is shared among the player base. Switch between % of total and raw EW amounts. The snapshot donut at the bottom shows a single-day breakdown for any date you pick.',
            'INFRASTRUCTURE INVESTMENTS: a transparent log of store inventory used for community infrastructure projects. Click "More Info" on any entry for the full description.',
            'VELOCITY & INFLATION (collapsible, click to expand): advanced daily trade-activity charts. Choose a metric (EW Velocity, Store Volume, OCM Volume, Unique Traders, Trade Count) and view per-item or combined totals. Normalize-to-100 lets you compare relative trends across items of different scales.'
        ]
    },

    circulation: {
        title: 'EW in Circulation',
        bullets: [
            'Shows the total amount of EW held by all active players combined, recorded once per day.',
            'A rising trend means EW is being introduced faster than it is destroyed (inflation risk).',
            'A falling trend means EW is being destroyed faster than issued (deflation).',
            'Deleted / merged accounts are excluded so only live balances count.'
        ],
        example: 'Example: If the line jumps after a busy trading week, it means more EW was issued (via store sells) than destroyed (via store buys + OCM fees).'
    },

    issuance: {
        title: 'Currency Issuance & Destruction',
        bullets: [
            'EW Issued: the total EW that entered the economy each day through store sell transactions (players selling items, receiving EW).',
            'EW Destroyed (combined): store buy totals + OCM fees summed, representing EW removed from circulation.',
            'Store Buy: the store-buy portion of destruction only (EW spent by players buying from store).',
            'OCM Fees: the OCM transaction fee portion of destruction only (10% admin-executed fee).',
            'Net EW Change: Issued minus Destroyed for that day; positive = net inflation, negative = net deflation.',
            'Toggle the buttons above the chart to show/hide individual series.'
        ],
        example: 'Example: If "EW Issued" is consistently higher than "EW Destroyed", the total circulation (Chart 1) will trend upward.'
    },

    backing: {
        title: 'Metal Backing vs EW in Circulation',
        bullets: [
            'Metal Backing (EW): the total EW-equivalent value of all metal ingots held in the store inventory.',
            'EW in Circulation: the same series as Chart 1, overlaid for comparison.',
            'Backing % mode: Metal Backing divided by EW in Circulation, expressed as a percentage.',
            '100% means every EW in circulation is fully backed by metals. >100% = over-backed (safer).',
            'The long-term goal is to maintain backing >= 100% so that a "bank run" would not collapse the system.',
            'Switch between Raw and % modes using the Mode dropdown.'
        ],
        example: 'Example: If the ratio falls below 100%, it means the store holds fewer metals by value than total EW in circulation.'
    },

    storeNetWorth: {
        title: 'Store Net Worth',
        bullets: [
            'Shows the total EW-equivalent value of ALL store inventory combined, recorded once per day.',
            'This uses the ValuationHistory sheet, which records each item\'s value (price * stock) daily.',
            'A higher net worth means the store holds more valuable inventory overall.',
            'This is different from metal backing, which counts only metal ingots. Net worth includes everything.',
            'Technical note: the chart uses the "TotalValuation" column which is pre-summed across all items per day.'
        ],
        example: 'Example: If the store restocks a large quantity of high-value items, the net worth will spike upward on that day.'
    },

    metalAlloc: {
        title: 'Metal Allocation %',
        bullets: [
            'Shows what percentage each metal type contributes to the total metal backing value.',
            'Multi-line mode shows each metal as a separate line.',
            'Stacked Area mode shows the full 100% split between metals over time.',
            'A metal with a large share dominates the backing; a more even spread means diversified reserves.',
            'Percentages are computed from ValuationHistory data (per-item valuation each day).',
            'Days with no valuation data for a metal will show as a gap in that metal\'s line.'
        ],
        example: 'Example: If Silver Ingot is 60% of the chart, silver is the dominant reserve metal on those days.'
    },

    wealthDist: {
        title: 'Wealth Distribution Over Time',
        bullets: [
            'Shows how EW is distributed among active players over time.',
            '"Top 1%": the wealthiest ~1% of players by EW balance.',
            '"Next 9%": players ranked 2%-10% by balance.',
            '"Next 20%": players ranked 11%-30%.',
            '"Bottom 70%": the remaining players.',
            'Percentage mode (default): shows each class\'s share of total EW. Helps compare relative wealth concentration.',
            'Raw EW mode: shows absolute EW amounts per class.',
            'The snapshot donut at the bottom shows the distribution for a single selected date.',
            'Only players with balance > 0 and not deleted/merged are included.'
        ],
        example: 'Example: If Top 1% holds 80% of the EW, wealth is highly concentrated. A healthy economy might see a more even distribution.'
    },

    infra: {
        title: 'Infrastructure Investments',
        bullets: [
            'Records items removed from store inventory for infrastructure purposes (e.g. building, server costs, community projects).',
            'Each investment has a short description (shown in the list) and a long description (shown in detail view).',
            'Click "More Info" on any investment card to read the full description.',
            'Items listed were removed from stock at the time of the investment submission.',
            'These are admin-only submissions and represent transparent spending of store inventory.'
        ],
        example: 'Example: If the store invested 50 Steel Ingots in building a new market stall, it would appear here with a description of the project.'
    },

    velocity: {
        title: 'Velocity & Inflation',
        bullets: [
            'Velocity charts show daily trade activity metrics aggregated from store requests and OCM trades.',
            'EW Velocity: daily EW buy vs sell totals across all items.',
            'Store Volume: quantities bought vs sold in the store each day.',
            'OCM Volume: quantities traded on OCM per day.',
            'Unique Traders: distinct player counts for store vs OCM per day.',
            'Trade Count: number of store requests vs OCM trades completed per day.',
            'Per-item chart shows the top 10 items individually.',
            'Combined chart sums all items together.',
            'Both charts have independent toggles: Show breakdown (A vs B lines), Show A, Show B, and Normalize to 100.',
            'Normalize to 100: scales each dataset so its first non-zero value becomes 100, showing relative change.'
        ],
        example: 'Example: Use the EW Velocity metric with breakdown ON to see whether store buys or sells dominate on a given day.'
    },

    inflationIndex: {
        title: 'Inflation Index (base=100)',
        bullets: [
            'Shows how prices have changed relative to the start of the selected time range.',
            'Base = 100: a value of 110 means prices are on average 10% higher than at the start of the range.',
            'Weighted median: items with higher stock value (in EW) contribute more to the index.',
            '"Median (all items)" category uses every item in the store — broadest view.',
            '"Metal Index" uses only metal ingots — tracks metal price inflation specifically.',
            '"Common Items" uses a fixed list of frequently traded everyday items.',
            '"Selected items" uses only the items you add via the item selector above the chart.',
            'Weight formula: stock value (price \u00d7 stock, or ValuationHistory when available) \u00f7 1000.',
            'Days where an item has no price data appear as gaps in the chart line.',
            'Use the item selector to add up to 10 items, then choose "Selected items" as the category to track your own basket of goods.',
            'The global Time Range selector at the top of the page also applies to this chart.'
        ],
        example: 'Example: An index value of 120 on a given day means the weighted-average price of items in the selected category is 20% higher than on the first day of the chosen time range.'
    }

};
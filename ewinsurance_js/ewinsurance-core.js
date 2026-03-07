/* ewinsurance_js/ewinsurance-core.js
   Core state + data loading for EW Insurance page.
   Exposes window.EWIns namespace.
*/

(function () {
    'use strict';

    const METALS_LIST = [
        'Silver', 'Gold', 'Steel', 'Copper', 'Iron',
        'Tin', 'Zinc', 'Bismuth', 'Nickel', 'Lead', 'Meteoric Iron'
    ];

    const PUBLIC_PRICE_CATALOG_ID = '1_meliJtuKSDwEWRDh1gldcsD-pSjDgIND3dcE1mCjCo';

    const state = {
        idToken:    null,
        user:       null,
        isAdmin:    false,
        balance: 0,
        policies:   [],
        priceItems: []
    };

    async function loadPolicies() {
        if (!state.idToken) return;
        const r = await window.apiGet('insuranceListMy', { idToken: state.idToken });
        const d = r.data || r.result || r;
        state.policies = d.policies || [];
  }

    async function loadPriceItems_() {
        try {
            const url = 'https://docs.google.com/spreadsheets/d/' +
         PUBLIC_PRICE_CATALOG_ID + '/gviz/tq?tqx=out:json';
   const resp = await fetch(url);
  const text = await resp.text();
            const start = text.indexOf('(');
   const json = JSON.parse(text.substring(start + 1, text.length - 2));
   const rows = (json.table && json.table.rows) || [];
            const items = rows.map(r => {
  const c = i => (r.c && r.c[i] && r.c[i].v !== undefined) ? r.c[i].v : null;
    const name = c(0) ? String(c(0)).trim() : null;
     if (!name) return null;
     return {
     name,
      bundleSize: parseFloat(c(4)) || 1,
    buyEW:      parseFloat(c(5)) || 0,
 sellEW:     parseFloat(c(6)) || 0
  };
  }).filter(Boolean);
         state.priceItems = items;
       return items;
        } catch (e) {
     return [];
        }
    }

    // Client-side metal estimate — only used when policy.currentEstimate is absent.
    // priceItems must be passed in; if empty the function returns zeroed results gracefully.
    function calcEstimate(ewAmount, allocObj, priceItems) {
        const items = Array.isArray(priceItems) ? priceItems : [];
        const metals = {};
        let totalInsuredEW  = 0;
        let totalLeftoverEW = 0;

        for (const [metal, pct] of Object.entries(allocObj)) {
          const p = Number(pct);
   if (!p || p <= 0) continue;

          const ewForMetal = (p / 100) * ewAmount;

   const ingotItem  = items.find(pi => pi.name.includes(metal + ' Ingot'));
      const nuggetItem = (metal !== 'Steel')
        ? items.find(pi => pi.name.includes(metal + ' Nuggets') || pi.name.includes(metal + ' Nugget'))
      : null;

       const ingotPrice  = ingotItem  ? ingotItem.sellEW  : 0;
       const nuggetPrice = nuggetItem ? nuggetItem.sellEW : 0;

            const ingots = ingotPrice  > 0 ? Math.floor(ewForMetal / ingotPrice)  : 0;
            const rem      = ewForMetal - (ingots * ingotPrice);
       const nuggets  = nuggetPrice > 0 ? Math.floor(rem / nuggetPrice) : 0;
     const insured  = (ingots * ingotPrice) + (nuggets * nuggetPrice);
            const leftover = ewForMetal - insured;

            metals[metal + ' Ingot'] = { ingots, nuggets, insuredEW: insured, leftoverEW: leftover };
      totalInsuredEW  += insured;
totalLeftoverEW += leftover;
        }

        return { metals, totalInsuredEW, totalLeftoverEW };
    }

    window.EWIns = {
        state,
        loadPolicies,
        loadPriceItems: loadPriceItems_,
    calcEstimate,
   METALS_LIST
    };

})();

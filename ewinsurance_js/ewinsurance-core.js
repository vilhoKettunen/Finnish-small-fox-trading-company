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

    const state = {
        idToken:  null,
        user:     null,
        isAdmin:  false,
        balance:  0,
        policies: []
    };

    async function loadPolicies() {
        if (!state.idToken) return;
        const r = await window.apiGet('insuranceListMy', { idToken: state.idToken });
        const d = r.data || r.result || r;
        state.policies = d.policies || [];
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
    calcEstimate,
   METALS_LIST
    };

})();

// Formatting helpers + currency display

window.formatBTShort = function formatBTShort(val) {
    const n = Number(val) || 0;
    let s = n.toFixed(2);
    s = s.replace(/\.?0+$/, '');
    const parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
};

function formatAsStacksAndRemainder(amountInItemUnits, bundleSize, itemName) {
    const amtRaw = Number(amountInItemUnits) || 0;
    const sign = amtRaw < 0 ? -1 : 1;
    const amt = Math.abs(amtRaw);
    const b = Math.max(1, Number(bundleSize) || 1);
    if (b <= 1) {
        return (sign < 0 ? '-' : '') + `${amt.toFixed(2)} ${itemName}`;
    }

    const stacks = Math.floor(amt / b);
    const remainder = amt - (stacks * b);

    // If no full stacks, show simple amount
    if (stacks <= 0) return (sign < 0 ? '-' : '') + `${amt.toFixed(2)} ${itemName}`;

    const remTxt = remainder > 0 ? ` and ${remainder.toFixed(2)} ${itemName}` : '';
    // e.g. "65x32 stacks and4.41 Resin", keep sign outside
    return (sign < 0 ? '-' : '') + `${stacks}x${b} stacks${remTxt}`;
}

window.formatValue = function formatValue(btValue, currencyName, forBuy) {
    const BASE_CURRENCY = window.BASE_CURRENCY || 'BT';
    const items = window.items || [];
    if (isNaN(btValue)) btValue = 0;
    let txt = `${Number(btValue).toFixed(2)} ${BASE_CURRENCY}`;
    if (currencyName && currencyName !== BASE_CURRENCY) {
        const currency = items.find(i => String(i.name || '').toLowerCase() === String(currencyName).toLowerCase());
        if (currency) {
            const rate = forBuy ? (currency.buyEach || currency.buyStack || 0) : (currency.sellEach || currency.sellStack || 0);
            if (rate > 0) {
                const asUnits = Number(btValue) / Number(rate);
                const pretty = formatAsStacksAndRemainder(asUnits, currency.bundleSize || 1, currencyName);
                // append parentheses with stack-aware breakdown
                txt += ` (${pretty})`;
            }
        }
    }
    return txt;
};

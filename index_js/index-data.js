// Price sheet loading + currency fetch UI

window.loadData = function loadData() {
    const sheetURL = window.sheetURL;
    fetch(sheetURL)
        .then(r => { if (!r.ok) throw new Error(r.status); return r.text(); })
        .then(txt => {
            let payloadText = txt;
            const start = payloadText.indexOf('('), end = payloadText.lastIndexOf(')');
            if (start > -1 && end > start) payloadText = payloadText.slice(start + 1, end);
            const json = JSON.parse(payloadText);
            const rows = json?.table?.rows || [];

            window.items = rows.map(row => {
                const c = row.c || [];
                const name = c[0]?.v ?? "";
                const buyStack = c[1]?.v ?? "";
                const sellStack = c[2]?.v ?? "";
                const stackStock = Number(c[3]?.v ?? 0);
                const bundleSize = Number(c[4]?.v ?? 1);
                const buyEach = c[5]?.v ?? "";
                const sellEach = c[6]?.v ?? "";
                const indivStock = Number(c[7]?.v ?? 0);
                const availPercent = Number(c[8]?.v ?? 0);
                const targetEach = Number(c[9]?.v ?? 0);
                if (!name) return null;
                if ((buyStack === "X" && sellStack === "X") && (buyEach === "X" && sellEach === "X")) return null;
                const num = v => {
                    if (v === null || v === "" || v === undefined) return null;
                    const n = Number(v); return isNaN(n) ? null : n;
                };
                return {
                    name: String(name),
                    bundleSize: bundleSize || 1,
                    stackStock, indivStock, availPercent, targetEach: targetEach || 0,
                    buyStack: num(buyStack),
                    sellStack: num(sellStack),
                    buyEach: num(buyEach),
                    sellEach: num(sellEach)
                };
            }).filter(Boolean);

            // Old index behavior for dropdown indicator:
            // currentPieces = indivStock (H)
            // targetPieces = targetEach (J, stacks) * bundleSize (E)
            window.stockProgressCache = window.items.map(i => {
                const b = Number(i.bundleSize || 1) || 1;
                const currentPieces = Number(i.indivStock || 0);
                const targetPieces = (Number(i.targetEach || 0) > 0) ? (Number(i.targetEach) * b) : 0;
                return { name: i.name, currentPieces, targetPieces };
            });

            window.payItems = window.items.slice();
            window.populateCurrencyDatalist();
            window.setupDropdowns();
            window.wirePayWithAndConverterDropdowns && window.wirePayWithAndConverterDropdowns();
        })
        .catch(() => {
            window.items = []; window.payItems = []; window.stockProgressCache = [];
            window.populateCurrencyDatalist();
            window.setupDropdowns();
        });
};

window.populateCurrencyDatalist = function populateCurrencyDatalist() {
    const currencyDatalist = document.getElementById('currencyDatalist');
    if (!currencyDatalist) return;
    currencyDatalist.innerHTML = '';
    currencyDatalist.appendChild(new Option(window.BASE_CURRENCY, window.BASE_CURRENCY));
    (window.items || []).forEach(i => {
        currencyDatalist.appendChild(new Option(`${i.name} � stack:${i.stackStock} each:${i.indivStock} avail:${i.availPercent}%`, i.name));
    });
    const input = document.getElementById('currencyInput');
    const hidden = document.getElementById('currencySelect');
    if (!input || !hidden) return;

    input.onchange = () => {
        const val = input.value.trim();
        const exact = (window.items || []).find(it => it.name.toLowerCase() === val.toLowerCase());
        hidden.value = exact ? exact.name : window.BASE_CURRENCY;
        window.updateAllDisplays();
    };
    input.oninput = () => {
        const v = input.value.trim();
        const exact = (window.items || []).find(it => it.name.toLowerCase() === v.toLowerCase());
        if (exact) { hidden.value = exact.name; window.updateAllDisplays(); }
    };
};
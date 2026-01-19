// Shared dropdown / search UI used across index sections

// NOTE: This file intentionally matches the working implementation from
// `admin_js_old _working/index_old.html` to avoid SVG scaling regressions.

window.attachDropdown = function attachDropdown(inputId, listId, filterFn, selectCallback) {
    const input = document.getElementById(inputId);
    const list = document.getElementById(listId);
    if (!input || !list) return;

    function setActiveIndex(idx) {
        const itemsEls = Array.from(list.querySelectorAll('.dropdown-item'));
        itemsEls.forEach(it => it.classList.remove('active'));
        if (idx >= 0 && idx < itemsEls.length) {
            itemsEls[idx].classList.add('active');
            itemsEls[idx].scrollIntoView({ block: 'nearest' });
            input._dropIndex = idx;
        } else input._dropIndex = -1;
    }

    function renderAndShow() {
        const q = (input.value || '').toLowerCase();
        const filtered = filterFn(q);
        window.renderDropdownList(list, filtered, (val) => {
            input.value = val;
            list.style.display = 'none';
            input._dropIndex = -1;
            if (selectCallback) selectCallback(val);
        });
        input._dropIndex = -1;
        list.style.display = list.querySelectorAll('.dropdown-item').length ? 'block' : 'none';
    }

    input.addEventListener('input', renderAndShow);
    input.addEventListener('focus', renderAndShow);
    input.addEventListener('keydown', ev => {
        const itemsEls = Array.from(list.querySelectorAll('.dropdown-item'));
        if (!itemsEls.length) return;
        if (ev.key === 'ArrowDown') {
            ev.preventDefault();
            setActiveIndex(Math.min((input._dropIndex || -1) + 1, itemsEls.length - 1));
        } else if (ev.key === 'ArrowUp') {
            ev.preventDefault();
            setActiveIndex(Math.max((input._dropIndex || -1) - 1, 0));
        } else if (ev.key === 'Enter') {
            if (typeof input._dropIndex === 'number' && input._dropIndex >= 0) {
                ev.preventDefault();
                itemsEls[input._dropIndex].click();
            }
        } else if (ev.key === 'Escape') {
            list.style.display = 'none';
            input._dropIndex = -1;
        }
    });

    input.addEventListener('blur', () =>
        setTimeout(() => {
            list.style.display = 'none';
            input._dropIndex = -1;
        }, 200)
    );
};

window.renderDropdownList = function renderDropdownList(container, arr, onSelect) {
    const stockProgressCache = window.stockProgressCache || [];
    container.innerHTML = '';

    arr.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'dropdown-item';
        div.dataset.index = String(idx);

        // pct = currentPieces / targetPieces (both in individual pieces)
        let pct = 0;
        const prog = stockProgressCache.find(sp => sp.name === item.name);
        if (prog) {
            const current = Number(prog.currentPieces || 0);
            const target = Number(prog.targetPieces || 0);
            if (target > 0) pct = Math.round((current / target) * 100);
        }
        pct = Math.max(0, Math.min(100, pct));

        // IMPORTANT: keep these exact attributes (old working dropdown)
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        circle.setAttribute('class', 'stock-circle');
        circle.setAttribute('viewBox', '0 0 36 36');

        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        bg.setAttribute('cx', '18');
        bg.setAttribute('cy', '18');
        bg.setAttribute('r', '16');
        bg.setAttribute('stroke', '#eee');
        bg.setAttribute('stroke-width', '4');
        bg.setAttribute('fill', 'none');

        const fg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        fg.setAttribute('cx', '18');
        fg.setAttribute('cy', '18');
        fg.setAttribute('r', '16');
        fg.setAttribute('stroke', pct >= 100 ? '#3cb371' : '#2196f3');
        fg.setAttribute('stroke-width', '4');
        fg.setAttribute('fill', 'none');
        fg.setAttribute(
            'stroke-dasharray',
            Math.round((pct / 100) * 2 * Math.PI * 16) + ',1000'
        );
        fg.setAttribute('transform', 'rotate(-90 18 18)');

        circle.appendChild(bg);
        circle.appendChild(fg);

        const label = document.createElement('div');
        label.innerHTML = `<strong>${item.name}</strong><br><small>${item.extra || ''}</small>`;

        div.appendChild(circle);
        div.appendChild(label);

        div.addEventListener('mouseover', () => {
            Array.from(container.querySelectorAll('.dropdown-item')).forEach(s =>
                s.classList.remove('active')
            );
            div.classList.add('active');
        });

        div.onclick = () => onSelect(item.name);
        container.appendChild(div);
    });
};

window.setupDropdowns = function setupDropdowns() {
    const items = window.items || [];

    // Match old extra string format exactly (affects layout/line breaks).
    window.dropdownData = items.map(i => ({
        name: i.name,
        extra: `stkStock:${i.stackStock} eachStock:${i.indivStock} avail:${i.availPercent}%`
    }));

    function filterBy(q) {
        if (!q) return window.dropdownData.slice(0, 200);
        return window.dropdownData
            .filter(d => d.name.toLowerCase().includes(q))
            .slice(0, 200);
    }

    [
        'quickStackSelect',
        'quickIndivSelect',
        'stackSelect',
        'indivSelect',
        'sellStackSelect',
        'sellIndivSelect',
        'customBuyStackSelect',
        'customBuyIndivSelect',
        'customSellStackSelect',
        'customSellIndivSelect'
    ].forEach(id => window.attachDropdown(id, id + 'List', filterBy, () => { }));
};

// Helper used by Pay With / Converter dynamic rows.
// (kept for backwards compatibility with `pay-converter.js`)
window.attachSimpleItemDropdown = function attachSimpleItemDropdown(inputEl, listEl) {
    return window.attachDropdownToElements(inputEl, listEl);
};

// New canonical helper for attaching the old dropdown behavior to dynamic DOM elements.
window.attachDropdownToElements = function attachDropdownToElements(inputEl, listEl, filterFn, selectCallback) {
    if (!inputEl || !listEl) return;

    const filter = filterFn || function defaultFilter(q) {
        const qq = String(q || '').toLowerCase().trim();
        if (!qq) return (window.dropdownData || []).slice(0, 200);
        return (window.dropdownData || [])
            .filter(d => String(d.name || '').toLowerCase().includes(qq))
            .slice(0, 200);
    };

    function setActiveIndex(idx) {
        const itemsEls = Array.from(listEl.querySelectorAll('.dropdown-item'));
        itemsEls.forEach(it => it.classList.remove('active'));
        if (idx >= 0 && idx < itemsEls.length) {
            itemsEls[idx].classList.add('active');
            itemsEls[idx].scrollIntoView({ block: 'nearest' });
            inputEl._dropIndex = idx;
        } else inputEl._dropIndex = -1;
    }

    function renderAndShow() {
        const q = (inputEl.value || '').toLowerCase();
        const filtered = filter(q);
        window.renderDropdownList(listEl, filtered, (val) => {
            inputEl.value = val;
            listEl.style.display = 'none';
            inputEl._dropIndex = -1;
            if (selectCallback) selectCallback(val);
        });
        inputEl._dropIndex = -1;
        listEl.style.display = listEl.querySelectorAll('.dropdown-item').length ? 'block' : 'none';
    }

    inputEl.addEventListener('input', renderAndShow);
    inputEl.addEventListener('focus', renderAndShow);
    inputEl.addEventListener('keydown', ev => {
        const itemsEls = Array.from(listEl.querySelectorAll('.dropdown-item'));
        if (!itemsEls.length) return;
        if (ev.key === 'ArrowDown') {
            ev.preventDefault();
            setActiveIndex(Math.min((inputEl._dropIndex || -1) + 1, itemsEls.length - 1));
        } else if (ev.key === 'ArrowUp') {
            ev.preventDefault();
            setActiveIndex(Math.max((inputEl._dropIndex || -1) - 1, 0));
        } else if (ev.key === 'Enter') {
            if (typeof inputEl._dropIndex === 'number' && inputEl._dropIndex >= 0) {
                ev.preventDefault();
                itemsEls[inputEl._dropIndex].click();
            }
        } else if (ev.key === 'Escape') {
            listEl.style.display = 'none';
            inputEl._dropIndex = -1;
        }
    });

    inputEl.addEventListener('blur', () =>
        setTimeout(() => {
            listEl.style.display = 'none';
            inputEl._dropIndex = -1;
        }, 200)
    );
};
// Collapsible helpers used by index.html

window.setCollapseState = function setCollapseState(btnId, open) {
    try { localStorage.setItem('__collapse__' + btnId, open ? 'open' : 'closed'); } catch (_) { }
};

window.getCollapseState = function getCollapseState(btnId) {
    try { return localStorage.getItem('__collapse__' + btnId) === 'open'; } catch (_) { return false; }
};

window.applyCollapseState = function applyCollapseState(contentId, btnId, open) {
    const content = document.getElementById(contentId);
    const btn = document.getElementById(btnId);
    if (!content || !btn) return;

    // Use consistent triangle glyphs: closed = right-pointing, open = down-pointing.
    const CLOSED_GLYPH = '▸';
    const OPEN_GLYPH = '▾';

    if (open) {
        content.style.display = 'block';
        btn.textContent = OPEN_GLYPH;
        btn.setAttribute('aria-expanded', 'true');
    } else {
        content.style.display = 'none';
        btn.textContent = CLOSED_GLYPH;
        btn.setAttribute('aria-expanded', 'false');
    }
};

window.toggleCollapse = function toggleCollapse(contentId, btnId) {
    const el = document.getElementById(contentId);
    if (!el) return;
    const curOpen = getComputedStyle(el).display !== 'none';
    window.applyCollapseState(contentId, btnId, !curOpen);
    window.setCollapseState(btnId, !curOpen);
};

window.initCollapsibles = function initCollapsibles() {
    [
        { content: 'ocmBuyContent', btn: 'toggleOCMBuy' },
        { content: 'customBuyContent', btn: 'toggleCustomBuy' },
        { content: 'ocmSellContent', btn: 'toggleOCMSell' },
        { content: 'customSellContent', btn: 'toggleCustomSell' }
    ].forEach(m => window.applyCollapseState(m.content, m.btn, window.getCollapseState(m.btn)));
};
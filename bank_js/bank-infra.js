window.BankInfra = (function () {
  'use strict';

  // ??? State ?????????????????????????????????????????????????????????????????
  let _allInvestments = [];
  let _currentPage  = 1;
  let _pageSize   = 10;

  // ??? Public: load all data then render ????????????????????????????????????
  async function loadAndRender() {
    const tbody = document.getElementById('infraTbody');
    if (!tbody) return;

    // Show loading state in the table body
    tbody.innerHTML = '<tr><td colspan="4" class="small" style="color:#888;padding:12px;">Loading&hellip;</td></tr>';

    try {
    const result = await BankData.apiGetInfraInvestments();
      _allInvestments = (result && result.data && result.data.investments) || [];
    } catch (e) {
    tbody.innerHTML = `<tr><td colspan="4" class="small" style="color:#c00;padding:12px;">Failed to load investments: ${escapeHtml(e.message || String(e))}</td></tr>`;
      return;
    }

  _currentPage = 1;
    _pageSize    = Number((document.getElementById('infraPgSize') || {}).value) || 10;
    _wirePagerControls();
    renderPage();
  }

  // ??? Wire Prev/Next/PageSize controls ?????????????????????????????????????
  function _wirePagerControls() {
    const prevBtn   = document.getElementById('infraPrev');
    const nextBtn   = document.getElementById('infraNext');
    const pgSizeEl  = document.getElementById('infraPgSize');

    if (prevBtn && !prevBtn._infraWired) {
 prevBtn.addEventListener('click', () => {
        if (_currentPage > 1) { _currentPage--; renderPage(); }
   });
      prevBtn._infraWired = true;
    }
    if (nextBtn && !nextBtn._infraWired) {
      nextBtn.addEventListener('click', () => {
        const totalPages = Math.max(1, Math.ceil(_allInvestments.length / _pageSize));
        if (_currentPage < totalPages) { _currentPage++; renderPage(); }
      });
nextBtn._infraWired = true;
 }
    if (pgSizeEl && !pgSizeEl._infraWired) {
      pgSizeEl.addEventListener('change', () => {
 _pageSize    = Number(pgSizeEl.value) || 10;
   _currentPage = 1;
        renderPage();
      });
    pgSizeEl._infraWired = true;
    }
  }

  // ??? Render the current page of rows ??????????????????????????????????????
  function renderPage() {
    const tbody  = document.getElementById('infraTbody');
    const pgInfo = document.getElementById('infraPgInfo');
    const pgInfoB= document.getElementById('infraPgInfoBottom');
    const prevBtn= document.getElementById('infraPrev');
    const nextBtn= document.getElementById('infraNext');
    if (!tbody) return;

    // Collapse any open detail rows before re-rendering
    tbody.innerHTML = '';

    const total      = _allInvestments.length;
    const totalPages = Math.max(1, Math.ceil(total / _pageSize));
    if (_currentPage > totalPages) _currentPage = totalPages;

    const start = (_currentPage - 1) * _pageSize;
    const slice = _allInvestments.slice(start, start + _pageSize);

  if (total === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="small" style="color:#888;padding:12px;">No infrastructure investments yet.</td></tr>';
    } else {
      slice.forEach(inv => {
        const tr = buildRow(inv);
        tbody.appendChild(tr);
    });
    }

    const infoText = `Page ${_currentPage} / ${totalPages}  (${total} total)`;
    if (pgInfo)  pgInfo.textContent  = infoText;
    if (pgInfoB) pgInfoB.textContent = infoText;
    if (prevBtn) prevBtn.disabled = (_currentPage <= 1);
    if (nextBtn) nextBtn.disabled = (_currentPage >= totalPages);
  }

  // ??? Build a single data row ???????????????????????????????????????????????
  function buildRow(inv) {
    const tr = document.createElement('tr');
    tr.className = 'infra-data-row';

    // Cell 0 — Date
    const dateStr = formatDate(inv.createdAt);
const tdDate  = document.createElement('td');
    tdDate.textContent = dateStr;
    tr.appendChild(tdDate);

    // Cell 1 — Quantity of Items
    const itemsHtml = buildItemsSummary(inv.itemsJson);
    const tdItems   = document.createElement('td');
    tdItems.innerHTML = itemsHtml;
    tr.appendChild(tdItems);

    // Cell 2 — Total EW
    const tdEw  = document.createElement('td');
  tdEw.textContent = Number(inv.ewTotal || 0).toFixed(2) + ' EW';
    tr.appendChild(tdEw);

    // Cell 3 — More Info button
    const tdBtn = document.createElement('td');
    const btn   = document.createElement('button');
    btn.type        = 'button';
    btn.textContent = 'More Info';
    btn.dataset.details = 'toggle';
    btn.addEventListener('click', () => toggleDetailRow(tr, inv, btn));
    tdBtn.appendChild(btn);
    tr.appendChild(tdBtn);

    return tr;
  }

  // ??? Toggle inline detail row ??????????????????????????????????????????????
  function toggleDetailRow(mainRow, inv, btn) {
    const existing = mainRow.nextElementSibling;
    if (existing && existing.classList.contains('infra-details-row')) {
      existing.remove();
      btn.textContent = 'More Info';
      return;
    }

    const detailsTr = document.createElement('tr');
  detailsTr.className = 'infra-details-row';

    const td = document.createElement('td');
    td.colSpan = 4;
    td.innerHTML = buildDetailsHtml(inv);
    detailsTr.appendChild(td);

    mainRow.parentNode.insertBefore(detailsTr, mainRow.nextSibling);
  btn.textContent = 'Hide Info';
  }

  // ??? Build detail panel HTML ???????????????????????????????????????????????
  function buildDetailsHtml(inv) {
    const fullDate = inv.createdAt ? String(inv.createdAt).replace('T', ' ').slice(0, 19) : '—';
    const short    = escapeHtml(inv.shortDescription || '');
    const long_    = escapeHtml(inv.longDescription  || '');
    const ewTotal  = Number(inv.ewTotal || 0).toFixed(2);

    const itemLines = Array.isArray(inv.itemsJson)
      ? inv.itemsJson.map(it => {
          const qty    = Number(it.qty || 0);
   const bs     = Number(it.bundleSize || 1);
   const name   = escapeHtml(String(it.name || 'Unknown'));
          const price  = it.priceBT != null ? ` &mdash; ${Number(it.priceBT).toFixed(2)} EW` : '';
   const qtyStr = bs > 1 ? `${qty}x${bs}` : `${qty}`;
        return `<div class="infra-detail-item"><span class="infra-detail-qty">${qtyStr}</span> ${name}${price}</div>`;
        }).join('')
  : '<div class="small" style="color:#888;">No items data.</div>';

    return `<div class="infra-details-box">
      <div class="infra-details-meta">Date: <strong>${fullDate}</strong></div>
      <h4 class="infra-details-title">${short}</h4>
    <div class="infra-details-long">${long_}</div>
    <div class="infra-details-items-label">Items:</div>
      <div class="infra-details-items">${itemLines}</div>
      <div class="infra-details-total">Total EW: <strong>${ewTotal} EW</strong></div>
    </div>`;
  }

  // ??? Helpers ???????????????????????????????????????????????????????????????

  // Build compact item summary for the table cell (e.g. "5x32 Candles, 3 Linen")
  function buildItemsSummary(itemsJson) {
    if (!Array.isArray(itemsJson) || itemsJson.length === 0) return '&mdash;';
    return itemsJson.map(it => {
      const qty  = Number(it.qty  || 0);
      const bs   = Number(it.bundleSize || 1);
      const name = escapeHtml(String(it.name || 'Unknown'));
  const qtyStr = bs > 1 ? `${qty}x${bs}` : `${qty}`;
      return `${qtyStr} ${name}`;
    }).join(', ');
  }

  // Format ISO timestamp ? DD-MM-YYYY
  function formatDate(raw) {
    if (!raw) return '—';
    const s = String(raw).slice(0, 10); // "YYYY-MM-DD"
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    return s;
  }

  function escapeHtml(s) {
    return String(s || '')
   .replace(/&/g, '&amp;')
   .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return { loadAndRender, renderPage };
})();

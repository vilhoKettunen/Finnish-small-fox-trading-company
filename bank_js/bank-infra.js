// bank_js/bank-infra.js
window.BankInfra = (function () {
  'use strict';

  let currentModalId = null;

  async function loadAndRender() {
    const listEl = document.getElementById('infraInvestList');
    if (!listEl) return;
    listEl.innerHTML = '<div class="small" style="color:#888;">Loading…</div>';
    try {
   const result = await BankData.apiGetInfraInvestments();
      const investments = (result && result.data && result.data.investments) || [];
      renderList(investments);
} catch (e) {
    listEl.innerHTML = '<div class="small" style="color:#c00;">Failed to load investments: ' + (e.message || e) + '</div>';
    }
  }

  function renderList(items) {
    const listEl = document.getElementById('infraInvestList');
    if (!listEl) return;

    if (items.length === 0) {
      listEl.innerHTML = '<div class="small" style="color:#888;">No infrastructure investments yet.</div>';
      return;
    }

    listEl.innerHTML = '';
    items.forEach(inv => {
      const card = document.createElement('div');
card.className = 'infra-card';

  const dateStr = inv.createdAt ? String(inv.createdAt).slice(0, 10) : '—';
      const itemList = Array.isArray(inv.itemsJson)
        ? inv.itemsJson.map(it => `${it.qty}×${it.name}`).join(', ')
        : '—';
   const ewTotal = Number(inv.ewTotal || 0).toFixed(2);

    card.innerHTML = `
        <div class="infra-card-meta">${dateStr}</div>
   <div style="font-weight:600;margin:4px 0;">${escapeHtml(inv.shortDescription || '')}</div>
        <div class="small">${escapeHtml(itemList)}</div>
 <div class="small" style="margin-top:4px;">Total: <strong>${ewTotal} EW</strong></div>
        <button type="button" class="infra-more-btn" style="margin-top:8px;" data-id="${escapeHtml(inv.investmentId || '')}">More Info</button>
      `;

      card.querySelector('.infra-more-btn').addEventListener('click', () => {
        openMoreInfo(inv.investmentId);
      });

      listEl.appendChild(card);
    });
  }

  async function openMoreInfo(investmentId) {
    const overlay = document.getElementById('infraDetailOverlay');
    const modal   = document.getElementById('infraDetailModal');
    if (!overlay || !modal) return;

    modal.innerHTML = '<div class="small" style="color:#888;">Loading…</div>';
    overlay.style.display = 'flex';
    currentModalId = investmentId;

    try {
      const result = await BankData.apiGetInfraInvestmentDetail(investmentId);
      const inv = result && result.data && result.data.investment;
      if (!inv) throw new Error('Investment not found');

 const dateStr  = inv.createdAt ? String(inv.createdAt).slice(0, 10) : '—';
      const itemList = Array.isArray(inv.itemsJson)
   ? inv.itemsJson.map(it => `<li>${it.qty} × ${escapeHtml(it.name)}</li>`).join('')
        : '';
      const ewTotal = Number(inv.ewTotal || 0).toFixed(2);

 modal.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <strong style="font-size:1.1em;">Infrastructure Investment</strong>
     <button type="button" id="infraDetailClose" style="font-size:1.2em;background:none;border:none;cursor:pointer;">?</button>
      </div>
        <div class="infra-card-meta">${dateStr}</div>
        <h3 style="margin:8px 0;">${escapeHtml(inv.shortDescription || '')}</h3>
        <div style="margin-bottom:12px;white-space:pre-wrap;">${escapeHtml(inv.longDescription || '')}</div>
        <div><strong>Items:</strong><ul style="margin:4px 0 8px 20px;padding:0;">${itemList}</ul></div>
        <div><strong>Total EW:</strong> ${ewTotal} EW</div>
      `;

      document.getElementById('infraDetailClose').addEventListener('click', closeMoreInfo);
    } catch (e) {
      modal.innerHTML = `<div style="color:#c00;">Error: ${escapeHtml(e.message || String(e))}</div>
      <button type="button" onclick="BankInfra.closeMoreInfo()" style="margin-top:8px;">Close</button>`;
    }
  }

  function closeMoreInfo() {
    const overlay = document.getElementById('infraDetailOverlay');
    if (overlay) overlay.style.display = 'none';
    currentModalId = null;
  }

  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Close modal when clicking overlay backdrop
  document.addEventListener('click', e => {
    const overlay = document.getElementById('infraDetailOverlay');
    if (overlay && e.target === overlay) closeMoreInfo();
  });

  return { loadAndRender, openMoreInfo, closeMoreInfo };
})();

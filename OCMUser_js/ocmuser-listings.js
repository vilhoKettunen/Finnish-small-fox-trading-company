// Listing creation + listing editor/restock dialogs for OCMUser
(function () {
    'use strict';

    const O = window.OCMUser;
    const S = O.state;
    const byId = O.byId;
    const esc = O.esc;
    const fmt2 = O.fmt2;

    // =========================
    // DEBUG (testing)
    // Set to true to request backend step-by-step logs for `ocmListMyListingsV2`.
    // Backend logs return as `data.debugLog` (array of strings) and are printed by api-client.js
    // when its `API_DEBUG_LOGGING` is enabled.
    // =========================
    const OCMUSER_DEBUG_MY_LISTINGS = false;

    // =========================
    // FEATURE A — In-flight guards (prevent double-submit)
    // =========================
    let isCreatingStore_ = false;
    let isCreatingHalf_ = false;
    let isCreatingFull_ = false;

    // =========================
    // FEATURE A — Duplicate listing fingerprint helpers
    // =========================
    function buildListingFingerprint_(mode, type, itemName, stackSize, pricingMode, primaryPegName, fixedEW) {
        return [
            String(mode || '').toUpperCase(),
            String(type || '').toUpperCase(),
            String(itemName || '').toLowerCase().trim(),
            String(stackSize || 1),
            String(pricingMode || '').toUpperCase(),
            pricingMode === 'FIXED_EW' ? String(fixedEW || 0) : String(primaryPegName || '').toLowerCase().trim()
        ].join('|');
    }

    function hasDuplicateListing_(fp) {
        return (S.myListings || []).some(l => {
            const status = String(l.statusRaw || l.status || '').toUpperCase();
            if (status === 'DELETED') return false; // Q3: exclude deleted listings
            const extra = O.safeJsonParse(l.extraJson || '{}', {}) || {};
            const mode = String(l.pricing?.listingMode || extra.listingMode || '').toUpperCase()
                || (String(l.sourceItemId || '').startsWith('sheet:') ? 'STORE' : 'HALF');
            const pm = String(l.pricing?.mode || extra.pricingMode || 'PEG').toUpperCase();
            const pegName = l.pricing?.primaryPeg?.itemName || extra.primaryPeg?.itemName || extra.pegItemName || '';
            const fixedEW = l.pricing?.fixedEWPerUnit || extra.fixedEWPerUnit || 0;
            const existing = buildListingFingerprint_(mode, l.type, l.itemName, l.stackSize, pm, pegName, fixedEW);
            return existing === fp;
        });
    }

    function setCreationTab(which) {
        const map = {
            store: { tab: 'tabCreateStore', panel: 'panelCreateStore' },
            half: { tab: 'tabCreateHalf', panel: 'panelCreateHalf' },
            full: { tab: 'tabCreateFull', panel: 'panelCreateFull' }
        };
        Object.keys(map).forEach(k => {
            byId(map[k].panel).style.display = (k === which) ? 'block' : 'none';
            byId(map[k].tab).setAttribute('aria-selected', (k === which) ? 'true' : 'false');
        });
    }

    async function createListingStore() {
        if (!S.googleIdToken) return;
        if (isCreatingStore_) { byId('createMsgStore').textContent = 'Already creating, please wait...'; return; }
        isCreatingStore_ = true;
        const msg = byId('createMsgStore');
        msg.textContent = 'Creating...';

        try {
            const type = byId('createTypeStore').value;
            const listingMode = 'STORE';
            const itemName = byId('createItemStore').value.trim();
            const item = O.findCatalogItem(itemName);
            if (!item) throw new Error('Store item not found in catalog');
            const stackSize = Number(item.bundleSize || 1) || 1;
            const qtyIn = Number(byId('createQtyUnitsStore').value || 0);
            const qtyMode = byId('createQtyModeStore').value;
            const quantityUnits = O.computeQtyUnitsFromInput(qtyIn, qtyMode, stackSize);
            if (!isFinite(quantityUnits) || quantityUnits <= 0) throw new Error('Invalid quantity');
            if (!O.validatePegSet_(S.createState.store.primary, S.createState.store.alts, byId('createStorePegWarn'))) throw new Error('Fix peg inputs');
            const pegPayload = O.buildPegPayload_(S.createState.store.primary, S.createState.store.alts);
            const fp = buildListingFingerprint_(listingMode, type, itemName, stackSize, 'PEG', pegPayload.primaryPeg?.itemName, 0);
            if (hasDuplicateListing_(fp)) {
                if (!confirm('An identical listing already exists. Create a duplicate anyway?')) {
                    msg.textContent = '';
                    return;
                }
            }
            const r = await apiPost('ocmCreateListingV2', {
                idToken: S.googleIdToken,
                listingMode,
                type,
                itemName,
                sourceItemId: 'sheet:' + item.name,
                stackSize,
                quantityUnits,
                pricingMode: 'PEG',
                primaryPeg: pegPayload.primaryPeg,
                altPegs: pegPayload.altPegs
            });
            const d = r.data || r.result || r;
            msg.textContent = 'Created. ListingId: ' + (d.listingId || '');
            await O.loadMyListings();
            await refreshMerchantBalance_();
        } catch (e) {
            msg.textContent = 'Error: ' + (e.message || e);
        } finally {
            isCreatingStore_ = false;
        }
    }

    async function createListingHalf() {
        if (!S.googleIdToken) return;
        if (isCreatingHalf_) { byId('createMsgHalf').textContent = 'Already creating, please wait...'; return; }
        isCreatingHalf_ = true;
        const msg = byId('createMsgHalf');
        msg.textContent = 'Creating...';

        try {
            const type = byId('createTypeHalf').value;
            const listingMode = 'HALF';
            const itemNameRaw = O.sanitizeLettersOnly_(byId('createItemHalf').value, { trim: true });
            if (!itemNameRaw) throw new Error('Custom item name required');
            if (!O.isLettersOnly_(itemNameRaw)) throw new Error('Custom item name must contain only letters and spaces (A-Z).');
            const itemName = itemNameRaw;
            const stackSize = Math.max(1, Math.round(Number(byId('createStackHalf').value || 1) || 1));
            if (!isFinite(stackSize) || stackSize <= 0) throw new Error('Invalid stack size');
            const qtyIn = Number(byId('createQtyUnitsHalf').value || 0);
            const qtyMode = byId('createQtyModeHalf').value;
            const quantityUnits = O.computeQtyUnitsFromInput(qtyIn, qtyMode, stackSize);
            if (!isFinite(quantityUnits) || quantityUnits <= 0) throw new Error('Invalid quantity');
            if (!O.validatePegSet_(S.createState.half.primary, S.createState.half.alts, byId('createHalfPegWarn'))) throw new Error('Fix peg inputs');
            const pegPayload = O.buildPegPayload_(S.createState.half.primary, S.createState.half.alts);
            const fp = buildListingFingerprint_(listingMode, type, itemName, stackSize, 'PEG', pegPayload.primaryPeg?.itemName, 0);
            if (hasDuplicateListing_(fp)) {
                if (!confirm('An identical listing already exists. Create a duplicate anyway?')) {
                    msg.textContent = '';
                    return;
                }
            }
            const r = await apiPost('ocmCreateListingV2', {
                idToken: S.googleIdToken,
                listingMode,
                type,
                itemName,
                sourceItemId: '',
                stackSize,
                quantityUnits,
                pricingMode: 'PEG',
                primaryPeg: pegPayload.primaryPeg,
                altPegs: pegPayload.altPegs
            });
            const d = r.data || r.result || r;
            msg.textContent = 'Created. ListingId: ' + (d.listingId || '');
            await O.loadMyListings();
            await refreshMerchantBalance_();
        } catch (e) {
            msg.textContent = 'Error: ' + (e.message || e);
        } finally {
            isCreatingHalf_ = false;
        }
    }

    async function createListingFull() {
        if (!S.googleIdToken) return;
        if (isCreatingFull_) { byId('createMsgFull').textContent = 'Already creating, please wait...'; return; }
        isCreatingFull_ = true;
        const msg = byId('createMsgFull');
        msg.textContent = 'Creating...';

        try {
            const type = byId('createTypeFull').value;
            const listingMode = 'FULL';
            const itemNameRaw = byId('createItemFull').value.trim();
            if (!itemNameRaw) throw new Error('Custom item name required');
            if (!O.isLettersOnly_(itemNameRaw)) throw new Error('Custom item name must contain letters only (A-Z).');
            const itemName = itemNameRaw;
            const stackSize = Math.max(1, Math.round(Number(byId('createStackFull').value || 1) || 1));
            if (!isFinite(stackSize) || stackSize <= 0) throw new Error('Invalid stack size');
            const quantityUnits = Math.max(1, Math.round(Number(byId('createQtyUnitsFull').value || 0) || 0));
            if (!isFinite(quantityUnits) || quantityUnits <= 0) throw new Error('Invalid quantity');
            const fixedEWPerUnit = Number(byId('createFixedBT').value || 0);
            if (!isFinite(fixedEWPerUnit) || fixedEWPerUnit <= 0) throw new Error('Fixed EW per unit must be >0');
            const fp = buildListingFingerprint_(listingMode, type, itemName, stackSize, 'FIXED_EW', '', fixedEWPerUnit);
            if (hasDuplicateListing_(fp)) {
                if (!confirm('An identical listing already exists. Create a duplicate anyway?')) {
                    msg.textContent = '';
                    return;
                }
            }
            const r = await apiPost('ocmCreateListingV2', {
                idToken: S.googleIdToken,
                listingMode,
                type,
                itemName,
                sourceItemId: '',
                stackSize,
                quantityUnits,
                pricingMode: 'FIXED_EW',
                fixedEWPerUnit
            });
            const d = r.data || r.result || r;
            msg.textContent = 'Created. ListingId: ' + (d.listingId || '');
            await O.loadMyListings();
            await refreshMerchantBalance_();
        } catch (e) {
            msg.textContent = 'Error: ' + (e.message || e);
        } finally {
            isCreatingFull_ = false;
        }
    }

    async function loadMyListings() {
        if (!S.googleIdToken) return;
        const r = await apiGet('ocmListMyListingsV2', { idToken: S.googleIdToken, dbg: OCMUSER_DEBUG_MY_LISTINGS ? 1 : '' });
        const d = r.data || r.result || r;
        S.myListings = d.listings || [];
        renderMyListings();
    }

    function statusPill(statusRaw) {
        const s = String(statusRaw || '').toUpperCase();
        if (s === 'ACTIVE') return '<span class="pill pill-active">ACTIVE</span>';
        if (s === 'PENDING_REVIEW') return '<span class="pill pill-pending">PENDING_REVIEW</span>';
        if (s === 'PAUSED') return '<span class="pill pill-paused">PAUSED</span>';
        if (s === 'DELETED') return '<span class="pill">DELETED</span>';
        if (s === 'TRUE') return '<span class="pill pill-active">OPEN</span';
        if (s === 'FALSE') return '<span class="pill">CLOSED</span>';
        return `<span class="pill">${esc(s || '—')}</span>`;
    }

    function pricingLabel(l) {
        const p = l.pricing || {};
        if (p.mode === 'FIXED_EW') return `FIXED ${fmt2(p.fixedEWPerUnit)} EW/unit`;

        const prim = p.primaryPeg || (p.pegItemName ? { itemName: p.pegItemName, pegQtyPerInd: p.pegQtyPerUnit, ui: { priceBasis: p.pricingBasis || 'IND' } } : null);
        if (!prim || !prim.itemName) return '—';

        const alts = Array.isArray(p.altPegs) ? p.altPegs : [];
        const altCount = alts.length;
        const basis = String(prim.ui?.priceBasis || p.pricingBasis || 'IND').toUpperCase();

        // Calculate display quantity based on priceBasis
        let displayQty = Number(prim.pegQtyPerInd || 0);

        // If priceBasis is STACK, multiply to show the full stack price
        if (basis === 'STACK') {
            const stackSize = Number(l.stackSize || 1) || 1;
            displayQty = displayQty * stackSize;
        }

        const basisLabel = basis === 'STACK' ? 'STACK' : 'IND';
        return `${fmt2(displayQty)} ${prim.itemName} (${basisLabel}${altCount ? ` +${altCount} alts` : ''})`;
    }

    function editKindLabel(l) {
        const extra = O.safeJsonParse(l.extraJson || '{}', {}) || {};
        const k = String(extra.merchantEditKind || '').toUpperCase();
        if (k === 'RESTOCK_ONLY') return '<span class="pill pill-restock">RESTOCK_ONLY</span>';
        if (k === 'FULL_EDIT') return '<span class="pill pill-pending">FULL_EDIT</span>';
        return '<span class="pill">—</span>';
    }

    function renderListingRow(tb, l) {
        const tr = document.createElement('tr');
        const type = String(l.type || '').toUpperCase();
        const status = String(l.statusRaw || l.status || '').toUpperCase();

        // ===== STEP 1: Extract and parse key variables (move OUTSIDE status check) =====
        const extra = O.safeJsonParse(l.extraJson || '{}', {}) || {};

        // Extract listing mode (now available everywhere)
        const listingMode = String(l.pricing?.listingMode || extra.listingMode || '').toUpperCase()
            || (String(l.sourceItemId || '').startsWith('sheet:') ? 'STORE' : 'HALF');

        // Extract pricing mode (now available everywhere)
        const pricingMode = String(l.pricing?.mode || extra.pricingMode || 'PEG').toUpperCase();

        // Extract locked EW (FIXED_EW BUY only)
        let locked = 0;
        if (listingMode === 'FULL' && pricingMode === 'FIXED_EW') {
            locked = Number(extra.lockedEW || 0) || 0;

            // Fallback: if lockedEW not in extraJson, calculate it
            if (locked === 0 && l.remainingQuantity) {
                locked = l.remainingQuantity * Number(l.pricing?.fixedEWPerUnit || 0);
            }
        }

        // If PAUSED, values should be 0 (not contributing to net worth)
        let lockedDisplay = '—';
        let rnwDisplay = '—';
        let pnwDisplay = '—';

        if (status !== 'PAUSED') {
            try {
                const remainingQty = Number(l.remainingQuantity || l.qtyAvailable || 0);

                // ===== FOR BUY LISTINGS =====
                if (type === 'BUY') {
                    // FULL custom listings: show Locked EW from backend
                    if (listingMode === 'FULL') {
                        lockedDisplay = locked > 0 ? O.fmt2(locked) + ' EW' : '—';
                    }

                    // ===== RNW & PNW for STORE/HALF BUY listings with PEG pricing =====
                    if (listingMode !== 'FULL' && pricingMode === 'PEG') {
                        // === RNW CALCULATION: sum of peg store buyback values ===
                        let rnwValue = 0;

                        if (l.pricing && Array.isArray(l.pricing.altPegs)) {
                            // Primary peg
                            if (l.pricing.primaryPeg && l.pricing.primaryPegStorePrices) {
                                const primaryQtyTotal = remainingQty * l.pricing.primaryPeg.pegQtyPerInd;
                                const primaryBuyback = Number(l.pricing.primaryPegStorePrices.buyEach || 0);
                                rnwValue += primaryQtyTotal * primaryBuyback;
                            }

                            // Alt pegs
                            if (Array.isArray(l.pricing.altPegStorePrices)) {
                                l.pricing.altPegs.forEach((altPeg, idx) => {
                                    if (l.pricing.altPegStorePrices[idx]) {
                                        const altQtyTotal = remainingQty * altPeg.pegQtyPerInd;
                                        const altBuyback = Number(l.pricing.altPegStorePrices[idx].buyEach || 0);
                                        rnwValue += altQtyTotal * altBuyback;
                                    }
                                });
                            }
                        }

                        rnwDisplay = rnwValue > 0 ? O.fmt2(rnwValue) + ' EW' : '—';

                        // === PNW CALCULATION: for STORE BUY only ===
                        if (listingMode === 'STORE' && l.pricing && l.pricing.listingStorePrices) {
                            const itemBuyback = Number(l.pricing.listingStorePrices.buyEach || 0);
                            const pnwValue = remainingQty * itemBuyback;
                            pnwDisplay = pnwValue > 0 ? O.fmt2(pnwValue) + ' EW' : '—';
                        }
                    }
                }
                // ===== FOR SELL LISTINGS =====
                else if (type === 'SELL') {
                    const itemName = l.itemName || '';

                    // RNW = remaining qty × item's Column B price (liquidation value)
                    const item = O.findCatalogItem(itemName);
                    if (item) {
                        let payoutPrice = Number(item.buyEach || 0);
                        // Fallback: if buyEach is missing/zero, derive from buyStack / bundleSize
                        if (payoutPrice <= 0 && item.buyStack) {
                            const bundleSize = Number(item.bundleSize || 1) || 1;
                            payoutPrice = Number(item.buyStack) / bundleSize;
                        }
                        const rnwValue = remainingQty * payoutPrice;
                        rnwDisplay = rnwValue > 0 ? O.fmt2(rnwValue) + ' EW' : '—';
                    }

                    // PNW = remaining qty × PRIMARY PEG's pegQtyPerInd × peg's Column B price
                    const pegName = extra.primaryPeg?.itemName || extra.pegItemName || '';
                    const pegQtyPerInd = Number(extra.primaryPeg?.pegQtyPerInd || extra.pegQtyPerUnit || 1);

                    if (pegName) {
                        const pegItem = O.findCatalogItem(pegName);
                        if (pegItem) {
                            let pegPayoutPrice = Number(pegItem.buyEach || 0);
                            // Fallback: if buyEach is missing/zero, derive from buyStack / bundleSize
                            if (pegPayoutPrice <= 0 && pegItem.buyStack) {
                                const bundleSize = Number(pegItem.bundleSize || 1) || 1;
                                pegPayoutPrice = Number(pegItem.buyStack) / bundleSize;
                            }
                            const pnwValue = remainingQty * pegQtyPerInd * pegPayoutPrice;
                            pnwDisplay = pnwValue > 0 ? O.fmt2(pnwValue) + ' EW' : '—';
                        } else {
                            // Peg not found, fallback to RNW
                            pnwDisplay = rnwDisplay;
                        }
                    } else {
                        // No peg, fallback to RNW
                        pnwDisplay = rnwDisplay;
                    }
                }
            } catch (e) {
                console.warn('RNW/PNW calculation error:', e);
            }
        }

        // ===== Build row HTML =====
        const cells = [
            `<td class="mono">${O.esc(l.listingId)}</td>`,
            `<td>${O.esc(l.itemName)}</td>`,
            `<td>${statusPill(l.statusRaw || l.status)}</td>`,
            `<td class="mono">${(l.qtyAvailable == null ? '0' : String(l.qtyAvailable))}</td>`,
            `<td class="mono">${Number(l.stackSize || 1) || 1}</td>`
        ];

        // ===== Add value columns based on listing type =====
        if (type === 'SELL') {
            // SELL: always show RNW and PNW
            cells.push(`<td class="mono value-rnw">${rnwDisplay}</td>`);
            cells.push(`<td class="mono value-pnw">${pnwDisplay}</td>`);
            cells.push(`<td class="mono">${O.esc(pricingLabel(l))}</td>`);
        } else {
            // BUY: always render all columns in same order for consistency
            // Column 1: Locked EW (only show for FULL+FIXED_EW, else "—")
            const lockedEWDisplay = (listingMode === 'FULL' && pricingMode === 'FIXED_EW' && locked > 0)
                ? O.fmt2(locked) + ' EW'
                : '—';
            cells.push(`<td class="mono value-locked">${lockedEWDisplay}</td>`);

            // Column 2 & 3: RNW and PNW
            cells.push(`<td class="mono value-rnw">${rnwDisplay}</td>`);
            cells.push(`<td class="mono value-pnw">${pnwDisplay}</td>`);

            // Column 4: Pricing
            cells.push(`<td class="mono">${O.esc(pricingLabel(l))}</td>`);
        }

        // ===== Action buttons =====
        const isBuy = type === 'BUY';
        const hasLockedEW = locked > 0;
        const showPause = isBuy && status === 'ACTIVE' && hasLockedEW;
        const showUnpause = isBuy && status === 'PAUSED' && hasLockedEW;
        const showDelete = status === 'ACTIVE' || status === 'PAUSED';

        let actionsHtml = `<button type="button" data-edit="1">Edit</button>`;
        actionsHtml += ` <button type="button" data-restock="1">Restock</button>`;
        if (showPause) actionsHtml += ` <button type="button" data-pause="1" class="small">Pause</button>`;
        if (showUnpause) actionsHtml += ` <button type="button" data-unpause="1" class="small">Unpause</button>`;
        if (showDelete) actionsHtml += ` <button type="button" data-delete="1" class="small danger">Delete</button>`;

        cells.push(`<td>${actionsHtml}</td>`);

        tr.innerHTML = cells.join('');

        // ===== Wire event listeners =====
        tr.querySelector('button[data-edit]')?.addEventListener('click', () => openEditListing(l));
        tr.querySelector('button[data-restock]')?.addEventListener('click', () => openRestock(l));
        tr.querySelector('button[data-pause]')?.addEventListener('click', () => pauseListing_(l.listingId));
        tr.querySelector('button[data-unpause]')?.addEventListener('click', () => unpauseListing_(l.listingId));
        tr.querySelector('button[data-delete]')?.addEventListener('click', () => deleteListing_(l.listingId));

        tb.appendChild(tr);
    }
    function renderMyListings() {
        const sellTb = byId('tbSellListings');
        const buyTb = byId('tbBuyListings');
        const pendingTb = byId('tbPendingListings');

        sellTb.innerHTML = '';
        buyTb.innerHTML = '';
        pendingTb.innerHTML = '';

        (S.myListings || []).forEach(l => {
            const status = String(l.statusRaw || '').toUpperCase();

            // Never render deleted listings — belt-and-suspenders guard in case
            // the backend ever returns them (e.g. stale cache, legacy path).
            if (status === 'DELETED') return;

            if (status === 'PENDING_REVIEW') {
                const extra = O.safeJsonParse(l.extraJson || '{}', {}) || {};
                const isBrandNew = !extra.merchantEditKind;

                // Q4 Option B: only show Cancel+Delete for edits; only Delete for brand-new
                const actionsHtml = isBrandNew
                    ? `<button type="button" data-delete-pending="1">Delete</button>`
                    : `<button type="button" data-cancel-pending="1">Cancel</button>
       <button type="button" data-delete-pending="1">Delete</button>`;

                const tr = document.createElement('tr');
                tr.innerHTML = `
    <td class="mono">${esc(l.listingId)}</td>
    <td>${esc(l.itemName)}</td>
<td>${esc(l.type || '')}</td>
    <td>${statusPill(status)}</td>
 <td class="mono">${esc(l.updatedAt || '')}</td>
    <td class="mono">${esc(l.approvedBy || '')}</td>
<td>${editKindLabel(l)}</td>
    <td>${actionsHtml}</td>
   `;

                tr.querySelector('button[data-cancel-pending]')?.addEventListener('click', async () => {
                    const confirmMsg = 'Cancel review and restore listing to its previous state?';
                    if (!confirm(confirmMsg)) return;
                    try {
                        await apiPost('ocmCancelPendingListingV2', { idToken: S.googleIdToken, listingId: l.listingId });
                        await O.loadMyListings();
                    } catch (e) { alert('Error: ' + (e.message || e)); }
                });

                tr.querySelector('button[data-delete-pending]')?.addEventListener('click', async () => {
                    if (!confirm('Permanently delete this listing?')) return;
                    try {
                        await apiPost('ocmDeleteListingV2', { idToken: S.googleIdToken, listingId: l.listingId });
                        alert('✓ Listing deleted. EW refunded to your balance.');
                        await O.loadMyListings();
                        await refreshMerchantBalance_();
                    } catch (e) { alert('Error: ' + (e.message || e)); }
                });

                pendingTb.appendChild(tr);
                return;
            }

            if (l.type === 'SELL') renderListingRow(sellTb, l);
            else renderListingRow(buyTb, l);
        });
    }

    // ===== FEATURE B — Delete listing from Edit dialog =====
    async function deleteListing_(listingId) {
        if (!confirm('Permanently delete listing ' + listingId + '?')) return;
        const msg = byId('editListingMsg');
        msg.textContent = 'Deleting...';
        try {
            await apiPost('ocmDeleteListingV2', { idToken: S.googleIdToken, listingId });
            msg.textContent = 'Deleted. EW refunded to your balance.';
            await O.loadMyListings();
            await refreshMerchantBalance_();
            setTimeout(() => byId('dlgEditListing').close(), 350);
        } catch (e) {
            msg.textContent = 'Error: ' + (e.message || e);
        }
    }

    // ===== FEATURE B & C: Pause listing =====
    async function pauseListing_(listingId) {
        if (!confirm('Pause this listing? EW will be returned to your balance.')) return;
        try {
            const r = await apiPost('ocmPauseListingV2', { idToken: S.googleIdToken, listingId });
            const d = r.data || r.result || r;
            alert('✓ Listing paused. ' + (d.message || 'EW returned to balance.'));
            await O.loadMyListings();
            await refreshMerchantBalance_();
        } catch (e) {
            alert('Error pausing listing: ' + (e.message || e));
        }
    }

    // ===== FEATURE B & C: Unpause listing =====
    async function unpauseListing_(listingId) {
        if (!confirm('Unpause this listing? EW will be locked again pending admin approval.')) return;
        try {
            const r = await apiPost('ocmUnpauseListingV2', { idToken: S.googleIdToken, listingId });
            const d = r.data || r.result || r;
            alert('✓ Listing unpaused. ' + (d.message || 'Sent for admin review.'));
            await O.loadMyListings();
            await refreshMerchantBalance_();
        } catch (e) {
            alert('Error unpausing listing: ' + (e.message || e));
        }
    }

    // ===== Edit listing dialog (FULL_EDIT) =====
    function syncEditModeUI_() {
        const lm = byId('editListingMode').value;
        const store = (lm === 'STORE');
        const full = (lm === 'FULL');

        byId('editStoreItemBlock').style.display = store ? '' : 'none';
        byId('editCustomItemBlock').style.display = store ? 'none' : '';

        if (full) {
            byId('editPricingMode').value = 'FIXED_EW';
            byId('editPricingMode').disabled = true;
        } else {
            byId('editPricingMode').disabled = false;
        }

        const pm = byId('editPricingMode').value;
        byId('editFixedFields').style.display = (pm === 'FIXED_EW') ? '' : 'none';
        byId('editPegBox').style.display = (pm === 'PEG') ? '' : 'none';
        byId('btnEditAddAlt').disabled = (pm !== 'PEG');
    }

    function renderEditPegBox_(soldNameGetter, soldStackGetter) {
        const box = byId('editPegBox');
        box.innerHTML = '';

        S.editState.alts = [];

        S.editState.primary = O.makePegRowDom_({
            title: 'Primary peg (required)',
            canRemove: false,
            defaultRow: S.editState.primary || { itemName: '', ui: { priceBasis: 'IND', pegQtyBasis: 'IND', pegQtyInput: 1 } },
            getSoldName: soldNameGetter,
            getSoldStackSize: soldStackGetter,
            getListingType: () => byId('editType')?.value || 'SELL',
            onChange: () => O.validatePegSet_(S.editState.primary, S.editState.alts, byId('editPegWarn'))
        });
        box.appendChild(S.editState.primary);

        const existingAlts = (S.editState._initialAltRows || []);
        S.editState._initialAltRows = null;

        existingAlts.forEach((a, i) => {
            const row = O.makePegRowDom_({
                title: `Alternative peg #${i + 1}`,
                canRemove: true,
                defaultRow: a,
                getSoldName: soldNameGetter,
                getSoldStackSize: soldStackGetter,
                getListingType: () => byId('editType')?.value || 'SELL',
                onRemove: () => {
                    const idx = S.editState.alts.indexOf(row);
                    if (idx >= 0) S.editState.alts.splice(idx, 1);
                    row.remove();
                    O.validatePegSet_(S.editState.primary, S.editState.alts, byId('editPegWarn'));
                },
                onChange: () => O.validatePegSet_(S.editState.primary, S.editState.alts, byId('editPegWarn'))
            });
            S.editState.alts.push(row);
            box.appendChild(row);
        });

        O.validatePegSet_(S.editState.primary, S.editState.alts, byId('editPegWarn'));
    }

    function openEditListing(l) {
        S.editingListing = l;
        byId('editListingId').textContent = l.listingId;

        const listingMode = String(l.pricing?.listingMode || (O.safeJsonParse(l.extraJson || '{}', {}) || {}).listingMode || '').toUpperCase()
            || (String(l.sourceItemId || '').startsWith('sheet:') ? 'STORE' : 'HALF');
        byId('editListingMode').value = (listingMode === 'FULL') ? 'FULL' : (listingMode === 'STORE' ? 'STORE' : 'HALF');

        byId('editType').value = String(l.type || 'SELL').toUpperCase();

        const rem = (l.remainingQuantity == null || l.remainingQuantity === '') ? (l.qtyAvailable ?? 0) : l.remainingQuantity;
        const remInt = Math.max(0, Math.round(Number(rem || 0) || 0));
        byId('editQty').value = String(remInt);

        byId('editItemStore').value = '';
        byId('editItemCustom').value = '';
        byId('editStack').value = String(Number(l.stackSize || 1) || 1);

        if (byId('editListingMode').value === 'STORE') byId('editItemStore').value = l.itemName || '';
        else byId('editItemCustom').value = l.itemName || '';

        const pm = String(l.pricing?.mode || 'PEG').toUpperCase();
        byId('editPricingMode').value = (pm === 'FIXED_EW') ? 'FIXED_EW' : 'PEG';
        byId('editFixedBTVal').value = String(l.pricing?.fixedEWPerUnit ?? 1);

        byId('editPause').checked = String(l.statusRaw || '').toUpperCase() === 'PAUSED';
        byId('editListingMsg').textContent = '';
        byId('editPegWarn').textContent = '';

        const prim = l.pricing?.primaryPeg || (l.pricing?.pegItemName ? {
            itemName: l.pricing.pegItemName,
            ui: { priceBasis: l.pricing.pricingBasis || 'IND', pegQtyBasis: 'IND', pegQtyInput: Math.max(1, Math.round(Number(l.pricing.pegQtyPerUnit || 1) || 1)) }
        } : null);

        S.editState.primary = prim || { itemName: '', ui: { priceBasis: 'IND', pegQtyBasis: 'IND', pegQtyInput: 1 } };
        S.editState._initialAltRows = (Array.isArray(l.pricing?.altPegs) ? l.pricing.altPegs : []).map(a => ({
            itemName: a.itemName,
            ui: a.ui || { priceBasis: 'IND', pegQtyBasis: 'IND', pegQtyInput: 1 }
        }));

        const soldNameGetter = () => {
            const lm = byId('editListingMode').value;
            return (lm === 'STORE') ? (byId('editItemStore').value.trim() || 'ITEM') : (byId('editItemCustom').value.trim() || 'ITEM');
        };
        const soldStackGetter = () => {
            const lm = byId('editListingMode').value;
            if (lm === 'STORE') {
                const it = O.findCatalogItem(byId('editItemStore').value.trim());
                return Number(it?.bundleSize || 1) || 1;
            }
            return Number(byId('editStack').value || 1) || 1;
        };

        renderEditPegBox_(soldNameGetter, soldStackGetter);
        syncEditModeUI_();

        // Refresh PEG statement favor labels when Type dropdown changes
        try {
            const typeEl = byId('editType');
            if (typeEl && !typeEl._ocmPegTypeRefreshHooked) {
                typeEl._ocmPegTypeRefreshHooked = true;
                typeEl.addEventListener('change', () => {
                    try {
                        if (S.editState?.primary?.refreshStatement) S.editState.primary.refreshStatement();
                        (S.editState?.alts || []).forEach(r => r?.refreshStatement && r.refreshStatement());
                    } catch { /* ignore */ }
                });
            }
        } catch { /* ignore */ }

        byId('dlgEditListing').showModal();
    }

    async function saveListingEdit() {
        if (!S.editingListing) return;
        const msg = byId('editListingMsg');
        msg.textContent = 'Saving...';

        try {
            const listingId = S.editingListing.listingId;

            const listingMode = byId('editListingMode').value;
            const type = byId('editType').value;
            const paused = byId('editPause').checked;

            let itemName = '';
            let stackSize = 1;
            let sourceItemId = '';

            if (listingMode === 'STORE') {
                itemName = byId('editItemStore').value.trim();
                const it = O.findCatalogItem(itemName);
                if (!it) throw new Error('Store item not found in catalog');
                stackSize = Number(it.bundleSize || 1) || 1;
                sourceItemId = 'sheet:' + it.name;
            } else {
                const itemNameRaw = byId('editItemCustom').value.trim();
                if (!itemNameRaw) throw new Error('Item name required');
                if (!O.isLettersOnly_(itemNameRaw)) throw new Error('Custom item name must contain letters only (A-Z).');
                itemName = itemNameRaw;

                stackSize = Math.max(1, Math.round(Number(byId('editStack').value || 1) || 1));
                if (!isFinite(stackSize) || stackSize <= 0) throw new Error('Invalid stack size');
                sourceItemId = '';
            }

            const remainingQuantity = Math.max(0, Math.round(Number(byId('editQty').value || 0) || 0));
            if (!isFinite(remainingQuantity) || remainingQuantity < 0) throw new Error('Invalid remaining quantity');

            const pricingMode = byId('editPricingMode').value;

            const payload = {
                idToken: S.googleIdToken,
                listingId,
                merchantEditKind: 'FULL_EDIT',
                listingMode,
                type,
                itemName,
                stackSize,
                sourceItemId,
                remainingQuantity,
                quantityUnits: remainingQuantity,
                pricingMode
            };

            if (paused) payload.status = 'PAUSED';

            if (listingMode === 'FULL') {
                const fixedEWPerUnit = Number(byId('editFixedBTVal').value || 0);
                if (!isFinite(fixedEWPerUnit) || fixedEWPerUnit <= 0) throw new Error('Fixed EW per unit must be >0');
                payload.pricingMode = 'FIXED_EW';
                payload.fixedEWPerUnit = fixedEWPerUnit;
            } else {
                if (pricingMode === 'FIXED_EW') throw new Error('FIXED_EW is only allowed for FULL listings.');
                if (!O.validatePegSet_(S.editState.primary, S.editState.alts, byId('editPegWarn'))) throw new Error('Fix peg inputs');
                const pegPayload = O.buildPegPayload_(S.editState.primary, S.editState.alts);
                payload.pricingMode = 'PEG';
                payload.primaryPeg = pegPayload.primaryPeg;
                payload.altPegs = pegPayload.altPegs;
            }

            await apiPost('ocmUpdateListingV2', payload);
            msg.textContent = 'Saved and sent for review.';
            await O.loadMyListings();
            setTimeout(() => byId('dlgEditListing').close(), 350);
        } catch (e) {
            msg.textContent = 'Error: ' + (e.message || e);
        }
    }

    // ===== REFRESH MERCHANT BALANCE — Called after lock/unlock =====
    async function refreshMerchantBalance_() {
        try {
            const resp = await apiGet('getBalance', {});
            if (resp.ok && resp.data) {
                const newBalance = Number(resp.data.balanceBT || 0);
                const balDisplay = document.querySelector('[data-balance-display]');
                if (balDisplay) {
                    balDisplay.textContent = newBalance.toFixed(2) + ' EW';
                }
                if (typeof S !== 'undefined' && S.currentUser) {
                    S.currentUser.balanceBT = newBalance;
                }
                return newBalance;
            }
        } catch (e) {
            console.warn('Balance refresh failed:', e.message);
        }
        return null;
    }

    // ===== Restock dialog =====
    function openRestock(l) {
        S.restockingListing = l;
        byId('restockListingId').textContent = l.listingId;
        byId('restockQtyInput').value = String(Math.max(0, Math.round(Number(l.remainingQuantity ?? l.qtyAvailable ?? 0) || 0)));
        byId('restockQtyMode').value = 'IND';
        byId('restockMsg').textContent = '';
        byId('dlgRestock').showModal();
    }

    async function sendRestock() {
        if (!S.restockingListing) return;
        const msg = byId('restockMsg');
        msg.textContent = 'Saving...';

        try {
            const listingId = S.restockingListing.listingId;
            const qtyIn = Math.max(0, Math.round(Number(byId('restockQtyInput').value || 0) || 0));
            const mode = byId('restockQtyMode').value;
            const ss = Number(S.restockingListing.stackSize || 1) || 1;
            const remainingQuantity = O.computeQtyUnitsFromInput(qtyIn, mode, ss);

            await apiPost('ocmUpdateListingV2', {
                idToken: S.googleIdToken,
                listingId,
                merchantEditKind: 'RESTOCK_ONLY',
                remainingQuantity,
                quantityUnits: remainingQuantity
            });

            msg.textContent = 'Restock sent for review.';
            await O.loadMyListings();
            setTimeout(() => byId('dlgRestock').close(), 350);
        } catch (e) {
            msg.textContent = 'Error: ' + (e.message || e);
        }
    }

    // exports
    O.setCreationTab = setCreationTab;
    O.createListingStore = createListingStore;
    O.createListingHalf = createListingHalf;
    O.createListingFull = createListingFull;
    O.loadMyListings = loadMyListings;

    O.openEditListing = openEditListing;
    O.saveListingEdit = saveListingEdit;
    O.deleteListing_ = deleteListing_;
    O.pauseListing_ = pauseListing_;
    O.unpauseListing_ = unpauseListing_;
    O.refreshMerchantBalance_ = refreshMerchantBalance_;
    O.openRestock = openRestock;
    O.sendRestock = sendRestock;
    O.syncEditModeUI_ = syncEditModeUI_;
    O.renderEditPegBox_ = renderEditPegBox_;
})();
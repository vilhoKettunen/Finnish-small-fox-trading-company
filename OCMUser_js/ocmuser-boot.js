// Boot/wiring for OCMUser
(function () {
    'use strict';

    const O = window.OCMUser;
    const byId = O.byId;

    function on(el, ev, fn) {
        if (el && el.addEventListener) el.addEventListener(ev, fn);
    }

    window.onload = () => {
        // Enforce letters-only custom item names (HALF + FULL + EDIT)
        try { O.enforceLettersOnlyInput_(byId('createItemHalf')); } catch { }
        try { O.enforceLettersOnlyInput_(byId('createItemFull')); } catch { }
        try { O.enforceLettersOnlyInput_(byId('editItemCustom')); } catch { }

        try { window.initSharedTopBar && window.initSharedTopBar(); } catch (e) { console.warn('topbar init failed', e); }
        document.body.classList.add('withTopBar');

        on(byId('tabCreateStore'), 'click', () => O.setCreationTab('store'));
        on(byId('tabCreateHalf'), 'click', () => O.setCreationTab('half'));
        on(byId('tabCreateFull'), 'click', () => O.setCreationTab('full'));

        on(byId('btnCreateStore'), 'click', O.createListingStore);
        on(byId('btnCreateHalf'), 'click', O.createListingHalf);
        on(byId('btnCreateFull'), 'click', O.createListingFull);

        // Replace the two addAltPeg_ click handlers and the initCreatorPegUIs_ call to use safe fallbacks
        on(byId('btnCreateStoreAddAlt'), 'click', () => {
            const fn = (O && O.addAltPeg_) || window.addAltPeg_;
            if (typeof fn === 'function') fn('store');
        });
        on(byId('btnCreateHalfAddAlt'), 'click', () => {
            const fn = (O && O.addAltPeg_) || window.addAltPeg_;
            if (typeof fn === 'function') fn('half');
        });

        on(byId('editListingMode'), 'change', () => {
            O.syncEditModeUI_();
            const soldNameGetter = () => {
                const lm = byId('editListingMode')?.value;
                return (lm === 'STORE') ? (byId('editItemStore')?.value.trim() || 'ITEM') : (byId('editItemCustom')?.value.trim() || 'ITEM');
            };
            const soldStackGetter = () => {
                const lm = byId('editListingMode')?.value;
                if (lm === 'STORE') {
                    const it = O.findCatalogItem(byId('editItemStore')?.value.trim());
                    return Number(it?.bundleSize || 1) || 1;
                }
                return Number(byId('editStack')?.value || 1) || 1;
            };
            O.renderEditPegBox_(soldNameGetter, soldStackGetter);
        });

        on(byId('editPricingMode'), 'change', O.syncEditModeUI_);

        on(byId('btnEditAddAlt'), 'click', () => {
            if (O.state.editState.alts.length >= 10) {
                const w = byId('editPegWarn');
                if (w) w.textContent = 'Max10 alternative pegs.';
                return;
            }

            const soldNameGetter = () => {
                const lm = byId('editListingMode')?.value;
                return (lm === 'STORE') ? (byId('editItemStore')?.value.trim() || 'ITEM') : (byId('editItemCustom')?.value.trim() || 'ITEM');
            };
            const soldStackGetter = () => {
                const lm = byId('editListingMode')?.value;
                if (lm === 'STORE') {
                    const it = O.findCatalogItem(byId('editItemStore')?.value.trim());
                    return Number(it?.bundleSize || 1) || 1;
                }
                return Number(byId('editStack')?.value || 1) || 1;
            };

            const idx = O.state.editState.alts.length + 1;
            const row = O.makePegRowDom_({
                title: `Alternative peg #${idx}`,
                canRemove: true,
                defaultRow: { itemName: '', ui: { priceBasis: 'IND', pegQtyBasis: 'IND', pegQtyInput: 1 } },
                getSoldName: soldNameGetter,
                getSoldStackSize: soldStackGetter,
                onRemove: () => {
                    const i = O.state.editState.alts.indexOf(row);
                    if (i >= 0) O.state.editState.alts.splice(i, 1);
                    row.remove();
                    O.validatePegSet_(O.state.editState.primary, O.state.editState.alts, byId('editPegWarn'));
                },
                onChange: () => O.validatePegSet_(O.state.editState.primary, O.state.editState.alts, byId('editPegWarn'))
            });

            O.state.editState.alts.push(row);
            const box = byId('editPegBox');
            if (box) box.appendChild(row);
            O.validatePegSet_(O.state.editState.primary, O.state.editState.alts, byId('editPegWarn'));
        });

        on(byId('btnSaveListing'), 'click', O.saveListingEdit);
        on(byId('btnCloseListing'), 'click', () => byId('dlgEditListing')?.close());

        on(byId('btnSendRestock'), 'click', O.sendRestock);
        on(byId('btnCloseRestock'), 'click', () => byId('dlgRestock')?.close());

        // Reload helpers
        on(byId('btnReloadMine'), 'click', O.loadMyListings);
        on(byId('btnReloadMineTrades'), 'click', O.loadPendingRequests);
        on(byId('btnReloadIncoming'), 'click', O.loadPendingRequests);

        on(byId('btnSaveTrade'), 'click', O.saveTradeEdit);
        on(byId('btnCloseTrade'), 'click', () => byId('dlgEditTrade')?.close());

        // When catalog is ready try to initialize PEG UI; if the PEG module wasn't attached,
        // offer a retry loader and show a clear diagnostic message so the page remains usable.
        O.ensureCatalogLoaded().then(() => {
            const initFn = (O && O.initCreatorPegUIs_) || window.initCreatorPegUIs_;
            if (typeof initFn === 'function') {
                try { initFn(); } catch (e) { console.warn('initCreatorPegUIs_ failed', e); }
            } else {
                console.warn('initCreatorPegUIs_ not available');

                // Show a non-blocking diagnostic + retry load UI in both create boxes.
                try {
                    const makeNotice = (boxId) => {
                        const box = byId(boxId);
                        if (!box) return;

                        // Avoid duplicate notice
                        if (box._pegInitNotice) return;
                        const n = document.createElement('div');
                        n.style.border = '1px dashed #e0e0e0';
                        n.style.padding = '8px';
                        n.style.borderRadius = '6px';
                        n.style.marginTop = '8px';
                        n.className = 'small muted';
                        n.innerHTML = `
                    <div><strong>PEG UI not loaded</strong> — the PEG helper script did not attach its UI functions.</div>
                    <div style="margin-top:6px;">
                        <button type="button" class="small" data-retry>Retry loading PEG UI</button>
                        <span style="margin-left:8px;" class="small">Open console for details.</span>
                    </div>
                `;
                        box.appendChild(n);
                        box._pegInitNotice = n;

                        const btn = n.querySelector('button[data-retry]');
                        btn.addEventListener('click', () => {
                            // Dynamically reload the PEG script (cache-busted).
                            const scriptUrl = 'OCMUser_js/ocmuser-pegs.js?r=' + Date.now();
                            const s = document.createElement('script');
                            s.src = scriptUrl;
                            s.async = true;
                            s.onload = () => {
                                console.info('ocmuser-pegs.js reloaded, attempting init...');
                                const fn2 = (O && O.initCreatorPegUIs_) || window.initCreatorPegUIs_;
                                if (typeof fn2 === 'function') {
                                    try { fn2(); n.remove(); box._pegInitNotice = null; } catch (ex) { console.error('PEG init after reload failed', ex); alert('PEG init failed. See console.'); }
                                } else {
                                    alert('PEG module loaded but init function still not found. See console.');
                                }
                            };
                            s.onerror = (ev) => {
                                console.error('Failed to load PEG script', ev);
                                alert('Failed to load PEG UI script. Check network/console.');
                            };
                            document.head.appendChild(s);
                        });
                    };

                    makeNotice('createStorePegBox');
                    makeNotice('createHalfPegBox');
                } catch (e) {
                    console.warn('Failed to render PEG UI diagnostic notice', e);
                }
            }

            // Register OCMUser catalog lookup for shared trade-more-info renderer (More info details)
            try {
                if (window.TradeMoreInfo && typeof window.TradeMoreInfo.setCatalogLookup === 'function' && typeof O.findCatalogItem === 'function') {
                    window.TradeMoreInfo.setCatalogLookup(O.findCatalogItem);
                }
            } catch { /* ignore */ }

            on(byId('createItemStore'), 'input', () => (O && O.validatePegSet_) ? O.validatePegSet_(O.state.createState.store.primary, O.state.createState.store.alts, byId('createStorePegWarn')) : null);
            on(byId('createItemHalf'), 'input', () => (O && O.validatePegSet_) ? O.validatePegSet_(O.state.createState.half.primary, O.state.createState.half.alts, byId('createHalfPegWarn')) : null);
            on(byId('createStackHalf'), 'input', () => (O && O.validatePegSet_) ? O.validatePegSet_(O.state.createState.half.primary, O.state.createState.half.alts, byId('createHalfPegWarn')) : null);
        }).catch(e => console.warn('catalog init failed', e));

        // Always boot auth last (must not be blocked by missing sections)
        try { O.bootAuth_(); } catch (e) { console.warn('auth boot failed', e); }
    };

})();
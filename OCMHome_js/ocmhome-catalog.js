// Catalog helpers for OCMHome (loaded from public sheet)
(function () {
 'use strict';

 const O = window.OCMHome;
 const S = O.state;

 async function ensureCatalogLoaded() {
 if (S.catalog && S.catalog.length) return;

 try {
 await window.OcmCatalog.ensureLoaded();
 S.catalog = window.OcmCatalog.get();
 } catch (e) {
 console.warn('Failed to load catalog from shared sheet loader:', e);
 S.catalog = [];
 }
 }

 function findCatalogItem(name) {
 if (window.OcmCatalog && typeof window.OcmCatalog.find === 'function') return window.OcmCatalog.find(name);
 const q = String(name || '').trim().toLowerCase();
 return (S.catalog || []).find(i => String(i.name || '').trim().toLowerCase() === q) || null;
 }

 function getStoreEachPrice_(it, side) {
 if (!it) return null;
 const v = (side === 'BUY') ? it.buyEach : it.sellEach;
 return O.parseBtNumber_(v);
 }

 function getStoreStackPrice_(it, side) {
 if (!it) return null;
 const v = (side === 'BUY') ? it.buyStack : it.sellStack;
 return O.parseBtNumber_(v);
 }

 function perIndPriceFromCatalog_(itemName, side) {
 const it = findCatalogItem(itemName);
 if (!it) return null;

 const each = getStoreEachPrice_(it, side);
 if (each != null) return each;

 const stk = getStoreStackPrice_(it, side);
 const bs = Number(it.bundleSize ||1) ||1;
 if (stk != null) return stk / bs;

 return null;
 }

 O.ensureCatalogLoaded = ensureCatalogLoaded;
 O.findCatalogItem = findCatalogItem;
 O.getStoreEachPrice_ = getStoreEachPrice_;
 O.getStoreStackPrice_ = getStoreStackPrice_;
 O.perIndPriceFromCatalog_ = perIndPriceFromCatalog_;
})();

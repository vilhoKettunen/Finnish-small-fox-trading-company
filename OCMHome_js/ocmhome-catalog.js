// Catalog helpers for OCMHome (loaded from public sheet)
(function () {
 'use strict';

 const O = window.OCMHome;
 const S = O.state;

 // Public price sheet (GViz JSON endpoint)
 const SHEET_GVIZ_URL =
 'https://docs.google.com/spreadsheets/d/1_meliJtuKSDwEWRDh1gldcsD-pSjDgIND3dcE1mCjCo/gviz/tq?tqx=out:json&gid=0';

 function extractJsonFromGviz_(txt) {
 const s = txt.indexOf('(');
 const e = txt.lastIndexOf(')');
 const payload = (s > -1 && e > s) ? txt.slice(s +1, e) : txt;
 return JSON.parse(payload);
 }

 function cellTextOrValue_(cell) {
 // GViz cells often provide { v: ..., f: ... }. Prefer formatted (f) if present.
 if (!cell) return null;
 if (cell.f != null) return cell.f;
 return cell.v;
 }

 async function ensureCatalogLoaded() {
 if (S.catalog && S.catalog.length) return;

 try {
 const r = await fetch(SHEET_GVIZ_URL, { method: 'GET' });
 const txt = await r.text();
 const json = extractJsonFromGviz_(txt);

 const rows = json?.table?.rows || [];
 const out = [];

 for (const row of rows) {
 const c = row?.c || [];

 const name = (c[0]?.v != null) ? String(c[0].v).trim() : '';
 if (!name) continue;

 // Sheet mapping (same as backend):
 // c[1]=buyStack, c[2]=sellStack, c[4]=bundleSize, c[5]=buyEach, c[6]=sellEach
 const buyStack = O.parseBtNumber_(cellTextOrValue_(c[1]));
 const sellStack = O.parseBtNumber_(cellTextOrValue_(c[2]));
 const bundleSize = O.parseBtNumber_(cellTextOrValue_(c[4])) ??1;
 const buyEach = O.parseBtNumber_(cellTextOrValue_(c[5]));
 const sellEach = O.parseBtNumber_(cellTextOrValue_(c[6]));

 out.push({
 name,
 bundleSize: Number(bundleSize ||1) ||1,
 buyStack,
 sellStack,
 buyEach,
 sellEach
 });
 }

 S.catalog = out;
 } catch (e) {
 console.warn('Failed to load catalog from sheet:', e);
 S.catalog = [];
 }
 }

 function findCatalogItem(name) {
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

// Shared OCM/Main-Store catalog loader (reads the public Google Sheet via GViz)
// Exposes: window.OcmCatalog.ensureLoaded(), window.OcmCatalog.get(), window.OcmCatalog.find(name)
(function () {
 'use strict';

 const SHEET_GVIZ_URL =
 'https://docs.google.com/spreadsheets/d/1_meliJtuKSDwEWRDh1gldcsD-pSjDgIND3dcE1mCjCo/gviz/tq?tqx=out:json&gid=0';

 const ns = (window.OcmCatalog = window.OcmCatalog || {});

 let _loaded = false;
 let _loadingPromise = null;
 let _items = [];

 function parseBtNumber_(v) {
 if (v == null || v === '') return null;
 if (typeof v === 'number') return isFinite(v) ? v : null;

 let s = String(v).trim();
 if (!s) return null;

 // remove whitespace (including non-breaking)
 s = s.replace(/\s+/g, '');

 const hasDot = s.includes('.');
 const hasComma = s.includes(',');

 if (hasDot && hasComma) {
 const lastDot = s.lastIndexOf('.');
 const lastComma = s.lastIndexOf(',');
 if (lastComma > lastDot) {
 // "1.234,56" -> "1234.56"
 s = s.replace(/\./g, '');
 s = s.replace(',', '.');
 } else {
 // "1,234.56" -> "1234.56"
 s = s.replace(/,/g, '');
 }
 } else if (hasComma) {
 // "179,2" -> "179.2"
 s = s.replace(',', '.');
 }

 const n = Number(s);
 return isFinite(n) ? n : null;
 }

 function extractJsonFromGviz_(txt) {
 // Most responses are: "google.visualization.Query.setResponse(<json>);"
 const s = txt.indexOf('(');
 const e = txt.lastIndexOf(')');
 const payload = (s > -1 && e > s) ? txt.slice(s +1, e) : txt;
 return JSON.parse(payload);
 }

 function cellTextOrValue_(cell) {
 // Cells often provide { v: ..., f: ... }. Prefer numeric v, else formatted f.
 if (!cell) return null;
 if (cell.v != null) return cell.v;
 if (cell.f != null) return cell.f;
 return null;
 }

 function normalizeRow_(row) {
 const c = row?.c || [];

 const name = (c[0]?.v != null) ? String(c[0].v).trim() : '';
 if (!name) return null;

 // Sheet mapping:
 // c[1]=buyStack, c[2]=sellStack, c[4]=bundleSize, c[5]=buyEach, c[6]=sellEach
 const buyStack = parseBtNumber_(cellTextOrValue_(c[1]));
 const sellStack = parseBtNumber_(cellTextOrValue_(c[2]));
 const bundleSize = parseBtNumber_(cellTextOrValue_(c[4])) ??1;
 const buyEach = parseBtNumber_(cellTextOrValue_(c[5]));
 const sellEach = parseBtNumber_(cellTextOrValue_(c[6]));

 return {
 name,
 bundleSize: Number(bundleSize ||1) ||1,
 buyStack,
 sellStack,
 buyEach,
 sellEach
 };
 }

 async function ensureLoaded() {
 if (_loaded) return;
 if (_loadingPromise) return _loadingPromise;

 _loadingPromise = (async () => {
 try {
 const r = await fetch(SHEET_GVIZ_URL, { method: 'GET' });
 const txt = await r.text();
 const json = extractJsonFromGviz_(txt);
 const rows = json?.table?.rows || [];

 const out = [];
 for (const row of rows) {
 const it = normalizeRow_(row);
 if (it) out.push(it);
 }

 _items = out;
 } catch (e) {
 console.warn('OcmCatalog: failed to load sheet catalog:', e);
 _items = [];
 } finally {
 _loaded = true;
 _loadingPromise = null;
 }
 })();

 return _loadingPromise;
 }

 function get() {
 return _items.slice();
 }

 function find(name) {
 const q = String(name || '').trim().toLowerCase();
 if (!q) return null;
 return _items.find(i => String(i.name || '').trim().toLowerCase() === q) || null;
 }

 // Exports
 ns.ensureLoaded = ensureLoaded;
 ns.get = get;
 ns.find = find;
 ns._parseBtNumber = parseBtNumber_; // internal test hook

 // Dev-only debug hook
 function logOcmCatalogItem(name) {
 try {
 const it = find(name);
 console.log('OcmCatalog item:', name, it);
 return it;
 } catch (e) {
 console.warn('logOcmCatalogItem failed:', e);
 return null;
 }
 }

 function noop() {}

 Object.defineProperty(window, 'logOcmCatalogItem', {
 configurable: true,
 get: function () {
 return (window.OCM_DEBUG_CATALOG === true) ? logOcmCatalogItem : noop;
 }
 });
})();

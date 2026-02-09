// Core shared helpers/state for OCMHome page
(function () {
 'use strict';

 const OCMHome = (window.OCMHome = window.OCMHome || {});

 OCMHome.state = {
 googleIdToken: null,
 currentUser: null,
 catalog: [],

 // Raw cache from backend (fetched once-after-login; refreshed on demand)
 listingsCache: {
 sell: [],
 buy: [],
 fetchedAt: null
 },

 // Unified rendering output (current page slice)
 listingsView: {
 allMatching: [],
 pageItems: [],
 totalMatching:0,
 pageIndex:0,
 pageCount:0
 },

 // Filters
 draftFilters: {
 type: 'SELL',
 itemText: '',
 merchantText: '',
 pegNames: []
 },
 appliedFilters: {
 type: 'SELL',
 itemText: '',
 merchantText: '',
 pegNames: []
 },

 // Immediate filters / tuning
 onlyItemPayment: false,
 stockMin: null,
 stockMax: null,
 sort: 'NONE', // NONE|PRICE_ASC|PRICE_DESC
 pageSize:20,
 pageIndex:0
 };

 OCMHome.byId = function byId(id) { return document.getElementById(id); };

 OCMHome.safeJsonParse = function safeJsonParse(s) {
 try { return JSON.parse(s); } catch { return null; }
 };

 // Display formatting: always use "." decimals on the page
 OCMHome.fmt2 = function fmt2(v) {
 v = Number(v);
 if (!isFinite(v)) v =0;
 return v.toFixed(2).replace(/\.0+$/, '').replace(/\.(\d*[1-9])0+$/, '.$1');
 };

 // Parse currency-like numbers that may contain "," decimals
 OCMHome.parseBtNumber_ = function parseBtNumber_(v) {
 if (v == null || v === '') return null;
 if (typeof v === 'number') return isFinite(v) ? v : null;

 let s = String(v).trim();
 if (!s) return null;

 s = s.replace(/\s+/g, '');

 const hasDot = s.includes('.');
 const hasComma = s.includes(',');

 if (hasDot && hasComma) {
 const lastDot = s.lastIndexOf('.');
 const lastComma = s.lastIndexOf(',');
 if (lastComma > lastDot) {
 // "1.234,56" ->1234.56
 s = s.replace(/\./g, '');
 s = s.replace(',', '.');
 } else {
 // "1,234.56" ->1234.56
 s = s.replace(/,/g, '');
 }
 } else if (hasComma) {
 // "179,2" ->179.2
 s = s.replace(',', '.');
 }

 const n = Number(s);
 return isFinite(n) ? n : null;
 };
})();

// Core shared helpers/state for OCMHome page
(function () {
 'use strict';

 const OCMHome = (window.OCMHome = window.OCMHome || {});

 OCMHome.state = {
 googleIdToken: null,
 currentUser: null,
 catalog: [],
 listingsSell: [],
 listingsBuy: [],
 activeTab: 'sell'
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

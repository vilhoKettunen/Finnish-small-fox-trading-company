// Core shared helpers/state for OCMUser page
(function () {
 'use strict';

 const OCMUser = (window.OCMUser = window.OCMUser || {});

 OCMUser.state = {
 googleIdToken: null,
 currentUser: null,
 catalog: [],
 myListings: [],

 // Peg UI state (creator + editor)
 createState: {
 store: { primary: null, alts: [] },
 half: { primary: null, alts: [] }
 },
 editState: { primary: null, alts: [] },

 // dialogs
 editingListing: null,
 restockingListing: null,
 editingTrade: null
 };

 OCMUser.byId = function byId(id) { return document.getElementById(id); };

 OCMUser.safeJsonParse = function safeJsonParse(s, fallback = null) {
 try { return JSON.parse(s); } catch { return fallback; }
 };

 // Display formatting: always use "." decimals (same as `OCMHome.html`).
 OCMUser.fmt2 = function fmt2(v) {
 v = Number(v);
 if (!isFinite(v)) v =0;
 return v.toFixed(2).replace(/\.0+$/, '').replace(/\.(\d*[1-9])0+$/, '.$1');
 };

 // Parse currency-like numbers that may contain "," decimals and/or thousands separators.
 // Copied from the hardened parser in `OCMHome.html`.
 OCMUser.parseBtNumber_ = function parseBtNumber_(v) {
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

 // Keep catalog values consistent by also handling the historical "x10" scaling bug.
 // Example bad values:28 (should be2.8),896 (should be89.6)
 OCMUser.parseMaybeScaledBt_ = function parseMaybeScaledBt_(raw) {
 const n = OCMUser.parseBtNumber_(raw);
 if (n == null || !isFinite(n)) return null;

 // If it's an integer >=10, assume legacy scaling by10.
 if (Number.isInteger(n) && n >=10) return n /10;
 return n;
 };

 OCMUser.esc = function esc(s) {
 return String(s || '')
 .replace(/&/g, '&amp;')
 .replace(/</g, '&lt;')
 .replace(/>/g, '&gt;')
 .replace(/"/g, '&quot;')
 .replace(/'/g, '&#39;');
 };

 // Letters-only helpers (kept behavior identical to inline version)
 OCMUser.isLettersOnly_ = function isLettersOnly_(s) {
 const v = String(s || '').replace(/\s+/g, ' ').trim();
 return /^[A-Za-z ]+$/.test(v) && /[A-Za-z]/.test(v);
 };

 OCMUser.sanitizeLettersOnly_ = function sanitizeLettersOnly_(raw, opts) {
 const o = Object.assign({ trim: false }, opts);

 let s = String(raw || '');
 s = s.replace(/\s/g, ' ');
 s = s.replace(/[^A-Za-z ]/g, '');
 s = s.replace(/ {2,}/g, ' ');
 if (o.trim) s = s.trim();
 return s;
 };

 OCMUser.enforceLettersOnlyInput_ = function enforceLettersOnlyInput_(inputEl) {
 if (!inputEl) return;

 inputEl.autocomplete = 'off';
 inputEl.spellcheck = false;

 inputEl.addEventListener('input', () => {
 const cleaned = OCMUser.sanitizeLettersOnly_(inputEl.value, { trim: false });
 if (inputEl.value !== cleaned) {
 const pos = inputEl.selectionStart ?? cleaned.length;
 inputEl.value = cleaned;
 try { inputEl.setSelectionRange(pos, pos); } catch { }
 }
 });

 inputEl.addEventListener('paste', (e) => {
 e.preventDefault();
 const txt = (e.clipboardData && e.clipboardData.getData('text')) || '';
 const cleanedPaste = OCMUser.sanitizeLettersOnly_(txt, { trim: false });

 const start = inputEl.selectionStart ?? inputEl.value.length;
 const end = inputEl.selectionEnd ?? inputEl.value.length;

 const before = inputEl.value.slice(0, start);
 const after = inputEl.value.slice(end);

 const merged = before + cleanedPaste + after;
 inputEl.value = OCMUser.sanitizeLettersOnly_(merged, { trim: false });

 const newPos = (before + cleanedPaste).length;
 try { inputEl.setSelectionRange(newPos, newPos); } catch { }
 });

 inputEl.value = OCMUser.sanitizeLettersOnly_(inputEl.value, { trim: false });
 };

 // ensure placeholder so other modules can attach
 // NOTE: do not stub OCMUser.loadPendingRequests here; it is defined in `ocmuser-trades.js`.
 // Leaving a stub would overwrite the real function if this core file loads after trades.
})();

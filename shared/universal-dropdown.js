// shared/universal-dropdown.js
// Universal dropdown with favorites support (localStorage) + optional progress circle.
(function () {
 'use strict';

 const STORAGE_KEY = 'ftc_favorites_v1';

 function safeParseJsonArray(txt) {
 try {
 const v = JSON.parse(txt);
 return Array.isArray(v) ? v : [];
 } catch {
 return [];
 }
 }

 function escHtml(s) {
 return String(s || '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
 }

 function loadFavoritesSet() {
 const arr = safeParseJsonArray(localStorage.getItem(STORAGE_KEY) || '[]');
 const set = new Set();
 for (const x of arr) {
 const name = String(x || '').trim();
 if (name) set.add(name);
 }
 return set;
 }

 function saveFavoritesSet(set) {
 const arr = Array.from(set.values());
 localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
 }

 function isFavorited(name) {
 const n = String(name || '').trim();
 if (!n) return false;
 return loadFavoritesSet().has(n);
 }

 function toggleFavorite(name) {
 const n = String(name || '').trim();
 if (!n) return false;

 const set = loadFavoritesSet();
 if (set.has(n)) set.delete(n);
 else set.add(n);
 saveFavoritesSet(set);
 return set.has(n);
 }

 function makeCircleSvg_(pct) {
 // Match index dropdowns SVG behavior.
 let p = Number(pct ||0);
 if (!isFinite(p)) p =0;
 p = Math.max(0, Math.min(100, Math.round(p)));

 const circle = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
 circle.setAttribute('class', 'stock-circle');
 // valid viewBox: min-x min-y width height
 circle.setAttribute('viewBox', '0 0 36 36');

 const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
 bg.setAttribute('cx', '18');
 bg.setAttribute('cy', '18');
 bg.setAttribute('r', '16');
 bg.setAttribute('stroke', '#eee');
 bg.setAttribute('stroke-width', '4');
 bg.setAttribute('fill', 'none');

 const fg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
 fg.setAttribute('cx', '18');
 fg.setAttribute('cy', '18');
 fg.setAttribute('r', '16');
 fg.setAttribute('stroke', p >=100 ? '#3cb371' : '#2196f3');
 fg.setAttribute('stroke-width', '4');
 fg.setAttribute('fill', 'none');
 fg.setAttribute('stroke-dasharray', Math.round((p /100) *2 * Math.PI *16) + ',1000');
 // rotate around center so arc starts at12 o'clock
 fg.setAttribute('transform', 'rotate(-90 18 18)');

 circle.appendChild(bg);
 circle.appendChild(fg);
 return circle;
 }

 function sortFavoritesFirst_(rows, favSet) {
 // Stable partition: favorites first, preserving original order within groups.
 const fav = [];
 const non = [];
 for (const r of rows) {
 if (favSet.has(r.name)) fav.push(r);
 else non.push(r);
 }
 return fav.concat(non);
 }

 function renderList(listEl, rows, opts) {
 const onSelect = opts.onSelect;
 const showProgress = !!opts.showProgress;

 const favSet = loadFavoritesSet();
 const sorted = sortFavoritesFirst_(rows, favSet);

 listEl.innerHTML = '';

 sorted.forEach((row, idx) => {
 const div = document.createElement('div');
 div.className = 'dropdown-item';
 div.dataset.index = String(idx);

 const fav = favSet.has(row.name);
 if (fav) div.classList.add('is-favorite');

 if (showProgress && row.progressPct != null) {
 div.appendChild(makeCircleSvg_(row.progressPct));
 }

 const label = document.createElement('div');
 label.className = 'dropdown-label';
 const extra = row.extra ? String(row.extra) : '';
 label.innerHTML = `<strong>${escHtml(row.name)}</strong>${extra ? `<br><small>${escHtml(extra)}</small>` : ''}`;

 const star = document.createElement('button');
 star.type = 'button';
 star.className = 'dropdown-fav-btn';
 star.setAttribute('aria-label', fav ? 'Unfavorite' : 'Favorite');
 star.title = fav ? 'Unfavorite' : 'Favorite';
 // Use universal star characters (filled vs outline) so UI is consistent across pages
 star.textContent = fav ? '★' : '☆';

 star.addEventListener('click', (ev) => {
 ev.preventDefault();
 ev.stopPropagation();
 const nowFav = toggleFavorite(row.name);
 // Update current row visuals immediately
 star.textContent = nowFav ? '★' : '☆';
 star.setAttribute('aria-label', nowFav ? 'Unfavorite' : 'Favorite');
 star.title = nowFav ? 'Unfavorite' : 'Favorite';
 div.classList.toggle('is-favorite', nowFav);

 // Re-render to keep favorites sorted at top.
 // Preserve scroll position as much as possible.
 const scrollTop = listEl.scrollTop;
 renderList(listEl, rows, opts);
 listEl.scrollTop = scrollTop;
 });

 div.appendChild(label);
 div.appendChild(star);

 div.addEventListener('mouseover', () => {
 Array.from(listEl.querySelectorAll('.dropdown-item')).forEach(s => s.classList.remove('active'));
 div.classList.add('active');
 });

 div.addEventListener('click', () => {
 if (typeof onSelect === 'function') onSelect(row.name, row);
 });

 listEl.appendChild(div);
 });
 }

 function attach(args) {
 const inputEl = args.inputEl;
 const listEl = args.listEl;
 const getItems = args.getItems;
 const getLabel = args.getLabel || ((x) => x?.name);
 const getExtraText = args.getExtraText || (() => '');
 const getProgressPct = args.getProgressPct || (() => null);
 const onSelect = args.onSelect;
 const maxItems = Number(args.maxItems ||200);
 const showProgress = !!args.showProgress;

 if (!inputEl || !listEl) return;

 function setActiveIndex(idx) {
 const itemsEls = Array.from(listEl.querySelectorAll('.dropdown-item'));
 itemsEls.forEach(it => it.classList.remove('active'));
 if (idx >=0 && idx < itemsEls.length) {
 itemsEls[idx].classList.add('active');
 itemsEls[idx].scrollIntoView({ block: 'nearest' });
 inputEl._dropIndex = idx;
 } else inputEl._dropIndex = -1;
 }

 function buildRows(q) {
 const items = (typeof getItems === 'function') ? (getItems() || []) : (args.items || []);
 const qq = String(q || '').toLowerCase();

 const out = [];
 for (const it of items) {
 const name = String(getLabel(it) || '').trim();
 if (!name) continue;
 if (qq && !name.toLowerCase().includes(qq)) continue;

 out.push({
 name,
 extra: getExtraText(it),
 progressPct: getProgressPct(it)
 });
 if (out.length >= maxItems) break;
 }
 return out;
 }

 function renderAndShow() {
 const q = (inputEl.value || '').toLowerCase();
 const rows = buildRows(q);

 renderList(listEl, rows, {
 onSelect: (name) => {
 inputEl.value = name;
 listEl.style.display = 'none';
 inputEl._dropIndex = -1;
 if (typeof onSelect === 'function') onSelect(name);
 },
 showProgress
 });

 inputEl._dropIndex = -1;
 listEl.style.display = listEl.querySelectorAll('.dropdown-item').length ? 'block' : 'none';
 }

 inputEl.addEventListener('input', renderAndShow);
 inputEl.addEventListener('focus', renderAndShow);

 inputEl.addEventListener('keydown', ev => {
 const itemsEls = Array.from(listEl.querySelectorAll('.dropdown-item'));
 if (!itemsEls.length) return;
 if (ev.key === 'ArrowDown') {
 ev.preventDefault();
 setActiveIndex(Math.min((inputEl._dropIndex || -1) +1, itemsEls.length -1));
 } else if (ev.key === 'ArrowUp') {
 ev.preventDefault();
 setActiveIndex(Math.max((inputEl._dropIndex || -1) -1,0));
 } else if (ev.key === 'Enter') {
 if (typeof inputEl._dropIndex === 'number' && inputEl._dropIndex >=0) {
 ev.preventDefault();
 itemsEls[inputEl._dropIndex].click();
 }
 } else if (ev.key === 'Escape') {
 listEl.style.display = 'none';
 inputEl._dropIndex = -1;
 }
 });

 inputEl.addEventListener('blur', () =>
 setTimeout(() => {
 listEl.style.display = 'none';
 inputEl._dropIndex = -1;
 },200)
 );

 // Optional: refresh ordering if favorites change from another tab
 window.addEventListener('storage', (ev) => {
 if (ev.key !== STORAGE_KEY) return;
 if (document.activeElement === inputEl && listEl.style.display !== 'none') {
 renderAndShow();
 }
 });

 return {
 refresh: renderAndShow
 };
 }

 window.universalDropdown = {
 attach,
 isFavorited,
 toggleFavorite,
 makeCircleSvg: makeCircleSvg_,
 _storageKey: STORAGE_KEY
 };
})();

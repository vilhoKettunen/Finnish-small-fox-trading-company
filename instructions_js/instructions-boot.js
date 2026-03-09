// instructions_js/instructions-boot.js
// Dual-sidebar navigation, IntersectionObserver hash tracking,
// and smooth-scroll for Instructions.html.

(function () {
  'use strict';

    // ?? Slide + section definitions ????????????????????????????????????????
    const SLIDES = [
        { id: 'intro',        title: '0 · Introduction' },
        { id: 'main-store',   title: '1 · Main Store' },
        { id: 'ocm-marketplace',  title: '2 · OCM Marketplace' },
        { id: 'ocm-merchant',     title: '3 · OCM Merchant' },
        { id: 'account-history',  title: '4 · Account History' },
    { id: 'account-settings', title: '5 · Account Settings' },
     { id: 'ew-insurance',     title: '6 · EW Insurance' },
        { id: 'bank',           title: '7 · Bank Dashboard' },
        { id: 'price-history',    title: '8 · Price History' },
   { id: 'leaderboards',     title: '9 · Leaderboards' },
 { id: 'work-pay',       title: '10 · Work Pay Rates' },
        { id: 'economics',        title: '11 · VS Economics' },
    ];

    let activeSlideId = null;
    let activeSectionId = null;
    let suppressHashChange = false;

    // ?? Helpers ????????????????????????????????????????????????????????????
    function smoothScrollTo(el) {
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ?? Build right sidebar (slide TOC) ????????????????????????????????????
    function buildRightPanel() {
        const inner = document.getElementById('instrRightPanelInner');
     if (!inner) return;
        SLIDES.forEach(s => {
            const btn = document.createElement('button');
   btn.type = 'button';
btn.className = 'instr-slide-btn';
        btn.dataset.target = s.id;
            btn.textContent = s.title;
          btn.addEventListener('click', () => {
         suppressHashChange = true;
        const el = document.getElementById(s.id);
        if (el) {
   smoothScrollTo(el);
      history.replaceState(null, '', '#' + s.id);
          }
       setTimeout(() => { suppressHashChange = false; }, 600);
              // Close mobile panel
      document.getElementById('instrRightPanel')
        ?.classList.remove('mobile-open');
        });
            inner.appendChild(btn);
   });
    }

 // ?? Build left sidebar (section TOC for active slide) ??????????????????
    function buildLeftPanel(slideId) {
        const inner = document.getElementById('instrLeftPanelInner');
        if (!inner) return;
        inner.innerHTML = '';

        const slideEl = document.getElementById(slideId);
        if (!slideEl) return;

        const sections = slideEl.querySelectorAll('.instr-section[id]');
        if (!sections.length) return;

        sections.forEach(sec => {
      const title = sec.dataset.sectionTitle || sec.querySelector('h3')?.textContent || sec.id;
            const btn = document.createElement('button');
    btn.type = 'button';
       btn.className = 'instr-section-btn';
    btn.dataset.target = sec.id;
            btn.textContent = '§ ' + title;
            btn.title = title;
            btn.addEventListener('click', () => {
         smoothScrollTo(sec);
          // Close mobile panel
       document.getElementById('instrLeftPanel')
      ?.classList.remove('mobile-open');
            });
            inner.appendChild(btn);
        });
    }

    // ?? Highlight active slide/section buttons ?????????????????????????????
    function setActiveSlideBtn(slideId) {
        document.querySelectorAll('.instr-slide-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.target === slideId);
        });
    }

    function setActiveSectionBtn(sectionId) {
        document.querySelectorAll('.instr-section-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.target === sectionId);
 });
    }

    // ?? IntersectionObserver — slides ??????????????????????????????????????
    function observeSlides() {
   const opts = { rootMargin: '-56px 0px -55% 0px', threshold: 0 };
        const obs = new IntersectionObserver(entries => {
       entries.forEach(entry => {
            if (!entry.isIntersecting) return;
          const newId = entry.target.id;
          if (newId === activeSlideId) return;
     activeSlideId = newId;
      setActiveSlideBtn(newId);
       buildLeftPanel(newId);
      activeSectionId = null;
    if (!suppressHashChange) {
        history.replaceState(null, '', '#' + newId);
        }
         });
        }, opts);

        SLIDES.forEach(s => {
            const el = document.getElementById(s.id);
         if (el) obs.observe(el);
        });
    }

    // ?? IntersectionObserver — sections ????????????????????????????????????
    function observeSections() {
        const opts = { rootMargin: '-60px 0px -60% 0px', threshold: 0 };
        const obs = new IntersectionObserver(entries => {
   entries.forEach(entry => {
      if (!entry.isIntersecting) return;
  const newId = entry.target.id;
if (newId === activeSectionId) return;
     activeSectionId = newId;
    setActiveSectionBtn(newId);
      });
        }, opts);

        document.querySelectorAll('.instr-section[id]').forEach(el => obs.observe(el));
    }

    // ?? Collapse toggles ???????????????????????????????????????????????????
    function wireCollapse(toggleId, panelId) {
        const toggle = document.getElementById(toggleId);
        const panel= document.getElementById(panelId);
        if (!toggle || !panel) return;
      toggle.addEventListener('click', () => {
       const collapsed = panel.classList.toggle('collapsed');
            toggle.textContent = collapsed ? '›' : '‹';
toggle.title = collapsed ? 'Show panel' : 'Hide panel';
        });
    }

    function wireMobileOpen(btnId, panelId) {
        const btn   = document.getElementById(btnId);
        const panel = document.getElementById(panelId);
        if (!btn || !panel) return;
        btn.addEventListener('click', () => {
            panel.classList.toggle('mobile-open');
        });
    }

    // ?? Hash on load — scroll to matching slide ????????????????????????????
    function handleInitialHash() {
    const hash = (location.hash || '').replace('#', '');
        if (!hash) return;
     const el = document.getElementById(hash);
        if (!el) return;
   // Defer so the page has finished rendering
        setTimeout(() => {
            suppressHashChange = true;
          smoothScrollTo(el);
         history.replaceState(null, '', '#' + hash);
     setTimeout(() => { suppressHashChange = false; }, 800);
        }, 120);
 }

    // ?? Boot ???????????????????????????????????????????????????????????????
    window.addEventListener('DOMContentLoaded', () => {
        window.initSharedTopBar && window.initSharedTopBar();
        document.body.classList.add('withTopBar');

        buildRightPanel();
        buildLeftPanel(SLIDES[0].id);   // default: show sections of slide 0

        observeSlides();
        observeSections();

        wireCollapse('instrRightToggle', 'instrRightPanel');
    wireCollapse('instrLeftToggle',  'instrLeftPanel');

  wireMobileOpen('instrRightOpenBtn', 'instrRightPanel');
        wireMobileOpen('instrLeftOpenBtn',  'instrLeftPanel');

     handleInitialHash();
    });
})();

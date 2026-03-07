// index_js/index-section-panel.js
// Self-contained section visibility panel for index.html.
// Exposes: window.IndexSectionPanel = { init, onAdminChange }

window.IndexSectionPanel = (function () {
    'use strict';

    const STORAGE_KEY = 'index:sections:v1';

    // Regular sections — always shown in the panel, visible to all users.
    // "Display Currency" (idxDisplayCurrency) and "Transaction Request"
    // (requestControls) are locked-visible and NOT included here.
    const SECTION_DEFS = [
        { id: 'idxQuickCalc',   label: 'Quick Calculator' },
        { id: 'buySection', label: 'Buy Items' },
{ id: 'sellSection',       label: 'Sell Items' },
        { id: 'idxCombinedTotals', label: 'Combined Totals' },
        { id: 'idxPayWith',        label: 'Pay With' },
        { id: 'idxItemConverter',  label: 'Item Converter' },
     { id: 'usefulLinks',    label: 'Useful Links' },
    ];

    // Admin-only sections — panel buttons hidden until onAdminChange(true).
    const ADMIN_SECTION_DEFS = [
    { id: 'onBehalfSection',   label: 'Submit on Behalf (Admin)' },
        { id: 'infraInvestSection',label: 'Infrastructure Investment (Admin)' },
    ];

    // ?? Storage helpers ??????????????????????????????????????????????????????

    function loadPrefs() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
 return raw ? JSON.parse(raw) : {};
        } catch { return {}; }
    }

    function savePrefs(prefs) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch {}
    }

    // ?? DOM helpers ??????????????????????????????????????????????????????????

    function setSectionVisible(id, visible) {
        const el = document.getElementById(id);
  if (!el) return;
        el.style.display = visible ? '' : 'none';
    }

  // ?? Button builder ???????????????????????????????????????????????????????

    function buildButton(def, visible, prefs) {
        const btn = document.createElement('button');
   btn.type = 'button';
        btn.className = 'idx-toggle-btn idx-section-toggle-btn';
        btn.dataset.section = def.id;
        btn.textContent = def.label;
        btn.classList.toggle('active', visible);

     btn.addEventListener('click', () => {
       const isNowActive = btn.classList.toggle('active');
     setSectionVisible(def.id, isNowActive);
   const updated = loadPrefs();
    updated[def.id] = isNowActive;
 savePrefs(updated);
 });

     return btn;
    }

    // ?? init ?????????????????????????????????????????????????????????????????

    function init() {
    const panel = document.getElementById('idxSectionPanel');
        if (!panel) return;

        const inner = panel.querySelector('.idx-section-panel-inner');
        if (!inner) return;

   const prefs = loadPrefs();

        // ?? Regular section buttons ??????????????????????????????????????????
        SECTION_DEFS.forEach(def => {
     const visible = prefs[def.id] !== false; // default: visible
  const btn = buildButton(def, visible, prefs);
            setSectionVisible(def.id, visible);
            inner.appendChild(btn);
        });

        // ?? Admin section buttons ????????????????????????????????????????????
        // Wrapped in a hidden div; revealed by onAdminChange(true).
  ADMIN_SECTION_DEFS.forEach(def => {
 const wrap = document.createElement('div');
      wrap.className = 'idx-admin-btn-wrap';
            wrap.style.display = 'none';
    wrap.dataset.adminSection = def.id;

            // At init time admin is not confirmed — always hide the section.
  // The pref will be applied in onAdminChange() after login.
       setSectionVisible(def.id, false);

    const btn = buildButton(def, false, prefs);
       wrap.appendChild(btn);
    inner.appendChild(wrap);
   });

        // ?? Collapse handle (desktop) ????????????????????????????????????????
   const toggleBtn = document.getElementById('idxPanelToggle');
        if (toggleBtn) {
          const updateArrow = () => {
    const collapsed = panel.classList.contains('collapsed');
      toggleBtn.textContent = collapsed ? '›' : '‹';
    toggleBtn.title = collapsed ? 'Show section panel' : 'Hide section panel';
     };
     toggleBtn.addEventListener('click', () => {
 panel.classList.toggle('collapsed');
           updateArrow();
            });
       updateArrow();
        }

        // ?? Mobile open button ???????????????????????????????????????????????
        const openBtn = document.getElementById('idxPanelOpenBtn');
  if (openBtn) {
         openBtn.addEventListener('click', () => {
            panel.classList.toggle('mobile-open');
  });

            // Close when clicking outside on mobile
  document.addEventListener('click', (e) => {
       if (panel.classList.contains('mobile-open') &&
      !panel.contains(e.target) &&
           e.target !== openBtn) {
        panel.classList.remove('mobile-open');
         }
   });
        }
    }

    // ?? onAdminChange ????????????????????????????????????????????????????????
    // Called by legacy-auth.js after login confirms admin status.

    function onAdminChange(isAdmin) {
        const panel = document.getElementById('idxSectionPanel');
 if (!panel) return;

const prefs = loadPrefs();
        const wraps = panel.querySelectorAll('.idx-admin-btn-wrap');

wraps.forEach(wrap => {
          const sectionId = wrap.dataset.adminSection;
          const btn = wrap.querySelector('.idx-section-toggle-btn');

            if (isAdmin) {
  // Show the wrapper button in the panel
         wrap.style.display = '';

            // Restore saved pref (default: visible if no pref saved)
       const visible = prefs[sectionId] !== false;

    // legacy-auth.js has already set the section to display:block
              // for admin. We override with the saved pref.
         setSectionVisible(sectionId, visible);

         if (btn) {
           btn.classList.toggle('active', visible);
     }
     } else {
   // Not admin: hide the panel button wrapper
      wrap.style.display = 'none';
           // The sections are hidden by legacy-auth.js already;
                // ensure they remain hidden.
      setSectionVisible(sectionId, false);
                if (btn) btn.classList.remove('active');
  }
        });
    }

    return { init, onAdminChange };
})();

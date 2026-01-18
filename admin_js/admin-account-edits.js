// Admin Account Editing tab
(function () {
    'use strict';

    const Admin = window.Admin;
    const byId = Admin.byId;

    function esc(s) { return Admin.esc(s); }

    // --- UI-only sanitizers (backend is authoritative) ---
    function sanitizePlayerNameUi(raw) {
        let s = String(raw || '').trim();
        s = s.replace(/\s+/g, ' ');
        s = s.replace(/[^A-Za-z0-9 _-]/g, '');
        return s;
    }

    function formatMailboxUi(raw) {
        // Reuse the same UX style as index.html (canonical: "4A /1A / F1")
        let s = String(raw || '').toUpperCase();
        s = s.replace(/[^0-9ABF/ ]/g, '');
        s = s.replace(/\s+/g, '');
        s = s.replace(/\/+ /g, '/');
        s = s.replace(/\/+ /g, '/');
        s = s.replace(/\/+/, '/');

        // Parse loosely into canonical3 parts.
        const segs = s.includes('/') ? s.split('/').filter(Boolean) : [s];
        const flat = segs.join('');
        let i = 0;
        function readDigits() {
            const start = i;
            while (i < flat.length && /[0-9]/.test(flat[i])) i++;
            return flat.slice(start, i);
        }

        const n1 = readDigits();
        const l1 = (i < flat.length && /[AB]/.test(flat[i])) ? flat[i++] : '';
        const n2 = readDigits();
        const l2 = (i < flat.length && /[AB]/.test(flat[i])) ? flat[i++] : '';
        const f = (i < flat.length && flat[i] === 'F') ? flat[i++] : '';
        const fn = readDigits();

        const p1 = (n1 || l1) ? (n1 + l1) : '';
        const p2 = (n2 || l2) ? (n2 + l2) : '';
        const p3 = (f || fn) ? ((f || 'F') + fn) : '';

        const out = [];
        if (p1) out.push(p1);
        if (p2) out.push(p2);
        if (p3) out.push(p3);
        return out.join(' / ');
    }

    function formatMallMailboxUi(raw) {
        // Canonical: "M1A / M1A / F1"
        // Allow partial typing without "reset":
        // - M<digits><A|B> / M<digits><A|B> / F<digits>
        // - Spaces optional while typing
        let s = String(raw || '').toUpperCase();

        // allow only relevant chars while typing
        s = s.replace(/[^0-9ABFM/\/ ]/g, '');

        // normalize whitespace but keep ability to type
        s = s.replace(/\s+/g, ' ').trim();

        // Remove any duplicate slashes clutter, but keep single separators
        s = s.replace(/\/{2,}/g, '/');

        // Work on a "flat" stream without spaces, but keep slash boundaries.
        const stream = s.replace(/\s+/g, '');

        // Parse sequentially: M-part, M-part, F-part.
        // Each M-part: optional leading M, digits*, optional A|B.
        // F-part: optional leading F, digits*.
        let i = 0;

        function readChar(pred) {
            if (i >= stream.length) return '';
            const ch = stream[i];
            if (pred(ch)) { i++; return ch; }
            return '';
        }

        function readWhile(pred) {
            const start = i;
            while (i < stream.length && pred(stream[i])) i++;
            return stream.slice(start, i);
        }

        function skipOptionalSlash() {
            if (stream[i] === '/') i++;
        }

        function parseMPart() {
            // Skip any leading slash (user may type "/")
            if (stream[i] === '/') i++;

            // Optional 'M'
            readChar(c => c === 'M');

            // digits then optional A/B
            const digits = readWhile(c => /[0-9]/.test(c));
            const letter = readChar(c => c === 'A' || c === 'B');

            // Allow user to type slash next
            skipOptionalSlash();

            return { digits, letter };
        }

        function parseFPart() {
            if (stream[i] === '/') i++;

            // Optional 'F'
            readChar(c => c === 'F');

            const digits = readWhile(c => /[0-9]/.test(c));

            // ignore trailing slash if user typed it
            skipOptionalSlash();

            return { digits };
        }

        const p1 = parseMPart();
        const p2 = parseMPart();
        const p3 = parseFPart();

        const out = [];

        // Only output a segment if user has begun typing it
        const seg1 = (p1.digits || p1.letter) ? `M${p1.digits}${p1.letter}` : '';
        const seg2 = (p2.digits || p2.letter) ? `M${p2.digits}${p2.letter}` : '';
        const seg3 = (p3.digits) ? `F${p3.digits}` : '';

        if (seg1) out.push(seg1);
        if (seg2) out.push(seg2);
        if (seg3) out.push(seg3);

        return out.join(' / ');
    }

    function attachAccountEditInputHelpers_() {
        const pn = byId('adminEditPlayerName');
        const mb = byId('adminEditMailbox');
        const mall = byId('adminEditMallMailbox');

        if (pn) {
            pn.addEventListener('input', () => {
                const next = sanitizePlayerNameUi(pn.value);
                if (pn.value !== next) pn.value = next;
            });
        }
        if (mb) {
            mb.setAttribute('autocomplete', 'off');
            mb.setAttribute('placeholder', '4A /1A / F1');
            mb.addEventListener('input', () => {
                const next = formatMailboxUi(mb.value);
                if (mb.value !== next) mb.value = next;
            });
            mb.addEventListener('blur', () => { mb.value = formatMailboxUi(mb.value); });
        }
        if (mall) {
            mall.setAttribute('autocomplete', 'off');
            mall.setAttribute('placeholder', 'M1A / M1A / F1');
            mall.addEventListener('input', () => {
                const next = formatMallMailboxUi(mall.value);
                if (mall.value !== next) mall.value = next;
            });
            mall.addEventListener('blur', () => { mall.value = formatMallMailboxUi(mall.value); });
        }
    }

    function setAccountEditUiEnabled_(enabled) {
        ['adminEditPlayerName', 'adminEditMailbox', 'adminEditMallMailbox', 'btnSaveAccountEdit'].forEach(id => {
            const el = byId(id);
            if (el) el.disabled = !enabled;
        });
        const banner = byId('adminAccountEditNoTarget');
        if (banner) banner.style.display = enabled ? 'none' : 'block';
    }

    function setMsg_(txt, isErr) {
        const msg = byId('adminAccountEditMsg');
        if (!msg) return;
        msg.textContent = txt || '';
        msg.style.color = isErr ? '#c00' : '';
    }

    async function loadTargetIntoAccountEdit_() {
        if (!Admin.state.googleIdToken) return;
        setMsg_('', false);

        if (!Admin.state.globalTargetUser) {
            setAccountEditUiEnabled_(false);
            return;
        }

        setAccountEditUiEnabled_(true);
        setMsg_('Loading...', false);

        try {
            const r = await window.apiGet('adminGetUserProfile', {
                idToken: Admin.state.googleIdToken,
                userId: Admin.state.globalTargetUser.userId
            });
            const d = r.data || r.result || r;
            const u = d.user || d;

            byId('adminEditPlayerName').value = sanitizePlayerNameUi(u.playerName || '');
            byId('adminEditMailbox').value = formatMailboxUi(u.mailbox || '');
            byId('adminEditMallMailbox').value = formatMallMailboxUi(u.mallMailbox || u.Mall_mailbox || '');

            byId('adminAccountEditUserLabel').textContent = esc(u.playerName || u.email || u.userId || '');

            setMsg_('Loaded.', false);
        } catch (e) {
            setMsg_('Error: ' + (e.message || e), true);
        }
    }

    window.refreshAdminAccountEditTargetUI_ = loadTargetIntoAccountEdit_;

    window.adminSaveAccountEdit = async function adminSaveAccountEdit() {
        if (!Admin.state.googleIdToken) return;
        if (!Admin.state.globalTargetUser) { setMsg_('Select a target user first.', true); return; }

        const pnEl = byId('adminEditPlayerName');
        const mbEl = byId('adminEditMailbox');
        const mallEl = byId('adminEditMallMailbox');

        pnEl.value = sanitizePlayerNameUi(pnEl.value);
        mbEl.value = formatMailboxUi(mbEl.value);
        mallEl.value = formatMallMailboxUi(mallEl.value);

        const playerName = pnEl.value.trim();
        const mailbox = mbEl.value.trim();
        const mallMailbox = mallEl.value.trim();

        if (!playerName) { setMsg_('Player name required', true); return; }
        if (!mailbox) { setMsg_('Mailbox required', true); return; }

        setMsg_('Saving...', false);

        try {
            const r = await window.apiPost('adminUpdateUserProfile', {
                idToken: Admin.state.googleIdToken,
                userId: Admin.state.globalTargetUser.userId,
                payload: { playerName, mailbox, mallMailbox }
            });
            const d = r.data || r.result || r;
            const u = d.user || d;

            // Update cached player list entry so other UI uses updated mailbox quickly.
            const idx = Admin.state.playersCache.findIndex(p => String(p.userId) === String(u.userId));
            if (idx >= 0) {
                Admin.state.playersCache[idx].playerName = u.playerName;
                Admin.state.playersCache[idx].mailbox = u.mailbox;
                Admin.state.playersCache[idx].mallMailbox = u.mallMailbox;
            }
            Admin.state.globalTargetUser.playerName = u.playerName;
            Admin.state.globalTargetUser.mailbox = u.mailbox;
            Admin.state.globalTargetUser.mallMailbox = u.mallMailbox;

            // Refresh dependent UI banners
            window.updateOcmActingUI && window.updateOcmActingUI();
            // reflect new label in target user UI
            const sel = byId('globalUserSelected');
            if (sel) sel.textContent = `Selected: ${u.playerName || u.email || u.userId}`;

            setMsg_('Saved.', false);
        } catch (e) {
            setMsg_('Error: ' + (e.message || e), true);
        }
    };

    Admin.initAccountEditUI = function initAccountEditUI() {
        attachAccountEditInputHelpers_();
        setAccountEditUiEnabled_(false);
    };
})();

// Recaptcha v2 wrapper used by legacy-requests.js (adapted for explicit v2 checkbox)
(function () {
    'use strict';

    const SITE_KEY_ = () => window.RECAPTCHA_SITE_KEY;

    function _isReady_() {
        return !!(window.grecaptcha && typeof window.grecaptcha.render === 'function');
    }

    // Helper: wait up to `timeoutMs` for grecaptcha to appear
    function _waitForGreCaptcha(timeoutMs = 5000) {
        return new Promise((resolve) => {
            const start = Date.now();
            function check() {
                if (window.grecaptcha && typeof window.grecaptcha.render === 'function') return resolve(true);
                if (Date.now() - start >= timeoutMs) return resolve(false);
                setTimeout(check, 150);
            }
            check();
        });
    }

    // Called by the grecaptcha script when loaded (index.html loads the script with onload=vakRecaptchaOnload&render=explicit)
    window.vakRecaptchaOnload = window.vakRecaptchaOnload || function vakRecaptchaOnload() {
        window.__vakRecaptchaLoaded = true;
        try { window.initRecaptcha && window.initRecaptcha(); } catch (e) { /* ignore */ }
    };

    window.initRecaptcha = window.initRecaptcha || function initRecaptcha() {
        const key = SITE_KEY_();
        if (!key) {
            console.warn('[recaptcha] RECAPTCHA_SITE_KEY missing; recaptchaWrap() will return null.');
            return;
        }
        if (!_isReady_()) {
            console.warn('[recaptcha] grecaptcha not ready yet (script loads async).');
            return;
        }

        // If a widget container exists and widget not yet rendered, render it explicitly.
        try {
            const el = document.getElementById('recaptchaWidget');
            if (el && typeof window.__vakRecaptchaWidgetId === 'undefined') {
                window.__vakRecaptchaWidgetId = window.grecaptcha.render('recaptchaWidget', {
                    'sitekey': key,
                    'theme': 'light',
                    'callback': function (token) {
                        window.lastRecaptchaToken = token || null;
                        // Enable verify button only when custom consent checkbox (if present) is checked
                        const btn = document.getElementById('btnVerifyRecaptcha');
                        const cb = document.getElementById('recaptchaConsent');
                        if (btn) {
                            if (!cb || (cb && cb.checked)) btn.disabled = !(window.lastRecaptchaToken);
                        }
                    },
                    'expired-callback': function () {
                        window.lastRecaptchaToken = null;
                        const btn = document.getElementById('btnVerifyRecaptcha');
                        if (btn) btn.disabled = true;
                    }
                });
            }
        } catch (e) {
            console.warn('[recaptcha] render failed', e);
        }
    };

    window.recaptchaWrap = window.recaptchaWrap || function recaptchaWrap(action) {
        const key = SITE_KEY_();

        // If the user already passed captcha via backend flag, treat as no-token-needed.
        if (window.currentUser?.captchaPassed) return Promise.resolve(null);

        if (!key) return Promise.resolve(null);

        return new Promise(async (resolve) => {
            const available = await _waitForGreCaptcha(5000);
            if (!available) {
                console.warn('[recaptcha] grecaptcha not available after waiting; continuing without token.');
                resolve(null);
                return;
            }

            // Ensure widget is rendered if the container exists
            if (typeof window.__vakRecaptchaWidgetId === 'undefined' && document.getElementById('recaptchaWidget')) {
                try {
                    window.__vakRecaptchaWidgetId = window.grecaptcha.render('recaptchaWidget', {
                        'sitekey': key,
                        'theme': 'light',
                        'callback': function (token) { window.lastRecaptchaToken = token || null; },
                        'expired-callback': function () { window.lastRecaptchaToken = null; }
                    });
                } catch (e) {
                    console.warn('[recaptcha] render failed', e);
                }
            }

            const wid = window.__vakRecaptchaWidgetId;
            let token = null;
            try {
                if (typeof wid !== 'undefined' && typeof window.grecaptcha.getResponse === 'function') {
                    token = window.grecaptcha.getResponse(wid) || null;
                } else {
                    token = window.lastRecaptchaToken || null;
                }
            } catch (e) {
                token = window.lastRecaptchaToken || null;
            }

            resolve(token || null);
        });
    };
})();
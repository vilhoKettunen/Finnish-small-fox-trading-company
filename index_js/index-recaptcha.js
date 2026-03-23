// Recaptcha v3 wrapper used by legacy-requests.js
(function () {
    'use strict';

    const SITE_KEY_ = () => window.RECAPTCHA_SITE_KEY;

    function _isReady_() {
        return !!(window.grecaptcha && typeof window.grecaptcha.ready === 'function');
    }

    function _canExecute_() {
        return !!(window.grecaptcha && typeof window.grecaptcha.execute === 'function');
    }

    window.initRecaptcha = window.initRecaptcha || function initRecaptcha() {
        // Nothing to render for v3. We just validate presence and log for debugging.
        const key = SITE_KEY_();
        if (!key) {
            console.warn('[recaptcha] RECAPTCHA_SITE_KEY missing; recaptchaWrap() will return null.');
            return;
        }
        if (!_isReady_()) {
            // Script loads async/defer, so this can be normal at boot.
            console.warn('[recaptcha] grecaptcha not ready yet (script loads async).');
            return;
        }
    };

    // Helper: wait up to `timeoutMs` for grecaptcha to appear
    function _waitForGreCaptcha(timeoutMs = 5000) {
        return new Promise((resolve) => {
            const start = Date.now();
            function check() {
                if (window.grecaptcha && typeof window.grecaptcha.ready === 'function') return resolve(true);
                if (Date.now() - start >= timeoutMs) return resolve(false);
                setTimeout(check, 150);
            }
            check();
        });
    }

    window.recaptchaWrap = window.recaptchaWrap || function recaptchaWrap(action) {
        const key = SITE_KEY_();
        const act = String(action || 'createRequest');

        // If the user already passed captcha via backend flag, treat as no-token-needed.
        if (window.currentUser?.captchaPassed) return Promise.resolve(null);

        if (!key) return Promise.resolve(null);

        return new Promise(async (resolve, reject) => {
            // Wait briefly for grecaptcha to load (script is async/defer)
            const available = await _waitForGreCaptcha(5000);
            if (!available) {
                console.warn('[recaptcha] grecaptcha not available after waiting; continuing without token.');
                resolve(null);
                return;
            }

            window.grecaptcha.ready(() => {
                if (!_canExecute_()) {
                    console.warn('[recaptcha] grecaptcha.execute not available; continuing without token.');
                    resolve(null);
                    return;
                }

                window.grecaptcha.execute(key, { action: act })
                    .then(token => {
                        window.lastRecaptchaToken = token || null;
                        resolve(token || null);
                    })
                    .catch(err => {
                        // If captcha fails, surface error (backend likely requires it).
                        reject(err);
                    });
            });
        });
    };
})();
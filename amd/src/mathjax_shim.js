// This file is part of Moodle - https://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <https://www.gnu.org/licenses/>.

/**
 * MathJax v2 Hub compatibility shim for MathJax v3.
 *
 * MathQuill and STACK (qtype_stack) expect MathJax.Hub (v2 API).
 * Moodle 4.3+ ships MathJax v3 which removed the Hub API.
 * This module installs a MathJax.Hub façade that delegates to MathJax v3,
 * and also stubs MathJax.Callback and MathJax.Ajax which STACK references
 * during its input-validation initialisation.
 *
 * Loading order
 * -------------
 * This module is loaded as early as possible via
 * local_stackmatheditor\hook_callbacks::before_top_of_body() so that
 * window.MathJax.Hub is available before STACK's own AMD modules run.
 * Because AMD loading is asynchronous, the module also polls (500 × 20 ms)
 * so it can self-install even if MathJax v3 loads after the first attempt.
 *
 * The _sme marker on the Hub object allows local_stackmatheditor/mathjax_compat
 * to recognise and upgrade this stub once MathJax v3 is confirmed present.
 *
 * @module     local_stackmatheditor/mathjax_shim
 * @package
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
define([], function() {
    'use strict';

    var noop = function() {};

    /**
     * Typeset a DOM element using the MathJax v3 API.
     * Called lazily so it works even when MathJax v3 loads after this module.
     *
     * @param {HTMLElement|null} el Element to typeset, or null for whole page.
     */
    function typesetV3(el) {
        if (window.MathJax && window.MathJax.typesetPromise) {
            try {
                window.MathJax.typesetPromise(el ? [el] : []).catch(noop);
            } catch (e) { /* ignore */ }
        } else if (window.MathJax && window.MathJax.typeset) {
            try {
                window.MathJax.typeset(el ? [el] : []);
            } catch (e) { /* ignore */ }
        }
    }

    /**
     * Process a MathJax v2 Hub.Queue-style argument list.
     * Accepts functions, ["Typeset", hub, el] arrays, and [fn, ctx, ...args] arrays.
     */
    function processQueue() {
        var i, item;
        for (i = 0; i < arguments.length; i++) {
            item = arguments[i];
            if (typeof item === 'function') {
                try { item(); } catch (e) { /* ignore */ }
            } else if (Array.isArray(item)) {
                if (item[0] === 'Typeset') {
                    typesetV3(item.length > 2 ? item[2] : null);
                } else if (typeof item[0] === 'function') {
                    try {
                        item[0].apply(item[1] || null, item.slice(2));
                    } catch (e) { /* ignore */ }
                }
            }
        }
    }

    /**
     * Build the Hub shim object.
     * The _sme marker lets mathjax_compat detect and upgrade this stub.
     *
     * @returns {Object} Hub façade.
     */
    function createHub() {
        return {
            _sme: 1,
            Queue: processQueue,
            Typeset: function(el, cb) {
                typesetV3(el);
                if (typeof cb === 'function') {
                    setTimeout(cb, 10);
                }
            },
            Config: noop,
            Configured: noop,
            Register: {
                StartupHook: function(h, cb) {
                    if (typeof cb === 'function') {
                        try { cb(); } catch (e) { /* ignore */ }
                    }
                },
                MessageHook: noop,
                LoadHook: noop
            },
            processSectionDelay: 0,
            processUpdateDelay: 0,
            processUpdateTime: 250,
            config: {
                showProcessingMessages: false,
                messageStyle: 'none',
                'HTML-CSS': {},
                SVG: {},
                NativeMML: {},
                TeX: {}
            },
            signal: {Interest: noop},
            getAllJax: function() { return []; },
            getJaxFor: function() { return null; },
            Reprocess: noop,
            Rerender: noop,
            setRenderer: noop,
            Insert: function(dst, src) {
                if (dst && src) {
                    for (var k in src) {
                        if (src.hasOwnProperty(k)) {
                            dst[k] = src[k];
                        }
                    }
                }
                return dst;
            }
        };
    }

    /**
     * Try to install the Hub shim.
     *
     * Skips if:
     *   - window.MathJax is not yet present (returns false → caller will retry)
     *   - window.MathJax.Hub exists and does NOT carry the _sme marker,
     *     meaning a real v2 Hub or the full mathjax_compat shim is already there
     *
     * @returns {boolean} True when installation was performed or not needed.
     */
    function ensureHub() {
        if (!window.MathJax || typeof window.MathJax !== 'object') {
            return false;
        }
        // Real Hub (v2 native) or full mathjax_compat shim already present.
        if (window.MathJax.Hub && !window.MathJax.Hub._sme) {
            return true;
        }
        // MathJax present but neither v2 Hub nor v3 typesetPromise — do nothing.
        if (!window.MathJax.typesetPromise && !window.MathJax.typeset) {
            return true;
        }

        window.MathJax.Hub = createHub();

        if (!window.MathJax.Callback) {
            window.MathJax.Callback = {
                Queue: function() {
                    var q = {
                        Push: function() {
                            var j;
                            for (j = 0; j < arguments.length; j++) {
                                if (typeof arguments[j] === 'function') {
                                    try { arguments[j](); } catch (e) { /* ignore */ }
                                }
                            }
                        }
                    };
                    q.Push.apply(q, arguments);
                    return q;
                },
                Signal: function() {
                    return {Interest: noop, Post: noop};
                }
            };
        }

        if (!window.MathJax.Ajax) {
            window.MathJax.Ajax = {
                Require: function(f, cb) {
                    if (typeof cb === 'function') { cb(); }
                },
                config: {root: ''},
                STATUS: {OK: 1},
                loaded: {}
            };
        }

        return true;
    }

    /**
     * Install the Hub shim and start the polling loop.
     *
     * The polling loop (500 iterations × 20 ms = up to 10 s) handles the case
     * where MathJax v3 is loaded asynchronously by filter_mathjaxloader after
     * this AMD module has already been evaluated.  Each tick re-runs ensureHub()
     * so the shim is installed as soon as MathJax appears.
     *
     * Safe to call multiple times.
     */
    function install() {
        ensureHub();
        var count = 0;
        var maxCount = 500;
        var interval = setInterval(function() {
            if (ensureHub()) {
                count++;
            }
            count++;
            if (count >= maxCount) {
                clearInterval(interval);
            }
        }, 20);
    }

    return /** @alias module:local_stackmatheditor/mathjax_shim */ {
        /**
         * Install the MathJax Hub compatibility shim.
         * Polls until MathJax v3 is available if it has not loaded yet.
         * Safe to call multiple times.
         */
        install: install
    };
});

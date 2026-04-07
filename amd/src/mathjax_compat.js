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
 * MathJax v2 compatibility shim for MathJax v3.
 *
 * STACK (qtype_stack) expects MathJax v2 API (MathJax.Hub.Queue, etc.).
 * Moodle 4.3+ ships MathJax v3 which removed the Hub API.
 * This shim provides a minimal MathJax.Hub wrapper around MathJax v3.
 *
 * @module     local_stackmatheditor/mathjax_compat
 * @package
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
define([], function() {
    'use strict';

    /**
     * Write a developer-level debug message to the browser console.
     *
     * Only active when Moodle developer debug mode is enabled
     * (M.cfg.developerdebug is truthy). Silent on production sites.
     *
     * @param {...*} varArgs Values to log.
     */
    function log(varArgs) { // eslint-disable-line no-unused-vars
        if (window.M && window.M.cfg && window.M.cfg.developerdebug
                && window.console && window.console.log) {
            var args = ['[SME-MathJax-Compat]'].concat(Array.prototype.slice.call(arguments));
            window.console.log.apply(window.console, args);
        }
    }

    /**
     * Typeset a DOM element using MathJax v3 API.
     *
     * @param {HTMLElement|null} element The element to typeset, or null for whole page.
     * @returns {Promise} Resolves when typesetting is complete.
     */
    function typesetElement(element) {
        if (window.MathJax && window.MathJax.typesetPromise) {
            var elements = element ? [element] : [];
            return window.MathJax.typesetPromise(elements).catch(function(err) {
                log('Typeset error (non-fatal):', err.message);
            });
        }
        return Promise.resolve();
    }

    /**
     * Try to install the Hub shim for a MathJax object that is already loaded.
     * Returns true if the shim was installed (or Hub already existed), false
     * if MathJax was not yet available.
     *
     * @returns {boolean} Whether installation was attempted.
     */
    function tryInstall() {
        if (!window.MathJax) {
            return false;
        }

        if (window.MathJax.Hub && !window.MathJax.Hub._sme) {
            log('MathJax.Hub already exists (v2 native or full shim).');
            return true;
        }

        // Confirm this is MathJax v3.
        if (!window.MathJax.typesetPromise && !window.MathJax.typeset) {
            log('MathJax present but neither v2 Hub nor v3 typeset found. Skipping.');
            return true;
        }

        log('Installing MathJax.Hub compatibility shim (v3 -> v2 API).');

        window.MathJax.Hub = {
            /**
             * Minimal Queue implementation.
             * Accepts MathJax v2 Queue-style arguments:
             *   MathJax.Hub.Queue(["Typeset", MathJax.Hub, element])
             *   MathJax.Hub.Queue(callback)
             */
            Queue: function() {
                var i;
                for (i = 0; i < arguments.length; i++) {
                    var item = arguments[i];

                    if (typeof item === 'function') {
                        // Direct callback.
                        try {
                            item();
                        } catch (e) {
                            log('Queue callback error:', e.message);
                        }
                    } else if (Array.isArray(item)) {
                        // Array format: ["methodName", context, ...args]
                        var method = item[0];
                        if (method === 'Typeset') {
                            // ["Typeset", MathJax.Hub, element]
                            var element = item.length > 2 ? item[2] : null;
                            typesetElement(element);
                        } else if (typeof method === 'function') {
                            try {
                                method.apply(item[1] || null, item.slice(2));
                            } catch (e) {
                                log('Queue array-callback error:', e.message);
                            }
                        }
                    }
                }
            },

            /**
             * Shim for MathJax.Hub.Typeset.
             *
             * @param {HTMLElement|null} element Element to typeset.
             * @param {Function|null} callback Callback after typesetting.
             */
            Typeset: function(element, callback) {
                typesetElement(element).then(function() {
                    if (typeof callback === 'function') {
                        callback();
                    }
                });
            },

            /**
             * Shim for MathJax.Hub.Config – no-op for v3.
             */
            Config: function() {
                log('MathJax.Hub.Config called (no-op in v3 shim).');
            },

            /**
             * Shim for MathJax.Hub.Register.
             */
            Register: {
                /**
                 * Shim for StartupHook.
                 *
                 * @param {string} hook Hook name.
                 * @param {Function} callback Callback function.
                 */
                StartupHook: function(hook, callback) {
                    log('StartupHook shim for:', hook);
                    // In v3, startup is already complete. Call immediately.
                    if (typeof callback === 'function') {
                        try {
                            callback();
                        } catch (e) {
                            log('StartupHook callback error:', e.message);
                        }
                    }
                },
                /**
                 * Shim for MessageHook – no-op.
                 */
                MessageHook: function() {
                    // No-op.
                }
            },

            /**
             * Shim for MathJax.Hub.processSectionDelay.
             *
             * @type {number}
             */
            processSectionDelay: 0,

            /**
             * Shim for MathJax.Hub.config.
             */
            config: {
                showProcessingMessages: false,
                messageStyle: 'none'
            },

            /**
             * Shim for MathJax.Hub.signal.
             */
            signal: {
                /**
                 * No-op Interest method.
                 */
                Interest: function() {
                    // No-op.
                }
            },

            /**
             * Shim for MathJax.Hub.getAllJax.
             *
             * @returns {Array} Empty array.
             */
            getAllJax: function() {
                return [];
            }
        };

        // Also shim MathJax.Callback if missing (used by some STACK code).
        if (!window.MathJax.Callback) {
            window.MathJax.Callback = {
                /**
                 * Queue shim.
                 *
                 * @returns {Object} Minimal queue object.
                 */
                Queue: function() {
                    return {
                        /**
                         * Push callbacks to queue.
                         */
                        Push: function() {
                            var i;
                            for (i = 0; i < arguments.length; i++) {
                                if (typeof arguments[i] === 'function') {
                                    try {
                                        arguments[i]();
                                    } catch (e) {
                                        log('Callback.Queue.Push error:', e.message);
                                    }
                                }
                            }
                        }
                    };
                }
            };
        }

        log('MathJax.Hub shim installed successfully.');
        return true;
    }

    /**
     * Install the MathJax compatibility shim.
     *
     * If MathJax has not yet loaded when this is called (e.g. because
     * Moodle's filter_mathjaxloader loads it asynchronously after AMD init),
     * a lightweight polling loop retries every 50 ms for up to 10 seconds
     * until MathJax is available.  Safe to call multiple times.
     */
    function install() {
        if (tryInstall()) {
            return; // Done immediately.
        }

        log('MathJax not loaded yet — starting poll (50 ms × 200).');

        var attempts = 0;
        var maxAttempts = 200; // 200 × 50 ms = 10 s maximum wait.
        var timer = setInterval(function() {
            attempts++;
            if (tryInstall()) {
                clearInterval(timer);
                return;
            }
            if (attempts >= maxAttempts) {
                clearInterval(timer);
                log('Gave up waiting for MathJax after ' + attempts + ' attempts.');
            }
        }, 50);
    }

    return /** @alias module:local_stackmatheditor/mathjax_compat */ {

        /**
         * Install the MathJax compatibility shim.
         * Polls until MathJax is available if it has not yet loaded.
         * Safe to call multiple times.
         */
        install: install,

        /**
         * Alias for install() used by mathquill_init.js.
         *
         * @see install
         */
        init: install
    };
});

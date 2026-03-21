/**
 * MathJax v2 compatibility shim for MathJax v3.
 *
 * STACK (qtype_stack) expects MathJax v2 API (MathJax.Hub.Queue, etc.).
 * Moodle 4.3+ ships MathJax v3 which removed the Hub API.
 * This shim provides a minimal MathJax.Hub wrapper around MathJax v3.
 *
 * @module     local_stackmatheditor/mathjax_compat
 * @copyright  2026 Your Name
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
define([], function() {
    'use strict';

    /**
     * Log a debug message.
     *
     * @param {...*} varArgs Values to log.
     */
    function log(varArgs) { // eslint-disable-line no-unused-vars
        if (window.console && window.console.log) {
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
     * Installs a MathJax.Hub compatibility shim if MathJax v3 is present
     * but MathJax.Hub is not.
     */
    function install() {
        // Nothing to do if MathJax isn't loaded yet or Hub already exists.
        if (!window.MathJax) {
            log('MathJax not loaded yet, deferring shim installation.');
            return;
        }

        if (window.MathJax.Hub) {
            log('MathJax.Hub already exists (v2 or shim already installed).');
            return;
        }

        // Confirm this is MathJax v3.
        if (!window.MathJax.typesetPromise && !window.MathJax.typeset) {
            log('MathJax present but neither v2 Hub nor v3 typeset found. Skipping.');
            return;
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
    }

    return /** @alias module:local_stackmatheditor/mathjax_compat */ {

        /**
         * Install the MathJax compatibility shim.
         * Safe to call multiple times.
         */
        install: install
    };
});

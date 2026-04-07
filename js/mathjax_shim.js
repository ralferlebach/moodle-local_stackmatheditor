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
 * MathJax v2 Hub compatibility shim.
 *
 * MathQuill expects MathJax.Hub (v2 API). Moodle 4.x ships MathJax v3.
 * This shim bridges the gap by creating a MathJax.Hub facade that
 * delegates to MathJax v3 methods.
 *
 * Must be loaded BEFORE MathQuill — cannot be an AMD module.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Ralf Erlebach
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
(function() {
    "use strict";
    var noop = function() {};

    function createHubShim() {
        function typesetV3(el) {
            if (window.MathJax && window.MathJax.typesetPromise) {
                try {
                    window.MathJax.typesetPromise(
                        el ? [el] : []
                    ).catch(noop);
                } catch (e) { /* ignore */ }
            } else if (window.MathJax && window.MathJax.typeset) {
                try {
                    window.MathJax.typeset(el ? [el] : []);
                } catch (e) { /* ignore */ }
            }
        }

        function processQueue() {
            var i, item;
            for (i = 0; i < arguments.length; i++) {
                item = arguments[i];
                if (typeof item === "function") {
                    try { item(); } catch (e) { /* ignore */ }
                } else if (Array.isArray(item)) {
                    if (item[0] === "Typeset") {
                        typesetV3(item.length > 2 ? item[2] : null);
                    } else if (typeof item[0] === "function") {
                        try {
                            item[0].apply(
                                item[1] || null, item.slice(2)
                            );
                        } catch (e) { /* ignore */ }
                    }
                }
            }
        }

        return {
            Queue: processQueue,
            Typeset: function(el, cb) {
                typesetV3(el);
                if (typeof cb === "function") {
                    setTimeout(cb, 10);
                }
            },
            Config: noop,
            Configured: noop,
            Register: {
                StartupHook: function(h, cb) {
                    if (typeof cb === "function") {
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
                messageStyle: "none",
                "HTML-CSS": {},
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

    function ensureHub() {
        if (!window.MathJax || typeof window.MathJax !== "object") {
            return false;
        }
        if (window.MathJax.Hub) {
            return true;
        }
        window.MathJax.Hub = createHubShim();
        if (!window.MathJax.Callback) {
            window.MathJax.Callback = {
                Queue: function() {
                    var q = {
                        Push: function() {
                            var j;
                            for (j = 0; j < arguments.length; j++) {
                                if (typeof arguments[j] === "function") {
                                    try { arguments[j](); }
                                    catch (e) { /* ignore */ }
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
                    if (typeof cb === "function") { cb(); }
                },
                config: {root: ""},
                STATUS: {OK: 1},
                loaded: {}
            };
        }
        return true;
    }

    ensureHub();
    var count = 0, maxCount = 500;
    var interval = setInterval(function() {
        ensureHub();
        count++;
        if (count >= maxCount) {
            clearInterval(interval);
        }
    }, 20);
})();

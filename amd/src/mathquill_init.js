/**
 * Main initialization for STACK MathEditor.
 *
 * Loads MathQuill, reads config/definitions, delegates to
 * input_fields.js and textarea_fields.js.
 *
 * @module     local_stackmatheditor/mathquill_init
 * @copyright  2026 Ralf Erlebach
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
define([
    'jquery',
    'local_stackmatheditor/mathjax_compat'
], function($, mjCompat) {
    'use strict';

    var DEBUG = true;

    /**
     * Debug log.
     *
     * @param {string} msg Message.
     */
    function dbg(msg) {
        if (DEBUG) {
            window.console.log('[SME] ' + msg);
        }
    }

    /**
     * Read JSON from a script element in the DOM.
     * Handles both direct and double-encoded JSON.
     *
     * @param {string} id Element ID.
     * @returns {Object|null} Parsed data.
     */
    function readJson(id) {
        var el = document.getElementById(id);
        if (!el) {
            dbg('readJson: #' + id + ' not found');
            return null;
        }
        try {
            var raw = el.textContent;
            // Handle double-encoded JSON
            // (from js_amd_inline wrapping).
            if (typeof raw === 'string'
                && raw.charAt(0) === '"') {
                raw = JSON.parse(raw);
            }
            return JSON.parse(raw);
        } catch (e) {
            dbg('readJson: parse error for #' + id
                + ': ' + e.message);
            return null;
        }
    }

    /**
     * Extract slot number from field name.
     * Format: q{usageid}:{slot}_ans{num}
     *
     * @param {string} name Name attribute.
     * @returns {number} Slot number or 0.
     */
    function extractSlot(name) {
        var m = (name || '').match(/:(\d+)_/);
        return m ? parseInt(m[1], 10) : 0;
    }

    /**
     * Read size hints from a field element.
     *
     * @param {jQuery} $el Input or textarea.
     * @returns {Object} {width, minHeight} CSS values.
     */
    function readSize($el) {
        var result = {width: null, minHeight: null};

        var sw = $el[0].style.width;
        if (sw) {
            result.width = sw;
        }

        var size = parseFloat($el.attr('size'));
        if (size && !result.width) {
            result.width = (size * 0.82) + 'em';
        }

        var cols = parseInt($el.attr('cols'), 10);
        if (cols && !result.width) {
            result.width = (cols * 0.82) + 'em';
        }

        var rows = parseInt($el.attr('rows'), 10);
        if (rows) {
            result.minHeight = (rows * 35) + 'px';
        }

        return result;
    }

    /**
     * Detect comma decimal from field element.
     *
     * @param {jQuery} $el Field element.
     * @param {boolean} localeFallback Locale default.
     * @returns {boolean} True if comma decimal.
     */
    function isCommaDecimal($el, localeFallback) {
        var sep = $el.attr(
            'data-stack-input-decimal-separator');
        if (sep === ',') {
            return true;
        }
        if (sep === '.') {
            return false;
        }
        return localeFallback;
    }

    /**
     * Load CSS if not already loaded.
     *
     * @param {string} url CSS URL.
     */
    function loadCss(url) {
        if ($('link[href="' + url + '"]').length) {
            return;
        }
        var l = document.createElement('link');
        l.rel = 'stylesheet';
        l.href = url;
        document.head.appendChild(l);
        dbg('CSS loaded.');
    }

    /**
     * Load a script dynamically.
     * Sets window.jQuery before load (MathQuill needs it).
     *
     * @param {string} url Script URL.
     * @returns {jQuery.Promise} Resolves on load.
     */
    function loadScript(url) {
        // MathQuill requires window.jQuery at parse time.
        if (typeof window.jQuery === 'undefined') {
            window.jQuery = $;
        }
        if (typeof window.$ === 'undefined') {
            window.$ = $;
        }

        return $.Deferred(function(d) {
            var s = document.createElement('script');
            s.src = url;
            s.onload = function() {
                d.resolve();
            };
            s.onerror = function() {
                d.reject(
                    new Error('Script load failed: ' + url)
                );
            };
            document.head.appendChild(s);
        }).promise();
    }

    /**
     * Initialize MathJax compatibility.
     * Handles both old (side-effect) and new (init method)
     * versions of mathjax_compat.
     */
    function initMjCompat() {
        if (mjCompat && typeof mjCompat.init === 'function') {
            mjCompat.init();
        }
        // If mjCompat doesn't have init(), it ran as
        // side-effect on import — nothing else needed.
    }

    /**
     * Boot the editor after MathQuill is loaded.
     *
     * @param {Object} params Init params.
     * @param {Object} defs Definitions.
     * @param {boolean} localeComma Locale comma mode.
     */
    function boot(params, defs, localeComma) {
        var instanceVarMode =
            params.variableMode || 'single';

        if (!window.MathQuill) {
            dbg('ERROR: window.MathQuill is undefined.');
            return;
        }

        var MQ = window.MathQuill.getInterface(2);
        dbg('MathQuill interface ready.');

        // MathJax compatibility.
        initMjCompat();

        // Runtime config from PHP.
        var runtime = readJson('sme-runtime') || {};
        var slotConfigs = runtime.slotConfigs || {};
        var slotVarModes = runtime.slotVarModes || {};
        var instanceDefaults =
            runtime.instanceDefaults || {};

        var slotCount =
            Object.keys(slotConfigs).length;
        dbg('Slot configs: ' + slotCount + ' slots');

        var sk;
        for (sk in slotConfigs) {
            if (slotConfigs.hasOwnProperty(sk)) {
                dbg('  Slot ' + sk + ' : '
                    + JSON.stringify(slotConfigs[sk]));
            }
        }

        // Shared context for sub-modules.
        var ctx = {
            MQ: MQ,
            defs: defs,
            slotConfigs: slotConfigs,
            slotVarModes: slotVarModes,
            instanceDefaults: instanceDefaults,
            instanceVarMode: instanceVarMode,
            localeComma: localeComma,
            extractSlot: extractSlot,
            readSize: readSize,
            isCommaDecimal: isCommaDecimal,
            dbg: dbg
        };

        // Lazy-load field modules.
        require(
            ['local_stackmatheditor/input_fields'],
            function(inputFields) {
                dbg('input_fields module loaded.');
                inputFields.init(ctx);
            },
            function(err) {
                dbg('input_fields load error: ' + err);
            }
        );

        require(
            ['local_stackmatheditor/textarea_fields'],
            function(textareaFields) {
                dbg('textarea_fields module loaded.');
                textareaFields.init(ctx);
            },
            function(err) {
                dbg('textarea_fields load error: '
                    + err);
            }
        );
    }

    return /** @alias module:local_stackmatheditor/mathquill_init */ {

        /**
         * Initialize STACK MathEditor.
         *
         * @param {Object} params From PHP js_call_amd.
         */
        init: function(params) {
            dbg('init() called.');

            var mqJsUrl = params.mathquillJsUrl;
            var mqCssUrl = params.mathquillCssUrl;

            // Locale comma detection.
            var lang = $('html').attr('lang') || 'en';
            var localeComma =
                /^(de|fr|es|it|nl|pt|ru|pl|cs|da|fi|nb|nn|sv|tr)/i
                    .test(lang);
            dbg('Comma decimal: ' + localeComma);
            dbg('Variable mode: '
                + (params.variableMode || 'single'));

            // Read definitions from DOM.
            var defs = readJson('sme-definitions') || {};
            var groupCount =
                Object.keys(
                    defs.groups || defs.elementGroups || {}
                ).length;
            var funcCount =
                (defs.functions || []).length;
            var unitCount =
                (defs.unitSymbols || []).length;
            dbg('Definitions: ' + groupCount
                + ' groups, ' + funcCount
                + ' functions, ' + unitCount + ' units');
            dbg('cmid: ' + (params.cmid || 0));

            // Load MathQuill.
            dbg('Loading MathQuill from: ' + mqJsUrl);
            loadCss(mqCssUrl);

            loadScript(mqJsUrl).then(function() {
                dbg('MathQuill loaded successfully.');
                boot(params, defs, localeComma);
            }).fail(function(err) {
                dbg('Failed to load MathQuill: '
                    + (err && err.message
                        ? err.message : err));
            });
        }
    };
});

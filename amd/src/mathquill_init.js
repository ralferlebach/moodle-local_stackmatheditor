/**
 * Initialises MathQuill editors on STACK answer fields.
 *
 * Reads large data from DOM JSON elements:
 * - #sme-definitions: element groups, functions, units, constants, greek
 * - #sme-runtime: slotConfigs, slotVarModes, instanceDefaults
 *
 * Only small params come via js_call_amd: URLs, cmid, variableMode.
 *
 * @module     local_stackmatheditor/mathquill_init
 * @copyright  2026 Your Name
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
define([
    'jquery',
    'core/notification',
    'local_stackmatheditor/tex2max',
    'local_stackmatheditor/max2tex',
    'local_stackmatheditor/mathjax_compat'
], function($, Notification, Tex2Max, Max2Tex, MathJaxCompat) {
    'use strict';

    /** @type {Object|null} MathQuill interface (v2). */
    var MQ = null;

    /** @type {boolean} Enable console debug logging. */
    var DEBUG = true;

    /** @type {number} Debounce delay in ms. */
    var SYNC_DELAY = 500;

    /** @type {boolean} Whether locale uses comma as decimal separator. */
    var COMMA_DECIMAL = false;

    /** @type {Object} Definitions from PHP (read from DOM). */
    var DEFS = {};

    /** @type {string} Instance-wide variable mode. */
    var INSTANCE_VAR_MODE = 'single';

    /**
     * Log debug message.
     *
     * @param {...*} varArgs Values to log.
     */
    function log(varArgs) { // eslint-disable-line no-unused-vars
        if (DEBUG && window.console && window.console.log) {
            var msgArgs = ['[SME]'].concat(Array.prototype.slice.call(arguments));
            window.console.log.apply(window.console, msgArgs);
        }
    }

    /**
     * Create a debounced function.
     *
     * @param {Function} func Function to debounce.
     * @param {number} wait Delay in ms.
     * @returns {Function} Debounced function.
     */
    function debounce(func, wait) {
        var timeout = null;
        return function() {
            var context = this;
            var args = arguments;
            if (timeout) {
                clearTimeout(timeout);
            }
            timeout = setTimeout(function() {
                timeout = null;
                func.apply(context, args);
            }, wait);
        };
    }

    /**
     * Detect comma-decimal locale.
     *
     * @returns {boolean} True if comma decimal.
     */
    function detectCommaDecimal() {
        var lang = '';
        var htmlEl = document.documentElement;
        if (htmlEl) {
            lang = (htmlEl.getAttribute('lang') || '').toLowerCase();
        }
        var commaLocales = [
            'de', 'fr', 'es', 'it', 'pt', 'nl', 'da', 'fi', 'sv', 'nb', 'nn',
            'no', 'pl', 'cs', 'sk', 'hu', 'ro', 'bg', 'hr', 'sl', 'sr', 'el',
            'tr', 'ru', 'uk', 'id', 'vi', 'ca', 'gl', 'eu'
        ];
        var i;
        for (i = 0; i < commaLocales.length; i++) {
            if (lang === commaLocales[i] || lang.indexOf(commaLocales[i] + '-') === 0) {
                return true;
            }
        }
        if (window.Intl && window.Intl.NumberFormat) {
            var formatted = new Intl.NumberFormat(lang || undefined).format(1.1);
            if (formatted.indexOf(',') !== -1) {
                return true;
            }
        }
        return false;
    }

    /**
     * Extract slot number from STACK input name.
     *
     * @param {string} name Input name attribute.
     * @returns {number|null} Slot number or null.
     */
    function extractSlotFromName(name) {
        if (!name) {
            return null;
        }
        var match = name.match(/^q\d+:(\d+)_/);
        if (match) {
            return parseInt(match[1], 10);
        }
        return null;
    }

    /**
     * Read and parse a JSON script tag from the DOM.
     *
     * @param {string} id Element ID.
     * @returns {Object} Parsed JSON or empty object.
     */
    function readJsonFromDom(id) {
        var el = document.getElementById(id);
        if (!el) {
            log('JSON element #' + id + ' not found in DOM.');
            return {};
        }
        try {
            var text = el.textContent || el.innerText || '{}';
            return JSON.parse(text);
        } catch (e) {
            log('Failed to parse #' + id + ':', e.message);
            return {};
        }
    }

    /**
     * Build options for tex2max/max2tex converters.
     *
     * @param {string} varMode Variable mode.
     * @returns {Object} Converter options.
     */
    function buildConvertOptions(varMode) {
        return {
            commaDecimal: COMMA_DECIMAL,
            variableMode: varMode || INSTANCE_VAR_MODE,
            defs: DEFS
        };
    }

    /**
     * Build toolbar from definitions and per-slot config.
     *
     * @param {Object} config Category-to-boolean map.
     * @param {Object} mathField MathQuill MathField instance.
     * @returns {jQuery} Toolbar element.
     */
    function buildToolbar(config, mathField) {
        var $toolbar = $(
            '<div class="sme-toolbar" role="toolbar" aria-label="Math Editor Toolbar"></div>'
        );

        if (!DEFS || !DEFS.elementGroups) {
            return $toolbar;
        }

        var groupKeys = Object.keys(DEFS.elementGroups);
        groupKeys.forEach(function(category) {
            if (!config[category]) {
                return;
            }
            var group = DEFS.elementGroups[category];
            var buttons = group.elements;
            if (!buttons || !buttons.length) {
                return;
            }
            var $group = $('<div class="sme-toolbar-group" role="group" title="'
                + (group.label || category) + '"></div>');

            buttons.forEach(function(btn) {
                var $button = $('<button type="button" class="sme-toolbar-btn"></button>');
                $button.attr('title', btn.label).text(btn.display || btn.label);
                $button.on('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (btn.cmd) {
                        mathField.cmd(btn.cmd);
                    } else if (btn.write) {
                        mathField.write(btn.write);
                    }
                    mathField.focus();
                });
                $group.append($button);
            });
            $toolbar.append($group);
        });

        return $toolbar;
    }

    /**
     * Sync MathQuill value to hidden STACK input.
     *
     * @param {jQuery} $input STACK input element.
     * @param {Object} mathField MathQuill instance.
     * @param {string} varMode Variable mode.
     */
    function doSync($input, mathField, varMode) {
        var latex = mathField.latex();
        var maxima = Tex2Max.convert(latex, buildConvertOptions(varMode));
        log('Sync: LaTeX="' + latex + '" Maxima="' + maxima + '"');
        $input.val(maxima);
        var el = $input[0];
        try {
            el.dispatchEvent(new Event('input', {bubbles: true}));
            el.dispatchEvent(new Event('change', {bubbles: true}));
        } catch (e) {
            log('Event dispatch error (non-fatal):', e.message);
        }
    }

    /**
     * Convert Maxima pre-fill value to LaTeX.
     *
     * @param {string} value Current input value.
     * @param {string} varMode Variable mode.
     * @returns {string} LaTeX for MathQuill.
     */
    function maximaToLatex(value, varMode) {
        if (!value || !value.trim()) {
            return '';
        }
        if (Max2Tex.isMaxima(value)) {
            var latex = Max2Tex.convert(value, buildConvertOptions(varMode));
            log('Pre-fill: Maxima="' + value + '" -> LaTeX="' + latex + '"');
            return latex;
        }
        log('Pre-fill: as-is: "' + value + '"');
        return value;
    }

    /**
     * Load a CSS file dynamically.
     *
     * @param {string} url CSS URL.
     * @returns {Promise} Resolves when loaded.
     */
    function loadCss(url) {
        return new Promise(function(resolve) {
            if (document.querySelector('link[href="' + url + '"]')) {
                resolve();
                return;
            }
            var link = document.createElement('link');
            link.rel = 'stylesheet';
            link.type = 'text/css';
            link.href = url;
            link.onload = function() {
                log('CSS loaded.');
                resolve();
            };
            link.onerror = function() {
                log('CSS FAILED:', url);
                resolve();
            };
            document.head.appendChild(link);
        });
    }

    /**
     * Ensure jQuery is global for MathQuill.
     */
    function ensureGlobalJquery() {
        if (!window.jQuery) {
            window.jQuery = $;
        }
    }

    /**
     * Load MathQuill JS, hiding AMD define temporarily.
     *
     * @param {string} url JS URL.
     * @returns {Promise} Resolves with MathQuill global.
     */
    function loadMathQuillScript(url) {
        return new Promise(function(resolve, reject) {
            if (window.MathQuill) {
                resolve(window.MathQuill);
                return;
            }
            ensureGlobalJquery();
            log('Loading MathQuill from:', url);
            fetch(url)
                .then(function(response) {
                    if (!response.ok) {
                        throw new Error('HTTP ' + response.status + ' for ' + url);
                    }
                    return response.text();
                })
                .then(function(scriptText) {
                    var originalDefine = window.define;
                    window.define = undefined;
                    try {
                        var scriptEl = document.createElement('script');
                        scriptEl.type = 'text/javascript';
                        scriptEl.text = scriptText;
                        document.head.appendChild(scriptEl);
                    } catch (e) {
                        log('Error executing MathQuill:', e.message);
                    }
                    window.define = originalDefine;
                    if (window.MathQuill) {
                        log('MathQuill loaded successfully.');
                        resolve(window.MathQuill);
                    } else {
                        reject(new Error('MathQuill not set after execution.'));
                    }
                })
                .catch(function(err) {
                    reject(new Error('Failed to load MathQuill: ' + err.message));
                });
        });
    }

    /**
     * Replace a STACK input with a MathQuill editor.
     *
     * @param {jQuery} $input STACK input element.
     * @param {Object} config Toolbar category booleans.
     * @param {string} varMode Variable mode.
     * @returns {Object|undefined} MathQuill MathField or undefined.
     */
    function initMathQuillField($input, config, varMode) {
        if ($input.data('sme-initialized')) {
            return undefined;
        }
        $input.data('sme-initialized', true);

        var inputName = $input.attr('name') || 'unknown';
        var slot = extractSlotFromName(inputName);
        log('Init:', inputName, '(slot ' + slot + ', varMode=' + varMode + ')');

        var existingValue = $input.val();

        $input.css({
            position: 'absolute',
            left: '-9999px',
            width: '1px',
            height: '1px',
            overflow: 'hidden',
            opacity: 0
        });

        var $container = $('<div class="sme-container"></div>');
        var $mqSpan = $('<span class="sme-mathquill-field"></span>');
        $container.append($mqSpan);
        $input.after($container);

        var suppressSync = true;

        var debouncedSync = debounce(function() {
            doSync($input, mathField, varMode);
        }, SYNC_DELAY);

        var mathField = MQ.MathField($mqSpan[0], {
            spaceBehavesLikeTab: true,
            handlers: {
                edit: function() {
                    if (!suppressSync) {
                        debouncedSync();
                    }
                }
            }
        });

        if (existingValue) {
            var latex = maximaToLatex(existingValue, varMode);
            if (latex) {
                try {
                    mathField.latex(latex);
                    log('Pre-fill successful.');
                } catch (e) {
                    log('Pre-fill failed:', e.message);
                    mathField.write(existingValue);
                }
            }
        }

        suppressSync = false;
        $container.prepend(buildToolbar(config, mathField));
        return mathField;
    }

    /**
     * Find STACK input fields using multiple strategies.
     *
     * @returns {jQuery} Matched input elements.
     */
    function findStackInputs() {
        var $inputs;

        // Strategy 1: .que.stack container.
        $inputs = $('.que.stack').find('input[type="text"]').filter(function() {
            return this.name && /_ans\d*$/.test(this.name);
        });
        if ($inputs.length) {
            log('Strategy 1 matched:', $inputs.length, 'fields');
            return $inputs;
        }

        // Strategy 2: STACK input class.
        $inputs = $('input.stackinput, input.algebraic');
        if ($inputs.length) {
            log('Strategy 2 matched:', $inputs.length, 'fields');
            return $inputs;
        }

        // Strategy 3: Container with "stack" in class.
        $inputs = $('[class*="stack"]').find('input[type="text"]').filter(function() {
            return (this.id && /ans\d/.test(this.id)) ||
                (this.name && /ans\d/.test(this.name));
        });
        if ($inputs.length) {
            log('Strategy 3 matched:', $inputs.length, 'fields');
            return $inputs;
        }

        // Strategy 4: Broadest fallback.
        $inputs = $('input[type="text"]').filter(function() {
            return this.name && /_ans/.test(this.name);
        });
        if ($inputs.length) {
            log('Strategy 4 matched:', $inputs.length, 'fields');
            return $inputs;
        }

        log('No STACK inputs found.');
        return $();
    }

    return /** @alias module:local_stackmatheditor/mathquill_init */ {

        /**
         * Entry point called from hook_callbacks.php.
         *
         * @param {Object} params Small params from js_call_amd.
         * @param {string} params.mathquillJsUrl MathQuill JS URL.
         * @param {string} params.mathquillCssUrl MathQuill CSS URL.
         * @param {number} params.cmid Course module ID.
         * @param {string} params.variableMode Instance variable mode.
         */
        init: function(params) {
            log('init() called.');

            // Install MathJax v2 compat shim.
            MathJaxCompat.install();

            // Detect locale.
            COMMA_DECIMAL = detectCommaDecimal();
            log('Comma decimal:', COMMA_DECIMAL);

            // Store instance variable mode.
            INSTANCE_VAR_MODE = params.variableMode || 'single';
            log('Variable mode:', INSTANCE_VAR_MODE);

            // Read definitions from DOM JSON (injected by before_top_of_body).
            DEFS = readJsonFromDom('sme-definitions');
            log('Definitions:',
                Object.keys(DEFS.elementGroups || {}).length, 'groups,',
                (DEFS.functions || []).length, 'functions,',
                (DEFS.unitSymbols || []).length, 'units');

            var cmid = params.cmid || 0;
            log('cmid:', cmid);

            // Load MathQuill CSS and JS.
            var cssReady = loadCss(params.mathquillCssUrl);
            var jsReady = loadMathQuillScript(params.mathquillJsUrl);

            Promise.all([cssReady, jsReady])
                .then(function(results) {
                    MQ = results[1].getInterface(2);
                    log('MathQuill interface ready.');

                    // Re-install MathJax shim.
                    MathJaxCompat.install();

                    // Read runtime data from DOM (injected by before_footer).
                    var runtime = readJsonFromDom('sme-runtime');
                    var slotConfigs = runtime.slotConfigs || {};
                    var slotVarModes = runtime.slotVarModes || {};
                    var instanceDefaults = runtime.instanceDefaults || {};

                    var slotKeys = Object.keys(slotConfigs);
                    log('Slot configs:', slotKeys.length, 'slots');
                    slotKeys.forEach(function(slot) {
                        log('  Slot', slot, ':', JSON.stringify(slotConfigs[slot]));
                    });

                    // Find STACK inputs.
                    var $inputs = findStackInputs();
                    if (!$inputs.length) {
                        return;
                    }

                    // Init each input with its config and variable mode.
                    $inputs.each(function() {
                        var $input = $(this);
                        var inputName = $input.attr('name') || '';
                        var slot = extractSlotFromName(inputName);

                        // Determine config for this slot.
                        var config;
                        if (slot !== null && slotConfigs[slot]) {
                            config = slotConfigs[slot];
                            log('Input', inputName, '-> slot', slot, '-> custom config');
                        } else {
                            config = instanceDefaults;
                            log('Input', inputName, '-> slot', slot, '-> instance defaults');
                        }

                        // Determine variable mode for this slot.
                        var varMode;
                        if (slot !== null && slotVarModes[slot]) {
                            varMode = slotVarModes[slot];
                        } else {
                            varMode = INSTANCE_VAR_MODE;
                        }

                        initMathQuillField($input, config, varMode);
                    });
                })
                .catch(function(err) {
                    log('FATAL:', err.message);
                    Notification.exception({message: err.message});
                });
        }
    };
});

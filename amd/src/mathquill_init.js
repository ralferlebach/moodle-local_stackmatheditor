/**
 * Initialises MathQuill editors on STACK answer fields.
 *
 * @module     local_stackmatheditor/mathquill_init
 * @copyright  2026 Your Name
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
define([
    'jquery',
    'core/ajax',
    'core/notification',
    'local_stackmatheditor/tex2max',
    'local_stackmatheditor/max2tex',
    'local_stackmatheditor/mathjax_compat'
], function($, Ajax, Notification, Tex2Max, Max2Tex, MathJaxCompat) {
    'use strict';

    /** @type {Object|null} MathQuill interface (v2). */
    var MQ = null;

    /** @type {boolean} Enable console debug logging. */
    var DEBUG = true;

    /** @type {number} Debounce delay for syncing to STACK input (ms). */
    var SYNC_DELAY = 500;

    /** @type {boolean} Whether the current locale uses comma as decimal separator. */
    var COMMA_DECIMAL = false;

    /**
     * Log a debug message to the browser console.
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
     * Creates a debounced version of a function.
     *
     * @param {Function} func The function to debounce.
     * @param {number} wait Delay in milliseconds.
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
     * Detect whether the current Moodle locale uses comma as decimal separator.
     * Checks the HTML lang attribute and falls back to browser locale.
     *
     * @returns {boolean} True if comma should be used as decimal separator.
     */
    function detectCommaDecimal() {
        var lang = '';

        // Try HTML lang attribute (Moodle sets this).
        var htmlEl = document.documentElement;
        if (htmlEl) {
            lang = (htmlEl.getAttribute('lang') || '').toLowerCase();
        }

        // Comma-decimal locales (non-exhaustive but covers major ones).
        var commaLocales = [
            'de', 'fr', 'es', 'it', 'pt', 'nl', 'da', 'fi', 'sv', 'nb', 'nn',
            'no', 'pl', 'cs', 'sk', 'hu', 'ro', 'bg', 'hr', 'sl', 'sr', 'el',
            'tr', 'ru', 'uk', 'id', 'vi', 'ca', 'gl', 'eu'
        ];

        var i;
        for (i = 0; i < commaLocales.length; i++) {
            if (lang === commaLocales[i] || lang.indexOf(commaLocales[i] + '-') === 0) {
                log('Detected comma-decimal locale:', lang);
                return true;
            }
        }

        // Fallback: use Intl API if available.
        if (window.Intl && window.Intl.NumberFormat) {
            var formatted = new Intl.NumberFormat(lang || undefined).format(1.1);
            if (formatted.indexOf(',') !== -1) {
                log('Intl API detected comma-decimal for:', lang || 'browser default');
                return true;
            }
        }

        log('Using dot as decimal separator for locale:', lang || 'unknown');
        return false;
    }

    /** @type {Object} Toolbar button definitions per category. */
    var TOOLBAR_DEFS = {
        fractions: [
            {label: '\\frac{a}{b}', write: '\\frac{}{}', display: 'a/b'}
        ],
        powers: [
            {label: 'x^n', write: '^{}', display: 'x\u207F'}
        ],
        roots: [
            {label: '\u221Ax', write: '\\sqrt{}', display: '\u221A'},
            {label: '\u221Bx', write: '\\sqrt[3]{}', display: '\u221B'}
        ],
        trigonometry: [
            {label: 'sin', cmd: '\\sin'},
            {label: 'cos', cmd: '\\cos'},
            {label: 'tan', cmd: '\\tan'},
            {label: 'asin', cmd: '\\arcsin'},
            {label: 'acos', cmd: '\\arccos'},
            {label: 'atan', cmd: '\\arctan'}
        ],
        logarithms: [
            {label: 'ln', cmd: '\\ln'},
            {label: 'log', cmd: '\\log'},
            {label: 'exp', cmd: '\\exp'}
        ],
        constants: [
            {label: '\u03C0', cmd: '\\pi'},
            {label: 'e', write: 'e'},
            {label: '\u221E', cmd: '\\infty'}
        ],
        comparison: [
            {label: '\u2264', cmd: '\\le'},
            {label: '\u2265', cmd: '\\ge'},
            {label: '\u2260', cmd: '\\ne'},
            {label: '=', write: '='}
        ],
        parentheses: [
            {label: '( )', write: '\\left(\\right)'},
            {label: '[ ]', write: '\\left[\\right]'}
        ],
        calculus: [
            {label: '\u222B', write: '\\int_{}^{}'},
            {label: '\u03A3', write: '\\sum_{}^{}'}
        ],
        greek: [
            {label: '\u03B1', cmd: '\\alpha'},
            {label: '\u03B2', cmd: '\\beta'},
            {label: '\u03B3', cmd: '\\gamma'},
            {label: '\u03B8', cmd: '\\theta'},
            {label: '\u03BB', cmd: '\\lambda'},
            {label: '\u03C3', cmd: '\\sigma'},
            {label: '\u03C9', cmd: '\\omega'},
            {label: '\u03C6', cmd: '\\phi'}
        ],
        matrices: []
    };

    /**
     * Returns the default toolbar configuration.
     *
     * @returns {Object} Category name to boolean map.
     */
    function getDefaultConfig() {
        return {
            fractions: true,
            powers: true,
            roots: true,
            trigonometry: true,
            logarithms: true,
            constants: true,
            comparison: true,
            parentheses: true,
            calculus: false,
            greek: false,
            matrices: false
        };
    }

    /**
     * Dynamically loads a CSS file by injecting a link element into head.
     *
     * @param {string} url CSS file URL.
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
     * Ensures jQuery is available globally for MathQuill.
     */
    function ensureGlobalJquery() {
        if (!window.jQuery) {
            window.jQuery = $;
        }
    }

    /**
     * Dynamically loads MathQuill JS while preventing AMD detection.
     *
     * @param {string} url JS file URL.
     * @returns {Promise} Resolves with MathQuill global object.
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
                        log('Error executing MathQuill script:', e.message);
                    }

                    window.define = originalDefine;

                    if (window.MathQuill) {
                        log('MathQuill loaded successfully.');
                        resolve(window.MathQuill);
                    } else {
                        reject(new Error('MathQuill executed but window.MathQuill not set.'));
                    }
                })
                .catch(function(err) {
                    reject(new Error('Failed to load MathQuill: ' + err.message));
                });
        });
    }

    /**
     * Builds the toolbar element for a MathQuill field.
     *
     * @param {Object} config Category-to-boolean configuration map.
     * @param {Object} mathField MathQuill MathField instance.
     * @returns {jQuery} Toolbar element.
     */
    function buildToolbar(config, mathField) {
        var $toolbar = $('<div class="sme-toolbar" role="toolbar" aria-label="Math Editor Toolbar"></div>');

        Object.keys(TOOLBAR_DEFS).forEach(function(category) {
            if (!config[category]) {
                return;
            }
            var buttons = TOOLBAR_DEFS[category];
            if (!buttons || !buttons.length) {
                return;
            }
            var $group = $('<div class="sme-toolbar-group" role="group"></div>');
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
     * Performs the actual sync of MathQuill value to the hidden STACK input.
     *
     * @param {jQuery} $input The original STACK input element.
     * @param {Object} mathField MathQuill MathField instance.
     */
    function doSync($input, mathField) {
        var latex = mathField.latex();
        var maxima = Tex2Max.convert(latex, {commaDecimal: COMMA_DECIMAL});
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
     * Converts a pre-filled value to LaTeX for MathQuill display.
     * Detects whether the value is Maxima notation and converts if needed.
     * Handles navigation back to a question with existing answers.
     *
     * @param {string} value The current input field value.
     * @returns {string} LaTeX suitable for MathQuill, or empty string.
     */
    function maximaToLatex(value) {
        if (!value || !value.trim()) {
            return '';
        }

        if (Max2Tex.isMaxima(value)) {
            var latex = Max2Tex.convert(value, {commaDecimal: COMMA_DECIMAL});
            log('Pre-fill: Maxima="' + value + '" -> LaTeX="' + latex + '"');
            return latex;
        }

        log('Pre-fill: Using value as-is: "' + value + '"');
        return value;
    }

    /**
     * Replaces a single STACK input field with a MathQuill editor.
     *
     * @param {jQuery} $input The STACK input element to replace.
     * @param {Object} config Toolbar configuration.
     * @returns {Object|undefined} MathQuill MathField or undefined.
     */
    function initMathQuillField($input, config) {
        if ($input.data('sme-initialized')) {
            return undefined;
        }
        $input.data('sme-initialized', true);

        log('Initialising MathQuill on input:', $input.attr('name'));

        // Store original value BEFORE hiding the input.
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

        // Flag to suppress sync during pre-fill.
        var suppressSync = true;

        var debouncedSync = debounce(function() {
            doSync($input, mathField);
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

        // Pre-fill: convert existing Maxima value to LaTeX.
        if (existingValue) {
            var latex = maximaToLatex(existingValue);
            if (latex) {
                try {
                    mathField.latex(latex);
                    log('Pre-fill successful.');
                } catch (e) {
                    log('Pre-fill LaTeX failed, trying as text:', e.message);
                    // Fallback: write raw text into the field.
                    mathField.write(existingValue);
                }
            }
        }

        // Enable sync after pre-fill is complete.
        suppressSync = false;

        $container.prepend(buildToolbar(config, mathField));
        return mathField;
    }

    /**
     * Finds STACK input fields using multiple selector strategies.
     *
     * @returns {jQuery} Matched input elements.
     */
    function findStackInputs() {
        var $inputs;

        // Strategy 1: Classic .que.stack container.
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
            return (this.id && /ans\d/.test(this.id)) || (this.name && /ans\d/.test(this.name));
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

    /**
     * Applies MathQuill editors to all found STACK inputs.
     *
     * @param {jQuery} $inputs Matched input elements.
     * @param {Object} configMap Question ID to config mapping.
     */
    function applyEditors($inputs, configMap) {
        $inputs.each(function() {
            var $input = $(this);
            var $que = $input.closest('.que');
            var qid = $que.data('questionid');
            var cfg = (qid && configMap[qid]) ? configMap[qid] : getDefaultConfig();
            initMathQuillField($input, cfg);
        });
    }

    return /** @alias module:local_stackmatheditor/mathquill_init */ {

        /**
         * Entry point called from hook_callbacks.php via js_call_amd.
         *
         * @param {Object} params Configuration parameters.
         * @param {string} params.mathquillJsUrl URL to MathQuill JS file.
         * @param {string} params.mathquillCssUrl URL to MathQuill CSS file.
         */
        init: function(params) {
            log('init() called.');

            // Install MathJax v2 compatibility shim.
            MathJaxCompat.install();

            // Detect locale-based decimal separator.
            COMMA_DECIMAL = detectCommaDecimal();
            log('Comma decimal:', COMMA_DECIMAL);

            log('JS URL:', params.mathquillJsUrl);
            log('CSS URL:', params.mathquillCssUrl);

            var cssReady = loadCss(params.mathquillCssUrl);
            var jsReady = loadMathQuillScript(params.mathquillJsUrl);

            Promise.all([cssReady, jsReady])
                .then(function(results) {
                    MQ = results[1].getInterface(2);
                    log('MathQuill interface ready.');

                    // Re-install shim in case MathJax loaded after first call.
                    MathJaxCompat.install();

                    var $inputs = findStackInputs();
                    if (!$inputs.length) {
                        return;
                    }

                    // Collect question IDs.
                    var questionIds = [];
                    $inputs.closest('.que').each(function() {
                        var rawId = $(this).data('questionid') || $(this).attr('id');
                        if (rawId) {
                            var match = String(rawId).match(/(\d+)/);
                            if (match) {
                                questionIds.push(parseInt(match[1], 10));
                            }
                        }
                    });
                    log('Question IDs:', questionIds);

                    if (questionIds.length) {
                        Ajax.call([{
                            methodname: 'local_stackmatheditor_get_config',
                            args: {questionids: questionIds}
                        }])[0].done(function(configResults) {
                            log('Config loaded for', configResults.length, 'questions');
                            var configMap = {};
                            configResults.forEach(function(r) {
                                configMap[r.questionid] = JSON.parse(r.config);
                            });
                            applyEditors($inputs, configMap);
                        }).fail(function(err) {
                            log('Config AJAX failed:', err);
                            applyEditors($inputs, {});
                        });
                    } else {
                        log('No question IDs, using defaults.');
                        applyEditors($inputs, {});
                    }
                })
                .catch(function(err) {
                    log('FATAL:', err.message);
                    Notification.exception({message: err.message});
                });
        }
    };
});

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
    'local_stackmatheditor/tex2max'
], function($, Ajax, Notification, Tex2Max) {
    'use strict';

    /** @type {Object|null} MathQuill interface (v2). */
    var MQ = null;

    /** @type {boolean} Enable console debug logging. */
    var DEBUG = true;

    /**
     * Log a debug message to the browser console.
     *
     * @param {...*} args Values to log.
     */
    function log(args) { // eslint-disable-line no-unused-vars
        if (DEBUG && window.console && window.console.log) {
            var msgArgs = ['[SME]'].concat(Array.prototype.slice.call(arguments));
            window.console.log.apply(window.console, msgArgs);
        }
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
                log('CSS already loaded:', url);
                resolve();
                return;
            }
            var link = document.createElement('link');
            link.rel = 'stylesheet';
            link.type = 'text/css';
            link.href = url;
            link.onload = function() {
                log('CSS loaded:', url);
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
     * Dynamically loads the MathQuill JS library.
     *
     * @param {string} url JS file URL.
     * @returns {Promise} Resolves with MathQuill global.
     */
    function loadMathQuillScript(url) {
        return new Promise(function(resolve, reject) {
            if (window.MathQuill) {
                log('MathQuill already loaded.');
                resolve(window.MathQuill);
                return;
            }
            var script = document.createElement('script');
            script.src = url;
            script.onload = function() {
                if (window.MathQuill) {
                    log('MathQuill loaded successfully.');
                    resolve(window.MathQuill);
                } else {
                    reject(new Error('MathQuill global not available after loading.'));
                }
            };
            script.onerror = function() {
                reject(new Error('Failed to load MathQuill script: ' + url));
            };
            document.head.appendChild(script);
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
     * Synchronises the MathQuill LaTeX output to the hidden STACK input field.
     *
     * @param {jQuery} $input The original STACK input element.
     * @param {Object} mathField MathQuill MathField instance.
     */
    function syncToInput($input, mathField) {
        var latex = mathField.latex();
        var maxima = Tex2Max.convert(latex);
        log('Sync: LaTeX="' + latex + '" → Maxima="' + maxima + '"');
        $input.val(maxima);
        var el = $input[0];
        el.dispatchEvent(new Event('input', {bubbles: true}));
        el.dispatchEvent(new Event('change', {bubbles: true}));
    }

    /**
     * Replaces a single STACK input field with a MathQuill editor.
     *
     * @param {jQuery} $input The STACK input element to replace.
     * @param {Object} config Toolbar configuration.
     * @returns {Object|undefined} MathQuill MathField instance or undefined if already initialised.
     */
    function initMathQuillField($input, config) {
        if ($input.data('sme-initialized')) {
            return undefined;
        }
        $input.data('sme-initialized', true);

        log('Initialising MathQuill on input:', $input.attr('name'));

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

        var mathField = MQ.MathField($mqSpan[0], {
            spaceBehavesLikeTab: true,
            handlers: {
                edit: function() {
                    syncToInput($input, mathField);
                }
            }
        });

        var existing = $input.val();
        if (existing) {
            log('Pre-filling with existing value:', existing);
            mathField.latex(existing);
        }

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

        // Strategy 1: Classic Moodle quiz – .que.stack container.
        $inputs = $('.que.stack').find('input[type="text"]').filter(function() {
            return this.name && /_ans\d*$/.test(this.name);
        });
        if ($inputs.length) {
            log('Strategy 1 matched: .que.stack input[name*=_ans] →', $inputs.length, 'fields');
            return $inputs;
        }

        // Strategy 2: STACK input class (some versions add a class).
        $inputs = $('input.stackinput, input.algebraic');
        if ($inputs.length) {
            log('Strategy 2 matched: input.stackinput / input.algebraic →', $inputs.length, 'fields');
            return $inputs;
        }

        // Strategy 3: Any text input whose ID contains "ans" inside a STACK container.
        $inputs = $('[class*="stack"]').find('input[type="text"]').filter(function() {
            return (this.id && /ans\d/.test(this.id)) || (this.name && /ans\d/.test(this.name));
        });
        if ($inputs.length) {
            log('Strategy 3 matched: [class*=stack] input[id*=ans] →', $inputs.length, 'fields');
            return $inputs;
        }

        // Strategy 4: Broadest – any text input with _ans in name.
        $inputs = $('input[type="text"]').filter(function() {
            return this.name && /_ans/.test(this.name);
        });
        if ($inputs.length) {
            log('Strategy 4 (broad) matched: input[name*=_ans] →', $inputs.length, 'fields');
            return $inputs;
        }

        log('No STACK input fields found on this page.');
        log('DEBUG: All text inputs on page:');
        $('input[type="text"]').each(function() {
            log('  name="' + this.name + '" id="' + this.id + '" class="' + this.className + '"');
        });
        log('DEBUG: Question containers:');
        $('.que').each(function() {
            log('  class="' + this.className + '" id="' + this.id + '"');
        });

        return $();
    }

    /**
     * Initialises editors on all found STACK inputs using given config map.
     *
     * @param {jQuery} $inputs The matched input elements.
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
         * Entry point – called from hook_callbacks.php via js_call_amd.
         *
         * @param {Object} params Configuration parameters.
         * @param {string} params.mathquillJsUrl URL to mathquill.min.js.
         * @param {string} params.mathquillCssUrl URL to mathquill.css.
         */
        init: function(params) {
            log('init() called with params:', JSON.stringify(params));

            var cssReady = loadCss(params.mathquillCssUrl);
            var jsReady = loadMathQuillScript(params.mathquillJsUrl);

            Promise.all([cssReady, jsReady])
                .then(function(results) {
                    MQ = results[1].getInterface(2);
                    log('MathQuill interface ready.');

                    var $inputs = findStackInputs();
                    if (!$inputs.length) {
                        return;
                    }

                    // Collect question IDs.
                    var questionIds = [];
                    var $questions = $inputs.closest('.que');
                    $questions.each(function() {
                        var rawId = $(this).data('questionid') || $(this).attr('id');
                        if (rawId) {
                            var match = String(rawId).match(/(\d+)/);
                            if (match) {
                                questionIds.push(parseInt(match[1], 10));
                            }
                        }
                    });
                    log('Question IDs found:', questionIds);

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
                            log('Config AJAX failed, using defaults. Error:', err);
                            applyEditors($inputs, {});
                        });
                    } else {
                        log('No question IDs, using default config.');
                        applyEditors($inputs, {});
                    }
                })
                .catch(function(err) {
                    log('FATAL ERROR:', err.message);
                    Notification.exception({message: err.message});
                });
        }
    };
});

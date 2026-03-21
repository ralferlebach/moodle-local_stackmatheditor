/**
 * Initialises MathQuill editors on STACK answer fields.
 *
 * @module local_stackmatheditor/mathquill_init
 */
define([
    'jquery',
    'core/ajax',
    'core/notification',
    'local_stackmatheditor/tex2max'
], function($, Ajax, Notification, Tex2Max) {
    'use strict';

    var MQ = null;

    // Toolbar category definitions.
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
            {label: 'sin',  cmd: '\\sin'},
            {label: 'cos',  cmd: '\\cos'},
            {label: 'tan',  cmd: '\\tan'},
            {label: 'asin', cmd: '\\arcsin'},
            {label: 'acos', cmd: '\\arccos'},
            {label: 'atan', cmd: '\\arctan'}
        ],
        logarithms: [
            {label: 'ln',  cmd: '\\ln'},
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

    function getDefaultConfig() {
        return {
            fractions: true, powers: true, roots: true,
            trigonometry: true, logarithms: true, constants: true,
            comparison: true, parentheses: true,
            calculus: false, greek: false, matrices: false
        };
    }

    function loadMathQuillScript(url) {
        return new Promise(function(resolve, reject) {
            if (window.MathQuill) {
                resolve(window.MathQuill);
                return;
            }
            var script = document.createElement('script');
            script.src = url;
            script.onload = function() {
                if (window.MathQuill) {
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

    function buildToolbar(config, mathField) {
        var $toolbar = $('<div class="sme-toolbar" role="toolbar" aria-label="Math Editor Toolbar"></div>');

        Object.keys(TOOLBAR_DEFS).forEach(function(category) {
            if (!config[category]) {
                return;
            }
            var buttons = TOOLBAR_DEFS[category];
            if (!buttons || buttons.length === 0) {
                return;
            }

            var $group = $('<div class="sme-toolbar-group" role="group"></div>');
            buttons.forEach(function(btn) {
                var $button = $('<button type="button" class="sme-toolbar-btn"></button>');
                $button.attr('title', btn.label);
                $button.text(btn.display || btn.label);
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

    function syncToInput($input, mathField) {
        var latex  = mathField.latex();
        var maxima = Tex2Max.convert(latex);
        $input.val(maxima);

        var el = $input[0];
        el.dispatchEvent(new Event('input',  {bubbles: true}));
        el.dispatchEvent(new Event('change', {bubbles: true}));
    }

    function initMathQuillField($input, config) {
        $input.css({
            position: 'absolute',
            left: '-9999px',
            width: '1px',
            height: '1px',
            overflow: 'hidden',
            opacity: 0
        });

        var $container = $('<div class="sme-container"></div>');
        var $mqSpan    = $('<span class="sme-mathquill-field"></span>');
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
            mathField.latex(existing);
        }

        var $toolbar = buildToolbar(config, mathField);
        $container.prepend($toolbar);

        return mathField;
    }

    return {
        init: function(params) {
            loadMathQuillScript(params.mathquillJsUrl)
                .then(function(MathQuillGlobal) {
                    MQ = MathQuillGlobal.getInterface(2);

                    var $inputs = $('.que.stack')
                        .find('input[type="text"]')
                        .filter(function() {
                            return this.name && /_ans\d*$/.test(this.name);
                        });

                    if ($inputs.length === 0) {
                        return;
                    }

                    var questionIds = [];
                    $('.que.stack').each(function() {
                        var qid = $(this).data('questionid');
                        if (qid) {
                            questionIds.push(parseInt(qid, 10));
                        }
                    });

                    if (questionIds.length > 0) {
                        Ajax.call([{
                            methodname: 'local_stackmatheditor_get_config',
                            args: {questionids: questionIds}
                        }])[0].done(function(results) {
                            var configMap = {};
                            results.forEach(function(r) {
                                configMap[r.questionid] = JSON.parse(r.config);
                            });
                            $inputs.each(function() {
                                var $input = $(this);
                                var $que   = $input.closest('.que.stack');
                                var qid    = $que.data('questionid');
                                var cfg    = configMap[qid] || getDefaultConfig();
                                initMathQuillField($input, cfg);
                            });
                        }).fail(function() {
                            $inputs.each(function() {
                                initMathQuillField($(this), getDefaultConfig());
                            });
                        });
                    } else {
                        $inputs.each(function() {
                            initMathQuillField($(this), getDefaultConfig());
                        });
                    }
                })
                .catch(function(err) {
                    Notification.exception({message: err.message});
                });
        }
    };
});

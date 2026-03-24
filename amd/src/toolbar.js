/**
 * Shared toolbar builder for STACK MathEditor.
 *
 * @module     local_stackmatheditor/toolbar
 * @copyright  2026 Ralf Erlebach
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
define(['jquery'], function($) {
    'use strict';

    /**
     * Resolve the target MQ field.
     *
     * @param {Object|Function} target MQ field or getter.
     * @returns {Object|null} MathQuill field.
     */
    function resolve(target) {
        if (typeof target === 'function') {
            return target();
        }
        return target || null;
    }

    /**
     * Extract button elements from a group definition.
     * Handles:
     * - {label, elements: [...]}  (definitions.php)
     * - {label, elements: {0:..}} (PHP object)
     * - [...]                     (direct array)
     *
     * @param {*} group Group definition.
     * @returns {Array} Array of button element objects.
     */
    function extractElements(group) {
        if (!group) {
            return [];
        }
        if (group.elements) {
            var els = group.elements;
            if (Array.isArray(els)) {
                return els;
            }
            if (typeof els === 'object') {
                return Object.values(els);
            }
        }
        if (Array.isArray(group)) {
            return group;
        }
        if (typeof group === 'object'
            && !group.label
            && !group.default_enabled) {
            return Object.values(group);
        }
        return [];
    }

    /**
     * Determine the MathQuill action and command
     * from an element definition. Supports multiple
     * property name conventions:
     *
     * - {cmd: "\\sqrt"}           → cmd("\\sqrt")
     * - {write: "\\frac{}{}"}     → write("\\frac{}{}")
     * - {latex: "\\pi"}           → cmd("\\pi")
     * - {keystroke: "Backspace"}  → keystroke(...)
     * - {action: "write", cmd: …} → explicit action
     *
     * @param {Object} el Element definition.
     * @returns {Object} {action, command} or null.
     */
    function resolveCommand(el) {
        // Explicit action property.
        if (el.action && el.cmd) {
            return {action: el.action, command: el.cmd};
        }

        // "write" property → write action.
        if (el.write) {
            return {action: 'write', command: el.write};
        }

        // "cmd" property → cmd action.
        if (el.cmd) {
            return {action: 'cmd', command: el.cmd};
        }

        // "latex" property → cmd action.
        if (el.latex) {
            return {action: 'cmd', command: el.latex};
        }

        // "keystroke" property → keystroke action.
        if (el.keystroke) {
            return {
                action: 'keystroke',
                command: el.keystroke
            };
        }

        // "command" property (alternative name).
        if (el.command) {
            return {action: 'cmd', command: el.command};
        }

        return null;
    }

    /**
     * Determine the button label from an element.
     * Supports multiple property name conventions:
     *
     * - display_latex → MathJax rendered
     * - displayLatex  → MathJax rendered
     * - display       → plain text
     * - label         → may contain LaTeX or text
     *
     * @param {Object} el Element definition.
     * @returns {Object} {html, needsTypeset}.
     */
    function resolveLabel(el) {
        // display_latex or displayLatex → MathJax.
        var dl = el.display_latex || el.displayLatex;
        if (dl) {
            return {
                html: '<span class="sme-tb-lbl">'
                    + '\\(' + dl + '\\)</span>',
                needsTypeset: true
            };
        }

        // label containing backslash → treat as LaTeX.
        if (el.label && el.label.indexOf('\\') >= 0) {
            return {
                html: '<span class="sme-tb-lbl">'
                    + '\\(' + el.label + '\\)</span>',
                needsTypeset: true
            };
        }

        // display → plain text label.
        if (el.display) {
            return {html: null, text: el.display,
                needsTypeset: false};
        }

        // label → plain text.
        if (el.label) {
            return {html: null, text: el.label,
                needsTypeset: false};
        }

        return null;
    }

    /**
     * Create one toolbar button.
     *
     * @param {Object} el Element definition.
     * @param {Object|Function} target MQ field or getter.
     * @returns {jQuery|null} Button or null.
     */
    function makeButton(el, target) {
        if (!el || typeof el !== 'object') {
            return null;
        }

        var resolved = resolveCommand(el);
        if (!resolved) {
            return null;
        }

        var action = resolved.action;
        var command = resolved.command;

        var labelInfo = resolveLabel(el);

        var $btn = $('<button>')
            .attr('type', 'button')
            .addClass(
                'btn btn-sm btn-outline-secondary'
                + ' sme-tb-btn')
            .attr('title',
                el.tooltip || el.display
                || el.label || command);

        // Apply label.
        if (labelInfo && labelInfo.html) {
            $btn.html(labelInfo.html);
        } else if (labelInfo && labelInfo.text) {
            $btn.text(labelInfo.text);
        } else {
            $btn.text(command);
        }

        // Prevent focus steal from MQ field.
        $btn.on('mousedown', function(e) {
            e.preventDefault();
            e.stopPropagation();
        });

        $btn.on('click', function(e) {
            e.preventDefault();
            e.stopPropagation();

            var f = resolve(target);
            if (!f) {
                return;
            }

            try {
                if (action === 'write') {
                    f.write(command);
                } else if (action === 'keystroke') {
                    f.keystroke(command);
                } else {
                    f.cmd(command);
                }
                f.focus();
            } catch (ex) {
                window.console.log(
                    '[SME-tb] Error: ' + ex.message);
            }
        });

        return $btn;
    }

    return /** @alias module:local_stackmatheditor/toolbar */ {

        /**
         * Build a toolbar from config and definitions.
         *
         * @param {Object|Function} target MQ field or getter.
         * @param {Object} config Enabled group flags.
         * @param {Object} defs Definitions.
         * @returns {jQuery} Toolbar element.
         */
        build: function(target, config, defs) {
            var $bar = $('<div>').addClass('sme-toolbar');

            var groups = defs.groups
                || defs.elementGroups
                || {};

            var key;
            var elements;
            var i;
            var $btn;
            var buttonCount = 0;

            for (key in config) {
                if (!config.hasOwnProperty(key)) {
                    continue;
                }
                if (!config[key]
                    || key.charAt(0) === '_') {
                    continue;
                }

                elements = extractElements(groups[key]);
                if (!elements.length) {
                    continue;
                }

                var $grp = $('<span>')
                    .addClass('sme-tb-group')
                    .attr('data-group', key);

                for (i = 0; i < elements.length; i++) {
                    $btn = makeButton(
                        elements[i], target);
                    if ($btn) {
                        $grp.append($btn);
                        buttonCount++;
                    }
                }

                if ($grp.children().length > 0) {
                    $bar.append($grp);
                }
            }

            window.console.log(
                '[SME-tb] built: ' + buttonCount
                + ' buttons');

            return $bar;
        },

        /**
         * Typeset toolbar labels via MathJax.
         * Retries if MathJax not ready yet.
         *
         * @param {jQuery} $bar Toolbar element.
         */
        typeset: function($bar) {
            if (!$bar || !$bar.length) {
                return;
            }

            /**
             * Try to typeset, retry if needed.
             *
             * @param {number} attempt Current attempt.
             */
            function tryTypeset(attempt) {
                if (window.MathJax
                    && window.MathJax.typesetPromise) {
                    window.MathJax.typesetPromise(
                        [$bar[0]]
                    ).then(function() {
                        window.console.log(
                            '[SME-tb] MathJax typeset OK');
                    }).catch(function(e) {
                        window.console.log(
                            '[SME-tb] MathJax error: '
                            + e);
                    });
                    return;
                }
                if (window.MathJax
                    && window.MathJax.Hub) {
                    window.MathJax.Hub.Queue(
                        ['Typeset',
                            window.MathJax.Hub, $bar[0]]);
                    return;
                }
                if (attempt < 10) {
                    setTimeout(function() {
                        tryTypeset(attempt + 1);
                    }, 300);
                }
            }

            setTimeout(function() {
                tryTypeset(0);
            }, 100);
        }
    };
});

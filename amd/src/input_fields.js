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
 * Single-line MathQuill editor for STACK input fields.
 *
 * Supports: data-stack-input-type="algebraic" and "units".
 *
 * @module     local_stackmatheditor/input_fields
 * @package
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
define([
    'jquery',
    'local_stackmatheditor/tex2max',
    'local_stackmatheditor/max2tex',
    'local_stackmatheditor/toolbar'
], function($, tex2max, max2tex, toolbar) {
    'use strict';

    var TYPES = ['algebraic', 'units'];

    /**
     * Build selector for supported types.
     *
     * @returns {string} Selector.
     */
    function selector() {
        return TYPES.map(function(t) {
            return 'input[data-stack-input-type="'
                + t + '"]';
        }).join(',');
    }

    /**
     * Trigger STACK's validation mechanism.
     * STACK listens for specific events on inputs.
     *
     * @param {jQuery} $input Hidden input.
     */
    function triggerStackValidation($input) {
        // Standard events.
        $input.trigger('change');
        $input.trigger('input');

        // STACK uses blur to trigger validation.
        $input.trigger('blur');

        // Native event for frameworks that don't
        // listen to jQuery events.
        var nativeInput = new Event('input', {
            bubbles: true,
            cancelable: true
        });
        $input[0].dispatchEvent(nativeInput);

        var nativeChange = new Event('change', {
            bubbles: true,
            cancelable: true
        });
        $input[0].dispatchEvent(nativeChange);
    }

    /**
     * Sync MathQuill to hidden input.
     *
     * @param {Object} mqField MathQuill field.
     * @param {jQuery} $input Hidden input.
     * @param {Object} convOpts Conversion options.
     * @param {Function} dbg Debug logger.
     */
    function syncToInput(mqField, $input, convOpts, dbg) {
        var latex = mqField.latex();
        var maxima = '';
        if (latex && latex.trim()) {
            try {
                maxima = tex2max.convert(latex, convOpts);
            } catch (e) {
                maxima = latex;
            }
        }
        var oldVal = $input.val();
        $input.val(maxima);

        // Only trigger validation if value changed.
        if (maxima !== oldVal) {
            triggerStackValidation($input);
            dbg('Sync: LaTeX="' + latex
                + '" Maxima="' + maxima + '"');
        }
    }


    /**
     * Find a top-level relation operator in one expression.
     *
     * @param {string} expr Maxima fragment.
     * @returns {boolean} True if a top-level relation exists.
     */
    function hasTopLevelRelation(expr) {
        var depth = 0;
        var i;
        var twochar;
        for (i = 0; i < expr.length; i++) {
            if (expr.charAt(i) === '(') {
                depth++;
                continue;
            }
            if (expr.charAt(i) === ')') {
                depth = Math.max(0, depth - 1);
                continue;
            }
            if (depth !== 0) {
                continue;
            }
            twochar = expr.slice(i, i + 2);
            if (twochar === '<=' || twochar === '>=' || twochar === '#=' ||
                    twochar === '~=') {
                return true;
            }
            if (expr.charAt(i) === '=' || expr.charAt(i) === '<' ||
                    expr.charAt(i) === '>' || expr.charAt(i) === '#') {
                return true;
            }
        }
        return false;
    }

    /**
     * Split a top-level Maxima and-chain.
     *
     * @param {string} expr Maxima expression.
     * @returns {string[]} Parts or the original expression.
     */
    function splitTopLevelAnd(expr) {
        var parts = [];
        var depth = 0;
        var start = 0;
        var i;
        var prev;
        var next;
        var part;

        for (i = 0; i < expr.length; i++) {
            if (expr.charAt(i) === '(') {
                depth++;
                continue;
            }
            if (expr.charAt(i) === ')') {
                depth = Math.max(0, depth - 1);
                continue;
            }
            if (depth !== 0 || expr.slice(i, i + 3) !== 'and') {
                continue;
            }
            prev = i > 0 ? expr.charAt(i - 1) : '';
            next = i + 3 < expr.length ? expr.charAt(i + 3) : '';
            if ((prev && /[A-Za-z0-9_]/.test(prev)) ||
                    (next && /[A-Za-z0-9_]/.test(next))) {
                continue;
            }
            part = expr.slice(start, i).trim();
            if (part) {
                parts.push(part);
            }
            start = i + 3;
            i += 2;
        }

        part = expr.slice(start).trim();
        if (part) {
            parts.push(part);
        }

        return parts;
    }

    /**
     * Remove one pair of outer parentheses if they wrap the whole expression.
     *
     * @param {string} expr Expression.
     * @returns {string} Unwrapped expression.
     */
    function unwrapOuterParens(expr) {
        var text = (expr || '').trim();
        var depth = 0;
        var i;

        if (!text || text.charAt(0) !== '(' ||
                text.charAt(text.length - 1) !== ')') {
            return text;
        }

        for (i = 0; i < text.length; i++) {
            if (text.charAt(i) === '(') {
                depth++;
            } else if (text.charAt(i) === ')') {
                depth--;
                if (depth === 0 && i < text.length - 1) {
                    return text;
                }
            }
        }

        return text.slice(1, -1).trim();
    }

    /**
     * Detect a relation system represented by top-level and-connections.
     *
     * @param {string} maxima Maxima input.
     * @returns {?Array} Relation parts or null.
     */
    function getRelationSystemParts(maxima) {
        var trimmed = (maxima || '').trim();
        var parts;
        if (!trimmed) {
            return null;
        }
        parts = splitTopLevelAnd(trimmed);
        if (parts.length < 2) {
            return null;
        }
        if (!parts.every(function(part) {
            return hasTopLevelRelation(unwrapOuterParens(part));
        })) {
            return null;
        }
        return parts.map(function(part) {
            return unwrapOuterParens(part);
        });
    }

    /**
     * Convert one MathQuill field to Maxima.
     *
     * @param {Object} mqField MathQuill field.
     * @param {Object} convOpts Conversion options.
     * @returns {string} Maxima fragment.
     */
    function latexFieldToMaxima(mqField, convOpts) {
        var latex = mqField.latex();
        if (!latex || !latex.trim()) {
            return '';
        }
        try {
            return tex2max.convert(latex, convOpts);
        } catch (e) {
            return latex;
        }
    }

    /**
     * Sync a graphical relation system editor back to the hidden input.
     *
     * @param {Array} rows Row descriptors.
     * @param {jQuery} $input Hidden input.
     * @param {Object} convOpts Conversion options.
     * @param {Function} dbg Debug logger.
     */
    function syncSystemToInput(rows, $input, convOpts, dbg) {
        var maxima = rows.map(function(row) {
            return latexFieldToMaxima(row.mqField, convOpts).trim();
        }).filter(function(value) {
            return !!value;
        }).map(function(value) {
            return '(' + value + ')';
        }).join(' and ');
        var oldVal = $input.val();

        $input.val(maxima);

        if (maxima !== oldVal) {
            triggerStackValidation($input);
            dbg('System sync: Maxima="' + maxima + '"');
        }
    }

    /**
     * Create one graphical system row.
     *
     * @param {jQuery} $rowsWrap Rows wrapper.
     * @param {Array} rows Row registry.
     * @param {Object} ctx Shared context.
     * @param {jQuery} $input Hidden input.
     * @param {Object} convOpts Conversion options.
     * @param {string} maximaPart Initial maxima fragment.
     * @param {string} varMode Variable mode.
     * @param {Function} getActiveField Active field setter/getter.
     */
    function createSystemRow(
            $rowsWrap,
            rows,
            ctx,
            $input,
            convOpts,
            maximaPart,
            varMode,
            getActiveField) {
        var row = {
            prefilling: !!(maximaPart && maximaPart.trim())
        };
        var $row = $('<div>').addClass('sme-system-row');
        var $mqWrap = $('<div>').addClass('sme-system-mqwrap');
        var $mqSpan = $('<span>');
        var $remove = $('<button>')
            .attr('type', 'button')
            .addClass('btn btn-link sme-system-del')
            .attr('aria-label', 'Remove equation row')
            .text('×');

        $mqWrap.append($mqSpan);
        $row.append($mqWrap).append($remove);
        $rowsWrap.append($row);
        row.$row = $row;
        row.$mqWrap = $mqWrap;
        row.$mqSpan = $mqSpan;

        row.mqField = ctx.MQ.MathField($mqSpan[0], {
            spaceBehavesLikeTab: true,
            handlers: {
                edit: function() {
                    if (row.prefilling) {
                        return;
                    }
                    syncSystemToInput(rows, $input, convOpts, ctx.dbg);
                }
            }
        });

        function activateRow() {
            rows.forEach(function(entry) {
                entry.$row.removeClass('sme-system-row-active');
            });
            $row.addClass('sme-system-row-active');
            getActiveField(row.mqField);
        }

        $mqWrap.on('click', function() {
            activateRow();
            row.mqField.focus();
        });

        $row.on('mousedown focusin', function() {
            activateRow();
        });

        $remove.on('click', function() {
            var index = rows.indexOf(row);
            if (rows.length <= 1 || index === -1) {
                return;
            }
            row.$row.remove();
            rows.splice(index, 1);
            if (rows[index]) {
                rows[index].mqField.focus();
            } else if (rows[index - 1]) {
                rows[index - 1].mqField.focus();
            }
            syncSystemToInput(rows, $input, convOpts, ctx.dbg);
        });

        rows.push(row);

        if (row.prefilling) {
            setTimeout(function() {
                prefill(row.mqField, maximaPart, ctx.defs, varMode, ctx.dbg);
                setTimeout(function() {
                    row.prefilling = false;
                }, 0);
            }, 0);
        }

        return row;
    }

    /**
     * Pre-fill MathQuill from Maxima.
     *
     * @param {Object} mqField MathQuill field.
     * @param {string} maxima Maxima expression.
     * @param {Object} defs Definitions.
     * @param {string} varMode Variable mode.
     * @param {Function} dbg Debug logger.
     */
    function prefill(mqField, maxima, defs, varMode, dbg) {
        if (!maxima || !maxima.trim()) {
            return;
        }
        try {
            var latex = max2tex.convert(maxima, {
                defs: defs,
                variableMode: varMode
            });
            mqField.latex(latex);
            dbg('Pre-fill: Maxima="' + maxima
                + '" -> LaTeX="' + latex + '"');
        } catch (e) {
            dbg('Pre-fill error: ' + e.message);
            try {
                mqField.latex(maxima);
                dbg('Pre-fill fallback with raw value: "' + maxima + '"');
            } catch (fallbackError) {
                dbg('Pre-fill fallback error: ' + fallbackError.message);
            }
        }
    }

    /**
     * Initialize one field.
     *
     * @param {HTMLInputElement} input Original input.
     * @param {Object} ctx Shared context.
     */
    function initField(input, ctx) {
        var $input = $(input);

        if ($input.attr('data-sme-init') === '1') {
            return;
        }

        var name = $input.attr('name') || '';
        var slot = ctx.extractSlot(name);

        // Check per-slot enabled map.
        // If slotEnabled is present and the slot is explicitly disabled,
        // skip activation for this input entirely.
        if (ctx.slotEnabled
                && ctx.slotEnabled.hasOwnProperty(slot)
                && !ctx.slotEnabled[slot]) {
            ctx.dbg('Input ' + name
                + ' -> slot ' + slot
                + ' disabled, skipping');
            return;
        }

        var config = ctx.slotConfigs[slot]
            || ctx.instanceDefaults;
        var varMode = ctx.slotVarModes[slot]
            || ctx.instanceVarMode;
        var commaDecimal = ctx.isCommaDecimal(
            $input, ctx.localeComma);
        var inputType = $input.attr(
            'data-stack-input-type') || 'algebraic';

        ctx.dbg('Input ' + name
            + ' -> slot ' + slot
            + ' -> type=' + inputType
            + ', varMode=' + varMode);

        var convOpts = {
            commaDecimal: commaDecimal,
            defs: ctx.defs,
            variableMode: varMode
        };

        // Build editor wrapper.
        var $wrap = $('<div>')
            .addClass('sme-input-wrap');

        // Toolbar — mqField doesn't exist yet.
        var mqField = null;
        var $tb = toolbar.build(
            function() { return mqField; },
            config, ctx.defs);
        $wrap.append($tb);

        // MQ container.
        var $container = $('<div>')
            .addClass('sme-mq-container');
        var $mqSpan = $('<span>');
        $container.append($mqSpan);
        $wrap.append($container);

        $container.on('click', function() {
            if (mqField) {
                mqField.focus();
            }
        });

        // Insert BEFORE the input, keep input in
        // its original DOM position so STACK's
        // validation feedback stays correctly placed.
        $input.before($wrap);
        $input.css({
            'position': 'absolute',
            'left': '-9999px',
            'width': '1px',
            'height': '1px',
            'overflow': 'hidden'
        });
        $input.attr('data-sme-init', '1');

        // Read the initial Maxima value from the HTML attribute (defaultValue)
        // rather than the JS .value property.
        //
        // WHY: STACK or Moodle JS can clear input.value before our AMD module
        // initialises (e.g. during STACK's own input validation setup). The
        // .defaultValue property always holds the value="" attribute written by
        // PHP, and is immune to JS manipulation unless form.reset() is called.
        // We fall back to .val() for dynamically created inputs where PHP never
        // set a value attribute but JS may have set the property.
        var initialMaxima = $input[0].defaultValue || $input.val();

        var systemParts = getRelationSystemParts(initialMaxima);
        var prefilling = (initialMaxima && initialMaxima.trim()) ? true : false;
        var activeMqField = null;
        var getActiveField = null;

        if (systemParts) {
            var rows = [];
            var $systemWrap = $('<div>').addClass('sme-system-wrap');
            var $brace = $('<div>').addClass('sme-system-brace')
                .append($('<span>').addClass('sme-system-brace-top'))
                .append($('<span>').addClass('sme-system-brace-mid'))
                .append($('<span>').addClass('sme-system-brace-bottom'));
            var $rowsWrap = $('<div>').addClass('sme-system-rows');
            var $controls = $('<div>').addClass('sme-system-controls');
            var $add = $('<button>')
                .attr('type', 'button')
                .addClass('btn btn-secondary btn-sm sme-system-add')
                .text('+');

            $controls.append($add);
            $container.empty()
                .append($systemWrap);
            $systemWrap.append($brace)
                .append($rowsWrap)
                .append($controls);

            getActiveField = function(field) {
                if (typeof field !== 'undefined') {
                    activeMqField = field;
                }
                return activeMqField;
            };

            mqField = {
                focus: function() {
                    if (activeMqField) {
                        activeMqField.focus();
                    } else if (rows.length) {
                        rows[0].mqField.focus();
                    }
                },
                latex: function() {
                    return rows.map(function(row) {
                        return row.mqField.latex();
                    }).join(' \\ ');
                }
            };

            systemParts.forEach(function(part) {
                createSystemRow(
                    $rowsWrap,
                    rows,
                    ctx,
                    $input,
                    convOpts,
                    part,
                    varMode,
                    getActiveField
                );
            });

            if (rows.length) {
                getActiveField(rows[0].mqField);
                rows[0].$row.addClass('sme-system-row-active');
            }

            $add.on('click', function() {
                var row = createSystemRow(
                    $rowsWrap,
                    rows,
                    ctx,
                    $input,
                    convOpts,
                    '',
                    varMode,
                    getActiveField
                );
                row.prefilling = false;
                row.mqField.focus();
                syncSystemToInput(rows, $input, convOpts, ctx.dbg);
            });

            toolbar.typeset($tb);
            setTimeout(function() {
                $input.val(initialMaxima);
                setTimeout(function() {
                    syncSystemToInput(rows, $input, convOpts, ctx.dbg);
                }, 0);
            }, 0);
            return;
        }

        // Create MathQuill.
        mqField = ctx.MQ.MathField($mqSpan[0], {
            spaceBehavesLikeTab: true,
            handlers: {
                edit: function() {
                    if (prefilling) {
                        return;
                    }
                    syncToInput(
                        mqField, $input,
                        convOpts, ctx.dbg);
                }
            }
        });

        // Typeset toolbar (delayed for MathJax).
        toolbar.typeset($tb);

        // Pre-fill: two nested setTimeout(0) calls are used intentionally.
        //
        // Outer setTimeout(0): lets MathQuill finish building its internal DOM
        //   after MathField() returns, before we write LaTeX into it.
        //
        // Inner setTimeout(0): clears the prefilling flag only AFTER all
        //   synchronous and microtask-queued MathQuill edit events from the
        //   latex() setter have fired and been suppressed. If we cleared the
        //   flag synchronously inside the outer callback, a MathQuill-internal
        //   deferred edit event could still fire with an empty value afterwards.
        //
        // After both ticks, we restore $input.val(initialMaxima) directly —
        // this is more reliable than calling syncToInput(), which round-trips
        // through tex2max and could produce a slightly different Maxima string.
        if (initialMaxima && initialMaxima.trim()) {
            setTimeout(function() {
                // Write the pre-filled LaTeX into the MathQuill field.
                prefill(mqField, initialMaxima,
                    ctx.defs, varMode, ctx.dbg);
                // Immediately restore the known-good Maxima value into the
                // hidden input. This is more reliable than calling syncToInput()
                // which would round-trip through tex2max and might produce a
                // slightly different Maxima string.
                $input.val(initialMaxima);
                // Release the prefilling guard after one more tick so that any
                // async MathQuill edit events triggered by the latex() call above
                // (which MathQuill can fire on a deferred internal setTimeout) are
                // still suppressed before normal user-edit handling resumes.
                setTimeout(function() {
                    prefilling = false;
                    // Final consistency check: if MathQuill is still empty at
                    // this point (e.g. latex() silently failed), try once more.
                    if (initialMaxima && !mqField.latex().trim()) {
                        ctx.dbg('Pre-fill retry for: ' + initialMaxima);
                        prefilling = true;
                        prefill(mqField, initialMaxima,
                            ctx.defs, varMode, ctx.dbg);
                        $input.val(initialMaxima);
                        setTimeout(function() {
                            prefilling = false;
                        }, 0);
                    }
                }, 0);
            }, 0);
        }
    }

    return /** @alias module:local_stackmatheditor/input_fields */ {

        /**
         * Find and init all supported input fields.
         *
         * @param {Object} ctx Shared context.
         */
        init: function(ctx) {
            var $inputs = $(selector());
            if (!$inputs.length) {
                ctx.dbg(
                    'No supported input fields found');
                return;
            }
            ctx.dbg('Found ' + $inputs.length
                + ' input fields');
            $inputs.each(function() {
                initField(this, ctx);
            });
        }
    };
});

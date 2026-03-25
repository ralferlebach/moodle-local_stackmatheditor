/**
 * Single-line MathQuill editor for STACK input fields.
 *
 * Supports: data-stack-input-type="algebraic" and "units".
 *
 * @module     local_stackmatheditor/input_fields
 * @copyright  2026 Ralf Erlebach
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
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

        // Capture the current value BEFORE creating MathField.
        // Reading $input.val() after MathField() risks picking up an empty
        // string if MathQuill's edit handler fires and clears it first.
        var initialMaxima = $input.val();

        // Flag that suppresses syncToInput during the initial pre-fill.
        // Without this, calling mqField.latex(latex) inside prefill triggers
        // the edit handler, which reads mqField.latex() before MathQuill has
        // committed the new content, gets an empty string, and overwrites
        // $input with that empty string — leaving the field blank.
        var prefilling = false;

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

        // Pre-fill after one event-loop tick so MathQuill has finished
        // building its internal DOM before we write content into it.
        if (initialMaxima && initialMaxima.trim()) {
            setTimeout(function() {
                prefilling = true;
                prefill(mqField, initialMaxima,
                    ctx.defs, varMode, ctx.dbg);
                prefilling = false;
                // One explicit sync so $input reflects the pre-filled state.
                syncToInput(mqField, $input, convOpts, ctx.dbg);
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

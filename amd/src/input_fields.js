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

        // Suppress syncToInput while we are writing the initial content into
        // the MathField. Without this flag, mqField.latex(latex) triggers the
        // edit handler synchronously; that handler reads mqField.latex() before
        // MathQuill has committed the new content, gets "", and overwrites
        // $input — leaving the visible field blank on review pages.
        //
        // We set prefilling=true BEFORE MathField() is constructed so that
        // any creation-time edit event from MathQuill is also suppressed.
        var prefilling = (initialMaxima && initialMaxima.trim()) ? true : false;

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

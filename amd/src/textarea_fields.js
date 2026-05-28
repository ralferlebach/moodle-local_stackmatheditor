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
 * Multi-line MathQuill editor for STACK textarea fields.
 *
 * Supports: data-stack-input-type="equiv" and "textarea".
 *
 * @module     local_stackmatheditor/textarea_fields
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

    var TYPES = ['equiv', 'textarea'];

    /**
     * Log a developer debug message for textarea editors.
     *
     * @param {string} msg Debug message.
     */
    function dbg(msg) {
        if (window.M && window.M.cfg && window.M.cfg.developerdebug) {
            window.console.log('[SME-ta] ' + msg);
        }
    }

    /**
     * Inject runtime styles for the textarea-based MathQuill editor.
     */
    function ensureStyles() {
        if (document.getElementById('sme-ta-styles')) {
            return;
        }
        var style = document.createElement('style');
        style.id = 'sme-ta-styles';
        style.textContent = [
            '.sme-equiv-wrap {',
            '  display: block;',
            '  margin: 4px 0;',
            '}',
            '.sme-equiv-rows {',
            '  border: 1px solid #ced4da;',
            '  border-radius: 0 0 4px 4px;',
            '  background: #fff;',
            '  padding: 3px;',
            '  max-height: 500px;',
            '  overflow-y: auto;',
            '}',
            '.sme-equiv-row {',
            '  display: flex;',
            '  align-items: stretch;',
            '  padding: 2px 4px;',
            '  border-bottom: 1px solid #f0f0f0;',
            '}',
            '.sme-equiv-row:last-child {',
            '  border-bottom: none;',
            '}',
            '.sme-equiv-row-active {',
            '  background-color: #e8f0fe;',
            '  border-radius: 3px;',
            '}',
            '.sme-equiv-row:hover {',
            '  background-color: #f5f5f5;',
            '}',
            '.sme-equiv-row-active:hover {',
            '  background-color: #e8f0fe;',
            '}',
            '.sme-equiv-num {',
            '  width: 28px;',
            '  min-width: 28px;',
            '  text-align: right;',
            '  padding-right: 8px;',
            '  color: #999;',
            '  font-size: 0.82em;',
            '  user-select: none;',
            '  flex-shrink: 0;',
            '  align-self: center;',
            '}',
            '.sme-equiv-step {',
            '  flex: 1 1 auto;',
            '  min-width: 100px;',
            '  display: flex;',
            '  align-items: stretch;',
            '  gap: 4px;',
            '}',
            '.sme-equiv-step-main {',
            '  flex: 1 1 auto;',
            '  min-width: 100px;',
            '  display: flex;',
            '  align-items: stretch;',
            '  gap: 4px;',
            '}',
            '.sme-equiv-system-brace {',
            '  display: flex;',
            '  flex: 0 0 16px;',
            '  flex-direction: column;',
            '  justify-content: stretch;',
            '  align-self: stretch;',
            '  width: 16px;',
            '  min-width: 16px;',
            '  margin: 1px 0;',
            '  user-select: none;',
            '  -webkit-user-select: none;',
            '}',
            '.sme-equiv-system-brace::before,',
            '.sme-equiv-system-brace::after {',
            '  content: "";',
            '  display: block;',
            '  width: 12px;',
            '  flex: 0 0 8px;',
            '  border-left: 2px solid #444;',
            '}',
            '.sme-equiv-system-brace::before {',
            '  border-top: 2px solid #444;',
            '  border-top-left-radius: 10px;',
            '}',
            '.sme-equiv-system-brace > span {',
            '  display: block;',
            '  flex: 1 1 auto;',
            '  width: 12px;',
            '  border-left: 2px solid #444;',
            '}',
            '.sme-equiv-system-brace::after {',
            '  border-bottom: 2px solid #444;',
            '  border-bottom-left-radius: 10px;',
            '}',
            '.sme-equiv-step-lines {',
            '  flex: 1 1 auto;',
            '  min-width: 100px;',
            '  display: flex;',
            '  flex-direction: column;',
            '  gap: 1px;',
            '}',
            '.sme-equiv-line {',
            '  display: flex;',
            '  align-items: center;',
            '  gap: 4px;',
            '  padding: 1px 0;',
            '  border-bottom: 1px solid #f0f0f0;',
            '}',
            '.sme-equiv-line:last-child {',
            '  border-bottom: none;',
            '}',
            '.sme-equiv-mqwrap {',
            '  flex: 1 1 auto;',
            '  min-width: 100px;',
            '  cursor: text;',
            '}',
            '.sme-equiv-subdel {',
            '  flex: 0 0 auto;',
            '  min-width: 2rem;',
            '  color: #666;',
            '  text-decoration: none;',
            '  opacity: 0;',
            '  transition: opacity 0.12s;',
            '  align-self: center;',
            '}',
            '.sme-equiv-line:hover .sme-equiv-subdel,',
            '.sme-equiv-line:focus-within .sme-equiv-subdel {',
            '  opacity: 0.5;',
            '}',
            '.sme-equiv-subdel:hover,',
            '.sme-equiv-subdel:focus {',
            '  opacity: 1;',
            '  color: #111;',
            '}',
            '.sme-equiv-step-controls {',
            '  flex: 0 0 auto;',
            '  display: flex;',
            '  align-items: flex-start;',
            '}',
            '.sme-equiv-subadd {',
            '  min-width: 2rem;',
            '}',
            '.sme-equiv-subadd:hover,',
            '.sme-equiv-subadd:focus {',
            '  color: #111;',
            '}',
            '.sme-equiv-del {',
            '  flex: 0 0 auto;',
            '  opacity: 0;',
            '  padding: 0 6px;',
            '  border: none;',
            '  background: none;',
            '  cursor: pointer;',
            '  transition: opacity 0.12s;',
            '  align-self: center;',
            '}',
            '.sme-equiv-row:hover .sme-equiv-del,',
            '.sme-equiv-row:focus-within .sme-equiv-del {',
            '  opacity: 0.5;',
            '}',
            '.sme-equiv-del:hover,',
            '.sme-equiv-del:focus {',
            '  opacity: 1;',
            '}'
        ].join('\n');
        document.head.appendChild(style);
    }

    /**
     * Build the selector for supported textarea input types.
     *
     * @returns {string} Combined textarea selector.
     */
    function selector() {
        return TYPES.map(function(t) {
            return 'textarea[data-stack-input-type="' + t + '"]';
        }).join(',');
    }

    /**
     * Trigger native and jQuery validation events for a textarea.
     *
     * @param {jQuery} $ta Textarea element.
     */
    function triggerStackValidation($ta) {
        $ta.trigger('change');
        $ta.trigger('input');
        $ta.trigger('blur');

        var nativeInput = new Event('input', {
            bubbles: true,
            cancelable: true
        });
        $ta[0].dispatchEvent(nativeInput);

        var nativeChange = new Event('change', {
            bubbles: true,
            cancelable: true
        });
        $ta[0].dispatchEvent(nativeChange);
    }

    /**
     * Check whether a character is a valid boundary for the keyword and.
     *
     * @param {string} ch Character to inspect.
     * @returns {boolean} True when the character is a boundary.
     */
    function isAndBoundaryChar(ch) {
        return !ch || /\s|[(){}\[\],;]/.test(ch);
    }

    /**
     * Split a Maxima expression by top-level and connectors.
     *
     * @param {string} expr Source expression.
     * @returns {string[]} Split top-level parts.
     */
    function splitTopLevelAnd(expr) {
        var parts = [];
        var depth = 0;
        var start = 0;
        var i;
        var prev;
        var next;

        for (i = 0; i < expr.length; i++) {
            if (expr.charAt(i) === '(') {
                depth++;
            } else if (expr.charAt(i) === ')') {
                depth = Math.max(0, depth - 1);
            }

            if (depth === 0 && expr.substr(i, 3) === 'and') {
                prev = i > 0 ? expr.charAt(i - 1) : '';
                next = i + 3 < expr.length ? expr.charAt(i + 3) : '';
                if (isAndBoundaryChar(prev) && isAndBoundaryChar(next)) {
                    parts.push(expr.substring(start, i).trim());
                    start = i + 3;
                    i += 2;
                }
            }
        }

        parts.push(expr.substring(start).trim());
        return parts.filter(function(part) {
            return !!part;
        });
    }

    /**
     * Remove one or more balanced outer parentheses from an expression.
     *
     * @param {string} expr Source expression.
     * @returns {string} Expression without redundant outer parentheses.
     */
    function stripOuterParens(expr) {
        var value = expr.trim();
        var changed = true;
        var depth;
        var i;

        while (changed && value.length >= 2
                && value.charAt(0) === '('
                && value.charAt(value.length - 1) === ')') {
            changed = false;
            depth = 0;
            for (i = 0; i < value.length - 1; i++) {
                if (value.charAt(i) === '(') {
                    depth++;
                } else if (value.charAt(i) === ')') {
                    depth--;
                    if (depth === 0 && i < value.length - 2) {
                        return value;
                    }
                }
            }
            if (depth === 1) {
                value = value.substring(1, value.length - 1).trim();
                changed = true;
            }
        }

        value = value.replace(/^\)+/, '').replace(/\(+$/, '');
        value = value.replace(/^\(+/, '').replace(/\)+$/, '');
        return value.trim();
    }

    /**
     * Check whether an expression contains a top-level relation operator.
     *
     * @param {string} expr Source expression.
     * @returns {boolean} True when a relation operator exists at top level.
     */
    function hasTopLevelRelation(expr) {
        var depth = 0;
        var i;
        var ch;
        var next;

        for (i = 0; i < expr.length; i++) {
            ch = expr.charAt(i);
            next = expr.charAt(i + 1);
            if (ch === '(') {
                depth++;
            } else if (ch === ')') {
                depth = Math.max(0, depth - 1);
            }
            if (depth !== 0) {
                continue;
            }
            if ((ch === '<' || ch === '>' || ch === '~') && next === '=') {
                return true;
            }
            if (ch === '<' || ch === '>' || ch === '=' || ch === '#') {
                return true;
            }
        }
        return false;
    }

    /**
     * Parse a single equivalence-reasoning step into one or more subexpressions.
     *
     * @param {string} raw Raw step value.
     * @returns {string[]} Parsed step values.
     */
    function parseEquivStep(raw) {
        var value = (raw || '').trim();
        var parts;
        if (!value) {
            return [''];
        }
        parts = splitTopLevelAnd(value).map(stripOuterParens).filter(function(part) {
            return !!part;
        });
        if (parts.length > 1 && parts.every(hasTopLevelRelation)) {
            return parts;
        }
        return [value];
    }

    /**
     * Parse the initial textarea value into editor steps.
     *
     * @param {string} value Initial textarea value.
     * @param {string} inputType STACK input type.
     * @returns {string[][]} Parsed editor steps.
     */
    function parseInitialSteps(value, inputType) {
        var raw = (value || '').trim();
        var lines;
        if (!raw) {
            return [['']];
        }
        lines = raw.split('\n').map(function(line) {
            return line.trim();
        });
        if (inputType === 'equiv') {
            return lines.map(parseEquivStep);
        }
        return lines.map(function(line) {
            return [line];
        });
    }

    /**
     * Clone all maxima values from one editor step.
     *
     * @param {Object} step Step data object.
     * @returns {string[]} Cloned maxima values.
     */
    function cloneStepValues(step) {
        return step.fields.map(function(fieldData) {
            return fieldData.maxima || '';
        });
    }

    /**
     * Convert a MathQuill LaTeX string to Maxima.
     *
     * @param {string} latex LaTeX input.
     * @param {Object} convOpts Converter options.
     * @returns {string} Converted Maxima expression.
     */
    function maximaFromLatex(latex, convOpts) {
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
     * Convert a Maxima expression to LaTeX for MathQuill.
     *
     * @param {string} maximaVal Maxima input.
     * @param {Object} defs Function definitions.
     * @param {string} varMode Variable handling mode.
     * @returns {string} Converted LaTeX expression.
     */
    function latexFromMaxima(maximaVal, defs, varMode) {
        if (!maximaVal) {
            return '';
        }
        try {
            return max2tex.convert(maximaVal, {
                defs: defs,
                variableMode: varMode
            });
        } catch (e) {
            dbg('pre-fill error: ' + e.message);
            return maximaVal;
        }
    }

    /**
     * Build a multi-line MathQuill editor for a STACK textarea field.
     *
     * @param {HTMLTextAreaElement} textarea Source textarea.
     * @param {Object} ctx Initialisation context.
     */
    function EquivEditor(textarea, ctx) {
        var $ta = $(textarea);
        var name = $ta.attr('name') || '';

        this.$ta = $ta;
        this.ctx = ctx;
        this.slot = ctx.extractSlot(name);
        this.config = ctx.slotConfigs[this.slot] || ctx.instanceDefaults;
        this.varMode = ctx.slotVarModes[this.slot] || ctx.instanceVarMode;
        this.inputType = $ta.attr('data-stack-input-type') || 'textarea';
        this.commaDecimal = ctx.isCommaDecimal($ta, ctx.localeComma);

        this.convOpts = {
            commaDecimal: this.commaDecimal,
            defs: ctx.defs,
            variableMode: this.varMode
        };

        this.rows = [];
        this.activeStepIdx = 0;
        this.activeFieldIdx = 0;
        this.syncTimer = null;

        dbg('Init: ' + name
            + ' (slot ' + this.slot
            + ', type=' + this.inputType
            + ', varMode=' + this.varMode + ')');

        this.build();
    }

    /**
     * Build the editor DOM and initialise all rows.
     */
    EquivEditor.prototype.build = function() {
        var self = this;
        var startValue;
        var steps;
        var i;

        this.$wrap = $('<div>').addClass('sme-equiv-wrap');
        this.$tb = toolbar.build(function() {
            return self.activeField();
        }, this.config, this.ctx.defs);
        this.$wrap.append(this.$tb);

        this.$rows = $('<div>').addClass('sme-equiv-rows');
        this.$wrap.append(this.$rows);

        this.$addBtn = $('<button>')
            .attr('type', 'button')
            .addClass('btn btn-sm btn-outline-secondary mt-1')
            .html('<i class="fa fa-plus" aria-hidden="true"></i>')
            .attr('title', 'Add line')
            .on('click', function(e) {
                var template;
                e.preventDefault();
                if (self.inputType === 'equiv' && self.rows.length) {
                    template = cloneStepValues(self.rows[self.activeStepIdx] || self.rows[self.rows.length - 1]);
                } else {
                    template = [''];
                }
                self.addStep(template);
                self.focusStep(self.rows.length - 1, 0);
            });
        this.$wrap.append(this.$addBtn);

        startValue = (this.$ta[0].defaultValue || this.$ta.val() || '').trim();
        steps = parseInitialSteps(startValue, this.inputType);
        for (i = 0; i < steps.length; i++) {
            this.addStep(steps[i]);
        }

        this.$ta.before(this.$wrap);
        this.$ta.css({
            'position': 'absolute',
            'left': '-9999px',
            'width': '1px',
            'height': '1px',
            'overflow': 'hidden'
        });
        this.$ta.attr('data-sme-init', '1');

        toolbar.typeset(this.$tb);
        if (this.rows.length > 0) {
            this.focusStep(0, 0);
        }

        dbg('created: ' + this.rows.length + ' steps, id=' + this.$ta.attr('id'));
        this.syncNow();
    };

    /**
     * Get the currently active MathQuill field.
     *
     * @returns {?Object} Active MathQuill field.
     */
    EquivEditor.prototype.activeField = function() {
        var step = this.rows[this.activeStepIdx];
        if (!step) {
            return null;
        }
        if (step.fields[this.activeFieldIdx]) {
            return step.fields[this.activeFieldIdx].mq;
        }
        return step.fields.length ? step.fields[0].mq : null;
    };

    /**
     * Mark the given step and field as active.
     *
     * @param {number} stepIdx Active step index.
     * @param {number} fieldIdx Active field index.
     */
    EquivEditor.prototype.setActive = function(stepIdx, fieldIdx) {
        this.$rows.find('.sme-equiv-row').removeClass('sme-equiv-row-active');
        this.activeStepIdx = stepIdx;
        this.activeFieldIdx = fieldIdx || 0;
        if (this.rows[stepIdx]) {
            this.rows[stepIdx].$row.addClass('sme-equiv-row-active');
        }
    };

    /**
     * Focus a specific field inside a step.
     *
     * @param {number} stepIdx Target step index.
     * @param {number} fieldIdx Target field index.
     */
    EquivEditor.prototype.focusStep = function(stepIdx, fieldIdx) {
        var step = this.rows[stepIdx];
        var targetIdx = fieldIdx || 0;
        if (!step || !step.fields[targetIdx]) {
            return;
        }
        this.setActive(stepIdx, targetIdx);
        step.fields[targetIdx].mq.focus();
    };

    /**
     * Find the step and field index for a MathQuill instance.
     *
     * @param {Object} mq MathQuill field instance.
     * @returns {?Object} Step and field position.
     */
    EquivEditor.prototype.indexOfField = function(mq) {
        var stepIdx;
        var fieldIdx;
        for (stepIdx = 0; stepIdx < this.rows.length; stepIdx++) {
            for (fieldIdx = 0; fieldIdx < this.rows[stepIdx].fields.length; fieldIdx++) {
                if (this.rows[stepIdx].fields[fieldIdx].mq === mq) {
                    return {
                        stepIdx: stepIdx,
                        fieldIdx: fieldIdx
                    };
                }
            }
        }
        return null;
    };


    /**
     * Update controls and brace visibility for one step.
     *
     * @param {Object} stepData Step data object.
     */
    EquivEditor.prototype.updateStepControls = function(stepData) {
        var isSystem = stepData.fields.length > 1;

        if (isSystem) {
            if (!stepData.$brace.parent().length) {
                stepData.$main.prepend(stepData.$brace);
            }
            stepData.$subadd.removeAttr('disabled');
            stepData.fields.forEach(function(fieldData) {
                fieldData.$subdel.css('visibility', 'visible');
            });
        } else {
            stepData.$brace.detach();
            stepData.$subadd.removeAttr('disabled');
            stepData.fields.forEach(function(fieldData) {
                fieldData.$subdel.css('visibility', 'hidden');
            });
        }
    };

    /**
     * Create one MathQuill subrow inside a step.
     *
     * @param {Object} stepData Step data object.
     * @param {string} maximaVal Initial maxima value.
     * @param {number=} fieldIdx Optional insertion index.
     * @returns {Object} Created field data object.
     */
    EquivEditor.prototype.createStepField = function(stepData, maximaVal, fieldIdx) {
        var self = this;
        var $line = $('<div>').addClass('sme-equiv-line');
        var $mqWrap = $('<div>').addClass('sme-equiv-mqwrap');
        var $mqSpan = $('<span>');
        var $subdel = $('<button>')
            .attr('type', 'button')
            .addClass('btn btn-link sme-equiv-subdel')
            .attr('aria-label', 'Remove equation row')
            .attr('title', 'Remove equation row')
            .text('×');
        var mq;
        var fieldData;

        $mqWrap.append($mqSpan);
        $line.append($mqWrap).append($subdel);

        if (typeof fieldIdx === 'number' && fieldIdx < stepData.fields.length) {
            stepData.fields[fieldIdx].$line.before($line);
        } else {
            stepData.$lines.append($line);
        }

        mq = self.ctx.MQ.MathField($mqSpan[0], {
            spaceBehavesLikeTab: true,
            handlers: {
                edit: function() {
                    fieldData.maxima = maximaFromLatex(mq.latex(), self.convOpts);
                    self.debouncedSync();
                },
                enter: function() {
                    var pos = self.indexOfField(mq);
                    var template;
                    if (!pos) {
                        return;
                    }
                    if (self.inputType === 'equiv') {
                        template = cloneStepValues(self.rows[pos.stepIdx]);
                    } else {
                        template = [''];
                    }
                    self.addStep(template, pos.stepIdx + 1);
                    self.focusStep(pos.stepIdx + 1, pos.fieldIdx < template.length ? pos.fieldIdx : 0);
                }
            }
        });

        fieldData = {
            $line: $line,
            $mqWrap: $mqWrap,
            $subdel: $subdel,
            mq: mq,
            maxima: maximaVal || ''
        };

        if (typeof fieldIdx === 'number' && fieldIdx < stepData.fields.length) {
            stepData.fields.splice(fieldIdx, 0, fieldData);
        } else {
            stepData.fields.push(fieldData);
        }

        $mqWrap.on('click', function() {
            mq.focus();
        });
        $mqWrap.on('focusin', function() {
            var pos = self.indexOfField(mq);
            if (pos) {
                self.setActive(pos.stepIdx, pos.fieldIdx);
            }
        });
        $mqWrap.on('keydown', function(e) {
            var pos = self.indexOfField(mq);
            if (!pos) {
                return;
            }
            if (e.key === 'Backspace' && (!mq.latex() || mq.latex().trim() === '')) {
                if (self.rows[pos.stepIdx].fields.length > 1) {
                    e.preventDefault();
                    self.removeField(pos.stepIdx, pos.fieldIdx);
                } else if (self.rows.length > 1) {
                    e.preventDefault();
                    self.removeStep(pos.stepIdx);
                    self.focusStep(Math.max(0, pos.stepIdx - 1), 0);
                }
            }
        });

        $subdel.on('click', function(e) {
            var pos;
            e.preventDefault();
            pos = self.indexOfField(mq);
            if (!pos) {
                return;
            }
            self.removeField(pos.stepIdx, pos.fieldIdx);
        });

        if (maximaVal) {
            mq.latex(latexFromMaxima(maximaVal, self.ctx.defs, self.varMode));
        }

        self.updateStepControls(stepData);
        return fieldData;
    };

    /**
     * Add a new field to an existing step.
     *
     * @param {number} stepIdx Step index.
     * @param {string} maximaVal Initial maxima value.
     * @param {number=} atFieldIdx Optional insertion index.
     * @returns {?Object} Created field data object.
     */
    EquivEditor.prototype.addField = function(stepIdx, maximaVal, atFieldIdx) {
        var stepData = this.rows[stepIdx];
        var fieldData;
        if (!stepData) {
            return null;
        }
        fieldData = this.createStepField(stepData, maximaVal || '', atFieldIdx);
        this.syncNow();
        return fieldData;
    };

    /**
     * Remove a field from an existing step.
     *
     * @param {number} stepIdx Step index.
     * @param {number} fieldIdx Field index.
     */
    EquivEditor.prototype.removeField = function(stepIdx, fieldIdx) {
        var stepData = this.rows[stepIdx];
        var focusIdx;
        if (!stepData || stepData.fields.length <= 1 || fieldIdx < 0 || fieldIdx >= stepData.fields.length) {
            return;
        }
        stepData.fields[fieldIdx].$line.remove();
        stepData.fields.splice(fieldIdx, 1);
        this.updateStepControls(stepData);
        this.syncNow();
        focusIdx = Math.min(fieldIdx, stepData.fields.length - 1);
        this.focusStep(stepIdx, focusIdx);
    };

    /**
     * Add a new editor step.
     *
     * @param {string[]} stepVals Step values.
     * @param {number=} atIdx Optional insertion index.
     */
    EquivEditor.prototype.addStep = function(stepVals, atIdx) {
        var self = this;
        var idx = (typeof atIdx === 'number') ? atIdx : this.rows.length;
        var values = Array.isArray(stepVals) && stepVals.length ? stepVals : [''];
        var $row = $('<div>').addClass('sme-equiv-row');
        var $num = $('<div>').addClass('sme-equiv-num').text(idx + 1);
        var $step = $('<div>').addClass('sme-equiv-step');
        var $main = $('<div>').addClass('sme-equiv-step-main');
        var $brace = $('<div>').addClass('sme-equiv-system-brace')
            .append($('<span>'));
        var $lines = $('<div>').addClass('sme-equiv-step-lines');
        var $stepControls = $('<div>').addClass('sme-equiv-step-controls');
        var $subadd = $('<button>')
            .attr('type', 'button')
            .addClass('btn btn-link sme-equiv-subadd')
            .attr('aria-label', 'Add equation row')
            .attr('title', 'Add equation row')
            .text('+');
        var $del = $('<button>')
            .attr('type', 'button')
            .addClass('sme-equiv-del')
            .html('<i class="fa fa-times text-danger" aria-hidden="true"></i>')
            .attr('title', 'Remove transformation step');
        var stepData = {
            $row: $row,
            $num: $num,
            $step: $step,
            $main: $main,
            $brace: $brace,
            $lines: $lines,
            $subadd: $subadd,
            fields: []
        };

        $stepControls.append($subadd);
        $main.append($lines);
        $step.append($main).append($stepControls);
        $row.append($num).append($step).append($del);

        if (idx < this.rows.length) {
            this.rows[idx].$row.before($row);
        } else {
            this.$rows.append($row);
        }

        values.forEach(function(maximaVal, fieldIdx) {
            self.createStepField(stepData, maximaVal, fieldIdx);
        });

        $subadd.on('click', function(e) {
            var focusField = self.activeStepIdx === self.rows.indexOf(stepData)
                ? self.activeFieldIdx
                : (stepData.fields.length - 1);
            var templateValue = '';
            e.preventDefault();
            if (focusField >= 0 && stepData.fields[focusField]) {
                templateValue = stepData.fields[focusField].maxima || '';
            }
            self.addField(self.rows.indexOf(stepData), templateValue, focusField + 1);
            self.focusStep(self.rows.indexOf(stepData), focusField + 1);
        });

        $del.on('click', function(e) {
            e.preventDefault();
            if (self.rows.length <= 1) {
                return;
            }
            var removeIdx = self.rows.indexOf(stepData);
            self.removeStep(removeIdx);
            self.focusStep(Math.min(removeIdx, self.rows.length - 1), 0);
        });

        if (idx < this.rows.length) {
            this.rows.splice(idx, 0, stepData);
        } else {
            this.rows.push(stepData);
        }

        this.updateStepControls(stepData);
        this.renumber();
    };

    /**
     * Remove an editor step.
     *
     * @param {number} idx Step index to remove.
     */
    EquivEditor.prototype.removeStep = function(idx) {
        if (idx < 0 || idx >= this.rows.length || this.rows.length <= 1) {
            return;
        }
        this.rows[idx].$row.remove();
        this.rows.splice(idx, 1);
        this.renumber();
        this.syncNow();
        dbg('removed step ' + idx + ', ' + this.rows.length + ' left');
    };

    /**
     * Refresh visual step numbering.
     */
    EquivEditor.prototype.renumber = function() {
        var i;
        for (i = 0; i < this.rows.length; i++) {
            this.rows[i].$num.text(i + 1);
        }
    };

    /**
     * Schedule a delayed sync from visible editors to the textarea value.
     */
    EquivEditor.prototype.debouncedSync = function() {
        var self = this;
        if (this.syncTimer) {
            clearTimeout(this.syncTimer);
        }
        this.syncTimer = setTimeout(function() {
            self.syncNow();
        }, 150);
    };

    /**
     * Sync all visible editor rows back into the hidden textarea.
     */
    EquivEditor.prototype.syncNow = function() {
        var self = this;
        var lines = this.rows.map(function(step) {
            var parts = step.fields.map(function(fieldData) {
                fieldData.maxima = maximaFromLatex(fieldData.mq.latex(), self.convOpts);
                return fieldData.maxima;
            });
            if (parts.length > 1) {
                return parts.map(function(part) {
                    return '(' + part + ')';
                }).join(' and ');
            }
            return parts[0] || '';
        });
        var value = lines.join('\n');
        var oldVal = this.$ta.val();
        this.$ta.val(value);
        if (value !== oldVal) {
            triggerStackValidation(this.$ta);
            dbg('sync: ' + lines.length + ' steps');
        }
    };

    return {
        init: function(ctx) {
            ensureStyles();
            var $areas = $(selector());
            if (!$areas.length) {
                ctx.dbg('No supported textareas found');
                return;
            }
            ctx.dbg('Found ' + $areas.length + ' textareas');
            $areas.each(function() {
                if ($(this).attr('data-sme-init') === '1') {
                    return;
                }
                var aname = $(this).attr('name') || '';
                var aslot = ctx.extractSlot(aname);
                if (ctx.slotEnabled && ctx.slotEnabled.hasOwnProperty(aslot) && !ctx.slotEnabled[aslot]) {
                    ctx.dbg('Textarea ' + aname + ' -> slot ' + aslot + ' disabled, skipping');
                    return;
                }
                new EquivEditor(this, ctx);
            });
        }
    };
});

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

    function dbg(msg) {
        if (window.M && window.M.cfg && window.M.cfg.developerdebug) {
            window.console.log('[SME-ta] ' + msg);
        }
    }

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
            '  gap: 6px;',
            '}',
            '.sme-equiv-system-brace {',
            '  width: 10px;',
            '  min-width: 10px;',
            '  border-left: 2px solid #666;',
            '  border-top: 2px solid #666;',
            '  border-bottom: 2px solid #666;',
            '  border-radius: 8px 0 0 8px;',
            '  margin: 2px 0;',
            '}',
            '.sme-equiv-step-lines {',
            '  flex: 1 1 auto;',
            '  min-width: 100px;',
            '  display: flex;',
            '  flex-direction: column;',
            '  gap: 2px;',
            '}',
            '.sme-equiv-line {',
            '  display: block;',
            '}',
            '.sme-equiv-mqwrap {',
            '  min-width: 100px;',
            '  cursor: text;',
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
            '.sme-equiv-row:hover .sme-equiv-del {',
            '  opacity: 0.5;',
            '}',
            '.sme-equiv-del:hover {',
            '  opacity: 1;',
            '}'
        ].join('\n');
        document.head.appendChild(style);
    }

    function selector() {
        return TYPES.map(function(t) {
            return 'textarea[data-stack-input-type="' + t + '"]';
        }).join(',');
    }

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

    function isAndBoundaryChar(ch) {
        return !ch || /\s|[(){}\[\],;]/.test(ch);
    }

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

    function cloneStepValues(step) {
        return step.fields.map(function(fieldData) {
            return fieldData.maxima || '';
        });
    }

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

    EquivEditor.prototype.setActive = function(stepIdx, fieldIdx) {
        this.$rows.find('.sme-equiv-row').removeClass('sme-equiv-row-active');
        this.activeStepIdx = stepIdx;
        this.activeFieldIdx = fieldIdx || 0;
        if (this.rows[stepIdx]) {
            this.rows[stepIdx].$row.addClass('sme-equiv-row-active');
        }
    };

    EquivEditor.prototype.focusStep = function(stepIdx, fieldIdx) {
        var step = this.rows[stepIdx];
        var targetIdx = fieldIdx || 0;
        if (!step || !step.fields[targetIdx]) {
            return;
        }
        this.setActive(stepIdx, targetIdx);
        step.fields[targetIdx].mq.focus();
    };

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

    EquivEditor.prototype.addStep = function(stepVals, atIdx) {
        var self = this;
        var idx = (typeof atIdx === 'number') ? atIdx : this.rows.length;
        var values = Array.isArray(stepVals) && stepVals.length ? stepVals : [''];
        var $row = $('<div>').addClass('sme-equiv-row');
        var $num = $('<div>').addClass('sme-equiv-num').text(idx + 1);
        var $step = $('<div>').addClass('sme-equiv-step');
        var $lines = $('<div>').addClass('sme-equiv-step-lines');
        var $del = $('<button>')
            .attr('type', 'button')
            .addClass('sme-equiv-del')
            .html('<i class="fa fa-times text-danger" aria-hidden="true"></i>')
            .attr('title', 'Remove line');
        var stepData = {
            $row: $row,
            $num: $num,
            $step: $step,
            $lines: $lines,
            fields: []
        };
        var hasSystem = values.length > 1;
        var i;

        if (hasSystem) {
            $step.append($('<div>').addClass('sme-equiv-system-brace'));
        }
        $step.append($lines);
        $row.append($num).append($step).append($del);

        if (idx < this.rows.length) {
            this.rows[idx].$row.before($row);
        } else {
            this.$rows.append($row);
        }

        values.forEach(function(maximaVal, fieldIdx) {
            var $line = $('<div>').addClass('sme-equiv-line');
            var $mqWrap = $('<div>').addClass('sme-equiv-mqwrap');
            var $mqSpan = $('<span>');
            var mq;
            var fieldData;

            $mqWrap.append($mqSpan);
            $line.append($mqWrap);
            $lines.append($line);

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
                mq: mq,
                maxima: maximaVal || ''
            };
            stepData.fields.push(fieldData);

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
                if (e.key === 'Backspace' && (!mq.latex() || mq.latex().trim() === '') && self.rows.length > 1 && self.rows[pos.stepIdx].fields.length === 1) {
                    e.preventDefault();
                    self.removeStep(pos.stepIdx);
                    self.focusStep(Math.max(0, pos.stepIdx - 1), 0);
                }
            });

            if (maximaVal) {
                mq.latex(latexFromMaxima(maximaVal, self.ctx.defs, self.varMode));
            }
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

        this.renumber();
    };

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

    EquivEditor.prototype.renumber = function() {
        var i;
        for (i = 0; i < this.rows.length; i++) {
            this.rows[i].$num.text(i + 1);
        }
    };

    EquivEditor.prototype.debouncedSync = function() {
        var self = this;
        if (this.syncTimer) {
            clearTimeout(this.syncTimer);
        }
        this.syncTimer = setTimeout(function() {
            self.syncNow();
        }, 150);
    };

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

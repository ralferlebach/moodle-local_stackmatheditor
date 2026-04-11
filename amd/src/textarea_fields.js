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
     * Write a developer-level debug message to the browser console.
     *
     * Only active when Moodle developer debug mode is enabled
     * (M.cfg.developerdebug is truthy). Silent on production sites.
     *
     * @param {string} msg Message to log.
     */
    function dbg(msg) {
        if (window.M && window.M.cfg && window.M.cfg.developerdebug) {
            window.console.log('[SME-ta] ' + msg);
        }
    }

    /**
     * Inject minimal container styles.
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
            '  padding: 3px 4px;',
            '  max-height: 500px;',
            '  overflow-y: auto;',
            '}',
            '.sme-equiv-row {',
            '  display: flex;',
            '  align-items: center;',
            '  padding: 1px 4px;',
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
            '}',
            '.sme-equiv-mqwrap {',
            '  flex: 1 1 auto;',
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

    /**
     * Build selector for supported types.
     *
     * @returns {string} Selector.
     */
    function selector() {
        return TYPES.map(function(t) {
            return 'textarea[data-stack-input-type="' + t + '"]';
        }).join(',');
    }

    /**
     * Trigger STACK validation on a textarea.
     *
     * @param {jQuery} $ta Hidden textarea.
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
     * Trim a single pair of outer parentheses when they enclose the full value.
     *
     * @param {string} value Input value.
     * @returns {string} Trimmed value.
     */
    function trimOuterParens(value) {
        var text = (value || '').trim();
        var depth = 0;
        var i;

        if (text.charAt(0) !== '(' || text.charAt(text.length - 1) !== ')') {
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

        return text.substring(1, text.length - 1).trim();
    }

    /**
     * Check whether a character can be part of an identifier.
     *
     * @param {string} ch Character.
     * @returns {boolean} True when identifier-like.
     */
    function isIdentifierChar(ch) {
        return !!ch && /[A-Za-z0-9_]/.test(ch);
    }

    /**
     * Split a top-level expression by the keyword "and".
     *
     * @param {string} expr Expression.
     * @returns {Array} Parts.
     */
    function splitTopLevelAnd(expr) {
        var text = (expr || '').trim();
        var parts = [];
        var depth = 0;
        var start = 0;
        var i;
        var prev;
        var next;

        for (i = 0; i < text.length; i++) {
            if (text.charAt(i) === '(') {
                depth++;
                continue;
            }
            if (text.charAt(i) === ')') {
                depth = Math.max(0, depth - 1);
                continue;
            }
            if (depth !== 0 || text.substr(i, 3) !== 'and') {
                continue;
            }
            prev = i > 0 ? text.charAt(i - 1) : '';
            next = i + 3 < text.length ? text.charAt(i + 3) : '';
            if (isIdentifierChar(prev) || isIdentifierChar(next)) {
                continue;
            }
            parts.push(text.substring(start, i).trim());
            start = i + 3;
            i += 2;
        }

        if (start === 0) {
            return [text];
        }

        parts.push(text.substring(start).trim());
        return parts.filter(function(part) {
            return !!part;
        });
    }

    /**
     * Determine whether an expression contains a top-level relation operator.
     *
     * @param {string} expr Expression.
     * @returns {boolean} True when relation-like.
     */
    function isRelationExpression(expr) {
        var text = trimOuterParens(expr);
        var depth = 0;
        var i;
        var ch;
        var next;

        for (i = 0; i < text.length; i++) {
            ch = text.charAt(i);
            next = text.charAt(i + 1);

            if (ch === '(') {
                depth++;
                continue;
            }
            if (ch === ')') {
                depth = Math.max(0, depth - 1);
                continue;
            }
            if (depth !== 0) {
                continue;
            }
            if (ch === '=') {
                return true;
            }
            if (ch === '#' || ch === '<' || ch === '>') {
                return true;
            }
            if (ch === '~' && next === '=') {
                return true;
            }
        }

        return false;
    }

    /**
     * Convert an initial textarea value into row values.
     *
     * @param {string} value Raw textarea value.
     * @param {string} inputType STACK input type.
     * @returns {Array} Row maxima strings.
     */
    function splitInitialRows(value, inputType) {
        var text = (value || '').trim();
        var parts;

        if (!text) {
            return [''];
        }

        if (text.indexOf('\n') !== -1 || inputType !== 'equiv') {
            return text.split('\n').map(function(line) {
                return line.trim();
            });
        }

        parts = splitTopLevelAnd(text);
        if (parts.length > 1 && parts.every(isRelationExpression)) {
            return parts.map(function(part) {
                return trimOuterParens(part);
            });
        }

        return [text];
    }

    // ── EquivEditor ─────────────────────────────────

    /**
     * Multi-line editor for one textarea.
     *
     * @param {HTMLTextAreaElement} textarea Original.
     * @param {Object} ctx Shared context.
     * @constructor
     */
    function EquivEditor(textarea, ctx) {
        var $ta = $(textarea);
        var name = $ta.attr('name') || '';

        this.$ta = $ta;
        this.ctx = ctx;
        this.inputType = $ta.attr('data-stack-input-type') || 'textarea';
        this.slot = ctx.extractSlot(name);
        this.config = ctx.slotConfigs[this.slot] || ctx.instanceDefaults;
        this.varMode = ctx.slotVarModes[this.slot] || ctx.instanceVarMode;
        this.commaDecimal = ctx.isCommaDecimal($ta, ctx.localeComma);

        this.convOpts = {
            commaDecimal: this.commaDecimal,
            defs: ctx.defs,
            variableMode: this.varMode
        };

        this.rows = [];
        this.activeIdx = 0;
        this.syncTimer = null;

        dbg('Init: ' + name + ' (slot ' + this.slot + ', type=' + this.inputType + ', varMode=' + this.varMode + ')');

        this.build();
    }

    /**
     * Build editor DOM.
     */
    EquivEditor.prototype.build = function() {
        var self = this;
        var initialValue;
        var lines;
        var i;

        this.$wrap = $('<div>').addClass('sme-equiv-wrap');

        this.$tb = toolbar.build(
            function() {
                return self.activeField();
            },
            this.config,
            this.ctx.defs
        );
        this.$wrap.append(this.$tb);

        this.$rows = $('<div>').addClass('sme-equiv-rows');
        this.$wrap.append(this.$rows);

        this.$addBtn = $('<button>')
            .attr('type', 'button')
            .addClass('btn btn-sm btn-outline-secondary mt-1')
            .html('<i class="fa fa-plus" aria-hidden="true"></i>')
            .attr('title', 'Add line')
            .on('click', function(e) {
                var seed = '';
                e.preventDefault();
                if (self.inputType === 'equiv' && self.rows.length > 0) {
                    seed = self.rows[self.rows.length - 1].maxima || '';
                }
                self.addRow(seed);
                self.focusRow(self.rows.length - 1);
            });
        this.$wrap.append(this.$addBtn);

        initialValue = this.$ta[0].defaultValue || this.$ta.val() || '';
        lines = splitInitialRows(initialValue, this.inputType);
        for (i = 0; i < lines.length; i++) {
            this.addRow(lines[i]);
        }

        this.$ta.before(this.$wrap);
        this.$ta.css({
            position: 'absolute',
            left: '-9999px',
            width: '1px',
            height: '1px',
            overflow: 'hidden'
        });
        this.$ta.attr('data-sme-init', '1');

        toolbar.typeset(this.$tb);

        if (this.rows.length > 0) {
            this.focusRow(0);
        }

        dbg('created: ' + this.rows.length + ' rows, id=' + this.$ta.attr('id') + ', initial="' + initialValue + '"');
    };

    /**
     * Return active MQ field.
     *
     * @returns {Object|null} MQ field.
     */
    EquivEditor.prototype.activeField = function() {
        if (this.activeIdx >= 0 && this.activeIdx < this.rows.length) {
            return this.rows[this.activeIdx].mq;
        }
        return this.rows.length > 0 ? this.rows[0].mq : null;
    };

    /**
     * Set active row.
     *
     * @param {number} idx Row index.
     */
    EquivEditor.prototype.setActive = function(idx) {
        this.$rows.find('.sme-equiv-row').removeClass('sme-equiv-row-active');
        this.activeIdx = idx;
        if (idx >= 0 && idx < this.rows.length) {
            this.rows[idx].$row.addClass('sme-equiv-row-active');
        }
    };

    /**
     * Focus a row.
     *
     * @param {number} idx Row index.
     */
    EquivEditor.prototype.focusRow = function(idx) {
        if (idx >= 0 && idx < this.rows.length) {
            this.setActive(idx);
            this.rows[idx].mq.focus();
        }
    };

    /**
     * Find row by MQ field.
     *
     * @param {Object} mq MathQuill field.
     * @returns {number} Index or -1.
     */
    EquivEditor.prototype.indexOf = function(mq) {
        var i;
        for (i = 0; i < this.rows.length; i++) {
            if (this.rows[i].mq === mq) {
                return i;
            }
        }
        return -1;
    };

    /**
     * Add a row.
     *
     * @param {string} maximaVal Initial value.
     * @param {number} [atIdx] Position.
     */
    EquivEditor.prototype.addRow = function(maximaVal, atIdx) {
        var self = this;
        var idx = (typeof atIdx === 'number') ? atIdx : this.rows.length;
        var $row = $('<div>').addClass('sme-equiv-row');
        var $num = $('<div>').addClass('sme-equiv-num').text(idx + 1);
        var $mqWrap = $('<div>').addClass('sme-equiv-mqwrap');
        var $mqSpan = $('<span>');
        var $del = $('<button>')
            .attr('type', 'button')
            .addClass('sme-equiv-del')
            .html('<i class="fa fa-times text-danger" aria-hidden="true"></i>')
            .attr('title', 'Remove line');
        var mq;
        var rowData;

        $mqWrap.append($mqSpan);
        $row.append($num).append($mqWrap).append($del);

        if (idx < this.rows.length) {
            this.rows[idx].$row.before($row);
        } else {
            this.$rows.append($row);
        }

        mq = this.ctx.MQ.MathField($mqSpan[0], {
            spaceBehavesLikeTab: true,
            handlers: {
                edit: function() {
                    rowData.maxima = self.maximaFromField(mq);
                    self.debouncedSync();
                },
                enter: function() {
                    var i = self.indexOf(mq);
                    var seed = '';
                    if (i >= 0) {
                        if (self.inputType === 'equiv') {
                            seed = self.rows[i].maxima || self.maximaFromField(mq);
                        }
                        self.addRow(seed, i + 1);
                        self.focusRow(i + 1);
                    }
                }
            }
        });

        rowData = {
            $row: $row,
            $num: $num,
            $mqWrap: $mqWrap,
            mq: mq,
            maxima: maximaVal || ''
        };

        if (idx < this.rows.length) {
            this.rows.splice(idx, 0, rowData);
        } else {
            this.rows.push(rowData);
        }

        $mqWrap.on('click', function() {
            mq.focus();
        });

        $mqWrap.on('focusin', function() {
            self.setActive(self.indexOf(mq));
        });

        $mqWrap.on('keydown', function(e) {
            var i;
            if (e.key === 'Backspace' && (!mq.latex() || mq.latex().trim() === '') && self.rows.length > 1) {
                e.preventDefault();
                i = self.indexOf(mq);
                self.removeRow(i);
                self.focusRow(Math.max(0, i - 1));
            }
        });

        $del.on('click', function(e) {
            var i;
            e.preventDefault();
            if (self.rows.length <= 1) {
                return;
            }
            i = self.indexOf(mq);
            self.removeRow(i);
            self.focusRow(Math.min(i, self.rows.length - 1));
        });

        if (maximaVal) {
            try {
                mq.latex(max2tex.convert(maximaVal, {
                    defs: self.ctx.defs,
                    variableMode: self.varMode
                }));
            } catch (ex) {
                dbg('pre-fill error: ' + ex.message);
                mq.latex(maximaVal);
            }
            rowData.maxima = self.maximaFromField(mq) || maximaVal;
            dbg('row ' + idx + ': "' + maximaVal + '"');
        }

        this.renumber();
    };

    /**
     * Remove a row.
     *
     * @param {number} idx Row index.
     */
    EquivEditor.prototype.removeRow = function(idx) {
        if (idx < 0 || idx >= this.rows.length || this.rows.length <= 1) {
            return;
        }
        this.rows[idx].$row.remove();
        this.rows.splice(idx, 1);
        this.renumber();
        this.syncNow();
        dbg('removed row ' + idx + ', ' + this.rows.length + ' left');
    };

    /**
     * Update line numbers.
     */
    EquivEditor.prototype.renumber = function() {
        var i;
        for (i = 0; i < this.rows.length; i++) {
            this.rows[i].$num.text(i + 1);
        }
    };

    /**
     * Convert a MathQuill row to Maxima.
     *
     * @param {Object} mq MathQuill field.
     * @returns {string} Maxima representation.
     */
    EquivEditor.prototype.maximaFromField = function(mq) {
        var latex = mq.latex();

        if (!latex || !latex.trim()) {
            return '';
        }

        try {
            return tex2max.convert(latex, this.convOpts);
        } catch (e) {
            return latex;
        }
    };

    /**
     * Debounced sync.
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
     * Sync all rows to hidden textarea.
     */
    EquivEditor.prototype.syncNow = function() {
        var lines = [];
        var i;
        var value;
        var oldVal;

        for (i = 0; i < this.rows.length; i++) {
            this.rows[i].maxima = this.maximaFromField(this.rows[i].mq);
            lines.push(this.rows[i].maxima);
        }

        value = lines.join('\n');
        oldVal = this.$ta.val();
        this.$ta.val(value);

        if (value !== oldVal) {
            triggerStackValidation(this.$ta);
            dbg('sync: ' + lines.length + ' lines');
        }
    };

    return /** @alias module:local_stackmatheditor/textarea_fields */ {

        /**
         * Find and init all supported textareas.
         *
         * @param {Object} ctx Shared context.
         */
        init: function(ctx) {
            ensureStyles();

            $(selector()).each(function() {
                var $ta = $(this);
                var name = $ta.attr('name') || '';
                var slot = ctx.extractSlot(name);

                if ($ta.attr('data-sme-init') === '1') {
                    return;
                }

                if (ctx.slotEnabled && Object.prototype.hasOwnProperty.call(ctx.slotEnabled, slot) && !ctx.slotEnabled[slot]) {
                    ctx.dbg('Textarea ' + name + ' -> slot ' + slot + ' disabled, skipping');
                    return;
                }

                new EquivEditor(this, ctx);
            });
        }
    };
});

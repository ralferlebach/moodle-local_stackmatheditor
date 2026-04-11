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
            '  padding: 3px;',
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
            return 'textarea[data-stack-input-type="'
                + t + '"]';
        }).join(',');
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
     * Trigger STACK validation on a textarea.
     *
     * @param {jQuery} $ta Hidden textarea.
     */
    function triggerStackValidation($ta) {
        $ta.trigger('change');
        $ta.trigger('input');
        $ta.trigger('blur');

        var nativeInput = new Event('input', {
            bubbles: true, cancelable: true
        });
        $ta[0].dispatchEvent(nativeInput);

        var nativeChange = new Event('change', {
            bubbles: true, cancelable: true
        });
        $ta[0].dispatchEvent(nativeChange);
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
        this.slot = ctx.extractSlot(name);
        this.config = ctx.slotConfigs[this.slot]
            || ctx.instanceDefaults;
        this.varMode = ctx.slotVarModes[this.slot]
            || ctx.instanceVarMode;
        this.commaDecimal = ctx.isCommaDecimal(
            $ta, ctx.localeComma);

        this.convOpts = {
            commaDecimal: this.commaDecimal,
            defs: ctx.defs,
            variableMode: this.varMode
        };

        this.rows = [];
        this.activeIdx = 0;
        this.syncTimer = null;
        this.inputType = $ta.attr('data-stack-input-type') || 'textarea';

        dbg('Init: ' + name
            + ' (slot ' + this.slot
            + ', varMode=' + this.varMode + ')');

        this.build();
    }

    /**
     * Build editor DOM.
     */
    EquivEditor.prototype.build = function() {
        var self = this;

        this.$wrap = $('<div>')
            .addClass('sme-equiv-wrap');

        this.$tb = toolbar.build(
            function() { return self.activeField(); },
            this.config,
            this.ctx.defs
        );
        this.$wrap.append(this.$tb);

        this.$rows = $('<div>')
            .addClass('sme-equiv-rows');
        this.$wrap.append(this.$rows);

        this.$addBtn = $('<button>')
            .attr('type', 'button')
            .addClass(
                'btn btn-sm btn-outline-secondary mt-1')
            .html(
                '<i class="fa fa-plus"'
                + ' aria-hidden="true"></i>')
            .attr('title', 'Add line')
            .on('click', function(e) {
                var seed = self.getAppendSeed();
                e.preventDefault();
                self.addRow(seed.maxima, undefined, seed.latex);
                self.focusRow(self.rows.length - 1);
            });
        this.$wrap.append(this.$addBtn);

        var val = this.$ta.val().trim();
        var relationparts = null;
        var lines;
        var i;

        if (this.inputType === 'equiv' && val.indexOf('\n') === -1) {
            relationparts = getRelationSystemParts(val);
        }

        if (relationparts && relationparts.length) {
            lines = relationparts;
            dbg('equiv relation system detected: ' + lines.length + ' rows');
        } else {
            lines = val ? val.split('\n') : [''];
        }

        for (i = 0; i < lines.length; i++) {
            this.addRow(lines[i].trim());
        }

        // Insert BEFORE textarea — keep textarea in
        // its original DOM position for STACK feedback.
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
            this.focusRow(0);
        }

        dbg('created: ' + this.rows.length
            + ' rows, id=' + this.$ta.attr('id'));
    };

    /**
     * Return active MQ field.
     *
     * @returns {Object|null} MQ field.
     */
    EquivEditor.prototype.activeField = function() {
        if (this.activeIdx >= 0
            && this.activeIdx < this.rows.length) {
            return this.rows[this.activeIdx].mq;
        }
        return this.rows.length > 0
            ? this.rows[0].mq : null;
    };

    /**
     * Set active row.
     *
     * @param {number} idx Row index.
     */
    EquivEditor.prototype.setActive = function(idx) {
        this.$rows.find('.sme-equiv-row')
            .removeClass('sme-equiv-row-active');
        this.activeIdx = idx;
        if (idx >= 0 && idx < this.rows.length) {
            this.rows[idx].$row
                .addClass('sme-equiv-row-active');
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
     * Determine whether new rows should clone the previous expression.
     *
     * @returns {boolean} True for equivalence reasoning.
     */
    EquivEditor.prototype.shouldClonePreviousRow = function() {
        return this.inputType === 'equiv';
    };

    /**
     * Build seed data for inserting a row after one index.
     *
     * @param {number} idx Current row index.
     * @returns {{maxima: string, latex: string}} Seed values.
     */
    EquivEditor.prototype.getInsertSeed = function(idx) {
        var row;
        if (!this.shouldClonePreviousRow() || idx < 0 || idx >= this.rows.length) {
            return {
                maxima: '',
                latex: ''
            };
        }
        row = this.rows[idx];
        return {
            maxima: '',
            latex: row.mq.latex() || ''
        };
    };

    /**
     * Build seed data for appending a row.
     *
     * @returns {{maxima: string, latex: string}} Seed values.
     */
    EquivEditor.prototype.getAppendSeed = function() {
        if (!this.rows.length) {
            return {
                maxima: '',
                latex: ''
            };
        }
        return this.getInsertSeed(this.rows.length - 1);
    };

    /**
     * Add a row.
     *
     * @param {string} maximaVal Initial maxima value.
     * @param {number} [atIdx] Position.
     * @param {string} [latexVal] Initial LaTeX value.
     */
    EquivEditor.prototype.addRow = function(
        maximaVal, atIdx, latexVal) {
        var self = this;
        var idx = (typeof atIdx === 'number')
            ? atIdx : this.rows.length;

        var $row = $('<div>')
            .addClass('sme-equiv-row');
        var $num = $('<div>')
            .addClass('sme-equiv-num')
            .text(idx + 1);
        var $mqWrap = $('<div>')
            .addClass('sme-equiv-mqwrap');
        var $mqSpan = $('<span>');
        $mqWrap.append($mqSpan);

        var $del = $('<button>')
            .attr('type', 'button')
            .addClass('sme-equiv-del')
            .html(
                '<i class="fa fa-times text-danger"'
                + ' aria-hidden="true"></i>')
            .attr('title', 'Remove line');

        $row.append($num).append($mqWrap).append($del);

        if (idx < this.rows.length) {
            this.rows[idx].$row.before($row);
        } else {
            this.$rows.append($row);
        }

        var mq = this.ctx.MQ.MathField($mqSpan[0], {
            spaceBehavesLikeTab: true,
            handlers: {
                edit: function() {
                    self.debouncedSync();
                },
                enter: function() {
                    var i = self.indexOf(mq);
                    if (i >= 0) {
                        var seed = self.getInsertSeed(i);
                        self.addRow(seed.maxima, i + 1, seed.latex);
                        self.focusRow(i + 1);
                    }
                }
            }
        });

        $mqWrap.on('click', function() {
            mq.focus();
        });

        var rowData = {
            $row: $row,
            $num: $num,
            $mqWrap: $mqWrap,
            mq: mq
        };

        if (idx < this.rows.length) {
            this.rows.splice(idx, 0, rowData);
        } else {
            this.rows.push(rowData);
        }

        $mqWrap.on('focusin', function() {
            self.setActive(self.indexOf(mq));
        });

        $mqWrap.on('keydown', function(e) {
            if (e.key === 'Backspace'
                && (!mq.latex()
                    || mq.latex().trim() === '')
                && self.rows.length > 1) {
                e.preventDefault();
                var i = self.indexOf(mq);
                self.removeRow(i);
                self.focusRow(Math.max(0, i - 1));
            }
        });

        $del.on('click', function(e) {
            e.preventDefault();
            if (self.rows.length <= 1) {
                return;
            }
            var i = self.indexOf(mq);
            self.removeRow(i);
            self.focusRow(
                Math.min(i, self.rows.length - 1));
        });

        if (typeof latexVal === 'string' && latexVal.trim()) {
            mq.latex(latexVal);
            dbg('row ' + idx + ': cloned LaTeX="'
                + latexVal + '"');
        } else if (maximaVal) {
            try {
                var latex = max2tex.convert(maximaVal, {
                    defs: self.ctx.defs,
                    variableMode: self.varMode
                });
                mq.latex(latex);
                dbg('row ' + idx + ': "'
                    + maximaVal + '" -> "'
                    + latex + '"');
            } catch (ex) {
                dbg('pre-fill error: ' + ex.message);
                mq.latex(maximaVal);
            }
        }

        this.renumber();
    };

    /**
     * Remove a row.
     *
     * @param {number} idx Row index.
     */
    EquivEditor.prototype.removeRow = function(idx) {
        if (idx < 0 || idx >= this.rows.length
            || this.rows.length <= 1) {
            return;
        }
        this.rows[idx].$row.remove();
        this.rows.splice(idx, 1);
        this.renumber();
        this.syncNow();
        dbg('removed row ' + idx
            + ', ' + this.rows.length + ' left');
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
        var self = this;
        var i;
        var latex;
        var maxima;

        for (i = 0; i < this.rows.length; i++) {
            latex = this.rows[i].mq.latex();
            maxima = '';
            if (latex && latex.trim()) {
                try {
                    maxima = tex2max.convert(
                        latex, self.convOpts);
                } catch (e) {
                    maxima = latex;
                }
            }
            lines.push(maxima);
        }

        var value = lines.join('\n');
        var oldVal = this.$ta.val();
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
            var $areas = $(selector());
            if (!$areas.length) {
                ctx.dbg(
                    'No supported textareas found');
                return;
            }
            ctx.dbg('Found ' + $areas.length
                + ' textareas');
            $areas.each(function() {
                if ($(this).attr('data-sme-init')
                    === '1') {
                    return;
                }
                // Check per-slot enabled map before activating.
                var aname = $(this).attr('name') || '';
                var aslot = ctx.extractSlot(aname);
                if (ctx.slotEnabled
                        && ctx.slotEnabled.hasOwnProperty(aslot)
                        && !ctx.slotEnabled[aslot]) {
                    ctx.dbg('Textarea ' + aname
                        + ' -> slot ' + aslot
                        + ' disabled, skipping');
                    return;
                }
                new EquivEditor(this, ctx);
            });
        }
    };
});

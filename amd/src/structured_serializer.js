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
 * Serializer between the structured model and Maxima syntax (#62).
 *
 * Matrices are canonically matrix([a,b],[c,d]). A vector uses the same call, because that is
 * what STACK questions compare against; the plugin setting "vectorformat" can write a list
 * instead, which is the documented alternative representation. Either way the decision is made
 * here and nowhere else.
 *
 * Parsing is done by walking the string with a bracket counter, not by a global regular
 * expression: cells contain commas, brackets and nested matrices.
 *
 * @module     local_stackmatheditor/structured_serializer
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
define(['local_stackmatheditor/structured_input'], function(Model) {
    'use strict';

    /**
     * Split a comma-separated argument list at depth zero.
     *
     * @param {string} s Argument list without the enclosing brackets.
     * @returns {Array} Arguments, untrimmed.
     */
    function splitTopLevel(s) {
        var parts = [];
        var depth = 0;
        var current = '';
        var i;
        var ch;

        for (i = 0; i < s.length; i++) {
            ch = s.charAt(i);
            if (ch === '(' || ch === '[' || ch === '{') {
                depth++;
            } else if (ch === ')' || ch === ']' || ch === '}') {
                depth--;
            }
            if (ch === ',' && depth === 0) {
                parts.push(current);
                current = '';
                continue;
            }
            current += ch;
        }
        parts.push(current);

        return parts;
    }

    /**
     * Find the closing bracket matching the opening one at the given position.
     *
     * @param {string} s Input.
     * @param {number} open Index of the opening bracket.
     * @returns {number} Index of the closing bracket, or -1.
     */
    function findClose(s, open) {
        var depth = 0;
        var i;
        var ch;

        for (i = open; i < s.length; i++) {
            ch = s.charAt(i);
            if (ch === '(' || ch === '[') {
                depth++;
            } else if (ch === ')' || ch === ']') {
                depth--;
                if (depth === 0) {
                    return i;
                }
            }
        }

        return -1;
    }

    /**
     * Serialize a structured model to Maxima.
     *
     * @param {Object} model Structured model.
     * @param {Object} options Conversion options; options.defs.vectorFormat may be "list".
     * @returns {string} Maxima expression.
     */
    function toMaxima(model, options) {
        var defs = (options || {}).defs || {};
        var rows;

        if (!Model.isValid(model)) {
            throw new Error('local_stackmatheditor: cannot serialize an invalid model');
        }

        if (model.type === 'vector' && defs.vectorFormat === 'list') {
            return '[' + model.elements.join(',') + ']';
        }

        if (model.type === 'vector') {
            rows = model.orientation === 'row'
                ? ['[' + model.elements.join(',') + ']']
                : model.elements.map(function(element) {
                    return '[' + element + ']';
                });
            return 'matrix(' + rows.join(',') + ')';
        }

        rows = model.rows.map(function(row) {
            return '[' + row.join(',') + ']';
        });

        return 'matrix(' + rows.join(',') + ')';
    }

    /**
     * Read a Maxima expression back into a structured model.
     *
     * Returns null when the expression is not a structure this module owns. The caller then
     * keeps the generic editor behaviour rather than discarding anything (#62 §13).
     *
     * @param {string} maxima Maxima expression.
     * @returns {?Object} Structured model or null.
     */
    function fromMaxima(maxima) {
        var s = typeof maxima === 'string' ? maxima.trim() : '';
        var open;
        var close;
        var args;
        var rows = [];
        var columns = -1;
        var cells;
        var i;
        var j;
        var model;

        if (s.indexOf('[') === 0 && findClose(s, 0) === s.length - 1) {
            // A plain list is the alternative vector representation.
            cells = splitTopLevel(s.substring(1, s.length - 1)).map(function(cell) {
                return cell.trim();
            });
            if (!cells.length || cells.some(function(cell) {
                return cell === '' || cell.indexOf('[') !== -1;
            })) {
                return null;
            }
            model = Model.createVector(cells.length, 'row');
            model.elements = cells;
            return Model.isValid(model) ? model : null;
        }

        if (s.indexOf('matrix(') !== 0) {
            return null;
        }

        open = 'matrix'.length;
        close = findClose(s, open);
        if (close !== s.length - 1) {
            return null;
        }

        args = splitTopLevel(s.substring(open + 1, close));
        for (i = 0; i < args.length; i++) {
            s = args[i].trim();
            if (s.charAt(0) !== '[' || s.charAt(s.length - 1) !== ']') {
                return null;
            }
            cells = splitTopLevel(s.substring(1, s.length - 1)).map(function(cell) {
                return cell.trim();
            });
            if (columns === -1) {
                columns = cells.length;
            } else if (cells.length !== columns) {
                return null;
            }
            rows.push(cells);
        }

        if (!rows.length || columns < 1) {
            return null;
        }

        // A single row or a single column is read back as a vector: that is what the editor
        // offers, and matrix([a],[b]) is how it wrote one.
        if (rows.length === 1 && columns > 1) {
            model = Model.createVector(columns, 'row');
            model.elements = rows[0];
            return Model.isValid(model) ? model : null;
        }
        if (columns === 1 && rows.length > 1) {
            model = Model.createVector(rows.length, 'column');
            model.elements = rows.map(function(row) {
                return row[0];
            });
            return Model.isValid(model) ? model : null;
        }

        model = Model.createMatrix(rows.length, columns);
        for (i = 0; i < rows.length; i++) {
            for (j = 0; j < columns; j++) {
                model.rows[i][j] = rows[i][j];
            }
        }

        return Model.isValid(model) ? model : null;
    }

    return /** @alias module:local_stackmatheditor/structured_serializer */ {
        toMaxima: toMaxima,
        fromMaxima: fromMaxima,
        splitTopLevel: splitTopLevel
    };
});

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
 * Toolbar popups for matrix and vector dimensions (#62).
 *
 * The matrix popup is the grid known from office applications: moving over a cell highlights
 * the block from (1,1) to that cell, and the chosen size is also written out as text, because
 * a colour alone is not an answer for anyone using a screen reader.
 *
 * Everything is reachable from the keyboard: arrow keys move, Enter confirms, Escape closes and
 * returns the focus to the button that opened the popup.
 *
 * The popup only produces a structured model. Inserting it is the caller's job.
 *
 * @module     local_stackmatheditor/structured_popup
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
define(['local_stackmatheditor/structured_input'], function(Model) {
    'use strict';

    /**
     * Currently open popup, so a second click closes the first one.
     *
     * @type {?Object}
     */
    var openPopup = null;

    /**
     * Strings the popup shows. Replaced by the caller with language pack values.
     *
     * @type {Object}
     */
    var strings = {
        matrixTitle: 'Matrix',
        vectorTitle: 'Vector',
        size: '{a} × {b} matrix',
        dimension: 'Dimension',
        orientation: 'Orientation',
        rowVector: 'Row vector',
        columnVector: 'Column vector',
        vectorSize: '{a}-dimensional {b}'
    };

    /**
     * Replace the {a} and {b} placeholders in a string.
     *
     * @param {string} template Template.
     * @param {string|number} a First value.
     * @param {string|number} b Second value.
     * @returns {string} Filled template.
     */
    function format(template, a, b) {
        return String(template).replace('{a}', a).replace('{b}', b);
    }

    /**
     * Close whatever popup is open.
     *
     * @param {boolean} restoreFocus Move the focus back to the opening button.
     */
    function close(restoreFocus) {
        if (!openPopup) {
            return;
        }

        var popup = openPopup;
        openPopup = null;

        if (popup.element && popup.element.parentNode) {
            popup.element.parentNode.removeChild(popup.element);
        }
        document.removeEventListener('mousedown', popup.onOutside, true);
        document.removeEventListener('keydown', popup.onEscape, true);
        if (popup.owner) {
            popup.owner.setAttribute('aria-expanded', 'false');
            if (restoreFocus && typeof popup.owner.focus === 'function') {
                popup.owner.focus();
            }
        }
    }

    /**
     * Place the popup below its button.
     *
     * @param {HTMLElement} element Popup element.
     * @param {HTMLElement} owner Button.
     */
    function position(element, owner) {
        var box = owner.getBoundingClientRect ? owner.getBoundingClientRect() : null;

        element.style.position = 'absolute';
        element.style.zIndex = '1051';
        if (box) {
            element.style.left = (box.left + window.pageXOffset) + 'px';
            element.style.top = (box.bottom + window.pageYOffset + 2) + 'px';
        }
    }

    /**
     * Register the shared close handlers and remember the popup.
     *
     * @param {HTMLElement} element Popup element.
     * @param {HTMLElement} owner Button.
     */
    function register(element, owner) {
        var popup = {element: element, owner: owner};

        popup.onOutside = function(e) {
            if (!element.contains(e.target) && e.target !== owner) {
                close(false);
            }
        };
        popup.onEscape = function(e) {
            if (e.key === 'Escape' || e.key === 'Esc') {
                e.preventDefault();
                close(true);
            }
        };

        document.addEventListener('mousedown', popup.onOutside, true);
        document.addEventListener('keydown', popup.onEscape, true);
        openPopup = popup;
        owner.setAttribute('aria-expanded', 'true');
    }

    /**
     * Open the matrix grid popup.
     *
     * @param {HTMLElement} owner Button that opens the popup.
     * @param {Function} onChoose Called with the structured model.
     * @param {?Object} current Size of the structure being changed, or null for a new one.
     * @returns {HTMLElement} The popup element.
     */
    function openMatrixGrid(owner, onChoose, current) {
        var size = Model.QUICK_PICK_SIZE;
        var element = document.createElement('div');
        var grid = document.createElement('div');
        var label = document.createElement('div');
        var cells = [];
        var selected = {rows: 1, columns: 1};
        var rowElement;
        var cell;
        var r;
        var c;

        close(false);

        element.className = 'sme-structured-popup sme-matrix-popup';
        element.setAttribute('role', 'dialog');
        element.setAttribute('aria-label', strings.matrixTitle);

        grid.className = 'sme-matrix-grid';
        grid.setAttribute('role', 'grid');
        grid.setAttribute('aria-label', strings.matrixTitle);

        label.className = 'sme-structured-popup-label';
        label.setAttribute('aria-live', 'polite');

        /**
         * Highlight the block from (1,1) to the given cell and announce its size.
         *
         * @param {number} rows Row count.
         * @param {number} columns Column count.
         */
        function highlight(rows, columns) {
            selected = {rows: rows, columns: columns};
            cells.forEach(function(cell) {
                var inside = Number(cell.dataset.row) <= rows
                    && Number(cell.dataset.column) <= columns;
                cell.classList.toggle('sme-selected', inside);
                cell.setAttribute('aria-selected', inside ? 'true' : 'false');
                cell.tabIndex = (Number(cell.dataset.row) === rows
                    && Number(cell.dataset.column) === columns) ? 0 : -1;
            });
            label.textContent = format(strings.size, rows, columns);
        }

        /**
         * Confirm the current selection.
         */
        function confirm() {
            var model = Model.createMatrix(selected.rows, selected.columns);
            close(false);
            onChoose(model);
        }

        for (r = 1; r <= size; r++) {
            rowElement = document.createElement('div');
            rowElement.className = 'sme-matrix-grid-row';
            rowElement.setAttribute('role', 'row');
            for (c = 1; c <= size; c++) {
                cell = document.createElement('button');
                cell.type = 'button';
                cell.className = 'sme-matrix-grid-cell';
                cell.setAttribute('role', 'gridcell');
                cell.dataset.row = r;
                cell.dataset.column = c;
                cell.tabIndex = -1;
                cell.setAttribute('aria-label', format(strings.size, r, c));
                cell.addEventListener('mouseenter', function() {
                    highlight(Number(this.dataset.row), Number(this.dataset.column));
                });
                cell.addEventListener('focus', function() {
                    highlight(Number(this.dataset.row), Number(this.dataset.column));
                });
                cell.addEventListener('click', function(e) {
                    e.preventDefault();
                    highlight(Number(this.dataset.row), Number(this.dataset.column));
                    confirm();
                });
                cells.push(cell);
                rowElement.appendChild(cell);
            }
            grid.appendChild(rowElement);
        }

        grid.addEventListener('keydown', function(e) {
            var rows = selected.rows;
            var columns = selected.columns;
            var handled = true;

            switch (e.key) {
                case 'ArrowRight':
                    columns = Math.min(size, columns + 1);
                    break;
                case 'ArrowLeft':
                    columns = Math.max(1, columns - 1);
                    break;
                case 'ArrowDown':
                    rows = Math.min(size, rows + 1);
                    break;
                case 'ArrowUp':
                    rows = Math.max(1, rows - 1);
                    break;
                case 'Enter':
                case ' ':
                    confirm();
                    e.preventDefault();
                    return;
                default:
                    handled = false;
            }

            if (!handled) {
                return;
            }
            e.preventDefault();
            highlight(rows, columns);
            cells.forEach(function(cell) {
                if (Number(cell.dataset.row) === rows && Number(cell.dataset.column) === columns) {
                    cell.focus();
                }
            });
        });

        element.appendChild(grid);
        element.appendChild(label);
        document.body.appendChild(element);
        position(element, owner);
        register(element, owner);

        // An existing matrix opens on its own size, so the grid shows what is there and the
        // student changes it rather than starting over (#62).
        var startrows = current && current.rows ? Math.min(size, current.rows) : 1;
        var startcolumns = current && current.columns ? Math.min(size, current.columns) : 1;
        highlight(startrows, startcolumns);

        cells.forEach(function(cell) {
            if (Number(cell.dataset.row) === startrows
                    && Number(cell.dataset.column) === startcolumns) {
                cell.focus();
            }
        });

        return element;
    }

    /**
     * Open the vector popup: dimension and orientation.
     *
     * @param {HTMLElement} owner Button that opens the popup.
     * @param {Function} onChoose Called with the structured model.
     * @param {?Object} current Size of the structure being changed, or null for a new one.
     * @returns {HTMLElement} The popup element.
     */
    function openVectorChooser(owner, onChoose, current) {
        var element = document.createElement('div');
        var dimensionRow = document.createElement('div');
        var orientationRow = document.createElement('div');
        var label = document.createElement('div');
        var state = {
            dimension: (current && current.dimension) || 3,
            orientation: (current && current.orientation) || 'column'
        };
        var dimensionButtons = [];
        var orientationButtons = [];
        var dimensionButton;
        var d;

        close(false);

        element.className = 'sme-structured-popup sme-vector-popup';
        element.setAttribute('role', 'dialog');
        element.setAttribute('aria-label', strings.vectorTitle);

        dimensionRow.className = 'sme-vector-row';
        dimensionRow.setAttribute('role', 'group');
        dimensionRow.setAttribute('aria-label', strings.dimension);

        orientationRow.className = 'sme-vector-row';
        orientationRow.setAttribute('role', 'group');
        orientationRow.setAttribute('aria-label', strings.orientation);

        label.className = 'sme-structured-popup-label';
        label.setAttribute('aria-live', 'polite');

        /**
         * Reflect the current choice in the buttons and the text.
         */
        function refresh() {
            dimensionButtons.forEach(function(button) {
                var active = Number(button.dataset.dimension) === state.dimension;
                button.classList.toggle('sme-selected', active);
                button.setAttribute('aria-pressed', active ? 'true' : 'false');
            });
            orientationButtons.forEach(function(button) {
                var active = button.dataset.orientation === state.orientation;
                button.classList.toggle('sme-selected', active);
                button.setAttribute('aria-pressed', active ? 'true' : 'false');
            });
            label.textContent = format(
                strings.vectorSize,
                state.dimension,
                state.orientation === 'row' ? strings.rowVector : strings.columnVector
            );
        }

        /**
         * Confirm the current choice.
         */
        function confirm() {
            var model = Model.createVector(state.dimension, state.orientation);
            close(false);
            onChoose(model);
        }

        for (d = 2; d <= Model.QUICK_PICK_SIZE; d++) {
            dimensionButton = document.createElement('button');
            dimensionButton.type = 'button';
            dimensionButton.className = 'sme-vector-dimension';
            dimensionButton.dataset.dimension = d;
            dimensionButton.textContent = String(d);
            dimensionButton.addEventListener('click', function(e) {
                e.preventDefault();
                state.dimension = Number(this.dataset.dimension);
                refresh();
            });
            dimensionButtons.push(dimensionButton);
            dimensionRow.appendChild(dimensionButton);
        }

        [
            {orientation: 'column', text: strings.columnVector},
            {orientation: 'row', text: strings.rowVector}
        ].forEach(function(option) {
            var button = document.createElement('button');
            button.type = 'button';
            button.className = 'sme-vector-orientation';
            button.dataset.orientation = option.orientation;
            button.textContent = option.text;
            button.addEventListener('click', function(e) {
                e.preventDefault();
                state.orientation = this.dataset.orientation;
                refresh();
            });
            orientationButtons.push(button);
            orientationRow.appendChild(button);
        });

        element.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                confirm();
            }
        });

        element.appendChild(dimensionRow);
        element.appendChild(orientationRow);
        element.appendChild(label);
        document.body.appendChild(element);
        position(element, owner);
        register(element, owner);
        refresh();
        dimensionButtons[0].focus();

        return element;
    }

    return /** @alias module:local_stackmatheditor/structured_popup */ {
        setStrings: function(values) {
            Object.keys(values || {}).forEach(function(key) {
                if (typeof values[key] === 'string' && values[key]) {
                    strings[key] = values[key];
                }
            });
        },
        openMatrixGrid: openMatrixGrid,
        openVectorChooser: openVectorChooser,
        close: close,
        isOpen: function() {
            return openPopup !== null;
        }
    };
});

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
 * Bridge between the visible MathQuill editors and the original STACK inputs (#48).
 *
 * Guiding invariant: the expression visible in MathQuill is the expression STACK receives.
 *
 * - triggerValidation(): tells STACK (and any other script) that the original input changed.
 *   Exactly one native "input" and one native "change" event. Native events reach jQuery
 *   handlers as well, so the former extra jQuery triggers only produced duplicates.
 * - register(flush): every editor registers a function that writes its current state into the
 *   original input without raising events. All of them run in a capture-phase listener before
 *   a form is submitted (and already on pointerdown of a submit button), so "Check" and
 *   "Submit" never send a value that a pending debounced sync has not written yet. The native
 *   event path is not touched: no preventDefault, no own submit logic.
 * - guardStaleValidation(): STACK shows an "invalid" AJAX response without checking whether
 *   it still belongs to the current value. A slow response for a transient state such as
 *   "(2)/()" can therefore arrive after the final "(1)/(6)" was validated and overwrite it.
 *   When that can have happened, validation of the current value is requested once more;
 *   STACK answers from its cache if the value was already validated.
 *
 * @module     local_stackmatheditor/stack_bridge
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
define([], function() {
    'use strict';

    /** @type {number} STACK's typing delay before it sends a validation request (input.js). */
    var STACK_TYPING_DELAY = 1000;

    /** @type {Function[]} Registered flush functions. */
    var flushers = [];

    /** @type {boolean} Whether the document-level listeners are installed. */
    var installed = false;

    /** @type {WeakMap} Element → {dispatched: timestamp, revalidated: value}. */
    var state = typeof WeakMap === 'function' ? new WeakMap() : null;

    /**
     * Per-element bookkeeping.
     *
     * @param {HTMLElement} el Original STACK input.
     * @returns {Object} State object.
     */
    function stateOf(el) {
        var s;

        if (!state) {
            el.smeBridgeState = el.smeBridgeState || {dispatched: 0, revalidated: null};
            return el.smeBridgeState;
        }
        s = state.get(el);
        if (!s) {
            s = {dispatched: 0, revalidated: null};
            state.set(el, s);
        }
        return s;
    }

    /**
     * Current value as STACK reads it (trimmed).
     *
     * @param {HTMLElement} el Original STACK input.
     * @returns {string} Value.
     */
    function valueOf(el) {
        return String(el.value || '').replace(/^\s+|\s+$/g, '');
    }

    /**
     * Notify STACK and other listeners that the original input changed.
     *
     * @param {HTMLElement} el Original STACK input (input or textarea).
     */
    function triggerValidation(el) {
        stateOf(el).dispatched = Date.now();
        el.dispatchEvent(new Event('input', {bubbles: true, cancelable: true}));
        el.dispatchEvent(new Event('change', {bubbles: true, cancelable: true}));
    }

    /**
     * Run every registered flush function. Errors of one editor never stop the others.
     */
    function flushAll() {
        flushers.forEach(function(fn) {
            try {
                fn();
            } catch (e) {
                // A broken editor must not block the submission of the others.
            }
        });
    }

    /**
     * True for elements that submit their form when activated.
     *
     * @param {EventTarget} target Event target.
     * @returns {boolean} Whether target is (inside) a submit control.
     */
    function isSubmitControl(target) {
        var el = target && target.closest ? target.closest('button, input') : null;
        var type;

        if (!el || !el.form) {
            return false;
        }
        type = (el.getAttribute('type') || (el.tagName === 'BUTTON' ? 'submit' : '')).toLowerCase();
        return type === 'submit' || type === 'image';
    }

    /**
     * Install the capture-phase listeners once.
     */
    function install() {
        if (installed || typeof document === 'undefined') {
            return;
        }
        installed = true;
        // Pointerdown precedes the click, so the value is written before STACK sees the button.
        document.addEventListener('pointerdown', function(e) {
            if (isSubmitControl(e.target)) {
                flushAll();
            }
        }, true);
        document.addEventListener('keydown', function(e) {
            if ((e.key === 'Enter' || e.key === ' ') && isSubmitControl(e.target)) {
                flushAll();
            }
        }, true);
        // The form data set is built after the submit event, so this is the last safe moment.
        document.addEventListener('submit', flushAll, true);
    }

    /**
     * Register an editor's flush function.
     *
     * @param {Function} fn Writes the editor state into the original input without events.
     */
    function register(fn) {
        install();
        flushers.push(fn);
    }

    /**
     * Re-request validation when an "invalid" result may belong to an older value.
     *
     * @param {HTMLElement} el Original STACK input.
     */
    function guardStaleValidation(el) {
        el.addEventListener('stack-validation', function(e) {
            var detail = e.detail || {};
            var s = stateOf(el);
            var value;

            if (!detail.completed || detail.valid !== false) {
                return;
            }
            // Before STACK's typing delay has passed since our last change, the request for
            // the current value has not even been sent: its pending timer repairs the display.
            if (Date.now() - s.dispatched < STACK_TYPING_DELAY) {
                return;
            }
            value = valueOf(el);
            // Once per value: a value that really is invalid must not loop.
            if (s.revalidated === value) {
                return;
            }
            s.revalidated = value;
            el.dispatchEvent(new Event('input', {bubbles: true, cancelable: true}));
        });
    }

    return /** @alias module:local_stackmatheditor/stack_bridge */ {
        STACK_TYPING_DELAY: STACK_TYPING_DELAY,
        triggerValidation: triggerValidation,
        register: register,
        flushAll: flushAll,
        guardStaleValidation: guardStaleValidation
    };
});

/**
 * @jest-environment jsdom
 */
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
 * Issue #48: the visible editor state is what STACK receives - event bridge to the original input.
 *
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const {loadAmd} = require('./amd_loader');

/**
 * Build a question form with the hidden STACK textarea and a Check button.
 *
 * @returns {Object} Elements.
 */
function buildForm() {
    document.body.innerHTML = `
        <form id="responseform">
            <textarea name="q1:1_ans1">(2)/()</textarea>
            <input type="submit" name="q1:1_-submit" value="Check">
            <button type="button" class="sme-toolbar-btn">frac</button>
        </form>`;
    return {
        form: document.getElementById('responseform'),
        ta: document.querySelector('textarea'),
        check: document.querySelector('input[type=submit]'),
        toolbar: document.querySelector('button[type=button]'),
    };
}

describe('triggerValidation', () => {
    test('raises exactly one input and one change event', () => {
        const bridge = loadAmd('stack_bridge');
        const {ta} = buildForm();
        const seen = [];
        ta.addEventListener('input', () => seen.push('input'));
        ta.addEventListener('change', () => seen.push('change'));
        ta.addEventListener('blur', () => seen.push('blur'));
        bridge.triggerValidation(ta);
        expect(seen).toEqual(['input', 'change']);
    });
});

describe('flush before Check / Submit', () => {
    test('the value posted by submit is the flushed editor state', () => {
        const bridge = loadAmd('stack_bridge');
        const {form, ta} = buildForm();
        let posted = null;
        bridge.register(() => {
            ta.value = '(1)/(6)';
        });
        // A regular (bubbling) submit listener runs after the capture-phase flush.
        form.addEventListener('submit', (e) => {
            posted = ta.value;
            e.preventDefault();
        });
        form.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
        expect(posted).toBe('(1)/(6)');
    });

    test('pointerdown on the Check button flushes, a toolbar button does not', () => {
        const bridge = loadAmd('stack_bridge');
        const {check, toolbar} = buildForm();
        const flush = jest.fn();
        bridge.register(flush);
        toolbar.dispatchEvent(new Event('pointerdown', {bubbles: true}));
        expect(flush).not.toHaveBeenCalled();
        check.dispatchEvent(new Event('pointerdown', {bubbles: true}));
        expect(flush).toHaveBeenCalledTimes(1);
    });

    test('the flush itself raises no events (no double validation, no double submit)', () => {
        const bridge = loadAmd('stack_bridge');
        const {form, ta} = buildForm();
        const seen = jest.fn();
        const submits = jest.fn((e) => e.preventDefault());
        ta.addEventListener('input', seen);
        form.addEventListener('submit', submits);
        bridge.register(() => {
            ta.value = '(1)/(6)';
        });
        form.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
        expect(seen).not.toHaveBeenCalled();
        expect(submits).toHaveBeenCalledTimes(1);
    });

    test('a failing editor does not keep the others from flushing', () => {
        const bridge = loadAmd('stack_bridge');
        buildForm();
        const good = jest.fn();
        bridge.register(() => {
            throw new Error('broken editor');
        });
        bridge.register(good);
        bridge.flushAll();
        expect(good).toHaveBeenCalled();
    });
});

describe('guardStaleValidation', () => {
    let now;

    beforeEach(() => {
        now = 100000;
        jest.spyOn(Date, 'now').mockImplementation(() => now);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    /**
     * Simulate STACK's completion event.
     *
     * @param {HTMLElement} ta Original input.
     * @param {boolean} valid Validation result.
     */
    const stackResult = (ta, valid) => ta.dispatchEvent(
        new CustomEvent('stack-validation', {detail: {inputname: 'ans1', completed: true, valid}}));

    test('a stale invalid result triggers exactly one re-validation of the current value', () => {
        const bridge = loadAmd('stack_bridge');
        const {ta} = buildForm();
        const inputs = jest.fn();
        bridge.guardStaleValidation(ta);
        ta.value = '(1)/(6)';
        bridge.triggerValidation(ta);
        ta.addEventListener('input', inputs);

        now += 1500; // Slow CAS answer for "(2)/()" arrives after the final value was sent.
        stackResult(ta, false);
        expect(inputs).toHaveBeenCalledTimes(1);

        now += 1500; // A second invalid answer for the same value must not loop.
        stackResult(ta, false);
        expect(inputs).toHaveBeenCalledTimes(1);
    });

    test('before STACK has even sent the current request, the pending timer repairs the display', () => {
        const bridge = loadAmd('stack_bridge');
        const {ta} = buildForm();
        const inputs = jest.fn();
        bridge.guardStaleValidation(ta);
        bridge.triggerValidation(ta);
        ta.addEventListener('input', inputs);
        now += 400;
        stackResult(ta, false);
        expect(inputs).not.toHaveBeenCalled();
    });

    test('valid results and "in progress" events are ignored', () => {
        const bridge = loadAmd('stack_bridge');
        const {ta} = buildForm();
        const inputs = jest.fn();
        bridge.guardStaleValidation(ta);
        bridge.triggerValidation(ta);
        ta.addEventListener('input', inputs);
        now += 5000;
        stackResult(ta, true);
        ta.dispatchEvent(new CustomEvent('stack-validation', {detail: {completed: false, valid: null}}));
        expect(inputs).not.toHaveBeenCalled();
    });
});

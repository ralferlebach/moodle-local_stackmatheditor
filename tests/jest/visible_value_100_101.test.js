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
 * #100 / #101: the answer that is submitted is the answer the student sees.
 *
 * The real modules - input_fields, textarea_fields, stack_bridge, editor_toggle - with the real
 * bundled MathQuill and jQuery, in jsdom. Only Moodle's string loader is a stub. A submit runs
 * through the bridge's capture-phase listeners exactly as in the browser (pointerdown, click,
 * keyboard, native submit).
 *
 * - With the editor switched off, the original input is the answer: no flush writes a stale
 *   editor value over it, in any submit path, for one-line, system and multi-line editors.
 * - With the editor on, its last state is written before the submit.
 * - Switching on and off in both orders keeps the last value the student entered.
 * - Several inputs stay independent.
 * - An editor starts from the input's current value, not from its value attribute; an emptied
 *   input stays empty.
 * - A question replaced in the page leaves no flush callback behind, and building an editor
 *   again does not make the registry grow.
 *
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const fs = require('fs');
const path = require('path');
const {loadAmd, loadDefinitions} = require('./amd_loader');

const $ = require('jquery');
window.jQuery = $;
// eslint-disable-next-line no-new-func
new Function('window', 'document', 'jQuery',
    fs.readFileSync(path.resolve(__dirname, '..', '..', 'thirdparty', 'mathquill', 'mathquill.js'), 'utf8')
).call(window, window, document, $);

const strStub = {
    // eslint-disable-next-line camelcase
    get_string: () => Promise.resolve(''),
    // eslint-disable-next-line camelcase
    get_strings: (list) => Promise.resolve(list.map(() => '')),
};

let Bridge;
let InputFields;
let TextareaFields;
let Toggle;

/**
 * Load a fresh set of modules sharing one bridge, as RequireJS does on a page.
 */
function loadModules() {
    Bridge = loadAmd('stack_bridge');
    Toggle = loadAmd('editor_toggle');
    const deps = {
        'jquery': $,
        'core/str': strStub,
        'local_stackmatheditor/stack_bridge': Bridge,
        'local_stackmatheditor/editor_toggle': Toggle,
    };
    InputFields = loadAmd('input_fields', deps);
    TextareaFields = loadAmd('textarea_fields', deps);
}

/**
 * The shared context mathquill_init builds.
 *
 * @returns {Object} Context.
 */
function context() {
    return {
        MQ: window.MathQuill.getInterface(2),
        defs: loadDefinitions(),
        slotConfigs: {},
        instanceDefaults: {},
        slotVarModes: {},
        instanceVarMode: 'stack',
        isCommaDecimal: () => false,
        localeComma: false,
        extractSlot: (name) => {
            const m = (name || '').match(/:(\d+)_/);
            return m ? parseInt(m[1], 10) : 0;
        },
        slotEnabled: null,
        defaultEnabled: true,
        allowStudentToggle: true,
        slotStudentToggle: {},
        maxDimension: 5,
        slotMaxDimension: {},
        dbg: () => undefined,
    };
}

/**
 * Let the editors' timers (pre-fill, toggle, debounced sync) run.
 *
 * @param {number} [ms] Milliseconds.
 * @returns {Promise<void>}
 */
function settle(ms = 400) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * A quiz question with one STACK input.
 *
 * @param {number} slot Slot.
 * @param {string} html Input markup.
 * @returns {HTMLElement} The question.
 */
function question(slot, html) {
    const que = document.createElement('div');
    que.className = 'que stack';
    que.innerHTML = `<div class="formulation">${html}`
        + `<button type="submit" name="q1:${slot}_-submit">Check</button></div>`;
    document.getElementById('responseform').appendChild(que);
    return que;
}

/**
 * The page: one response form, as Moodle renders it.
 */
function page() {
    document.body.innerHTML = '<form id="responseform" action="#" method="post"></form>';
    // jsdom does not implement form submission; the default action is not under test.
    document.getElementById('responseform').addEventListener('submit', (e) => e.preventDefault());
}

/**
 * The switch of an editor.
 *
 * @param {HTMLElement} que Question.
 * @returns {HTMLInputElement} Switch checkbox.
 */
function toggleOf(que) {
    return que.querySelector('.sme-toggle-input');
}

/**
 * Click the switch, as a student does.
 *
 * @param {HTMLElement} que Question.
 */
function flip(que) {
    toggleOf(que).click();
}

/**
 * Type into the now visible original field, as a student does: value, then input/change.
 *
 * @param {HTMLElement} el Input or textarea.
 * @param {string} value Value.
 */
function typeInto(el, value) {
    el.value = value;
    el.dispatchEvent(new Event('input', {bubbles: true}));
    el.dispatchEvent(new Event('change', {bubbles: true}));
}

/**
 * The editor of a single-line input as a MathQuill field.
 *
 * @param {HTMLElement} que Question.
 * @returns {Object} MathQuill field.
 */
function fieldOf(que) {
    return window.MathQuill.getInterface(2)(que.querySelector('.mq-editable-field'));
}

const SUBMIT_PATHS = {
    'pointerdown + click on Check': (que) => {
        const check = que.querySelector('[type="submit"]');
        check.dispatchEvent(new Event('pointerdown', {bubbles: true}));
        check.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    },
    'touch (pointerdown, pointerType touch)': (que) => {
        const check = que.querySelector('[type="submit"]');
        const ev = new Event('pointerdown', {bubbles: true});
        Object.defineProperty(ev, 'pointerType', {value: 'touch'});
        check.dispatchEvent(ev);
    },
    'keyboard (Enter on Check)': (que) => {
        const check = que.querySelector('[type="submit"]');
        check.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
    },
    'native submit of the form': () => {
        document.getElementById('responseform').dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
    },
};

beforeEach(() => {
    window.localStorage.clear();
    page();
    loadModules();
});

describe('#100: single-line input', () => {
    /**
     * One algebraic input with a stored answer, its editor built and settled.
     *
     * @param {string} value Stored answer.
     * @returns {Promise<Object>} {que, input}.
     */
    async function oneInput(value) {
        const que = question(1, `<input type="text" name="q1:1_ans1" id="q1:1_ans1"
            data-stack-input-type="algebraic" value="${value}">`);
        InputFields.attach(context());
        await settle();
        return {que, input: que.querySelector('input[name="q1:1_ans1"]')};
    }

    test.each(Object.keys(SUBMIT_PATHS))('editor off, visible input changed, %s: the visible value is sent',
        async(pathname) => {
            const {que, input} = await oneInput('x^2');
            expect(fieldOf(que).latex()).not.toBe('');

            flip(que);
            expect(que.querySelector('.sme-mq-container').classList.contains(Toggle.HIDDEN_CLASS)).toBe(true);
            typeInto(input, '2*2=4');
            SUBMIT_PATHS[pathname](que);

            expect(input.value).toBe('2*2=4');
        });

    test('editor on: the last visible MathQuill value is written before the submit', async() => {
        const {que, input} = await oneInput('x');
        fieldOf(que).latex('y^{3}');
        SUBMIT_PATHS['native submit of the form'](que);
        expect(input.value).toBe('y^3');
    });

    test('an untouched editor does not rewrite the stored answer in its own spelling', async() => {
        // max2tex/tex2max would write "2*2=4" back as "2*2=4" here, but a value the editor
        // only showed is never re-serialised: the submit sends it as stored.
        const {que, input} = await oneInput('2 * 2 = 4');
        SUBMIT_PATHS['native submit of the form'](que);
        expect(input.value).toBe('2 * 2 = 4');
    });

    test('on, off, edit, on, submit: the value typed while off is kept', async() => {
        const {que, input} = await oneInput('x+1');
        flip(que);
        typeInto(input, 'x+2');
        flip(que);
        await settle();
        expect(fieldOf(que).latex()).toBe('x+2');
        SUBMIT_PATHS['pointerdown + click on Check'](que);
        expect(input.value).toBe('x+2');
    });

    test('off, edit, on, edit in the editor, off, submit: the editor value is handed over', async() => {
        const {que, input} = await oneInput('a');
        flip(que);
        typeInto(input, 'b');
        flip(que);
        await settle();
        fieldOf(que).latex('c');
        flip(que);
        expect(input.value).toBe('c');
        SUBMIT_PATHS['native submit of the form'](que);
        expect(input.value).toBe('c');
    });

    test('a started-off editor (remembered choice) writes nothing at start and on submit', async() => {
        Toggle.remember(true);
        const {que, input} = await oneInput('sin(x)');
        expect(que.querySelector('.sme-mq-container').classList.contains(Toggle.HIDDEN_CLASS)).toBe(true);
        expect(input.value).toBe('sin(x)');
        typeInto(input, '');
        SUBMIT_PATHS['native submit of the form'](que);
        expect(input.value).toBe('');
    });
});

describe('#100: several inputs', () => {
    test('one switched off, one on: each keeps its own value, no cross-field overwrite', async() => {
        const q1 = question(1, `<input type="text" name="q1:1_ans1" data-stack-input-type="algebraic" value="a">`);
        const q2 = question(2, `<input type="text" name="q1:2_ans1" data-stack-input-type="algebraic" value="b">`);
        InputFields.attach(context());
        await settle();

        flip(q1);
        typeInto(q1.querySelector('input[name="q1:1_ans1"]'), 'a2');
        fieldOf(q2).latex('b2');
        SUBMIT_PATHS['native submit of the form'](q1);

        expect(q1.querySelector('input[name="q1:1_ans1"]').value).toBe('a2');
        expect(q2.querySelector('input[name="q1:2_ans1"]').value).toBe('b2');
    });
});

describe('#100: relation system', () => {
    test('editor off, input changed, submit: the system rows do not write over it', async() => {
        const que = question(1, `<input type="text" name="q1:1_ans1" data-stack-input-type="algebraic"
            value="(x+y=3) nounand (x-y=1)">`);
        InputFields.attach(context());
        await settle();
        expect(que.querySelectorAll('.sme-system-row').length).toBe(2);
        const input = que.querySelector('input[name="q1:1_ans1"]');

        flip(que);
        typeInto(input, '(x+y=5) nounand (x-y=1)');
        SUBMIT_PATHS['pointerdown + click on Check'](que);
        expect(input.value).toBe('(x+y=5) nounand (x-y=1)');

        // And back on: the rows follow the value, and an untouched submit keeps it.
        flip(que);
        await settle();
        SUBMIT_PATHS['native submit of the form'](que);
        expect(input.value).toBe('(x+y=5) nounand (x-y=1)');
    });
});

describe('#100 / #101: multi-line editor', () => {
    /**
     * One textarea input, editor built and settled.
     *
     * @param {string} type equiv or textarea.
     * @param {string} value Initial content.
     * @returns {Promise<Object>} {que, ta}.
     */
    async function oneTextarea(type, value) {
        const que = question(1, `<textarea name="q1:1_ans1" data-stack-input-type="${type}">${value}</textarea>`);
        TextareaFields.init(context());
        await settle();
        return {que, ta: que.querySelector('textarea[name="q1:1_ans1"]')};
    }

    test.each(Object.keys(SUBMIT_PATHS))('equiv, editor off, textarea changed, %s: the textarea is sent', async(pathname) => {
        const {que, ta} = await oneTextarea('equiv', '1+2*3^3\n1+2*27');
        flip(que);
        typeInto(ta, '1+2*3^3\n1+2*27\n1+54\n55');
        SUBMIT_PATHS[pathname](que);
        expect(ta.value).toBe('1+2*3^3\n1+2*27\n1+54\n55');
    });

    test('the four-line chain is kept line by line, no line lost or doubled', async() => {
        const chain = '1+2*3^3\n1+2*27\n1+54\n55';
        const {que, ta} = await oneTextarea('equiv', chain);
        expect(que.querySelectorAll('.sme-equiv-row').length).toBe(4);
        SUBMIT_PATHS['native submit of the form'](que);
        expect(ta.value).toBe(chain);
    });

    test('a prescribed start line is shown in the editor and stays in the textarea', async() => {
        const {que, ta} = await oneTextarea('equiv', '1+2*3^3');
        expect(que.querySelectorAll('.sme-equiv-row').length).toBe(1);
        expect(window.MathQuill.getInterface(2)(que.querySelector('.mq-editable-field')).latex()).toBe('1+2\\cdot3^{3}');
        expect(ta.value).toBe('1+2*3^3');
    });

    test('a deliberately removed first line is not restored', async() => {
        const {que, ta} = await oneTextarea('equiv', '1+2*3^3\n1+2*27');
        flip(que);
        typeInto(ta, '1+2*27\n1+54\n55');
        flip(que);
        await settle();
        expect(que.querySelectorAll('.sme-equiv-row').length).toBe(3);
        SUBMIT_PATHS['native submit of the form'](que);
        expect(ta.value).toBe('1+2*27\n1+54\n55');
    });

    test('textarea: editor on, a step edited, submit: the editor state is written', async() => {
        const {que, ta} = await oneTextarea('textarea', 'a\nb');
        const second = window.MathQuill.getInterface(2)(que.querySelectorAll('.mq-editable-field')[1]);
        second.latex('c');
        // No settle: the debounced sync is still pending - the flush writes it.
        SUBMIT_PATHS['pointerdown + click on Check'](que);
        expect(ta.value).toBe('a\nc');
    });

    test('a value with powers, fractions and a transient invalid line keeps its lines', async() => {
        const value = 'x^2+1\n(1)/(2)\n2*(';
        const {que, ta} = await oneTextarea('textarea', value);
        expect(que.querySelectorAll('.sme-equiv-row').length).toBe(3);
        SUBMIT_PATHS['native submit of the form'](que);
        expect(ta.value).toBe(value);
    });
});

describe('#101: start value', () => {
    test('a single-line editor starts from the current value, not from the value attribute', async() => {
        const que = question(1, `<input type="text" name="q1:1_ans1" data-stack-input-type="algebraic" value="old">`);
        const input = que.querySelector('input[name="q1:1_ans1"]');
        input.value = 'new';
        InputFields.attach(context());
        await settle();
        expect(fieldOf(que).latex()).toBe('new');
        SUBMIT_PATHS['native submit of the form'](que);
        expect(input.value).toBe('new');
    });

    test('a deliberately emptied single-line input is not refilled from the attribute', async() => {
        const que = question(1, `<input type="text" name="q1:1_ans1" data-stack-input-type="algebraic" value="old">`);
        const input = que.querySelector('input[name="q1:1_ans1"]');
        input.value = '';
        InputFields.attach(context());
        await settle();
        expect(fieldOf(que).latex()).toBe('');
        SUBMIT_PATHS['native submit of the form'](que);
        expect(input.value).toBe('');
    });

    test('a textarea whose value differs from its default starts from the value', async() => {
        const que = question(1, `<textarea name="q1:1_ans1" data-stack-input-type="equiv">1+2*3^3</textarea>`);
        const ta = que.querySelector('textarea[name="q1:1_ans1"]');
        ta.value = '1+2*3^3\n1+2*27';
        TextareaFields.init(context());
        await settle();
        expect(que.querySelectorAll('.sme-equiv-row').length).toBe(2);
        SUBMIT_PATHS['native submit of the form'](que);
        expect(ta.value).toBe('1+2*3^3\n1+2*27');
    });

    test('an emptied textarea is not refilled from its default', async() => {
        const que = question(1, `<textarea name="q1:1_ans1" data-stack-input-type="equiv">1+2*3^3</textarea>`);
        const ta = que.querySelector('textarea[name="q1:1_ans1"]');
        ta.value = '';
        TextareaFields.init(context());
        await settle();
        expect(que.querySelectorAll('.sme-equiv-row').length).toBe(1);
        SUBMIT_PATHS['native submit of the form'](que);
        expect(ta.value).toBe('');
    });
});

describe('#100: flush lifecycle', () => {
    test('a replaced question leaves no flush behind, and the registry does not grow', async() => {
        const ctx = context();
        for (let round = 0; round < 5; round += 1) {
            document.getElementById('responseform').innerHTML = '';
            question(1, `<input type="text" name="q1:1_ans1" data-stack-input-type="algebraic" value="r${round}">`);
            question(2, `<textarea name="q1:2_ans1" data-stack-input-type="textarea">t${round}</textarea>`);
            InputFields.attach(ctx);
            TextareaFields.init(ctx);
            // eslint-disable-next-line no-await-in-loop
            await settle(50);
            expect(Bridge.registeredCount()).toBe(2);
        }
    });

    test('a detached input is never written by a later flush', async() => {
        const que = question(1, `<input type="text" name="q1:1_ans1" data-stack-input-type="algebraic" value="a">`);
        InputFields.attach(context());
        await settle();
        const input = que.querySelector('input[name="q1:1_ans1"]');
        fieldOf(que).latex('b');
        que.remove();
        input.value = 'kept';
        Bridge.flushAll();
        expect(input.value).toBe('kept');
        expect(Bridge.registeredCount()).toBe(0);
    });

    test('a multi-line question inserted after load gets its editor by itself (#101)', async() => {
        TextareaFields.init(context());
        const que = question(1, `<textarea name="q1:1_ans1" data-stack-input-type="equiv">1+2*3^3\n1+2*27</textarea>`);
        await settle();
        expect(que.querySelectorAll('.sme-equiv-row').length).toBe(2);
        expect(que.querySelector('textarea[name="q1:1_ans1"]').getAttribute('data-sme-init')).toBe('1');
    });

    test('a second registration for the same input replaces the first', () => {
        const el = document.createElement('input');
        document.body.appendChild(el);
        const calls = [];
        Bridge.register(() => calls.push('first'), el);
        Bridge.register(() => calls.push('second'), el);
        Bridge.flushAll();
        expect(calls).toEqual(['second']);
    });
});

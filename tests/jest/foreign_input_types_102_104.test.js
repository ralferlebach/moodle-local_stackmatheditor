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
 * #102 / #103 / #104: the editor leaves foreign STACK inputs alone.
 *
 * The real modules in jsdom, as in visible_value_100_101.test.js. An explicit
 * data-stack-input-type decides: only algebraic and units (one-line) and equiv and textarea
 * (multi-line) get an editor. A typed foreign field - GeoGebra, string (also the hidden field of a
 * Parsons block and a JSXGraph custom binding), json, freetext, notes, numerical, singlechar,
 * matrix, varmatrix, boolean, dropdown - never does, whatever its name. A field without type
 * metadata gets one only when it is positively an algebraic STACK input: a text input with
 * STACK's class "algebraic" in a STACK question, named or identified ..._ansN.
 *
 * For each foreign field: no editor, no wrapper, not hidden, no flush registered, its value and
 * its focus untouched, no event dispatched on it by the editor, and the submit leaves its value
 * as the student left it - next to a working algebraic editor on the same page.
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
    'keyboard (Enter on Check)': (que) => {
        const check = que.querySelector('[type="submit"]');
        check.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
    },
    'native submit of the form': () => {
        document.getElementById('responseform').dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
    },
};

/**
 * Markup of a STACK field of a type, as STACK 4.13 renders it.
 *
 * @param {string} type data-stack-input-type value.
 * @param {string} name Field name.
 * @param {string} value Current value.
 * @returns {string} Markup.
 */
function foreignField(type, name, value) {
    value = value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const attrs = `name="${name}" id="${name}" data-stack-input-type="${type}"`;
    if (['freetext', 'notes', 'varmatrix'].indexOf(type) !== -1) {
        return `<textarea ${attrs}>${value}</textarea>`;
    }
    if (['boolean', 'dropdown'].indexOf(type) !== -1) {
        return `<select ${attrs}><option value="">-</option><option value="${value}" selected>${value}</option></select>`;
    }
    return `<input type="text" ${attrs} value="${value}">`;
}

beforeEach(() => {
    window.localStorage.clear();
    page();
    loadModules();
});

/** Types the editor must leave native, with a value of the kind STACK stores for them. */
const FOREIGN = {
    geogebra: '[[1,2],[3,4]]',
    string: 'hello world',
    json: '{"a":[1,2],"b":"x^2"}',
    parsons: '[[{"used":[[["s1","s2"]]],"available":["s3"]},0]]',
    freetext: 'The derivative is 2*x because ...',
    notes: 'my notes: x^2',
    numerical: '3.14',
    singlechar: 'b',
    matrix: '1',
    varmatrix: '1 2\n3 4',
    boolean: 'true',
    dropdown: '2',
    unknownfuture: 'x^2',
};

/** Name variants: the _ansN convention is no proof of the type. */
const NAMES = ['q1:1_ans1', 'q1:1_ans12', 'q1:1_bp', 'q1:1_remember'];

/**
 * Count the events the editor dispatches on a field.
 *
 * @param {HTMLElement} el Field.
 * @returns {Object} Counter by event type.
 */
function eventCounter(el) {
    const count = {input: 0, change: 0, keyup: 0, focus: 0};
    Object.keys(count).forEach((type) => el.addEventListener(type, () => {
        count[type]++;
    }));
    return count;
}

/**
 * Attach both editors, as mathquill_init does, and let them settle.
 *
 * @returns {Promise<void>}
 */
async function attachAll() {
    InputFields.attach(context());
    TextareaFields.attach(context());
    await settle();
}

/**
 * Assert that a field is untouched by the editor.
 *
 * @param {HTMLElement} que Question.
 * @param {HTMLElement} el Field.
 * @param {string} value Expected value.
 */
function expectNative(que, el, value) {
    expect(el.closest('.sme-input-wrap')).toBeNull();
    expect(el.getAttribute('data-sme-init')).toBeNull();
    expect(el.style.display).not.toBe('none');
    expect(el.classList.contains('sme-hidden-input')).toBe(false);
    expect(el.getAttribute('aria-hidden')).toBeNull();
    expect(el.value).toBe(value);
    // No editor was built next to it.
    expect(el.parentElement.querySelector('.mq-editable-field')).toBeNull();
}

describe('#102/#104: an explicitly typed foreign field never gets an editor', () => {
    const cases = [];
    Object.keys(FOREIGN).forEach((type) => NAMES.forEach((name) => cases.push([type, name])));

    test.each(cases)('type %s named %s', async(type, name) => {
        const value = FOREIGN[type];
        const que = question(1, foreignField(type, name, value));
        const el = que.querySelector(`[name="${name}"]`);
        const events = eventCounter(el);
        await attachAll();

        expectNative(que, el, value);
        expect(que.querySelector('.sme-mq-container')).toBeNull();
        expect(que.querySelector('.sme-toggle-input')).toBeNull();
        expect(Bridge.registeredCount()).toBe(0);
        expect(events).toEqual({input: 0, change: 0, keyup: 0, focus: 0});
    });

    test.each(Object.keys(SUBMIT_PATHS))('the submit leaves every foreign value as it is: %s', async(pathname) => {
        let html = '';
        Object.keys(FOREIGN).forEach((type, i) => {
            html += foreignField(type, `q1:1_ans${i + 1}`, FOREIGN[type]);
        });
        const que = question(1, html);
        await attachAll();
        SUBMIT_PATHS[pathname](que);
        Object.keys(FOREIGN).forEach((type, i) => {
            expectNative(que, que.querySelector(`[name="q1:1_ans${i + 1}"]`), FOREIGN[type]);
        });
    });
});

describe('#102/#104: a field without type metadata', () => {
    test('a legacy algebraic STACK input (class algebraic, _ansN) still gets an editor', async() => {
        const que = question(1, '<input type="text" class="algebraic" name="q1:1_ans1" id="q1:1_ans1" value="x^2">');
        await attachAll();
        const el = que.querySelector('[name="q1:1_ans1"]');
        expect(el.getAttribute('data-sme-init')).toBe('1');
        expect(que.querySelector('.mq-editable-field')).not.toBeNull();
    });

    test('a legacy algebraic input identified by its id still gets an editor', async() => {
        const que = question(1, '<input type="text" class="algebraic" name="answer" id="q1:1_ans2" value="y">');
        await attachAll();
        expect(que.querySelector('[id="q1:1_ans2"]').getAttribute('data-sme-init')).toBe('1');
    });

    test.each([
        ['no algebraic class', '<input type="text" name="q1:1_ans1" id="q1:1_ans1" value="a">', null],
        ['a hidden field', '<input type="hidden" class="algebraic" name="q1:1_ans1" value="a">', null],
        ['a number field', '<input type="number" class="algebraic" name="q1:1_ans1" value="1">', null],
        ['not a STACK question', '<input type="text" class="algebraic" name="q1:1_ans1" value="a">', 'que essay'],
        ['a name that only contains _ans', '<input type="text" class="algebraic" name="q1:1_ans1_val" value="a">', null],
        ['a sub-field of a matrix', '<input type="text" class="algebraic" name="q1:1_ans1_sub_0_0" value="1">', null],
    ])('is not converted: %s', async(label, html, qclass) => {
        const que = question(1, html);
        if (qclass) {
            que.className = qclass;
        }
        const el = que.querySelector('input');
        const value = el.value;
        await attachAll();
        expectNative(que, el, value);
        expect(Bridge.registeredCount()).toBe(0);
    });
});

describe('#102/#104: the supported types do not regress', () => {
    test.each([
        ['algebraic', 'input'],
        ['units', 'input'],
        ['equiv', 'textarea'],
        ['textarea', 'textarea'],
    ])('%s gets its editor', async(type, tag) => {
        const markup = tag === 'input'
            ? `<input type="text" name="q1:1_ans1" id="q1:1_ans1" data-stack-input-type="${type}" value="x">`
            : `<textarea name="q1:1_ans1" id="q1:1_ans1" data-stack-input-type="${type}">x</textarea>`;
        const que = question(1, markup);
        await attachAll();
        expect(que.querySelector('.sme-toggle-input')).not.toBeNull();
        expect(Bridge.registeredCount()).toBe(1);
    });
});

describe('#102/#103/#104: a mixed page', () => {
    /**
     * A question with an algebraic SME field among GeoGebra, Parsons, JSON, numerical, freetext
     * and a JSXGraph custom-binding string field; plus a second question with an equiv field.
     *
     * @returns {Promise<Object>} Elements.
     */
    async function mixed() {
        const que = question(1,
            '<input type="text" name="q1:1_ans1" id="q1:1_ans1" data-stack-input-type="algebraic" value="x^2">'
            + foreignField('geogebra', 'q1:1_ans2', FOREIGN.geogebra)
            + foreignField('string', 'q1:1_ans3', FOREIGN.parsons)
            + foreignField('json', 'q1:1_ans4', FOREIGN.json)
            + foreignField('numerical', 'q1:1_ans5', '2.5')
            + foreignField('freetext', 'q1:1_ans6', FOREIGN.freetext)
            + foreignField('string', 'q1:1_custom', '{"p":[1,2]}'));
        const que2 = question(2, '<textarea name="q1:2_ans1" id="q1:2_ans1" data-stack-input-type="equiv">x=1</textarea>');
        const foreign = ['ans2', 'ans3', 'ans4', 'ans5', 'ans6', 'custom'].map((n) => que.querySelector(`[name="q1:1_${n}"]`));
        const counters = foreign.map(eventCounter);
        await attachAll();
        return {que, que2, foreign, counters};
    }

    test('only the algebraic and the equiv field get an editor', async() => {
        const {que, que2, foreign} = await mixed();
        expect(que.querySelectorAll('.sme-toggle-input').length).toBe(1);
        expect(que2.querySelectorAll('.sme-toggle-input').length).toBe(1);
        expect(Bridge.registeredCount()).toBe(2);
        foreign.forEach((el) => expect(el.closest('.sme-input-wrap')).toBeNull());
    });

    test('a foreign widget writing its field (as JSXGraph, GeoGebra and Parsons do) is not overwritten on submit', async() => {
        const {que, foreign, counters} = await mixed();
        const values = ['[[5,6]]', '[[{"used":[[["s2","s1"]]],"available":[]},1]]', '{"a":[3]}', '7', 'edited', '{"p":[3,4]}'];
        foreign.forEach((el, i) => {
            typeInto(el, values[i]);
        });
        fieldOf(que).latex('x^3');
        await settle();
        SUBMIT_PATHS['pointerdown + click on Check'](que);
        foreign.forEach((el, i) => expect(el.value).toBe(values[i]));
        // Exactly the widget's own input and change: the editor dispatched nothing on them.
        counters.forEach((c) => expect([c.input, c.change, c.keyup]).toEqual([1, 1, 0]));
        expect(que.querySelector('[name="q1:1_ans1"]').value).toBe('x^3');
    });

    test('focus in a foreign field stays there while the editor works', async() => {
        const {que, foreign} = await mixed();
        foreign[0].focus();
        expect(document.activeElement).toBe(foreign[0]);
        fieldOf(que).latex('x+1');
        await settle();
        expect(document.activeElement).toBe(foreign[0]);
        SUBMIT_PATHS['native submit of the form'](que);
        expect(document.activeElement).toBe(foreign[0]);
    });

    test('switching the algebraic editor off and on does not touch the foreign fields', async() => {
        const {que, foreign} = await mixed();
        const before = foreign.map((el) => el.value);
        flip(que);
        flip(que);
        await settle();
        foreign.forEach((el, i) => expect(el.value).toBe(before[i]));
        foreign.forEach((el) => expect(el.style.display).not.toBe('none'));
    });
});

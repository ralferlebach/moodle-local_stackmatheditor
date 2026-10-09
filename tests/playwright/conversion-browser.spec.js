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
 * LaTeX -> Maxima in a real attempt: MathQuill -> tex2max -> the original STACK input (#96).
 *
 * The browser-path scenarios of the former Behat feature tex2max_conversion.feature, with the
 * same inputs and the same assertions. What is checked is always the value of the original
 * STACK input - what STACK receives - never only the editor's DOM.
 *
 * - "enter latex": MathQuill's write() API, exactly as the Behat step did it (latex(''),
 *   write(), blur, input + change on the STACK input).
 * - "press the keys": real key events into the focused field, the typing path where an operator
 *   name inside a word used to be pulled out of it (#58).
 * - "external script": value set on the STACK input plus a change event that does not bubble,
 *   the way STACK's JSXGraph bindings write (#77).
 * - usePercentPi is switched through the admin settings page and handed back afterwards.
 * - A nested root built with the toolbar survives saving the attempt and reloading it (#78/#79).
 *
 * One editor per group of cases: the load quiz has eight algebraic questions, and every test
 * owns one of them, so a value the attempt stores (the quiz autosaves) cannot leak from one test
 * into the next. The attempt is a fresh one per run for the same reason.
 *
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const {test, expect} = require('@playwright/test');
const {env, loginAs, open, openPage, closeLeftovers, requireFixture} = require('./helpers');

// Local reference: 10-40 s per test, the fresh attempt in beforeAll about 15 s.
test.describe.configure({mode: 'default', timeout: 180000});

const STUDENT = 'sme_student17';
const SLOT = {latex: 1, keys: 2, external: 3, pi: 4, roundtrip: 5};

/**
 * Every "I enter latex ... the underlying STACK input should be / contain / not contain" case.
 *
 * The \pi case without usePercentPi is in the pi test, next to its counterpart.
 */
const LATEX_CASES = [
    // Operator keyword protection (#27).
    {latex: 'x=3 or x=6', contains: ['or'], absent: ['o*r']},
    {latex: 'x>0 and x<5', contains: ['and'], absent: ['a*n*d']},
    {latex: '\\neg (x=0)', absent: ['n*o*t', '#g']},
    // Mixed fractions (#29).
    {latex: '2\\frac{1}{2}', is: '(2+1/2)'},
    {latex: '21\\frac{3}{4}', is: '(21+3/4)'},
    {latex: '\\frac{1}{2}', is: '(1)/(2)'},
    // Plus-minus and minus-plus expansion (#30, #49).
    {latex: 'x=\\pm 2', is: '(x=2) nounor (x=-2)', absent: ['x=+2']},
    {latex: 'a\\pm b', is: '(a+b) nounor (a-b)'},
    {latex: 'x=a\\pm b\\mp c', is: '(x=a+b-c) nounor (x=a-b+c)'},
    {latex: 'x=\\mp 2', is: '(x=-2) nounor (x=2)', absent: ['+']},
    {latex: 'x=a\\left(\\pm b+c\\right)', contains: ['(b+c)', '(-b+c)', 'nounor']},
    // Square root (#39).
    {latex: 'x=-\\frac{p}{2}\\pm\\sqrt{\\frac{p^2}{4-q}}', contains: ['sqrt((p^2)/(4-q))'],
        absent: ['s*q*r*t', '\\pm']},
    // Set theory and logic (#35).
    {latex: 'x\\notin A', is: 'not elementp(x,A)'},
    {latex: 'x\\in A\\cup B', is: 'elementp(x,union(A,B))'},
    {latex: 'A\\subset B', is: '(subsetp(A,B) and A#B)'},
    {latex: 'p\\land q\\lor r', is: 'p and q or r'},
    {latex: 'p\\Leftarrow q', is: 'q implies p'},
    // A multi-character subscript written back into the editor (#59).
    {latex: 'U_{max}', is: 'U_max'},
    // Nesting (#78, #79).
    {latex: '\\sqrt{\\sqrt{x}}', is: 'sqrt(sqrt(x))'},
    {latex: '\\sqrt{\\sqrt{\\sqrt{x}}}', is: 'sqrt(sqrt(sqrt(x)))'},
    {latex: '\\left|1+\\left|x\\right|\\right|', is: 'abs(1+abs(x))'},
];

/**
 * Identifiers and functions typed on the keyboard (#58, #59).
 */
const KEY_CASES = [
    {typed: 'Umax', is: 'Umax', latex: 'Umax'},
    {typed: 'Umin', is: 'Umin', latex: 'Umin'},
    {typed: 'argmax', is: 'argmax', latex: 'argmax'},
    {typed: 'maximum', is: 'maximum', latex: 'maximum'},
    {typed: 'sinvalue', is: 'sinvalue', latex: 'sinvalue'},
    {typed: 'max(x,y)', is: 'max(x,y)'},
    {typed: 'U_max', is: 'U_max', latex: 'U_{max}'},
];

const ADMIN = () => ({user: env('SME_ADMIN_USER', 'admin'), pass: env('SME_ADMIN_PASS')});
const PERCENTPI = 'input[type="checkbox"][name="s_local_stackmatheditor_usepercentpi"]';

// The site's usePercentPi as this file found it, handed back in afterAll.
let percentPiBefore = null;

/**
 * Open the student's attempt of the load quiz, starting a fresh one if asked.
 *
 * A fresh attempt is the only way to an editor that nothing was stored for: the quiz autosaves,
 * and a stored relation like "x>0 and x<5" would come back as a system editor.
 *
 * @param {import('@playwright/test').Page} page Logged-in student page.
 * @param {boolean} fresh Finish an attempt in progress and start a new one.
 * @returns {Promise<void>}
 */
async function attempt(page, fresh) {
    const cmid = env('SME_LOAD_CMID');
    await open(page, `/mod/quiz/view.php?id=${cmid}`);
    const resume = page.getByRole('button', {name: /Continue your attempt|Continue the last attempt/});
    if (fresh && await resume.count()) {
        await resume.click();
        await page.waitForURL(/attempt\.php/);
        const id = new URL(page.url()).searchParams.get('attempt');
        await open(page, `/mod/quiz/summary.php?attempt=${id}&cmid=${cmid}`);
        await page.getByRole('button', {name: 'Submit all and finish'}).click();
        await page.getByRole('dialog').getByRole('button', {name: 'Submit all and finish'}).click();
        await page.waitForURL(/review\.php/, {timeout: 90000});
        await open(page, `/mod/quiz/view.php?id=${cmid}`);
    }
    await page.getByRole('button',
        {name: /Attempt quiz|Re-attempt quiz|Continue your attempt|Continue the last attempt/}).click();
    const start = page.getByRole('button', {name: /Start attempt/});
    if (await start.count()) {
        await start.click();
    }
    await ready(page);
}

/**
 * Wait until the editors of the attempt page are built and their pre-fill has settled.
 *
 * @param {import('@playwright/test').Page} page Student page.
 * @returns {Promise<void>}
 */
async function ready(page) {
    await page.waitForURL(/attempt\.php/);
    await page.locator('.que.stack .mq-editable-field').first().waitFor({timeout: 60000});
    // The pre-fill takes two ticks after the field is created; STACK's validation a moment more.
    await page.waitForTimeout(1000);
}

/**
 * Selector of the original STACK input of a slot.
 *
 * @param {number} slot Quiz slot.
 * @returns {string} CSS selector.
 */
function inputOf(slot) {
    return `input[name$=":${slot}_ans1"]`;
}

/**
 * The editor's LaTeX and the STACK input's value of one slot.
 *
 * @param {import('@playwright/test').Page} page Student page.
 * @param {number} slot Quiz slot.
 * @returns {Promise<Object>} {latex, value}; latex is null when the slot has no single-line editor.
 */
function state(page, slot) {
    return page.evaluate((selector) => {
        const input = document.querySelector(selector);
        const wrap = input && input.previousElementSibling;
        const field = wrap && wrap.classList.contains('sme-input-wrap')
            ? wrap.querySelector('.sme-mq-container > .mq-editable-field') : null;
        const MQ = window.MathQuill.getInterface(2);
        return {latex: field ? MQ(field).latex() : null, value: input ? input.value : null};
    }, inputOf(slot));
}

/**
 * Wait for the STACK input to settle and return its value.
 *
 * The edit handler writes synchronously, STACK's validation listener a moment later; two equal
 * reads 150 ms apart, after the value has left the given previous one, count as settled.
 *
 * @param {import('@playwright/test').Page} page Student page.
 * @param {number} slot Quiz slot.
 * @param {?string} previous Value before the action; null skips that wait.
 * @returns {Promise<string>} The settled value.
 */
async function settled(page, slot, previous) {
    let last = null;
    const until = Date.now() + 5000;
    while (Date.now() < until) {
        const value = (await state(page, slot)).value;
        if ((previous === null || value !== previous) && value === last) {
            return value;
        }
        last = value;
        await page.waitForTimeout(150);
    }
    return last;
}

/**
 * Empty the editor of a slot through MathQuill, so the edit handler empties the STACK input.
 *
 * Setup, not the path under test: every case starts from an empty editor, as every Behat
 * scenario started from a fresh attempt.
 *
 * @param {import('@playwright/test').Page} page Student page.
 * @param {number} slot Quiz slot.
 * @returns {Promise<void>}
 */
async function clear(page, slot) {
    const result = await page.evaluate((selector) => {
        const input = document.querySelector(selector);
        const wrap = input && input.previousElementSibling;
        const field = wrap && wrap.querySelector('.sme-mq-container > .mq-editable-field');
        if (!field) {
            return 'no single-line editor before ' + selector;
        }
        window.MathQuill.getInterface(2)(field).latex('');
        return 'ok';
    }, inputOf(slot));
    expect(result).toBe('ok');
    await expect.poll(async() => (await state(page, slot)).value, {timeout: 3000}).toBe('');
}

/**
 * Enter LaTeX the way the Behat step "I enter latex ... into the MathQuill field" did.
 *
 * @param {import('@playwright/test').Page} page Student page.
 * @param {number} slot Quiz slot.
 * @param {string} latex LaTeX to write.
 * @returns {Promise<string>} The settled STACK input value.
 */
async function enterLatex(page, slot, latex) {
    const before = (await state(page, slot)).value;
    const result = await page.evaluate(({selector, tex}) => {
        const input = document.querySelector(selector);
        const container = input.closest('.que').querySelector('.sme-mq-container');
        const editable = container && container.querySelector('.mq-editable-field');
        if (!editable) {
            return 'no-mq-editable';
        }
        const field = window.MathQuill.getInterface(2)(editable);
        field.latex('');
        field.write(tex);
        field.blur();
        input.dispatchEvent(new Event('input', {bubbles: true}));
        input.dispatchEvent(new Event('change', {bubbles: true}));
        return 'ok';
    }, {selector: inputOf(slot), tex: latex});
    expect(result, `enter latex ${latex}`).toBe('ok');
    return settled(page, slot, before === '' ? '' : null);
}

/**
 * Write into the STACK input the way an external script does (#77): no bubbling, no focus.
 *
 * @param {import('@playwright/test').Page} page Student page.
 * @param {number} slot Quiz slot.
 * @param {string} value Value to write.
 * @returns {Promise<void>}
 */
async function externalWrite(page, slot, value) {
    await page.evaluate(({selector, v}) => {
        const input = document.querySelector(selector);
        input.value = v;
        input.dispatchEvent(new Event('change'));
    }, {selector: inputOf(slot), v: value});
    // The Behat step waited a second; the adoption is synchronous, STACK's validation is not.
    await page.waitForTimeout(1000);
}

/**
 * Check one case's value against its expectations.
 *
 * @param {string} label Case label for the message.
 * @param {string} value Actual STACK input value.
 * @param {Object} expected {is, contains[], absent[]}.
 * @returns {string[]} One message per failed expectation.
 */
function check(label, value, expected) {
    const failures = [];
    if (expected.is !== undefined && value !== expected.is) {
        failures.push(`${label}: STACK input is "${value}", expected "${expected.is}"`);
    }
    (expected.contains || []).forEach((part) => {
        if (!String(value).includes(part)) {
            failures.push(`${label}: STACK input "${value}" does not contain "${part}"`);
        }
    });
    (expected.absent || []).forEach((part) => {
        if (String(value).includes(part)) {
            failures.push(`${label}: STACK input "${value}" unexpectedly contains "${part}"`);
        }
    });
    return failures;
}

/**
 * Set the site's usePercentPi through Site administration and read it back.
 *
 * @param {import('@playwright/test').Page} page Logged-in administrator page.
 * @param {?boolean} value New value; null only reads.
 * @returns {Promise<boolean>} The value the site had before.
 */
async function percentPi(page, value) {
    await open(page, '/admin/settings.php?section=local_stackmatheditor');
    const box = page.locator(PERCENTPI);
    const before = await box.isChecked();
    if (value !== null && value !== before) {
        await (value ? box.check() : box.uncheck());
        await page.getByRole('button', {name: 'Save changes'}).click();
        await page.waitForLoadState('domcontentloaded');
        await open(page, '/admin/settings.php?section=local_stackmatheditor');
        await expect(page.locator(PERCENTPI)).toBeChecked({checked: value});
    }
    return before;
}

test.describe('tex2max in the browser: MathQuill -> STACK input (#96)', () => {
    /** @type {import('@playwright/test').Page} */
    let student;
    /** @type {import('@playwright/test').Page} */
    let admin;

    test.beforeAll(async({browser}) => {
        test.setTimeout(240000);
        requireFixture(test, Number(process.env.SME_LOAD_CMID || 0), 'the load quiz (SME_LOAD_CMID)');
        admin = await openPage(browser);
        await loginAs(admin, ADMIN().user, ADMIN().pass);
        // The "pi" case is the default; a site left with %pi by somebody else is put right for
        // this file and handed back afterwards.
        percentPiBefore = await percentPi(admin, false);
        student = await openPage(browser);
        await loginAs(student, STUDENT, env('SME_USER_PASS'));
        await attempt(student, true);
    });

    test.afterAll(async() => {
        if (percentPiBefore !== null) {
            await percentPi(admin, percentPiBefore);
        }
        await closeLeftovers();
    });

    test('LaTeX written through MathQuill arrives in STACK as Maxima', async() => {
        const page = student;
        const failures = [];
        await clear(page, SLOT.latex);
        for (const c of LATEX_CASES) {
            const value = await enterLatex(page, SLOT.latex, c.latex);
            failures.push(...check(`enter latex "${c.latex}"`, value, c));
            await clear(page, SLOT.latex);
        }
        expect(failures, failures.join('\n')).toEqual([]);
    });

    test('identifiers and functions typed on the keyboard stay what was typed', async() => {
        const page = student;
        const failures = [];
        const field = page.locator(`.que:has(${inputOf(SLOT.keys)}) .sme-mq-container`);
        for (const c of KEY_CASES) {
            await clear(page, SLOT.keys);
            await field.click();
            await page.keyboard.type(c.typed);
            const value = await settled(page, SLOT.keys, '');
            const label = `press the keys "${c.typed}"`;
            failures.push(...check(label, value, c));
            if (c.latex) {
                const latex = (await state(page, SLOT.keys)).latex;
                if (!String(latex).includes(c.latex)) {
                    failures.push(`${label}: MathQuill LaTeX "${latex}" does not contain "${c.latex}"`);
                }
            }
        }
        expect(failures, failures.join('\n')).toEqual([]);
    });

    test('a value written into the STACK input from outside reaches the editor and back', async() => {
        const page = student;
        const slot = SLOT.external;
        const failures = [];
        const latexHas = async(label, fragment) => {
            const latex = (await state(page, slot)).latex;
            if (!String(latex).includes(fragment)) {
                failures.push(`${label}: MathQuill LaTeX "${latex}" does not contain "${fragment}"`);
            }
        };
        const valueIs = async(label, expected) => {
            failures.push(...check(label, (await state(page, slot)).value, {is: expected}));
        };

        // A value written from outside appears in the editor.
        await clear(page, slot);
        await externalWrite(page, slot, '2');
        await latexHas('external "2"', '2');
        await valueIs('external "2"', '2');

        // The editor still writes back after an external change.
        await clear(page, slot);
        await externalWrite(page, slot, '2');
        failures.push(...check('external "2", then enter latex "3"', await enterLatex(page, slot, '3'), {is: '3'}));

        // Alternating changes do not drift.
        await clear(page, slot);
        await externalWrite(page, slot, '2');
        await enterLatex(page, slot, '3');
        await externalWrite(page, slot, '4');
        await latexHas('external "2", latex "3", external "4"', '4');
        await valueIs('external "2", latex "3", external "4"', '4');

        // A nested root comes back into the editor unchanged.
        await clear(page, slot);
        await externalWrite(page, slot, 'sqrt(sqrt(x))');
        await latexHas('external "sqrt(sqrt(x))"', '\\sqrt{\\sqrt{x}}');
        await valueIs('external "sqrt(sqrt(x))"', 'sqrt(sqrt(x))');

        expect(failures, failures.join('\n')).toEqual([]);
    });

    test('pi is "pi" by default and "%pi" with usePercentPi', async() => {
        const page = student;
        const slot = SLOT.pi;

        await clear(page, slot);
        expect(await enterLatex(page, slot, '\\pi'), 'enter latex "\\pi", usePercentPi off').toBe('pi');

        try {
            await percentPi(admin, true);
            // The setting reaches the page with the next rendering of it, as in the Behat step.
            await page.reload();
            await ready(page);
            await clear(page, slot);
            expect(await enterLatex(page, slot, '\\pi'), 'enter latex "\\pi", usePercentPi on').toBe('%pi');
        } finally {
            await percentPi(admin, false);
        }
    });

    test('a nested root typed on the keyboard survives saving and reloading the attempt', async() => {
        const page = student;
        const slot = SLOT.roundtrip;
        const que = page.locator(`.que:has(${inputOf(slot)})`);

        await clear(page, slot);
        await que.locator('.sme-mq-container').click();
        // MathQuill's own command entry: a backslash, the name, a space - the cursor is then in
        // the radicand. (The toolbar's square root button leaves the cursor after the empty
        // root, see the report of #96, so it cannot build a nested root by clicks alone.)
        await page.keyboard.type('\\sqrt ');
        await page.keyboard.type('\\sqrt ');
        await page.keyboard.type('x');
        expect(await settled(page, slot, '')).toBe('sqrt(sqrt(x))');
        expect((await state(page, slot)).latex).toBe('\\sqrt{\\sqrt{x}}');

        // Leave the page the way a student does - "Finish attempt ..." saves the page - and come
        // back to it from the summary.
        await page.getByRole('button', {name: /Finish attempt/}).click();
        await page.waitForURL(/summary\.php/);
        await page.getByRole('button', {name: 'Return to attempt'}).click();
        await ready(page);
        let after = await state(page, slot);
        expect(after, 'after saving and returning to the attempt')
            .toEqual({latex: '\\sqrt{\\sqrt{x}}', value: 'sqrt(sqrt(x))'});

        // And a plain reload of the stored page shows the same.
        await page.reload();
        await ready(page);
        after = await state(page, slot);
        expect(after, 'after reloading the attempt page')
            .toEqual({latex: '\\sqrt{\\sqrt{x}}', value: 'sqrt(sqrt(x))'});
    });
});

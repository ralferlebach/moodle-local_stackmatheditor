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
 * #100 / #101: the answer a student sees is the answer Moodle stores.
 *
 * Real interaction only: the switch is clicked, the visible field is typed into with the
 * keyboard, STACK's Check button is clicked, tapped or pressed. Hidden inputs are only read, never
 * written. Each case compares three things:
 *
 * - the value in the request the Check button sends (multipart form data of the attempt);
 * - the value the question engine stored for the attempt (attempt-state.php, read-only);
 * - what the page shows after the reload that follows the Check.
 *
 * The quiz (seed.php, SME_VISIBLE_CMID): slots 1 and 2 algebraic inputs, slot 3 a STACK equiv
 * input with the prescribed first line 1+2*3^3 (firstline, mustverify), slot 4 a textarea input.
 *
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const {test, expect} = require('@playwright/test');
const {execFileSync} = require('child_process');
const {env, loginAs, open, openPage, closeLeftovers, requireFixture} = require('./helpers');

test.describe.configure({mode: 'default', timeout: 180000});

const STUDENT = 'sme_student13';
const STORAGE_KEY = 'local_stackmatheditor_editor_off';
const CHAIN = ['1+2*3^3', '1+2*27', '1+54', '55'];
const FIRSTLINE_MESSAGE = 'You have used the wrong first line in your argument!';

/**
 * Selector of the original input of a slot.
 *
 * @param {number} slot Slot.
 * @returns {string} Selector.
 */
const field = (slot) => `[name$=":${slot}_ans1"]`;

/**
 * Selector of the question of a slot.
 *
 * @param {number} slot Slot.
 * @returns {string} Selector.
 */
const que = (slot) => `.que:has(${field(slot)})`;

/**
 * What the question engine stored for the student's latest attempt.
 *
 * @returns {Object} attempt-state.php output.
 */
function stored() {
    return JSON.parse(execFileSync('php', [__dirname + '/attempt-state.php', STUDENT, env('SME_VISIBLE_CMID')])
        .toString());
}

/**
 * Normalise the line breaks of a form value.
 *
 * @param {string} value Value.
 * @returns {string} Value with \n line breaks.
 */
const lines = (value) => String(value).replace(/\r\n?/g, '\n');

/**
 * The value of one field in a multipart/form-data or url-encoded request body.
 *
 * @param {import('@playwright/test').Request} request The request.
 * @param {number} slot Slot.
 * @returns {?string} Value, or null when the field is not in the body.
 */
function posted(request, slot) {
    const body = request.postData() || '';
    const type = request.headers()['content-type'] || '';
    const boundary = (type.match(/boundary=(.+)$/) || [])[1];
    if (boundary) {
        for (const part of body.split('--' + boundary)) {
            const m = part.match(/name="([^"]+)"\r\n\r\n([\s\S]*)\r\n$/);
            if (m && new RegExp(`:${slot}_ans1$`).test(m[1])) {
                return lines(m[2]);
            }
        }
        return null;
    }
    for (const [name, value] of new URLSearchParams(body)) {
        if (new RegExp(`:${slot}_ans1$`).test(name)) {
            return lines(value);
        }
    }
    return null;
}

/**
 * Open the attempt; with fresh, finish the running one and start a new one.
 *
 * @param {import('@playwright/test').Page} page Student page.
 * @param {boolean} fresh Start a new attempt.
 * @returns {Promise<void>}
 */
async function attempt(page, fresh) {
    const cmid = env('SME_VISIBLE_CMID');
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
    await page.waitForURL(/attempt\.php/);
    await ready(page);
}

/**
 * Wait until the editors are built.
 *
 * @param {import('@playwright/test').Page} page Student page.
 * @returns {Promise<void>}
 */
async function ready(page) {
    await page.locator(`${que(1)} .sme-toggle-input`).waitFor({state: 'attached', timeout: 60000});
    // Attached, not visible: with the editor switched off (a remembered choice) it is hidden.
    await page.locator(`${que(3)} .sme-equiv-row`).first().waitFor({state: 'attached', timeout: 60000});
    await page.waitForTimeout(800);
}

/**
 * Switch the editor of a slot on or off by clicking its switch.
 *
 * @param {import('@playwright/test').Page} page Student page.
 * @param {number} slot Slot.
 * @param {boolean} on Editor on.
 * @returns {Promise<void>}
 */
async function editor(page, slot, on) {
    const box = page.locator(`${que(slot)} .sme-toggle-input`);
    if ((await box.isChecked()) !== on) {
        await page.locator(`${que(slot)} .sme-toggle-label`).click();
    }
    await expect(box).toBeChecked({checked: on});
}

/**
 * Replace the content of the now visible original field with typed text.
 *
 * @param {import('@playwright/test').Page} page Student page.
 * @param {number} slot Slot.
 * @param {string} text Text; "\n" is typed as Enter.
 * @returns {Promise<void>}
 */
async function typeVisible(page, slot, text) {
    const el = page.locator(`${que(slot)} ${field(slot)}`);
    await expect(el).toBeVisible();
    await el.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Delete');
    const parts = text.split('\n');
    for (let i = 0; i < parts.length; i += 1) {
        if (i > 0) {
            await page.keyboard.press('Enter');
        }
        await page.keyboard.type(parts[i]);
    }
}

/**
 * Click into the single-line editor of a slot, clear it and type.
 *
 * @param {import('@playwright/test').Page} page Student page.
 * @param {number} slot Slot.
 * @param {string} text Keys to type.
 * @returns {Promise<void>}
 */
async function typeEditor(page, slot, text) {
    await page.locator(`${que(slot)} .sme-mq-container`).click();
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Backspace');
    await page.keyboard.type(text);
    await page.waitForTimeout(300);
}

/**
 * Press the Check button of a slot the given way and return the request it sent.
 *
 * @param {import('@playwright/test').Page} page Student page.
 * @param {number} slot Slot.
 * @param {string} how 'click' | 'keyboard' | 'tap'.
 * @returns {Promise<import('@playwright/test').Request>} The POST request.
 */
async function check(page, slot, how) {
    const button = page.locator(`${que(slot)} [type="submit"][name$="-submit"]`);
    const requested = page.waitForRequest((r) => r.method() === 'POST' && /\/mod\/quiz\//.test(r.url()),
        {timeout: 60000});
    const navigated = page.waitForNavigation({waitUntil: 'domcontentloaded', timeout: 90000});
    if (how === 'keyboard') {
        // STACK's instant validation of the field the student just left can take the focus back
        // while it renders; press Enter only once the Check button has it.
        await expect(async() => {
            await button.focus();
            await expect(button).toBeFocused({timeout: 500});
        }).toPass({timeout: 15000});
        await page.keyboard.press('Enter');
    } else if (how === 'tap') {
        await button.tap();
    } else {
        await button.click();
    }
    const request = await requested;
    await navigated;
    await ready(page);
    return request;
}

/**
 * The value of the original field after the reload.
 *
 * @param {import('@playwright/test').Page} page Student page.
 * @param {number} slot Slot.
 * @returns {Promise<string>} Value.
 */
async function shown(page, slot) {
    return lines(await page.locator(`${que(slot)} ${field(slot)}`).inputValue());
}

test.describe('the visible answer is the stored answer (#100, #101)', () => {
    /** @type {import('@playwright/test').Page} */
    let student;

    test.beforeAll(async({browser}) => {
        requireFixture(test, Number(process.env.SME_VISIBLE_CMID || 0), 'the visible value quiz (SME_VISIBLE_CMID)');
        // hasTouch: the tap case runs through the touch pipeline, the others are unaffected.
        student = await openPage(browser, {hasTouch: true});
        await loginAs(student, STUDENT, env('SME_USER_PASS'));
        await attempt(student, true);
    });

    test.afterAll(async() => {
        if (student) {
            await student.evaluate((key) => window.localStorage.removeItem(key), STORAGE_KEY).catch(() => undefined);
        }
        await closeLeftovers();
    });

    test.beforeEach(async() => {
        // Every case starts with the editors on.
        await student.evaluate((key) => window.localStorage.removeItem(key), STORAGE_KEY);
        await student.reload();
        await ready(student);
    });

    for (const how of ['click', 'keyboard', 'tap']) {
        test(`editor off, the visible input changed, Check by ${how}: exactly that value is sent and stored`,
            async() => {
                const page = student;
                await typeEditor(page, 1, 'x+1');
                await editor(page, 1, false);
                await typeVisible(page, 1, '2*2=4');

                const request = await check(page, 1, how);

                expect(posted(request, 1)).toBe('2*2=4');
                expect(stored().slots['1'].vars.ans1).toBe('2*2=4');
                // The switch is remembered: after the reload the plain input shows the stored value.
                expect(await shown(page, 1)).toBe('2*2=4');
            });
    }

    test('editor on: the last visible MathQuill value is sent', async() => {
        const page = student;
        await editor(page, 1, true);
        await typeEditor(page, 1, 'a+b');
        const request = await check(page, 1, 'click');
        expect(posted(request, 1)).toBe('a+b');
        expect(stored().slots['1'].vars.ans1).toBe('a+b');
        expect(await shown(page, 1)).toBe('a+b');
    });

    test('on, off, edit, on, Check: the value typed while off survives', async() => {
        const page = student;
        await typeEditor(page, 1, 'x+1');
        await editor(page, 1, false);
        await typeVisible(page, 1, '3 * x');
        await editor(page, 1, true);
        const request = await check(page, 1, 'click');
        // Not rewritten in the editor's spelling either: nobody changed the editor afterwards.
        expect(posted(request, 1)).toBe('3 * x');
        expect(stored().slots['1'].vars.ans1).toBe('3 * x');
    });

    test('off, edit, on, edit in the editor, Check: the editor value is sent', async() => {
        const page = student;
        await editor(page, 1, false);
        await typeVisible(page, 1, 'y');
        await editor(page, 1, true);
        await typeEditor(page, 1, 'z^2');
        const request = await check(page, 1, 'click');
        expect(posted(request, 1)).toBe('z^2');
        expect(stored().slots['1'].vars.ans1).toBe('z^2');
    });

    test('two inputs: one off, one on - no value crosses over', async() => {
        const page = student;
        await typeEditor(page, 2, 'b+1');
        await editor(page, 1, false);
        await typeVisible(page, 1, 'a-1');
        const request = await check(page, 1, 'click');
        expect(posted(request, 1)).toBe('a-1');
        expect(posted(request, 2)).toBe('b+1');
        const state = stored().slots;
        expect(state['1'].vars.ans1).toBe('a-1');
        expect(state['2'].vars.ans1).toBe('b+1');
    });

    test('equiv: the prescribed first line is shown, the four-line chain is sent, validated and graded',
        async() => {
            const page = student;
            const row = (i) => page.locator(`${que(3)} .sme-equiv-row`).nth(i);
            // STACK's firstline syntax hint: the first line is there in the textarea and in the editor.
            await attempt(page, true);
            expect(await shown(page, 3)).toBe(CHAIN[0]);
            await expect(page.locator(`${que(3)} .sme-equiv-row`)).toHaveCount(1);
            expect(await row(0).locator('.mq-editable-field').evaluate(
                (el) => window.MathQuill.getInterface(2)(el).latex())).toBe('1+2\\cdot3^{3}');

            // Enter copies the step; the copy is replaced by the next line.
            await row(0).locator('.mq-editable-field').click();
            await page.keyboard.press('End');
            for (const next of ['1+2*27', '1+54', '55']) {
                await page.keyboard.press('Enter');
                await page.keyboard.press('Control+a');
                await page.keyboard.type(next);
            }
            await page.waitForTimeout(500);
            expect(await page.locator(`${que(3)} ${field(3)}`).inputValue()).toBe(CHAIN.join('\n'));

            // mustverify: the first Check validates, the second grades.
            let request = await check(page, 3, 'click');
            expect(posted(request, 3)).toBe(CHAIN.join('\n'));
            await expect(page.locator(`${que(3)} .sme-equiv-row`)).toHaveCount(4);
            request = await check(page, 3, 'click');
            expect(posted(request, 3)).toBe(CHAIN.join('\n'));
            const slot = stored().slots['3'];
            expect(lines(slot.vars.ans1)).toBe(CHAIN.join('\n'));
            expect(slot.fraction).toBe(1);
            expect(await page.locator(que(3)).innerText()).not.toContain(FIRSTLINE_MESSAGE);
        });

    test('equiv: a deliberately omitted first line stays omitted and gets STACK\'s first-line message',
        async() => {
            const page = student;
            await editor(page, 3, false);
            const typed = CHAIN.slice(1).join('\n');
            await typeVisible(page, 3, typed);
            let request = await check(page, 3, 'click');
            expect(posted(request, 3)).toBe(typed);
            request = await check(page, 3, 'click');
            expect(posted(request, 3)).toBe(typed);

            // Nothing restored the prescribed line: what STACK assessed is what was typed, and its
            // answer is about the first line - a rule of the question, not a transfer error.
            expect(lines(stored().slots['3'].vars.ans1)).toBe(typed);
            expect(await shown(page, 3)).toBe(typed);
            expect(await page.locator(que(3)).innerText()).toContain(FIRSTLINE_MESSAGE);

            // Back on: the editor shows the three lines, not four.
            await editor(page, 3, true);
            await expect(page.locator(`${que(3)} .sme-equiv-row`)).toHaveCount(3);
        });

    test('equiv: fractions, powers and an invalid line arrive exactly and survive off/on, reload and a revisit',
        async() => {
            const page = student;
            await attempt(page, true);
            const typed = ['1+2*3^3', '1+2*27/1', '1+*54', '(110)/2', '55^1'].join('\n');
            await editor(page, 3, false);
            await typeVisible(page, 3, typed);
            // On and off again without an edit in the editor: the lines are not rewritten.
            await editor(page, 3, true);
            await expect(page.locator(`${que(3)} .sme-equiv-row`)).toHaveCount(5);
            await expect(page.locator(que(3)).getByRole('button', {name: 'Add line', exact: true})).toBeVisible();
            await editor(page, 3, false);
            expect(await shown(page, 3)).toBe(typed);

            const request = await check(page, 3, 'keyboard');
            expect(posted(request, 3)).toBe(typed);
            expect(lines(stored().slots['3'].vars.ans1)).toBe(typed);
            // STACK validated what arrived and objects to the invalid line, not to a lost one.
            await expect(page.locator(`${que(3)} .stackinputfeedback`).first()).toBeVisible();
            expect(await shown(page, 3)).toBe(typed);

            // A revisit: leave the attempt and continue it.
            await editor(page, 3, true);
            await open(page, `/mod/quiz/view.php?id=${env('SME_VISIBLE_CMID')}`);
            await attempt(page, false);
            expect(await shown(page, 3)).toBe(typed);
            await expect(page.locator(`${que(3)} .sme-equiv-row`)).toHaveCount(5);
            // The line controls are there and work on the restored chain.
            await page.locator(`${que(3)} .sme-equiv-row`).nth(4).locator('.sme-equiv-del').click();
            await expect(page.locator(`${que(3)} .sme-equiv-row`)).toHaveCount(4);
            await expect.poll(async() => shown(page, 3)).toBe(typed.split('\n').slice(0, 4).join('\n'));
        });

    test('equiv: a wrong step is sent as typed and STACK answers about the step, not the first line', async() => {
        const page = student;
        await attempt(page, true);
        const wrong = ['1+2*3^3', '1+2*27', '1+50', '55'].join('\n');
        await editor(page, 3, false);
        await typeVisible(page, 3, wrong);
        await editor(page, 3, true);
        let request = await check(page, 3, 'click');
        expect(posted(request, 3)).toBe(wrong);
        request = await check(page, 3, 'click');
        expect(posted(request, 3)).toBe(wrong);
        const slot = stored().slots['3'];
        expect(lines(slot.vars.ans1)).toBe(wrong);
        expect(slot.fraction).toBe(0);
        // A wrong step and a missing first line are different findings: STACK's answer here is
        // not the first-line message, and the chain it shows is the one that was typed.
        const text = await page.locator(que(3)).innerText();
        expect(text).not.toContain(FIRSTLINE_MESSAGE);
        // EquivFirst marks the steps: the first line accepted, the second equivalent, the third -
        // the wrong one - and everything after it not equivalent.
        expect(slot.summary).toContain('ATEquivFirst:(EMPTYCHAR,CHECKMARK,QMCHAR,QMCHAR)');
        await expect(page.locator(`${que(3)} .sme-equiv-row`)).toHaveCount(4);
    });

    test('equiv: an emptied textarea sends nothing and nothing is put back', async() => {
        const page = student;
        await attempt(page, true);
        expect(await shown(page, 3)).toBe(CHAIN[0]);
        await editor(page, 3, false);
        await typeVisible(page, 3, '');
        const request = await check(page, 3, 'click');
        expect(posted(request, 3)).toBe('');
        expect(stored().slots['3'].vars.ans1 || '').toBe('');
    });

    test('a question replaced three times keeps one flush per field and shows the stored value', async() => {
        const page = student;
        await attempt(page, true);
        await typeEditor(page, 1, 'k+2');
        await check(page, 1, 'click');
        const replace = () => page.evaluate(async(selector) => {
            const html = await (await fetch(window.location.href, {credentials: 'same-origin'})).text();
            const doc = new DOMParser().parseFromString(html, 'text/html');
            document.querySelector(selector).replaceWith(document.importNode(doc.querySelector(selector), true));
        }, que(1));
        const flushes = () => page.evaluate(() => new Promise((resolve) => {
            window.require(['local_stackmatheditor/stack_bridge'], (bridge) => resolve(bridge.registeredCount()));
        }));
        for (let i = 0; i < 3; i += 1) {
            await replace();
            await page.locator(`${que(1)} .sme-toggle-input`).waitFor({state: 'attached', timeout: 30000});
            await page.waitForTimeout(800);
            expect(await flushes()).toBe(await page.locator('.que.stack [data-sme-init="1"]').count());
        }
        // The replacement was rendered with the stored answer: the editor starts from it.
        expect(await page.locator(`${que(1)} .mq-editable-field`).first().evaluate(
            (el) => window.MathQuill.getInterface(2)(el).latex())).toBe('k+2');
        // Untouched, it sends the stored value unchanged; switched off, the field is the answer.
        await editor(page, 1, false);
        await typeVisible(page, 1, 'k+3');
        const request = await check(page, 1, 'tap');
        expect(posted(request, 1)).toBe('k+3');
        expect(stored().slots['1'].vars.ans1).toBe('k+3');
    });

    test('textarea: editor off, lines changed, Check: exactly the visible lines are stored', async() => {
        const page = student;
        await editor(page, 4, false);
        await typeVisible(page, 4, 'x=1\ny=2');
        const request = await check(page, 4, 'click');
        expect(posted(request, 4)).toBe('x=1\ny=2');
        expect(lines(stored().slots['4'].vars.ans1)).toBe('x=1\ny=2');
        expect(await shown(page, 4)).toBe('x=1\ny=2');
    });

    test('a question replaced in the page: no stale flush, and the new editor sends its own value', async() => {
        const page = student;
        // Replace question 1 with a freshly rendered copy, as CAPQuiz or StackMathGame do. The
        // editor's observer attaches to the new input by itself.
        await page.evaluate(async(selector) => {
            const html = await (await fetch(window.location.href, {credentials: 'same-origin'})).text();
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const fresh = doc.querySelector(selector);
            const old = document.querySelector(selector);
            old.replaceWith(document.importNode(fresh, true));
        }, que(1));
        await page.locator(`${que(1)} .sme-toggle-input`).waitFor({state: 'attached', timeout: 30000});
        await page.waitForTimeout(800);

        const count = await page.evaluate(() => new Promise((resolve) => {
            window.require(['local_stackmatheditor/stack_bridge'], (bridge) => resolve(bridge.registeredCount()));
        }));
        // One flush per original input on the page - the replaced one is gone, not doubled.
        expect(count).toBe(await page.locator('.que.stack [data-sme-init="1"]').count());

        await typeEditor(page, 1, 'q+1');
        const request = await check(page, 1, 'click');
        expect(posted(request, 1)).toBe('q+1');
        expect(stored().slots['1'].vars.ans1).toBe('q+1');
    });

    test('a replaced equiv question: keys, focus, adding and removing lines and validation still work',
        async() => {
            const page = student;
            await attempt(page, true);
            await page.evaluate(async(selector) => {
                const html = await (await fetch(window.location.href, {credentials: 'same-origin'})).text();
                const doc = new DOMParser().parseFromString(html, 'text/html');
                document.querySelector(selector).replaceWith(document.importNode(doc.querySelector(selector), true));
            }, que(3));
            await page.locator(`${que(3)} .sme-equiv-row`).first().waitFor({timeout: 30000});
            await page.waitForTimeout(800);

            const rows = page.locator(`${que(3)} .sme-equiv-row`);
            await rows.first().locator('.mq-editable-field').click();
            await page.keyboard.press('End');
            // Enter copies the step, the copy is replaced; the "Add line" button copies again.
            await page.keyboard.press('Enter');
            await page.keyboard.press('Control+a');
            await page.keyboard.type('1+2*27');
            await page.locator(que(3)).getByRole('button', {name: 'Add line', exact: true}).click();
            await expect(rows).toHaveCount(3);
            // The third line is removed again with its remove button.
            await rows.nth(2).locator('.sme-equiv-del').click();
            await expect(rows).toHaveCount(2);
            await expect.poll(async() => lines(await page.locator(`${que(3)} ${field(3)}`).inputValue()))
                .toBe('1+2*3^3\n1+2*27');

            const request = await check(page, 3, 'click');
            expect(posted(request, 3)).toBe('1+2*3^3\n1+2*27');
            expect(lines(stored().slots['3'].vars.ans1)).toBe('1+2*3^3\n1+2*27');
            // STACK validated what arrived: its validation of slot 3 is on the page again.
            await expect(page.locator(`${que(3)} .stackinputfeedback`).first()).toBeVisible();
            await expect(rows).toHaveCount(2);
        });
});


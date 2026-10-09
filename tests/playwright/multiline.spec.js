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
 * The multi-line editor keeps exactly the lines the student sees (#96, formerly the Behat
 * feature multiline_editor.feature; the behaviour itself is #41 and #48).
 *
 * Real key presses into MathQuill, no LaTeX injection: MathQuill's own key handling is part of
 * what is tested. After every step that matters, the original STACK textarea - what STACK
 * receives - is read line by line; "x=1||x=2" means three lines with an empty second one.
 *
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const {test, expect} = require('@playwright/test');
const {env, loginAs, open, openPage, closeLeftovers, requireFixture} = require('./helpers');

// Local reference: 2-5 s per test, opening the attempt in beforeAll about 10 s.
test.describe.configure({mode: 'default', timeout: 120000});

const STUDENT = 'sme_student20';
// The first textarea input of the load quiz (questions 9 and 10 are STACK textarea inputs), and
// its question.
const TEXTAREA = '.que.stack textarea[name$="_ans1"]';
const QUESTION = '.que.stack:has(textarea[name$="_ans1"])';

/**
 * The rows of the multi-line editor and the lines of the STACK textarea.
 *
 * @param {import('@playwright/test').Page} page Student page.
 * @returns {Promise<Object>} {rows, lines}; lines "|"-joined.
 */
function state(page) {
    return page.evaluate((sel) => {
        const area = document.querySelector(sel);
        const que = area.closest('.que');
        return {
            rows: que.querySelectorAll('.sme-equiv-row').length,
            lines: area.value.split(/\r?\n/).join('|'),
        };
    }, TEXTAREA);
}

/**
 * Assert the number of rows and, when given, the lines of the STACK textarea.
 *
 * Polls for up to three seconds, as the Behat steps did: the editor syncs debounced.
 *
 * @param {import('@playwright/test').Page} page Student page.
 * @param {string} step What was just done, for the message.
 * @param {?number} rows Expected number of rows, or null.
 * @param {?string} lines Expected lines "|"-joined, or null.
 * @returns {Promise<void>}
 */
async function expectState(page, step, rows, lines) {
    if (rows !== null) {
        await expect.poll(async() => (await state(page)).rows,
            {message: `${step}: number of editor rows`, timeout: 3000}).toBe(rows);
    }
    if (lines !== null) {
        await expect.poll(async() => (await state(page)).lines,
            {message: `${step}: lines of the STACK textarea`, timeout: 3000}).toBe(lines);
    }
}

/**
 * Click into one row of the editor and put the cursor at its end.
 *
 * The Behat step focused the row through MathQuill's API; a click and End is what a student does.
 *
 * @param {import('@playwright/test').Page} page Student page.
 * @param {number} row 1-based row number.
 * @returns {Promise<void>}
 */
async function focusRow(page, row) {
    const que = page.locator(QUESTION).first();
    await que.locator('.sme-equiv-row').nth(row - 1).locator('.mq-editable-field').first().click();
    await page.keyboard.press('End');
}

test.describe('multi-line editor for STACK textarea inputs (#96)', () => {
    /** @type {import('@playwright/test').Page} */
    let student;

    test.beforeAll(async({browser}) => {
        requireFixture(test, Number(process.env.SME_LOAD_CMID || 0), 'the load quiz (SME_LOAD_CMID)');
        student = await openPage(browser);
        await loginAs(student, STUDENT, env('SME_USER_PASS'));
        await open(student, `/mod/quiz/view.php?id=${env('SME_LOAD_CMID')}`);
        await student.getByRole('button',
            {name: /Attempt quiz|Re-attempt quiz|Continue your attempt|Continue the last attempt/}).click();
        const start = student.getByRole('button', {name: /Start attempt/});
        if (await start.count()) {
            await start.click();
        }
        await student.waitForURL(/attempt\.php/);
        requireFixture(test, await student.locator(TEXTAREA).count(),
            'a STACK textarea input on the load quiz page');
        await student.locator(QUESTION).first().locator('.sme-equiv-row').first().waitFor({timeout: 60000});
        await student.waitForTimeout(1000);
    });

    test.afterAll(closeLeftovers);

    // Every case starts from one empty line. Setup, not the path under test: an empty value
    // written into the textarea the way an external script writes (#77) - the editor rebuilds
    // from it. A value the attempt stored in an earlier run cannot leak in this way either.
    test.beforeEach(async() => {
        await student.evaluate((sel) => {
            const area = document.querySelector(sel);
            area.value = '';
            area.dispatchEvent(new Event('change'));
        }, TEXTAREA);
        await expectState(student, 'reset', 1, '');
    });

    test('clearing a line keeps it as an empty line; a second Backspace removes it', async() => {
        const page = student;
        await focusRow(page, 1);
        await page.keyboard.type('x=1');
        await page.keyboard.press('Enter');
        await page.keyboard.type('y');
        await page.keyboard.press('Enter');
        await page.keyboard.type('x=2');
        await expectState(page, 'three lines typed', 3, 'x=1|y|x=2');

        await focusRow(page, 2);
        await page.keyboard.press('Backspace');
        await expectState(page, 'first Backspace in row 2', 3, 'x=1||x=2');

        await page.keyboard.press('Backspace');
        await expectState(page, 'second Backspace in row 2', 2, 'x=1|x=2');
    });

    test('Delete removes an already empty line as well', async() => {
        const page = student;
        await focusRow(page, 1);
        await page.keyboard.type('a');
        await page.keyboard.press('Enter');
        await page.keyboard.type('b');
        await page.keyboard.press('Enter');
        await page.keyboard.type('c');
        await expectState(page, 'three lines typed', 3, 'a|b|c');

        await focusRow(page, 2);
        await page.keyboard.press('Backspace');
        await expectState(page, 'Backspace in row 2', 3, 'a||c');

        await page.keyboard.press('Delete');
        await expectState(page, 'Delete in the empty row 2', 2, 'a|c');
    });

    test('the last remaining line is never removed', async() => {
        const page = student;
        await focusRow(page, 1);
        await page.keyboard.type('a');
        await expectState(page, 'typed "a"', 1, 'a');

        await page.keyboard.press('Backspace');
        await page.keyboard.press('Backspace');
        await page.keyboard.press('Delete');
        await expectState(page, 'Backspace, Backspace, Delete', 1, '');
    });

    test('an emptied denominator does not survive the finished fraction', async() => {
        const page = student;
        await focusRow(page, 1);
        await page.keyboard.type('2/12');
        await expectState(page, 'typed "2/12"', null, '(2)/(12)');

        await page.keyboard.press('Backspace');
        await page.keyboard.press('Backspace');
        await expectState(page, 'denominator emptied', null, '(2)/()');

        await page.keyboard.type('6');
        await page.keyboard.press('ArrowUp');
        await page.keyboard.press('Backspace');
        await page.keyboard.type('1');
        await expectState(page, 'numerator replaced', 1, '(1)/(6)');
    });

    test('Enter in an earlier line inserts the new line right after it', async() => {
        const page = student;
        await focusRow(page, 1);
        await page.keyboard.type('a');
        await page.keyboard.press('Enter');
        await page.keyboard.type('c');
        await expectState(page, 'two lines typed', 2, 'a|c');

        // Back to the first line: Enter opens a line between the two, and typing goes there.
        await focusRow(page, 1);
        await page.keyboard.press('Enter');
        await expectState(page, 'Enter at the end of row 1', 3, 'a||c');
        await page.keyboard.type('b');
        await expectState(page, 'typed "b" into the new row', 3, 'a|b|c');
    });

    test('Backspace in an emptied first line removes it and keeps the others in order', async() => {
        const page = student;
        await focusRow(page, 1);
        await page.keyboard.type('a');
        await page.keyboard.press('Enter');
        await page.keyboard.type('b');
        await page.keyboard.press('Enter');
        await page.keyboard.type('c');
        await expectState(page, 'three lines typed', 3, 'a|b|c');

        // The first line is not the last remaining one, so the two-stage rule applies to it too.
        await focusRow(page, 1);
        await page.keyboard.press('Backspace');
        await expectState(page, 'first Backspace in row 1', 3, '|b|c');
        await page.keyboard.press('Backspace');
        await expectState(page, 'second Backspace in row 1', 2, 'b|c');
    });

    /**
     * Turn row 1 into the system x+y=3, x-y=1 with the row's own "+" button.
     *
     * @param {import('@playwright/test').Page} page Student page.
     * @returns {Promise<void>}
     */
    async function buildSystem(page) {
        await focusRow(page, 1);
        await page.keyboard.type('x+y=3');
        await expectState(page, 'typed the first relation', 1, 'x+y=3');
        // The row's "+" copies the current relation into a new sub-row and puts the cursor there.
        await page.locator(QUESTION).first().locator('.sme-equiv-row').first().locator('.sme-equiv-subadd').click();
        await expectState(page, 'sub-row added', 1, '(x+y=3) nounand (x+y=3)');
        await page.keyboard.press('Control+a');
        await page.keyboard.type('x-y=1');
        await expectState(page, 'second relation typed', 1, '(x+y=3) nounand (x-y=1)');
    }

    /**
     * The step numbers the editor shows.
     *
     * @param {import('@playwright/test').Page} page Student page.
     * @returns {Promise<string[]>} Texts of the number column.
     */
    function numbers(page) {
        return page.locator(QUESTION).first().locator('.sme-equiv-num').allInnerTexts();
    }

    test('the "Add line" button adds a line, and the answer follows without a submit (#23)', async() => {
        const page = student;
        await focusRow(page, 1);
        await page.keyboard.type('a');
        await expectState(page, 'typed "a"', 1, 'a');

        await page.locator(QUESTION).first().getByRole('button', {name: 'Add line', exact: true}).click();
        await expectState(page, 'after "Add line"', 2, 'a|');
        await page.keyboard.type('b');
        await expectState(page, 'typed "b" into the new line', 2, 'a|b');
    });

    test('a system row is added, edited, and removed when its sub-row is emptied (#41)', async() => {
        const page = student;
        await buildSystem(page);
        const rows = page.locator(QUESTION).first().locator('.sme-equiv-row').first().locator('.sme-equiv-line');
        await expect(rows).toHaveCount(2);

        // Emptying the second sub-row removes it; the system is a single relation again.
        for (let i = 0; i < 'x-y=1'.length; i += 1) {
            await page.keyboard.press('Backspace');
        }
        await expectState(page, 'second sub-row emptied', 1, 'x+y=3');
        await expect(rows).toHaveCount(1);
    });

    test('empty lines next to a system leave the system as it is (#41)', async() => {
        const page = student;
        await buildSystem(page);
        const system = '(x+y=3) nounand (x-y=1)';

        await page.keyboard.press('Enter');
        await expectState(page, 'Enter in the system', 2, `${system}|`);
        await page.keyboard.type('z');
        await expectState(page, 'typed "z"', 2, `${system}|z`);

        await focusRow(page, 1);
        await page.keyboard.press('Enter');
        await expectState(page, 'empty line after the system', 3, `${system}||z`);
    });

    test('the remove buttons work with the mouse, and the numbering follows (#41)', async() => {
        const page = student;
        await focusRow(page, 1);
        await page.keyboard.type('a');
        await page.keyboard.press('Enter');
        await page.keyboard.type('b');
        await page.keyboard.press('Enter');
        await page.keyboard.type('c');
        await expectState(page, 'three lines typed', 3, 'a|b|c');
        expect(await numbers(page)).toEqual(['1', '2', '3']);

        await page.locator(QUESTION).first().locator('.sme-equiv-row').nth(1).locator('.sme-equiv-del').click();
        await expectState(page, 'row 2 removed with the mouse', 2, 'a|c');
        expect(await numbers(page)).toEqual(['1', '2']);

        await focusRow(page, 1);
        await page.locator(QUESTION).first().locator('.sme-equiv-row').first().locator('.sme-equiv-subadd').click();
        await expectState(page, 'sub-row added to row 1', 2, '(a) nounand (a)|c');
        await page.locator(QUESTION).first().locator('.sme-equiv-row').first()
            .locator('.sme-equiv-subdel').nth(1).click();
        await expectState(page, 'sub-row removed with the mouse', 2, 'a|c');
    });

    // #41 asked for inner empty lines to survive saving and reloading. The editor keeps them and
    // the attempt stores them ("a\r\n\r\nc"), but STACK's textarea input drops empty rows when
    // it reads the response (stack_textarea_input::response_to_contents) and renders the answer
    // from what it kept. So after a reload the lines are STACK's: this test pins that boundary,
    // and the editor does not invent the empty line back.
    test('after saving and reloading, the lines are the ones STACK kept (#41)', async() => {
        const page = student;
        await focusRow(page, 1);
        await page.keyboard.type('a');
        await page.keyboard.press('Enter');
        await page.keyboard.press('Enter');
        await page.keyboard.type('c');
        await expectState(page, 'lines with an empty one between', 3, 'a||c');

        // Save the page as a real submit (processattempt.php treats a submit without a navigation
        // button as "save"), then open the attempt again from the quiz page.
        await Promise.all([
            page.waitForNavigation({waitUntil: 'domcontentloaded', timeout: 60000}),
            page.evaluate(() => document.getElementById('responseform').requestSubmit()),
        ]);
        await open(page, `/mod/quiz/view.php?id=${env('SME_LOAD_CMID')}`);
        await page.getByRole('button', {name: /Continue your attempt|Continue the last attempt/}).click();
        await page.waitForURL(/attempt\.php/);
        await page.locator(QUESTION).first().locator('.sme-equiv-row').first().waitFor({timeout: 60000});
        await page.waitForTimeout(1000);
        await expectState(page, 'after saving and reloading', 2, 'a|c');
    });
});

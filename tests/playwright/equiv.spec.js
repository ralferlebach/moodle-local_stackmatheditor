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
 * Reasoning by equivalence (#23): in a STACK "equiv" input, Enter and the "Add line" button copy
 * the current step - a system as a whole - so the student edits the next transformation instead
 * of typing it again. Real key presses; after every step the original STACK textarea is read.
 *
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const {test, expect} = require('@playwright/test');
const {env, loginAs, open, openPage, closeLeftovers, requireFixture} = require('./helpers');

test.describe.configure({mode: 'default', timeout: 120000});

const STUDENT = 'sme_student17';
const TEXTAREA = '.que.stack textarea[name$="_ans1"]';
const QUESTION = '.que.stack:has(textarea[name$="_ans1"])';

/**
 * The rows of the editor, the sub-rows per row, and the lines of the STACK textarea.
 *
 * @param {import('@playwright/test').Page} page Student page.
 * @returns {Promise<Object>} {rows, fields, lines}; fields and lines "|"-joined.
 */
function state(page) {
    return page.evaluate((sel) => {
        const area = document.querySelector(sel);
        const rows = Array.from(area.closest('.que').querySelectorAll('.sme-equiv-row'));
        return {
            rows: rows.length,
            fields: rows.map((row) => row.querySelectorAll('.sme-equiv-line').length).join('|'),
            lines: area.value.split(/\r?\n/).join('|'),
        };
    }, TEXTAREA);
}

/**
 * Wait for the editor rows and the STACK textarea to reach a state.
 *
 * @param {import('@playwright/test').Page} page Student page.
 * @param {string} step What was just done, for the message.
 * @param {number} rows Expected number of rows.
 * @param {string} lines Expected lines "|"-joined.
 * @returns {Promise<void>}
 */
async function expectState(page, step, rows, lines) {
    await expect.poll(async() => (await state(page)).rows,
        {message: `${step}: number of editor rows`, timeout: 3000}).toBe(rows);
    await expect.poll(async() => (await state(page)).lines,
        {message: `${step}: lines of the STACK textarea`, timeout: 3000}).toBe(lines);
}

/**
 * Click into the first field of a row and put the cursor at its end.
 *
 * @param {import('@playwright/test').Page} page Student page.
 * @param {number} row 1-based row number.
 * @returns {Promise<void>}
 */
async function focusRow(page, row) {
    await page.locator(QUESTION).first().locator('.sme-equiv-row').nth(row - 1)
        .locator('.mq-editable-field').first().click();
    await page.keyboard.press('End');
}

test.describe('equivalence reasoning input (#23)', () => {
    /** @type {import('@playwright/test').Page} */
    let student;

    test.beforeAll(async({browser}) => {
        requireFixture(test, Number(process.env.SME_EQUIV_CMID || 0),
            'the equivalence reasoning quiz (SME_EQUIV_CMID)');
        student = await openPage(browser);
        await loginAs(student, STUDENT, env('SME_USER_PASS'));
        await open(student, `/mod/quiz/view.php?id=${env('SME_EQUIV_CMID')}`);
        await student.getByRole('button',
            {name: /Attempt quiz|Re-attempt quiz|Continue your attempt|Continue the last attempt/}).click();
        const start = student.getByRole('button', {name: /Start attempt/});
        if (await start.count()) {
            await start.click();
        }
        await student.waitForURL(/attempt\.php/);
        requireFixture(test, await student.locator(TEXTAREA).count(), 'a STACK equiv input on the page');
        await student.locator(QUESTION).first().locator('.sme-equiv-row').first().waitFor({timeout: 60000});
        await student.waitForTimeout(1000);
    });

    test.afterAll(closeLeftovers);

    // Every case starts from one empty step, written the way an external script writes (#77).
    test.beforeEach(async() => {
        await student.evaluate((sel) => {
            const area = document.querySelector(sel);
            area.value = '';
            area.dispatchEvent(new Event('change'));
        }, TEXTAREA);
        await expectState(student, 'reset', 1, '');
    });

    test('Enter copies the current step, and the copy is what gets edited', async() => {
        const page = student;
        await focusRow(page, 1);
        // The exponent is left with the arrow key, as a student leaves it.
        await page.keyboard.type('x^2');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.type('=4');
        await expectState(page, 'first step typed', 1, 'x^2=4');

        await page.keyboard.press('Enter');
        await expectState(page, 'Enter copied the step', 2, 'x^2=4|x^2=4');

        // The cursor is in the copy: replacing its content changes the second step only.
        await page.keyboard.press('Control+a');
        await page.keyboard.type('x=2');
        await expectState(page, 'second step edited', 2, 'x^2=4|x=2');
    });

    test('Enter in a system copies every relation of it', async() => {
        const page = student;
        await focusRow(page, 1);
        await page.keyboard.type('x+y=3');
        await page.locator(QUESTION).first().locator('.sme-equiv-row').first().locator('.sme-equiv-subadd').click();
        await page.keyboard.press('Control+a');
        await page.keyboard.type('x-y=1');
        const system = '(x+y=3) nounand (x-y=1)';
        await expectState(page, 'system typed', 1, system);

        await page.keyboard.press('Enter');
        await expectState(page, 'Enter in the system', 2, `${system}|${system}`);
        expect((await state(page)).fields).toBe('2|2');
    });

    test('the "Add line" button copies the active step and the answer follows at once', async() => {
        const page = student;
        await focusRow(page, 1);
        await page.keyboard.type('2x=6');
        await expectState(page, 'first step typed', 1, '2x=6');

        await page.locator(QUESTION).first().getByRole('button', {name: 'Add line', exact: true}).click();
        await expectState(page, 'after "Add line"', 2, '2x=6|2x=6');
    });
});

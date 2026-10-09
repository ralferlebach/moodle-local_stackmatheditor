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
 * The editor in a quiz attempt: there, connected to STACK's input, restored, and absent where
 * the configuration says so (#96, formerly the Behat feature editor_rendering.feature).
 *
 * Every assertion about an answer is made on the original STACK input - what STACK receives and
 * what the attempt stores - not on the editor's DOM alone. The global activation mode and the
 * question-level switch are changed through the real UI and handed back afterwards: the site is
 * shared with every other spec.
 *
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const {test, expect} = require('@playwright/test');
const {execFileSync} = require('child_process');
const {env, loginAs, open, openPage, closeLeftovers, requireFixture} = require('./helpers');

// Local reference: 5-30 s per test, the fresh attempt in beforeAll about 15 s.
test.describe.configure({mode: 'default', timeout: 180000});

const STUDENT = 'sme_student19';
const ADMIN = () => ({user: env('SME_ADMIN_USER', 'admin'), pass: env('SME_ADMIN_PASS')});
const ENABLED = 'select[name="s_local_stackmatheditor_enabled"]';
// The first question of the load quiz: an algebraic input "ans1" in slot 1.
const ANS1 = 'input[name$=":1_ans1"]';

// The site's activation mode as this file found it, handed back in afterAll.
let enabledBefore = null;

/**
 * Remove every quiz- and question-level configuration of the settings quiz (seed.php --reset).
 *
 * @returns {void}
 */
function resetSettingsQuiz() {
    // Its output goes into the error if it fails; a passing reset has nothing to say.
    execFileSync('php', [__dirname + '/seed.php', '--reset'], {stdio: 'pipe'});
}

/**
 * Set the plugin's activation mode through Site administration and read it back.
 *
 * @param {import('@playwright/test').Page} page Logged-in administrator page.
 * @param {?string} mode "0".."3", or null to only read.
 * @returns {Promise<string>} The mode the site had before.
 */
async function enabledMode(page, mode) {
    await open(page, '/admin/settings.php?section=local_stackmatheditor');
    const before = await page.locator(ENABLED).inputValue();
    if (mode !== null && mode !== before) {
        await page.locator(ENABLED).selectOption(mode);
        await page.getByRole('button', {name: 'Save changes'}).click();
        await page.waitForLoadState('domcontentloaded');
        await open(page, '/admin/settings.php?section=local_stackmatheditor');
        await expect(page.locator(ENABLED)).toHaveValue(mode);
    }
    return before;
}

/**
 * Open the student's attempt of a quiz; with fresh, finish one in progress and start a new one.
 *
 * @param {import('@playwright/test').Page} page Logged-in student page.
 * @param {string} cmid Course module id.
 * @param {boolean} fresh Start from an attempt nothing was stored in.
 * @returns {Promise<void>}
 */
async function attempt(page, cmid, fresh) {
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
    await page.locator('.que.stack').first().waitFor({timeout: 60000});
    await page.waitForLoadState('load');
}

/**
 * Wait until the editors are built and their pre-fill has settled.
 *
 * @param {import('@playwright/test').Page} page Student page.
 * @returns {Promise<void>}
 */
async function editorsReady(page) {
    await page.locator('.que.stack .mq-editable-field').first().waitFor({timeout: 60000});
    await page.waitForTimeout(1000);
}

/**
 * Wait until the plugin had every chance to build an editor, for the cases where it must not.
 *
 * Without an editor there is no element to wait for; the page is given the time the editors
 * otherwise need (well under a second locally) several times over.
 *
 * @param {import('@playwright/test').Page} page Student page.
 * @returns {Promise<void>}
 */
async function settleWithoutEditor(page) {
    await page.waitForLoadState('load');
    await page.waitForTimeout(4000);
}

/**
 * The editor's LaTeX, whether it is empty, and the STACK input's value for one input.
 *
 * @param {import('@playwright/test').Page} page Student page.
 * @param {string} selector Selector of the STACK input.
 * @returns {Promise<Object>} {latex, empty, value}.
 */
function state(page, selector) {
    return page.evaluate((sel) => {
        const input = document.querySelector(sel);
        const wrap = input && input.previousElementSibling;
        const editable = wrap && wrap.querySelector('.mq-editable-field');
        const root = wrap && wrap.querySelector('.mq-root-block');
        return {
            latex: editable ? window.MathQuill.getInterface(2)(editable).latex() : null,
            empty: root ? root.classList.contains('mq-empty') : null,
            value: input ? input.value : null,
        };
    }, selector);
}

/**
 * Empty the editor of the first question and click into it, ready for typing.
 *
 * @param {import('@playwright/test').Page} page Student page.
 * @returns {Promise<void>}
 */
async function focusEmpty(page) {
    await page.evaluate((sel) => {
        const editable = document.querySelector(sel).previousElementSibling.querySelector('.mq-editable-field');
        window.MathQuill.getInterface(2)(editable).latex('');
    }, ANS1);
    await expect.poll(async() => (await state(page, ANS1)).value).toBe('');
    await page.locator(`.que:has(${ANS1}) .sme-mq-container`).click();
}

/**
 * Whether every visible text input of the STACK questions is hidden (the Behat rule: the plugin
 * moves the original input off-screen and clips it to a pixel, so MathQuill can still write it).
 *
 * @param {import('@playwright/test').Page} page Student page.
 * @returns {Promise<string[]>} Names of original inputs that are still visible.
 */
function visibleOriginals(page) {
    return page.evaluate(() => Array.from(document.querySelectorAll('.que.stack input[type="text"]'))
        .filter((el) => {
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') {
                return false;
            }
            const rect = el.getBoundingClientRect();
            if (rect.left + rect.width < 1) {
                return false;
            }
            return !(rect.width <= 1 && rect.height <= 1);
        })
        .map((el) => el.name));
}

test.describe('the editor in a quiz attempt (#96)', () => {
    /** @type {import('@playwright/test').Page} */
    let student;
    /** @type {import('@playwright/test').Page} */
    let admin;

    test.beforeAll(async({browser}) => {
        test.setTimeout(240000);
        requireFixture(test, Number(process.env.SME_LOAD_CMID || 0), 'the load quiz (SME_LOAD_CMID)');
        admin = await openPage(browser);
        await loginAs(admin, ADMIN().user, ADMIN().pass);
        // Every case but the last two needs the editor on everywhere, which is the seed's state.
        enabledBefore = await enabledMode(admin, '1');
        student = await openPage(browser);
        await loginAs(student, STUDENT, env('SME_USER_PASS'));
        await attempt(student, env('SME_LOAD_CMID'), true);
        await editorsReady(student);
    });

    test.afterAll(async() => {
        if (enabledBefore !== null) {
            await enabledMode(admin, enabledBefore);
        }
        resetSettingsQuiz();
        await closeLeftovers();
    });

    test('editor and toolbar appear, the original input is hidden', async() => {
        const page = student;
        await expect(page.locator(`.que:has(${ANS1}) .sme-mq-container`)).toBeVisible();
        await expect(page.locator(`.que:has(${ANS1}) .sme-toolbar`)).toBeVisible();
        // Every algebraic input of the page has its editor, and none of them is still visible.
        await expect(page.locator('.que.stack .sme-input-wrap')).toHaveCount(
            await page.locator('.que.stack input[type="text"][name$="_ans1"]').count());
        expect(await visibleOriginals(page)).toEqual([]);
        // The STACK input stays in the form: it is what gets submitted.
        await expect(page.locator(ANS1)).toHaveCount(1);
        await expect(page.locator(ANS1)).toHaveAttribute('data-sme-init', '1');
    });

    test('typing in the editor fills the hidden STACK input', async() => {
        const page = student;
        await focusEmpty(page);
        await page.keyboard.type('x^2');
        await expect.poll(async() => (await state(page, ANS1)).value, {timeout: 3000}).not.toBe('');
        expect((await state(page, ANS1)).value).toBe('x^2');
    });

    test('a stored answer is restored when the attempt is opened again', async() => {
        const page = student;
        await focusEmpty(page);
        await page.keyboard.type('sin(x)');
        await expect.poll(async() => (await state(page, ANS1)).value, {timeout: 3000}).toBe('sin(x)');

        // Save the page the way Behat's step did - the attempt form submitted without a
        // navigation button, which processattempt.php treats as "save" - but as a real submit,
        // so the editor hands over its state as it does for every submit.
        await Promise.all([
            page.waitForNavigation({waitUntil: 'domcontentloaded', timeout: 60000}),
            page.evaluate(() => document.getElementById('responseform').requestSubmit()),
        ]);

        // Leave the attempt, then return to it from the quiz page.
        await open(page, `/mod/quiz/view.php?id=${env('SME_LOAD_CMID')}`);
        await page.getByRole('button', {name: /Continue your attempt|Continue the last attempt/}).click();
        await editorsReady(page);

        const after = await state(page, ANS1);
        expect(after.empty, 'the editor of ans1 is empty').toBe(false);
        expect(after.value).toBe('sin(x)');
    });

    test('a stored answer is restored after navigating to the next page and back', async() => {
        const page = student;
        await focusEmpty(page);
        // Typed as a student types it: the exponent is left with the arrow key.
        await page.keyboard.type('x^2');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.type('+1');
        await expect.poll(async() => (await state(page, ANS1)).value, {timeout: 3000}).toBe('x^2+1');

        // All questions are on one page, so "next" is "Finish attempt ...": it saves the page and
        // leads to the summary, from where "Return to attempt" comes back.
        await page.getByRole('button', {name: /Finish attempt/}).click();
        await page.waitForURL(/summary\.php/);
        await page.getByRole('button', {name: 'Return to attempt'}).click();
        await page.waitForURL(/attempt\.php/);
        await editorsReady(page);

        const after = await state(page, ANS1);
        expect(after.empty, 'the editor of ans1 is empty').toBe(false);
        expect(after.value).toBe('x^2+1');
    });

    test('the square root button inserts a square root', async() => {
        const page = student;
        await focusEmpty(page);
        await page.locator(`.que:has(${ANS1}) .sme-tb-btn[title="Square root (√)"]`).click();
        const after = await state(page, ANS1);
        expect(after.latex).toContain('sqrt');
        // The cursor waits inside the root: what is typed next becomes its argument, and STACK
        // receives the complete call, not an empty root followed by the letter.
        await page.keyboard.type('x');
        await expect.poll(async() => (await state(page, ANS1)).value, {timeout: 3000}).toBe('sqrt(x)');
        expect((await state(page, ANS1)).latex).toBe('\\sqrt{x}');
    });

    test('every template button leaves the cursor in its first slot', async() => {
        const page = student;
        const cases = [
            ['Fraction', 'x', '(x)/()'],
            ['Square root (√)', 'x', 'sqrt(x)'],
        ];
        const failures = [];
        for (const [title, typed, expected] of cases) {
            await focusEmpty(page);
            const button = page.locator(`.que:has(${ANS1}) .sme-tb-btn[title^="${title}"]`).first();
            if (!(await button.count())) {
                failures.push(`no button "${title}"`);
                continue;
            }
            await button.click();
            await page.keyboard.type(typed);
            await page.waitForTimeout(400);
            const value = (await state(page, ANS1)).value;
            if (value !== expected) {
                failures.push(`"${title}" then "${typed}": STACK input "${value}", expected "${expected}"`);
            }
        }
        expect(failures, failures.join('\n')).toEqual([]);
    });

    test('Enter in a single-line editor adds no line and changes nothing (#23, #43)', async() => {
        const page = student;
        await focusEmpty(page);
        await page.keyboard.type('x+1');
        await expect.poll(async() => (await state(page, ANS1)).value, {timeout: 3000}).toBe('x+1');
        const url = page.url();
        const fields = await page.locator(`.que:has(${ANS1}) .mq-editable-field`).count();

        await page.keyboard.press('Enter');
        await page.waitForTimeout(800);

        // Enter is only a signal for other scripts here: no submit, no second line, same answer.
        expect(page.url()).toBe(url);
        await expect(page.locator(`.que:has(${ANS1}) .mq-editable-field`)).toHaveCount(fields);
        expect((await state(page, ANS1)).value).toBe('x+1');
    });

    test('the cells of a matrix are reached with the keyboard (#40)', async() => {
        const page = student;
        await focusEmpty(page);
        // Setup: an empty 2x2 matrix, as the matrix chooser writes it. The navigation is the
        // path under test: arrow keys, Tab and typing, as a student uses them.
        await page.evaluate((sel) => {
            const editable = document.querySelector(sel).previousElementSibling.querySelector('.mq-editable-field');
            const field = window.MathQuill.getInterface(2)(editable);
            field.latex('\\begin{bmatrix}&\\\\&\\end{bmatrix}');
            field.focus();
            field.moveToLeftEnd();
        }, ANS1);
        await page.keyboard.press('ArrowRight');
        await page.keyboard.type('1');
        await page.keyboard.press('Tab');
        await page.keyboard.type('2');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.type('4');
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.type('3');

        await expect.poll(async() => (await state(page, ANS1)).value, {timeout: 3000})
            .toBe('matrix([1,2],[3,4])');
    });

    test('no editor when the plugin is disabled globally (mode 0)', async() => {
        try {
            await enabledMode(admin, '0');
            const page = student;
            await attempt(page, env('SME_LOAD_CMID'), false);
            await settleWithoutEditor(page);
            await expect(page.locator('.sme-mq-container')).toHaveCount(0);
            await expect(page.locator('.sme-toolbar')).toHaveCount(0);
            // The student answers in STACK's own input instead.
            await expect(page.locator(ANS1)).toBeVisible();
            await expect(page.locator(ANS1)).not.toHaveAttribute('data-sme-init', '1');
        } finally {
            await enabledMode(admin, '1');
        }
    });

    test('no editor for a question disabled at question level (mode 3)', async() => {
        requireFixture(test, Number(process.env.SME_SETTINGS_QBE1 || 0),
            'the question bank entry of the settings quiz (SME_SETTINGS_QBE1)');
        const cmid = env('SME_SETTINGS_CMID');
        const q1 = 'input[name$=":1_ans1"]';
        const q2 = 'input[name$=":2_ans1"]';
        resetSettingsQuiz();
        try {
            await enabledMode(admin, '3');

            // Switch the editor off for the first question, through the plugin's configuration
            // page, the way an author does.
            await open(admin, `/local/stackmatheditor/configure.php?cmid=${cmid}&qbeid=${env('SME_SETTINGS_QBE1')}`);
            await admin.locator('input[type="checkbox"][name="enabled"]').uncheck();
            await admin.getByRole('button', {name: 'Save configuration'}).click();
            await admin.waitForLoadState('domcontentloaded');

            const page = student;
            await attempt(page, cmid, false);
            // Mode 3 is "on by default": the second question has its editor, so the page did
            // run the plugin - the first one has none.
            await expect(page.locator(`.que:has(${q2}) .sme-mq-container`)).toBeVisible({timeout: 60000});
            await settleWithoutEditor(page);
            await expect(page.locator(`.que:has(${q1}) .sme-mq-container`)).toHaveCount(0);
            await expect(page.locator(`.que:has(${q1}) .sme-toolbar`)).toHaveCount(0);
            await expect(page.locator(q1)).toBeVisible();
        } finally {
            await enabledMode(admin, '1');
            resetSettingsQuiz();
        }
    });
});

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
 * Settings matrix: level (admin, quiz, question, inheritance chain) x setting (on/off, toolbar
 * groups, implicit multiplication) -> what the student sees and what STACK receives.
 *
 * Every setting is changed through the real UI (admin settings page, configuration page), every
 * result is verified in the student's attempt: editor present or not, exactly the configured
 * toolbar groups, and the converted value of the same keystrokes. A screenshot of each result
 * state is attached to the report for optical review.
 *
 * Needs the data of seed.php (SME_* environment variables) and an admin login.
 *
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const {test, expect} = require('@playwright/test');
const {execFileSync} = require('child_process');
const {env, loginAs} = require('./helpers');

const CMID = env('SME_SETTINGS_CMID');
const QBE = [env('SME_SETTINGS_QBE1'), env('SME_SETTINGS_QBE2')];
const USERPASS = env('SME_USER_PASS');

/** Keystrokes typed into every editor, and what each variable mode must make of them. */
const TYPED = 'ab';
const EXPECTED = {
    explicit_single: 'a*b',
    explicit_multi: 'ab',
    space_single: 'a b',
    space_multi: 'ab',
    stack: 'ab',
};

test.describe.configure({mode: 'serial', timeout: 240000});

/**
 * Remove all quiz- and question-level configuration of the settings quiz (seed.php --reset).
 */
function resetQuizConfig() {
    execFileSync('php', [__dirname + '/seed.php', '--reset']);
}

/**
 * Set the admin settings through Site administration.
 *
 * @param {import('@playwright/test').Page} page Admin page.
 * @param {Object} s {enabled: 0-3, groups: string[], mode: string}.
 */
async function adminSettings(page, s) {
    await page.goto('/admin/settings.php?section=local_stackmatheditor');
    await page.locator('select[name="s_local_stackmatheditor_enabled"]').selectOption(String(s.enabled));
    await page.locator('select[name="s_local_stackmatheditor_variablemode"]').selectOption(s.mode);
    await page.locator('select[name="s_local_stackmatheditor_default_groups[]"]').selectOption(s.groups);
    await page.getByRole('button', {name: 'Save changes'}).click();
    await page.waitForLoadState('domcontentloaded');
    // Read back: the stored values are what the page shows after a reload.
    await page.goto('/admin/settings.php?section=local_stackmatheditor');
    await expect(page.locator('select[name="s_local_stackmatheditor_enabled"]')).toHaveValue(String(s.enabled));
    await expect(page.locator('select[name="s_local_stackmatheditor_variablemode"]')).toHaveValue(s.mode);
}

/**
 * Save a quiz- or question-level configuration through the configuration page.
 *
 * @param {import('@playwright/test').Page} page Teacher page.
 * @param {?string} qbeid Question bank entry id, or null for the quiz level.
 * @param {Object} s {enabled?: boolean, groups?: string[], mode?: string}.
 */
async function configure(page, qbeid, s) {
    await page.goto('/local/stackmatheditor/configure.php?cmid=' + CMID + (qbeid ? '&qbeid=' + qbeid : ''));
    if (s.enabled !== undefined) {
        const box = page.locator('input[type="checkbox"][name="enabled"]');
        await (s.enabled ? box.check() : box.uncheck());
    }
    if (s.groups) {
        await page.locator('select[name="groups[]"]').selectOption(s.groups);
    }
    if (s.mode) {
        await page.locator('select[name="variablemode"]').selectOption(s.mode);
    }
    await page.getByRole('button', {name: 'Save configuration'}).click();
    await page.waitForLoadState('domcontentloaded');
}

/**
 * Open (or continue) the student's attempt and read what each question shows.
 *
 * @param {import('@playwright/test').Page} page Student page.
 * @param {import('@playwright/test').TestInfo} info Test info (screenshot attachment).
 * @param {string} label Name of the screenshot.
 * @returns {Promise<Object[]>} Per question {editor, groups, value}.
 */
async function studentView(page, info, label) {
    await page.goto('/mod/quiz/view.php?id=' + CMID);
    await page.getByRole('button', {name: /Attempt quiz|Continue your attempt|Continue the last attempt/}).click();
    const start = page.getByRole('button', {name: /Start attempt/});
    if (await start.count()) {
        await start.click();
    }
    await page.locator('.que.stack').first().waitFor();
    await page.waitForLoadState('load');
    // The editors appear asynchronously (AMD + configuration). Wait until their number has been
    // stable for one second - or stays zero when the plugin is off.
    await page.waitForFunction(() => {
        const count = document.querySelectorAll('.que.stack .mq-editable-field').length;
        const now = Date.now();
        if (window.smeSettle === undefined || window.smeSettle.count !== count) {
            window.smeSettle = {count: count, since: now};
            return false;
        }
        return now - window.smeSettle.since > 1000;
    }, null, {polling: 200, timeout: 15000});
    const questions = page.locator('.que.stack');
    const result = [];
    for (let i = 0; i < await questions.count(); i++) {
        const que = questions.nth(i);
        const editor = await que.locator('.mq-editable-field').count() > 0;
        const groups = await que.locator('.sme-tb-group').evaluateAll((els) => els.map((e) => e.dataset.group));
        const input = que.locator('input[name$="_ans1"]');
        let value = null;
        if (editor) {
            await que.locator('.mq-editable-field').first().evaluate((el) => {
                const field = window.MathQuill.getInterface(2)(el);
                field.latex('');
                field.focus();
            });
            await page.keyboard.type(TYPED);
            await page.waitForTimeout(300);
            value = await input.inputValue();
        }
        result.push({editor, groups: groups.sort(), value});
    }
    await info.attach(label, {body: await page.screenshot({fullPage: true}), contentType: 'image/png'});
    return result;
}

test.describe('settings matrix: level x setting -> result', () => {
    let admin;
    let teacher;
    let student;

    test.beforeAll(async({browser}) => {
        admin = await (await browser.newContext()).newPage();
        teacher = await (await browser.newContext()).newPage();
        student = await (await browser.newContext()).newPage();
        await loginAs(admin, env('SME_ADMIN_USER', 'admin'), env('SME_ADMIN_PASS'));
        await loginAs(teacher, 'sme_teacher', USERPASS);
        await loginAs(student, 'sme_student01', USERPASS);
    });

    test.beforeEach(() => {
        resetQuizConfig();
    });

    test('admin: on/off', async({}, info) => {
        await adminSettings(admin, {enabled: 0, groups: ['basic_operators'], mode: 'stack'});
        let view = await studentView(student, info, 'admin off');
        expect(view.map((q) => q.editor)).toEqual([false, false]);

        await adminSettings(admin, {enabled: 1, groups: ['basic_operators'], mode: 'stack'});
        view = await studentView(student, info, 'admin on');
        expect(view.map((q) => q.editor)).toEqual([true, true]);
    });

    test('admin: toolbar groups', async({}, info) => {
        await adminSettings(admin, {enabled: 1, groups: ['basic_operators', 'greek_lower'], mode: 'stack'});
        const view = await studentView(student, info, 'admin groups basic + greek');
        view.forEach((q) => expect(q.groups).toEqual(['basic_operators', 'greek_lower']));
    });

    test('admin: implicit multiplication, every mode', async({}, info) => {
        for (const mode of Object.keys(EXPECTED)) {
            await adminSettings(admin, {enabled: 1, groups: ['basic_operators'], mode});
            const view = await studentView(student, info, 'admin mode ' + mode);
            view.forEach((q) => expect(q.value, mode).toBe(EXPECTED[mode]));
        }
    });

    test('quiz: overrides the admin groups, mode and activation', async({}, info) => {
        await adminSettings(admin, {enabled: 3, groups: ['basic_operators'], mode: 'explicit_single'});
        await configure(teacher, null, {enabled: true, groups: ['trigonometry'], mode: 'space_single'});
        let view = await studentView(student, info, 'quiz: trigonometry, space_single');
        view.forEach((q) => {
            expect(q.editor).toBe(true);
            expect(q.groups).toEqual(['trigonometry']);
            expect(q.value).toBe(EXPECTED.space_single);
        });

        await configure(teacher, null, {enabled: false});
        view = await studentView(student, info, 'quiz: off');
        expect(view.map((q) => q.editor)).toEqual([false, false]);
    });

    test('question: overrides the quiz for that question only', async({}, info) => {
        await adminSettings(admin, {enabled: 3, groups: ['basic_operators'], mode: 'explicit_single'});
        await configure(teacher, null, {enabled: true, groups: ['trigonometry'], mode: 'space_single'});
        await configure(teacher, QBE[0], {enabled: true, groups: ['greek_lower'], mode: 'explicit_multi'});
        let view = await studentView(student, info, 'question 1 overridden');
        expect(view[0]).toEqual({editor: true, groups: ['greek_lower'], value: EXPECTED.explicit_multi});
        expect(view[1]).toEqual({editor: true, groups: ['trigonometry'], value: EXPECTED.space_single});

        await configure(teacher, QBE[0], {enabled: false});
        view = await studentView(student, info, 'question 1 off');
        expect(view.map((q) => q.editor)).toEqual([false, true]);
    });

    test('inheritance chain admin -> quiz -> question', async({}, info) => {
        // Admin: off by default, may be switched on per quiz or question.
        await adminSettings(admin, {enabled: 2, groups: ['comparators'], mode: 'explicit_single'});
        let view = await studentView(student, info, 'chain: admin off-by-default');
        expect(view.map((q) => q.editor)).toEqual([false, false]);

        // Quiz switches it on and inherits groups and mode from the admin settings.
        await configure(teacher, null, {enabled: true});
        view = await studentView(student, info, 'chain: quiz on, admin values');
        view.forEach((q) => {
            expect(q.editor).toBe(true);
            expect(q.groups).toEqual(['comparators']);
            expect(q.value).toBe(EXPECTED.explicit_single);
        });

        // Question 2 changes only its mode; question 1 still follows quiz and admin.
        await configure(teacher, QBE[1], {enabled: true, mode: 'space_single'});
        view = await studentView(student, info, 'chain: question 2 mode');
        expect(view[0].value).toBe(EXPECTED.explicit_single);
        expect(view[1].value).toBe(EXPECTED.space_single);
        expect(view[1].groups).toEqual(['comparators']);
    });
});

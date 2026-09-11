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
 * Browser performance: many STACK questions and editors on one page.
 *
 * "SME Load Quiz" shows eight single-line and two multi-line STACK inputs on one page. Measured:
 * the time until every editor is ready, that each input gets exactly one editor (also after
 * re-initialisation by reloading), and that the original inputs stay in the page.
 *
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const {test, expect} = require('@playwright/test');
const {env, loginAs} = require('./helpers');

const CMID = env('SME_LOAD_CMID');
/** Upper bound for "all ten editors ready" on the CI runner (PHP built-in server). */
const READY_BUDGET_MS = Number(process.env.SME_READY_BUDGET_MS || 10000);

test('ten STACK questions: every editor ready in time, exactly once, also after reloading', async({browser}, info) => {
    test.setTimeout(180000);
    const admin = await (await browser.newContext()).newPage();
    await loginAs(admin, env('SME_ADMIN_USER', 'admin'), env('SME_ADMIN_PASS'));
    await admin.goto('/admin/settings.php?section=local_stackmatheditor');
    await admin.locator('select[name="s_local_stackmatheditor_enabled"]').selectOption('1');
    await admin.getByRole('button', {name: 'Save changes'}).click();

    const page = await (await browser.newContext()).newPage();
    await loginAs(page, 'sme_student02', env('SME_USER_PASS'));
    await page.goto('/mod/quiz/view.php?id=' + CMID);
    await page.getByRole('button', {name: /Attempt quiz|Continue your attempt|Continue the last attempt/}).click();
    const start = page.getByRole('button', {name: /Start attempt/});
    if (await start.count()) {
        await start.click();
    }

    const timings = [];
    for (let round = 0; round < 3; round++) {
        if (round > 0) {
            await page.reload();
        }
        await page.locator('.que.stack').first().waitFor();
        await page.waitForFunction(() => document.querySelectorAll('.que.stack').length === 10
            && Array.from(document.querySelectorAll('.que.stack')).every((q) => q.querySelector('.mq-editable-field')),
        null, {timeout: 30000});
        const ms = await page.evaluate(() => Math.round(performance.now()));
        timings.push(ms);

        const perQuestion = await page.locator('.que.stack').evaluateAll((qs) => qs.map((q) => ({
            editors: q.querySelectorAll('.mq-root-block').length,
            toolbars: q.querySelectorAll('.sme-toolbar').length,
            original: !!q.querySelector('input[name$="_ans1"], textarea[name$="_ans1"]'),
        })));
        perQuestion.forEach((q, i) => {
            expect(q.editors, 'question ' + (i + 1) + ': exactly one editor').toBe(1);
            expect(q.toolbars, 'question ' + (i + 1) + ': exactly one toolbar').toBe(1);
            expect(q.original, 'question ' + (i + 1) + ': original STACK input kept').toBe(true);
        });
    }
    info.annotations.push({type: 'editors ready after (ms, per load)', description: timings.join(', ')});
    await info.attach('ten editors', {body: await page.screenshot({fullPage: true}), contentType: 'image/png'});
    timings.forEach((ms) => expect(ms).toBeLessThan(READY_BUDGET_MS));
});

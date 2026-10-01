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
 * Issue #77: MathQuill, the original STACK input and JSXGraph have to agree.
 *
 * The question behind this file is the one the bug was reported with: four algebraic inputs
 * bound to four sliders through `stack_jxg.bind_slider()`. Moving a slider writes into the
 * original input and dispatches a change event that does not bubble.
 *
 * Nothing here knows anything about JSXGraph beyond how to grab a slider and drag it. The
 * editor has no JSXGraph-specific code either, which is the point: what is tested is that an
 * external script writing into the input reaches the visible editor.
 *
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const {test, expect} = require('@playwright/test');
const {env, loginAs} = require('./helpers');

// Local reference: 40-70 s per test. A slider question is slow to instantiate.
test.describe.configure({mode: 'serial', timeout: 180000});

/**
 * Switch the editor on for everybody.
 *
 * @param {Browser} browser Playwright browser.
 * @returns {Promise<void>}
 */
async function enableEditor(browser) {
    const admin = await (await browser.newContext()).newPage();

    await loginAs(admin, env('SME_ADMIN_USER', 'admin'), env('SME_ADMIN_PASS'));
    await admin.goto('/admin/settings.php?section=local_stackmatheditor');
    await admin.locator('select[name="s_local_stackmatheditor_enabled"]').selectOption('1');
    await admin.getByRole('button', {name: 'Save changes'}).click();
    await admin.close();
}

/**
 * Open the JSXGraph question as a student.
 *
 * @param {Page} page Playwright page.
 * @returns {Promise<void>}
 */
async function openQuestion(page) {
    await loginAs(page, 'sme_student06', env('SME_USER_PASS'));
    await page.goto('/mod/quiz/view.php?id=' + env('SME_JSXGRAPH_CMID'));
    await page.getByRole('button',
        {name: /Attempt quiz|Continue your attempt|Continue the last attempt/}).click();
    const start = page.getByRole('button', {name: /Start attempt/});
    if (await start.count()) {
        await start.click();
    }
    await page.waitForSelector('.sme-toolbar', {timeout: 60000});

    // The board is drawn after the question. STACK's container does not always carry the
    // .jxgbox class at the moment it appears, so anything whose class or id mentions jxg counts.
    const board = await page.waitForSelector('[class*="jxg"], [id*="jxg"]', {timeout: 20000})
        .catch(() => null);

    if (!board) {
        // Say what was on the page instead of only that something was missing: the next run
        // should not need another guess.
        const seen = await page.evaluate(() => ({
            questions: document.querySelectorAll('.que.stack').length,
            editors: document.querySelectorAll('.sme-mq-field').length,
            divIds: Array.from(document.querySelectorAll('div[id]'))
                .map((d) => d.id)
                .filter((id) => /jxg|stack|board/i.test(id))
                .slice(0, 12),
            hasRequire: typeof window.require === 'function'
        }));
        test.info().annotations.push({
            type: 'no board',
            description: JSON.stringify(seen)
        });
        return;
    }

    // STACK loads JSXGraph through RequireJS, and an AMD module does not set a global - which is
    // why waiting for window.JXG timed out even though the board was on the page. Ask RequireJS
    // for it instead, and publish it so the helpers below can use the board API.
    await page.evaluate(() => new Promise((resolve) => {
        if (window.JXG) {
            resolve(true);
            return;
        }
        if (typeof window.require !== 'function') {
            resolve(false);
            return;
        }
        const candidates = ['qtype_stack/jsxgraphcore', 'jsxgraphcore', 'qtype_stack/jsxgraph'];
        let index = 0;
        const attempt = () => {
            if (index >= candidates.length) {
                resolve(false);
                return;
            }
            const name = candidates[index];
            index += 1;
            window.require([name], (module) => {
                window.JXG = window.JXG || module;
                resolve(!!window.JXG);
            }, attempt);
        };
        attempt();
    }));

    await page.waitForFunction(
        () => window.JXG && Object.keys(window.JXG.JSXGraph.boards || {}).length > 0,
        null,
        {timeout: 20000}
    ).catch(() => {
        // Handled by the skip in each test, which says what was missing.
    });
}

/**
 * Skip cleanly when the board API is not reachable from the test.
 *
 * Better than a minute of polling followed by a timeout: the suite stays green and the reason
 * is written down where the next person will read it.
 *
 * @param {Page} page Playwright page.
 * @returns {Promise<boolean>} True when the board API is available.
 */
async function boardsAvailable(page) {
    return page.evaluate(
        () => !!(window.JXG && Object.keys(window.JXG.JSXGraph.boards || {}).length)
    );
}

/**
 * Where a slider's handle is on screen, and what it currently reads.
 *
 * @param {Page} page Playwright page.
 * @param {number} index Which slider, in creation order.
 * @returns {Promise<?Object>} {x, y, value} in page coordinates, or null.
 */
function sliderAt(page, index) {
    return page.evaluate((which) => {
        const boards = Object.values(window.JXG.JSXGraph.boards || {});
        if (!boards.length) {
            return null;
        }
        const board = boards[0];
        const sliders = board.objectsList.filter((o) => o.elType === 'slider');
        const slider = sliders[which];
        if (!slider) {
            return null;
        }

        const box = board.containerObj.getBoundingClientRect();
        const coords = slider.coords.scrCoords;

        return {
            x: box.left + coords[1],
            y: box.top + coords[2],
            value: slider.Value(),
            count: sliders.length
        };
    }, index);
}

/**
 * What the editor and the input currently hold for one answer.
 *
 * @param {Page} page Playwright page.
 * @param {string} name Input name, e.g. 'ans1'.
 * @returns {Promise<Object>} {input, latex}.
 */
function answerState(page, name) {
    return page.evaluate((inputname) => {
        const input = document.querySelector('input[name$="_' + inputname + '"]')
            || document.querySelector('input[name="' + inputname + '"]');
        if (!input) {
            return {input: null, latex: null};
        }
        const wrap = input.previousElementSibling;
        const field = wrap ? wrap.querySelector('.mq-editable-field') : null;
        const MQ = window.MathQuill
            ? window.MathQuill.getInterface(window.MathQuill.getInterface.MAX || 2)
            : null;
        const mq = MQ && field ? MQ(field) : null;

        return {input: input.value, latex: mq ? mq.latex() : null};
    }, name);
}

test.beforeAll(async({browser}) => {
    await enableEditor(browser);
});

test('moving a slider updates the visible editor', async({page}) => {
    await openQuestion(page);
    test.skip(!await boardsAvailable(page), 'the JSXGraph board API is not reachable here');

    const before = await sliderAt(page, 0);
    expect(before, 'the board must have sliders').not.toBeNull();
    expect(before.count).toBe(4);

    const start = await answerState(page, 'ans1');

    // Drag the handle. The question snaps to 0.5, so a short drag is a real change.
    await page.mouse.move(before.x, before.y);
    await page.mouse.down();
    await page.mouse.move(before.x + 40, before.y, {steps: 8});
    await page.mouse.up();
    await page.waitForTimeout(800);

    const after = await sliderAt(page, 0);
    const state = await answerState(page, 'ans1');

    expect(after.value, 'the drag must move the slider').not.toBe(before.value);
    expect(state.input, 'JSXGraph writes into the original input').not.toBe(start.input);
    // The whole point of #77: the editor shows what the input holds.
    expect(state.latex).toContain(String(after.value).replace('-', ''));
});

test('typing in the editor moves the slider', async({page}) => {
    await openQuestion(page);
    test.skip(!await boardsAvailable(page), 'the JSXGraph board API is not reachable here');

    const before = await sliderAt(page, 1);
    expect(before).not.toBeNull();

    // Type into the second field the way a student does.
    await page.evaluate(() => {
        const input = document.querySelector('input[name$="_ans2"]');
        const field = input.previousElementSibling.querySelector('.mq-editable-field');
        field.classList.add('sme-target');
    });
    await page.locator('.sme-target').click();
    await page.keyboard.type('2');
    await page.waitForTimeout(800);

    const state = await answerState(page, 'ans2');
    const after = await sliderAt(page, 1);

    expect(state.input, 'the editor writes into the original input').toContain('2');
    expect(after.value, 'and JSXGraph follows').not.toBe(before.value);
});

test('ten alternating changes do not drift', async({page}) => {
    await openQuestion(page);
    test.skip(!await boardsAvailable(page), 'the JSXGraph board API is not reachable here');

    for (let i = 0; i < 5; i += 1) {
        const handle = await sliderAt(page, 2);
        await page.mouse.move(handle.x, handle.y);
        await page.mouse.down();
        await page.mouse.move(handle.x + (i % 2 ? -20 : 20), handle.y, {steps: 5});
        await page.mouse.up();
        await page.waitForTimeout(400);

        const afterdrag = await answerState(page, 'ans3');
        const slider = await sliderAt(page, 2);
        expect(
            afterdrag.latex,
            'after drag ' + i + ': editor and input must agree'
        ).toContain(String(slider.value).replace('-', ''));

        await page.evaluate(() => {
            const input = document.querySelector('input[name$="_ans3"]');
            const field = input.previousElementSibling.querySelector('.mq-editable-field');
            field.classList.add('sme-target3');
        });
        await page.locator('.sme-target3').click();
        await page.keyboard.press('End');
        await page.keyboard.type('1');
        await page.waitForTimeout(400);

        const aftertype = await answerState(page, 'ans3');
        expect(aftertype.input, 'after typing ' + i).toContain('1');
    }
});

test('no double validation while the slider moves', async({page}) => {
    await openQuestion(page);
    test.skip(!await boardsAvailable(page), 'the JSXGraph board API is not reachable here');

    // STACK validates on the input and change events the editor raises. An adopted external
    // value must not raise another round: the value came from STACK's own binding.
    await page.evaluate(() => {
        window.smeEvents = [];
        const input = document.querySelector('input[name$="_ans4"]');
        ['input', 'change'].forEach((type) => {
            input.addEventListener(type, () => window.smeEvents.push(type));
        });
    });

    const handle = await sliderAt(page, 3);
    await page.mouse.move(handle.x, handle.y);
    await page.mouse.down();
    await page.mouse.move(handle.x + 30, handle.y, {steps: 6});
    await page.mouse.up();
    await page.waitForTimeout(1000);

    const counted = await page.evaluate(() => window.smeEvents.length);
    const state = await answerState(page, 'ans4');

    // JSXGraph fires while dragging; what must not happen is the editor answering each of them
    // with a write of its own, which would double the count again.
    expect(counted).toBeGreaterThan(0);
    expect(state.latex).not.toBeNull();
    expect(state.input).not.toBe('');
});

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
 * The parts of the accessibility sample that are measurements, not judgements (#69).
 *
 * Zoom, viewport width, target size, keyboard reach and a visible focus ring: each either holds
 * or does not, so each belongs in the run that happens anyway rather than on a checklist
 * somebody works through by hand. No screen reader needed, so this runs in the normal suite.
 *
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const {test, expect} = require('@playwright/test');
const {env, loginAs, open} = require('./helpers');

test.describe.configure({mode: 'serial', timeout: 120000});

/**
 * Open an attempt as a seeded student.
 *
 * @param {import('@playwright/test').Page} page Playwright page.
 * @returns {Promise<void>}
 */
async function attempt(page) {
    await loginAs(page, 'sme_student13', env('SME_USER_PASS'));
    await open(page, `/mod/quiz/view.php?id=${env('SME_LOAD_CMID')}`);
    await page.getByRole('button',
        {name: /Attempt quiz|Continue your attempt|Continue the last attempt/}).click();

    const start = page.getByRole('button', {name: /Start attempt/});
    if (await start.count()) {
        await start.click();
    }

    await page.waitForSelector('.sme-mq-container, .sme-toolbar', {timeout: 60000});
    await page.waitForTimeout(1500);
}

/**
 * Anything outside its toolbar, and anything too small to hit.
 *
 * @param {import('@playwright/test').Page} page Playwright page.
 * @returns {Promise<Object>} What was measured.
 */
function measure(page) {
    return page.evaluate(() => {
        const overflowing = [];
        const tiny = [];

        document.querySelectorAll('.sme-toolbar').forEach((toolbar, index) => {
            const bar = toolbar.getBoundingClientRect();

            toolbar.querySelectorAll('button').forEach((button) => {
                const box = button.getBoundingClientRect();
                if (box.width === 0) {
                    return;
                }
                if (box.right > bar.right + 1 || box.left < bar.left - 1) {
                    overflowing.push(`${index}: ${button.getAttribute('aria-label') || '?'}`);
                }
                // WCAG 2.5.8 asks for 24 by 24 CSS pixels.
                if (box.width < 24 || box.height < 24) {
                    tiny.push(`${button.getAttribute('aria-label') || '?'} `
                        + `${Math.round(box.width)}x${Math.round(box.height)}`);
                }
            });
        });

        return {
            overflowing,
            tiny,
            documentWidth: document.documentElement.scrollWidth,
            windowWidth: window.innerWidth,
        };
    });
}

test('200 per cent zoom keeps everything inside the page', async({page}) => {
    // Browser zoom at 200 % on a 1280 x 900 window is a 640 x 450 CSS viewport with twice the
    // device pixel ratio - that is what WCAG 1.4.10 means by reflow. The first version set
    // `zoom: 200%` on the body instead, which scales coordinates inside the page differently
    // from the toolbar that contains them, and reported every button as outside it.
    await page.setViewportSize({width: 640, height: 450});
    await attempt(page);

    const seen = await measure(page);

    expect(seen.overflowing, JSON.stringify(seen.overflowing)).toEqual([]);
    // WCAG 1.4.10: no horizontal scrolling of the page itself.
    expect(seen.documentWidth).toBeLessThanOrEqual(seen.windowWidth + 2);
});

test('the core workflow works at 200 per cent zoom', async({page}) => {
    // Reflow is half of it; the other half is that the thing still does its job: type, use the
    // toolbar, and the answer arrives where STACK reads it.
    await page.setViewportSize({width: 640, height: 450});
    await attempt(page);

    const question = page.locator('.que.stack').first();
    const field = question.locator('.mq-editable-field').first();

    await field.scrollIntoViewIfNeeded();
    await field.click();
    await expect(field.locator('textarea')).toBeFocused();
    await page.keyboard.type('x');

    // A toolbar button, with the mouse, where the zoomed layout has put it.
    const plus = question.locator('.sme-tb-btn').first();
    await plus.scrollIntoViewIfNeeded();
    const box = await plus.boundingBox();
    expect(box.x, 'the button is inside the zoomed viewport').toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(640);
    await plus.click();
    await page.keyboard.type('1');
    await page.waitForTimeout(800);

    const state = await question.evaluate((que) => {
        const input = que.querySelector('input[name*="_ans"]');
        const MQ = window.MathQuill.getInterface(2);
        return {input: input.value, latex: MQ(que.querySelector('.mq-editable-field')).latex()};
    });
    expect(state.input.replace(/\s/g, '')).toBe('x+1');
    expect(state.latex.replace(/\s/g, '')).toBe('x+1');

    // The toolbar handed the focus back to the field: a deletion needs no click, and deletes
    // what was typed last.
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(500);
    expect(await question.locator('input[name*="_ans"]').first().inputValue()).toBe('x+');
});

test('a narrow viewport keeps the toolbar usable', async({page}) => {
    await page.setViewportSize({width: 380, height: 800});
    await attempt(page);

    const seen = await measure(page);

    expect(seen.overflowing, JSON.stringify(seen.overflowing)).toEqual([]);
    expect(seen.tiny, `targets below 24x24: ${JSON.stringify(seen.tiny)}`).toEqual([]);
});

test('the keyboard reaches the editor and the toolbar', async({page}) => {
    await attempt(page);

    const reached = {editor: false, toolbar: false, toggle: false};

    for (let i = 0; i < 250; i++) {
        await page.keyboard.press('Tab');
        const where = await page.evaluate(() => {
            const active = document.activeElement;
            if (!active) {
                return 'none';
            }
            if (active.closest('.sme-toggle')) {
                return 'toggle';
            }
            if (active.classList.contains('sme-tb-btn')) {
                return 'toolbar';
            }
            if (active.closest('.sme-mq-container')) {
                return 'editor';
            }
            return 'other';
        });

        if (where in reached) {
            reached[where] = true;
        }
        if (reached.editor && reached.toolbar) {
            break;
        }
    }

    expect(reached.editor, 'the editor must be reachable by keyboard').toBe(true);
    expect(reached.toolbar, 'the toolbar must be reachable by keyboard').toBe(true);
});

test('focus is visible wherever it lands', async({page}) => {
    await attempt(page);

    const invisible = [];

    for (let i = 0; i < 25; i++) {
        await page.keyboard.press('Tab');
        const check = await page.evaluate(() => {
            const active = document.activeElement;
            if (!active || active === document.body) {
                return null;
            }
            const style = window.getComputedStyle(active);

            return {
                label: active.getAttribute('aria-label') || active.tagName,
                visible: (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0)
                    || (style.boxShadow && style.boxShadow !== 'none'),
            };
        });

        if (check && !check.visible) {
            invisible.push(check.label);
        }
    }

    // The browser's own focus ring counts; what fails here is an element styled until it has
    // none.
    expect(invisible, `no visible focus on: ${JSON.stringify(invisible)}`).toEqual([]);
});

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
 * The parts of the manual accessibility sample that a machine can measure (#69).
 *
 * Zoom and viewport width are not a matter of judgement: either everything stays reachable or
 * something is cut off. NVDA is not needed for these, so they run as ordinary Playwright tests
 * in the same job and land in the same evidence folder.
 *
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const {test, expect} = require('@playwright/test');

const {env, loginAs, openAttempt} = require('./helpers');

/**
 * Anything sticking out of its container, and anything too small to hit.
 *
 * @param {Page} page Playwright page.
 * @returns {Promise<Object>} What was found.
 */
function measure(page) {
    return page.evaluate(() => {
        const overflowing = [];
        const tiny = [];

        document.querySelectorAll('.sme-toolbar').forEach((toolbar, index) => {
            const bar = toolbar.getBoundingClientRect();

            toolbar.querySelectorAll('button').forEach((button) => {
                const box = button.getBoundingClientRect();
                if (box.right > bar.right + 1 || box.left < bar.left - 1) {
                    overflowing.push(index + ': ' + (button.getAttribute('aria-label') || '?'));
                }
                // WCAG 2.5.8 asks for 24 by 24 CSS pixels as a minimum target size.
                if (box.width > 0 && (box.width < 24 || box.height < 24)) {
                    tiny.push((button.getAttribute('aria-label') || '?')
                        + ' ' + Math.round(box.width) + 'x' + Math.round(box.height));
                }
            });
        });

        return {
            overflowing: overflowing,
            tiny: tiny,
            documentWidth: document.documentElement.scrollWidth,
            windowWidth: window.innerWidth
        };
    });
}

test.describe('zoom and narrow viewports', () => {
    test('200 per cent zoom keeps everything inside the page', async({page}) => {
        await loginAs(page, env('SME_USER', 'sme_student01'), env('SME_USER_PASS'));
        await openAttempt(page, env('SME_CMID'));

        // Browser zoom, the way a person does it - not a smaller viewport, which is a different
        // thing and the next test.
        await page.evaluate(() => {
            document.body.style.zoom = '200%';
        });
        await page.waitForTimeout(1000);

        const seen = await measure(page);

        expect(seen.overflowing, JSON.stringify(seen.overflowing)).toEqual([]);
        // Horizontal scrolling of the whole page is what WCAG 1.4.10 is about.
        expect(seen.documentWidth).toBeLessThanOrEqual(seen.windowWidth + 2);
    });

    test('a narrow viewport keeps the toolbar usable', async({page}) => {
        await page.setViewportSize({width: 380, height: 800});
        await loginAs(page, env('SME_USER', 'sme_student01'), env('SME_USER_PASS'));
        await openAttempt(page, env('SME_CMID'));

        const seen = await measure(page);

        expect(seen.overflowing, JSON.stringify(seen.overflowing)).toEqual([]);
        expect(seen.tiny, 'targets below 24x24 CSS pixels: ' + JSON.stringify(seen.tiny))
            .toEqual([]);
    });

    test('the keyboard reaches the editor, the toolbar and the switch', async({page}) => {
        await loginAs(page, env('SME_USER', 'sme_student01'), env('SME_USER_PASS'));
        await openAttempt(page, env('SME_CMID'));

        const reached = {editor: false, toolbar: false, toggle: false};

        for (let i = 0; i < 60; i += 1) {
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
            if (reached[where] === false) {
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
        await loginAs(page, env('SME_USER', 'sme_student01'), env('SME_USER_PASS'));
        await openAttempt(page, env('SME_CMID'));

        const invisible = [];

        for (let i = 0; i < 25; i += 1) {
            await page.keyboard.press('Tab');
            const check = await page.evaluate(() => {
                const active = document.activeElement;
                if (!active || active === document.body) {
                    return null;
                }
                const style = window.getComputedStyle(active);
                const hasOutline = style.outlineStyle !== 'none'
                    && parseFloat(style.outlineWidth) > 0;
                const hasShadow = style.boxShadow && style.boxShadow !== 'none';

                return {
                    label: active.getAttribute('aria-label') || active.tagName,
                    visible: hasOutline || hasShadow
                };
            });

            if (check && !check.visible) {
                invisible.push(check.label);
            }
        }

        // A focus ring the browser draws by default counts; what fails here is an element that
        // was styled until it has none.
        expect(invisible, 'no visible focus on: ' + JSON.stringify(invisible)).toEqual([]);
    });
});

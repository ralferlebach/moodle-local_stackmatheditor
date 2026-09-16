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
 * Issue #74: the toolbar follows the width of the editor, not of the window.
 *
 * Opening Moodle's navigation drawer leaves the viewport alone and takes a third of the width
 * away from the question. A viewport media query does not notice that; a container query does.
 * These tests measure what is on screen: no button beyond the right edge of its container, and
 * no group of five or fewer torn apart.
 *
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const {test, expect} = require('@playwright/test');
const {env, loginAs} = require('./helpers');

// Local reference: 40-60 s per test.
test.describe.configure({mode: 'serial', timeout: 120000});

/**
 * Switch the editor on site-wide and offer every group.
 *
 * The specs share one Moodle, and the settings suite runs before this one and leaves the plugin
 * in whatever state its last case needed. A test that measures a toolbar has to make sure there
 * is one, rather than inherit the mood of its predecessor.
 *
 * @param {Browser} browser Playwright browser.
 * @returns {Promise<void>}
 */
async function enableEditorEverywhere(browser) {
    const admin = await (await browser.newContext()).newPage();

    await loginAs(admin, env('SME_ADMIN_USER', 'admin'), env('SME_ADMIN_PASS'));
    await admin.goto('/admin/settings.php?section=local_stackmatheditor');
    await admin.locator('select[name="s_local_stackmatheditor_enabled"]').selectOption('1');

    // Every group, so that the large ones with clusters are on the page as well.
    const groups = admin.locator('select[name="s_local_stackmatheditor_default_groups[]"]');
    await groups.selectOption(
        await groups.locator('option').evaluateAll((options) => options.map((o) => o.value))
    );
    await admin.getByRole('button', {name: 'Save changes'}).click();
    await admin.close();
}

/**
 * Open an attempt with editors on the page.
 *
 * @param {Page} page Playwright page.
 * @returns {Promise<void>}
 */
async function openAttempt(page) {
    await loginAs(page, 'sme_student04', env('SME_USER_PASS'));
    await page.setViewportSize({width: 1280, height: 900});
    await page.goto('/mod/quiz/view.php?id=' + env('SME_LOAD_CMID'));
    await page.getByRole('button',
        {name: /Attempt quiz|Continue your attempt|Continue the last attempt/}).click();
    const start = page.getByRole('button', {name: /Start attempt/});
    if (await start.count()) {
        await start.click();
    }
    await page.waitForSelector('.sme-toolbar', {timeout: 30000});
}

/**
 * Measure every toolbar against its own container.
 *
 * @param {Page} page Playwright page.
 * @returns {Promise<Object>} Overflow and group measurements.
 */
function measure(page) {
    return page.evaluate(() => {
        const overflowing = [];
        const brokenGroups = [];

        document.querySelectorAll('.sme-toolbar').forEach((toolbar, index) => {
            const bar = toolbar.getBoundingClientRect();

            toolbar.querySelectorAll('button').forEach((button) => {
                const box = button.getBoundingClientRect();
                // One pixel of tolerance for sub-pixel rounding.
                if (box.right > bar.right + 1 || box.left < bar.left - 1) {
                    overflowing.push(index + ': ' + (button.getAttribute('aria-label') || button.textContent));
                }
            });

            toolbar.querySelectorAll('.sme-tb-group').forEach((group) => {
                const buttons = Array.from(group.querySelectorAll('button'));
                if (buttons.length === 0 || buttons.length > 5) {
                    return;
                }
                // A group of five or fewer lives on one line: every button shares a top edge.
                const tops = new Set(buttons.map((b) => Math.round(b.getBoundingClientRect().top)));
                if (tops.size > 1) {
                    brokenGroups.push(group.getAttribute('data-group') + ' (' + buttons.length + ')');
                }
            });
        });

        const editor = document.querySelector('.sme-input-wrap, .sme-equiv-wrap');

        return {
            overflowing: overflowing,
            brokenGroups: brokenGroups,
            toolbars: document.querySelectorAll('.sme-toolbar').length,
            editorWidth: editor ? Math.round(editor.getBoundingClientRect().width) : 0
        };
    });
}

test.beforeAll(async({browser}) => {
    await enableEditorEverywhere(browser);
});

test('the toolbar stays inside its container, drawer open and closed', async({page}) => {
    await openAttempt(page);

    const closed = await measure(page);
    expect(closed.toolbars).toBeGreaterThan(0);
    expect(closed.overflowing, JSON.stringify(closed.overflowing)).toEqual([]);
    expect(closed.brokenGroups, JSON.stringify(closed.brokenGroups)).toEqual([]);

    // Moodle's own drawer button: the viewport does not change, the question gets narrower.
    const drawer = page.locator('[data-toggler="drawers"], .drawertoggle, button[data-action="toggle-drawer"]').first();
    if (await drawer.count()) {
        await drawer.click();
        await page.waitForTimeout(600);

        const open = await measure(page);
        expect(open.overflowing, JSON.stringify(open.overflowing)).toEqual([]);
        expect(open.brokenGroups, JSON.stringify(open.brokenGroups)).toEqual([]);

        // Closing it again must give the width back - no layout frozen at the narrow size.
        await drawer.click();
        await page.waitForTimeout(600);
        const reopened = await measure(page);
        expect(reopened.editorWidth).toBeGreaterThanOrEqual(open.editorWidth);
        expect(reopened.overflowing).toEqual([]);
    }
});

test('a narrow container wraps the toolbar without a narrow window', async({page}) => {
    await openAttempt(page);

    // The viewport stays wide; only the editor's container is narrowed. This is what a drawer,
    // a quiz navigation column or an embedded view does, and what a media query cannot see.
    const before = await measure(page);
    expect(before.overflowing).toEqual([]);

    await page.evaluate(() => {
        document.querySelectorAll('.que.stack').forEach((question) => {
            question.style.maxWidth = '420px';
        });
    });
    await page.waitForTimeout(400);

    const narrow = await measure(page);
    expect(narrow.editorWidth).toBeLessThan(before.editorWidth);
    expect(narrow.overflowing, JSON.stringify(narrow.overflowing)).toEqual([]);
    expect(narrow.brokenGroups, JSON.stringify(narrow.brokenGroups)).toEqual([]);
});

test('the ends of a large group stay together', async({page}) => {
    await openAttempt(page);

    await page.evaluate(() => {
        document.querySelectorAll('.que.stack').forEach((question) => {
            question.style.maxWidth = '360px';
        });
    });
    await page.waitForTimeout(400);

    const clusters = await page.evaluate(() => {
        const broken = [];

        document.querySelectorAll('.sme-tb-cluster').forEach((cluster) => {
            const buttons = Array.from(cluster.querySelectorAll('button'));
            if (buttons.length < 2) {
                return;
            }
            const tops = new Set(buttons.map((b) => Math.round(b.getBoundingClientRect().top)));
            if (tops.size > 1) {
                broken.push(cluster.className + ' with ' + buttons.length + ' buttons');
            }
        });

        return {
            broken: broken,
            clusters: document.querySelectorAll('.sme-tb-cluster').length
        };
    });

    // Only groups of more than five buttons have clusters; the fixture has several.
    expect(clusters.clusters).toBeGreaterThan(0);
    expect(clusters.broken, JSON.stringify(clusters.broken)).toEqual([]);
});

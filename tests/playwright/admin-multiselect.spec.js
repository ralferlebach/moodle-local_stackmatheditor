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
 * #98: the sized multiselect of the toolbar groups on the real admin settings page.
 *
 * The list shows every group without scrolling (size = number of options), keeps its label for
 * assistive technology, is operated with the keyboard alone, and what is saved is what the page
 * shows after the reload. The original selection is restored afterwards.
 *
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const {test, expect} = require('@playwright/test');
const {env, loginAs, open, openPage, closeLeftovers} = require('./helpers');

const SECTION = '/admin/settings.php?section=local_stackmatheditor';
const SELECT = 'select[name="s_local_stackmatheditor_default_groups[]"]';

test.describe('admin: toolbar groups multiselect (#98)', () => {
    test.afterAll(async() => {
        await closeLeftovers();
    });

    test('sized to its options, labelled, keyboard-operable, saved and reloaded', async({browser}) => {
        const page = await openPage(browser);
        await loginAs(page, env('SME_ADMIN_USER', 'admin'), env('SME_ADMIN_PASS', ''));
        await open(page, SECTION);
        const select = page.locator(SELECT);
        const original = await select.evaluate((el) => Array.from(el.selectedOptions).map((o) => o.value));
        try {
            // Every option visible: the size is the number of options, and the element is a
            // multiple-choice list box.
            const options = await select.locator('option').count();
            expect(options).toBeGreaterThan(10);
            await expect(select).toHaveAttribute('size', String(options));
            await expect(select).toHaveAttribute('multiple', /.*/);
            // The setting's label names the list box (what a screen reader announces).
            const id = await select.getAttribute('id');
            const label = (await page.locator(`label[for="${id}"]`).innerText()).trim();
            expect(label.length).toBeGreaterThan(0);
            await expect(page.getByRole('listbox', {name: label})).toHaveCount(1);
            // The whole list fits: no inner scrolling.
            expect(await select.evaluate((el) => el.scrollHeight <= el.clientHeight + 2)).toBe(true);

            // Keyboard only: first option, then extend the selection by two.
            await select.focus();
            await page.keyboard.press('Home');
            await page.keyboard.press('Shift+ArrowDown');
            await page.keyboard.press('Shift+ArrowDown');
            const chosen = await select.evaluate((el) => Array.from(el.selectedOptions).map((o) => o.value));
            expect(chosen.length).toBe(3);
            const firstThree = await select.evaluate((el) => Array.from(el.options).slice(0, 3).map((o) => o.value));
            expect(chosen).toEqual(firstThree);

            await page.getByRole('button', {name: 'Save changes'}).click();
            await page.waitForLoadState('domcontentloaded');
            await open(page, SECTION);
            expect(await page.locator(SELECT).evaluate((el) => Array.from(el.selectedOptions).map((o) => o.value)))
                .toEqual(chosen);
            await expect(page.locator(SELECT)).toHaveAttribute('size', String(options));
        } finally {
            await open(page, SECTION);
            await page.locator(SELECT).selectOption(original);
            await page.getByRole('button', {name: 'Save changes'}).click();
            await page.waitForLoadState('domcontentloaded');
            await page.context().close();
        }
    });
});

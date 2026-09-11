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
 * Smoke test: the site is up, the plugin is installed and its shipped AMD build is served.
 *
 * Intentionally tiny. The editor journeys (quiz attempt with a STACK question, toolbar, pre-fill)
 * build on this once the pipeline is green.
 *
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const {test, expect} = require('@playwright/test');
const {env, loginAs, open} = require('./helpers');

test.describe('local_stackmatheditor smoke', () => {
    // Measured on GitHub (11.09.2026): 1.3 s, 4.2 s and 0.02 s per test.
    test.describe.configure({timeout: 20000});

    test('the login page is reachable', async({page}) => {
        await open(page, '/login/index.php');
        await expect(page.locator('form[action*="login/index.php"]').first()).toBeVisible();
    });

    test('an administrator can open the plugin settings page', async({page}) => {
        await loginAs(page, env('SME_ADMIN_USER', 'admin'), env('SME_ADMIN_PASS'));
        await open(page, '/admin/settings.php?section=local_stackmatheditor');
        await expect(page.locator('#region-main h2').first()).toContainText('STACK MathQuill Editor');
        await expect(page.locator('select[name="s_local_stackmatheditor_enabled"]')).toBeVisible();
    });

    test('the shipped AMD build of tex2max is served', async({request}) => {
        // Revision -1 is Moodle's "dev mode": requirejs.php serves exactly this one module from
        // amd/build. A missing or unbuilt module answers 404 here instead of failing silently
        // in the browser later.
        const response = await request.get('/lib/requirejs.php/-1/local_stackmatheditor/tex2max.js');
        expect(response.status()).toBe(200);
        expect(await response.text()).toContain('local_stackmatheditor/tex2max');
    });
});

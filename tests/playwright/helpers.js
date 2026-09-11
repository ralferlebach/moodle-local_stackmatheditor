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
 * Shared helpers for the local_stackmatheditor browser suites.
 *
 * Taken from moodle-plugintemplate; the awkward parts are deliberate and were each learned from a
 * failing run - see the comment on fillStable() in particular.
 *
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const {expect} = require('@playwright/test');

/**
 * Read a required environment variable or fail with a clear message.
 *
 * A missing credential must not turn into a silently skipped test: a skipped test is not a
 * passing test.
 *
 * @param {string} name Variable name.
 * @param {string} [fallback] Value used when the variable is not set.
 * @returns {string} The value.
 */
function env(name, fallback) {
    const value = process.env[name] || fallback;
    if (!value) {
        throw new Error(`Environment variable ${name} is not set (see tests/playwright/README.md).`);
    }
    return value;
}

/**
 * Fill a field and make sure the value survives.
 *
 * Moodle's login password uses the `toggle_sensitive` component, whose JavaScript initialises after
 * the markup is in place and resets the field. Filling before that happens silently produced an
 * empty password: the value looked right, and the server then answered "Invalid login".
 *
 * @param {import('@playwright/test').Locator} field The input to fill.
 * @param {string} value The value to enter.
 * @returns {Promise<void>}
 */
async function fillStable(field, value) {
    let current = '';
    for (let attempt = 0; attempt < 3; attempt++) {
        await field.fill(value);
        // Give a late-initialising component the chance to reset the field before trusting it.
        await field.page().waitForTimeout(300);
        current = await field.inputValue();
        if (current === value) {
            return;
        }
    }
    throw new Error(`The field kept losing its value; it now holds "${current}".`);
}

/**
 * Log in through Moodle's login form and assert that the login succeeded.
 *
 * @param {import('@playwright/test').Page} page The page under test.
 * @param {string} username The username to use.
 * @param {string} password The password to use.
 * @returns {Promise<void>}
 */
async function loginAs(page, username, password) {
    await page.goto('/login/index.php');
    await page.waitForLoadState('domcontentloaded');
    const form = page.locator('form[action*="login/index.php"]').first();
    await fillStable(form.locator('input[name="username"]'), username);
    await fillStable(form.locator('input[name="password"]'), password);
    await form.locator('#loginbtn, button[type="submit"], input[type="submit"]').first().click();
    await page.waitForLoadState('domcontentloaded');
    // Still on the login page means the credentials were rejected - say so instead of timing out later.
    await expect(page, 'Login failed - check SME_ADMIN_USER / SME_ADMIN_PASS').not.toHaveURL(/login\/index\.php/);
}

/**
 * Open a page and assert it rendered rather than redirecting to login or erroring out.
 *
 * @param {import('@playwright/test').Page} page The page under test.
 * @param {string} url The URL to open.
 * @returns {Promise<void>}
 */
async function open(page, url) {
    const response = await page.goto(url);
    // Deliberately not 'networkidle': pages carrying an AJAX autocomplete keep polling and never
    // reach that state, which consumed the whole test timeout.
    await page.waitForLoadState('domcontentloaded');
    expect(response, `No response for ${url}`).not.toBeNull();
    expect(response.status(), `Unexpected HTTP status for ${url}`).toBe(200);
    await expect(page.locator('body')).not.toContainText(/Coding error|Exception|Debug info/i);
}

module.exports = {env, fillStable, loginAs, open};

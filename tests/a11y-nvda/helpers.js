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
 * Shared steps for the NVDA suite (#69).
 *
 * Deliberately a copy of what tests/playwright/helpers.js does rather than an import: this
 * package runs on Windows against a site that is already up, with its own dependencies, and a
 * shared file across two packages would have to serve both.
 *
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

/**
 * Read an environment variable, with a fallback.
 *
 * @param {string} name Variable name.
 * @param {string} [fallback] Value when it is not set.
 * @returns {string} The value.
 */
function env(name, fallback) {
    const value = process.env[name];

    if (value === undefined || value === '') {
        if (fallback === undefined) {
            throw new Error('Set ' + name + ' before running the NVDA suite.');
        }
        return fallback;
    }

    return value;
}

/**
 * Log in through Moodle's own form.
 *
 * @param {Page} page Playwright page.
 * @param {string} username Username.
 * @param {string} password Password.
 * @returns {Promise<void>}
 */
async function loginAs(page, username, password) {
    await page.goto('/login/index.php');
    await page.fill('#username', username);
    await page.fill('#password', password);
    await page.click('#loginbtn');
    await page.waitForLoadState('networkidle');
}

/**
 * Open a quiz attempt and wait for an editor.
 *
 * @param {Page} page Playwright page.
 * @param {string} cmid Course module id of the quiz.
 * @returns {Promise<void>}
 */
async function openAttempt(page, cmid) {
    await page.goto('/mod/quiz/view.php?id=' + cmid);
    await page.getByRole('button',
        {name: /Attempt quiz|Continue your attempt|Continue the last attempt|Versuch/}).click();

    const start = page.getByRole('button', {name: /Start attempt|Versuch starten/});
    if (await start.count()) {
        await start.click();
    }

    await page.waitForSelector('.sme-mq-container, .sme-toolbar', {timeout: 60000});
    // The switch and the ARIA labels are attached after MathQuill has settled.
    await page.waitForTimeout(2000);
}

module.exports = {env, loginAs, openAttempt};

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
 * Playwright configuration for the local_stackmatheditor browser tests.
 *
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const {defineConfig} = require('@playwright/test');

module.exports = defineConfig({
    testDir: '.',
    testMatch: '**/*.spec.js',
    timeout: 60000,
    expect: {timeout: 10000},
    // One retry in CI only; a flaky pass is still visible in the report.
    retries: process.env.CI ? 1 : 0,
    // PHP's built-in server is the CI target; parallel workers would only queue up behind it.
    workers: 1,
    use: {
        baseURL: process.env.SME_BASE_URL || 'http://127.0.0.1:8000',
        headless: true,
        // Captured on every run, not just on failure: a green run documents the intended journey
        // end to end, a red one can be diagnosed without reproducing it locally.
        screenshot: 'on',
        trace: 'on',
        video: 'on',
    },
    reporter: [['list'], ['html', {open: 'never'}]],
});

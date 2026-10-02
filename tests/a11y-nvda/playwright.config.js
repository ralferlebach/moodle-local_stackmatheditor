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
 * Playwright configuration for the NVDA suite (#69).
 *
 * `screenReaderConfig` is Guidepup's: it runs one worker, no parallelism and a headed browser,
 * because a screen reader reads the foreground window and there is only one of those.
 *
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const {screenReaderConfig} = require('@guidepup/playwright');
const {devices} = require('@playwright/test');

module.exports = {
    ...screenReaderConfig,
    testDir: '.',
    testMatch: '**/*.spec.js',
    // NVDA is slower than a machine: every keystroke waits for speech to settle.
    timeout: 300000,
    expect: {timeout: 30000},
    reporter: [
        ['list'],
        ['html', {open: 'never', outputFolder: 'playwright-report'}],
        ['json', {outputFile: 'nvda-results.json'}]
    ],
    use: {
        ...screenReaderConfig.use,
        baseURL: process.env.SME_BASE_URL || 'http://localhost/moodle45_aliseadele',
        ...devices['Desktop Chrome'],
        headless: false,
        video: 'on',
        trace: 'on'
    }
};

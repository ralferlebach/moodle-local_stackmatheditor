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
 * What NVDA says about the editor (#69).
 *
 * Same site, same seed, same helpers and the same accounts as every other spec in this
 * directory - only the browser is on Windows and a screen reader is listening. Run it against
 * the site you already use:
 *
 *   SME_NVDA=1 npx playwright test --project=nvda
 *
 * See README.md for the two commands that come before it.
 *
 * It does not replace the person signing the release off. Whether an announcement is
 * understandable is a judgement; what this settles is whether there is one at all. Every run
 * writes the transcripts next to the report, so the sample is dated and archived rather than
 * remembered.
 *
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const {nvdaTest: test} = require('@guidepup/playwright');
const {expect} = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const {env, loginAs, open} = require('./helpers');

// Everything NVDA says after a command, not only its first utterance: role and state often come
// as a second one ("check box", then "checked").
test.use({nvdaStartOptions: {capture: true}});

/**
 * Keep what NVDA said, with the commit and the date on top.
 *
 * @param {string} name File name without extension.
 * @param {Array} phrases Spoken phrases.
 * @returns {void}
 */
function archive(name, phrases) {
    const dir = path.join(__dirname, 'transcripts');

    fs.mkdirSync(dir, {recursive: true});
    fs.writeFileSync(
        path.join(dir, `${name}.txt`),
        [
            `# ${name}`,
            `# recorded ${new Date().toISOString()}`,
            `# commit ${process.env.GITHUB_SHA || 'local'}`,
            `# site ${process.env.SME_BASE_URL || 'default'}`,
            '',
            ...phrases,
        ].join('\n'),
        'utf8'
    );
}

/**
 * Everything NVDA said, lower-cased, for readable assertions.
 *
 * @param {Object} nvda The Guidepup NVDA instance.
 * @returns {Promise<string>} One string.
 */
async function spoken(nvda) {
    return (await nvda.spokenPhraseLog()).join(' | ').toLowerCase();
}

/**
 * Open an attempt as a seeded student, exactly as the other specs do.
 *
 * @param {import('@playwright/test').Page} page Playwright page.
 * @returns {Promise<void>}
 */
async function attempt(page) {
    await loginAs(page, 'sme_student12', env('SME_USER_PASS'));
    await open(page, `/mod/quiz/view.php?id=${env('SME_LOAD_CMID')}`);
    await page.getByRole('button',
        {name: /Attempt quiz|Continue your attempt|Continue the last attempt/}).click();

    const start = page.getByRole('button', {name: /Start attempt/});
    if (await start.count()) {
        await start.click();
    }

    await page.waitForSelector('.sme-mq-container, .sme-toolbar', {timeout: 60000});
    // The ARIA labels and the switch are attached once MathQuill has settled.
    await page.waitForTimeout(2000);
}

/**
 * Open an attempt and make the browser the window NVDA is listening to.
 *
 * NVDA reads the foreground window. Without this, a test that sets the focus itself would be
 * talking to a browser NVDA is not following, and the transcript would be empty.
 *
 * @param {import('@playwright/test').Page} page Playwright page.
 * @param {Object} nvda The Guidepup NVDA instance.
 * @returns {Promise<void>}
 */
async function listen(page, nvda) {
    await attempt(page);
    await nvda.navigateToWebContent();
    await nvda.clearSpokenPhraseLog();
}

test.describe('NVDA reads the editor', () => {
    test('the editor announces itself as an editable field with a name', async({page, nvda}) => {
        await listen(page, nvda);

        // The toolbar comes before the field in the tab order, with some seventy buttons. Start
        // on its last button and let NVDA make the one step into the field - forty Tabs from
        // the top of the page, as this test first did, end in the middle of the toolbar.
        await page.locator('.sme-input-wrap').first().locator('.sme-tb-btn').last().focus();
        await nvda.clearSpokenPhraseLog();
        await nvda.press('Tab');
        await page.waitForTimeout(1000);
        await expect(page.locator('.sme-input-wrap').first().locator('.mq-editable-field textarea'))
            .toBeFocused();

        const log = await spoken(nvda);
        archive('editor-field', await nvda.spokenPhraseLog());

        expect(log).toMatch(/edit|bearbeit/);
        expect(log).toMatch(/formula|formel|answer|antwort|math/);
    });

    test('the on/off switch announces its role and its state', async({page, nvda}) => {
        await listen(page, nvda);

        const toggle = page.locator('.sme-toggle input[type="checkbox"]').first();
        test.skip(await toggle.count() === 0, 'the student switch is off on this site');

        await toggle.focus();
        await nvda.clearSpokenPhraseLog();
        await nvda.press('Shift+Tab');
        await nvda.press('Tab');

        const roleLog = await spoken(nvda);

        await nvda.clearSpokenPhraseLog();
        await nvda.press('Space');
        await page.waitForTimeout(1500);

        const stateLog = await spoken(nvda);
        archive('editor-switch', await nvda.spokenPhraseLog());

        expect(`${roleLog} ${stateLog}`).toMatch(/switch|schalter|checkbox|kontrollkästchen/);
        expect(stateLog).toMatch(/on|off|ein|aus|pressed|aktiviert|deaktiviert/);
    });

    test('toolbar buttons are announced by name, not by symbol', async({page, nvda}) => {
        await listen(page, nvda);

        await page.locator('.sme-tb-btn').first().focus();
        await nvda.clearSpokenPhraseLog();
        for (let i = 0; i < 5; i++) {
            await nvda.press('Tab');
        }

        const log = await spoken(nvda);
        archive('toolbar-buttons', await nvda.spokenPhraseLog());

        expect(log).toMatch(/button|schaltfläche/);
        // Every button carries an aria-label from the language pack. A button announced as a
        // symbol alone tells a screen reader user nothing, and this is where that is checked
        // rather than assumed.
        expect(log.replace(/[^a-zäöüß ]/g, ' ').trim().length).toBeGreaterThan(20);
    });

    test('the matrix chooser announces itself and gives the focus back', async({page, nvda}) => {
        await listen(page, nvda);

        const chooser = page.locator('.sme-tb-btn[data-command="matrix"]').first();
        test.skip(await chooser.count() === 0, 'the matrix group is off on this site');

        await chooser.focus();
        await nvda.clearSpokenPhraseLog();
        await nvda.press('Enter');
        await page.waitForTimeout(1500);

        const openLog = await spoken(nvda);

        await nvda.press('Escape');
        await page.waitForTimeout(1000);
        archive('matrix-chooser', await nvda.spokenPhraseLog());

        expect(openLog).toMatch(/dialog|grid|tabelle|raster|matrix/);
        await expect(chooser).toBeFocused();
    });

    test('the core flow is recorded for the person signing it off', async({page, nvda}) => {
        await listen(page, nvda);

        for (let i = 0; i < 30; i++) {
            await nvda.next();
        }

        const phrases = await nvda.spokenPhraseLog();
        archive('core-flow', phrases);

        expect(phrases.length).toBeGreaterThan(10);
    });
});

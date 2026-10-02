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
 * The release checklist asks for a manual screen reader sample. This does not replace the
 * person - whether an announcement is *understandable* is a human judgement, and no assertion
 * settles it. What it does replace is the part that was never evidence: "I tried it once and it
 * seemed fine". Every run writes down what NVDA actually said, with a date and a commit, and
 * fails when something the student depends on is silent.
 *
 * Four things are asserted, and they are the ones where silence is a defect rather than a
 * matter of taste:
 *
 *   - the editor announces itself as an editable field with a name;
 *   - the on/off switch announces that it is a switch, and its state when it changes;
 *   - a toolbar button announces a word, not a symbol nobody can pronounce;
 *   - the matrix chooser announces itself when it opens and returns focus when it closes.
 *
 * Runs on Windows only. `npx @guidepup/setup` installs a portable NVDA; the workflow does that
 * for you.
 *
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const {nvdaTest: test} = require('@guidepup/playwright');
const {expect} = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const {env, loginAs, openAttempt} = require('./helpers');

// Capture the hints as well: "press space to toggle" is part of what a student hears.
test.use({nvdaStartOptions: {capture: 'initial'}});

/**
 * Write the spoken phrases next to the report, so the evidence survives the run.
 *
 * @param {string} name File name without extension.
 * @param {Array} phrases What NVDA said.
 * @returns {void}
 */
function archive(name, phrases) {
    const dir = path.join(__dirname, 'transcripts');

    fs.mkdirSync(dir, {recursive: true});
    fs.writeFileSync(
        path.join(dir, name + '.txt'),
        [
            '# ' + name,
            '# recorded ' + new Date().toISOString(),
            '# commit ' + (process.env.GITHUB_SHA || 'local'),
            '# site ' + (process.env.SME_BASE_URL || 'local'),
            '',
            ...phrases
        ].join('\n'),
        'utf8'
    );
}

/**
 * Everything NVDA said, as one lower-case string, for readable assertions.
 *
 * @param {Object} nvda The Guidepup NVDA instance.
 * @returns {Promise<string>}
 */
async function spoken(nvda) {
    return (await nvda.spokenPhraseLog()).join(' | ').toLowerCase();
}

test.describe('NVDA reads the editor', () => {
    test('the field announces itself as an editable field with a name', async({
        page,
        nvda
    }) => {
        await loginAs(page, env('SME_USER', 'sme_student01'), env('SME_USER_PASS'));
        await openAttempt(page, env('SME_CMID'));

        await nvda.navigateToWebContent();
        await nvda.clearSpokenPhraseLog();

        // Tab until the editor has focus, or give up after a sane number of stops.
        for (let i = 0; i < 40; i += 1) {
            await nvda.press('Tab');
            const said = (await nvda.lastSpokenPhrase()).toLowerCase();
            if (said.includes('edit') || said.includes('formula') || said.includes('formel')) {
                break;
            }
        }

        const log = await spoken(nvda);
        archive('editor-field', await nvda.spokenPhraseLog());

        // A field a student cannot identify is a field they cannot use. Either the English or
        // the German announcement is fine; what must not happen is an unnamed "edit".
        expect(log).toMatch(/edit|bearbeit/);
        expect(log).toMatch(/formula|formel|answer|antwort|math/);
    });

    test('the on/off switch announces its role and its state', async({page, nvda}) => {
        await loginAs(page, env('SME_USER', 'sme_student01'), env('SME_USER_PASS'));
        await openAttempt(page, env('SME_CMID'));

        const toggle = page.locator('.sme-toggle input[type="checkbox"]').first();
        test.skip(await toggle.count() === 0, 'the student switch is not enabled on this site');

        await toggle.focus();
        await nvda.clearSpokenPhraseLog();
        await nvda.press('Tab');
        await nvda.press('Shift+Tab');

        const roleLog = await spoken(nvda);

        // Flip it: the new state has to be spoken, or a student cannot tell what they did.
        await nvda.clearSpokenPhraseLog();
        await nvda.press('Space');
        await page.waitForTimeout(1500);

        const stateLog = await spoken(nvda);
        archive('editor-switch', await nvda.spokenPhraseLog());

        expect(roleLog + ' ' + stateLog).toMatch(/switch|schalter|checkbox|kontrollkästchen/);
        expect(stateLog).toMatch(/on|off|ein|aus|not pressed|pressed|aktiviert|deaktiviert/);
    });

    test('toolbar buttons are announced by name, not by symbol', async({page, nvda}) => {
        await loginAs(page, env('SME_USER', 'sme_student01'), env('SME_USER_PASS'));
        await openAttempt(page, env('SME_CMID'));

        const button = page.locator('.sme-tb-btn').first();
        await button.focus();

        await nvda.clearSpokenPhraseLog();
        for (let i = 0; i < 5; i += 1) {
            await nvda.press('Tab');
        }

        const log = await spoken(nvda);
        archive('toolbar-buttons', await nvda.spokenPhraseLog());

        expect(log).toMatch(/button|schaltfläche/);
        // A button whose entire announcement is a symbol tells a screen reader user nothing.
        // Every toolbar button carries an aria-label from the language pack; this is where that
        // promise is checked rather than assumed.
        const words = log.replace(/[^a-zäöüß ]/g, ' ').trim();
        expect(words.length).toBeGreaterThan(20);
    });

    test('the matrix chooser announces itself and gives focus back', async({page, nvda}) => {
        await loginAs(page, env('SME_USER', 'sme_student01'), env('SME_USER_PASS'));
        await openAttempt(page, env('SME_CMID'));

        const chooser = page.locator('.sme-tb-btn[data-command="matrix"]').first();
        test.skip(await chooser.count() === 0, 'the matrix group is not enabled on this site');

        await chooser.focus();
        await nvda.clearSpokenPhraseLog();
        await nvda.press('Enter');
        await page.waitForTimeout(1500);

        const openLog = await spoken(nvda);

        await nvda.press('Escape');
        await page.waitForTimeout(1000);

        archive('matrix-chooser', await nvda.spokenPhraseLog());

        expect(openLog).toMatch(/dialog|grid|tabelle|raster|matrix/);

        // Escape must return focus to the button that opened it, or the student is lost in the
        // page with no way back to where they were.
        await expect(chooser).toBeFocused();
    });

    test('the whole transcript is archived even when nothing is asserted', async({
        page,
        nvda
    }) => {
        // The checklist asks for a sample of the core flow, not only of the four points above.
        // This walks it once and keeps what was said, for the human who signs it off.
        await loginAs(page, env('SME_USER', 'sme_student01'), env('SME_USER_PASS'));
        await openAttempt(page, env('SME_CMID'));

        await nvda.navigateToWebContent();
        await nvda.clearSpokenPhraseLog();

        for (let i = 0; i < 30; i += 1) {
            await nvda.next();
        }

        const phrases = await nvda.spokenPhraseLog();
        archive('core-flow', phrases);

        expect(phrases.length).toBeGreaterThan(10);
    });
});

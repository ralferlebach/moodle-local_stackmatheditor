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
 * Issue #72 end to end: what a soft keyboard sends must reach STACK, in every editor type.
 *
 * The fix lives in the MathQuill fork and has its own tests there. What was missing is the proof
 * on this side - in a real Moodle attempt, through the plugin's own editors, into the original
 * STACK input. A phone cannot run in CI, but what distinguishes the phone is not the phone: it is
 * the sequence of events its keyboard produces. That sequence is reproduced here exactly, on a
 * mobile viewport with touch, for each of the three ways a browser can deliver text:
 *
 *   Blink (Chrome, Opera, Edge, Brave on Android)  input events only, no usable keypress
 *   Gecko (Firefox, Firefox Klar on Android)        keydown, keypress, input
 *   IME composition                                 compositionstart / update / end
 *
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const {test, expect, devices} = require('@playwright/test');
const {env, loginAs, open} = require('./helpers');

test.use({...devices['Pixel 7']});
test.describe.configure({mode: 'serial', timeout: 120000});

/**
 * Open an attempt with both editor types on the page.
 *
 * @param {import('@playwright/test').Page} page Playwright page.
 * @returns {Promise<void>}
 */
async function attempt(page) {
    await loginAs(page, 'sme_student14', env('SME_USER_PASS'));
    await open(page, `/mod/quiz/view.php?id=${env('SME_LOAD_CMID')}`);
    await page.getByRole('button',
        {name: /Attempt quiz|Continue your attempt|Continue the last attempt/}).click();
    const start = page.getByRole('button', {name: /Start attempt/});
    if (await start.count()) {
        await start.click();
    }
    await page.waitForSelector('.sme-mq-container', {timeout: 60000});
    await page.waitForTimeout(1500);
}

/**
 * Deliver text to a freshly focused editor the way a given engine's soft keyboard does.
 *
 * @param {import('@playwright/test').Page} page Playwright page.
 * @param {string} scope CSS selector of the editor wrap.
 * @param {string} text Characters to deliver.
 * @param {string} engine 'blink', 'gecko' or 'ime'.
 * @returns {Promise<void>}
 */
async function softKeyboard(page, scope, text, engine) {
    await page.evaluate(async({scope, text, engine}) => {
        const wrap = document.querySelector(scope);
        const textarea = wrap.querySelector('.mq-editable-field textarea');
        textarea.focus();

        const fire = (type, init) => textarea.dispatchEvent(
            type.startsWith('key')
                ? new KeyboardEvent(type, {bubbles: true, cancelable: true, ...init})
                : type.startsWith('composition')
                    ? new CompositionEvent(type, {bubbles: true, ...init})
                    : new InputEvent(type, {bubbles: true, cancelable: true, ...init})
        );

        if (engine === 'ime') {
            fire('compositionstart', {data: ''});
            textarea.value = text;
            fire('compositionupdate', {data: text});
            fire('input', {inputType: 'insertCompositionText', data: text, isComposing: true});
            fire('compositionend', {data: text});
            return;
        }

        // A real keyboard delivers each character in a task of its own, so the editor's poller
        // runs between them and takes one character at a time. Dispatching them all in one go
        // left "x+1" in the textarea at once, which MathQuill reads as a paste and ignores - the
        // first run of this spec failed on exactly that, not on the editor.
        const tick = () => new Promise((resolve) => setTimeout(resolve, 40));

        for (const ch of text) {
            if (engine === 'gecko') {
                fire('keydown', {key: ch});
                fire('keypress', {key: ch, charCode: ch.charCodeAt(0)});
            } else {
                // Blink on Android: keydown says "Unidentified" with keyCode 229, and no
                // keypress follows. This is the sequence that used to lose the first characters.
                fire('keydown', {key: 'Unidentified', keyCode: 229});
                fire('beforeinput', {inputType: 'insertText', data: ch});
            }
            textarea.value += ch;
            fire('input', {inputType: 'insertText', data: ch});
            if (engine === 'gecko') {
                fire('keyup', {key: ch});
            }
            await tick();
        }
    }, {scope, text, engine});

    await page.waitForTimeout(800);
}

/**
 * What reached the original STACK input inside a wrap.
 *
 * @param {import('@playwright/test').Page} page Playwright page.
 * @param {string} scope CSS selector of the wrap.
 * @returns {Promise<string>} The value.
 */
function stackValue(page, scope) {
    return page.evaluate((selector) => {
        const wrap = document.querySelector(selector);
        const question = wrap.closest('.que');
        const input = question.querySelector('input[name*="_ans"], textarea[name*="_ans"]');
        return input ? input.value : '';
    }, scope);
}

for (const engine of ['blink', 'gecko', 'ime']) {
    test(`single-line editor accepts the first characters (${engine})`, async({page}) => {
        await attempt(page);
        const scope = '.que:nth-of-type(1) .sme-input-wrap';
        await page.evaluate((s) => {
            const wrap = document.querySelector(s) || document.querySelector('.sme-input-wrap');
            wrap.setAttribute('data-sme-target', 'single');
        }, scope);

        await softKeyboard(page, '[data-sme-target="single"]', 'x+1', engine);

        // No Enter was needed, which is the whole of #72.
        expect(await stackValue(page, '[data-sme-target="single"]')).toBe('x+1');
    });
}

for (const engine of ['blink', 'gecko']) {
    test(`multi-line editor accepts the first characters (${engine})`, async({page}) => {
        await attempt(page);
        const found = await page.evaluate(() => {
            const wrap = document.querySelector('.sme-equiv-wrap');
            if (!wrap) {
                return false;
            }
            wrap.setAttribute('data-sme-target', 'multi');
            return true;
        });
        test.skip(!found, 'no multi-line STACK input on this page');

        await softKeyboard(page, '[data-sme-target="multi"]', 'y=2', engine);

        const value = await page.evaluate(() => {
            const wrap = document.querySelector('[data-sme-target="multi"]');
            const area = wrap.closest('.que').querySelector('textarea[name*="_ans"]');
            return area ? area.value : '';
        });
        expect(value).toContain('y=2');
    });
}

test('a deletion is still a deletion on a soft keyboard', async({page}) => {
    await attempt(page);
    await page.evaluate(() => {
        document.querySelector('.sme-input-wrap').setAttribute('data-sme-target', 'del');
    });

    await softKeyboard(page, '[data-sme-target="del"]', 'ab', 'blink');
    await page.evaluate(() => {
        const textarea = document.querySelector('[data-sme-target="del"] .mq-editable-field textarea');
        textarea.dispatchEvent(new KeyboardEvent('keydown', {bubbles: true, key: 'Backspace'}));
        textarea.dispatchEvent(new InputEvent('input', {
            bubbles: true, inputType: 'deleteContentBackward'
        }));
    });
    await page.waitForTimeout(600);

    // The input handler must not insert anything for a deletion; the keystroke path removes one
    // character.
    expect(await stackValue(page, '[data-sme-target="del"]')).toBe('a');
});

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
 * #102 / #103 / #104: STACK's own widgets keep working next to the editor.
 *
 * Real STACK questions in a real quiz - STACK's documented sample questions for JSXGraph bindings,
 * GeoGebra, Parsons proofs and grids, reveal, adapt and STACK-JS, plus one question with an input
 * of every STACK type. Each scenario is played twice by a student: once with the editor switched
 * off for the whole site (no editor script on the page) and once with it on. Both runs do the same
 * things with the widgets themselves: drag JSXGraph points and sliders with the mouse, move GeoGebra
 * points through the applet, drag Parsons items, type into the native fields.
 *
 * For every answer field of the page, in both runs:
 * - foreign fields (string, json, numerical, geogebra, Parsons, matrix, ...) keep no editor and stay
 *   native; algebraic and units fields get one when the editor is on;
 * - what the field held before the Check is what the request sends, and what the question engine
 *   stores (attempt-state.php), and what the page shows again after the reload;
 * - the values a widget wrote are the same with the editor on as with it off.
 * Where a widget writes into an algebraic field (JSXGraph bind_point, GeoGebra watch, STACK-JS), the
 * editor shows the value; where the student types into such an editor, the widget follows
 * (JSXGraph two-way binding).
 *
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const {test, expect} = require('@playwright/test');
const {execFileSync} = require('child_process');
const {env, loginAs, open, openPage, closeLeftovers, requireFixture} = require('./helpers');

test.describe.configure({mode: 'serial', timeout: 300000});

const MODES = {off: '0', on: '1'};

/**
 * Switch the editor for the whole site; returns the previous mode.
 *
 * @param {string} mode '0' - '3'.
 * @returns {string} Previous mode.
 */
function siteMode(mode) {
    return execFileSync('php', [__dirname + '/editor-switch.php', mode]).toString().trim();
}

/**
 * What the question engine stored for a user's latest attempt, keyed "slot:name".
 *
 * @param {string} user Username.
 * @param {string} cmid Quiz.
 * @returns {Object} Stored values.
 */
function stored(user, cmid) {
    const state = JSON.parse(execFileSync('php', [__dirname + '/attempt-state.php', user, cmid]).toString());
    const out = {};
    Object.entries(state.slots || {}).forEach(([slot, s]) => Object.entries(s.vars).forEach(([name, value]) => {
        out[`${slot}:${name}`] = value;
    }));
    return out;
}

/**
 * Whether a form field name is an answer field: q<usage>:<slot>_<name>, not a validation echo,
 * a sequence check, a button or Moodle's language marker.
 *
 * @param {string} name Field name.
 * @returns {?string} Key "slot:name", or null.
 */
function answerKey(name) {
    const m = /^q\d+:(\d+)_(.+)$/.exec(name || '');
    if (!m || /^-|_val$|^:|^step_lang$/.test(m[2])) {
        return null;
    }
    return `${m[1]}:${m[2]}`;
}

const lines = (value) => String(value).replace(/\r\n?/g, '\n');

/**
 * Every answer field on the page: value, type, element and whether the editor took it.
 *
 * @param {import('@playwright/test').Page} page Page.
 * @returns {Promise<Object>} By key.
 */
async function pageFields(page) {
    const list = await page.evaluate(() => Array.from(document.querySelectorAll(
        '#responseform input[name], #responseform textarea[name], #responseform select[name]'))
        .filter((el) => !['hidden', 'submit', 'button', 'checkbox', 'radio'].includes(el.type)
            || el.getAttribute('data-stack-input-type'))
        .map((el) => ({
            name: el.name,
            value: el.value,
            type: el.getAttribute('data-stack-input-type'),
            editor: el.getAttribute('data-sme-init') === '1',
            wrapped: !!el.closest('.sme-input-wrap'),
        })));
    const out = {};
    list.forEach((f) => {
        const key = answerKey(f.name);
        if (key) {
            out[key] = {...f, value: lines(f.value)};
        }
    });
    return out;
}

/**
 * The answer fields of a request body, keyed "slot:name".
 *
 * @param {import('@playwright/test').Request} request Request.
 * @returns {Object} Values.
 */
function postedFields(request) {
    const body = request.postData() || '';
    const type = request.headers()['content-type'] || '';
    const boundary = (type.match(/boundary=(.+)$/) || [])[1];
    const out = {};
    const add = (name, value) => {
        const key = answerKey(name);
        if (key) {
            out[key] = lines(value);
        }
    };
    if (boundary) {
        body.split('--' + boundary).forEach((part) => {
            const m = part.match(/name="([^"]+)"\r\n\r\n([\s\S]*)\r\n$/);
            if (m) {
                add(m[1], m[2]);
            }
        });
    } else {
        for (const [name, value] of new URLSearchParams(body)) {
            add(name, value);
        }
    }
    return out;
}

/**
 * Open a fresh attempt of a quiz: finish a running one first.
 *
 * @param {import('@playwright/test').Page} page Student page.
 * @param {string} cmid Quiz.
 * @returns {Promise<void>}
 */
async function freshAttempt(page, cmid) {
    await open(page, `/mod/quiz/view.php?id=${cmid}`);
    const resume = page.getByRole('button', {name: /Continue your attempt|Continue the last attempt/});
    if (await resume.count()) {
        await resume.click();
        await page.waitForURL(/attempt\.php/);
        const id = new URL(page.url()).searchParams.get('attempt');
        await open(page, `/mod/quiz/summary.php?attempt=${id}&cmid=${cmid}`);
        await page.getByRole('button', {name: 'Submit all and finish'}).click();
        await page.getByRole('dialog').getByRole('button', {name: 'Submit all and finish'}).click();
        await page.waitForURL(/review\.php/, {timeout: 90000});
        await open(page, `/mod/quiz/view.php?id=${cmid}`);
    }
    await page.getByRole('button', {name: /Attempt quiz|Re-attempt quiz/}).click();
    const start = page.getByRole('button', {name: /Start attempt/});
    if (await start.count()) {
        await start.click();
    }
    await page.waitForURL(/attempt\.php/);
}

/**
 * Wait until the page is built: the editors when they are on, STACK's widgets always.
 *
 * @param {import('@playwright/test').Page} page Page.
 * @param {string} mode 'on' | 'off'.
 * @param {number} frames Number of widget iframes the page has.
 * @returns {Promise<void>}
 */
async function settled(page, mode, frames) {
    if (mode === 'on') {
        await page.locator('.sme-toggle-input').first().waitFor({state: 'attached', timeout: 60000});
    }
    await expect(page.locator('#responseform iframe')).toHaveCount(frames, {timeout: 60000});
    await page.waitForTimeout(1500);
}

/**
 * Submit the page and return the request: the Check button of a slot, or - slot 0 - the quiz
 * navigation's "Finish attempt ..." button, which posts the same form. Afterwards the attempt page
 * is open again.
 *
 * @param {import('@playwright/test').Page} page Page.
 * @param {number} slot Slot, or 0.
 * @returns {Promise<import('@playwright/test').Request>} POST request.
 */
async function check(page, slot) {
    const attemptUrl = page.url();
    const button = slot
        ? page.locator(`.que:has([name$=":${slot}_-submit"]) [type="submit"][name$="-submit"]`)
        : page.locator('#mod_quiz-next-nav');
    const requested = page.waitForRequest((r) => r.method() === 'POST' && /\/mod\/quiz\//.test(r.url()),
        {timeout: 60000});
    const navigated = page.waitForNavigation({waitUntil: 'domcontentloaded', timeout: 90000});
    await button.click();
    const request = await requested;
    await navigated;
    if (!slot) {
        await open(page, attemptUrl);
    }
    return request;
}

/**
 * Type into the editor of an algebraic field (editor on) or into the field itself (editor off).
 *
 * @param {import('@playwright/test').Page} page Page.
 * @param {string} mode 'on' | 'off'.
 * @param {string} key "slot:name".
 * @param {string} text Keys.
 * @returns {Promise<void>}
 */
async function typeAlgebraic(page, mode, key, text) {
    const [slot, name] = key.split(':');
    const sel = `[name$=":${slot}_${name}"]`;
    if (mode === 'on') {
        await page.evaluate((selector) => {
            document.querySelectorAll('[data-sme-test-target]').forEach((e) => e.removeAttribute('data-sme-test-target'));
            window.wrapOf(document.querySelector(selector)).setAttribute('data-sme-test-target', '1');
        }, sel);
        // A Parsons block on the page takes the focus on the first click into the page - with
        // the editor off as well (a native field loses it the same way). Click until the editor
        // has it, as a student would.
        for (let i = 0; i < 3; i += 1) {
            await page.locator('[data-sme-test-target] .sme-mq-container').click();
            await page.waitForTimeout(300);
            if (await page.evaluate(() => !!document.activeElement.closest('[data-sme-test-target]'))) {
                break;
            }
        }
        await page.keyboard.press('Control+a');
        await page.keyboard.press('Backspace');
        await page.keyboard.type(text);
    } else {
        await page.locator(sel).fill(text);
        await page.locator(sel).dispatchEvent('change');
    }
    await page.waitForTimeout(600);
}

/**
 * The LaTeX the editor of an algebraic field shows.
 *
 * @param {import('@playwright/test').Page} page Page.
 * @param {string} key "slot:name".
 * @returns {Promise<string>} LaTeX, or '' without an editor.
 */
function editorLatex(page, key) {
    const [slot, name] = key.split(':');
    return page.evaluate(([s, n]) => {
        const wrap = window.wrapOf(document.querySelector(`[name$=":${s}_${n}"]`));
        const field = wrap && wrap.querySelector('.mq-editable-field');
        return field ? window.MathQuill.getInterface(2)(field).latex() : '';
    }, [slot, name]);
}

/**
 * The common contract of one run: fields, request, store, reload.
 *
 * @param {Object} r Run record {before, posted, stored, reloaded}.
 * @param {string} mode 'on' | 'off'.
 * @param {string[]} supported Keys that get an editor when it is on.
 * @param {Function} [same] Normalises a value for the reload comparison (a widget that writes its
 *     field again on load, as JSXGraph's bindings do, may round differently).
 */
function expectContract(r, mode, supported, same = (v) => v) {
    Object.entries(r.before).forEach(([key, f]) => {
        const should = mode === 'on' && supported.includes(key);
        expect(f.editor, `${key} (${f.type}) editor in mode ${mode}`).toBe(should);
        expect(f.wrapped, `${key} wrapped`).toBe(false);
    });
    Object.entries(r.before).forEach(([key, f]) => {
        // The submit sends what the field held.
        expect(r.posted[key], `${key} (${f.type}) sent`).toBe(f.value);
        // The question engine stored it (an empty field is not stored).
        if (f.value !== '') {
            expect(lines(r.stored[key]), `${key} (${f.type}) stored`).toBe(f.value);
        }
        // The reloaded page shows it again.
        expect(same(r.reloaded[key] ? r.reloaded[key].value : null), `${key} (${f.type}) after reload`)
            .toBe(same(f.value));
    });
}

/**
 * Compare the foreign fields of both runs: the editor changes none of them.
 *
 * @param {Object} runs {off, on}.
 * @param {string[]} supported Keys the editor takes.
 * @param {string[]} [exclude] Keys whose values legitimately differ.
 */
function expectSameForeign(runs, supported, exclude = []) {
    Object.keys(runs.off.before).filter((k) => !supported.includes(k) && !exclude.includes(k)).forEach((key) => {
        expect(runs.on.posted[key], `${key} with the editor on and off`).toBe(runs.off.posted[key]);
    });
}

/**
 * Play one scenario in one mode: fresh attempt, act, Check, reload.
 *
 * @param {import('@playwright/test').Browser} browser Browser.
 * @param {Object} s Scenario {user, cmid, frames, act(page, mode), slot, afterReload?}.
 * @param {string} mode 'on' | 'off'.
 * @returns {Promise<Object>} Run record.
 */
async function play(browser, s, mode) {
    const previous = siteMode(MODES[mode]);
    const page = await openPage(browser);
    await page.addInitScript(() => {
        // The editor of an input is the .sme-input-wrap the editor inserted right before it.
        window.wrapOf = (input) => {
            let el = input ? input.previousElementSibling : null;
            while (el && !el.classList.contains('sme-input-wrap')) {
                el = el.previousElementSibling;
            }
            return el;
        };
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
        await loginAs(page, s.user, env('SME_USER_PASS'));
        await freshAttempt(page, s.cmid);
        await settled(page, mode, s.frames);
        if (mode === 'off') {
            await expect(page.locator('.sme-toggle-input, .sme-mq-container')).toHaveCount(0);
        }
        const notes = (await s.act(page, mode)) || {};
        await page.waitForTimeout(800);
        const before = await pageFields(page);
        const request = await check(page, s.slot);
        const posted = postedFields(request);
        const storedvalues = stored(s.user, s.cmid);
        await settled(page, mode, s.frames);
        const reloaded = await pageFields(page);
        const after = s.afterReload ? await s.afterReload(page, mode) : null;
        expect(errors, 'no script error on the page').toEqual([]);
        return {before, posted, stored: storedvalues, reloaded, notes, after};
    } finally {
        siteMode(previous);
        await page.context().close();
    }
}

/**
 * Round the decimals in a value to six places: JSXGraph's bindings serialise the restored board
 * again on load, with a different floating-point tail.
 *
 * @param {?string} value Value.
 * @returns {?string} Rounded.
 */
const rounded = (value) => (value === null ? null
    : value.replace(/-?\d+\.\d+(e-?\d+)?/g, (n) => String(Math.round(parseFloat(n) * 1e6) / 1e6)));

// ---------------------------------------------------------------------------------------------
// JSXGraph (STACK's binding demo): drag with the mouse, read the board.

/**
 * The n-th widget iframe of the form, scrolled into view.
 *
 * @param {import('@playwright/test').Page} page Page.
 * @param {number} n Index.
 * @returns {Promise<Object>} {frame, box}.
 */
async function widgetFrame(page, n) {
    const handle = page.locator('#responseform iframe').nth(n);
    // To the middle of the viewport: at an edge, Moodle's sticky footer or header would take the
    // mouse events of a drag.
    await handle.evaluate((el) => el.scrollIntoView({block: 'center', behavior: 'instant'}));
    await page.waitForTimeout(200);
    const frame = await (await handle.elementHandle()).contentFrame();
    return {frame, box: await handle.boundingBox()};
}

/**
 * Drag a draggable JSXGraph object (point or slider handle) of a board by a pixel offset.
 *
 * @param {import('@playwright/test').Page} page Page.
 * @param {number} n Board (iframe) index.
 * @param {number} pick Index among the board's draggable objects.
 * @param {number} dx Pixels right.
 * @param {number} dy Pixels down.
 * @returns {Promise<void>}
 */
async function dragJsx(page, n, pick, dx, dy) {
    const {frame, box} = await widgetFrame(page, n);
    await frame.waitForFunction(() => window.JXG && Object.keys(window.JXG.boards).length > 0, null, {timeout: 30000});
    const at = await frame.evaluate((i) => {
        const board = Object.values(window.JXG.boards)[0];
        const objects = board.objectsList.filter((o) => ['point', 'glider', 'slider'].includes(o.elType)
            && o.isDraggable && o.visPropCalc && o.visPropCalc.visible);
        const o = objects[i];
        const rect = board.containerObj.getBoundingClientRect();
        return {x: rect.left + o.coords.scrCoords[1], y: rect.top + o.coords.scrCoords[2], count: objects.length};
    }, pick);
    await page.mouse.move(box.x + at.x, box.y + at.y);
    await page.mouse.down();
    await page.mouse.move(box.x + at.x + dx, box.y + at.y + dy, {steps: 10});
    await page.mouse.up();
    await page.waitForTimeout(500);
}

/**
 * Coordinates of a board's draggable objects.
 *
 * @param {import('@playwright/test').Page} page Page.
 * @param {number} n Board index.
 * @returns {Promise<number[][]>} [[x, y], ...].
 */
async function jsxPoints(page, n) {
    const {frame} = await widgetFrame(page, n);
    await frame.waitForFunction(() => window.JXG && Object.keys(window.JXG.boards).length > 0, null, {timeout: 30000});
    return frame.evaluate(() => Object.values(window.JXG.boards)[0].objectsList
        .filter((o) => ['point', 'glider', 'slider'].includes(o.elType) && o.isDraggable)
        .map((o) => [Math.round(o.X() * 1000) / 1000, Math.round(o.Y() * 1000) / 1000]));
}

// ---------------------------------------------------------------------------------------------
// GeoGebra: the applet's own API inside STACK's iframe.

/**
 * Run a function with the GeoGebra API of the n-th widget iframe.
 *
 * @param {import('@playwright/test').Page} page Page.
 * @param {number} n Iframe index.
 * @param {Function} fn (api, arg) => value, evaluated in the iframe.
 * @param {*} arg Argument.
 * @returns {Promise<*>} Result.
 */
async function ggb(page, n, fn, arg) {
    const {frame} = await widgetFrame(page, n);
    // STACK names the applet "applet": GeoGebra registers its API as window.applet.
    await frame.waitForFunction(() => window.applet && typeof window.applet.exists === 'function'
        && window.applet.exists('A'), null, {timeout: 90000});
    return frame.evaluate(`(${fn.toString()})(window.applet, ${JSON.stringify(arg)})`);
}

// ---------------------------------------------------------------------------------------------

test.describe('STACK widgets next to the editor (#102, #103, #104)', () => {
    test.afterAll(async() => {
        await closeLeftovers();
    });

    test('every STACK input type: only algebraic and units get an editor; nothing foreign changes', async({browser}) => {
        requireFixture(test, Number(env('SME_INTEROP_TYPES_CMID', '0')) > 0, 'SME Interop Types Quiz');
        const supported = ['1:ans1', '1:ans9'];
        const scenario = {
            user: 'sme_student14',
            cmid: env('SME_INTEROP_TYPES_CMID'),
            frames: 0,
            // STACK shows no Check button on this question; the navigation submits the form.
            slot: 0,
            act: async(page, mode) => {
                const q = (n) => page.locator(`[name$=":1_${n}"]`);
                await q('ans2').fill('hello world');
                await expect(q('ans2')).toBeFocused();
                await q('ans3').fill('2.5');
                await q('ans4').fill('c');
                await q('ans5').fill('{"a":[1,2],"b":"x^2"}');
                await q('ans6').fill('my notes: x^2');
                await q('ans7_sub_0_0').fill('1');
                await q('ans7_sub_0_1').fill('2');
                await q('ans7_sub_1_0').fill('3');
                await q('ans7_sub_1_1').fill('4');
                await q('ans8').fill('1 2\n3 4');
                await q('ans10').selectOption('true');
                await q('ans11').fill('The derivative is 2*x because ...');
                await q('ans12').fill('[1,2]');
                await q('ans12').press('Tab');
                await typeAlgebraic(page, mode, '1:ans1', 'x^2');
                if (mode === 'on') {
                    // Focus moved into the editor and back: the foreign field keeps what was typed.
                    await expect(q('ans2')).toHaveValue('hello world');
                }
            },
        };
        const runs = {off: await play(browser, scenario, 'off'), on: await play(browser, scenario, 'on')};
        expectContract(runs.off, 'off', supported);
        expectContract(runs.on, 'on', supported);
        expectSameForeign(runs, supported);
        expect(runs.on.posted['1:ans1']).toBe(runs.off.posted['1:ans1']);
        expect(Object.keys(runs.on.before).length).toBeGreaterThanOrEqual(14);
    });

    test('JSXGraph bindings: points, sliders, pairs, lists, groups and a custom binding', async({browser}) => {
        requireFixture(test, Number(env('SME_INTEROP_JSX_CMID', '0')) > 0, 'SME Interop JSXGraph Quiz');
        const supported = ['bp', 'bs', 'dp', 'dpr', 'dpd', 'p1', 'p2', 'poly', 'p1b', 'p2b', 'polyb'].map((n) => `1:${n}`);
        const scenario = {
            user: 'sme_student15',
            cmid: env('SME_INTEROP_JSX_CMID'),
            frames: 6,
            slot: 1,
            act: async(page, mode) => {
                const value = (n) => page.locator(`[name$=":1_${n}"]`).inputValue();
                const notes = {};
                // bind_point: a drag writes the point into the algebraic field ...
                await dragJsx(page, 0, 0, 40, -30);
                notes.dragged = await value('bp');
                expect(notes.dragged).toMatch(/^\[-?[\d.]+,-?[\d.]+\]$/);
                if (mode === 'on') {
                    // ... and the editor shows it.
                    expect(await editorLatex(page, '1:bp')).toMatch(/\d/);
                }
                // ... and typing into the field (the editor, when on) moves the point: two-way.
                await typeAlgebraic(page, mode, '1:bp', '[2,-1]');
                await page.waitForTimeout(800);
                notes.typed = (await jsxPoints(page, 0))[0];
                // bind_slider.
                await dragJsx(page, 1, 0, 30, 0);
                // bind_point_dual, bind_point_relative, bind_point_direction on one pair.
                await dragJsx(page, 2, 0, 25, 25);
                // bind_point twice and bind_list_of on a triangle: move the third, unbound corner.
                await dragJsx(page, 3, 2, -20, 20);
                // The same with define_group: moving one corner fills every bound field.
                await dragJsx(page, 4, 2, -20, 20);
                // custom_bind with its own serializer, into a string field.
                await dragJsx(page, 5, 0, 30, 30);
                notes.custom = await value('custom');
                return notes;
            },
            afterReload: async(page) => ({bp: (await jsxPoints(page, 0))[0], dual: await jsxPoints(page, 2)}),
        };
        const runs = {off: await play(browser, scenario, 'off'), on: await play(browser, scenario, 'on')};
        for (const mode of ['off', 'on']) {
            const r = runs[mode];
            expectContract(r, mode, supported, rounded);
            expect(r.notes.typed, `typing [2,-1] moves the point (${mode})`).toEqual([2, -1]);
            expect(r.before['1:bp'].value).toBe('[2,-1]');
            ['bs', 'dp', 'dpr', 'dpd', 'poly', 'p1b', 'p2b', 'polyb', 'custom'].forEach((n) => {
                expect(r.before[`1:${n}`].value, `${n} filled by its binding (${mode})`).not.toBe('');
            });
            // define_group: the untouched corners' fields were filled too; without a group they stay empty.
            expect(r.before['1:p1'].value).toBe('');
            expect(r.before['1:p2'].value).toBe('');
            // The reload restores the board from the stored fields.
            expect(r.after.bp).toEqual([2, -1]);
        }
        // A mouse drag lands on a slightly different sub-pixel in each layout, so the numbers of a
        // dragged object differ in their decimals; their format - what the binding wrote and STACK
        // receives - is the same with the editor on and off, the custom string included. What was
        // typed is exactly the same.
        const shape = (v) => (v === undefined ? v : v.replace(/-?\d+(\.\d+)?(e-?\d+)?/g, 'N'));
        Object.keys(runs.off.before).forEach((key) => {
            expect(shape(runs.on.posted[key]), `${key} on = off (format)`).toBe(shape(runs.off.posted[key]));
        });
        expect(runs.on.posted['1:bp']).toBe(runs.off.posted['1:bp']);
    });

    test('GeoGebra: watched numbers and points, remember in a string and a geogebra input, two boards', async({browser}) => {
        requireFixture(test, Number(env('SME_INTEROP_GGB_CMID', '0')) > 0, 'SME Interop GeoGebra Quiz');
        const supported = ['1:ans1', '2:ans1', '2:A', '3:ans1'];
        const scenario = {
            user: 'sme_student16',
            cmid: env('SME_INTEROP_GGB_CMID'),
            frames: 2,
            slot: 3,
            act: async(page, mode) => {
                // Move the points through the applet; GeoGebra's listeners write the fields.
                await ggb(page, 0, (api) => {
                    api.setCoords('A', -2, 4);
                    api.setCoords('B', 2, 2);
                });
                await ggb(page, 1, (api) => {
                    api.setCoords('A', 1, 3);
                    api.setCoords('B', 3, -1);
                });
                await page.waitForTimeout(1500);
                const value = (k) => page.locator(`[name$=":${k.replace(':', '_')}"]`).inputValue();
                const notes = {q1: await value('1:ans1'), q2a: await value('2:A'), r1: await value('1:remember'),
                    r2: await value('2:remember')};
                if (mode === 'on') {
                    notes.latex = await editorLatex(page, '2:A');
                }
                await typeAlgebraic(page, mode, '3:ans1', 'a+b');
                return notes;
            },
            afterReload: async(page) => ({
                q1: await ggb(page, 0, (api) => [api.getXcoord('A'), api.getYcoord('A'), api.getXcoord('B')]),
                q2: await ggb(page, 1, (api) => [api.getXcoord('B'), api.getYcoord('B')]),
            }),
        };
        const runs = {off: await play(browser, scenario, 'off'), on: await play(browser, scenario, 'on')};
        for (const mode of ['off', 'on']) {
            const r = runs[mode];
            expectContract(r, mode, supported);
            // The watched slope (a number) and the watched point (a list) arrived in the fields.
            expect(r.notes.q1, `watched number (${mode})`).toMatch(/-?0?\.5|-1\/2/);
            expect(r.notes.q2a, `watched point (${mode})`).toMatch(/^\[\s*1(\.0+)?\s*,\s*3(\.0+)?\s*\]$/);
            // remember: JSON kept by GeoGebra in a string and in a geogebra input.
            expect(r.notes.r1).toMatch(/^\{.*"A".*\}$/);
            expect(r.notes.r2).toMatch(/^\{.*"B".*\}$/);
            // The reload restores the remembered points from the stored JSON.
            expect(r.after.q1).toEqual([-2, 4, 2]);
            expect(r.after.q2).toEqual([3, -1]);
        }
        expect(runs.on.notes.latex).toMatch(/1.*3/);
        expectSameForeign(runs, supported);
        supported.forEach((k) => expect(runs.on.posted[k], `${k} on = off`).toBe(runs.off.posted[k]));
    });

    test('Parsons proof and grid, reveal, adapt and STACK-JS next to an algebraic editor', async({browser}) => {
        requireFixture(test, Number(env('SME_INTEROP_GOODIES_CMID', '0')) > 0, 'SME Interop Goodies Quiz');
        const supported = ['3:ans3', '4:ans1', '5:ans1', '6:ans1'];
        const scenario = {
            user: 'sme_student17',
            cmid: env('SME_INTEROP_GOODIES_CMID'),
            frames: 6,
            slot: 6,
            act: async(page, mode) => {
                const notes = {};
                // Parsons proof: move two steps into the proof with STACK's double-click.
                let {frame} = await widgetFrame(page, 0);
                for (let i = 0; i < 2; i += 1) {
                    await frame.locator('#availableList li').first().dblclick();
                    await page.waitForTimeout(500);
                }
                // Parsons grid: drag the first available item into the first cell. The press is a
                // real mouse press; the HTML5 drag events are dispatched in the iframe, because
                // Chromium under Playwright does not complete a native drag inside an iframe.
                ({frame} = await widgetFrame(page, 1));
                const item = await frame.locator('#availableList li').first().boundingBox();
                await page.mouse.move(item.x + item.width / 2, item.y + item.height / 2);
                await page.mouse.down();
                await frame.evaluate(() => {
                    const dragged = document.querySelector('#availableList li.sortable-chosen')
                        || document.querySelector('#availableList li');
                    const cell = document.querySelector('#usedList_00');
                    const rect = cell.getBoundingClientRect();
                    const transfer = new DataTransfer();
                    const fire = (el, type) => el.dispatchEvent(new DragEvent(type, {bubbles: true, cancelable: true,
                        dataTransfer: transfer, clientX: rect.left + 10, clientY: rect.top + 10}));
                    fire(dragged, 'dragstart');
                    return new Promise((resolve) => setTimeout(() => {
                        fire(cell, 'dragenter');
                        fire(cell, 'dragover');
                        fire(cell, 'drop');
                        fire(dragged, 'dragend');
                        resolve();
                    }, 100));
                });
                await page.mouse.up();
                await page.waitForTimeout(800);
                notes.proof = await page.locator('[name$=":1_ans1"]').inputValue();
                notes.grid = await page.locator('[name$=":2_ans1"]').inputValue();
                // Reveal: answering "true" shows the part with an algebraic field.
                await page.locator('[name$=":3_ans1"]').selectOption('true');
                await page.waitForTimeout(1000);
                const revealed = page.locator('[name$=":3_ans3"]');
                if (mode === 'on') {
                    const editor = page.locator('.que:has([name$=":3_ans3"]) .sme-mq-container').first();
                    await expect(editor).toBeVisible();
                    expect((await editor.boundingBox()).width).toBeGreaterThan(50);
                } else {
                    await expect(revealed).toBeVisible();
                }
                await typeAlgebraic(page, mode, '3:ans3', '[1,2]');
                // Adapt: the button changes what is shown; the editor in it still works.
                await page.locator('.que:has([name$=":4_ans1"]) button:not([type="submit"])').first().click();
                await page.waitForTimeout(800);
                await typeAlgebraic(page, mode, '4:ans1', 'x+1');
                // STACK-JS: a script reads the string field and writes the hidden algebraic field.
                await page.locator('[name$=":5_ans2"]').fill('a£b');
                await page.locator('[name$=":5_ans2"]').press('Tab');
                await page.waitForTimeout(1500);
                notes.stackjs = await page.locator('[name$=":5_ans1"]').inputValue();
                await typeAlgebraic(page, mode, '6:ans1', 'a+b');
                return notes;
            },
        };
        const runs = {off: await play(browser, scenario, 'off'), on: await play(browser, scenario, 'on')};
        for (const mode of ['off', 'on']) {
            const r = runs[mode];
            expectContract(r, mode, supported);
            // Parsons keeps its state as JSON: the used steps or cells, the rest, a timestamp.
            const proof = JSON.parse(r.notes.proof)[0][0];
            const grid = JSON.parse(r.notes.grid)[0][0];
            expect(proof.used[0][0].length, `two proof steps used (${mode})`).toBe(2);
            expect(grid.used[0][0].length, `one grid cell filled (${mode})`).toBe(1);
            expect(r.notes.stackjs, `STACK-JS wrote the algebraic field (${mode})`).toBe('pound(a,b)');
            expect(r.posted['5:ans1']).toBe('pound(a,b)');
        }
        // The Parsons fields differ only in their timestamp (and in which step came first, the
        // available list being shuffled per attempt); their structure is the same on and off.
        const parsonsShape = (v) => JSON.stringify(JSON.parse(v)[0][0].used.map((col) => col.map((cell) => cell.length)));
        ['1:ans1', '2:ans1'].forEach((k) => {
            expect(parsonsShape(runs.on.posted[k]), `${k} on = off (structure)`).toBe(parsonsShape(runs.off.posted[k]));
        });
        expectSameForeign(runs, supported, ['1:ans1', '2:ans1']);
        supported.forEach((k) => expect(runs.on.posted[k], `${k} on = off`).toBe(runs.off.posted[k]));
    });
});

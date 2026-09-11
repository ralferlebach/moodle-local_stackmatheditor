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
 * Issue #22: Greek letters survive the complete roundtrip.
 *
 * Canonical representation = STACK's own convention: the letter's name (\alpha <-> alpha).
 * STACK 4.13 accepts every name as a student variable (security map: "variable": "s") and
 * typesets it as the Greek glyph. Variant glyphs map to their letter; uppercase letters that look
 * like Latin ones (A, B, E, ...) are not Greek in STACK and are not offered.
 *
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const {loadAmd, loadDefinitions, VARIABLE_MODES} = require('./amd_loader');

const tex2max = loadAmd('tex2max');
const max2tex = loadAmd('max2tex');
const defs = loadDefinitions();

/** Every Greek letter of the server definitions (incl. uppercase), except pi (a constant). */
const LETTERS = defs.greek.filter((name) => name !== 'pi');

const toMaxima = (latex, mode) => tex2max.convert(latex, {defs, variableMode: mode});
const toTex = (maxima, mode) => max2tex.convert(maxima, {defs, variableMode: mode});

describe.each(VARIABLE_MODES)('every Greek letter in mode %s', (mode) => {
    test.each(LETTERS)('\\%s: TeX -> Maxima -> TeX -> Maxima, never split', (name) => {
        const latex = '2\\' + name + ' a';
        const first = toMaxima(latex, mode);
        expect(first).toMatch(new RegExp('(^|[^A-Za-z])' + name + '([^A-Za-z]|$)'));
        expect(first).not.toMatch(/[a-z][ *][a-z][ *][a-z][ *][a-z]/);
        const tex = toTex(first, mode);
        expect(tex).toContain('\\' + name);
        expect(toMaxima(tex, mode)).toBe(first);
    });
});

describe('variant glyphs map to their letter', () => {
    test.each([
        ['\\varepsilon', 'epsilon'],
        ['\\vartheta', 'theta'],
        ['\\varphi', 'phi'],
        ['\\varepsilon_0', 'epsilon_0'],
    ])('%s -> %s in every mode', (latex, expected) => {
        VARIABLE_MODES.forEach((mode) => {
            expect(toMaxima(latex, mode)).toBe(expected);
        });
    });
});

describe('reserved and function names never change meaning', () => {
    test.each(VARIABLE_MODES)('\\lambda before a bracket is a product, never lambda(...) (mode %s)', (mode) => {
        const out = toMaxima('\\lambda\\left(x\\right)', mode);
        expect(out).not.toMatch(/lambda\s*\(/);
        expect(out).toContain('lambda');
    });

    test.each([
        ['\\pi', 'pi'],
        ['\\beta x', 'beta*x'],
        ['\\gamma\\left(x\\right)', 'gamma*(x)'],
        ['\\lambda x', 'lambda*x'],
    ])('explicit_single: %s -> %s', (latex, expected) => {
        expect(toMaxima(latex, 'explicit_single')).toBe(expected);
    });

    test('pi honours the percent-pi setting', () => {
        expect(tex2max.convert('\\pi', {defs: loadDefinitions({usePercentPi: true})})).toBe('%pi');
    });
});

describe('policy for Latin letter sequences (documented in README)', () => {
    test('typed letters a-l-p-h-a are one identifier in multi-letter modes, which STACK shows as α', () => {
        expect(toMaxima('alpha', 'explicit_multi')).toBe('alpha');
        expect(toTex('alpha', 'explicit_multi')).toBe('\\alpha');
    });

    test('a Greek name is protected in single-letter modes; other letter sequences are split', () => {
        expect(toMaxima('alpha', 'explicit_single')).toBe('alpha');
        expect(toMaxima('alp', 'explicit_single')).toBe('a*l*p');
    });
});

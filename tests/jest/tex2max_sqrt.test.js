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
 * Issue #39: \sqrt must always become the atomic Maxima function sqrt(...).
 *
 * Root cause: converting a control word produced a bare word that fused with what preceded it
 * (a\sqrt{b} -> "asqrt", \pm\sqrt -> "\pmsqrt"), after which single-variable mode split it into
 * s*q*r*t. The converter now places a token boundary in front of every control word.
 *
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const {loadAmd, loadDefinitions, VARIABLE_MODES} = require('./amd_loader');

const tex2max = loadAmd('tex2max');
const max2tex = loadAmd('max2tex');
const defs = loadDefinitions();

const SCREENSHOT = 'x=-\\frac{p}{2}\\pm\\sqrt{\\frac{p^2}{4-q}}';

const MANDATORY = [
    '\\sqrt{x}',
    '\\sqrt{x+1}',
    '\\sqrt{\\frac{1}{x}}',
    '\\sqrt{\\frac{p^2}{4-q}}',
    '2\\sqrt{x}',
    'a\\sqrt{b}',
    SCREENSHOT,
];

/**
 * Convert with the production definitions.
 *
 * @param {string} latex LaTeX input.
 * @param {string} mode Variable mode.
 * @param {Object} [definitions] Definitions to use.
 * @returns {string} Maxima output.
 */
const toMaxima = (latex, mode, definitions = defs) => tex2max.convert(latex, {defs: definitions, variableMode: mode});

describe.each(VARIABLE_MODES)('tex2max \\sqrt in mode %s', (mode) => {
    test.each(MANDATORY)('%s keeps sqrt atomic and leaves no backslash', (latex) => {
        const out = toMaxima(latex, mode);
        expect(out).toContain('sqrt(');
        expect(out).not.toMatch(/\\/);
        expect(out).not.toMatch(/s[\s*]+q[\s*]+r[\s*]+t/);
    });

    test('sqrt stays atomic even without server definitions', () => {
        const out = toMaxima('a\\sqrt{b}', mode, {});
        expect(out).toContain('sqrt(b)');
        expect(out).not.toContain('asqrt');
    });

    test('the screenshot input never reproduces the reported output', () => {
        const out = toMaxima(SCREENSHOT, mode);
        expect(out).not.toContain('\\p');
        expect(out).not.toContain('\\s');
        expect(out).not.toContain('p*m');
        expect(out).toContain('sqrt((p^2)/(4-q))');
    });

    test.each(MANDATORY)('%s is stable over TeX -> Maxima -> TeX -> Maxima', (latex) => {
        const first = toMaxima(latex, mode);
        const back = max2tex.convert(first, {defs, variableMode: mode});
        expect(toMaxima(back, mode)).toBe(first);
    });
});

describe('tex2max \\sqrt exact output', () => {
    test.each([
        ['\\sqrt{x}', 'explicit_single', 'sqrt(x)'],
        ['\\sqrt{\\frac{p^2}{4-q}}', 'explicit_single', 'sqrt((p^2)/(4-q))'],
        ['2\\sqrt{x}', 'explicit_multi', '2*sqrt(x)'],
        ['a\\sqrt{b}', 'explicit_multi', 'a*sqrt(b)'],
        ['a\\sqrt{b}', 'space_single', 'a sqrt(b)'],
        ['2\\sqrt{x}', 'stack', '2sqrt(x)'],
        ['a\\sqrt{b}', 'stack', 'a sqrt(b)'],
    ])('%s in %s -> %s', (latex, mode, expected) => {
        expect(toMaxima(latex, mode)).toBe(expected);
    });

    test('both +/- alternatives carry the complete root', () => {
        const out = toMaxima(SCREENSHOT, 'explicit_single');
        expect(out).toContain('x=-(p)/(2)+sqrt((p^2)/(4-q))');
        expect(out).toContain('x=-(p)/(2)-sqrt((p^2)/(4-q))');
    });
});

describe('neighbouring control words no longer fuse (same root cause)', () => {
    test.each([
        ['\\alpha\\beta', 'explicit_single', 'alpha*beta'],
        ['x_1\\sqrt{2}', 'explicit_multi', 'x_1*sqrt(2)'],
        ['x\\in\\mathbb{R}', 'stack', 'x in R'],
        ['\\binom{n}{k}', 'explicit_single', 'binomial(n,k)'],
        ['\\left\\{1,2\\right\\}', 'stack', '{1,2}'],
        ['2\\frac{1}{2}', 'stack', '(2+1/2)'],
        ['\\not\\exists x', 'stack', 'nexists x'],
    ])('%s in %s -> %s', (latex, mode, expected) => {
        expect(toMaxima(latex, mode)).toBe(expected);
    });
});

describe('max2tex renders sqrt as \\sqrt', () => {
    test.each([
        ['sqrt(x)', '\\sqrt{x}'],
        ['sqrt((p^2)/(4-q))', '\\sqrt{\\frac{p^2}{4-q}}'],
        ['2sqrt(x)', '2\\sqrt{x}'],
    ])('%s -> %s', (maxima, expected) => {
        expect(max2tex.convert(maxima, {defs})).toBe(expected);
    });
});

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
 * Issue #30: \pm / \mp expand into two coupled alternatives joined by nounor, without moving a
 * sign into another subtree, and collapse back losslessly.
 *
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const {loadAmd, loadDefinitions, VARIABLE_MODES} = require('./amd_loader');

const tex2max = loadAmd('tex2max');
const max2tex = loadAmd('max2tex');
const defs = loadDefinitions();

const toMaxima = (latex, mode = 'explicit_single') => tex2max.convert(latex, {defs, variableMode: mode});
const toTex = (maxima, mode = 'explicit_single') => max2tex.convert(maxima, {defs, variableMode: mode});

/** Required fixtures of #30 (MathQuill LaTeX). */
const FIXTURES = [
    'x=\\pm 2',
    'x=\\pm 2\\sqrt{\\pi}',
    'x=a\\left(\\pm b+c\\right)',
    'x=a\\pm b',
    'x=a\\pm b\\mp c',
    'x=-a\\pm b',
    '\\left(\\pm a\\right)+b',
    '\\sqrt{a\\pm b}',
];

describe('tex2max: expansion semantics (explicit_single)', () => {
    test.each([
        ['x=\\pm 2', '(x=2) nounor (x=-2)'],
        ['x=\\pm 2\\sqrt{\\pi}', '(x=2*sqrt(pi)) nounor (x=-2*sqrt(pi))'],
        ['x=a\\left(\\pm b+c\\right)', '(x=a*(b+c)) nounor (x=a*(-b+c))'],
        ['x=a\\pm b', '(x=a+b) nounor (x=a-b)'],
        ['x=a\\pm b\\mp c', '(x=a+b-c) nounor (x=a-b+c)'],
        ['x=-a\\pm b', '(x=-a+b) nounor (x=-a-b)'],
        ['\\sqrt{a\\pm b}', '(sqrt(a+b)) nounor (sqrt(a-b))'],
    ])('%s -> %s', (latex, expected) => {
        expect(toMaxima(latex)).toBe(expected);
    });

    test('the sign after "=" stays on the right-hand side', () => {
        const out = toMaxima('x=\\pm 2\\sqrt{\\pi}');
        expect(out).not.toMatch(/\+\s*x/);
        expect(out).not.toContain('=+');
    });

    test('coupled signs give exactly two alternatives, never four', () => {
        const out = toMaxima('x=a\\pm b\\mp c');
        expect(out.split('nounor')).toHaveLength(2);
        expect(out).not.toContain('a+b+c');
        expect(out).not.toContain('a-b-c');
    });

    test('a binary plus is never stripped', () => {
        expect(toMaxima('x=a\\left(\\pm b+c\\right)')).toContain('(b+c)');
    });

    test('new output uses nounor, never a bare or', () => {
        expect(toMaxima('x=\\pm 2')).not.toMatch(/\bor\b/);
    });
});

describe.each(VARIABLE_MODES)('roundtrip in mode %s', (mode) => {
    test.each(FIXTURES)('%s: TeX -> Maxima -> TeX -> Maxima is stable', (latex) => {
        const first = toMaxima(latex, mode);
        const tex = toTex(first, mode);
        expect(tex).toMatch(/\\pm|\\mp/);
        expect(toMaxima(tex, mode)).toBe(first);
    });
});

describe('max2tex: collapsing alternatives', () => {
    test.each([
        ['(x=2) nounor (x=-2)', 'x=\\pm 2'],
        ['(x=a+b-c) nounor (x=a-b+c)', 'x=a\\pm b\\mp c'],
        ['(x=-2) nounor (x=2)', 'x=\\mp 2'],
    ])('%s -> %s', (maxima, expected) => {
        expect(toTex(maxima)).toBe(expected);
    });

    test.each([
        ['(x=1) nounor (x=2)'],
        ['(x>0) or (x<0)'],
        ['(a) nounor (b) nounor (c)'],
        // A logical "or" (∨ button) is a statement, never a solution set.
        ['(x=2) or (x=-2)'],
        ['x=2 or x=-2'],
    ])('%s is an ordinary disjunction, not a +/- pair', (maxima) => {
        const tex = toTex(maxima);
        expect(tex).not.toMatch(/\\pm|\\mp/);
        expect(tex).toContain('\\lor');
    });
});

describe('max2tex renders pi exactly once (found while testing #30)', () => {
    test.each([
        ['pi', '\\pi'],
        ['2*sqrt(pi)', '2\\sqrt{\\pi }'],
    ])('%s -> %s', (maxima, expected) => {
        const tex = toTex(maxima);
        expect(tex).toBe(expected);
        expect(tex).not.toContain('\\\\');
    });
});

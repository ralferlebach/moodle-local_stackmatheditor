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
 * Issue #96: nesting deeper than the three levels of nesting.test.js (#78, #79).
 *
 * A converter that reads arguments with a regex allowing a fixed number of brace levels works
 * up to that depth and corrupts the next one. Depth 4 and 6 are therefore checked for every
 * construct that nests: square roots, absolute values, fractions (numerator and denominator),
 * nth roots, functions in functions and an alternating mix. Each case is checked in all five
 * variable modes for the exact Maxima, the exact LaTeX on the way back, and stability over
 * TeX -> Maxima -> TeX -> Maxima.
 *
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const {loadAmd, loadDefinitions, VARIABLE_MODES} = require('./amd_loader');

const tex2max = loadAmd('tex2max');
const max2tex = loadAmd('max2tex');
const defs = loadDefinitions();

const toMaxima = (latex, mode) => tex2max.convert(latex, {defs, variableMode: mode});
const toTex = (maxima, mode) => max2tex.convert(maxima, {defs, variableMode: mode});

/**
 * Apply a wrapper depth times, innermost first.
 *
 * @param {number} depth Number of levels.
 * @param {Function} wrap (inner, level) => wrapped; level 0 is the innermost.
 * @param {string} inner Innermost expression.
 * @returns {string} Nested expression.
 */
function nest(depth, wrap, inner) {
    let out = inner;
    for (let level = 0; level < depth; level += 1) {
        out = wrap(out, level);
    }
    return out;
}

const FUNCTIONS = [
    ['sin', '\\sin'],
    ['cos', '\\cos'],
    ['log', '\\ln'],
    ['exp', '\\exp'],
    ['tan', '\\tan'],
    ['sinh', '\\sinh']
];

/** Alternating mix: root, absolute value, reciprocal, sine. */
const MIX = [
    [(m) => 'sqrt(' + m + ')', (l) => '\\sqrt{' + l + '}'],
    [(m) => 'abs(' + m + ')', (l) => '\\left|' + l + '\\right|'],
    [(m) => '(1)/(' + m + ')', (l) => '\\frac{1}{' + l + '}'],
    [(m) => 'sin(' + m + ')', (l) => '\\sin\\left(' + l + '\\right)']
];

/**
 * The constructs: [name, depth => LaTeX, depth => Maxima].
 *
 * The Maxima column is the documented form: fractions keep their brackets, nth roots are
 * powers with a reciprocal exponent, ln is log.
 */
const CONSTRUCTS = [
    ['sqrt',
        (d) => nest(d, (s) => '\\sqrt{' + s + '}', 'x'),
        (d) => nest(d, (s) => 'sqrt(' + s + ')', 'x')],
    ['sqrt with a neighbour',
        (d) => nest(d, (s) => '\\sqrt{1+' + s + '}', 'x'),
        (d) => nest(d, (s) => 'sqrt(1+' + s + ')', 'x')],
    ['abs',
        (d) => nest(d, (s) => '\\left|' + s + '\\right|', 'x'),
        (d) => nest(d, (s) => 'abs(' + s + ')', 'x')],
    ['abs with a neighbour',
        (d) => nest(d, (s) => '\\left|1+' + s + '\\right|', 'x'),
        (d) => nest(d, (s) => 'abs(1+' + s + ')', 'x')],
    ['fraction in the numerator',
        (d) => nest(d, (s) => '\\frac{' + s + '}{2}', 'x'),
        (d) => nest(d, (s) => '(' + s + ')/(2)', 'x')],
    ['fraction in the denominator',
        (d) => nest(d, (s) => '\\frac{1}{' + s + '}', 'x'),
        (d) => nest(d, (s) => '(1)/(' + s + ')', 'x')],
    ['fraction in the denominator with a neighbour',
        (d) => nest(d, (s) => '\\frac{1}{1+' + s + '}', 'x'),
        (d) => nest(d, (s) => '(1)/(1+' + s + ')', 'x')],
    ['nth root',
        (d) => nest(d, (s, i) => '\\sqrt[' + (i + 2) + ']{' + s + '}', 'x'),
        (d) => nest(d, (s, i) => '(' + s + ')^(1/(' + (i + 2) + '))', 'x')],
    ['function in function',
        (d) => nest(d, (s, i) => FUNCTIONS[i % FUNCTIONS.length][1] + '\\left(' + s + '\\right)', 'x'),
        (d) => nest(d, (s, i) => FUNCTIONS[i % FUNCTIONS.length][0] + '(' + s + ')', 'x')],
    ['the same function nested',
        (d) => nest(d, (s) => '\\cos\\left(' + s + '\\right)', 'x'),
        (d) => nest(d, (s) => 'cos(' + s + ')', 'x')],
    ['function of a fraction of a function',
        (d) => nest(d, (s, i) => (i % 2 ? '\\frac{1}{' + s + '}' : '\\sin\\left(' + s + '\\right)'), 'x'),
        (d) => nest(d, (s, i) => (i % 2 ? '(1)/(' + s + ')' : 'sin(' + s + ')'), 'x')],
    ['mixed root, abs, fraction, sine',
        (d) => nest(d, (s, i) => MIX[i % MIX.length][1](s), 'x'),
        (d) => nest(d, (s, i) => MIX[i % MIX.length][0](s), 'x')]
];

const CASES = [];
CONSTRUCTS.forEach(([name, latex, maxima]) => {
    [4, 6].forEach((depth) => {
        CASES.push([name, depth, latex(depth), maxima(depth)]);
    });
});

describe.each(VARIABLE_MODES)('nesting depth in mode %s', (mode) => {
    test.each(CASES)('%s, depth %i: LaTeX -> Maxima', (_name, _depth, latex, maxima) => {
        expect(toMaxima(latex, mode)).toBe(maxima);
    });

    test.each(CASES)('%s, depth %i: Maxima -> LaTeX', (_name, _depth, latex, maxima) => {
        expect(toTex(maxima, mode)).toBe(latex);
    });

    test.each(CASES)('%s, depth %i: TeX -> Maxima -> TeX -> Maxima is stable',
        (_name, _depth, latex) => {
            const first = toMaxima(latex, mode);
            expect(first).not.toBe('');
            expect(toMaxima(toTex(first, mode), mode)).toBe(first);
        });
});

describe('nesting depth: structural invariants', () => {
    test.each(CASES)('%s, depth %i: brackets balance and nothing is reported',
        (_name, _depth, latex) => {
            const result = tex2max.analyse(latex, {defs, variableMode: 'stack'});
            expect(result.problems).toEqual([]);
            let open = 0;
            for (const ch of result.maxima) {
                open += ch === '(' ? 1 : ch === ')' ? -1 : 0;
                expect(open).toBeGreaterThanOrEqual(0);
            }
            expect(open).toBe(0);
            expect(result.maxima).not.toMatch(/\\/);
        });

    test.each([4, 6])('abs at depth %i keeps every bar pair', (depth) => {
        const latex = toTex(nest(depth, (s) => 'abs(' + s + ')', 'x'), 'stack');
        expect((latex.match(/\\left\|/g) || []).length).toBe(depth);
        expect((latex.match(/\\right\|/g) || []).length).toBe(depth);
    });

    test.each([4, 6])('sqrt at depth %i never fuses the command into its argument', (depth) => {
        const out = toMaxima(nest(depth, (s) => '\\sqrt{' + s + '}', 'x'), 'explicit_single');
        expect(out).not.toMatch(/sqrt[a-z]/);
        expect(out).not.toMatch(/s\*q\*r\*t/);
        expect((out.match(/sqrt\(/g) || []).length).toBe(depth);
    });
});

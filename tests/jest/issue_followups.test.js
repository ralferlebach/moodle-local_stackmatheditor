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
 * Open acceptance criteria of #30, #42, #45 and #46, closed in 1.4.0, in every variable mode.
 *
 * - #30: a unary plus on the way back is optional: (x=+2) nounor (x=-2) is x=±2.
 * - #42: nounand and nounor are never split, starred or spaced into something else; an equation
 *   system survives TeX -> Maxima -> TeX -> Maxima as the same string, also in stack mode; mod is
 *   a function call, never "mod (7,3)".
 * - #45: \nabla stays one word ("nabla"), never n*a*b*l*a; a Delta in front of a bracket is the
 *   Greek letter where the site has no Laplace operator.
 * - #46: the Leibniz notation with the operand in the numerator is a derivative:
 *   \frac{\partial f}{\partial x} is diff(f,x), not (del*f)/(del*x).
 *
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const {loadAmd, loadDefinitions, VARIABLE_MODES} = require('./amd_loader');

const tex2max = loadAmd('tex2max');
const max2tex = loadAmd('max2tex');
const defs = loadDefinitions();

/**
 * Options for one mode.
 *
 * @param {string} mode Variable mode.
 * @returns {Object} Conversion options.
 */
const opts = (mode) => ({defs: defs, variableMode: mode});

describe.each(VARIABLE_MODES)('mode %s', (mode) => {
    test('#30: a unary plus is optional on the way back', () => {
        const tex = max2tex.convert('(x=+2) nounor (x=-2)', opts(mode));
        expect(tex).toBe('x=\\pm 2');
        expect(tex2max.convert(tex, opts(mode))).toBe('(x=2) nounor (x=-2)');
    });

    test.each([
        ['nounand'],
        ['nounor'],
        ['p nounand q'],
        ['p nounor q']
    ])('#42: "%s" typed as text keeps its noun operator whole', (text) => {
        const result = tex2max.analyse(text, opts(mode));
        expect(result.problems).toEqual([]);
        expect(result.maxima.split(/\s+/)).toEqual(text.split(' '));
    });

    test('#42: an equation system is string-stable over a round trip', () => {
        const first = tex2max.convert(max2tex.convert('(a+2*b=5) nounand (a=1)', opts(mode)), opts(mode));
        expect(first).toMatch(/^\(a\+2[ *]?b=5\) nounand \(a=1\)$/);
        expect(tex2max.convert(max2tex.convert(first, opts(mode)), opts(mode))).toBe(first);
    });

    test('#42: the alignment mark leaves no space behind the relation', () => {
        expect(tex2max.convert('\\begin{cases}x&=1\\\\y&=2\\end{cases}', opts(mode)))
            .toBe('(x=1) nounand (y=2)');
    });

    test('#42: mod is a function call', () => {
        expect(tex2max.convert('mod\\left(7,3\\right)', opts(mode))).toBe('mod(7,3)');
        expect(tex2max.convert(max2tex.convert('mod(7,3)', opts(mode)), opts(mode))).toBe('mod(7,3)');
    });

    test('#45: \\nabla is one word', () => {
        expect(tex2max.convert('\\nabla f', opts(mode))).toMatch(/^nabla[ *]f$/);
    });

    test('#45: without a Laplace operator, Delta before a bracket is the Greek letter', () => {
        const result = tex2max.analyse('\\Delta\\left(t\\right)', opts(mode));
        expect(result.problems).toEqual([]);
        expect(result.maxima).toMatch(/^Delta[ *]?\(t\)$/);
    });

    test.each([
        ['\\frac{\\partial f}{\\partial x}', 'diff(f,x)'],
        ['\\frac{\\partial^{2}f}{\\partial x^{2}}', 'diff(f,x,2)'],
        ['\\frac{\\partial^{2}f}{\\partial x\\partial y}', 'diff(f,x,1,y,1)'],
        ['\\frac{\\mathrm{d}\\left(x^2\\right)}{\\mathrm{d}x}', 'diff(x^2,x)'],
        ['\\frac{\\partial f}{\\partial x}+1', 'diff(f,x)+1']
    ])('#46: %s is a derivative', (latex, expected) => {
        const result = tex2max.analyse(latex, opts(mode));
        expect(result.problems).toEqual([]);
        expect(result.maxima).toBe(expected);
    });

    test('#46: the order of the numerator still has to match the denominator', () => {
        expect(tex2max.analyse('\\frac{\\partial^{3}f}{\\partial x}', opts(mode)).problems)
            .toEqual(['derivative_order_mismatch']);
    });

    test('#46: a bare d is not read as an operator - "df" may be a product', () => {
        expect(tex2max.convert('\\frac{df}{dx}', opts(mode))).not.toMatch(/diff/);
    });
});

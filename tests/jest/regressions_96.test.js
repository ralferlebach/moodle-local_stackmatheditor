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
 * Issue #96: the four conversion defects the #96 suites uncovered, pinned in every variable mode.
 *
 * A. A fraction argument may nest braces to any depth: \frac{1}{\sqrt{x_{1}}} is converted,
 *    not reported as an unparsed structure.
 * B. The function names the converter writes itself (matrix, determinant, ident, transpose, the
 *    geometry functions, the configured norm and differential operators) are never split or
 *    starred by the variable logic, with and without definitions.
 * C. What follows a closed ^{...} or _{...} group is a new factor. It never merges into the
 *    script: x^{2}3 is not x^23, x_{1}2 is not x_12 (that is x_{12}), e^{x}y is not e^(xy).
 *    The separator is the one each mode already uses after a script group (x^{2}y):
 *    explicit modes write "*", the space modes a space, and stack mode a space wherever the two
 *    neighbours would otherwise read as one token (x^2 3, x^n 2, e^x y). A digit followed by a
 *    letter cannot fuse, so x^{2}y stays x^2y in stack mode, as before.
 * D. max2tex braces every exponent of more than one character (x^11 -> x^{11}) and writes a
 *    power chain as nested groups (x^y^z -> x^{y^{z}}, Maxima's ^ is right-associative). A
 *    single-character exponent at the top level stays as it is (x^2).
 *
 * Every case is also checked over TeX -> Maxima -> TeX -> Maxima in its mode.
 *
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const {loadAmd, loadDefinitions, VARIABLE_MODES} = require('./amd_loader');

const tex2max = loadAmd('tex2max');
const max2tex = loadAmd('max2tex');
const defs = loadDefinitions();

/**
 * Expected output per mode.
 *
 * @param {string} stack stack mode.
 * @param {string} es explicit_single.
 * @param {string} em explicit_multi.
 * @param {string} ss space_single.
 * @param {string} sm space_multi.
 * @returns {Object} Map mode -> expected Maxima.
 */
const per = (stack, es, em, ss, sm) => ({
    stack: stack,
    'explicit_single': es,
    'explicit_multi': em,
    'space_single': ss,
    'space_multi': sm
});

/**
 * The same expected output in every mode.
 *
 * @param {string} maxima Expected Maxima.
 * @returns {Object} Map mode -> expected Maxima.
 */
const all = (maxima) => per(maxima, maxima, maxima, maxima, maxima);

/**
 * TeX -> Maxima -> TeX -> Maxima must give back the first Maxima.
 *
 * @param {string} latex LaTeX.
 * @param {string} mode Variable mode.
 * @param {Object} [d] Definitions.
 */
function expectStable(latex, mode, d) {
    const options = {defs: d === undefined ? defs : d, variableMode: mode};
    const first = tex2max.convert(latex, options);
    expect(first).not.toBe('');
    expect(tex2max.convert(max2tex.convert(first, options), options)).toBe(first);
}

describe('A: fraction arguments nest to any depth', () => {
    /** [LaTeX, expected Maxima in every mode]. */
    const ROWS = [
        ['\\frac{1}{\\sqrt{x^{2}+1}}', '(1)/(sqrt(x^2+1))'],
        ['\\frac{1}{\\sqrt{x_{1}}}', '(1)/(sqrt(x_1))'],
        ['\\frac{e^{x_{1}}}{2}', '(e^(x_1))/(2)'],
        ['\\frac{x^{y^{z}}}{2}', '(x^(y^z))/(2)'],
        ['\\frac{1}{\\sqrt{\\sqrt{h}}}', '(1)/(sqrt(sqrt(h)))'],
        ['\\frac{\\sqrt{\\frac{1}{x_{1}}}}{\\left|y_{2}\\right|}', '(sqrt((1)/(x_1)))/(abs(y_2))'],
        // The established forms stay exactly as they were.
        ['\\frac{1}{2}', '(1)/(2)'],
        ['2\\frac{1}{2}', '(2+1/2)'],
        ['21\\frac{3}{4}', '(21+3/4)'],
        ['\\frac{\\frac{1}{x}}{\\frac{1}{y}}', '((1)/(x))/((1)/(y))']
    ];

    describe.each(VARIABLE_MODES)('mode %s', (mode) => {
        test.each(ROWS)('%s -> %s', (latex, maxima) => {
            const result = tex2max.analyse(latex, {defs, variableMode: mode});
            expect(result.problems).toEqual([]);
            expect(result.maxima).toBe(maxima);
        });

        test.each(ROWS)('%s is stable over a roundtrip', (latex) => {
            expectStable(latex, mode);
        });
    });

    test('a mixed number in front of a deep fraction is still a mixed number only for digits', () => {
        expect(tex2max.convert('2\\frac{1}{\\sqrt{x_{1}}}', {defs, variableMode: 'explicit_multi'}))
            .toBe('2*(1)/(sqrt(x_1))');
    });
});

describe('B: the converter\'s own function names are never split', () => {
    const NORM = {normFunction: 'norm'};
    const DIFFOPS = {diffOps: {gradient: 'grad', divergence: 'div', curl: 'curl', laplacian: 'laplacian'}};

    /** [label, LaTeX, extra definitions, expected Maxima in every mode]. */
    const ROWS = [
        ['matrix', '\\begin{bmatrix}a&b\\\\c&d\\end{bmatrix}', {}, 'matrix([a,b],[c,d])'],
        ['column vector', '\\begin{pmatrix}x\\\\y\\end{pmatrix}', {}, 'matrix([x],[y])'],
        ['ident', '\\operatorname{ident}\\left(3\\right)', {}, 'ident(3)'],
        ['determinant (vmatrix)', '\\begin{vmatrix}a&b\\\\c&d\\end{vmatrix}', {},
            'determinant(matrix([a,b],[c,d]))'],
        ['determinant (det)', '\\det\\left(A\\right)', {}, 'determinant(A)'],
        ['transpose', '\\operatorname{transpose}\\left(A\\right)', {}, 'transpose(A)'],
        ['transpose of a matrix', '\\operatorname{transpose}\\left(\\begin{bmatrix}a&b\\end{bmatrix}\\right)', {},
            'transpose(matrix([a,b]))'],
        ['distance', 'd\\left(A,B\\right)', {}, 'Distance(A,B)'],
        ['angle', '\\angle ABC', {}, 'Angle(A,B,C)'],
        ['configured norm', '\\left\\|v\\right\\|', NORM, 'norm(v)'],
        ['configured gradient', '\\operatorname{grad}\\left(f\\right)', DIFFOPS, 'grad(f)'],
        ['configured divergence', '\\operatorname{div}\\left(F\\right)', DIFFOPS, 'div(F)'],
        ['configured curl', '\\operatorname{rot}\\left(F\\right)', DIFFOPS, 'curl(F)'],
        ['configured Laplacian', '\\Delta\\left(f\\right)', DIFFOPS, 'laplacian(f)']
    ];

    describe.each(VARIABLE_MODES)('mode %s', (mode) => {
        test.each(ROWS)('%s with the site definitions', (_label, latex, extra, maxima) => {
            expect(tex2max.convert(latex, {defs: loadDefinitions(extra), variableMode: mode})).toBe(maxima);
        });

        test.each(ROWS)('%s without definitions', (_label, latex, extra, maxima) => {
            expect(tex2max.convert(latex, {defs: extra, variableMode: mode})).toBe(maxima);
            expect(tex2max.convert(latex, {defs: Object.assign({}, extra), variableMode: mode}))
                .toBe(maxima);
        });

        test.each(ROWS.filter((row) => row[0] !== 'angle' && row[0] !== 'distance'))(
            '%s is stable over a roundtrip', (_label, latex, extra) => {
                expectStable(latex, mode, loadDefinitions(extra));
            });
    });

    test('without any options at all', () => {
        expect(tex2max.convert('\\begin{bmatrix}a&b\\\\c&d\\end{bmatrix}', {variableMode: 'explicit_single'}))
            .toBe('matrix([a,b],[c,d])');
        expect(tex2max.convert('\\operatorname{ident}\\left(3\\right)', {variableMode: 'space_single'}))
            .toBe('ident(3)');
    });

    test('the cells still follow the mode', () => {
        const latex = '\\begin{bmatrix}ab&c\\end{bmatrix}';
        const expected = per('matrix([ab,c])', 'matrix([a*b,c])', 'matrix([ab,c])', 'matrix([a b,c])',
            'matrix([ab,c])');
        VARIABLE_MODES.forEach((mode) => {
            expect(tex2max.convert(latex, {defs, variableMode: mode})).toBe(expected[mode]);
        });
    });

    test('a coefficient in front of a matrix is a product in the explicit modes', () => {
        expect(tex2max.convert('2\\begin{pmatrix}a\\\\b\\end{pmatrix}', {defs, variableMode: 'explicit_single'}))
            .toBe('2*matrix([a],[b])');
    });

    test('a variable named like a constructor but not applied is still split in single modes', () => {
        // Only a call is protected by the function list; the word alone is no call.
        expect(tex2max.convert('ab', {defs, variableMode: 'explicit_single'})).toBe('a*b');
    });
});

describe('C: what follows a closed script group is a new factor', () => {
    /** [LaTeX, expected per mode]. */
    const ROWS = [
        ['x^{2}3', per('x^2 3', 'x^2*3', 'x^2*3', 'x^2 3', 'x^2 3')],
        ['x^{12}3', per('x^12 3', 'x^12*3', 'x^12*3', 'x^12 3', 'x^12 3')],
        ['2^{3}4', per('2^3 4', '2^3*4', '2^3*4', '2^3 4', '2^3 4')],
        ['x^{n}2', per('x^n 2', 'x^n*2', 'x^n*2', 'x^n 2', 'x^n 2')],
        ['x_{1}2', per('x_1 2', 'x_1*2', 'x_1*2', 'x_1 2', 'x_1 2')],
        ['e^{x}y', per('e^x y', 'e^x*y', 'e^x*y', 'e^x y', 'e^x y')],
        ['x^{n}ab', per('x^n ab', 'x^n*a*b', 'x^n*ab', 'x^n a b', 'x^n ab')],
        ['x_{1}^{2}3', per('x_1^2 3', 'x_1^2*3', 'x_1^2*3', 'x_1^2 3', 'x_1^2 3')],
        // Unchanged: these never merged.
        ['x^{2}y', per('x^2y', 'x^2*y', 'x^2*y', 'x^2 y', 'x^2 y')],
        ['x_{12}y', per('x_12 y', 'x_12*y', 'x_12*y', 'x_12 y', 'x_12 y')],
        ['x_{12}', all('x_12')],
        ['x^{12}', all('x^12')],
        ['x^{n+1}2', per('x^(n+1)2', 'x^(n+1)*2', 'x^(n+1)*2', 'x^(n+1) 2', 'x^(n+1) 2')],
        // A typed space between two numbers is the same kind of boundary.
        ['2\\ 3', per('2 3', '2*3', '2*3', '2 3', '2 3')]
    ];

    describe.each(VARIABLE_MODES)('mode %s', (mode) => {
        test.each(ROWS.map(([latex, expected]) => [latex, expected[mode]]))('%s -> %s', (latex, maxima) => {
            expect(tex2max.convert(latex, {defs, variableMode: mode})).toBe(maxima);
        });

        test.each(ROWS.map(([latex]) => [latex]))('%s is stable over a roundtrip', (latex) => {
            expectStable(latex, mode);
        });

        test('x_{1}2 and x_{12} stay different', () => {
            const options = {defs, variableMode: mode};
            expect(tex2max.convert('x_{1}2', options)).not.toBe(tex2max.convert('x_{12}', options));
        });
    });
});

describe('D: max2tex braces exponents and nests power chains', () => {
    /** [Maxima, LaTeX]. */
    const ROWS = [
        ['x^11', 'x^{11}'],
        ['a^ab', 'a^{ab}'],
        ['x_1^11', 'x_{1}^{11}'],
        ['U_max^Umax', 'U_{max}^{Umax}'],
        ['x^y^z', 'x^{y^{z}}'],
        ['x^(y^z)', 'x^{y^{z}}'],
        ['x^(y^(z^w))', 'x^{y^{z^{w}}}'],
        ['x^a_1', 'x^{a_{1}}'],
        ['x^1.5', 'x^{1.5}'],
        ['x^-1', 'x^{-1}'],
        ['x^f(y)', 'x^{f(y)}'],
        ['x^12*y', 'x^{12}\\cdot y'],
        // A single character at the top level stays as it is.
        ['x^2', 'x^2'],
        ['e^x', 'e^x'],
        ['x^(n+1)', 'x^{n+1}'],
        ['(1)/(x^11)', '\\frac{1}{x^{11}}']
    ];

    test.each(ROWS)('%s -> %s', (maxima, latex) => {
        expect(max2tex.convert(maxima, {defs, variableMode: 'stack'})).toBe(latex);
        expect(max2tex.convert(maxima)).toBe(latex);
    });

    /** [Maxima, Maxima after Maxima -> TeX -> Maxima in stack mode]. */
    const MEANING = [
        ['x^11', 'x^11'],
        ['a^ab', 'a^(ab)'],
        ['x_1^11', 'x_1^11'],
        ['U_max^Umax', 'U_max^(Umax)'],
        ['x^y^z', 'x^(y^z)'],
        ['x^-1', 'x^(-1)'],
        ['x^1.5', 'x^(1.5)']
    ];

    test.each(MEANING)('%s keeps its meaning: %s', (maxima, back) => {
        expect(tex2max.convert(max2tex.convert(maxima, {defs}), {defs, variableMode: 'stack'})).toBe(back);
    });

    describe.each(VARIABLE_MODES)('mode %s', (mode) => {
        test('x^{y^{z^{w}}} comes back as identical LaTeX', () => {
            const latex = 'x^{y^{z^{w}}}';
            const maxima = tex2max.convert(latex, {defs, variableMode: mode});
            expect(maxima).toBe('x^(y^(z^w))');
            expect(max2tex.convert(maxima, {defs, variableMode: mode})).toBe(latex);
        });

        test.each(['x^{y^{z}}', 'x^{y^{z^{w}}}', 'x^{11}', 'x_{1}^{11}', 'e^{-x^{2}}', '2^{2^{n}}'])(
            '%s is stable over a roundtrip', (latex) => {
                expectStable(latex, mode);
            });
    });

    test('every LaTeX group is balanced and no exponent runs into a neighbour', () => {
        ['x^11+1', 'x^y^z+1', 'a^ab*c', 'x^11 y'].forEach((maxima) => {
            const latex = max2tex.convert(maxima, {defs});
            expect(latex).not.toMatch(/\^[A-Za-z0-9]{2}/);
            let level = 0;
            for (const ch of latex) {
                level += ch === '{' ? 1 : ch === '}' ? -1 : 0;
                expect(level).toBeGreaterThanOrEqual(0);
            }
            expect(level).toBe(0);
        });
    });
});

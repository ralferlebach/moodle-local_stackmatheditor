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
 * Issue #96: the identifier, script, set/logic and matrix contracts in every variable mode.
 *
 * Each row names the LaTeX MathQuill hands the converter and the Maxima expected in each of the
 * five modes. Where the modes agree the row says so once; where they differ, the difference is
 * the contract: explicit_single and space_single split every run of letters into single-letter
 * variables (with "*" or a space), explicit_multi and space_multi keep a run as one identifier
 * and mark boundaries to neighbours, stack hands over what was typed and leaves the insert-stars
 * decision to STACK.
 *
 * Every row is also checked over TeX -> Maxima -> TeX -> Maxima in its mode: the pre-fill path
 * after a reload must give back what was stored.
 *
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const {loadAmd, loadDefinitions, VARIABLE_MODES} = require('./amd_loader');

const tex2max = loadAmd('tex2max');
const max2tex = loadAmd('max2tex');
// The norm button only exists once a site names the norm function (see button_contract).
const defs = loadDefinitions({normFunction: 'norm'});

const toMaxima = (latex, mode) => tex2max.convert(latex, {defs, variableMode: mode});
const toTex = (maxima, mode) => max2tex.convert(maxima, {defs, variableMode: mode});

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

/** [label, LaTeX, expected per mode]. */
const ROWS = [
    // Operator names inside identifiers (#58, #60).
    ['operator name inside: Umax', 'U\\max ', per('Umax', 'U*m*a*x', 'Umax', 'U m a x', 'Umax')],
    ['operator name inside: argmax', '\\arg\\max ',
        per('argmax', 'a*r*g*m*a*x', 'argmax', 'a r g m a x', 'argmax')],
    ['operator name inside: sinvalue', '\\sin value',
        per('sinvalue', 's*i*n*v*a*l*u*e', 'sinvalue', 's i n v a l u e', 'sinvalue')],
    ['operator name inside: logvalue', '\\log value',
        per('logvalue', 'l*o*g*v*a*l*u*e', 'logvalue', 'l o g v a l u e', 'logvalue')],
    ['operator name inside: maximum', '\\max imum',
        per('maximum', 'm*a*x*i*m*u*m', 'maximum', 'm a x i m u m', 'maximum')],

    // Function application.
    ['function application: a\\sin(x)', 'a\\sin\\left(x\\right)',
        per('a sin(x)', 'a*sin(x)', 'a*sin(x)', 'a sin(x)', 'a sin(x)')],
    ['function application: max(x,y)', '\\max\\left(x,y\\right)', all('max(x,y)')],
    ['function application: sin(x)cos(x)', '\\sin\\left(x\\right)\\cos\\left(x\\right)',
        per('sin(x)cos(x)', 'sin(x)*cos(x)', 'sin(x)*cos(x)', 'sin(x) cos(x)', 'sin(x) cos(x)')],

    // Multi-character subscripts and what follows a subscript group (#59).
    ['multi-character subscript: U_{max}', 'U_{max}', all('U_max')],
    ['multi-character subscript: x_{12}', 'x_{12}', all('x_12')],
    ['letters after a subscript group: U_{m}ax', 'U_{m}ax',
        per('U_m ax', 'U_m*a*x', 'U_m*ax', 'U_m a x', 'U_m ax')],
    ['letter after a numeric subscript: x_{12}y', 'x_{12}y',
        per('x_12 y', 'x_12*y', 'x_12*y', 'x_12 y', 'x_12 y')],
    ['letter after a letter subscript: x_{ab}c', 'x_{ab}c',
        per('x_ab c', 'x_ab*c', 'x_ab*c', 'x_ab c', 'x_ab c')],

    // Superscript / subscript combinations.
    ['subscript then superscript: x_{1}^{2}', 'x_{1}^{2}', all('x_1^2')],
    ['multi-character subscript then superscript: U_{max}^{2}', 'U_{max}^{2}', all('U_max^2')],
    ['subscript inside a superscript: e^{x_{1}}', 'e^{x_{1}}', all('e^(x_1)')],
    ['superscript on the second letter: xy^{2}', 'xy^{2}',
        per('xy^2', 'x*y^2', 'xy^2', 'x y^2', 'xy^2')],
    ['letter after a superscript group: x^{2}y', 'x^{2}y',
        per('x^2y', 'x^2*y', 'x^2*y', 'x^2 y', 'x^2 y')],
    // What follows a closed script group is a new factor; stack mode separates with a space
    // exactly where the two neighbours would otherwise read as one token.
    ['digit after a superscript group: x^{2}3', 'x^{2}3',
        per('x^2 3', 'x^2*3', 'x^2*3', 'x^2 3', 'x^2 3')],
    ['digit after a letter superscript: x^{n}2', 'x^{n}2',
        per('x^n 2', 'x^n*2', 'x^n*2', 'x^n 2', 'x^n 2')],
    ['digit after a subscript group: x_{1}2', 'x_{1}2',
        per('x_1 2', 'x_1*2', 'x_1*2', 'x_1 2', 'x_1 2')],
    ['letter after a letter superscript: e^{x}y', 'e^{x}y',
        per('e^x y', 'e^x*y', 'e^x*y', 'e^x y', 'e^x y')],
    ['power tower: x^{y^{z^{w}}}', 'x^{y^{z^{w}}}', all('x^(y^(z^w))')],

    // Set / logic nesting (#35).
    ['logic nesting: \\neg(p\\land(q\\lor r))',
        '\\neg\\left(p\\land\\left(q\\lor r\\right)\\right)', all('not (p and (q or r))')],
    ['logic precedence: \\neg p\\lor q', '\\neg p\\lor q', all('not p or q')],
    ['implication of a conjunction', 'p\\Rightarrow\\left(q\\land r\\right)',
        all('p implies (q and r)')],
    ['set nesting: x\\in A\\cup(B\\cap C)', 'x\\in A\\cup\\left(B\\cap C\\right)',
        all('elementp(x,union(A,intersection(B,C)))')],
    ['set nesting: A\\setminus(B\\cup C)', 'A\\setminus\\left(B\\cup C\\right)',
        all('setdifference(A,union(B,C))')],
    ['negated membership of an intersection', 'x\\notin A\\cap B',
        all('not elementp(x,intersection(A,B))')],

    // A transpose of a product of named matrices: the product follows the mode.
    ['transpose of a product: transpose(AB)', '\\operatorname{transpose}\\left(AB\\right)',
        per('transpose(AB)', 'transpose(A*B)', 'transpose(AB)', 'transpose(A B)', 'transpose(AB)')]
];

/**
 * Matrix and vector combinations, [label, LaTeX, expected per mode].
 *
 * The structure names the converter writes (matrix, determinant, transpose, norm) are function
 * names in every mode; only what the student typed into the cells follows the mode.
 */
const MATRIX_ROWS = [
    ['matrix inside det', '\\det\\begin{bmatrix}a&b\\\\c&d\\end{bmatrix}',
        all('determinant(matrix([a,b],[c,d]))')],
    ['matrix inside det with brackets', '\\det\\left(\\begin{bmatrix}a&b\\\\c&d\\end{bmatrix}\\right)',
        all('determinant(matrix([a,b],[c,d]))')],
    ['det of a matrix product',
        '\\det\\left(\\begin{bmatrix}a&b\\\\c&d\\end{bmatrix}\\cdot\\begin{bmatrix}e&f\\\\g&h\\end{bmatrix}\\right)',
        all('determinant(matrix([a,b],[c,d])*matrix([e,f],[g,h]))')],
    ['transpose of a matrix-vector product',
        '\\operatorname{transpose}\\left(\\begin{bmatrix}a&b\\\\c&d\\end{bmatrix}\\cdot\\begin{bmatrix}e\\\\f\\end{bmatrix}\\right)',
        all('transpose(matrix([a,b],[c,d])*matrix([e],[f]))')],
    ['vector inside the norm bars', '\\left\\|\\begin{pmatrix}x\\\\y\\end{pmatrix}\\right\\|',
        all('norm(matrix([x],[y]))')],
    ['vector inside Vmatrix', '\\begin{Vmatrix}\\begin{pmatrix}x\\\\y\\end{pmatrix}\\end{Vmatrix}',
        all('norm(matrix([x],[y]))')],
    ['structures in matrix cells',
        '\\begin{bmatrix}\\sqrt{x}&\\frac{1}{2}\\\\\\left|y\\right|&\\sin\\left(z\\right)\\end{bmatrix}',
        all('matrix([sqrt(x),(1)/(2)],[abs(y),sin(z)])')],
    ['multi-letter cell', '\\begin{bmatrix}ab&c\\end{bmatrix}',
        per('matrix([ab,c])', 'matrix([a*b,c])', 'matrix([ab,c])', 'matrix([a b,c])', 'matrix([ab,c])')],
    ['identity matrix', '\\operatorname{ident}\\left(3\\right)', all('ident(3)')]
];

describe.each(VARIABLE_MODES)('mode matrix: %s', (mode) => {
    test.each(ROWS.map(([label, latex, expected]) => [label, latex, expected[mode]]))(
        '%s',
        (_label, latex, expected) => {
            expect(toMaxima(latex, mode)).toBe(expected);
        }
    );

    test.each(ROWS.map(([label, latex]) => [label, latex]))(
        '%s is stable over TeX -> Maxima -> TeX -> Maxima',
        (_label, latex) => {
            const first = toMaxima(latex, mode);
            expect(toMaxima(toTex(first, mode), mode)).toBe(first);
        }
    );

    test.each(ROWS.map(([label, latex]) => [label, latex]))(
        '%s leaves no backslash and no private-use marker',
        (_label, latex) => {
            const out = toMaxima(latex, mode);
            expect(out).not.toMatch(/\\/);
            expect(out).not.toMatch(/[-]/);
        }
    );
});

describe.each(VARIABLE_MODES)('mode matrix: matrices and vectors, %s', (mode) => {
    test.each(MATRIX_ROWS.map(([label, latex, expected]) => [label, latex, expected[mode]]))(
        '%s',
        (_label, latex, expected) => {
            expect(toMaxima(latex, mode)).toBe(expected);
        }
    );

    test.each(MATRIX_ROWS.map(([label, latex]) => [label, latex]))(
        '%s is stable over TeX -> Maxima -> TeX -> Maxima',
        (_label, latex) => {
            const first = toMaxima(latex, mode);
            expect(toMaxima(toTex(first, mode), mode)).toBe(first);
        }
    );
});

describe('mode matrix: what does not depend on the mode', () => {
    test.each(ROWS.map(([label, latex]) => [label, latex]))(
        '%s: the two single modes and the two multi modes differ only in the separator',
        (_label, latex) => {
            // "*" and " " are the only difference between explicit_* and space_* - except a
            // star the user wrote with \cdot, which neither mode turns into a space.
            const es = toMaxima(latex, 'explicit_single');
            const ss = toMaxima(latex, 'space_single');
            const em = toMaxima(latex, 'explicit_multi');
            const sm = toMaxima(latex, 'space_multi');
            expect(es.replace(/[*\s]/g, '')).toBe(ss.replace(/[*\s]/g, ''));
            expect(em.replace(/[*\s]/g, '')).toBe(sm.replace(/[*\s]/g, ''));
        }
    );

    test.each(ROWS.map(([label, latex]) => [label, latex]))(
        '%s: every mode keeps the same characters apart from separators',
        (_label, latex) => {
            const reference = toMaxima(latex, 'stack').replace(/[*\s]/g, '');
            VARIABLE_MODES.forEach((mode) => {
                expect(toMaxima(latex, mode).replace(/[*\s]/g, '')).toBe(reference);
            });
        }
    );
});

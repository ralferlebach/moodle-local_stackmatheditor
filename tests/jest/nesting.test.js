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
 * Issue #79: recursive structures are not a job for a single regular expression.
 *
 * #78 reported nested square roots. The cause was general: a pattern that allows one level of
 * braces inside an argument does not fail on the second level, it corrupts it -
 * `\sqrt{\sqrt{x}}` reached the CAS as `sqrt(sqrtx)`, which is a different expression that still
 * looks plausible.
 *
 * These tests therefore check depth rather than cases, in both directions, plus the invariants
 * that catch the next structure someone adds with a regex.
 *
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const {loadAmd} = require('./amd_loader');

const tex2max = loadAmd('tex2max');
const max2tex = loadAmd('max2tex');

const DEFS = {defs: {normFunction: 'norm'}};

/**
 * Wrap an expression in a function n times.
 *
 * @param {string} name Function name.
 * @param {number} depth How often.
 * @param {string} inner Innermost expression.
 * @returns {string} Nested Maxima call.
 */
function nest(name, depth, inner) {
    let out = inner;
    for (let i = 0; i < depth; i += 1) {
        out = name + '(' + out + ')';
    }
    return out;
}

/**
 * The same in LaTeX, for commands that take a braced argument.
 *
 * @param {string} command LaTeX command, with the backslash.
 * @param {number} depth How often.
 * @param {string} inner Innermost expression.
 * @returns {string} Nested LaTeX.
 */
function nestLatex(command, depth, inner) {
    let out = inner;
    for (let i = 0; i < depth; i += 1) {
        out = command + '{' + out + '}';
    }
    return out;
}

describe('#78: nested square roots', () => {
    test.each([1, 2, 3, 5])('depth %i survives LaTeX -> Maxima', (depth) => {
        expect(tex2max.convert(nestLatex('\\sqrt', depth, 'x'), DEFS))
            .toBe(nest('sqrt', depth, 'x'));
    });

    test.each([1, 2, 3, 5])('depth %i survives Maxima -> LaTeX', (depth) => {
        expect(max2tex.convert(nest('sqrt', depth, 'x'), DEFS))
            .toBe(nestLatex('\\sqrt', depth, 'x'));
    });

    test('a root with a neighbour keeps both', () => {
        expect(tex2max.convert('\\sqrt{1+\\sqrt{x}}', DEFS)).toBe('sqrt(1+sqrt(x))');
        expect(max2tex.convert('sqrt(1+sqrt(x))', DEFS)).toBe('\\sqrt{1+\\sqrt{x}}');
    });

    test('mixed with another function', () => {
        expect(tex2max.convert('\\sqrt{\\sin\\left(\\sqrt{x}\\right)}', DEFS))
            .toBe('sqrt(sin(sqrt(x)))');
        expect(max2tex.convert('sqrt(sin(sqrt(x)))', DEFS))
            .toBe('\\sqrt{\\sin\\left(\\sqrt{x}\\right)}');
    });
});

describe('the same function nested, for every standard function', () => {
    test.each([
        ['sin', '\\sin'],
        ['cos', '\\cos'],
        ['tan', '\\tan'],
        ['sinh', '\\sinh'],
        ['cosh', '\\cosh'],
        ['tanh', '\\tanh'],
        ['exp', '\\exp']
    ])('%s(%s(x))', (name) => {
        const maxima = nest(name, 2, 'x');
        const latex = max2tex.convert(maxima, DEFS);

        // Invariant B: no raw Maxima call left inside the LaTeX.
        expect(latex).not.toMatch(new RegExp('(^|[^a-zA-Z\\\\])' + name + '\\('));
        expect(tex2max.convert(latex, DEFS)).toBe(maxima);
    });

    test('log becomes ln and comes back as log', () => {
        const latex = max2tex.convert('log(log(x))', DEFS);
        expect(latex).toBe('\\ln\\left(\\ln\\left(x\\right)\\right)');
        expect(tex2max.convert(latex, DEFS)).toBe('log(log(x))');
    });

    test('three different functions in a row', () => {
        expect(tex2max.convert(max2tex.convert('sin(cos(sin(x)))', DEFS), DEFS))
            .toBe('sin(cos(sin(x)))');
    });
});

describe('absolute value and norm', () => {
    test.each([1, 2, 3])('abs at depth %i', (depth) => {
        const maxima = nest('abs', depth, 'x');
        const latex = max2tex.convert(maxima, DEFS);

        expect(latex).not.toContain('abs(');
        // Every opening bar has a closing one.
        expect((latex.match(/\\left\|/g) || []).length).toBe(depth);
        expect((latex.match(/\\right\|/g) || []).length).toBe(depth);
        expect(tex2max.convert(latex, DEFS)).toBe(maxima);
    });

    test('abs with a neighbour', () => {
        expect(tex2max.convert('\\left|1+\\left|x\\right|\\right|', DEFS))
            .toBe('abs(1+abs(x))');
    });

    test('abs around another function', () => {
        expect(tex2max.convert(max2tex.convert('abs(sin(abs(x)))', DEFS), DEFS))
            .toBe('abs(sin(abs(x)))');
    });

    test('bars without \\left are still a single absolute value', () => {
        // Typed or imported content: two identical delimiters cannot be nested unambiguously,
        // and this stays the simple rule it always was.
        expect(tex2max.convert('|x|', DEFS)).toBe('abs(x)');
        expect(tex2max.convert('|a|+|b|', DEFS)).toBe('abs(a)+abs(b)');
    });

    test('a nested norm keeps both levels', () => {
        expect(tex2max.convert('\\left\\|\\left\\|v\\right\\|\\right\\|', DEFS))
            .toBe('norm(norm(v))');
    });
});

describe('binomial coefficients', () => {
    test.each([
        ['binomial(n,k)', '\\binom{n}{k}'],
        ['binomial(n+1,k)', '\\binom{n+1}{k}'],
        ['binomial(f(x),k)', '\\binom{f(x)}{k}'],
        ['binomial(n,k+g(x))', '\\binom{n}{k+g(x)}'],
        ['binomial(binomial(n,k),r)', '\\binom{\\binom{n}{k}}{r}'],
        ['binomial(n,binomial(k,r))', '\\binom{n}{\\binom{k}{r}}']
    ])('%s <-> %s', (maxima, latex) => {
        expect(max2tex.convert(maxima, DEFS)).toBe(latex);
        expect(tex2max.convert(latex, DEFS)).toBe(maxima);
    });
});

describe('roots, fractions and powers mixed', () => {
    test.each([
        ['\\frac{\\sqrt{x}}{\\sqrt{y}}', '(sqrt(x))/(sqrt(y))'],
        ['\\sqrt{\\frac{\\sqrt{x}}{\\sqrt{y}}}', 'sqrt((sqrt(x))/(sqrt(y)))'],
        ['\\frac{\\frac{1}{x}}{\\frac{1}{y}}', '((1)/(x))/((1)/(y))'],
        ['\\sqrt{\\frac{1}{1+\\sqrt{x}}}', 'sqrt((1)/(1+sqrt(x)))'],
        ['x^{y^{z}}', 'x^(y^z)'],
        ['x^{\\sqrt{y}}', 'x^(sqrt(y))']
    ])('%s becomes %s', (latex, maxima) => {
        expect(tex2max.convert(latex, DEFS)).toBe(maxima);
    });

    test('nth roots nest', () => {
        expect(tex2max.convert('\\sqrt[3]{\\sqrt{x}}', DEFS)).toBe('(sqrt(x))^(1/(3))');
        expect(tex2max.convert('\\sqrt[3]{\\sqrt[5]{x}}', DEFS)).toBe('((x)^(1/(5)))^(1/(3))');
    });
});

describe('decorations with structured arguments', () => {
    test.each([
        ['\\vec{v_{1}}', 'v_1'],
        ['\\overline{A_{1}}', 'A_1'],
        ['\\mathrm{d}_{1}', 'd_1'],
        ['\\operatorname{foo}_{1}', 'foo_1']
    ])('%s becomes %s', (latex, maxima) => {
        expect(tex2max.convert(latex, DEFS)).toBe(maxima);
    });
});

describe('invariants', () => {
    const corpus = [
        'sqrt(x)', 'sqrt(sqrt(x))', 'sqrt(sqrt(sqrt(x)))', 'sqrt(1+sqrt(x))',
        'sin(sin(x))', 'cos(cos(x))', 'log(log(x))', 'exp(exp(x))', 'sin(cos(sin(x)))',
        'abs(abs(x))', 'abs(1+abs(x))', 'abs(sin(abs(x)))',
        'binomial(n,k)', 'binomial(f(x),k)', 'binomial(binomial(n,k),r)',
        'x^(y^z)', 'x^(sqrt(y))', 'sqrt(x)^sqrt(y)',
        '(1/x)/(1/y)', 'sqrt((sqrt(x))/(sqrt(y)))', 'sqrt(sin(sqrt(x)))'
    ];

    test.each(corpus)('A: %s produces no stray LaTeX in the CAS string', (maxima) => {
        const result = tex2max.analyse(max2tex.convert(maxima, DEFS), DEFS);

        expect(result.problems).toEqual([]);
        expect(result.maxima).not.toMatch(/\\/);
        expect(result.maxima).not.toMatch(/[{}]/);
    });

    test.each(corpus)('B: %s leaves no raw function call in the LaTeX', (maxima) => {
        const latex = max2tex.convert(maxima, DEFS);

        ['sqrt', 'sin', 'cos', 'tan', 'log', 'exp', 'abs', 'binomial'].forEach((name) => {
            expect(latex).not.toMatch(new RegExp('(^|[^a-zA-Z\\\\])' + name + '\\('));
        });
    });

    test.each(corpus)('C: %s is stable across a roundtrip', (maxima) => {
        const first = tex2max.convert(max2tex.convert(maxima, DEFS), DEFS);
        const second = tex2max.convert(max2tex.convert(first, DEFS), DEFS);

        expect(second).toBe(first);
    });

    test.each([1, 2, 3, 5])('D: depth %i for every recursive structure', (depth) => {
        [['sqrt', '\\sqrt'], ['abs', null]].forEach(([name]) => {
            const maxima = nest(name, depth, 'x');
            expect(tex2max.convert(max2tex.convert(maxima, DEFS), DEFS)).toBe(maxima);
        });
    });
});

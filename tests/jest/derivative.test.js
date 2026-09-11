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
 * Issue #46: derivatives are structured objects serialised as diff(expr, x[, n], …).
 *
 * Decisions (Ralf, issue comment): three templates (first, n-th, mixed); obligatory bracketed
 * operand, no implicit scope rule; the way back always uses ∂ (diff(…) does not record d vs. ∂);
 * 'diff and noundiff are read, never written; diff(expr) (total differential) is out of scope.
 *
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const {loadAmd, loadDefinitions, VARIABLE_MODES} = require('./amd_loader');

const tex2max = loadAmd('tex2max');
const max2tex = loadAmd('max2tex');
const defs = loadDefinitions();

const analyse = (latex, mode = 'explicit_single') => tex2max.analyse(latex, {defs, variableMode: mode});
const toMaxima = (latex, mode = 'explicit_single') => tex2max.convert(latex, {defs, variableMode: mode});
const toTex = (maxima, mode = 'explicit_single') => max2tex.convert(maxima, {defs, variableMode: mode});

describe('TeX -> Maxima', () => {
    test.each([
        ['\\frac{\\partial}{\\partial x}\\left(x^2y\\right)', 'diff(x^2*y,x)'],
        ['\\frac{\\partial^{4}}{\\partial x^{4}}\\left(f\\right)', 'diff(f,x,4)'],
        ['\\frac{\\partial^{3}}{\\partial x^{2}\\partial y}\\left(f\\right)', 'diff(f,x,2,y,1)'],
        ['\\frac{\\partial^2}{\\partial x\\partial y}\\left(f\\right)', 'diff(f,x,1,y,1)'],
        ['\\frac{d}{dx}\\left(x^2+1\\right)', 'diff(x^2+1,x)'],
        ['\\frac{\\mathrm{d}^{2}}{\\mathrm{d}t^{2}}\\left(s\\right)', 'diff(s,t,2)'],
        ['2\\frac{\\partial}{\\partial x}\\left(\\sin\\left(x\\right)\\right)+1', '2*diff(sin(x),x)+1'],
        ['\\frac{\\partial}{\\partial \\theta}\\left(r\\theta\\right)', 'diff(r*theta,theta)'],
    ])('%s -> %s', (latex, expected) => {
        expect(toMaxima(latex)).toBe(expected);
    });

    test('ordinary fractions are untouched', () => {
        expect(toMaxima('\\frac{1}{2}')).toBe('(1)/(2)');
        expect(toMaxima('\\frac{d}{x}')).toBe('(d)/(x)');
    });
});

describe('incomplete or ambiguous derivatives are an editor state', () => {
    test.each([
        ['\\frac{\\partial}{\\partial x}x^2', 'derivative_operand_missing'],
        ['\\frac{\\partial}{\\partial x}\\left(\\right)', 'derivative_operand_missing'],
        ['\\frac{\\partial^{3}}{\\partial x^{4}}\\left(f\\right)', 'derivative_order_mismatch'],
        ['\\frac{\\partial^{2}}{\\partial x^{2}\\partial y}\\left(f\\right)', 'derivative_order_mismatch'],
    ])('%s: %s', (latex, problem) => {
        VARIABLE_MODES.forEach((mode) => {
            const result = analyse(latex, mode);
            expect(result.problems).toContain(problem);
            expect(result.maxima).toBe('');
        });
    });
});

describe('STACK -> SME -> STACK', () => {
    const CASES = [
        ['diff(f,x)', 'diff(f,x)'],
        ['diff(f,x,1)', 'diff(f,x)'],
        ['diff(f,x,2)', 'diff(f,x,2)'],
        ['diff(f,x,5)', 'diff(f,x,5)'],
        ['diff(f,x,1,y,1)', 'diff(f,x,1,y,1)'],
        ['diff(f,x,2,y,1)', 'diff(f,x,2,y,1)'],
        ['diff(f,x,2,y,3)', 'diff(f,x,2,y,3)'],
        ['diff(f,x,2,y,1,z,4)', 'diff(f,x,2,y,1,z,4)'],
        ["'diff(f,x)", 'diff(f,x)'],
        ["'diff(f,x,3)", 'diff(f,x,3)'],
        ["'diff(f,x,2,y,1)", 'diff(f,x,2,y,1)'],
        ['noundiff(x^2*sin(x),x)', 'diff(x^2*sin(x),x)'],
        ['diff(sqrt(x),x)', 'diff(sqrt(x),x)'],
    ];

    test.each(CASES)('%s -> ∂ template -> %s (variables and orders kept)', (maxima, expected) => {
        const tex = toTex(maxima, 'explicit_multi');
        expect(tex).toMatch(/^\\frac\{\\partial/);
        expect(tex).not.toMatch(/\\frac\{d/);
        expect(toMaxima(tex, 'explicit_multi')).toBe(expected);
    });

    test.each(VARIABLE_MODES)('roundtrip is stable (mode %s)', (mode) => {
        CASES.forEach(([maxima]) => {
            const first = toMaxima(toTex(maxima, mode), mode);
            expect(toMaxima(toTex(first, mode), mode)).toBe(first);
        });
    });

    test.each([
        ['diff(f,x,2,y,1)', '\\frac{\\partial^{3}}{\\partial x^{2}\\partial y}\\left(f\\right)'],
        ['diff(f,x)', '\\frac{\\partial}{\\partial x}\\left(f\\right)'],
    ])('%s -> %s (total order computed)', (maxima, expected) => {
        expect(toTex(maxima)).toBe(expected);
    });

    test('the total differential diff(expr) is not a derivative operator', () => {
        expect(toTex('diff(f)')).toBe('diff(f)');
    });
});

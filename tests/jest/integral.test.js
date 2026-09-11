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
 * Issue #44: integrals are structured objects - integrand + atomic variable + optional limits.
 *
 * Decisions (Ralf, issue comment): direct MathQuill template; an incomplete integral is an
 * editor state and never becomes "integrate(expr)"; integrate(…), int(…), 'int(…),
 * 'integrate(…) are read back; only atomic integration variables in V1.
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
        ['\\int x^2\\,\\mathrm{d}x', 'integrate(x^2,x)'],
        ['\\int_{0}^{1}x^2\\,\\mathrm{d}x', 'integrate(x^2,x,0,1)'],
        ['\\int_0^1 x^2 dx', 'integrate(x^2,x,0,1)'],
        ['\\int_{0}^{\\pi}\\sin\\left(x\\right)\\mathrm{d}x', 'integrate(sin(x),x,0,pi)'],
        ['\\int_{ }^{ }\\left(x^2+1\\right)\\mathrm{d}x', 'integrate(x^2+1,x)'],
        ['\\int\\sqrt{x}\\,dx', 'integrate(sqrt(x),x)'],
        ['\\int t\\,\\mathrm{d}t', 'integrate(t,t)'],
        ['\\int \\theta\\,\\mathrm{d}\\theta', 'integrate(theta,theta)'],
        ['2\\int x\\,\\mathrm{d}x+1', '2*integrate(x,x)+1'],
        ['\\int_0^1\\int_0^2 xy\\,\\mathrm{d}y\\,\\mathrm{d}x', 'integrate(integrate(x*y,y,0,2),x,0,1)'],
    ])('%s -> %s', (latex, expected) => {
        expect(toMaxima(latex)).toBe(expected);
    });

    test.each(VARIABLE_MODES)('no LaTeX command and no fused identifier remain (mode %s)', (mode) => {
        const out = toMaxima('x\\int_{a}^{b}\\left(x^2+1\\right)\\mathrm{d}x', mode);
        expect(out).toContain('integrate(x^2+1,x,a,b)');
        expect(out).not.toMatch(/\\|xintegrate|\bint\b/);
    });
});

describe('incomplete integrals are an editor state, never invented CAS syntax', () => {
    test.each([
        ['\\int x^2', 'integral_variable_missing'],
        ['\\int_{0}^{ }x\\,\\mathrm{d}x', 'integral_limit_missing'],
        ['\\int\\mathrm{d}x', 'integral_integrand_missing'],
        ['\\int g\\left(f\\left(x\\right)\\right)\\mathrm{d}f\\left(x\\right)', 'integral_variable_composite'],
    ])('%s: %s', (latex, problem) => {
        VARIABLE_MODES.forEach((mode) => {
            const result = analyse(latex, mode);
            expect(result.problems).toContain(problem);
            expect(result.maxima).toBe('');
            expect(toMaxima(latex, mode)).not.toMatch(/integrate\([^,]*\)$/);
        });
    });
});

describe('Maxima -> TeX and roundtrip', () => {
    const CASES = [
        'integrate(x,x)', 'integrate(x^2,x)', 'integrate(sin(x),x)', 'integrate(sqrt(x),x)',
        'integrate(x^2,x,0,1)', 'integrate(sin(x),x,0,%pi)', 'integrate(exp(-x^2),x,minf,inf)',
        "'int(x^2,x)", "'int(x^2,x,0,1)", "'integrate(x^2,x)", "'integrate(x^2,x,0,1)", 'nounint(x^2+1,x)',
    ];

    test.each(CASES)('%s is rendered as an integral and read back', (maxima) => {
        const tex = toTex(maxima);
        expect(tex).toMatch(/^\\int/);
        expect(tex).toContain('\\mathrm{d}x');
        expect(toMaxima(tex)).toMatch(/^integrate\(/);
    });

    test.each(VARIABLE_MODES)('Maxima -> TeX -> Maxima -> TeX -> Maxima is stable (mode %s)', (mode) => {
        CASES.forEach((maxima) => {
            const first = toMaxima(toTex(maxima, mode), mode);
            expect(toMaxima(toTex(first, mode), mode)).toBe(first);
        });
    });

    test.each([
        ['integrate(x^2,x,0,1)', '\\int_{0}^{1} x^2\\mathrm{d}x'],
        ['integrate(x^2+1,x)', '\\int \\left(x^2+1\\right)\\mathrm{d}x'],
    ])('%s -> %s', (maxima, expected) => {
        expect(toTex(maxima)).toBe(expected);
    });

    test('the rendered LaTeX contains no \\, (MathQuill cannot parse it)', () => {
        expect(toTex('integrate(x^2,x,0,1)')).not.toContain('\\,');
    });

    test('other arities are not treated as integrals', () => {
        expect(toTex('int(x)')).not.toContain('\\int');
    });
});

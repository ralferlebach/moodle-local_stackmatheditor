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
 * Identifier integrity: operator names and multi-character subscripts.
 *
 * The invariant behind all three issues: the graphical representation must not create or
 * remove identifier boundaries the user did not type.
 *
 * #58 / #60 — MathQuill un-italicises an operator name wherever it finds one inside a run of
 * letters, so typing "Umax" yields the LaTeX "U\max ". Before the fix the converter turned
 * that into "U max", which STACK read as a product.
 *
 * #59 — "U_{max}" (one identifier) and "U_{m}ax" (U_m followed by ax) must never collapse onto
 * the same CAS string, and max2tex has to group the whole subscript, not just its first
 * character.
 *
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const {loadAmd} = require('./amd_loader');

const tex2max = loadAmd('tex2max');
const max2tex = loadAmd('max2tex');

const MODES = [
    'stack',
    'explicit_single',
    'explicit_multi',
    'space_single',
    'space_multi'
];

describe('tex2max: operator names inside identifiers (#58, #60)', () => {
    test.each([
        ['U\\max ', 'Umax'],
        ['U\\min ', 'Umin'],
        ['I\\max ', 'Imax'],
        ['T\\max ', 'Tmax'],
        ['\\max imum', 'maximum'],
        ['\\arg\\max ', 'argmax'],
        ['\\log value', 'logvalue'],
        ['\\sin value', 'sinvalue'],
        ['U\\operatorname{span}', 'Uspan']
    ])('%s becomes one identifier', (latex, expected) => {
        expect(tex2max.convert(latex)).toBe(expected);
    });

    test('in stack mode no identifier boundary is added', () => {
        // The mode contract of "leave untouched": the editor hands STACK what was typed and
        // lets STACK's own insert-stars configuration decide.
        expect(tex2max.convert('U\\max ', {variableMode: 'stack'})).toBe('Umax');
        expect(tex2max.convert('U\\max ', {variableMode: 'stack'})).not.toContain(' ');
    });

    test('an operator name applied to an argument stays a function', () => {
        expect(tex2max.convert('\\max\\left(a,b\\right)')).toBe('max(a,b)');
        expect(tex2max.convert('a\\sin\\left(x\\right)')).toContain('sin(x)');
        expect(tex2max.convert('a\\sin\\left(x\\right)')).not.toContain('asin');
        expect(tex2max.convert('\\sin ')).toBe('sin');
    });

    test('a control word that is not an operator name is untouched', () => {
        // #39: a\sqrt{b} must not fuse into the identifier "asqrt".
        expect(tex2max.convert('a\\sqrt{b}')).toContain('sqrt(b)');
        expect(tex2max.convert('a\\sqrt{b}')).not.toContain('asqrt');
    });

    test.each(MODES)('the merge happens before the variable logic (%s)', (mode) => {
        // Whatever the mode does with "Umax" afterwards, it must start from one identifier,
        // never from the two tokens "U" and "max".
        expect(tex2max.convert('U\\max ', {variableMode: mode})).not.toContain('U max');
    });
});

describe('tex2max: multi-character subscripts (#59)', () => {
    test.each([
        ['U_{max}', 'U_max'],
        ['U_{min}', 'U_min'],
        ['U_{eff}', 'U_eff'],
        ['U_{rms}', 'U_rms'],
        ['x_{12}', 'x_12'],
        ['T_{amb}', 'T_amb']
    ])('%s is one identifier', (latex, expected) => {
        expect(tex2max.convert(latex)).toBe(expected);
    });

    test.each(MODES)('a subscript group is atomic in %s', (mode) => {
        expect(tex2max.convert('U_{max}', {variableMode: mode})).toBe('U_max');
    });

    test.each([
        ['U_{m}ax'],
        ['U_{m}in'],
        ['U_{e}ff']
    ])('%s never collapses into the grouped form', (latex) => {
        for (const mode of MODES) {
            const result = tex2max.convert(latex, {variableMode: mode});
            expect(result).not.toBe(latex.replace(/_\{([^{}]*)\}/, '_$1'));
            expect(result).toMatch(/^U_[a-z][^a-z]/);
        }
    });

    test('the boundary after a subscript group follows the mode', () => {
        expect(tex2max.convert('U_{m}ax', {variableMode: 'stack'})).toBe('U_m ax');
        expect(tex2max.convert('U_{m}ax', {variableMode: 'explicit_single'}))
            .toBe('U_m*a*x');
        expect(tex2max.convert('U_{m}ax', {variableMode: 'explicit_multi'}))
            .toBe('U_m*ax');
        expect(tex2max.convert('U_{m}ax', {variableMode: 'space_single'}))
            .toBe('U_m a x');
        expect(tex2max.convert('U_{m}ax', {variableMode: 'space_multi'}))
            .toBe('U_m ax');
    });
});

describe('max2tex: multi-character subscripts (#59)', () => {
    test.each([
        ['U_max', 'U_{max}'],
        ['U_min', 'U_{min}'],
        ['U_eff', 'U_{eff}'],
        ['U_rms', 'U_{rms}'],
        ['U_nom', 'U_{nom}'],
        ['I_max', 'I_{max}'],
        ['T_amb', 'T_{amb}'],
        ['x_1', 'x_{1}'],
        ['x_12', 'x_{12}'],
        ['x_123', 'x_{123}']
    ])('%s is drawn as %s', (maxima, latex) => {
        expect(max2tex.convert(maxima)).toBe(latex);
    });

    test('subscripts in a larger expression', () => {
        expect(max2tex.convert('a_1+b_2')).toBe('a_{1}+b_{2}');
    });
});

describe('roundtrip (#59)', () => {
    test.each([
        'U_max',
        'U_min',
        'U_eff',
        'U_rms',
        'x_12',
        'T_amb'
    ])('%s survives Maxima -> LaTeX -> Maxima', (maxima) => {
        expect(tex2max.convert(max2tex.convert(maxima))).toBe(maxima);
    });
});

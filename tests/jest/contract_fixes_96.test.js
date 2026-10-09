/**
 * @jest-environment jsdom
 */
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
 * Issue #96: the contract defects that were fixed instead of pinned, in every variable mode.
 *
 * E. The percent sign is a hundredth (50\% -> 50/100); STACK has no % operator. A typed Maxima
 *    constant (\%pi) keeps its percent sign.
 * F. The norm button writes \left\lVert ... \right\rVert, the only double bar MathQuill parses;
 *    tex2max reads it like \left\| ... \right\|.
 * G. MathQuill keeps \operatorname{rot} only as the letters "rot": the label applied to a
 *    bracket becomes the configured CAS name, and stays as typed without one.
 * H. A mixed number needs a whole number in front of the fraction: the digits of an exponent,
 *    a subscript, a decimal or an identifier are not one (x^2\frac{1}{2} is not x^(2+1/2)).
 * I. The approximately-equal sign is no longer offered: Maxima has no such operator.
 *
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const fs = require('fs');
const path = require('path');
const {loadAmd, loadDefinitions, VARIABLE_MODES} = require('./amd_loader');

const tex2max = loadAmd('tex2max');
const max2tex = loadAmd('max2tex');
const buttons = require('./fixtures/buttons.json');

const DIFFOPS = {gradient: 'grad', divergence: 'div', curl: 'curl', laplacian: 'laplacian'};
const CONFIGURED = loadDefinitions({normFunction: 'norm', diffOps: DIFFOPS});
const PLAIN = loadDefinitions();

/**
 * Convert in one mode and collect the problems.
 *
 * @param {string} latex LaTeX.
 * @param {string} mode Variable mode.
 * @param {Object} defs Definitions.
 * @returns {{maxima: string, problems: Array}} Result.
 */
function run(latex, mode, defs) {
    return tex2max.analyse(latex, {defs: defs, variableMode: mode});
}

let MQ;

beforeAll(() => {
    const file = path.resolve(__dirname, '..', '..', 'thirdparty', 'mathquill', 'mathquill.js');
    // eslint-disable-next-line no-new-func
    new Function('window', 'document', fs.readFileSync(file, 'utf8')).call(window, window, document);
    MQ = window.MathQuill.getInterface(3);
});

/**
 * A field configured as input_fields.js configures it.
 *
 * @returns {Object} MathQuill field.
 */
function field() {
    const span = document.createElement('span');
    document.body.appendChild(span);
    return MQ.MathField(span, {
        spaceBehavesLikeTab: false,
        disableAutoSubstitutionInSubscripts: true,
        autoOperatorNamesOnlyWholeWord: true
    });
}

describe.each(VARIABLE_MODES)('mode %s', (mode) => {
    test('E: 50\\% is fifty hundredths', () => {
        expect(run('50\\%', mode, PLAIN).maxima).toBe('50/100');
        expect(run('50\\%', mode, PLAIN).maxima).not.toMatch(/%/);
    });

    test('E: a typed Maxima constant keeps its percent sign', () => {
        expect(run('\\%pi', mode, PLAIN).maxima).toBe('%pi');
        expect(run('\\%e', mode, PLAIN).maxima).toBe('%e');
    });

    test('F: both double-bar spellings are the configured norm', () => {
        expect(run('\\left\\lVert v\\right\\rVert ', mode, CONFIGURED).maxima).toBe('norm(v)');
        expect(run('\\left\\|v\\right\\|', mode, CONFIGURED).maxima).toBe('norm(v)');
        expect(run('\\lVert v\\rVert', mode, CONFIGURED).maxima).toBe('norm(v)');
    });

    test('F: without a norm function the double bar is no control word in the CAS string', () => {
        const result = run('\\left\\lVert v\\right\\rVert ', mode, PLAIN).maxima;
        expect(result).not.toMatch(/lVert|rVert|\\/);
    });

    test('G: the letters "rot" applied to a bracket are the configured curl', () => {
        expect(run('rot\\left(F\\right)', mode, CONFIGURED).maxima).toBe('curl(F)');
        expect(run('\\operatorname{rot}\\left(F\\right)', mode, CONFIGURED).maxima).toBe('curl(F)');
    });

    test('G: without a configured curl, "rot" is not turned into anything', () => {
        expect(run('rot\\left(F\\right)', mode, PLAIN).maxima).not.toMatch(/curl/);
    });

    test('G: "rot" inside a longer name is not the operator', () => {
        expect(run('grot\\left(F\\right)', mode, CONFIGURED).maxima).not.toMatch(/curl/);
    });

    test('H: a whole number in front of a fraction is still a mixed number', () => {
        expect(run('2\\frac{1}{2}', mode, PLAIN).maxima).toBe('(2+1/2)');
    });

    test('H: an exponent, a decimal or an identifier is not the integer part', () => {
        ['x^2\\frac{1}{2}', '1.5\\frac{1}{2}', 'x_2\\frac{1}{2}'].forEach((latex) => {
            expect(run(latex, mode, PLAIN).maxima).not.toMatch(/\+1\/2/);
        });
    });
});

describe('through MathQuill', () => {
    test('F: the norm button writes a norm the field keeps', () => {
        const norm = buttons.find((button) => /lVert/.test(button.template));
        expect(norm).toBeDefined();
        const f = field();
        f.write(norm.template);
        for (let i = 0; i < norm.left; i++) {
            f.keystroke('Left');
        }
        f.typedText('v');
        expect(tex2max.convert(f.latex(), {defs: CONFIGURED, variableMode: 'stack'})).toBe('norm(v)');
    });

    test('F: no button writes the \\left\\| form MathQuill drops', () => {
        expect(buttons.filter((button) => button.template.indexOf('\\left\\|') !== -1)).toEqual([]);
    });

    test('G: curl(F) survives max2tex, the field and tex2max', () => {
        const options = {defs: CONFIGURED, variableMode: 'stack'};
        const f = field();
        f.latex(max2tex.convert('curl(F)', options));
        expect(tex2max.convert(f.latex(), options)).toBe('curl(F)');
    });

    test('E: 50% typed into the field reaches the CAS as 50/100', () => {
        const f = field();
        f.typedText('50%');
        expect(tex2max.convert(f.latex(), {defs: PLAIN, variableMode: 'stack'})).toBe('50/100');
    });
});

describe('I: the toolbar', () => {
    test('offers no approximately-equal sign', () => {
        expect(buttons.filter((button) => button.template.indexOf('\\approx') !== -1)).toEqual([]);
    });
});

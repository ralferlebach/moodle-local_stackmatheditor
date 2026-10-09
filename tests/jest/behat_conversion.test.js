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
 * Issue #96: the pure conversion contracts of tests/behat/tex2max_conversion.feature in Jest.
 *
 * Every scenario (and every Examples row) of the feature that is a conversion contract appears
 * here with the same input and the same assertion, named after the Behat scenario, so the slow
 * browser suite can shrink to what really needs a browser.
 *
 * Two kinds of Behat steps map here:
 *
 * - "When I enter latex X into the MathQuill field" + "Then the underlying STACK input should
 *   be / contain Y": the browser path MathQuill write() -> tex2max -> hidden input. The Behat quiz
 *   input runs in 'stack' mode (STACK decides about insert stars) with the server definitions,
 *   so X is converted directly with tex2max in 'stack' mode and loadDefinitions(). Whether
 *   MathQuill hands tex2max exactly X is the browser half of the contract and stays in
 *   Playwright.
 * - "When the tex2max output for latex X in variableMode M is evaluated": the Behat step calls
 *   convert(X, {variableMode: M}) without definitions; that maps 1:1.
 *
 * Not here (browser only): typing on the keyboard ("I press the keys"), values written into the
 * STACK input by an external script, and anything that depends on a reload.
 *
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const {loadAmd, loadDefinitions} = require('./amd_loader');

const tex2max = loadAmd('tex2max');
const defs = loadDefinitions();

/**
 * What the hidden STACK input receives for LaTeX entered into the field (Behat quiz: stack mode).
 *
 * @param {string} latex LaTeX as written into MathQuill.
 * @param {Object} [definitions] Definitions (default: the production export).
 * @returns {string} Maxima.
 */
const stackInput = (latex, definitions = defs) => tex2max.convert(latex, {defs: definitions, variableMode: 'stack'});

/**
 * What the Behat step "the tex2max output for latex X in variableMode M is evaluated" computes.
 *
 * @param {string} latex LaTeX.
 * @param {string} mode Variable mode.
 * @returns {string} Maxima.
 */
const evaluated = (latex, mode) => tex2max.convert(latex, {variableMode: mode});

describe('Behat: Operator keyword protection (#27)', () => {
    test('"or" is not split into o*r in explicit_single mode', () => {
        const latex = 'x=3 or x=6';
        expect(stackInput(latex)).toContain('or');
        expect(stackInput(latex)).not.toContain('o*r');
        // The scenario names explicit_single; the protection has to hold there as well.
        const single = tex2max.convert(latex, {defs, variableMode: 'explicit_single'});
        expect(single).toContain('or');
        expect(single).not.toContain('o*r');
    });

    test('"and" is not split into a*n*d in explicit_single mode', () => {
        const latex = 'x>0 and x<5';
        expect(stackInput(latex)).toContain('and');
        expect(stackInput(latex)).not.toContain('a*n*d');
        const single = tex2max.convert(latex, {defs, variableMode: 'explicit_single'});
        expect(single).toContain('and');
        expect(single).not.toContain('a*n*d');
    });

    test('"not" is not split into n*o*t in explicit_single mode', () => {
        const latex = '\\neg (x=0)';
        expect(stackInput(latex)).not.toContain('n*o*t');
        expect(stackInput(latex)).not.toContain('#g');
        const single = tex2max.convert(latex, {defs, variableMode: 'explicit_single'});
        expect(single).not.toContain('n*o*t');
        expect(single).not.toContain('#g');
    });
});

describe('Behat: Mixed-fraction fix (#29)', () => {
    test('Mixed fraction 2+1/2 is grouped correctly', () => {
        expect(stackInput('2\\frac{1}{2}')).toBe('(2+1/2)');
    });

    test('Multi-digit mixed fraction 21+3/4 is grouped correctly', () => {
        expect(stackInput('21\\frac{3}{4}')).toBe('(21+3/4)');
    });

    test('Regular fraction is not affected by mixed-fraction fix', () => {
        expect(stackInput('\\frac{1}{2}')).toBe('(1)/(2)');
    });
});

describe('Behat: Pi notation (#31)', () => {
    test('Pi is rendered as plain "pi" by default (usePercentPi off)', () => {
        expect(stackInput('\\pi')).toBe('pi');
    });

    test('Pi is rendered as "%pi" when usePercentPi is enabled', () => {
        expect(stackInput('\\pi', loadDefinitions({usePercentPi: true}))).toBe('%pi');
    });
});

describe('Behat: pm / ± expansion (#30)', () => {
    test('Prefix pm produces two nounor alternatives with unary plus stripped', () => {
        expect(stackInput('x=\\pm 2')).toBe('(x=2) nounor (x=-2)');
        expect(stackInput('x=\\pm 2')).not.toContain('x=+2');
    });

    test('Infix pm retains both plus and minus signs', () => {
        expect(stackInput('a\\pm b')).toBe('(a+b) nounor (a-b)');
    });

    test('Coupled pm and mp give exactly two alternatives', () => {
        expect(stackInput('x=a\\pm b\\mp c')).toBe('(x=a+b-c) nounor (x=a-b+c)');
    });

    test('Minus-plus is the mirror image of plus-minus, without a unary plus (#49)', () => {
        expect(stackInput('x=\\mp 2')).toBe('(x=-2) nounor (x=2)');
        expect(stackInput('x=\\mp 2')).not.toContain('+');
    });

    test('A unary pm inside parentheses keeps the parentheses', () => {
        const out = stackInput('x=a\\left(\\pm b+c\\right)');
        expect(out).toContain('(b+c)');
        expect(out).toContain('(-b+c)');
        expect(out).toContain('nounor');
    });
});

describe('Behat: Square root (#39)', () => {
    test('A square root next to plus/minus stays an atomic sqrt call', () => {
        const out = stackInput('x=-\\frac{p}{2}\\pm\\sqrt{\\frac{p^2}{4-q}}');
        expect(out).toContain('sqrt((p^2)/(4-q))');
        expect(out).not.toContain('s*q*r*t');
        expect(out).not.toContain('\\pm');
    });

    test.each([
        ['explicit_single'],
        ['space_single'],
        ['stack']
    ])('The shipped tex2max never splits sqrt, whatever the variable mode (mode=%s)', (mode) => {
        const out = evaluated('a\\sqrt{b}', mode);
        expect(out).toContain('sqrt(b)');
        expect(out).not.toContain('asqrt');
    });
});

describe('Behat: Set theory and logic: STACK-valid forms (#35)', () => {
    test('Set membership becomes the STACK predicate elementp', () => {
        expect(stackInput('x\\notin A')).toBe('not elementp(x,A)');
    });

    test('Set union becomes the STACK function union', () => {
        expect(stackInput('x\\in A\\cup B')).toBe('elementp(x,union(A,B))');
    });

    test('A proper subset keeps its strictness', () => {
        expect(stackInput('A\\subset B')).toBe('(subsetp(A,B) and A#B)');
    });

    test('Logic buttons write and/or, not the structural noun operators', () => {
        expect(stackInput('p\\land q\\lor r')).toBe('p and q or r');
    });

    test('Implied-by is rewritten as a swapped implication', () => {
        expect(stackInput('p\\Leftarrow q')).toBe('q implies p');
    });
});

describe('Behat: Identifiers containing an operator name (#58, #60)', () => {
    test.each([
        ['U\\max', 'Umax'],
        ['U\\min', 'Umin'],
        ['\\max imum', 'maximum'],
        ['\\arg\\max', 'argmax'],
        ['\\log value', 'logvalue'],
        ['\\sin value', 'sinvalue']
    ])('An operator name inside a longer identifier stays part of it (latex=%s, expected=%s)',
        (latex, expected) => {
            expect(evaluated(latex, 'stack')).toBe(expected);
        });

    test('An operator name applied to an argument is still a function', () => {
        const out = evaluated('a\\sin\\left(x\\right)', 'stack');
        expect(out).toContain('sin(x)');
        expect(out).not.toContain('asin');
    });
});

describe('Behat: Multi-character subscripts (#59)', () => {
    test.each([
        ['U_{max}', 'U_max'],
        ['U_{eff}', 'U_eff'],
        ['x_{12}', 'x_12']
    ])('A multi-character subscript is one identifier (latex=%s, expected=%s)', (latex, expected) => {
        expect(evaluated(latex, 'stack')).toBe(expected);
    });

    test.each([
        ['U_{m}ax', 'stack', 'U_m ax'],
        ['U_{m}ax', 'explicit_single', 'U_m*a*x'],
        ['U_{m}ax', 'explicit_multi', 'U_m*ax'],
        ['U_{e}ff', 'stack', 'U_e ff']
    ])('Characters after a subscript group stay separate (latex=%s, mode=%s, expected=%s)',
        (latex, mode, expected) => {
            expect(evaluated(latex, mode)).toBe(expected);
        });

    test('The subscript survives being written back into the editor', () => {
        expect(stackInput('U_{max}')).toBe('U_max');
    });
});

describe('Behat: Nesting through the toolbar (#78, #79)', () => {
    test('A root inside a root, built with the toolbar', () => {
        expect(stackInput('\\sqrt{\\sqrt{x}}')).toBe('sqrt(sqrt(x))');
    });

    test('Three roots deep', () => {
        expect(stackInput('\\sqrt{\\sqrt{\\sqrt{x}}}')).toBe('sqrt(sqrt(sqrt(x)))');
    });

    test('A nested absolute value keeps both bars', () => {
        expect(stackInput('\\left|1+\\left|x\\right|\\right|')).toBe('abs(1+abs(x))');
    });
});

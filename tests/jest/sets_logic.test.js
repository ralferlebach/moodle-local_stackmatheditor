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
 * Issue #35: every set/logic toolbar operator maps to STACK-valid Maxima and back.
 *
 * Verified against the STACK 4.13 security map: set operations exist only as functions
 * (union, intersection, setdifference, elementp, subsetp); implies is allowed, impliedby and iff
 * are not and are rewritten. Logic buttons write and/or (a statement judged as a whole); nounand /
 * nounor are reserved for structures: equation systems and ± solution sets.
 *
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const {loadAmd, loadDefinitions, VARIABLE_MODES} = require('./amd_loader');

const tex2max = loadAmd('tex2max');
const max2tex = loadAmd('max2tex');
const operatorMap = loadAmd('operator_map');
const defs = loadDefinitions();

const toMaxima = (latex, mode = 'explicit_single') => tex2max.convert(latex, {defs, variableMode: mode});
const toTex = (maxima, mode = 'explicit_single') => max2tex.convert(maxima, {defs, variableMode: mode});

/** The examples of #35 with their canonical STACK/Maxima form. */
const MAPPINGS = [
    ['x \\in A', 'elementp(x,A)'],
    ['x \\notin A', 'not elementp(x,A)'],
    ['A \\cup B', 'union(A,B)'],
    ['A \\cap B', 'intersection(A,B)'],
    ['A \\setminus B', 'setdifference(A,B)'],
    ['A \\subseteq B', 'subsetp(A,B)'],
    ['A \\supseteq B', 'subsetp(B,A)'],
    ['A \\subset B', '(subsetp(A,B) and A#B)'],
    ['A \\supset B', '(subsetp(B,A) and B#A)'],
    ['p \\land q', 'p and q'],
    ['p \\lor q', 'p or q'],
    ['\\neg p', 'not p'],
    ['p \\Rightarrow q', 'p implies q'],
    ['p \\Leftarrow q', 'q implies p'],
    ['p \\Leftrightarrow q', '(p implies q) and (q implies p)'],
];

/** Words STACK 4.13 does not know as set/logic operators, or knows with another meaning. */
const FORBIDDEN_OUTPUT = /\b(?:in|notin|setdiff|subset|superset|impliedby|iff|intersect)\b/;

describe.each(VARIABLE_MODES)('tex2max in mode %s', (mode) => {
    test.each(MAPPINGS)('%s -> %s', (latex, expected) => {
        expect(toMaxima(latex, mode)).toBe(expected);
    });

    test.each(MAPPINGS)('%s emits no word STACK rejects and no split keyword', (latex) => {
        const out = toMaxima(latex, mode);
        expect(out).not.toMatch(FORBIDDEN_OUTPUT);
        expect(out).not.toMatch(/[a-z]\*[a-z]\*[a-z]/);
        expect(out).not.toMatch(/[\uE000-\uF8FF]/);
    });

    test.each(MAPPINGS)('%s is stable over TeX -> Maxima -> TeX -> Maxima', (latex) => {
        const first = toMaxima(latex, mode);
        expect(toMaxima(toTex(first, mode), mode)).toBe(first);
    });
});

describe('tex2max: operand structure and precedence', () => {
    test.each([
        ['x\\in A\\cup B', 'elementp(x,union(A,B))'],
        ['A\\cup B\\cap C', 'union(A,intersection(B,C))'],
        ['\\left(A\\cup B\\right)\\cap C', 'intersection(union(A,B),C)'],
        ['A\\cup B\\cup C', 'union(A,B,C)'],
        ['A\\setminus B\\setminus C', 'setdifference(setdifference(A,B),C)'],
        ['\\left\\{1,2\\right\\}\\cup\\left\\{3\\right\\}', 'union({1,2},{3})'],
        ['x\\in A\\land y\\notin B', 'elementp(x,A) and not elementp(y,B)'],
        ['p\\land q\\Leftarrow r', 'r implies (p and q)'],
        ['p \\wedge q', 'p and q'],
        ['p\\vee q', 'p or q'],
        // A chain of relations is a conjunction of neighbouring relations (like a<b<c).
        ['A\\supset B\\subset C', '(subsetp(B,A) and B#A) and (subsetp(B,C) and B#C)'],
        ['x\\in A\\subseteq B', 'elementp(x,A) and subsetp(A,B)'],
    ])('%s -> %s', (latex, expected) => {
        expect(toMaxima(latex)).toBe(expected);
    });

    test('\\neg is no longer read as \\ne followed by "g"', () => {
        expect(toMaxima('\\neg\\left(x=0\\right)')).toBe('not (x=0)');
    });
});

describe('max2tex: reading canonical and legacy forms', () => {
    test.each([
        ['elementp(x,A)', 'x \\in A'],
        ['not elementp(x,A)', 'x \\notin A'],
        ['nounnot elementp(x,A)', 'x \\notin A'],
        ['union(A,B,C)', 'A \\cup B \\cup C'],
        ['intersection(union(A,B),C)', '(A \\cup B) \\cap C'],
        ['union(A,intersection(B,C))', 'A \\cup B \\cap C'],
        ['setdifference(A,union(B,C))', 'A \\setminus (B \\cup C)'],
        ['subsetp(A,B)', 'A \\subseteq B'],
        ['(subsetp(A,B) and A#B)', 'A \\subset B'],
        ['(p implies q) and (q implies p)', 'p \\Leftrightarrow q'],
        ['(subsetp(B,A) and B#A) and (subsetp(B,C) and B#C)', 'B \\subset A \\land B \\subset C'],
        ['union({1,2},{3})', '\\left\\{1,2\\right\\} \\cup \\left\\{3\\right\\}'],
        // Legacy spellings written by earlier versions of the editor.
        ['x in A', 'x \\in A'],
        ['x notin A', 'x \\notin A'],
        ['A union B', 'A \\cup B'],
        ['p and q', 'p \\land q'],
        ['p or q', 'p \\lor q'],
        ['p nounand q', 'p \\land q'],
        ['p nounor q', 'p \\lor q'],
    ])('%s -> %s', (maxima, expected) => {
        expect(toTex(maxima)).toBe(expected);
    });
});

describe('central operator table', () => {
    const all = operatorMap.SET_OPERATORS.concat(operatorMap.LOGIC_OPERATORS);

    test('every toolbar operator of the table is covered by a mapping test', () => {
        const tested = MAPPINGS.map(([latex]) => latex.replace(/^[^\\]*\\|[^a-zA-Z].*$/g, ''));
        all.forEach((op) => {
            expect(op.latex.some((cmd) => tested.includes(cmd.substring(1)))).toBe(true);
        });
    });

    test('marker characters are unique', () => {
        const markers = all.filter((op) => op.marker).map((op) => op.marker);
        expect(new Set(markers).size).toBe(markers.length);
    });
});

describe('logic vs. structure: and/or against nounand/nounor', () => {
    test('logic buttons write and/or, never the noun operators', () => {
        const out = toMaxima('p\\land q\\lor r');
        expect(out).toBe('p and q or r');
        expect(out).not.toMatch(/noun/);
    });

    test('an equation system joins its rows with nounand', () => {
        expect(toMaxima('\\begin{cases}a+2b=5\\\\2a+6b=-2\\end{cases}'))
            .toBe('(a+2*b=5) nounand (2*a+6*b=-2)');
    });

    test('a nounand system is rendered as cases, a logical and is not', () => {
        expect(toTex('(a+2*b=5) nounand (2*a+6*b=-2)')).toContain('\\begin{cases}');
        expect(toTex('(x>0) and (x<5)')).toBe('(x>0) \\land (x<5)');
    });
});

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
 * Issue #96: property tests over generated expressions, without extra npm dependencies.
 *
 * A small seeded generator (mulberry32, fixed seeds, so every run checks the same expressions)
 * builds Maxima expressions from a grammar of what the editor supports: numbers, single- and
 * multi-letter identifiers, subscripted identifiers, + - * / ^, unary minus, sqrt, abs,
 * sin/cos/tan/log/exp, lists, sets and matrix([..],..) of 1 to 4 rows and columns.
 *
 * Properties:
 * 1. one cycle Maxima -> TeX -> Maxima reaches a fixed point: a second cycle changes nothing;
 * 2. no CAS string contains a backslash, neither for generated expressions nor for any button
 *    template of fixtures/buttons.json, in any mode;
 * 3. matrix dimensions survive the cycle, in every mode;
 * 4. identifier boundaries are neither invented nor lost;
 * 5. brackets stay balanced and properly nested, in the CAS string and in the LaTeX, and every
 *    exponent of more than one character is a LaTeX group;
 * 6. analyse() never reports success with an empty result.
 *
 * A failing sample is reported with its seed: `sample(seed)` regenerates it.
 *
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const {loadAmd, loadDefinitions, VARIABLE_MODES} = require('./amd_loader');

const tex2max = loadAmd('tex2max');
const max2tex = loadAmd('max2tex');
const buttons = require('./fixtures/buttons.json');

const defs = loadDefinitions({
    normFunction: 'norm',
    diffOps: {gradient: 'grad', divergence: 'div', curl: 'curl', laplacian: 'laplacian'}
});

const SAMPLES_PER_MODE = 250;
const MATRIX_SAMPLES = 150;

/**
 * mulberry32: a tiny deterministic 32-bit PRNG.
 *
 * @param {number} seed Seed.
 * @returns {Function} () => float in [0, 1).
 */
function mulberry32(seed) {
    let a = seed >>> 0;
    return function() {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Single letters; e, i, j, l and o are left out (constants, look-alikes). */
const SINGLE = 'abcdfghkmnpqrstuvwxyz'.split('');
/** Multi-character identifiers, incl. subscripts, an operator name inside, and Greek. */
const MULTI = ['ab', 'xy', 'Umax', 'U_max', 'x_1', 'x_12', 'rate', 'vel', 'T_amb', 'alpha', 'theta'];
const FUNCS = ['sin', 'cos', 'tan', 'log', 'exp'];

/** Words that are function names or constructors, not identifiers. */
const NOT_IDENTIFIERS = new Set(['sqrt', 'abs', 'matrix', ...FUNCS]);

/**
 * Build a random Maxima expression.
 *
 * Compound operands are always bracketed, so the generated string has exactly the structure
 * of the tree; redundant brackets are fine - property 1 compares after the first cycle.
 *
 * @param {Function} rnd PRNG.
 * @param {number} depth Remaining depth.
 * @param {boolean} allowMatrix Whether a matrix may appear here.
 * @returns {string} Maxima.
 */
function gen(rnd, depth, allowMatrix) {
    const pick = (list) => list[Math.floor(rnd() * list.length)];
    if (depth <= 0 || rnd() < 0.2) {
        const kind = rnd();
        if (kind < 0.3) {
            return String(Math.floor(rnd() * 100));
        }
        return kind < 0.7 ? pick(SINGLE) : pick(MULTI);
    }
    const sub = () => gen(rnd, depth - 1, false);
    const wrap = (s) => (/^[A-Za-z0-9_]+$/.test(s) ? s : '(' + s + ')');
    switch (Math.floor(rnd() * 12)) {
        case 0: return sub() + '+' + sub();
        case 1: return sub() + '-' + wrap(sub());
        case 2: return wrap(sub()) + '*' + wrap(sub());
        case 3: return wrap(sub()) + '/' + wrap(sub());
        case 4: return wrap(sub()) + '^' + wrap(sub());
        case 5: return 'sqrt(' + sub() + ')';
        case 6: return 'abs(' + sub() + ')';
        case 7: return pick(FUNCS) + '(' + sub() + ')';
        case 8: return '-' + wrap(sub());
        case 9: return allowMatrix ? genMatrix(rnd).maxima : sub();
        case 10: return '[' + sub() + ',' + sub() + ']';
        default: return '{' + sub() + ',' + sub() + '}';
    }
}

/**
 * Build a random matrix of 1-4 rows and 1-4 columns.
 *
 * @param {Function} rnd PRNG.
 * @returns {Object} {maxima, rows, cols}.
 */
function genMatrix(rnd) {
    const rows = 1 + Math.floor(rnd() * 4);
    const cols = 1 + Math.floor(rnd() * 4);
    const out = [];
    for (let r = 0; r < rows; r += 1) {
        const cells = [];
        for (let c = 0; c < cols; c += 1) {
            cells.push(gen(rnd, 1, false));
        }
        out.push('[' + cells.join(',') + ']');
    }
    return {maxima: 'matrix(' + out.join(',') + ')', rows, cols};
}

/**
 * Regenerate sample number seed.
 *
 * @param {number} seed Seed.
 * @returns {string} Maxima.
 */
function sample(seed) {
    const rnd = mulberry32(seed);
    return gen(rnd, 1 + Math.floor(rnd() * 4), true);
}

/**
 * Check that (), [] and {} are balanced and properly nested.
 *
 * @param {string} s Maxima.
 * @returns {boolean} True when balanced.
 */
function balanced(s) {
    const pairs = {')': '(', ']': '[', '}': '{'};
    const stack = [];
    for (const ch of s) {
        if (ch === '(' || ch === '[' || ch === '{') {
            stack.push(ch);
        } else if (pairs[ch]) {
            if (stack.pop() !== pairs[ch]) {
                return false;
            }
        }
    }
    return stack.length === 0;
}

/**
 * Check the LaTeX structure: group braces, \left/\right and \begin/\end pair up.
 *
 * @param {string} latex LaTeX.
 * @returns {boolean} True when well-formed.
 */
function wellFormedLatex(latex) {
    const stack = [];
    const token = /\\begin\{([a-zA-Z]+)\}|\\end\{([a-zA-Z]+)\}|\\left|\\right|\\[{}]|\\.|[{}]/g;
    let m;
    while ((m = token.exec(latex)) !== null) {
        if (m[1]) {
            stack.push('env:' + m[1]);
        } else if (m[2]) {
            if (stack.pop() !== 'env:' + m[2]) {
                return false;
            }
        } else if (m[0] === '\\left') {
            stack.push('left');
        } else if (m[0] === '\\right') {
            if (stack.pop() !== 'left') {
                return false;
            }
        } else if (m[0] === '{') {
            stack.push('{');
        } else if (m[0] === '}') {
            if (stack.pop() !== '{') {
                return false;
            }
        }
    }
    return stack.length === 0;
}

/**
 * Identifier and number tokens of a Maxima string, function names left out, sorted.
 *
 * @param {string} s Maxima.
 * @returns {string[]} Tokens.
 */
function tokens(s) {
    return (s.match(/[A-Za-z%][A-Za-z0-9_]*|\d+/g) || [])
        .filter((t) => !NOT_IDENTIFIERS.has(t))
        .sort();
}

/**
 * The tokens a single-letter mode is expected to produce: plain runs of letters are split,
 * subscripted identifiers and Greek letters stay whole.
 *
 * @param {string[]} list Tokens of the source.
 * @returns {string[]} Expected tokens, sorted.
 */
function splitSingle(list) {
    const out = [];
    list.forEach((t) => {
        if (/^[A-Za-z]+$/.test(t) && defs.greek.indexOf(t) === -1) {
            out.push(...t.split(''));
        } else {
            out.push(t);
        }
    });
    return out.sort();
}

const SINGLE_MODES = new Set(['explicit_single', 'space_single']);

/** Run the cycle once per mode and seed; the properties read from this table. */
const RESULTS = {};
VARIABLE_MODES.forEach((mode, index) => {
    RESULTS[mode] = [];
    for (let i = 1; i <= SAMPLES_PER_MODE; i += 1) {
        // Each mode gets its own seed range, so the five modes see different samples.
        const seed = index * 10000 + i;
        const source = sample(seed);
        const latex = max2tex.convert(source, {defs, variableMode: mode});
        const first = tex2max.analyse(latex, {defs, variableMode: mode});
        const entry = {seed, source, latex, first};
        if (first.maxima !== '') {
            entry.latex2 = max2tex.convert(first.maxima, {defs, variableMode: mode});
            entry.second = tex2max.convert(entry.latex2, {defs, variableMode: mode});
        }
        RESULTS[mode].push(entry);
    }
});

/**
 * Collect the samples for which check() returns false, for a readable failure message.
 *
 * @param {Object[]} entries Results.
 * @param {Function} check entry => boolean.
 * @returns {Object[]} Failing samples (seed, source, details).
 */
function failing(entries, check) {
    return entries.filter((e) => !check(e)).map((e) => ({
        seed: e.seed, source: e.source, latex: e.latex, maxima: e.first.maxima, second: e.second
    }));
}

describe.each(VARIABLE_MODES)('properties in mode %s', (mode) => {
    const entries = () => RESULTS[mode];

    test('the generator is deterministic', () => {
        expect(sample(42)).toBe(sample(42));
        // Shallow samples repeat (a lone "x"); most of them must still be different.
        expect(new Set(entries().map((e) => e.source)).size).toBeGreaterThan(SAMPLES_PER_MODE * 0.8);
    });

    test('1: a second Maxima -> TeX -> Maxima cycle changes nothing', () => {
        expect(failing(entries(), (e) => e.first.maxima !== '' && e.second === e.first.maxima))
            .toEqual([]);
    });

    test('2: no CAS string contains a backslash or a private-use marker', () => {
        expect(failing(entries(), (e) => !/\\|[-]/.test(e.first.maxima))).toEqual([]);
    });

    test('4: identifier boundaries are neither invented nor lost', () => {
        const expected = (e) => (SINGLE_MODES.has(mode) ? splitSingle(tokens(e.source)) : tokens(e.source));
        // Matrices included: the matrix() call the converter writes is a function name in every
        // mode, and the identifiers in its cells follow the mode like any other.
        expect(entries().some((e) => e.source.indexOf('matrix') !== -1)).toBe(true);
        expect(failing(entries(), (e) => JSON.stringify(tokens(e.first.maxima)) === JSON.stringify(expected(e))))
            .toEqual([]);
    });

    test('4: in stack and the multi modes a multi-letter identifier stays one token', () => {
        if (SINGLE_MODES.has(mode)) {
            return;
        }
        const multi = entries().filter((e) => /\b(?:Umax|rate|vel|xy|ab)\b/.test(e.source));
        expect(multi.length).toBeGreaterThan(20);
        expect(failing(multi, (e) => {
            // A number in front is not a merge: "58ab" is the number 58 and the identifier ab.
            const count = (list, n) => list.filter((t) => t === n).length;
            const names = e.source.match(/\b(?:Umax|rate|vel|xy|ab)\b/g);
            return names.every((n) => count(tokens(e.first.maxima), n) === count(tokens(e.source), n));
        })).toEqual([]);
    });

    test('5: brackets stay balanced in the CAS string and in the LaTeX', () => {
        expect(failing(entries(), (e) => balanced(e.first.maxima) && wellFormedLatex(e.latex)))
            .toEqual([]);
        expect(failing(entries(), (e) => wellFormedLatex(e.latex2) && balanced(e.second))).toEqual([]);
    });

    test('5: an exponent of more than one character is a LaTeX group', () => {
        // x^12 in LaTeX raises only the 1; the exponent has to be x^{12}.
        expect(failing(entries(), (e) => !/\^(?:[A-Za-z0-9_.]{2}|-)/.test(e.latex))).toEqual([]);
    });

    test('6: analyse() never reports success with an empty result', () => {
        expect(failing(entries(), (e) => e.first.maxima !== '' || e.first.problems.length > 0))
            .toEqual([]);
        // Every generated expression is something the editor can write, so none is reported.
        expect(failing(entries(), (e) => e.first.problems.length === 0)).toEqual([]);
    });
});

describe('3: matrix dimensions survive the cycle', () => {
    /**
     * Read the dimensions of a top-level matrix(...) call.
     *
     * @param {string} s Maxima.
     * @returns {?Object} {rows, cols} or null when s is not one matrix with equal rows.
     */
    function dimensions(s) {
        if (!/^matrix\(\[/.test(s) || !s.endsWith(')')) {
            return null;
        }
        const body = s.slice('matrix('.length, -1);
        const rows = [];
        let level = 0;
        let cells = 1;
        for (const ch of body) {
            if (ch === '(' || ch === '[' || ch === '{') {
                level += 1;
            } else if (ch === ')' || ch === ']' || ch === '}') {
                level -= 1;
                if (level === 0 && ch === ']') {
                    rows.push(cells);
                    cells = 1;
                }
            } else if (ch === ',' && level === 1) {
                cells += 1;
            }
            if (level < 0) {
                return null;
            }
        }
        return new Set(rows).size === 1 ? {rows: rows.length, cols: rows[0]} : null;
    }

    const cases = [];
    for (let seed = 1; seed <= MATRIX_SAMPLES; seed += 1) {
        const m = genMatrix(mulberry32(50000 + seed));
        cases.push([seed, m]);
    }

    test('the dimension reader reads what the generator wrote', () => {
        cases.forEach(([, m]) => {
            expect(dimensions(m.maxima)).toEqual({rows: m.rows, cols: m.cols});
        });
        expect(new Set(cases.map(([, m]) => m.rows + 'x' + m.cols)).size).toBe(16);
    });

    test.each(VARIABLE_MODES)('mode %s: rows x columns are the same after Maxima -> TeX -> Maxima, twice', (mode) => {
        const bad = [];
        cases.forEach(([seed, m]) => {
            const latex = max2tex.convert(m.maxima, {defs, variableMode: mode});
            const once = tex2max.convert(latex, {defs, variableMode: mode});
            const twice = tex2max.convert(max2tex.convert(once, {defs, variableMode: mode}),
                {defs, variableMode: mode});
            const want = {rows: m.rows, cols: m.cols};
            if (JSON.stringify(dimensions(once)) !== JSON.stringify(want)
                    || JSON.stringify(dimensions(twice)) !== JSON.stringify(want)) {
                bad.push({seed, source: m.maxima, latex, once, twice});
            }
        });
        expect(bad).toEqual([]);
    });

    test.each(VARIABLE_MODES)('mode %s: a vector keeps its orientation', (mode) => {
        ['matrix([a],[b],[c],[d])', 'matrix([a,b,c,d])', 'matrix([a])'].forEach((v) => {
            const back = tex2max.convert(max2tex.convert(v, {defs, variableMode: mode}),
                {defs, variableMode: mode});
            expect(dimensions(back)).toEqual(dimensions(v));
        });
    });
});

describe('2/6: every button template in every mode', () => {
    /**
     * Fill the empty slots of a template, like a student would before checking.
     *
     * Unlike a plain 'a' + template + 'b', the operand after a command is separated by a space,
     * so \neq stays \neq instead of becoming the unknown control word \neqb.
     *
     * @param {string} template LaTeX the button writes.
     * @returns {string} A complete expression.
     */
    function fill(template) {
        const slots = [
            ['\\left(\\right)', '\\left(x\\right)'],
            ['\\left[\\right]', '\\left[x\\right]'],
            ['\\left\\{\\right\\}', '\\left\\{x\\right\\}'],
            ['\\left\\lVert \\right\\rVert ', '\\left\\lVert x\\right\\rVert '],
        ['\\left\\|\\right\\|', '\\left\\|x\\right\\|'],
            ['\\left|\\right|', '\\left|x\\right|'],
            ['{}', '{x}']
        ];
        let latex = template;
        slots.forEach(([empty, filled]) => {
            latex = latex.split(empty).join(filled);
        });
        const infix = /^[\^_]/.test(latex)
            || /^\\(cdot|div|times|pm|mp|neq|approx|leq|geq|in|notin|cup|cap|setminus|subseteq|supseteq|subset|supset|land|lor|Rightarrow|Leftarrow|Leftrightarrow|angle)$/.test(latex);
        return infix ? 'a' + latex + ' b' : latex;
    }

    const templated = buttons
        .filter((b) => b.kind === 'write' || b.kind === 'cmd')
        .map((b) => [b.group + ' / ' + (b.display || b.template), fill(b.template)]);

    test.each(VARIABLE_MODES)('mode %s: no backslash, no marker, never empty without a problem', (mode) => {
        const bad = [];
        templated.forEach(([name, latex]) => {
            const result = tex2max.analyse(latex, {defs, variableMode: mode});
            if (/\\|[-]/.test(result.maxima)
                    || (result.maxima === '' && result.problems.length === 0)) {
                bad.push({name, latex, result});
            }
        });
        expect(bad).toEqual([]);
    });

    test.each(VARIABLE_MODES)('mode %s: an infix operator button never fuses with its operand', (mode) => {
        // The operator's own name must not show up glued to the right operand ("neqb", "inb").
        const bad = [];
        templated.forEach(([name, latex]) => {
            if (!/ b$/.test(latex)) {
                return;
            }
            const result = tex2max.convert(latex, {defs, variableMode: mode});
            if (/[a-zA-Z]{2,}b\b/.test(result.replace(/\b(?:and|or|not|implies)\b/g, ''))) {
                bad.push({name, latex, result});
            }
        });
        expect(bad).toEqual([]);
    });
});

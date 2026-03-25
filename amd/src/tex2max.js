/**
 * Converts MathQuill LaTeX output to Maxima CAS notation.
 *
 * Features:
 * - Standard LaTeX → Maxima conversion
 * - Locale-aware decimal separator (comma → dot)
 * - Implicit multiplication (2x → 2*x, with units exception)
 *
 * @module     local_stackmatheditor/tex2max
 * @copyright  2026 Ralf Erlebach
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
define([], function() {
    'use strict';

    /**
     * Known unit abbreviations.
     * Sorted by length descending so longer matches are checked first.
     *
     * Fallback list; runtime defs.units take precedence when available.
     *
     * @type {string[]}
     */
    var UNITS = [
        // Multi-char units first (longer).
        'kHz', 'MHz', 'GHz',
        'kPa', 'MPa',
        'kcal',
        'kW', 'MW',
        'kJ', 'MJ', 'eV',
        'kN',
        'kV', 'mA',
        'kg', 'mg',
        'km', 'cm', 'mm', 'nm', 'um',
        'ms', 'mL', 'dL',
        'min',
        'mol',
        'Ohm', 'ohm',
        'bar', 'atm',
        'cal',
        'Hz',
        'Pa',
        'lb', 'oz', 'ft', 'yd', 'mi',
        'hr',
        // Single-char units last.
        'm', 'g', 's', 'h', 't',
        'N', 'J', 'W', 'V', 'A', 'K', 'L', 'F', 'C'
    ];

    /**
     * Build a fast lookup set from a string array.
     *
     * @param {string[]} list Source list.
     * @returns {Object} Set-like object.
     */
    function buildWordSet(list) {
        var set = Object.create(null);
        var i;
        var item;

        list = list || [];
        for (i = 0; i < list.length; i++) {
            item = list[i];
            if (typeof item === 'string' && item) {
                set[item] = true;
            }
        }
        return set;
    }

    /**
     * Return unit lookup set.
     *
     * Prefers defs.units from PHP runtime config; falls back to hardcoded list.
     *
     * @param {Object} defs Runtime definitions.
     * @returns {Object} Set-like object of known units.
     */
    function getUnitSet(defs) {
        if (defs && defs.units && defs.units.length) {
            return buildWordSet(defs.units);
        }
        return buildWordSet(UNITS);
    }

    /**
     * Replace decimal commas with dots (for locales using comma as decimal separator).
     * Only replaces commas between digits that are NOT inside square brackets (lists).
     *
     * @param {string} s Input string.
     * @returns {string} String with decimal commas replaced by dots.
     */
    function replaceDecimalCommas(s) {
        var result = '';
        var bracketDepth = 0;
        var i;

        for (i = 0; i < s.length; i++) {
            if (s[i] === '[') {
                bracketDepth++;
            }
            if (s[i] === ']' && bracketDepth > 0) {
                bracketDepth--;
            }

            // Comma between digits, outside brackets → decimal separator.
            if (s[i] === ',' && bracketDepth === 0) {
                if (i > 0 && i < s.length - 1 &&
                    /\d/.test(s[i - 1]) && /\d/.test(s[i + 1])) {
                    result += '.';
                    continue;
                }
            }
            result += s[i];
        }

        return result;
    }

    /**
     * Tokenize an already mostly-converted Maxima string for implicit
     * multiplication processing.
     *
     * Token types:
     * - number
     * - ident
     * - open
     * - close
     * - comma
     * - other
     *
     * @param {string} s Input string.
     * @returns {Object[]} Token list.
     */
    function tokenizeForImplicitMultiplication(s) {
        var tokens = [];
        var i = 0;
        var ch;
        var rest;
        var m;

        while (i < s.length) {
            ch = s.charAt(i);

            if (/\s/.test(ch)) {
                i++;
                continue;
            }

            rest = s.substring(i);

            // Number, supporting decimal dot or comma.
            m = rest.match(/^\d+(?:[.,]\d+)?/);
            if (m) {
                tokens.push({
                    type: 'number',
                    value: m[0]
                });
                i += m[0].length;
                continue;
            }

            // Percent-prefixed constant/identifier, e.g. %pi.
            m = rest.match(/^%[a-zA-Z]+/);
            if (m) {
                tokens.push({
                    type: 'ident',
                    value: m[0]
                });
                i += m[0].length;
                continue;
            }

            // Identifier, possibly with a simple suffix subscript.
            m = rest.match(/^[a-zA-Z]+(?:_[a-zA-Z0-9]+)?/);
            if (m) {
                tokens.push({
                    type: 'ident',
                    value: m[0]
                });
                i += m[0].length;
                continue;
            }

            if (ch === '(') {
                tokens.push({type: 'open', value: ch});
                i++;
                continue;
            }
            if (ch === ')') {
                tokens.push({type: 'close', value: ch});
                i++;
                continue;
            }
            if (ch === ',') {
                tokens.push({type: 'comma', value: ch});
                i++;
                continue;
            }

            tokens.push({type: 'other', value: ch});
            i++;
        }

        return tokens;
    }

    /**
     * Expand identifier tokens according to variable mode.
     *
     * - multi: "ab" stays "ab"
     * - single: "ab" becomes "a", "b"
     *
     * Protected names are NOT split:
     * - Greek names (lambda, phi, ...)
     * - known functions/constants/reserved words/units
     * - percent constants like %pi
     * - identifiers with subscript suffixes
     *
     * @param {Object[]} tokens Token list.
     * @param {Object} options Conversion options.
     * @returns {Object[]} Expanded token list.
     */
    function expandIdentifiers(tokens, options) {
        var opts = options || {};
        var defs = opts.defs || {};
        var mode = opts.variableMode || 'single';
        var protectedWords = Object.create(null);
        var out = [];
        var i;
        var tok;
        var value;
        var parts;
        var sets = [
            buildWordSet(defs.functionNames || defs.functions || []),
            buildWordSet(defs.constants || []),
            buildWordSet(defs.greek || []),
            buildWordSet(defs.reservedWords || []),
            getUnitSet(defs),
            buildWordSet(defs.percentConstants || [])
        ];
        var si;
        var keys;
        var ki;

        for (si = 0; si < sets.length; si++) {
            keys = Object.keys(sets[si]);
            for (ki = 0; ki < keys.length; ki++) {
                protectedWords[keys[ki]] = true;
            }
        }

        for (i = 0; i < tokens.length; i++) {
            tok = tokens[i];

            if (tok.type !== 'ident') {
                out.push(tok);
                continue;
            }

            value = tok.value;

            if (mode !== 'single') {
                out.push(tok);
                continue;
            }

            if (protectedWords[value]
                || value.charAt(0) === '%'
                || value.indexOf('_') !== -1
                || !/^[a-zA-Z]+$/.test(value)) {
                out.push(tok);
                continue;
            }

            parts = value.split('');
            parts.forEach(function(part) {
                out.push({
                    type: 'ident',
                    value: part
                });
            });
        }

        return out;
    }

    /**
     * Decide whether a multiplication sign must be inserted between tokens.
     *
     * @param {Object|null} prev Previous token.
     * @param {Object|null} curr Current token.
     * @param {Object} options Conversion options.
     * @returns {boolean} True if "*" should be inserted.
     */
    function needsImplicitMultiplication(prev, curr, options) {
        var opts = options || {};
        var defs = opts.defs || {};
        var functionNames = buildWordSet(
            defs.functionNames || defs.functions || []
        );
        var unitSet = getUnitSet(defs);

        if (!prev || !curr) {
            return false;
        }
        if (prev.type === 'other' || curr.type === 'other') {
            return false;
        }
        if (prev.type === 'comma' || curr.type === 'comma') {
            return false;
        }
        if (prev.type === 'open' || curr.type === 'close') {
            return false;
        }

        // 2x -> 2*x, but keep known units together: 2m -> 2m
        if (prev.type === 'number' && curr.type === 'ident') {
            return !unitSet[curr.value];
        }

        // 2(x+1) -> 2*(x+1)
        if (prev.type === 'number' && curr.type === 'open') {
            return true;
        }

        // ab -> a*b (only after identifier expansion in single mode)
        if (prev.type === 'ident' && curr.type === 'ident') {
            return true;
        }

        // x(y+1) -> x*(y+1), but sin(x) stays sin(x)
        if (prev.type === 'ident' && curr.type === 'open') {
            return !functionNames[prev.value];
        }

        // (a+b)c -> (a+b)*c, (a+b)2 -> (a+b)*2, (a+b)(c+d) -> ...
        if (prev.type === 'close'
            && (curr.type === 'ident'
                || curr.type === 'number'
                || curr.type === 'open')) {
            return true;
        }

        return false;
    }

    /**
     * Insert implicit multiplication where mathematically expected.
     *
     * Rules:
     * - digit followed by variable: 2x -> 2*x
     * - digit followed by (: 2( -> 2*(
     * - ) followed by (: )( -> )*(
     * - ) followed by letter: )x -> )*x
     * - ) followed by digit: )2 -> )*2
     * - %pi/%e followed by variable/paren: %pi x -> %pi*x
     *
     * In variableMode "single", multi-letter identifiers are split unless they
     * are protected names like units, greek names, functions, constants, etc.
     *
     * @param {string} s Input string (already in Maxima notation).
     * @param {Object} [options] Conversion options.
     * @returns {string} String with explicit multiplication signs inserted.
     */
    function insertImplicitMultiplication(s, options) {
        var tokens = tokenizeForImplicitMultiplication(s);
        var out = '';
        var i;

        tokens = expandIdentifiers(tokens, options || {});

        for (i = 0; i < tokens.length; i++) {
            if (i > 0 &&
                needsImplicitMultiplication(tokens[i - 1], tokens[i], options || {})) {
                out += '*';
            }
            out += tokens[i].value;
        }

        return out;
    }

    /**
     * Main LaTeX → Maxima conversion function.
     *
     * @param {string} latex LaTeX string from MathQuill.
     * @param {Object} [options] Conversion options.
     * @param {boolean} [options.commaDecimal=false] Treat commas as decimal separators.
     * @param {Object} [options.defs={}] Runtime definitions.
     * @param {string} [options.variableMode='single'] Variable mode.
     * @returns {string} Maxima expression.
     */
    function convert(latex, options) {
        var opts = options || {};
        var commaDecimal = opts.commaDecimal || false;
        var defs = opts.defs || {};
        var variableMode = opts.variableMode || 'single';
        var s = latex;
        var maxIter = 20;

        // Normalise whitespace.
        s = s.replace(/\s+/g, ' ').trim();

        // Remove \left / \right.
        s = s.replace(/\\left/g, '');
        s = s.replace(/\\right/g, '');

        // ── Structures with braces (before {} cleanup) ──

        // N-th root: \sqrt[n]{expr} -> (expr)^(1/(n)).
        s = s.replace(
            /\\sqrt\[([^\]]+)\]\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g,
            '($2)^(1/($1))'
        );

        // N-th root (MathQuill): \nthroot{n}{expr} -> (expr)^(1/(n)).
        s = s.replace(
            /\\nthroot\{([^{}]*)\}\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g,
            '($2)^(1/($1))'
        );

        // Binomial: \binom{n}{k} -> binomial(n,k).
        s = s.replace(
            /\\binom\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g,
            'binomial($1,$2)'
        );

        // Fractions (loop for nesting).
        while (s.indexOf('\\frac') !== -1 && maxIter > 0) {
            maxIter--;
            s = s.replace(
                /\\frac\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/,
                '($1)/($2)'
            );
        }

        // Square root.
        s = s.replace(
            /\\sqrt\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g,
            'sqrt($1)'
        );

        // Decorative commands: strip to content (before {} cleanup).
        s = s.replace(/\\vec\{([^{}]*)\}/g, '$1');
        s = s.replace(/\\overline\{([^{}]*)\}/g, '$1');
        s = s.replace(/\\mathbb\{([^{}]*)\}/g, '$1');
        // Constants: \mathrm{e} -> %e, \mathrm{i} -> %i
        s = s.replace(/\\mathrm\{e\}/g, '%e');
        s = s.replace(/\\mathrm\{i\}/g, '%i');
        s = s.replace(/\\mathrm\{([^{}]*)\}/g, '$1');
        s = s.replace(/\\operatorname\{([^{}]*)\}/g, '$1');

        // Exponents.
        s = s.replace(/\^\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, '^($1)');

        // Subscripts.
        s = s.replace(/_\{([^{}]*)\}/g, '_$1');

        // ── Functions ───────────────────────────────

        // Trig & hyperbolic.
        var funcs = [
            'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
            'arcsin', 'arccos', 'arctan',
            'sinh', 'cosh', 'tanh'
        ];
        funcs.forEach(function(fn) {
            s = s.replace(
                new RegExp('\\\\' + fn + '(?![a-zA-Z])', 'g'),
                fn
            );
        });

        // Logarithms / exp.
        s = s.replace(/\\ln(?![a-zA-Z])/g, 'log');
        s = s.replace(/\\log(?![a-zA-Z])/g, 'log');
        s = s.replace(/\\exp(?![a-zA-Z])/g, 'exp');

        // ── Constants ───────────────────────────────

        s = s.replace(/\\pi(?![a-zA-Z])/g, '%pi');
        s = s.replace(/\\infty/g, 'inf');
        s = s.replace(/\\e(?![a-zA-Z])/g, '%e');

        // ── Operators ───────────────────────────────

        s = s.replace(/\\cdot/g, '*');
        s = s.replace(/\\times/g, '*');
        s = s.replace(/\\div/g, '/');
        s = s.replace(/\\%/g, '%');
        s = s.replace(/\\&/g, '&');

        // ── Comparison ──────────────────────────────

        s = s.replace(/\\leq?/g, '<=');
        s = s.replace(/\\geq?/g, '>=');
        s = s.replace(/\\neq?/g, '#');
        s = s.replace(/\\ne(?![a-zA-Z])/g, '#');
        s = s.replace(/\\approx(?![a-zA-Z])/g, '~=');

        // ── Integral / sum / product operators ──────

        s = s.replace(/\\oint(?![a-zA-Z])/g, 'oint');
        s = s.replace(/\\int(?![a-zA-Z])/g, 'int');
        s = s.replace(/\\sum(?![a-zA-Z])/g, 'sum');
        s = s.replace(/\\prod(?![a-zA-Z])/g, 'product');

        // ── Absolute value: |expr| -> abs(expr) ────────

        s = s.replace(/\\\|/g, '|');
        s = s.replace(/\|([^|]+)\|/g, 'abs($1)');

        // ── Greek letters (lower) ───────────────────
        // Longer variants first to prevent partial match.

        var greek = [
            'varepsilon', 'vartheta', 'varphi',
            'alpha', 'beta', 'gamma', 'delta',
            'epsilon', 'zeta', 'eta', 'theta',
            'iota', 'kappa', 'lambda', 'mu',
            'nu', 'xi', 'rho', 'sigma',
            'tau', 'upsilon', 'phi', 'chi',
            'psi', 'omega'
        ];
        greek.forEach(function(letter) {
            s = s.replace(
                new RegExp('\\\\' + letter + '(?![a-zA-Z])', 'g'),
                letter
            );
        });

        // ── Greek letters (upper) ───────────────────

        var greekUpper = [
            'Gamma', 'Delta', 'Theta', 'Lambda',
            'Xi', 'Pi', 'Sigma', 'Upsilon',
            'Phi', 'Psi', 'Omega'
        ];
        greekUpper.forEach(function(letter) {
            s = s.replace(
                new RegExp('\\\\' + letter + '(?![a-zA-Z])', 'g'),
                letter
            );
        });

        // ── Set theory ──────────────────────────────

        s = s.replace(/\\notin(?![a-zA-Z])/g, ' notin ');
        s = s.replace(/\\in(?![a-zA-Z])/g, ' in ');
        s = s.replace(/\\cup(?![a-zA-Z])/g, ' union ');
        s = s.replace(/\\cap(?![a-zA-Z])/g, ' intersect ');
        s = s.replace(/\\setminus(?![a-zA-Z])/g, ' setdiff ');
        s = s.replace(/\\subset(?![a-zA-Z])/g, ' subset ');
        s = s.replace(/\\supset(?![a-zA-Z])/g, ' superset ');

        // ── Logic (\not\exists before \exists) ──────

        s = s.replace(/\\nexists/g, ' nexists ');
        s = s.replace(/\\not\\exists/g, ' nexists ');
        s = s.replace(/\\forall(?![a-zA-Z])/g, ' forall ');
        s = s.replace(/\\exists(?![a-zA-Z])/g, ' exists ');
        s = s.replace(/\\neg(?![a-zA-Z])/g, ' not ');
        s = s.replace(/\\land(?![a-zA-Z])/g, ' and ');
        s = s.replace(/\\lor(?![a-zA-Z])/g, ' or ');
        s = s.replace(/\\Rightarrow(?![a-zA-Z])/g, ' implies ');
        s = s.replace(/\\Leftarrow(?![a-zA-Z])/g, ' impliedby ');
        s = s.replace(/\\Leftrightarrow(?![a-zA-Z])/g, ' iff ');

        // ── Geometry / physics ──────────────────────

        s = s.replace(/\\angle(?![a-zA-Z])/g, 'angle');
        s = s.replace(/\\perp(?![a-zA-Z])/g, 'perp');
        s = s.replace(/\\circ(?![a-zA-Z])/g, 'circ');
        s = s.replace(/\\nabla(?![a-zA-Z])/g, 'nabla');
        s = s.replace(/\\partial(?![a-zA-Z])/g, 'del');
        s = s.replace(/\\hbar(?![a-zA-Z])/g, 'hbar');

        // ── Matrix decorators ───────────────────────

        s = s.replace(/\\dagger(?![a-zA-Z])/g, 'dagger');
        s = s.replace(/\\intercal(?![a-zA-Z])/g, 'T');

        // ── Cleanup ─────────────────────────────────

        // Remove remaining LaTeX artifacts.
        s = s.replace(/\\ /g, '');
        s = s.replace(/[{}]/g, '');

        // Decimal separator: comma -> dot.
        if (commaDecimal) {
            s = replaceDecimalCommas(s);
        }

        // Implicit multiplication.
        // single mode: 2ab -> 2*a*b
        // multi mode:  2ab -> 2*ab
        s = insertImplicitMultiplication(s, {
            defs: defs,
            variableMode: variableMode
        });

        // Final cleanup.
        s = s.replace(/\s+/g, ' ').trim();

        return s;
    }

    return /** @alias module:local_stackmatheditor/tex2max */ {
        convert: convert
    };
});
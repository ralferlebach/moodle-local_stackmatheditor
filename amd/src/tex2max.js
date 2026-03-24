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
     * Check whether a string is a known measurement unit.
     *
     * @param {string} str The string to check.
     * @returns {boolean} True if it matches a known unit exactly.
     */
    function isUnit(str) {
        var i;
        for (i = 0; i < UNITS.length; i++) {
            if (str === UNITS[i]) {
                return true;
            }
        }
        return false;
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
     * Insert implicit multiplication where mathematically expected.
     *
     * Rules:
     * - digit followed by letter: 2x → 2*x (unless letters form a known unit)
     * - digit followed by (: 2( → 2*(
     * - ) followed by (: )( → )*(
     * - ) followed by letter: )x → )*x
     * - ) followed by digit: )2 → )*2
     * - %pi/%e followed by variable/paren: %pi x → %pi*x
     *
     * @param {string} s Input string (already in Maxima notation).
     * @returns {string} String with explicit multiplication signs inserted.
     */
    function insertImplicitMultiplication(s) {
        // 1. ) followed by ( → )*(
        s = s.replace(/\)\s*\(/g, ')*(');

        // 2. ) followed by letter → )*letter
        s = s.replace(/\)\s*([a-zA-Z%])/g, ')*$1');

        // 3. ) followed by digit → )*digit
        s = s.replace(/\)\s*(\d)/g, ')*$1');

        // 4. digit followed by ( → digit*(
        s = s.replace(/(\d)\s*\(/g, '$1*(');

        // 5. digit followed by letter(s) → digit*letters (with units exception).
        s = s.replace(/(\d)\s*([a-zA-Z]+)/g, function(match, digit, letters) {
            // Remove any whitespace in the match.
            var clean = digit + letters;
            if (isUnit(letters)) {
                // Known unit: keep together without *.
                return clean;
            }
            // Not a unit: insert *.
            return digit + '*' + letters;
        });

        // 6. Constants followed by variable/digit/paren: %pi x → %pi*x
        s = s.replace(/(%pi|%e)(\s*)([a-zA-Z0-9(])/g, function(match, constant, space, next) {
            // Don't double up on *.
            if (next === '*') {
                return match;
            }
            return constant + '*' + next;
        });

        return s;
    }

    /**
     * Main LaTeX → Maxima conversion function.
     *
     * @param {string} latex LaTeX string from MathQuill.
     * @param {Object} [options] Conversion options.
     * @param {boolean} [options.commaDecimal=false] Treat commas as decimal separators.
     * @returns {string} Maxima expression.
     */
    function convert(latex, options) {
        var opts = options || {};
        var commaDecimal = opts.commaDecimal || false;
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

        // Implicit multiplication: 2x -> 2*x.
        s = insertImplicitMultiplication(s);

        // Final cleanup.
        s = s.replace(/\s+/g, ' ').trim();

        return s;
    }

    return /** @alias module:local_stackmatheditor/tex2max */ {
        convert: convert
    };
});

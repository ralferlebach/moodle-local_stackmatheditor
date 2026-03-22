/**
 * Converts MathQuill LaTeX output to Maxima CAS notation.
 *
 * Features:
 * - Standard LaTeX → Maxima conversion
 * - Locale-aware decimal separator (comma → dot)
 * - Implicit multiplication (2x → 2*x, with units exception)
 *
 * @module     local_stackmatheditor/tex2max
 * @copyright  2026 Your Name
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

        // N-th root: \sqrt[n]{expr} -> (expr)^(1/(n)).
        s = s.replace(
            /\\sqrt\[([^\]]+)\]\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g,
            '($2)^(1/($1))'
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

        // Exponents.
        s = s.replace(/\^\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, '^($1)');

        // Subscripts.
        s = s.replace(/_\{([^{}]*)\}/g, '_$1');

        // Trig & hyperbolic functions.
        var funcs = [
            'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
            'arcsin', 'arccos', 'arctan',
            'sinh', 'cosh', 'tanh'
        ];
        funcs.forEach(function(fn) {
            s = s.replace(new RegExp('\\\\' + fn + '(?![a-zA-Z])', 'g'), fn);
        });

        // Logarithms.
        s = s.replace(/\\ln(?![a-zA-Z])/g, 'log');
        s = s.replace(/\\log(?![a-zA-Z])/g, 'log');
        s = s.replace(/\\exp(?![a-zA-Z])/g, 'exp');

        // Constants.
        s = s.replace(/\\pi/g, '%pi');
        s = s.replace(/\\infty/g, 'inf');
        s = s.replace(/\\e(?![a-zA-Z])/g, '%e');

        // Operators.
        s = s.replace(/\\cdot/g, '*');
        s = s.replace(/\\times/g, '*');
        s = s.replace(/\\div/g, '/');

        // Comparison.
        s = s.replace(/\\leq?/g, '<=');
        s = s.replace(/\\geq?/g, '>=');
        s = s.replace(/\\neq?/g, '#');
        s = s.replace(/\\ne(?![a-zA-Z])/g, '#');

        // Greek letters.
        var greek = [
            'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta',
            'theta', 'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi',
            'rho', 'sigma', 'tau', 'upsilon', 'phi', 'chi', 'psi', 'omega'
        ];
        greek.forEach(function(letter) {
            s = s.replace(new RegExp('\\\\' + letter + '(?![a-zA-Z])', 'g'), letter);
        });

        // Cleanup LaTeX artifacts.
        s = s.replace(/\\ /g, '');
        s = s.replace(/[{}]/g, '');

        // Decimal separator: comma → dot (locale-aware, outside lists).
        if (commaDecimal) {
            s = replaceDecimalCommas(s);
        }

        // Implicit multiplication: 2x → 2*x (with units exception).
        s = insertImplicitMultiplication(s);

        // Final cleanup.
        s = s.replace(/\s+/g, ' ').trim();

        return s;
    }

    return /** @alias module:local_stackmatheditor/tex2max */ {
        convert: convert
    };
});

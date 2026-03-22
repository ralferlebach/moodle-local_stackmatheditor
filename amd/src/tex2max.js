/**
 * Converts MathQuill LaTeX output to Maxima CAS notation.
 *
 * Uses non-greedy (lazy) regex quantifiers (*?, +?) inside a fixpoint loop
 * that repeats until the string no longer changes. This correctly handles
 * arbitrary nesting depth without requiring manual brace-matching.
 *
 * @module     local_stackmatheditor/tex2max
 * @copyright  2026 Your Name
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
define([], function() {
    'use strict';

    /**
     * Known unit abbreviations (longer first).
     *
     * @type {string[]}
     */
    var UNITS = [
        'kHz', 'MHz', 'GHz', 'kPa', 'MPa', 'kcal',
        'kW', 'MW', 'kJ', 'MJ', 'eV', 'kN', 'kV', 'mA',
        'kg', 'mg', 'km', 'cm', 'mm', 'nm', 'um',
        'ms', 'mL', 'dL', 'min', 'mol', 'Ohm', 'ohm',
        'bar', 'atm', 'cal', 'Hz', 'Pa',
        'lb', 'oz', 'ft', 'yd', 'mi', 'hr',
        'm', 'g', 's', 'h', 't',
        'N', 'J', 'W', 'V', 'A', 'K', 'L', 'F', 'C'
    ];

    /**
     * Known function names for implicit multiplication exclusion.
     *
     * @type {string[]}
     */
    var FUNCTIONS = [
        'arcsin', 'arccos', 'arctan',
        'sinh', 'cosh', 'tanh',
        'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
        'sqrt', 'log', 'exp', 'abs'
    ];

    /**
     * Check whether a string is a known measurement unit.
     *
     * @param {string} str The string to check.
     * @returns {boolean} True if it matches a known unit.
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
     * Check whether a string starts with a known function name
     * (not followed by another letter).
     *
     * @param {string} str The string to check.
     * @returns {string|null} The function name or null.
     */
    function startsWithFunction(str) {
        var i;
        for (i = 0; i < FUNCTIONS.length; i++) {
            if (str.indexOf(FUNCTIONS[i]) === 0) {
                var after = str.charAt(FUNCTIONS[i].length);
                if (!after || !/[a-zA-Z]/.test(after)) {
                    return FUNCTIONS[i];
                }
            }
        }
        return null;
    }

    /**
     * Apply a regex replacement in a fixpoint loop.
     * Repeats until the string no longer changes or maxIter is reached.
     *
     * @param {string} s Input string.
     * @param {RegExp} regex Regular expression (should use lazy quantifiers).
     * @param {string|Function} replacement Replacement string or function.
     * @param {number} [maxIter=50] Maximum iterations.
     * @returns {string} Transformed string.
     */
    function fixpoint(s, regex, replacement, maxIter) {
        var max = maxIter || 50;
        var prev = '';
        while (s !== prev && max > 0) {
            prev = s;
            s = s.replace(regex, replacement);
            max--;
        }
        return s;
    }

    /**
     * Process \frac{...}{...} using lazy quantifiers in a fixpoint loop.
     * Each iteration peels off the innermost \frac (one that contains
     * no further \frac inside its braces).
     *
     * @param {string} s Input string.
     * @returns {string} Converted string.
     */
    function processFractions(s) {
        // Lazy: match the SMALLEST possible content inside each brace group.
        // This naturally processes innermost fractions first.
        return fixpoint(s,
            /\\frac\s*\{((?:[^{}]|\{[^{}]*?\})*?)\}\s*\{((?:[^{}]|\{[^{}]*?\})*?)\}/,
            '($1)/($2)'
        );
    }

    /**
     * Process \sqrt[n]{...} and \sqrt{...} using lazy regex + fixpoint.
     *
     * @param {string} s Input string.
     * @returns {string} Converted string.
     */
    function processSqrt(s) {
        // N-th root: \sqrt[n]{expr}
        s = fixpoint(s,
            /\\sqrt\[([^\]]+?)\]\s*\{((?:[^{}]|\{[^{}]*?\})*?)\}/,
            '($2)^(1/($1))'
        );
        // Square root: \sqrt{expr}
        s = fixpoint(s,
            /\\sqrt\s*\{((?:[^{}]|\{[^{}]*?\})*?)\}/,
            'sqrt($1)'
        );
        return s;
    }

    /**
     * Process ^{...} exponents using lazy regex + fixpoint.
     *
     * @param {string} s Input string.
     * @returns {string} Converted string.
     */
    function processExponents(s) {
        return fixpoint(s,
            /\^\{((?:[^{}]|\{[^{}]*?\})*?)\}/,
            '^($1)'
        );
    }

    /**
     * Process _{...} subscripts using lazy regex + fixpoint.
     *
     * @param {string} s Input string.
     * @returns {string} Converted string.
     */
    function processSubscripts(s) {
        return fixpoint(s,
            /_\{((?:[^{}]|\{[^{}]*?\})*?)\}/,
            '_$1'
        );
    }

    /**
     * Process a single LaTeX function command into Maxima function call.
     * Handles three cases:
     *   \sin{x}   → funcname(x)
     *   \sin(x)   → funcname(x)  (already parenthesized)
     *   \sin x    → funcname(x)  (collect argument until operator/delimiter)
     *   \sin 2x   → funcname(2*x)
     *
     * @param {string} s Input string.
     * @param {string} latexCmd The LaTeX command including backslash (e.g. '\\sin').
     * @param {string} maximaName The Maxima function name (e.g. 'sin').
     * @returns {string} Converted string.
     */
    function processFunction(s, latexCmd, maximaName) {
        var result = '';
        var i = 0;
        var safety = 100;

        while (i < s.length && safety > 0) {
            safety--;
            var idx = s.indexOf(latexCmd, i);

            if (idx === -1) {
                result += s.substring(i);
                break;
            }

            // Ensure not part of a longer command (e.g. \sinh shouldn't match \sin).
            var afterCmd = idx + latexCmd.length;
            if (afterCmd < s.length && /[a-zA-Z]/.test(s[afterCmd])) {
                result += s.substring(i, idx + 1);
                i = idx + 1;
                continue;
            }

            result += s.substring(i, idx);

            // Skip whitespace after command.
            var argStart = afterCmd;
            while (argStart < s.length && s[argStart] === ' ') {
                argStart++;
            }

            // Case 1: Followed by {braces}.
            if (argStart < s.length && s[argStart] === '{') {
                var braceMatch = s.substring(argStart).match(
                    /^\{((?:[^{}]|\{[^{}]*?\})*?)\}/
                );
                if (braceMatch) {
                    result += maximaName + '(' + braceMatch[1] + ')';
                    i = argStart + braceMatch[0].length;
                    continue;
                }
            }

            // Case 2: Already followed by parentheses.
            if (argStart < s.length && s[argStart] === '(') {
                result += maximaName;
                i = afterCmd;
                continue;
            }

            // Case 3: Bare argument — collect until +, -, =, <, >, ), ].
            if (argStart < s.length) {
                var argEnd = argStart;
                var depth = 0;
                while (argEnd < s.length) {
                    var ch = s[argEnd];
                    if (ch === '(' || ch === '[') {
                        depth++;
                    }
                    if (ch === ')' || ch === ']') {
                        if (depth <= 0) {
                            break;
                        }
                        depth--;
                    }
                    if (depth === 0 &&
                        (ch === '+' || ch === '-' || ch === '=' ||
                            ch === '<' || ch === '>')) {
                        break;
                    }
                    // Stop at / unless it's part of /(...).
                    if (depth === 0 && ch === '/' &&
                        argEnd + 1 < s.length && s[argEnd + 1] !== '(') {
                        break;
                    }
                    argEnd++;
                }

                var arg = s.substring(argStart, argEnd).trim();
                if (arg.length > 0) {
                    result += maximaName + '(' + arg + ')';
                    i = argEnd;
                } else {
                    result += maximaName;
                    i = afterCmd;
                }
            } else {
                result += maximaName;
                i = afterCmd;
            }
        }

        return result;
    }

    /**
     * Process all trig functions.
     * Longer names first to prevent \sinh matching \sin.
     *
     * @param {string} s Input string.
     * @returns {string} Converted string.
     */
    function processTrigFunctions(s) {
        var funcs = [
            {latex: '\\arcsin', maxima: 'arcsin'},
            {latex: '\\arccos', maxima: 'arccos'},
            {latex: '\\arctan', maxima: 'arctan'},
            {latex: '\\sinh', maxima: 'sinh'},
            {latex: '\\cosh', maxima: 'cosh'},
            {latex: '\\tanh', maxima: 'tanh'},
            {latex: '\\sin', maxima: 'sin'},
            {latex: '\\cos', maxima: 'cos'},
            {latex: '\\tan', maxima: 'tan'},
            {latex: '\\cot', maxima: 'cot'},
            {latex: '\\sec', maxima: 'sec'},
            {latex: '\\csc', maxima: 'csc'}
        ];

        var k;
        for (k = 0; k < funcs.length; k++) {
            s = processFunction(s, funcs[k].latex, funcs[k].maxima);
        }
        return s;
    }

    /**
     * Process \ln, \log, \exp functions.
     *
     * @param {string} s Input string.
     * @returns {string} Converted string.
     */
    function processLogFunctions(s) {
        s = processFunction(s, '\\ln', 'log');
        s = processFunction(s, '\\log', 'log');
        s = processFunction(s, '\\exp', 'exp');
        return s;
    }

    /**
     * Replace decimal commas with dots outside of square brackets.
     *
     * @param {string} s Input string.
     * @returns {string} String with decimal commas replaced.
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
            if (s[i] === ',' && bracketDepth === 0 &&
                i > 0 && i < s.length - 1 &&
                /\d/.test(s[i - 1]) && /\d/.test(s[i + 1])) {
                result += '.';
                continue;
            }
            result += s[i];
        }

        return result;
    }

    /**
     * Insert implicit multiplication where mathematically expected.
     *
     * @param {string} s Input string (already in Maxima notation).
     * @returns {string} String with explicit * inserted.
     */
    function insertImplicitMultiplication(s) {
        // )( → )*(
        s = s.replace(/\)\s*\(/g, ')*(');

        // )letter → )*letter
        s = s.replace(/\)\s*([a-zA-Z%])/g, ')*$1');

        // )digit → )*digit
        s = s.replace(/\)\s*(\d)/g, ')*$1');

        // digit( → digit*(
        s = s.replace(/(\d)\s*\(/g, '$1*(');

        // digit followed by % (for %pi, %e).
        s = s.replace(/(\d)\s*(%)/g, '$1*$2');

        // digit followed by letters — skip units and functions.
        s = s.replace(/(\d)\s*([a-zA-Z]+)/g, function(match, digit, letters) {
            if (isUnit(letters)) {
                return digit + letters;
            }
            if (startsWithFunction(letters)) {
                return digit + '*' + letters;
            }
            return digit + '*' + letters;
        });

        // %pi, %e followed by variable or (.
        s = s.replace(/(%pi|%e)([a-zA-Z(])/g, '$1*$2');

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
        var prev;

        // Normalise whitespace.
        s = s.replace(/\s+/g, ' ').trim();

        if (!s) {
            return s;
        }

        // Remove \left / \right.
        s = s.replace(/\\left/g, '');
        s = s.replace(/\\right/g, '');

        // Structural LaTeX → Maxima in a fixpoint loop.
        // Each pass peels off the innermost layer of nesting.
        // Loop until nothing changes.
        prev = '';
        while (s !== prev) {
            prev = s;
            s = processSqrt(s);
            s = processFractions(s);
            s = processExponents(s);
            s = processSubscripts(s);
        }

        // Functions (must run AFTER structural processing but BEFORE constants).
        s = processTrigFunctions(s);
        s = processLogFunctions(s);

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
        var g;
        for (g = 0; g < greek.length; g++) {
            s = s.replace(
                new RegExp('\\\\' + greek[g] + '(?![a-zA-Z])', 'g'),
                greek[g]
            );
        }

        // Clean up remaining LaTeX artifacts.
        s = s.replace(/\\ /g, '');
        s = s.replace(/[{}]/g, '');

        // Decimal separator.
        if (commaDecimal) {
            s = replaceDecimalCommas(s);
        }

        // Implicit multiplication.
        s = insertImplicitMultiplication(s);

        // Clean up double *.
        s = s.replace(/\*\s*\*/g, '*');

        // Final whitespace cleanup.
        s = s.replace(/\s+/g, ' ').trim();

        return s;
    }

    return /** @alias module:local_stackmatheditor/tex2max */ {
        convert: convert
    };
});

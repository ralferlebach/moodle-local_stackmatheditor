/**
 * Converts Maxima CAS notation back to LaTeX for MathQuill display.
 *
 * Uses non-greedy regex in fixpoint loops (same strategy as tex2max.js)
 * to correctly handle arbitrary nesting depth.
 *
 * Used when pre-filling MathQuill fields with existing answers
 * (e.g., when navigating back to a question).
 *
 * @module     local_stackmatheditor/max2tex
 * @copyright  2026 Your Name
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
define([], function() {
    'use strict';

    /**
     * Apply a regex replacement in a fixpoint loop until stable.
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
     * Find position of matching closing parenthesis.
     *
     * @param {string} s The string.
     * @param {number} openPos Position of the opening '('.
     * @returns {number} Position of matching ')' or -1.
     */
    function findCloseParen(s, openPos) {
        var depth = 1;
        var i = openPos + 1;
        while (i < s.length && depth > 0) {
            if (s[i] === '(') {
                depth++;
            }
            if (s[i] === ')') {
                depth--;
            }
            i++;
        }
        return depth === 0 ? i - 1 : -1;
    }

    /**
     * Find position of matching opening parenthesis (searching backwards).
     *
     * @param {string} s The string.
     * @param {number} closePos Position of the closing ')'.
     * @returns {number} Position of matching '(' or -1.
     */
    function findOpenParen(s, closePos) {
        var depth = 1;
        var i = closePos - 1;
        while (i >= 0 && depth > 0) {
            if (s[i] === ')') {
                depth++;
            }
            if (s[i] === '(') {
                depth--;
            }
            i--;
        }
        return depth === 0 ? i + 1 : -1;
    }

    /**
     * Convert Maxima fractions (a)/(b) → \frac{a}{b}.
     * Uses paren-matching to correctly handle nested fractions.
     * Processes from left to right.
     *
     * @param {string} s Input string.
     * @returns {string} Converted string.
     */
    function processFractions(s) {
        var prev = '';
        var safety = 50;

        while (s !== prev && safety > 0) {
            safety--;
            prev = s;

            // Find the pattern )/(
            var divIdx = s.indexOf(')/(');
            if (divIdx === -1) {
                break;
            }

            // Find matching ( for the numerator's closing )
            var numClose = divIdx;
            var numOpen = findOpenParen(s, numClose);
            if (numOpen === -1) {
                break;
            }

            // Find matching ) for the denominator's opening (
            var denOpen = divIdx + 2;
            var denClose = findCloseParen(s, denOpen);
            if (denClose === -1) {
                break;
            }

            var num = s.substring(numOpen + 1, numClose);
            var den = s.substring(denOpen + 1, denClose);

            s = s.substring(0, numOpen) +
                '\\frac{' + num + '}{' + den + '}' +
                s.substring(denClose + 1);
        }

        return s;
    }

    /**
     * Convert Maxima function calls funcname(arg) to LaTeX.
     * Uses paren-matching for correct nesting.
     *
     * @param {string} s Input string.
     * @param {string} funcName Maxima function name (e.g., 'sqrt').
     * @param {string} latexCmd LaTeX command (e.g., '\\sqrt').
     * @param {string} wrapType 'brace' for \sqrt{...}, 'paren' for \sin\left(...\right).
     * @returns {string} Converted string.
     */
    function processFunc(s, funcName, latexCmd, wrapType) {
        var searchStr = funcName + '(';
        var result = '';
        var i = 0;
        var safety = 50;

        while (i < s.length && safety > 0) {
            safety--;
            var idx = s.indexOf(searchStr, i);

            if (idx === -1) {
                result += s.substring(i);
                break;
            }

            // Ensure not part of a longer word.
            if (idx > 0 && /[a-zA-Z0-9_]/.test(s[idx - 1])) {
                result += s.substring(i, idx + 1);
                i = idx + 1;
                continue;
            }

            result += s.substring(i, idx);

            var parenOpen = idx + funcName.length;
            var parenClose = findCloseParen(s, parenOpen);

            if (parenClose === -1) {
                result += s.substring(idx);
                i = s.length;
                break;
            }

            var arg = s.substring(parenOpen + 1, parenClose);

            if (wrapType === 'brace') {
                result += latexCmd + '{' + arg + '}';
            } else {
                result += latexCmd + '\\left(' + arg + '\\right)';
            }

            i = parenClose + 1;
        }

        return result;
    }

    /**
     * Convert n-th root patterns: (expr)^(1/(n)) → \sqrt[n]{expr}
     * Must run BEFORE exponent processing.
     *
     * @param {string} s Input string.
     * @returns {string} Converted string.
     */
    function processNthRoots(s) {
        // Pattern: (expr)^(1/(n))
        // Use fixpoint with lazy match for inner groups.
        return fixpoint(s,
            /\(([^()]*?)\)\^\(1\/\(([^()]*?)\)\)/,
            '\\sqrt[$2]{$1}'
        );
    }

    /**
     * Convert exponents: ^(expr) → ^{expr}
     * Uses fixpoint loop for nested exponents.
     *
     * @param {string} s Input string.
     * @returns {string} Converted string.
     */
    function processExponents(s) {
        // ^(expr) where expr contains no unmatched parens.
        return fixpoint(s,
            /\^\(([^()]*?)\)/,
            '^{$1}'
        );
    }

    /**
     * Convert subscripts: _x → _{x} (single char) and _xy → _{xy}
     *
     * @param {string} s Input string.
     * @returns {string} Converted string.
     */
    function processSubscripts(s) {
        // _alphanumeric (not already in braces).
        s = s.replace(/_([a-zA-Z0-9]+)(?!\{)/g, '_{$1}');
        return s;
    }

    /**
     * Remove implicit multiplication signs where LaTeX doesn't need them.
     * 2*x → 2x, a*b → a\cdot b, etc.
     *
     * @param {string} s Input string.
     * @returns {string} Cleaned string.
     */
    function cleanMultiplication(s) {
        // digit * letter/backslash → juxtaposition (cleaner LaTeX).
        s = s.replace(/(\d)\s*\*\s*([a-zA-Z\\])/g, '$1$2');

        // letter/paren * letter/paren → \cdot
        s = s.replace(/([a-zA-Z)\]])\s*\*\s*([a-zA-Z\\(])/g, '$1\\cdot $2');

        // Remaining * → \cdot
        s = s.replace(/\*/g, '\\cdot ');

        return s;
    }

    /**
     * Replace decimal dots with commas for display in comma-decimal locales.
     *
     * @param {string} s Input string.
     * @returns {string} Converted string.
     */
    function dotsToCommas(s) {
        return s.replace(/(\d)\.(\d)/g, '$1,$2');
    }

    /**
     * Main Maxima → LaTeX conversion function.
     *
     * @param {string} maxima Maxima expression.
     * @param {Object} [options] Conversion options.
     * @param {boolean} [options.commaDecimal=false] Use comma as decimal separator.
     * @returns {string} LaTeX expression suitable for MathQuill.
     */
    function convert(maxima, options) {
        var opts = options || {};
        var commaDecimal = opts.commaDecimal || false;
        var s = maxima.trim();
        var prev;

        if (!s) {
            return s;
        }

        // 1. Constants (before function processing to avoid conflicts).
        s = s.replace(/%pi/g, '\\pi ');
        s = s.replace(/%e(?![a-zA-Z])/g, 'e');
        s = s.replace(/\binf\b/g, '\\infty ');

        // 2. Comparison operators.
        s = s.replace(/<=/g, '\\le ');
        s = s.replace(/>=/g, '\\ge ');
        s = s.replace(/#/g, '\\ne ');

        // 3. Functions — sqrt first (brace-wrapped).
        s = processFunc(s, 'sqrt', '\\sqrt', 'brace');

        // 4. Trig functions (longer names first to avoid partial matches).
        var trigFuncs = [
            {name: 'arcsin', latex: '\\arcsin'},
            {name: 'arccos', latex: '\\arccos'},
            {name: 'arctan', latex: '\\arctan'},
            {name: 'sinh', latex: '\\sinh'},
            {name: 'cosh', latex: '\\cosh'},
            {name: 'tanh', latex: '\\tanh'},
            {name: 'sin', latex: '\\sin'},
            {name: 'cos', latex: '\\cos'},
            {name: 'tan', latex: '\\tan'},
            {name: 'cot', latex: '\\cot'},
            {name: 'sec', latex: '\\sec'},
            {name: 'csc', latex: '\\csc'}
        ];
        var k;
        for (k = 0; k < trigFuncs.length; k++) {
            s = processFunc(s, trigFuncs[k].name, trigFuncs[k].latex, 'paren');
        }

        // 5. Log/exp functions.
        s = processFunc(s, 'log', '\\ln', 'paren');
        s = processFunc(s, 'exp', '\\exp', 'paren');

        // 6. Fractions: (a)/(b) → \frac{a}{b}
        //    Use fixpoint: inner fractions convert first, then outer ones.
        prev = '';
        while (s !== prev) {
            prev = s;
            s = processFractions(s);
        }

        // 7. N-th roots: (expr)^(1/(n)) → \sqrt[n]{expr}
        //    Must run BEFORE exponent processing.
        prev = '';
        while (s !== prev) {
            prev = s;
            s = processNthRoots(s);
        }

        // 8. Exponents: ^(expr) → ^{expr}
        prev = '';
        while (s !== prev) {
            prev = s;
            s = processExponents(s);
        }

        // 9. Subscripts: _x → _{x}
        s = processSubscripts(s);

        // 10. Greek letters.
        var greek = [
            'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta',
            'theta', 'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi',
            'rho', 'sigma', 'tau', 'upsilon', 'phi', 'chi', 'psi', 'omega'
        ];
        for (k = 0; k < greek.length; k++) {
            s = s.replace(
                new RegExp('\\b' + greek[k] + '\\b', 'g'),
                '\\' + greek[k] + ' '
            );
        }

        // 11. Multiplication signs.
        s = cleanMultiplication(s);

        // 12. Decimal separator.
        if (commaDecimal) {
            s = dotsToCommas(s);
        }

        // 13. Clean up whitespace.
        s = s.replace(/\s+/g, ' ').trim();

        return s;
    }

    /**
     * Detect whether a string looks like Maxima notation (vs LaTeX).
     *
     * @param {string} s The string to check.
     * @returns {boolean} True if the string appears to be Maxima notation.
     */
    function isMaxima(s) {
        if (!s || !s.trim()) {
            return false;
        }
        // Contains LaTeX commands → not Maxima.
        if (/\\frac|\\sqrt|\\sin|\\cos|\\pi|\\left/.test(s)) {
            return false;
        }
        // Contains Maxima-specific patterns → Maxima.
        if (/%pi|%e|sqrt\(|log\(|\)\/\(/.test(s)) {
            return true;
        }
        // No backslashes at all → assume Maxima (STACK stores Maxima).
        if (s.indexOf('\\') === -1) {
            return true;
        }
        return false;
    }

    return /** @alias module:local_stackmatheditor/max2tex */ {
        convert: convert,
        isMaxima: isMaxima
    };
});

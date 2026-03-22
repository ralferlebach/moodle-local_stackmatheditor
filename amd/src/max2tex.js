/**
 * Converts Maxima CAS notation back to LaTeX for MathQuill display.
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
     * Find position of matching closing parenthesis.
     *
     * @param {string} s The string to search.
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
     * @param {string} s The string to search.
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
     * Replace function calls with LaTeX brace notation.
     * e.g., sqrt(x+1) → \\sqrt{x+1}
     *
     * @param {string} s Input string.
     * @param {string} funcName Function name to find (e.g., 'sqrt').
     * @param {string} latexCmd LaTeX command (e.g., '\\sqrt').
     * @returns {string} Transformed string.
     */
    function replaceFuncBraces(s, funcName, latexCmd) {
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
                break;
            }

            var arg = s.substring(parenOpen + 1, parenClose);
            result += latexCmd + '{' + arg + '}';
            i = parenClose + 1;
        }

        return result;
    }

    /**
     * Replace function calls with LaTeX parenthesis notation.
     * e.g., sin(x) → \\sin\\left(x\\right)
     *
     * @param {string} s Input string.
     * @param {string} funcName Function name to find.
     * @param {string} latexCmd LaTeX command.
     * @returns {string} Transformed string.
     */
    function replaceFuncParens(s, funcName, latexCmd) {
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
                break;
            }

            var arg = s.substring(parenOpen + 1, parenClose);
            result += latexCmd + '\\left(' + arg + '\\right)';
            i = parenClose + 1;
        }

        return result;
    }

    /**
     * Replace (num)/(den) fraction patterns with \\frac{num}{den}.
     * Uses balanced parenthesis matching.
     *
     * @param {string} s Input string.
     * @returns {string} Transformed string.
     */
    function replaceFractions(s) {
        var safety = 30;
        while (safety > 0) {
            safety--;
            var divIdx = s.indexOf(')/(');
            if (divIdx === -1) {
                break;
            }

            var numClose = divIdx;
            var numOpen = findOpenParen(s, numClose);
            if (numOpen === -1) {
                break;
            }

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
     * Replace decimal dots with commas for locales using comma as decimal separator.
     *
     * @param {string} s Input string.
     * @returns {string} Transformed string.
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
        var k;

        if (!s) {
            return s;
        }

        // 1. Constants (before Greek letters to avoid conflicts).
        s = s.replace(/%pi/g, '\\pi ');
        s = s.replace(/%e(?![a-zA-Z])/g, 'e');
        s = s.replace(/\binf\b/g, '\\infty ');

        // 2. Comparison operators.
        s = s.replace(/<=/g, '\\le ');
        s = s.replace(/>=/g, '\\ge ');
        s = s.replace(/#/g, '\\ne ');

        // 3. sqrt(expr) → \sqrt{expr}
        s = replaceFuncBraces(s, 'sqrt', '\\sqrt');

        // 4. Trig / hyperbolic functions (longer names first to avoid partial matches).
        var trigFuncs = [
            'arcsin', 'arccos', 'arctan',
            'sinh', 'cosh', 'tanh',
            'sin', 'cos', 'tan', 'cot', 'sec', 'csc'
        ];
        for (k = 0; k < trigFuncs.length; k++) {
            s = replaceFuncParens(s, trigFuncs[k], '\\' + trigFuncs[k]);
        }

        // 5. log → \ln, exp → \exp
        s = replaceFuncParens(s, 'log', '\\ln');
        s = replaceFuncParens(s, 'exp', '\\exp');

        // 6. Fractions: (a)/(b) → \frac{a}{b}
        s = replaceFractions(s);

        // 7. N-th roots: (expr)^(1/(n)) → \sqrt[n]{expr}
        s = s.replace(
            /\(([^()]+)\)\^\(1\/\(([^()]+)\)\)/g,
            '\\sqrt[$2]{$1}'
        );

        // 8. Exponents: ^(expr) → ^{expr}, then ^x → ^{x}
        s = s.replace(/\^\(([^()]*)\)/g, '^{$1}');
        s = s.replace(/\^([a-zA-Z0-9])/g, '^{$1}');

        // 9. Subscripts: _n → _{n}
        s = s.replace(/_([a-zA-Z0-9])/g, '_{$1}');

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

        // 11. Multiplication sign cleanup.
        // Between digit and letter/backslash: remove * (cleaner LaTeX).
        s = s.replace(/(\d)\s*\*\s*([a-zA-Z\\])/g, '$1$2');
        // Between letter/paren and letter/paren: use \cdot.
        s = s.replace(/([a-zA-Z)])\s*\*\s*([a-zA-Z\\(])/g, '$1\\cdot $2');
        // Remaining * → \cdot.
        s = s.replace(/\*/g, '\\cdot ');

        // 12. Decimal separator: dot → comma for display (if locale requires it).
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

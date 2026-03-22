/**
 * Converts Maxima CAS notation back to LaTeX for MathQuill display.
 *
 * All function names, constants, operators are read from options.defs.
 *
 * @module     local_stackmatheditor/max2tex
 * @copyright  2026 Your Name
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
define([], function() {
    'use strict';

    /**
     * Fixpoint loop.
     *
     * @param {string} s Input.
     * @param {RegExp} regex Pattern.
     * @param {string|Function} replacement Replacement.
     * @param {number} [maxIter=50] Max iterations.
     * @returns {string} Result.
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
     * Find matching closing paren.
     *
     * @param {string} s String.
     * @param {number} openPos Position of '('.
     * @returns {number} Position of ')' or -1.
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
     * Find matching opening paren (searching backwards).
     *
     * @param {string} s String.
     * @param {number} closePos Position of ')'.
     * @returns {number} Position of '(' or -1.
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
     * Convert (a)/(b) fractions using paren-matching.
     *
     * @param {string} s Input.
     * @returns {string} Converted.
     */
    function processFractions(s) {
        var prev = '';
        var safety = 50;
        while (s !== prev && safety > 0) {
            safety--;
            prev = s;
            var divIdx = s.indexOf(')/(');
            if (divIdx === -1) {
                break;
            }
            var numOpen = findOpenParen(s, divIdx);
            if (numOpen === -1) {
                break;
            }
            var denClose = findCloseParen(s, divIdx + 2);
            if (denClose === -1) {
                break;
            }
            var num = s.substring(numOpen + 1, divIdx);
            var den = s.substring(divIdx + 3, denClose);
            s = s.substring(0, numOpen) +
                '\\frac{' + num + '}{' + den + '}' +
                s.substring(denClose + 1);
        }
        return s;
    }

    /**
     * Convert funcname(arg) to LaTeX using paren-matching.
     *
     * @param {string} s Input.
     * @param {string} funcName Maxima function name.
     * @param {string} latexCmd LaTeX command.
     * @param {string} wrapType 'brace' or 'paren'.
     * @returns {string} Converted.
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
     * Convert n-th roots: (expr)^(1/(n)) -> \sqrt[n]{expr}
     *
     * @param {string} s Input.
     * @returns {string} Converted.
     */
    function processNthRoots(s) {
        return fixpoint(s,
            /\(([^()]*?)\)\^\(1\/\(([^()]*?)\)\)/,
            '\\sqrt[$2]{$1}'
        );
    }

    /**
     * Convert ^(expr) -> ^{expr}
     *
     * @param {string} s Input.
     * @returns {string} Converted.
     */
    function processExponents(s) {
        return fixpoint(s, /\^\(([^()]*?)\)/, '^{$1}');
    }

    /**
     * Convert subscripts.
     *
     * @param {string} s Input.
     * @returns {string} Converted.
     */
    function processSubscripts(s) {
        s = s.replace(/_([a-zA-Z0-9]+)(?!\{)/g, '_{$1}');
        return s;
    }

    /**
     * Clean multiplication signs for LaTeX display.
     *
     * @param {string} s Input.
     * @returns {string} Converted.
     */
    function cleanMultiplication(s) {
        s = s.replace(/(\d)\s*\*\s*([a-zA-Z\\])/g, '$1$2');
        s = s.replace(/([a-zA-Z)\]])\s*\*\s*([a-zA-Z\\(])/g, '$1\\cdot $2');
        s = s.replace(/\*/g, '\\cdot ');
        return s;
    }

    /**
     * Main Maxima -> LaTeX conversion.
     *
     * @param {string} maxima Maxima expression.
     * @param {Object} [options] Options.
     * @returns {string} LaTeX.
     */
    function convert(maxima, options) {
        var opts = options || {};
        var commaDecimal = opts.commaDecimal || false;
        var defs = opts.defs || {};
        var s = maxima.trim();
        var prev;
        var k;

        if (!s) {
            return s;
        }

        // Constants -> LaTeX
        var constants = defs.constants || [];
        for (k = 0; k < constants.length; k++) {
            var con = constants[k];
            if (con.maxima === '%pi') {
                s = s.replace(/%pi/g, '\\pi ');
            } else if (con.maxima === 'inf') {
                s = s.replace(/\binf\b/g, '\\infty ');
            } else if (con.maxima === '%e') {
                s = s.replace(/%e(?![a-zA-Z])/g, 'e');
            }
        }

        // Comparison -> LaTeX
        var comparison = defs.comparison || [];
        for (k = 0; k < comparison.length; k++) {
            var cmpItem = comparison[k];
            s = s.replace(
                new RegExp(cmpItem.maxima.replace(/([<>=#])/g, '\\$1'), 'g'),
                cmpItem.latex_write || cmpItem.maxima
            );
        }

        // Functions -> LaTeX (from definitions)
        var funcDefs = defs.functions || [];
        for (k = 0; k < funcDefs.length; k++) {
            var def = funcDefs[k];
            var wrapType = def.type === 'brace' ? 'brace' : 'paren';
            // For max2tex: Maxima name -> LaTeX command
            // Handle log -> \ln mapping
            var latexTarget = def.latex_cmd;
            s = processFunc(s, def.maxima_name, latexTarget, wrapType);
        }

        // Fractions
        prev = '';
        while (s !== prev) {
            prev = s;
            s = processFractions(s);
        }

        // N-th roots before exponents
        prev = '';
        while (s !== prev) {
            prev = s;
            s = processNthRoots(s);
        }

        // Exponents
        prev = '';
        while (s !== prev) {
            prev = s;
            s = processExponents(s);
        }

        // Subscripts
        s = processSubscripts(s);

        // Greek letters
        var greek = defs.greek || [];
        for (k = 0; k < greek.length; k++) {
            s = s.replace(
                new RegExp('\\b' + greek[k] + '\\b', 'g'),
                '\\' + greek[k] + ' '
            );
        }

        // Multiplication signs
        s = cleanMultiplication(s);

        // Decimal separator
        if (commaDecimal) {
            s = s.replace(/(\d)\.(\d)/g, '$1,$2');
        }

        s = s.replace(/\s+/g, ' ').trim();
        return s;
    }

    /**
     * Detect whether a string is Maxima notation.
     *
     * @param {string} s String to check.
     * @returns {boolean} True if Maxima.
     */
    function isMaxima(s) {
        if (!s || !s.trim()) {
            return false;
        }
        if (/\\frac|\\sqrt|\\sin|\\cos|\\pi|\\left/.test(s)) {
            return false;
        }
        if (/%pi|%e|sqrt\(|log\(|\)\/\(/.test(s)) {
            return true;
        }
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

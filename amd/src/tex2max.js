/**
 * Converts MathQuill LaTeX output to Maxima CAS notation.
 *
 * Protected tokens that are NOT split by implicit multiplication:
 * - Function names: sin, cos, sqrt, log, exp, arcsin, ...
 * - Unit symbols: kg, Hz, kW, mol, ...
 * - Greek letter names: alpha, beta, Gamma, Delta, ...
 * - Percent-constants: %pi, %e, %i, %phi, %gamma
 * - Reserved words: max, min, inf, minf, diff, integrate, ...
 * - Subscript groups: _(abc)
 *
 * @module     local_stackmatheditor/tex2max
 * @copyright  2026 Your Name
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
define([], function() {
    'use strict';

    /**
     * Apply regex in fixpoint loop.
     *
     * @param {string} s Input.
     * @param {RegExp} regex Pattern.
     * @param {string|Function} replacement Replacement.
     * @param {number} [maxIter=50] Safety limit.
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
     * Process \frac{...}{...}.
     *
     * @param {string} s Input.
     * @returns {string} Converted.
     */
    function processFractions(s) {
        return fixpoint(s,
            /\\frac\s*\{((?:[^{}]|\{[^{}]*?\})*?)\}\s*\{((?:[^{}]|\{[^{}]*?\})*?)\}/,
            '($1)/($2)'
        );
    }

    /**
     * Process \sqrt[n]{...} and \sqrt{...}.
     *
     * @param {string} s Input.
     * @returns {string} Converted.
     */
    function processSqrt(s) {
        s = fixpoint(s,
            /\\sqrt\[([^\]]+?)\]\s*\{((?:[^{}]|\{[^{}]*?\})*?)\}/,
            '($2)^(1/($1))'
        );
        s = fixpoint(s,
            /\\sqrt\s*\{((?:[^{}]|\{[^{}]*?\})*?)\}/,
            'sqrt($1)'
        );
        return s;
    }

    /**
     * Process ^{...} exponents.
     *
     * @param {string} s Input.
     * @returns {string} Converted.
     */
    function processExponents(s) {
        return fixpoint(s,
            /\^\{((?:[^{}]|\{[^{}]*?\})*?)\}/,
            '^($1)'
        );
    }

    /**
     * Process _{...} subscripts. Preserves multi-char subscripts.
     * _{abc} -> _(abc)
     *
     * @param {string} s Input.
     * @returns {string} Converted.
     */
    function processSubscripts(s) {
        return fixpoint(s,
            /_\{((?:[^{}]|\{[^{}]*?\})*?)\}/,
            '_($1)'
        );
    }

    /**
     * Process a LaTeX function command to Maxima.
     *
     * @param {string} s Input.
     * @param {string} latexCmd LaTeX command.
     * @param {string} maximaName Maxima name.
     * @returns {string} Converted.
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

            var afterCmd = idx + latexCmd.length;
            // Ensure not a prefix of a longer command.
            if (afterCmd < s.length && /[a-zA-Z]/.test(s[afterCmd])) {
                result += s.substring(i, idx + 1);
                i = idx + 1;
                continue;
            }

            result += s.substring(i, idx);
            var argStart = afterCmd;
            while (argStart < s.length && s[argStart] === ' ') {
                argStart++;
            }

            // Case 1: {braces}.
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

            // Case 2: already parenthesized.
            if (argStart < s.length && s[argStart] === '(') {
                result += maximaName;
                i = afterCmd;
                continue;
            }

            // Case 3: bare argument.
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
                    if (depth === 0 && (ch === '+' || ch === '-' || ch === '=' ||
                        ch === '<' || ch === '>')) {
                        break;
                    }
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
     * Process all functions from definitions.
     *
     * @param {string} s Input.
     * @param {Array} funcDefs Definitions.
     * @returns {string} Converted.
     */
    function processAllFunctions(s, funcDefs) {
        if (!funcDefs || !funcDefs.length) {
            return s;
        }
        var k;
        for (k = 0; k < funcDefs.length; k++) {
            var def = funcDefs[k];
            if (def.type === 'brace') {
                continue;
            }
            s = processFunction(s, def.latex_cmd, def.maxima_name);
        }
        return s;
    }

    /**
     * Replace decimal commas with dots outside square brackets.
     *
     * @param {string} s Input.
     * @returns {string} Converted.
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
     * Build sorted (longest-first) list of all protected multi-char tokens.
     * These are NEVER split by implicit multiplication in single-char mode.
     *
     * @param {Object} defs Definitions from PHP.
     * @returns {string[]} Sorted protected tokens.
     */
    function buildProtectedTokens(defs) {
        var tokens = [];
        var i;
        var seen = {};

        /**
         * Add a token to the protected tokens list if it is multi-char
         * and has not already been added.
         *
         * @param {string} t The token to add.
         */
        function addToken(t) {
            if (t && t.length > 1 && !seen[t]) {
                seen[t] = true;
                tokens.push(t);
            }
        }

        // Function names.
        var funcNames = (defs && defs.functionNames) ? defs.functionNames : [];
        for (i = 0; i < funcNames.length; i++) {
            addToken(funcNames[i]);
        }

        // Unit symbols.
        var unitSymbols = (defs && defs.unitSymbols) ? defs.unitSymbols : [];
        for (i = 0; i < unitSymbols.length; i++) {
            addToken(unitSymbols[i]);
        }

        // Greek letter names (lower + upper).
        var greek = (defs && defs.greek) ? defs.greek : [];
        for (i = 0; i < greek.length; i++) {
            addToken(greek[i]);
        }

        // Reserved words: max, min, inf, minf, diff, integrate, ...
        var reserved = (defs && defs.reservedWords) ? defs.reservedWords : [];
        for (i = 0; i < reserved.length; i++) {
            addToken(reserved[i]);
        }

        // Percent-constants: %pi, %e, %i, %phi, %gamma.
        var pctConst = (defs && defs.percentConstants) ? defs.percentConstants : [];
        for (i = 0; i < pctConst.length; i++) {
            addToken(pctConst[i]);
        }

        // Sort longest first: "arcsin" before "sin", "Gamma" before "am".
        tokens.sort(function(a, b) {
            return b.length - a.length;
        });

        return tokens;
    }

    /**
     * Check if str at position pos matches a protected token.
     * Returns the matched token or null.
     *
     * @param {string} str Full string.
     * @param {number} pos Start position.
     * @param {string[]} tokens Protected tokens (sorted longest-first).
     * @returns {string|null} Matched token or null.
     */
    function matchProtectedToken(str, pos, tokens) {
        var remaining = str.substring(pos);
        var i;
        for (i = 0; i < tokens.length; i++) {
            var token = tokens[i];
            if (remaining.indexOf(token) === 0) {
                // Ensure not a prefix of a longer identifier.
                var afterToken = remaining.charAt(token.length);
                if (!afterToken || !/[a-zA-Z]/.test(afterToken)) {
                    return token;
                }
            }
        }
        return null;
    }

    /**
     * Check if position is inside a subscript group _(abc).
     *
     * @param {string} str The string.
     * @param {number} pos Position.
     * @returns {boolean} True if inside _(...).
     */
    function insideSubscript(str, pos) {
        var j = pos - 1;
        var depth = 0;
        while (j >= 0) {
            if (str[j] === ')') {
                depth++;
            }
            if (str[j] === '(') {
                if (depth > 0) {
                    depth--;
                } else {
                    return j >= 1 && str[j - 1] === '_';
                }
            }
            j--;
        }
        return false;
    }

    /**
     * Check if position is inside or adjacent to a %-constant.
     *
     * @param {string} str The string.
     * @param {number} pos Position.
     * @returns {boolean} True if inside a %-constant.
     */
    function insidePercentConstant(str, pos) {
        var start = Math.max(0, pos - 6);
        var chunk = str.substring(start, pos + 7);
        return /%pi|%phi|%gamma|%e(?![a-zA-Z])|%i(?![a-zA-Z])/.test(chunk);
    }

    /**
     * Insert implicit multiplication.
     *
     * @param {string} s Input (Maxima notation).
     * @param {Object} opts Options.
     * @returns {string} With explicit * inserted.
     */
    function insertImplicitMultiplication(s, opts) {
        var defs = opts.defs || {};
        var varMode = opts.variableMode || 'single';
        var protectedTokens = buildProtectedTokens(defs);
        var unitSymbols = (defs && defs.unitSymbols) ? defs.unitSymbols : [];

        // Basic structural patterns.
        s = s.replace(/\)\s*\(/g, ')*(');
        s = s.replace(/\)\s*([a-zA-Z%])/g, ')*$1');
        s = s.replace(/\)\s*(\d)/g, ')*$1');
        s = s.replace(/(\d)\s*\(/g, '$1*(');
        s = s.replace(/(\d)\s*(%)/g, '$1*$2');
        s = s.replace(/(%pi|%e|%i|%phi|%gamma)\s*([a-zA-Z(])/g, '$1*$2');

        // Digit followed by letters: check for units.
        s = s.replace(/(\d)\s*([a-zA-Z]+)/g, function(match, digit, letters) {
            if (unitSymbols.indexOf(letters) !== -1) {
                return digit + letters;
            }
            return digit + '*' + letters;
        });

        // Single-char mode: split consecutive letters unless protected.
        if (varMode === 'single') {
            var result = '';
            var idx = 0;

            while (idx < s.length) {
                // Check if current position starts a protected token.
                if (/[a-zA-Z%]/.test(s[idx])) {
                    var token = matchProtectedToken(s, idx, protectedTokens);
                    if (token) {
                        // Insert * before the token if preceding char is a letter.
                        if (result.length > 0) {
                            var lastChar = result[result.length - 1];
                            if (/[a-zA-Z]/.test(lastChar)) {
                                result += '*';
                            }
                        }
                        result += token;
                        idx += token.length;
                        continue;
                    }
                }

                var ch = s[idx];
                result += ch;

                // Check if we should insert * between two adjacent letters.
                if (/[a-zA-Z]/.test(ch) && idx + 1 < s.length &&
                    /[a-zA-Z]/.test(s[idx + 1])) {

                    // Don't split inside subscript groups _(abc).
                    if (insideSubscript(s, idx) || insideSubscript(s, idx + 1)) {
                        idx++;
                        continue;
                    }

                    // Don't split inside %-constants.
                    if (insidePercentConstant(s, idx) ||
                        insidePercentConstant(s, idx + 1)) {
                        idx++;
                        continue;
                    }

                    // Check if NEXT position starts a protected token.
                    var nextToken = matchProtectedToken(s, idx + 1, protectedTokens);
                    if (nextToken) {
                        result += '*';
                        idx++;
                        continue;
                    }

                    // Default: insert *.
                    result += '*';
                }
                idx++;
            }
            s = result;
        }

        // Clean double *.
        s = s.replace(/\*\s*\*/g, '*');
        return s;
    }

    /**
     * Main LaTeX -> Maxima conversion.
     *
     * @param {string} latex LaTeX input.
     * @param {Object} [options] Options.
     * @returns {string} Maxima expression.
     */
    function convert(latex, options) {
        var opts = options || {};
        var commaDecimal = opts.commaDecimal || false;
        var defs = opts.defs || {};
        var s = latex;
        var prev;

        s = s.replace(/\s+/g, ' ').trim();
        if (!s) {
            return s;
        }

        // Remove \left / \right.
        s = s.replace(/\\left/g, '');
        s = s.replace(/\\right/g, '');

        // Structural: fixpoint loop.
        prev = '';
        while (s !== prev) {
            prev = s;
            s = processSqrt(s);
            s = processFractions(s);
            s = processExponents(s);
            s = processSubscripts(s);
        }

        // Functions.
        s = processAllFunctions(s, defs.functions);

        // Constants.
        var constants = defs.constants || [];
        var c;
        for (c = 0; c < constants.length; c++) {
            var con = constants[c];
            if (con.latex_regex) {
                s = s.replace(new RegExp(con.latex_regex, 'g'), con.maxima);
            } else {
                s = s.replace(
                    new RegExp(con.latex.replace(/\\/g, '\\\\'), 'g'),
                    con.maxima
                );
            }
        }

        // Operators.
        var operators = defs.operators || [];
        var o;
        for (o = 0; o < operators.length; o++) {
            s = s.replace(
                new RegExp(operators[o].latex.replace(/\\/g, '\\\\'), 'g'),
                operators[o].maxima
            );
        }

        // Comparison.
        var comparison = defs.comparison || [];
        var cmp;
        for (cmp = 0; cmp < comparison.length; cmp++) {
            if (comparison[cmp].latex_regex) {
                s = s.replace(
                    new RegExp(comparison[cmp].latex_regex, 'g'),
                    comparison[cmp].maxima
                );
            }
        }

        // Greek letters: \alpha -> alpha, \Gamma -> Gamma.
        var greek = defs.greek || [];
        var g;
        for (g = 0; g < greek.length; g++) {
            s = s.replace(
                new RegExp('\\\\' + greek[g] + '(?![a-zA-Z])', 'g'),
                greek[g]
            );
        }

        // Cleanup.
        s = s.replace(/\\ /g, '');
        s = s.replace(/[{}]/g, '');

        if (commaDecimal) {
            s = replaceDecimalCommas(s);
        }

        // Implicit multiplication (LAST step).
        s = insertImplicitMultiplication(s, opts);

        // Final cleanup.
        s = s.replace(/\*\s*\*/g, '*');
        s = s.replace(/\s+/g, ' ').trim();

        return s;
    }

    return /** @alias module:local_stackmatheditor/tex2max */ {
        convert: convert
    };
});

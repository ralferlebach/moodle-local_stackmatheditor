/**
 * Converts MathQuill LaTeX to Maxima CAS notation.
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
     * Process derivative fractions before regular fractions.
     * Converts \frac{\mathrm{d}f}{\mathrm{d}x} to diff(f,x).
     * Converts \frac{\partial f}{\partial x} to diff(f,x).
     *
     * @param {string} s Input.
     * @returns {string} Converted.
     */
    function processDerivatives(s) {
        // \frac{\mathrm{d}EXPR}{\mathrm{d}VAR}
        var dRegex = new RegExp(
            '\\\\frac\\s*\\{\\s*\\\\mathrm\\s*\\{\\s*d\\s*\\}'
            + '\\s*((?:[^{}]|\\{[^{}]*?\\})*?)\\}'
            + '\\s*\\{\\s*\\\\mathrm\\s*\\{\\s*d\\s*\\}'
            + '\\s*((?:[^{}]|\\{[^{}]*?\\})*?)\\}',
            'g'
        );
        s = fixpoint(s, dRegex, 'diff($1,$2)');
        // \frac{\partial EXPR}{\partial VAR}
        var pRegex = new RegExp(
            '\\\\frac\\s*\\{\\s*\\\\partial'
            + '\\s*((?:[^{}]|\\{[^{}]*?\\})*?)\\}'
            + '\\s*\\{\\s*\\\\partial'
            + '\\s*((?:[^{}]|\\{[^{}]*?\\})*?)\\}',
            'g'
        );
        s = fixpoint(s, pRegex, 'diff($1,$2)');
        return s;
    }

    /**
     * Process \mathrm{} wrappers.
     * Specific constants first (%e, %i), then strip remaining.
     *
     * @param {string} s Input.
     * @returns {string} Converted.
     */
    function processMathrm(s) {
        s = s.replace(/\\mathrm\s*\{\s*e\s*\}/g, '%e');
        s = s.replace(/\\mathrm\s*\{\s*i\s*\}/g, '%i');
        s = s.replace(/\\mathrm\s*\{([^}]*)\}/g, '$1');
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
     * Process a single LaTeX function command to Maxima.
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
            if (argStart < s.length && s[argStart] === '(') {
                result += maximaName;
                i = afterCmd;
                continue;
            }
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
                    if (depth === 0 && /[+\-=<>]/.test(ch)) {
                        break;
                    }
                    if (depth === 0 && ch === '/' &&
                        argEnd + 1 < s.length &&
                        s[argEnd + 1] !== '(') {
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
            if (funcDefs[k].type === 'brace') {
                continue;
            }
            s = processFunction(
                s,
                funcDefs[k].latex_cmd,
                funcDefs[k].maxima_name
            );
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
     * Build sorted list of all protected multi-char tokens.
     * Sorted longest-first for greedy matching.
     *
     * @param {Object} defs Definitions from PHP.
     * @returns {string[]} Sorted protected tokens.
     */
    function buildProtectedTokens(defs) {
        var tokens = [];
        var seen = {};
        var i;
        var li;

        /**
         * Add a token if multi-char and not yet seen.
         *
         * @param {string} t Token.
         */
        function add(t) {
            if (t && t.length > 1 && !seen[t]) {
                seen[t] = true;
                tokens.push(t);
            }
        }

        var lists = [
            defs.functionNames,
            defs.unitSymbols,
            defs.greek,
            defs.reservedWords,
            defs.percentConstants
        ];
        for (li = 0; li < lists.length; li++) {
            var list = lists[li] || [];
            for (i = 0; i < list.length; i++) {
                add(list[i]);
            }
        }
        tokens.sort(function(a, b) {
            return b.length - a.length;
        });
        return tokens;
    }

    /**
     * Greedy token matching: return the longest protected token
     * starting at position pos.
     *
     * @param {string} str Full string.
     * @param {number} pos Start position.
     * @param {string[]} tokens Sorted longest-first.
     * @returns {string|null} Matched token or null.
     */
    function matchProtectedToken(str, pos, tokens) {
        var remaining = str.substring(pos);
        var i;
        for (i = 0; i < tokens.length; i++) {
            if (remaining.indexOf(tokens[i]) === 0) {
                return tokens[i];
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
     * Check if position is inside a %-constant.
     *
     * @param {string} str The string.
     * @param {number} pos Position.
     * @returns {boolean} True if inside %constant.
     */
    function insidePercentConstant(str, pos) {
        var start = Math.max(0, pos - 6);
        var chunk = str.substring(start, pos + 7);
        var pattern = /%pi|%phi|%gamma|%e(?![a-zA-Z])|%i(?![a-zA-Z])/;
        return pattern.test(chunk);
    }

    /**
     * Insert implicit multiplication.
     *
     * @param {string} s Input in Maxima notation.
     * @param {Object} opts Options with defs and variableMode.
     * @returns {string} With explicit * inserted.
     */
    function insertImplicitMultiplication(s, opts) {
        var defs = opts.defs || {};
        var varMode = opts.variableMode || 'single';
        var protectedTokens = buildProtectedTokens(defs);
        var unitSymbols = defs.unitSymbols || [];
        var pctPattern =
            /(%pi|%e|%i|%phi|%gamma)\s*([a-zA-Z(])/g;

        // Basic structural patterns.
        s = s.replace(/\)\s*\(/g, ')*(');
        s = s.replace(/\)\s*([a-zA-Z%])/g, ')*$1');
        s = s.replace(/\)\s*(\d)/g, ')*$1');
        s = s.replace(/(\d)\s*\(/g, '$1*(');
        s = s.replace(/(\d)\s*(%)/g, '$1*$2');
        s = s.replace(pctPattern, '$1*$2');

        // Digit followed by letters.
        s = s.replace(
            /(\d)\s*([a-zA-Z]+)/g,
            function(match, digit, letters) {
                if (unitSymbols.indexOf(letters) !== -1) {
                    return digit + letters;
                }
                return digit + '*' + letters;
            }
        );

        // Single-char mode: greedy token matching.
        if (varMode === 'single') {
            var result = '';
            var idx = 0;
            var ch;
            var lastChar;
            var token;
            var nextToken;

            while (idx < s.length) {
                if (/[a-zA-Z%]/.test(s[idx])) {
                    token = matchProtectedToken(
                        s, idx, protectedTokens
                    );
                    if (token) {
                        if (result.length > 0) {
                            lastChar = result[result.length - 1];
                            if (/[a-zA-Z0-9)]/.test(lastChar)) {
                                result += '*';
                            }
                        }
                        result += token;
                        idx += token.length;
                        continue;
                    }
                }

                ch = s[idx];
                result += ch;

                if (/[a-zA-Z]/.test(ch) &&
                    idx + 1 < s.length &&
                    /[a-zA-Z]/.test(s[idx + 1])) {

                    if (insideSubscript(s, idx) ||
                        insideSubscript(s, idx + 1)) {
                        idx++;
                        continue;
                    }

                    if (insidePercentConstant(s, idx) ||
                        insidePercentConstant(s, idx + 1)) {
                        idx++;
                        continue;
                    }

                    nextToken = matchProtectedToken(
                        s, idx + 1, protectedTokens
                    );
                    if (nextToken) {
                        result += '*';
                        idx++;
                        continue;
                    }

                    result += '*';
                }
                idx++;
            }
            s = result;
        }

        s = s.replace(/\*\s*\*/g, '*');
        return s;
    }

    /**
     * Main LaTeX to Maxima conversion.
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
        var k;
        var con;

        s = s.replace(/\s+/g, ' ').trim();
        if (!s) {
            return s;
        }

        s = s.replace(/\\left/g, '');
        s = s.replace(/\\right/g, '');

        // 1. Derivatives BEFORE regular fractions.
        s = processDerivatives(s);

        // 2. \mathrm{} constants and general stripping.
        s = processMathrm(s);

        // 3. Structural fixpoint.
        prev = '';
        while (s !== prev) {
            prev = s;
            s = processSqrt(s);
            s = processFractions(s);
            s = processExponents(s);
            s = processSubscripts(s);
        }

        // 4. Functions.
        s = processAllFunctions(s, defs.functions);

        // 5. Constants.
        var constants = defs.constants || [];
        for (k = 0; k < constants.length; k++) {
            con = constants[k];
            if (con.latex_regex) {
                s = s.replace(
                    new RegExp(con.latex_regex, 'g'),
                    con.maxima
                );
            } else {
                s = s.replace(
                    new RegExp(
                        con.latex.replace(/\\/g, '\\\\'), 'g'
                    ),
                    con.maxima
                );
            }
        }

        // 6. \hbar.
        s = s.replace(/\\hbar(?![a-zA-Z])/g, 'hbar');

        // 7. \partial.
        s = s.replace(/\\partial\s*/g, '');

        // 8. Operators.
        var operators = defs.operators || [];
        for (k = 0; k < operators.length; k++) {
            s = s.replace(
                new RegExp(
                    operators[k].latex.replace(/\\/g, '\\\\'),
                    'g'
                ),
                operators[k].maxima
            );
        }

        // 9. Comparison.
        var comparison = defs.comparison || [];
        for (k = 0; k < comparison.length; k++) {
            if (comparison[k].latex_regex) {
                s = s.replace(
                    new RegExp(comparison[k].latex_regex, 'g'),
                    comparison[k].maxima
                );
            }
        }

        // 10. Set/logic operators.
        var setLogicOps = defs.setLogicOps || [];
        for (k = 0; k < setLogicOps.length; k++) {
            if (setLogicOps[k].latex_regex) {
                s = s.replace(
                    new RegExp(setLogicOps[k].latex_regex, 'g'),
                    setLogicOps[k].maxima
                );
            }
        }

        // 11. Bra-ket.
        s = s.replace(/\\langle\s*/g, '<');
        s = s.replace(/\\rangle\s*/g, '>');
        s = s.replace(/\\middle\s*\|/g, '|');

        // 12. Display-only symbols.
        s = s.replace(/\\forall\s*/g, '');
        s = s.replace(/\\exists\s*/g, '');
        s = s.replace(/\\emptyset/g, '{}');
        s = s.replace(/\\notin/g, ' notin ');
        s = s.replace(/\\subset(?:eq)?/g, ' subset ');

        // 13. Greek variants.
        var greekVariants = defs.greekVariants || {};
        var variantName;
        for (variantName in greekVariants) {
            if (greekVariants.hasOwnProperty(variantName)) {
                s = s.replace(
                    new RegExp(
                        '\\\\' + variantName + '(?![a-zA-Z])',
                        'g'
                    ),
                    greekVariants[variantName]
                );
            }
        }

        // 14. Greek letters.
        var greek = defs.greek || [];
        for (k = 0; k < greek.length; k++) {
            s = s.replace(
                new RegExp(
                    '\\\\' + greek[k] + '(?![a-zA-Z])', 'g'
                ),
                greek[k]
            );
        }

        // 15. Cleanup.
        s = s.replace(/\\ /g, '');
        s = s.replace(/[{}]/g, '');

        if (commaDecimal) {
            s = replaceDecimalCommas(s);
        }

        // 16. Implicit multiplication (LAST).
        s = insertImplicitMultiplication(s, opts);

        s = s.replace(/\*\s*\*/g, '*');
        s = s.replace(/\s+/g, ' ').trim();
        return s;
    }

    return /** @alias module:local_stackmatheditor/tex2max */ {
        convert: convert
    };
});

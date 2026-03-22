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
     * Process derivative fractions.
     *
     * @param {string} s Input.
     * @returns {string} Converted.
     */
    function processDerivatives(s) {
        var dRegex = new RegExp(
            '\\\\frac\\s*\\{\\s*\\\\mathrm\\s*\\{\\s*d\\s*\\}'
            + '\\s*((?:[^{}]|\\{[^{}]*?\\})*?)\\}'
            + '\\s*\\{\\s*\\\\mathrm\\s*\\{\\s*d\\s*\\}'
            + '\\s*((?:[^{}]|\\{[^{}]*?\\})*?)\\}',
            'g'
        );
        s = fixpoint(s, dRegex, 'diff($1,$2)');
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
     * Process \mathrm wrappers.
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
     * Process fractions.
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
     * Process square roots.
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
     * Process exponents.
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
     * Process subscripts.
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
     * Process a single LaTeX function command.
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
            if (afterCmd < s.length &&
                /[a-zA-Z]/.test(s[afterCmd])) {
                result += s.substring(i, idx + 1);
                i = idx + 1;
                continue;
            }
            result += s.substring(i, idx);
            var argStart = afterCmd;
            while (argStart < s.length &&
            s[argStart] === ' ') {
                argStart++;
            }
            if (argStart < s.length &&
                s[argStart] === '{') {
                var braceMatch = s.substring(argStart).match(
                    /^\{((?:[^{}]|\{[^{}]*?\})*?)\}/
                );
                if (braceMatch) {
                    result += maximaName + '('
                        + braceMatch[1] + ')';
                    i = argStart + braceMatch[0].length;
                    continue;
                }
            }
            if (argStart < s.length &&
                s[argStart] === '(') {
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
                    if (depth === 0 &&
                        /[+\-=<>]/.test(ch)) {
                        break;
                    }
                    if (depth === 0 && ch === '/' &&
                        argEnd + 1 < s.length &&
                        s[argEnd + 1] !== '(') {
                        break;
                    }
                    argEnd++;
                }
                var arg = s.substring(
                    argStart, argEnd).trim();
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
     * Replace decimal commas with dots.
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
                /\d/.test(s[i - 1]) &&
                /\d/.test(s[i + 1])) {
                result += '.';
                continue;
            }
            result += s[i];
        }
        return result;
    }

    /**
     * Replace all Greek letter commands in a single pass.
     *
     * A combined regex avoids ordering bugs where replacing
     * \Lambda before \Phi causes \PhiLambda to prevent \Phi
     * from matching (lookahead sees 'L' from 'Lambda').
     *
     * @param {string} s Input string.
     * @param {Object} defs Definitions.
     * @returns {string} With Greek commands replaced.
     */
    function processGreekLetters(s, defs) {
        // 1. Variants (\varepsilon → epsilon, etc.)
        var greekVariants = defs.greekVariants || {};
        var variantNames = Object.keys(greekVariants);
        if (variantNames.length > 0) {
            variantNames.sort(function(a, b) {
                return b.length - a.length;
            });
            var variantPattern = variantNames.join('|');
            s = s.replace(
                new RegExp(
                    '\\\\(' + variantPattern
                    + ')(?![a-zA-Z])',
                    'g'
                ),
                function(match, name) {
                    return greekVariants[name];
                }
            );
        }

        // 2. Standard (\alpha → alpha, \Phi → Phi, etc.)
        var greek = defs.greek || [];
        if (greek.length > 0) {
            var sorted = greek.slice().sort(function(a, b) {
                return b.length - a.length;
            });
            var pattern = sorted.join('|');
            s = s.replace(
                new RegExp(
                    '\\\\(' + pattern + ')(?![a-zA-Z])',
                    'g'
                ),
                '$1'
            );
        }

        return s;
    }

    // ── Implicit multiplication ──

    /**
     * Build sorted protected tokens list.
     *
     * @param {Object} defs Definitions.
     * @returns {string[]} Sorted longest-first.
     */
    function buildProtectedTokens(defs) {
        var tokens = [];
        var seen = {};
        var i;
        var li;

        /**
         * Add token if multi-char and unseen.
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
     * Greedy token matching at position.
     *
     * @param {string} str String.
     * @param {number} pos Position.
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
     * Check if inside subscript.
     *
     * @param {string} str String.
     * @param {number} pos Position.
     * @returns {boolean} True if inside _().
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
     * Check if inside percent constant.
     *
     * @param {string} str String.
     * @param {number} pos Position.
     * @returns {boolean} True if inside %constant.
     */
    function insidePercentConstant(str, pos) {
        var start = Math.max(0, pos - 6);
        var chunk = str.substring(start, pos + 7);
        var pat =
            /%pi|%phi|%gamma|%e(?![a-zA-Z])|%i(?![a-zA-Z])/;
        return pat.test(chunk);
    }

    /**
     * Insert implicit multiplication.
     *
     * Handles three cases in single-char mode:
     * 1. Protected token → protected token: * via token code
     * 2. Single letter → single letter: * via bottom code
     * 3. Protected token → single letter: * via boundary check
     *
     * @param {string} s Input.
     * @param {Object} opts Options.
     * @returns {string} With * inserted.
     */
    function insertImplicitMultiplication(s, opts) {
        var defs = opts.defs || {};
        var varMode = opts.variableMode || 'single';
        var protectedTokens = buildProtectedTokens(defs);
        var unitSymbols = defs.unitSymbols || [];
        var pctPattern =
            /(%pi|%e|%i|%phi|%gamma)\s*([a-zA-Z(])/g;

        s = s.replace(/\)\s*\(/g, ')*(');
        s = s.replace(/\)\s*([a-zA-Z%])/g, ')*$1');
        s = s.replace(/\)\s*(\d)/g, ')*$1');
        s = s.replace(/(\d)\s*\(/g, '$1*(');
        s = s.replace(/(\d)\s*(%)/g, '$1*$2');
        s = s.replace(pctPattern, '$1*$2');

        s = s.replace(
            /(\d)\s*([a-zA-Z]+)/g,
            function(match, digit, letters) {
                if (unitSymbols.indexOf(letters) !== -1) {
                    return digit + letters;
                }
                return digit + '*' + letters;
            }
        );

        if (varMode === 'single') {
            var result = '';
            var idx = 0;
            var ch;
            var lastChar;
            var token;
            var nextToken;

            while (idx < s.length) {
                // Try protected token at current position.
                if (/[a-zA-Z%]/.test(s[idx])) {
                    token = matchProtectedToken(
                        s, idx, protectedTokens
                    );
                    if (token) {
                        // Case 1: Insert * before token
                        // if previous output ends with
                        // letter/digit/paren.
                        if (result.length > 0) {
                            lastChar =
                                result[result.length - 1];
                            if (/[a-zA-Z0-9)]/.test(
                                lastChar)) {
                                result += '*';
                            }
                        }
                        result += token;
                        idx += token.length;
                        continue;
                    }
                }

                ch = s[idx];

                // Case 3: Boundary check —
                // protected token end → single letter.
                // If result ends with a letter and current
                // char is also a letter, insert *.
                if (/[a-zA-Z]/.test(ch) &&
                    result.length > 0 &&
                    /[a-zA-Z]/.test(
                        result[result.length - 1]) &&
                    !insideSubscript(s, idx) &&
                    !insidePercentConstant(s, idx)) {
                    result += '*';
                }

                result += ch;

                // Case 2: Two adjacent single letters.
                if (/[a-zA-Z]/.test(ch) &&
                    idx + 1 < s.length &&
                    /[a-zA-Z]/.test(s[idx + 1])) {

                    if (insideSubscript(s, idx) ||
                        insideSubscript(s, idx + 1)) {
                        idx++;
                        continue;
                    }

                    if (insidePercentConstant(s, idx) ||
                        insidePercentConstant(
                            s, idx + 1)) {
                        idx++;
                        continue;
                    }

                    nextToken = matchProtectedToken(
                        s, idx + 1, protectedTokens
                    );
                    if (nextToken) {
                        // Next is a token — * will be
                        // inserted by Case 1 on next
                        // iteration. Don't double-insert.
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

    // ── Main convert ──

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

        // 1. Derivatives.
        s = processDerivatives(s);

        // 2. \mathrm{} constants.
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
                        con.latex.replace(/\\/g, '\\\\'),
                        'g'
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
                    operators[k].latex.replace(
                        /\\/g, '\\\\'),
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
                    new RegExp(
                        comparison[k].latex_regex, 'g'
                    ),
                    comparison[k].maxima
                );
            }
        }

        // 10. Set/logic operators.
        var setLogicOps = defs.setLogicOps || [];
        for (k = 0; k < setLogicOps.length; k++) {
            if (setLogicOps[k].latex_regex) {
                s = s.replace(
                    new RegExp(
                        setLogicOps[k].latex_regex, 'g'
                    ),
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

        // 13+14. Greek letters (single-pass).
        s = processGreekLetters(s, defs);

        // 15. Cleanup.
        s = s.replace(/\\ /g, '');
        s = s.replace(/[{}]/g, '');

        if (commaDecimal) {
            s = replaceDecimalCommas(s);
        }

        // 15.5. Strip remaining whitespace before
        //       implicit multiplication. After all other
        //       processing, remaining spaces are just
        //       formatting artifacts that would prevent
        //       correct token boundary detection.
        s = s.replace(/\s+/g, '');

        // 16. Implicit multiplication.
        s = insertImplicitMultiplication(s, opts);

        s = s.replace(/\*\s*\*/g, '*');
        s = s.replace(/\s+/g, ' ').trim();
        return s;
    }

    return /** @alias module:local_stackmatheditor/tex2max */ {
        convert: convert
    };
});

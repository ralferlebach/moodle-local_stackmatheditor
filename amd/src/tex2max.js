/**
 * Converts MathQuill LaTeX output to Maxima CAS notation.
 *
 * All function names, units, constants, and operators are read from
 * options.defs (passed from PHP definitions.php via mathquill_init.js).
 *
 * @module     local_stackmatheditor/tex2max
 * @copyright  2026 Your Name
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
define([], function() {
    'use strict';

    /**
     * Apply regex in fixpoint loop until string stops changing.
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
     * Process \frac{...}{...} with lazy quantifiers.
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
     * Process _{...} subscripts.
     *
     * @param {string} s Input.
     * @returns {string} Converted.
     */
    function processSubscripts(s) {
        return fixpoint(s,
            /_\{((?:[^{}]|\{[^{}]*?\})*?)\}/,
            '_$1'
        );
    }

    /**
     * Process a single LaTeX function command to Maxima.
     *
     * @param {string} s Input.
     * @param {string} latexCmd LaTeX command (e.g. '\\sin').
     * @param {string} maximaName Maxima name (e.g. 'sin').
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

            // Case 1: {braces}
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

            // Case 2: already parenthesized
            if (argStart < s.length && s[argStart] === '(') {
                result += maximaName;
                i = afterCmd;
                continue;
            }

            // Case 3: bare argument
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
     * Process all functions defined in defs.
     *
     * @param {string} s Input.
     * @param {Array} funcDefs Function definitions from PHP.
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
     * Insert implicit multiplication — reads units and functions from defs.
     *
     * @param {string} s Input (already in Maxima notation).
     * @param {Object} opts Options with defs and variableMode.
     * @returns {string} Converted.
     */
    function insertImplicitMultiplication(s, opts) {
        var units = (opts.defs && opts.defs.unitSymbols) ? opts.defs.unitSymbols : [];
        var funcNames = (opts.defs && opts.defs.functionNames) ? opts.defs.functionNames : [];
        var varMode = opts.variableMode || 'single';

        /**
         * @param {string} str String to test.
         * @returns {boolean} True if known unit.
         */
        function checkUnit(str) {
            return units.indexOf(str) !== -1;
        }

        /**
         * @param {string} str String to test.
         * @returns {string|null} Matched function name or null.
         */
        function checkFunc(str) {
            var j;
            for (j = 0; j < funcNames.length; j++) {
                if (str.indexOf(funcNames[j]) === 0) {
                    var after = str.charAt(funcNames[j].length);
                    if (!after || !/[a-zA-Z]/.test(after)) {
                        return funcNames[j];
                    }
                }
            }
            return null;
        }

        s = s.replace(/\)\s*\(/g, ')*(');
        s = s.replace(/\)\s*([a-zA-Z%])/g, ')*$1');
        s = s.replace(/\)\s*(\d)/g, ')*$1');
        s = s.replace(/(\d)\s*\(/g, '$1*(');
        s = s.replace(/(\d)\s*(%)/g, '$1*$2');
        s = s.replace(/(%pi|%e)([a-zA-Z(])/g, '$1*$2');

        // digit + letters
        s = s.replace(/(\d)\s*([a-zA-Z]+)/g, function(match, digit, letters) {
            if (checkUnit(letters)) {
                return digit + letters;
            }
            return digit + '*' + letters;
        });

        // Single-char mode: split consecutive letters
        if (varMode === 'single') {
            var result = '';
            var idx = 0;
            while (idx < s.length) {
                result += s[idx];
                if (/[a-zA-Z]/.test(s[idx]) && idx + 1 < s.length && /[a-zA-Z]/.test(s[idx + 1])) {
                    var remaining = s.substring(idx);
                    var fn = checkFunc(remaining);
                    var wordMatch = remaining.match(/^([a-zA-Z]+)/);
                    var word = wordMatch ? wordMatch[1] : '';

                    if (fn && fn.length > 1 && remaining.indexOf(fn) === 0) {
                        result += s.substring(idx + 1, idx + fn.length);
                        idx = idx + fn.length;
                        continue;
                    }
                    if (word && checkUnit(word)) {
                        result += s.substring(idx + 1, idx + word.length);
                        idx = idx + word.length;
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

        s = s.replace(/\\left/g, '');
        s = s.replace(/\\right/g, '');

        // Structural: fixpoint loop
        prev = '';
        while (s !== prev) {
            prev = s;
            s = processSqrt(s);
            s = processFractions(s);
            s = processExponents(s);
            s = processSubscripts(s);
        }

        // Functions from definitions
        s = processAllFunctions(s, defs.functions);

        // Constants from definitions
        var constants = defs.constants || [];
        var c;
        for (c = 0; c < constants.length; c++) {
            var con = constants[c];
            if (con.latex_regex) {
                s = s.replace(new RegExp(con.latex_regex, 'g'), con.maxima);
            } else {
                s = s.replace(new RegExp(con.latex.replace(/\\/g, '\\\\'), 'g'), con.maxima);
            }
        }

        // Operators from definitions
        var operators = defs.operators || [];
        var o;
        for (o = 0; o < operators.length; o++) {
            s = s.replace(
                new RegExp(operators[o].latex.replace(/\\/g, '\\\\'), 'g'),
                operators[o].maxima
            );
        }

        // Comparison from definitions
        var comparison = defs.comparison || [];
        var cmp;
        for (cmp = 0; cmp < comparison.length; cmp++) {
            if (comparison[cmp].latex_regex) {
                s = s.replace(new RegExp(comparison[cmp].latex_regex, 'g'), comparison[cmp].maxima);
            }
        }

        // Greek letters from definitions
        var greek = defs.greek || [];
        var g;
        for (g = 0; g < greek.length; g++) {
            s = s.replace(
                new RegExp('\\\\' + greek[g] + '(?![a-zA-Z])', 'g'),
                greek[g]
            );
        }

        // Cleanup
        s = s.replace(/\\ /g, '');
        s = s.replace(/[{}]/g, '');

        if (commaDecimal) {
            s = replaceDecimalCommas(s);
        }

        s = insertImplicitMultiplication(s, opts);
        s = s.replace(/\*\s*\*/g, '*');
        s = s.replace(/\s+/g, ' ').trim();

        return s;
    }

    return /** @alias module:local_stackmatheditor/tex2max */ {
        convert: convert
    };
});

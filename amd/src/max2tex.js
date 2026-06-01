// This file is part of Moodle - https://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <https://www.gnu.org/licenses/>.


/**
 * Converts Maxima CAS notation back to LaTeX for MathQuill display.
 *
 * @module     local_stackmatheditor/max2tex
 * @package
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
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
     * Find matching opening paren (backwards).
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
     * Convert mixed-fraction form (N+p/q) → N\frac{p}{q}.
     *
     * This reverses the tex2max mixed-fraction guard that converts
     * N\frac{p}{q} → (N+p/q) to prevent implicit multiplication.
     * Must run before processFractions() to avoid the parentheses
     * being consumed by the fraction converter.
     *
     * @param {string} s Input.
     * @returns {string} Converted.
     */
    function processMixedFractions(s) {
        // Pattern: (N+p/q) where N, p, q are bare non-negative integers.
        return s.replace(
            /\((\d+)\+(\d+)\/(\d+)\)/g,
            '$1\\frac{$2}{$3}'
        );
    }

    /**
     * Convert set-theory Maxima keywords to LaTeX commands.
     *
     * notin must be handled before in to avoid partial matching.
     *
     * @param {string} s Input.
     * @returns {string} Converted.
     */
    function processSetTheoryKeywords(s) {
        s = s.replace(/\bnotin\b/g, '\\notin ');
        s = s.replace(/\bin\b/g, '\\in ');
        s = s.replace(/\bunion\b/g, '\\cup ');
        s = s.replace(/\bintersect\b/g, '\\cap ');
        s = s.replace(/\bsetdiff\b/g, '\\setminus ');
        s = s.replace(/\bsubset\b/g, '\\subset ');
        s = s.replace(/\bsuperset\b/g, '\\supset ');
        return s;
    }

    /**
     * Convert logic Maxima keywords to LaTeX commands.
     *
     * nexists must be handled before exists to avoid partial matching.
     * impliedby must be handled before implies.
     *
     * @param {string} s Input.
     * @returns {string} Converted.
     */
    function processLogicKeywords(s) {
        s = s.replace(/\bnexists\b/g, '\\nexists ');
        s = s.replace(/\bforall\b/g, '\\forall ');
        s = s.replace(/\bexists\b/g, '\\exists ');
        s = s.replace(/\bnot\b/g, '\\neg ');
        s = s.replace(/\band\b/g, '\\land ');
        s = s.replace(/\bor\b/g, '\\lor ');
        s = s.replace(/\bimpliedby\b/g, '\\Leftarrow ');
        s = s.replace(/\bimplies\b/g, '\\Rightarrow ');
        s = s.replace(/\biff\b/g, '\\Leftrightarrow ');
        return s;
    }

    /**
     * Convert (a)/(b) -> \frac{a}{b}.
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
     * Convert funcname(arg) to LaTeX.
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
     * Convert n-th roots: (expr)^(1/(n)) -> \sqrt[n]{expr}.
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
     * Convert ^(expr) -> ^{expr}.
     *
     * @param {string} s Input.
     * @returns {string} Converted.
     */
    function processExponents(s) {
        return fixpoint(s, /\^\(([^()]*?)\)/, '^{$1}');
    }

    /**
     * Convert subscripts: _(abc) -> _{abc}, _x -> _{x}.
     *
     * @param {string} s Input.
     * @returns {string} Converted.
     */
    function processSubscripts(s) {
        // First: _(content) -> _{content}.
        s = fixpoint(s, /_\(([^()]*?)\)/, '_{$1}');
        // Then: _x (single char not already in braces) -> _{x}.
        s = s.replace(/_([a-zA-Z0-9])(?!\{)(?!\()/g, '_{$1}');
        return s;
    }

    /**
     * Clean multiplication signs for LaTeX display.
     *
     * @param {string} s Input.
     * @returns {string} Converted.
     */
    function cleanMultiplication(s) {
        // Digit * letter — juxtapose (no explicit operator).
        s = s.replace(/(\d)\s*\*\s*([a-zA-Z\\])/g, '$1$2');
        // Letter * letter — use \cdot.
        s = s.replace(/([a-zA-Z)\]])\s*\*\s*([a-zA-Z\\(])/g, '$1\\cdot $2');
        // Remaining * — use \cdot.
        s = s.replace(/\*/g, '\\cdot ');
        return s;
    }

    /**
     * Attempt to collapse a Maxima " or " expression back into a
     * single LaTeX expression using \pm and \mp.
     *
     * Handles two cases:
     * 1. Symmetric: v1 and v2 have equal length and differ only in +/-.
     * 2. Asymmetric: v1 is shorter by exactly one character because
     *    tex2max stripped a leading unary '+' from the positive variant.
     *    In this case a synthetic '+' is re-inserted at the divergence
     *    point before doing the character-by-character comparison.
     *
     * Works on the final LaTeX output of convert(). Both sides of
     * " or " must be equal length (after normalisation) and differ
     * only in "+" vs "-" positions.  Where variant 1 has "+" and
     * variant 2 has "-", the result gets \pm; where variant 1 has
     * "-" and variant 2 has "+", the result gets \mp.
     *
     * @param {string} s Converted string that may contain " or ".
     * @returns {string} Collapsed string or unmodified input.
     */
    function collapsePlusMinus(s) {
        var orIdx = s.indexOf(' or ');
        if (orIdx === -1) {
            return s;
        }

        var v1 = s.substring(0, orIdx);
        var v2 = s.substring(orIdx + 4);

        // Only handle exactly two variants.
        if (v2.indexOf(' or ') !== -1) {
            return s;
        }

        // Handle asymmetric case: v1 is shorter by 1 because a leading
        // unary '+' was stripped by tex2max's expandPlusMinus fix.
        if (v1.length + 1 === v2.length) {
            // Find the first position where v1 and v2 diverge.
            var di = 0;
            while (di < v1.length && v1[di] === v2[di]) {
                di++;
            }
            // If v2[di] is '-' and the preceding character is a valid
            // unary-prefix boundary (=, (, start of string), restore '+'.
            if (di < v2.length && v2[di] === '-') {
                var before = di > 0 ? v2[di - 1] : '';
                if (!before || /[=(]/.test(before)) {
                    v1 = v1.substring(0, di) + '+' + v1.substring(di);
                }
            }
        }

        // Both sides must have equal length for character comparison.
        if (v1.length !== v2.length) {
            return s;
        }

        var result = '';
        var hasPm = false;
        var i;

        for (i = 0; i < v1.length; i++) {
            if (v1[i] === v2[i]) {
                result += v1[i];
            } else if (v1[i] === '+' && v2[i] === '-') {
                result += '\\pm ';
                hasPm = true;
            } else if (v1[i] === '-' && v2[i] === '+') {
                result += '\\mp ';
                hasPm = true;
            } else {
                // Non +/- difference — cannot collapse.
                return s;
            }
        }

        if (!hasPm) {
            return s;
        }
        return result.replace(/\s+/g, ' ').trim();
    }


    /**
     * Strip one level of enclosing parentheses if they wrap the whole string.
     *
     * @param {string} s Input.
     * @returns {string} Trimmed string.
     */
    function stripEnclosingParens(s) {
        var trimmed = s.trim();
        var changed = true;

        while (changed && trimmed.charAt(0) === '(' && trimmed.charAt(trimmed.length - 1) === ')') {
            changed = false;
            if (findCloseParen(trimmed, 0) === trimmed.length - 1) {
                trimmed = trimmed.substring(1, trimmed.length - 1).trim();
                changed = true;
            }
        }

        return trimmed;
    }

    /**
     * Split an expression by a top-level keyword.
     *
     * @param {string} s Input.
     * @param {string} keyword Keyword to split by.
     * @returns {Array} Parts.
     */
    function splitTopLevelKeyword(s, keyword) {
        var parts = [];
        var depth = 0;
        var start = 0;
        var i;
        var before;
        var after;
        var boundaryBefore;
        var boundaryAfter;

        for (i = 0; i < s.length; i++) {
            if (s.charAt(i) === '(') {
                depth++;
                continue;
            }
            if (s.charAt(i) === ')') {
                depth--;
                continue;
            }
            if (depth !== 0) {
                continue;
            }
            if (s.substring(i, i + keyword.length) !== keyword) {
                continue;
            }

            before = i > 0 ? s.charAt(i - 1) : ' ';
            after = i + keyword.length < s.length ? s.charAt(i + keyword.length) : ' ';
            boundaryBefore = /\s|\(/.test(before);
            boundaryAfter = /\s|\)/.test(after);

            if (!boundaryBefore || !boundaryAfter) {
                continue;
            }

            parts.push(s.substring(start, i).trim());
            start = i + keyword.length;
            i = start - 1;
        }

        parts.push(s.substring(start).trim());
        return parts;
    }

    /**
     * Find a top-level relation operator.
     *
     * @param {string} s Input.
     * @returns {?Object} Relation parts or null.
     */
    function parseTopLevelRelation(s) {
        var operators = ['<=', '>=', '~=', '#', '=', '<', '>'];
        var depth = 0;
        var i;
        var op;
        var oi;

        for (i = 0; i < s.length; i++) {
            if (s.charAt(i) === '(') {
                depth++;
                continue;
            }
            if (s.charAt(i) === ')') {
                depth--;
                continue;
            }
            if (depth !== 0) {
                continue;
            }
            for (oi = 0; oi < operators.length; oi++) {
                op = operators[oi];
                if (s.substring(i, i + op.length) === op) {
                    return {
                        lhs: s.substring(0, i).trim(),
                        operator: op,
                        rhs: s.substring(i + op.length).trim()
                    };
                }
            }
        }

        return null;
    }

    /**
     * Convert top-level and-connected relations to a LaTeX cases environment.
     *
     * @param {string} s Maxima input.
     * @returns {string} Cases environment or original input.
     */
    function convertRelationSystemToCases(s) {
        var normalized = stripEnclosingParens(s);
        var parts = splitTopLevelKeyword(normalized, 'and');
        var rows = [];
        var i;
        var relation;

        if (parts.length < 2) {
            return s;
        }

        for (i = 0; i < parts.length; i++) {
            parts[i] = stripEnclosingParens(parts[i]);
            relation = parseTopLevelRelation(parts[i]);
            if (!relation || !relation.lhs || !relation.rhs) {
                return s;
            }
            rows.push('{' + relation.lhs + ' &' + relation.operator + ' ' + relation.rhs + '}');
        }

        return '\\begin{cases} ' + rows.join(' \\\\ ') + ' \\end{cases}';
    }

    /**
     * Main Maxima -> LaTeX conversion.
     *
     * @param {string} maxima Maxima expression.
     * @param {Object} [options] Options.
     * @returns {string} LaTeX.
     */

    /**
     * Apply %-constant definitions from defs to a Maxima string.
     *
     * @param {string} s         Maxima expression.
     * @param {Array}  constants Constants array from defs.
     * @returns {string} String with constants replaced.
     */
    function processConstantsList(s, constants) {
        var k, con, conMaxima;
        for (k = 0; k < constants.length; k++) {
            con = constants[k];
            conMaxima = null;

            if (con && typeof con === 'object') {
                conMaxima = con.maxima || con.name || null;
            } else if (typeof con === 'string') {
                if (con === 'pi') {
                    conMaxima = '%pi';
                } else if (con === 'e') {
                    conMaxima = '%e';
                } else if (con === 'i') {
                    conMaxima = '%i';
                } else {
                    conMaxima = con;
                }
            }

            if (conMaxima === '%pi' || conMaxima === 'pi') {
                s = s.replace(/%pi/g, '\\pi ');
                s = s.replace(/\bpi\b/g, '\\pi ');
            } else if (conMaxima === 'inf') {
                s = s.replace(/\binf\b/g, '\\infty ');
            } else if (conMaxima === 'minf') {
                s = s.replace(/\bminf\b/g, '-\\infty ');
            } else if (conMaxima === '%e' || conMaxima === 'e') {
                s = s.replace(/%e(?![a-zA-Z])/g, '\\mathrm{e}');
            } else if (conMaxima === '%i' || conMaxima === 'i') {
                s = s.replace(/%i(?![a-zA-Z])/g, '\\mathrm{i}');
            }
        }
        return s;
    }

    /**
     * Apply comparison operator definitions from defs to a Maxima string.
     *
     * @param {string} s          Maxima expression.
     * @param {Array}  comparison Comparison array from defs.
     * @returns {string} String with comparisons replaced.
     */
    function processComparisonList(s, comparison) {
        var k, cmpItem;
        for (k = 0; k < comparison.length; k++) {
            cmpItem = comparison[k];
            if (!cmpItem || typeof cmpItem !== 'object' || !cmpItem.maxima) {
                continue;
            }
            s = s.replace(
                new RegExp(cmpItem.maxima.replace(/([<>=#])/g, '\\$1'), 'g'),
                cmpItem.latex_write || cmpItem.maxima
            );
        }
        return s;
    }

    /**
     * Replace abs(expr) with \left|expr\right|.
     *
     * @param {string} s Maxima expression.
     * @returns {string} String with abs() replaced.
     */
    function processAbsFunction(s) {
        var absSearch = 'abs(';
        var absResult = '';
        var absI = 0;
        var absIdx, absOpen, absClose, absArg;
        var safety = 50;
        while (absI < s.length && safety > 0) {
            safety--;
            absIdx = s.indexOf(absSearch, absI);
            if (absIdx === -1) {
                absResult += s.substring(absI);
                break;
            }
            if (absIdx > 0 && /[a-zA-Z0-9_]/.test(s[absIdx - 1])) {
                absResult += s.substring(absI, absIdx + 1);
                absI = absIdx + 1;
                continue;
            }
            absResult += s.substring(absI, absIdx);
            absOpen = absIdx + 3;
            absClose = findCloseParen(s, absOpen);
            if (absClose === -1) {
                absResult += s.substring(absIdx);
                absI = s.length;
                break;
            }
            absArg = s.substring(absOpen + 1, absClose);
            absResult += '\\left|' + absArg + '\\right|';
            absI = absClose + 1;
        }
        return absResult;
    }

    /**
     * Apply the hardcoded standard function list to a Maxima string.
     *
     * @param {string} s Maxima expression.
     * @returns {string} String with standard functions replaced.
     */
    function processStdFunctions(s) {
        var fi, sf;
        var stdFuncs = [
            ['sqrt', '\\sqrt', 'brace'],
            ['sin', '\\sin', 'paren'],
            ['cos', '\\cos', 'paren'],
            ['tan', '\\tan', 'paren'],
            ['arcsin', '\\arcsin', 'paren'],
            ['arccos', '\\arccos', 'paren'],
            ['arctan', '\\arctan', 'paren'],
            ['sinh', '\\sinh', 'paren'],
            ['cosh', '\\cosh', 'paren'],
            ['tanh', '\\tanh', 'paren'],
            ['exp', '\\exp', 'paren'],
            ['log', '\\ln', 'paren'],
            ['abs', '\\left|', 'abs']
        ];
        for (fi = 0; fi < stdFuncs.length; fi++) {
            sf = stdFuncs[fi];
            if (s.indexOf(sf[0] + '(') >= 0) {
                s = processFunc(s, sf[0], sf[1], sf[2]);
            }
        }
        return s;
    }


    /**
     * Apply function definitions from defs to convert named functions to LaTeX.
     *
     * @param {string} s        Maxima expression.
     * @param {Array}  funcDefs Function definitions array from defs.
     * @returns {string} String with named functions replaced.
     */
    function processFunctionDefsList(s, funcDefs) {
        var k, def, wrapType;
        for (k = 0; k < funcDefs.length; k++) {
            def = funcDefs[k];
            if (!def || typeof def !== 'object' || !def.maxima_name || !def.latex_cmd) {
                continue;
            }
            wrapType = def.type === 'brace' ? 'brace' : 'paren';
            s = processFunc(s, def.maxima_name, def.latex_cmd, wrapType);
        }
        return s;
    }

    /**
     * Replace upper-case Greek letter names with LaTeX commands (fallback pass).
     *
     * @param {string} s Maxima expression.
     * @returns {string} String with upper-case Greek letters replaced.
     */
    function processUpperGreekList(s) {
        var ug, ugl;
        var upperGreek = [
            'Gamma', 'Delta', 'Theta', 'Lambda',
            'Xi', 'Pi', 'Sigma', 'Upsilon',
            'Phi', 'Psi', 'Omega'
        ];
        for (ug = 0; ug < upperGreek.length; ug++) {
            ugl = upperGreek[ug];
            s = s.replace(
                new RegExp('(?<![a-zA-Z\\\\])' + ugl + '(?![a-zA-Z])', 'g'),
                '\\' + ugl + ' '
            );
        }
        return s;
    }

    /**
     * Replace Greek letter names from defs with LaTeX commands.
     * Sorts longest-first to prevent prefix matches (e.g. "e" inside "epsilon").
     *
     * @param {string} s     Maxima expression.
     * @param {Array}  greek Greek letters array from defs.
     * @returns {string} String with Greek letters replaced.
     */
    function processGreekLettersList(s, greek) {
        var k;
        var sorted = greek.slice().sort(function(a, b) {
            return b.length - a.length;
        });
        for (k = 0; k < sorted.length; k++) {
            if (typeof sorted[k] !== 'string' || !sorted[k]) {
                continue;
            }
            s = s.replace(
                new RegExp('(?<![a-zA-Z\\\\])' + sorted[k] + '(?![a-zA-Z])', 'g'),
                '\\' + sorted[k] + ' '
            );
        }
        return s;
    }

    /**
     * Convert a Maxima expression string to LaTeX.
     *
     * @param {string} maxima  Maxima expression.
     * @param {Object} options Conversion options (defs, commaDecimal).
     * @returns {string} LaTeX string.
     */
    function convert(maxima, options) {
        var opts = options || {};
        var commaDecimal = opts.commaDecimal || false;
        var defs = opts.defs || {};
        var s = convertRelationSystemToCases(maxima.trim());
        var prev;

        if (!s) {
            return s;
        }

        // Mixed fractions BEFORE fraction processing (order matters).
        s = processMixedFractions(s);

        // Set-theory and logic keywords BEFORE multiplication cleaning.
        s = processSetTheoryKeywords(s);
        s = processLogicKeywords(s);

        // %-constants -> LaTeX (BEFORE Greek letter replacement).
        s = processConstantsList(s, defs.constants || []);

        // Additional %-constants not in the constants list.
        s = s.replace(/%i(?![a-zA-Z])/g, '\\mathrm{i}');

        // ── Hardcoded constant fallbacks ────────────
        if (s.indexOf('%pi') >= 0) {
            s = s.replace(/%pi/g, '\\pi ');
        }
        // Bare "pi" → \pi (after logic keyword processing, "pi" no longer matches "implies" etc.).
        s = s.replace(/\bpi\b/g, '\\pi ');
        if (s.indexOf('inf') >= 0) {
            s = s.replace(/\bminf\b/g, '-\\infty ');
            s = s.replace(/\binf\b/g, '\\infty ');
        }
        if (s.indexOf('%e') >= 0) {
            s = s.replace(/%e(?![a-zA-Z])/g, '\\mathrm{e}');
        }

        // ── Comparison fallbacks ────────────────────
        s = s.replace(/<=/g, '\\leq ');
        s = s.replace(/>=/g, '\\geq ');
        s = s.replace(/#/g, '\\neq ');
        s = s.replace(/~=/g, '\\approx ');

        s = s.replace(/%phi(?![a-zA-Z])/g, '\\phi ');
        s = s.replace(/%gamma(?![a-zA-Z])/g, '\\gamma ');
        s = s.replace(/\bminf\b/g, '-\\infty ');

        // Comparison -> LaTeX.
        s = processComparisonList(s, defs.comparison || []);

        // Functions -> LaTeX.
        s = processFunctionDefsList(s, defs.functions || []);

        // Binomial: binomial(n,k) -> \binom{n}{k}.
        s = s.replace(
            /\bbinomial\(([^,()]+),([^,()]+)\)/g,
            '\\binom{$1}{$2}'
        );

        // Upper Greek fallback (if not handled by defs).
        s = processUpperGreekList(s);

        // ── Absolute value: abs(expr) -> \left|expr\right| ──
        s = processAbsFunction(s);

        // ── Hardcoded function fallbacks ────────────
        s = processStdFunctions(s);

        // Fractions.
        prev = '';
        while (s !== prev) {
            prev = s;
            s = processFractions(s);
        }

        // N-th roots.
        prev = '';
        while (s !== prev) {
            prev = s;
            s = processNthRoots(s);
        }

        // Exponents.
        prev = '';
        while (s !== prev) {
            prev = s;
            s = processExponents(s);
        }

        // Subscripts.
        s = processSubscripts(s);

        // Greek letters: word -> \word.
        s = processGreekLettersList(s, defs.greek || []);

        // Multiplication signs.
        s = cleanMultiplication(s);

        // Decimal separator.
        if (commaDecimal) {
            s = s.replace(/(\d)\.(\d)/g, '$1,$2');
        }

        s = s.replace(/\s+/g, ' ').trim();
        s = collapsePlusMinus(s);
        return s;
    }

    /**
     * Detect whether a string is Maxima notation (vs LaTeX).
     *
     * @param {string} s String to check.
     * @returns {boolean} True if Maxima.
     */
    function isMaxima(s) {
        if (!s || !s.trim()) {
            return false;
        }
        // LaTeX indicators.
        if (/\\frac|\\sqrt|\\sin|\\cos|\\pi|\\left|\\pm|\\mp/.test(s)) {
            return false;
        }
        // Maxima indicators.
        if (/%pi|%e|sqrt\(|log\(|\)\/\(/.test(s)) {
            return true;
        }
        // No backslashes -> probably Maxima.
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

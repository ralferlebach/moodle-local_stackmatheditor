/**
 * Converts MathQuill LaTeX output to Maxima CAS notation.
 *
 * @module local_stackmatheditor/tex2max
 */
define([], function() {
    'use strict';

    /**
     * Main conversion function.
     * @param {string} latex
     * @returns {string} Maxima expression
     */
    function convert(latex) {
        var s = latex;

        // Normalise whitespace.
        s = s.replace(/\s+/g, ' ').trim();

        // Remove \left / \right.
        s = s.replace(/\\left/g, '');
        s = s.replace(/\\right/g, '');

        // n-th root before square root: \sqrt[n]{expr} -> (expr)^(1/(n))
        s = s.replace(
            /\\sqrt\[([^\]]+)\]\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g,
            '($2)^(1/($1))'
        );

        // Fractions (loop for nesting).
        var maxIter = 20;
        while (s.indexOf('\\frac') !== -1 && maxIter-- > 0) {
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
            'sin','cos','tan','cot','sec','csc',
            'arcsin','arccos','arctan',
            'sinh','cosh','tanh'
        ];
        funcs.forEach(function(fn) {
            s = s.replace(new RegExp('\\\\' + fn + '(?![a-zA-Z])', 'g'), fn);
        });

        // Logarithms.
        s = s.replace(/\\ln(?![a-zA-Z])/g,  'log');
        s = s.replace(/\\log(?![a-zA-Z])/g, 'log');
        s = s.replace(/\\exp(?![a-zA-Z])/g, 'exp');

        // Constants.
        s = s.replace(/\\pi/g,    '%pi');
        s = s.replace(/\\infty/g, 'inf');
        s = s.replace(/\\e(?![a-zA-Z])/g, '%e');

        // Operators.
        s = s.replace(/\\cdot/g,  '*');
        s = s.replace(/\\times/g, '*');
        s = s.replace(/\\div/g,   '/');

        // Comparison.
        s = s.replace(/\\leq?/g,        '<=');
        s = s.replace(/\\geq?/g,        '>=');
        s = s.replace(/\\neq?/g,        '#');
        s = s.replace(/\\ne(?![a-zA-Z])/g, '#');

        // Greek letters.
        var greek = [
            'alpha','beta','gamma','delta','epsilon','zeta','eta',
            'theta','iota','kappa','lambda','mu','nu','xi',
            'rho','sigma','tau','upsilon','phi','chi','psi','omega'
        ];
        greek.forEach(function(letter) {
            s = s.replace(new RegExp('\\\\' + letter + '(?![a-zA-Z])', 'g'), letter);
        });

        // Cleanup.
        s = s.replace(/\\ /g, '');
        s = s.trim();

        return s;
    }

    return {
        convert: convert
    };
});

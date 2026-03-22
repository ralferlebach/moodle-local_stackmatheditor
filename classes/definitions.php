<?php
namespace local_stackmatheditor;

defined('MOODLE_INTERNAL') || die();

/**
 * Central definitions for all math elements, functions, units, and mappings.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Ralf Erlebach
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class definitions {

    const VAR_SINGLE = 'single';
    const VAR_MULTI = 'multi';

    /**
     * Returns all element groups with their toolbar buttons.
     *
     * @return array
     */
    public static function get_element_groups(): array {
        return [
            'fractions' => [
                'langkey' => 'group_fractions',
                'default_enabled' => true,
                'elements' => [
                    ['label' => '\\frac{a}{b}', 'write' => '\\frac{}{}', 'display' => 'a/b'],
                ],
            ],
            'powers' => [
                'langkey' => 'group_powers',
                'default_enabled' => true,
                'elements' => [
                    ['label' => 'x^n', 'write' => '^{}', 'display' => "x\u{207F}"],
                ],
            ],
            'roots' => [
                'langkey' => 'group_roots',
                'default_enabled' => true,
                'elements' => [
                    ['label' => "\u{221A}x", 'write' => '\\sqrt{}', 'display' => "\u{221A}"],
                    ['label' => "\u{221B}x", 'write' => '\\sqrt[3]{}', 'display' => "\u{221B}"],
                    ['label' => "n\u{221A}x", 'write' => '\\sqrt[]{}', 'display' => "n\u{221A}"],
                ],
            ],
            'trigonometry' => [
                'langkey' => 'group_trigonometry',
                'default_enabled' => true,
                'elements' => [
                    ['label' => 'sin', 'cmd' => '\\sin'],
                    ['label' => 'cos', 'cmd' => '\\cos'],
                    ['label' => 'tan', 'cmd' => '\\tan'],
                    ['label' => 'asin', 'cmd' => '\\arcsin'],
                    ['label' => 'acos', 'cmd' => '\\arccos'],
                    ['label' => 'atan', 'cmd' => '\\arctan'],
                ],
            ],
            'hyperbolic' => [
                'langkey' => 'group_hyperbolic',
                'default_enabled' => true,
                'elements' => [
                    ['label' => 'sinh', 'cmd' => '\\sinh'],
                    ['label' => 'cosh', 'cmd' => '\\cosh'],
                    ['label' => 'tanh', 'cmd' => '\\tanh'],
                ],
            ],
            'logarithms' => [
                'langkey' => 'group_logarithms',
                'default_enabled' => true,
                'elements' => [
                    ['label' => 'ln', 'cmd' => '\\ln'],
                    ['label' => 'log', 'cmd' => '\\log'],
                    ['label' => 'exp', 'cmd' => '\\exp'],
                ],
            ],
            'constants' => [
                'langkey' => 'group_constants',
                'default_enabled' => true,
                'elements' => [
                    ['label' => "\u{03C0}", 'cmd' => '\\pi'],
                    ['label' => 'e', 'write' => 'e'],
                    ['label' => "\u{221E}", 'cmd' => '\\infty'],
                    ['label' => "\u{00EE}", 'write' => '\\hat{\\imath}', 'display' => "\u{00EE}"],
                ],
            ],
            'comparison' => [
                'langkey' => 'group_comparison',
                'default_enabled' => true,
                'elements' => [
                    ['label' => "\u{2264}", 'cmd' => '\\le'],
                    ['label' => "\u{2265}", 'cmd' => '\\ge'],
                    ['label' => "\u{2260}", 'cmd' => '\\ne'],
                    ['label' => '=', 'write' => '='],
                ],
            ],
            'parentheses' => [
                'langkey' => 'group_parentheses',
                'default_enabled' => true,
                'elements' => [
                    ['label' => '( )', 'write' => '\\left(\\right)'],
                    ['label' => '[ ]', 'write' => '\\left[\\right]'],
                    ['label' => '| |', 'write' => '\\left|\\right|'],
                ],
            ],
            'calculus' => [
                'langkey' => 'group_calculus',
                'default_enabled' => true,
                'elements' => [
                    ['label' => "\u{222B}", 'write' => '\\int_{}^{}'],
                    ['label' => "\u{03A3}", 'write' => '\\sum_{}^{}'],
                    ['label' => "\u{03A0}", 'write' => '\\prod_{}^{}'],
                    ['label' => 'lim', 'write' => '\\lim_{}'],
                ],
            ],
            'greek_lower' => [
                'langkey' => 'group_greek_lower',
                'default_enabled' => true,
                'elements' => [
                    ['label' => "\u{03B1}", 'cmd' => '\\alpha'],
                    ['label' => "\u{03B2}", 'cmd' => '\\beta'],
                    ['label' => "\u{03B3}", 'cmd' => '\\gamma'],
                    ['label' => "\u{03B4}", 'cmd' => '\\delta'],
                    ['label' => "\u{03B5}", 'cmd' => '\\epsilon'],
                    ['label' => "\u{03B6}", 'cmd' => '\\zeta'],
                    ['label' => "\u{03B7}", 'cmd' => '\\eta'],
                    ['label' => "\u{03B8}", 'cmd' => '\\theta'],
                    ['label' => "\u{03BB}", 'cmd' => '\\lambda'],
                    ['label' => "\u{03BC}", 'cmd' => '\\mu'],
                    ['label' => "\u{03BD}", 'cmd' => '\\nu'],
                    ['label' => "\u{03BE}", 'cmd' => '\\xi'],
                    ['label' => "\u{03C1}", 'cmd' => '\\rho'],
                    ['label' => "\u{03C3}", 'cmd' => '\\sigma'],
                    ['label' => "\u{03C4}", 'cmd' => '\\tau'],
                    ['label' => "\u{03C6}", 'cmd' => '\\phi'],
                    ['label' => "\u{03C7}", 'cmd' => '\\chi'],
                    ['label' => "\u{03C8}", 'cmd' => '\\psi'],
                    ['label' => "\u{03C9}", 'cmd' => '\\omega'],
                ],
            ],
            'greek_upper' => [
                'langkey' => 'group_greek_upper',
                'default_enabled' => true,
                'elements' => [
                    ['label' => "\u{0393}", 'cmd' => '\\Gamma'],
                    ['label' => "\u{0394}", 'cmd' => '\\Delta'],
                    ['label' => "\u{0398}", 'cmd' => '\\Theta'],
                    ['label' => "\u{039B}", 'cmd' => '\\Lambda'],
                    ['label' => "\u{039E}", 'cmd' => '\\Xi'],
                    ['label' => "\u{03A0}", 'cmd' => '\\Pi'],
                    ['label' => "\u{03A3}", 'cmd' => '\\Sigma'],
                    ['label' => "\u{03A5}", 'cmd' => '\\Upsilon'],
                    ['label' => "\u{03A6}", 'cmd' => '\\Phi'],
                    ['label' => "\u{03A8}", 'cmd' => '\\Psi'],
                    ['label' => "\u{03A9}", 'cmd' => '\\Omega'],
                ],
            ],
            'matrices' => [
                'langkey' => 'group_matrices',
                'default_enabled' => true,
                'elements' => [],
            ],
        ];
    }

    /**
     * Returns function mappings for LaTeX <-> Maxima conversion.
     *
     * @return array
     */
    public static function get_functions(): array {
        return [
            ['latex_cmd' => '\\arcsin', 'maxima_name' => 'arcsin', 'type' => 'paren'],
            ['latex_cmd' => '\\arccos', 'maxima_name' => 'arccos', 'type' => 'paren'],
            ['latex_cmd' => '\\arctan', 'maxima_name' => 'arctan', 'type' => 'paren'],
            ['latex_cmd' => '\\sinh', 'maxima_name' => 'sinh', 'type' => 'paren'],
            ['latex_cmd' => '\\cosh', 'maxima_name' => 'cosh', 'type' => 'paren'],
            ['latex_cmd' => '\\tanh', 'maxima_name' => 'tanh', 'type' => 'paren'],
            ['latex_cmd' => '\\sin', 'maxima_name' => 'sin', 'type' => 'paren'],
            ['latex_cmd' => '\\cos', 'maxima_name' => 'cos', 'type' => 'paren'],
            ['latex_cmd' => '\\tan', 'maxima_name' => 'tan', 'type' => 'paren'],
            ['latex_cmd' => '\\cot', 'maxima_name' => 'cot', 'type' => 'paren'],
            ['latex_cmd' => '\\sec', 'maxima_name' => 'sec', 'type' => 'paren'],
            ['latex_cmd' => '\\csc', 'maxima_name' => 'csc', 'type' => 'paren'],
            ['latex_cmd' => '\\ln',  'maxima_name' => 'log', 'type' => 'paren'],
            ['latex_cmd' => '\\log', 'maxima_name' => 'log', 'type' => 'paren'],
            ['latex_cmd' => '\\exp', 'maxima_name' => 'exp', 'type' => 'paren'],
            ['latex_cmd' => '\\sqrt', 'maxima_name' => 'sqrt', 'type' => 'brace'],
            ['latex_cmd' => '\\abs', 'maxima_name' => 'abs', 'type' => 'paren'],
        ];
    }

    /**
     * Returns constant mappings for LaTeX <-> Maxima conversion.
     *
     * @return array
     */
    public static function get_constants(): array {
        return [
            ['latex' => '\\pi',    'maxima' => '%pi',  'display' => "\u{03C0}"],
            ['latex' => '\\infty', 'maxima' => 'inf',  'display' => "\u{221E}"],
            ['latex' => '\\e',     'maxima' => '%e',   'display' => 'e',
                'latex_regex' => '\\\\e(?![a-zA-Z])'],
            ['latex' => '\\hat{\\imath}', 'maxima' => '%i', 'display' => "\u{00EE}",
                'latex_regex' => '\\\\hat\\s*\\{\\s*(?:\\\\imath|i)\\s*\\}'],
        ];
    }

    /**
     * Returns operator mappings.
     *
     * @return array
     */
    public static function get_operators(): array {
        return [
            ['latex' => '\\cdot',  'maxima' => '*'],
            ['latex' => '\\times', 'maxima' => '*'],
            ['latex' => '\\div',   'maxima' => '/'],
        ];
    }

    /**
     * Returns comparison operator mappings.
     *
     * @return array
     */
    public static function get_comparison(): array {
        return [
            ['latex_regex' => '\\\\leq?', 'maxima' => '<=', 'latex_write' => '\\le '],
            ['latex_regex' => '\\\\geq?', 'maxima' => '>=', 'latex_write' => '\\ge '],
            ['latex_regex' => '\\\\neq?', 'maxima' => '#',  'latex_write' => '\\ne '],
        ];
    }

    /**
     * Returns Greek letter names — lowercase AND uppercase.
     *
     * @return string[]
     */
    public static function get_greek(): array {
        return [
            // Lowercase.
            'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta',
            'theta', 'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi',
            'rho', 'sigma', 'tau', 'upsilon', 'phi', 'chi', 'psi', 'omega',
            // Uppercase.
            'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi',
            'Sigma', 'Upsilon', 'Phi', 'Psi', 'Omega',
        ];
    }

    /**
     * Returns Maxima-reserved words that must never be split.
     *
     * @return string[]
     */
    public static function get_reserved_words(): array {
        return [
            'max', 'min', 'abs', 'mod', 'floor', 'ceiling', 'round',
            'signum', 'factorial', 'binomial',
            'diff', 'integrate', 'limit', 'sum', 'product',
            'inf', 'minf',
            'true', 'false',
        ];
    }

    /**
     * Returns Maxima percent-prefixed constants.
     *
     * @return string[]
     */
    public static function get_percent_constants(): array {
        return ['%pi', '%e', '%i', '%phi', '%gamma'];
    }

    /**
     * Returns unit definitions.
     *
     * @return array
     */
    public static function get_units(): array {
        return [
            ['symbol' => 'kHz',  'langkey' => 'unit_khz'],
            ['symbol' => 'MHz',  'langkey' => 'unit_mhz'],
            ['symbol' => 'GHz',  'langkey' => 'unit_ghz'],
            ['symbol' => 'Hz',   'langkey' => 'unit_hz'],
            ['symbol' => 'kPa',  'langkey' => 'unit_kpa'],
            ['symbol' => 'MPa',  'langkey' => 'unit_mpa'],
            ['symbol' => 'Pa',   'langkey' => 'unit_pa'],
            ['symbol' => 'bar',  'langkey' => 'unit_bar'],
            ['symbol' => 'atm',  'langkey' => 'unit_atm'],
            ['symbol' => 'kcal', 'langkey' => 'unit_kcal'],
            ['symbol' => 'cal',  'langkey' => 'unit_cal'],
            ['symbol' => 'kJ',   'langkey' => 'unit_kj'],
            ['symbol' => 'MJ',   'langkey' => 'unit_mj'],
            ['symbol' => 'eV',   'langkey' => 'unit_ev'],
            ['symbol' => 'kW',   'langkey' => 'unit_kw'],
            ['symbol' => 'MW',   'langkey' => 'unit_mw'],
            ['symbol' => 'J',    'langkey' => 'unit_j'],
            ['symbol' => 'W',    'langkey' => 'unit_w'],
            ['symbol' => 'kN',   'langkey' => 'unit_kn'],
            ['symbol' => 'N',    'langkey' => 'unit_n'],
            ['symbol' => 'kV',   'langkey' => 'unit_kv'],
            ['symbol' => 'mA',   'langkey' => 'unit_ma'],
            ['symbol' => 'Ohm',  'langkey' => 'unit_ohm'],
            ['symbol' => 'ohm',  'langkey' => 'unit_ohm'],
            ['symbol' => 'V',    'langkey' => 'unit_v'],
            ['symbol' => 'A',    'langkey' => 'unit_a'],
            ['symbol' => 'F',    'langkey' => 'unit_f'],
            ['symbol' => 'C',    'langkey' => 'unit_c_coulomb'],
            ['symbol' => 'kg',   'langkey' => 'unit_kg'],
            ['symbol' => 'mg',   'langkey' => 'unit_mg'],
            ['symbol' => 'g',    'langkey' => 'unit_g'],
            ['symbol' => 't',    'langkey' => 'unit_t'],
            ['symbol' => 'lb',   'langkey' => 'unit_lb'],
            ['symbol' => 'oz',   'langkey' => 'unit_oz'],
            ['symbol' => 'km',   'langkey' => 'unit_km'],
            ['symbol' => 'cm',   'langkey' => 'unit_cm'],
            ['symbol' => 'mm',   'langkey' => 'unit_mm'],
            ['symbol' => 'nm',   'langkey' => 'unit_nm'],
            ['symbol' => 'um',   'langkey' => 'unit_um'],
            ['symbol' => 'ft',   'langkey' => 'unit_ft'],
            ['symbol' => 'yd',   'langkey' => 'unit_yd'],
            ['symbol' => 'mi',   'langkey' => 'unit_mi'],
            ['symbol' => 'm',    'langkey' => 'unit_m'],
            ['symbol' => 'min',  'langkey' => 'unit_min'],
            ['symbol' => 'ms',   'langkey' => 'unit_ms'],
            ['symbol' => 'hr',   'langkey' => 'unit_hr'],
            ['symbol' => 'h',    'langkey' => 'unit_h'],
            ['symbol' => 's',    'langkey' => 'unit_s'],
            ['symbol' => 'mL',   'langkey' => 'unit_ml'],
            ['symbol' => 'dL',   'langkey' => 'unit_dl'],
            ['symbol' => 'L',    'langkey' => 'unit_l'],
            ['symbol' => 'mol',  'langkey' => 'unit_mol'],
            ['symbol' => 'K',    'langkey' => 'unit_k'],
        ];
    }

    /**
     * @return string[]
     */
    public static function get_unit_symbols(): array {
        return array_column(self::get_units(), 'symbol');
    }

    /**
     * @return array Group key => bool.
     */
    public static function get_default_enabled(): array {
        $result = [];
        foreach (self::get_element_groups() as $key => $group) {
            $result[$key] = $group['default_enabled'];
        }
        return $result;
    }

    /**
     * @return string[]
     */
    public static function get_function_names(): array {
        return array_values(array_unique(
            array_column(self::get_functions(), 'maxima_name')
        ));
    }

    /**
     * Returns group labels with up to 3 example elements.
     *
     * @return array Group key => display label.
     */
    public static function get_group_labels_with_examples(): array {
        $groups = self::get_element_groups();
        $result = [];

        foreach ($groups as $key => $group) {
            $label = get_string($group['langkey'], 'local_stackmatheditor');
            $elements = $group['elements'];

            if (!empty($elements)) {
                $examples = [];
                $maxshow = min(3, count($elements));
                for ($i = 0; $i < $maxshow; $i++) {
                    $examples[] = $elements[$i]['display'] ?? $elements[$i]['label'];
                }
                $label .= ' (' . implode(', ', $examples);
                if (count($elements) > 3) {
                    $label .= ', …';
                }
                $label .= ')';
            }

            $result[$key] = $label;
        }

        return $result;
    }

    /**
     * Export all definitions as JSON for JavaScript.
     *
     * @return array
     */
    public static function export_for_js(): array {
        $groups = self::get_element_groups();
        $exportedgroups = [];

        foreach ($groups as $key => $group) {
            $exportedgroups[$key] = [
                'label' => get_string($group['langkey'], 'local_stackmatheditor'),
                'default_enabled' => $group['default_enabled'],
                'elements' => $group['elements'],
            ];
        }

        $units = self::get_units();
        $exportedunits = [];
        foreach ($units as $unit) {
            $exportedunits[] = [
                'symbol' => $unit['symbol'],
                'description' => get_string($unit['langkey'], 'local_stackmatheditor'),
            ];
        }

        return [
            'elementGroups'    => $exportedgroups,
            'functions'        => self::get_functions(),
            'constants'        => self::get_constants(),
            'operators'        => self::get_operators(),
            'comparison'       => self::get_comparison(),
            'greek'            => self::get_greek(),
            'units'            => $exportedunits,
            'unitSymbols'      => self::get_unit_symbols(),
            'functionNames'    => self::get_function_names(),
            'reservedWords'    => self::get_reserved_words(),
            'percentConstants' => self::get_percent_constants(),
        ];
    }
}

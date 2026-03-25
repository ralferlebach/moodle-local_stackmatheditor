<?php
namespace local_stackmatheditor;

defined('MOODLE_INTERNAL') || die();

/**
 * Toolbar element definitions for STACK MathEditor.
 *
 * Each group has:
 *   - label:           Human-readable name (resolved via get_string()).
 *   - default_enabled: Whether enabled by default.
 *   - elements:        Array of button definitions.
 *
 * Each element has:
 *   - label:   Button tooltip shown on hover. Pure math symbols stay as-is;
 *              natural-language labels are resolved via get_string().
 *   - write:   MathQuill write() command (template with cursor placeholders).
 *   - cmd:     MathQuill cmd() command (inserts a single symbol/command).
 *   - display: Plain-text button face label (used when LaTeX rendering fails).
 *
 * "write" inserts a template, e.g. \frac{}{} with cursor inside the numerator.
 * "cmd"   inserts a single command, e.g. \pi.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Ralf Erlebach
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class definitions {

    /** Single-character variable mode identifier. */
    const VAR_SINGLE = 'single';

    /** Multi-character variable mode identifier. */
    const VAR_MULTI = 'multi';

    /**
     * Return all element group definitions.
     *
     * Group labels and natural-language button tooltips are resolved through
     * Moodle's get_string() so they are delivered in the current user language.
     * Pure mathematical symbols (e.g. π, α, ∑) are language-neutral and
     * remain as literal strings.
     *
     * @return array Associative array keyed by group identifier.
     */
    public static function get_element_groups(): array {
        $p = 'local_stackmatheditor';

        return [

            // ── 1. Basic arithmetic ──────────────────────────────────
            'basic_operators' => [
                'label'           => get_string('group_basic_operators', $p),
                'default_enabled' => true,
                'elements'        => [
                    ['label' => '+',             'write'   => '+',                      'display' => '+'],
                    ['label' => '−',             'write'   => '-',                      'display' => '−'],
                    ['label' => '·',             'cmd'     => '\\cdot',                 'display' => '·'],
                    ['label' => '÷',             'cmd'     => '\\div',                  'display' => '÷'],
                    ['label' => '\\frac{a}{b}',  'write'   => '\\frac{}{}',             'display' => 'a/b'],
                    ['label' => '%',             'write'   => '\\%',                    'display' => '%'],
                ],
            ],

            // ── 2. Powers and roots ──────────────────────────────────
            'power_root' => [
                'label'           => get_string('group_power_root', $p),
                'default_enabled' => true,
                'elements'        => [
                    ['label' => 'x^n',                'write' => '^{}',          'display' => "x\u{207F}"],
                    ['label' => "\u{221A}x",           'write' => '\\sqrt{}',     'display' => "\u{221A}"],
                    ['label' => "\u{207F}\u{221A}x",   'write' => '\\nthroot{}{}','display' => "ⁿ\u{221A}"],
                ],
            ],

            // ── 3. Exponential and logarithm ────────────────────────
            'exponential_log' => [
                'label'           => get_string('group_exponential_log', $p),
                'default_enabled' => true,
                'elements'        => [
                    ['label' => 'exp', 'write' => '\\exp\\left(\\right)',  'display' => 'exp'],
                    ['label' => 'log', 'write' => '\\log\\left(\\right)',  'display' => 'log'],
                    ['label' => 'ln',  'write' => '\\ln\\left(\\right)',   'display' => 'ln'],
                ],
            ],

            // ── 4. Comparison operators ──────────────────────────────
            'comparators' => [
                'label'           => get_string('group_comparators', $p),
                'default_enabled' => true,
                'elements'        => [
                    ['label' => '=',  'write' => '=',           'display' => '='],
                    ['label' => '≠',  'cmd'   => '\\neq',       'display' => '≠'],
                    ['label' => '≈',  'cmd'   => '\\approx',    'display' => '≈'],
                    ['label' => '<',  'write' => '<',            'display' => '<'],
                    ['label' => '>',  'write' => '>',            'display' => '>'],
                    ['label' => '≤',  'cmd'   => '\\leq',       'display' => '≤'],
                    ['label' => '≥',  'cmd'   => '\\geq',       'display' => '≥'],
                ],
            ],

            // ── 5. Absolute value ────────────────────────────────────
            'absolute' => [
                'label'           => get_string('group_absolute', $p),
                'default_enabled' => true,
                'elements'        => [
                    ['label' => '|x|', 'write' => '\\left|\\right|', 'display' => '|x|'],
                ],
            ],

            // ── 6. Set theory ────────────────────────────────────────
            'set_theory' => [
                'label'           => get_string('group_set_theory', $p),
                'default_enabled' => false,
                'elements'        => [
                    ['label' => '∈',  'cmd'   => '\\in',         'display' => '∈'],
                    ['label' => '∉',  'cmd'   => '\\notin',      'display' => '∉'],
                    ['label' => '∪',  'cmd'   => '\\cup',        'display' => '∪'],
                    ['label' => '∩',  'cmd'   => '\\cap',        'display' => '∩'],
                    ['label' => '∖',  'cmd'   => '\\setminus',   'display' => '∖'],
                    ['label' => '⊂',  'cmd'   => '\\subset',     'display' => '⊂'],
                    ['label' => '⊃',  'cmd'   => '\\supset',     'display' => '⊃'],
                    ['label' => 'ℕ',  'write' => '\\mathbb{N}',  'display' => 'ℕ'],
                    ['label' => 'ℤ',  'write' => '\\mathbb{Z}',  'display' => 'ℤ'],
                    ['label' => 'ℚ',  'write' => '\\mathbb{Q}',  'display' => 'ℚ'],
                    ['label' => 'ℝ',  'write' => '\\mathbb{R}',  'display' => 'ℝ'],
                    ['label' => 'ℂ',  'write' => '\\mathbb{C}',  'display' => 'ℂ'],
                ],
            ],

            // ── 7. Logic ─────────────────────────────────────────────
            'logic' => [
                'label'           => get_string('group_logic', $p),
                'default_enabled' => false,
                'elements'        => [
                    ['label' => '∀',  'cmd' => '\\forall',          'display' => '∀'],
                    ['label' => '∃',  'cmd' => '\\exists',          'display' => '∃'],
                    ['label' => '∄',  'cmd' => '\\nexists',         'display' => '∄'],
                    ['label' => '¬',  'cmd' => '\\neg',             'display' => '¬'],
                    ['label' => '∧',  'cmd' => '\\land',            'display' => '∧'],
                    ['label' => '∨',  'cmd' => '\\lor',             'display' => '∨'],
                    ['label' => '⇒',  'cmd' => '\\Rightarrow',      'display' => '⇒'],
                    ['label' => '⇐',  'cmd' => '\\Leftarrow',       'display' => '⇐'],
                    ['label' => '⇔',  'cmd' => '\\Leftrightarrow',  'display' => '⇔'],
                ],
            ],

            // ── 8. Brackets ──────────────────────────────────────────
            'brackets' => [
                'label'           => get_string('group_brackets', $p),
                'default_enabled' => true,
                'elements'        => [
                    ['label' => '( )', 'write' => '\\left(\\right)',         'display' => '( )'],
                    ['label' => '[ ]', 'write' => '\\left[\\right]',         'display' => '[ ]'],
                    ['label' => '{ }', 'write' => '\\left\\{\\right\\}',     'display' => '{ }'],
                ],
            ],

            // ── 9. Mathematical constants ────────────────────────────
            'constants_math' => [
                'label'           => get_string('group_constants_math', $p),
                'default_enabled' => true,
                'elements'        => [
                    ['label' => 'π',  'cmd'   => '\\pi',             'display' => 'π'],
                    ['label' => '∞',  'cmd'   => '\\infty',          'display' => '∞'],
                    ['label' => 'e',  'write' => '\\mathrm{e}',      'display' => 'e'],
                    ['label' => 'i',  'write' => '\\mathrm{i}',      'display' => 'i'],
                ],
            ],

            // ── 10. Physical constants ───────────────────────────────
            'constants_nature' => [
                'label'           => get_string('group_constants_nature', $p),
                'default_enabled' => false,
                'elements'        => [
                    ['label' => 'c₀',  'write' => 'c_0',                    'display' => 'c₀'],
                    ['label' => 'ℏ',   'cmd'   => '\\hbar',                 'display' => 'ℏ'],
                    ['label' => 'G',   'cmd'   => '\\mathrm{G}',            'display' => 'G'],
                    ['label' => 'e⁻',  'write' => '\\mathrm{e^{-}}',        'display' => 'e⁻'],
                    ['label' => 'k_B', 'write' => '\\mathrm{k_B}',          'display' => 'k'],
                    ['label' => 'ε₀',  'write' => '\\varepsilon_0',         'display' => 'ε₀'],
                    ['label' => 'μ₀',  'write' => '\\mu_0',                 'display' => 'μ₀'],
                ],
            ],

            // ── 11. Geometry ─────────────────────────────────────────
            'geometry' => [
                'label'           => get_string('group_geometry', $p),
                'default_enabled' => false,
                'elements'        => [
                    ['label' => '\\overline{AB}', 'write' => '\\overline{}',  'display' => 'AB̅'],
                    ['label' => '°',              'cmd'   => '\\circ',        'display' => '°'],
                    ['label' => '∠',              'cmd'   => '\\angle',       'display' => '∠'],
                    ['label' => '⊥',              'cmd'   => '\\perp',        'display' => '⊥'],
                ],
            ],

            // ── 12. Trigonometry ─────────────────────────────────────
            'trigonometry' => [
                'label'           => get_string('group_trigonometry', $p),
                'default_enabled' => true,
                'elements'        => [
                    ['label' => 'sin',  'write' => '\\sin\\left(\\right)',    'display' => 'sin'],
                    ['label' => 'cos',  'write' => '\\cos\\left(\\right)',    'display' => 'cos'],
                    ['label' => 'tan',  'write' => '\\tan\\left(\\right)',    'display' => 'tan'],
                    ['label' => 'asin', 'write' => '\\arcsin\\left(\\right)', 'display' => 'asin'],
                    ['label' => 'acos', 'write' => '\\arccos\\left(\\right)', 'display' => 'acos'],
                    ['label' => 'atan', 'write' => '\\arctan\\left(\\right)', 'display' => 'atan'],
                ],
            ],

            // ── 13. Hyperbolic functions ─────────────────────────────
            'hyperbolic' => [
                'label'           => get_string('group_hyperbolic', $p),
                'default_enabled' => false,
                'elements'        => [
                    ['label' => 'sinh', 'write' => '\\sinh\\left(\\right)', 'display' => 'sinh'],
                    ['label' => 'cosh', 'write' => '\\cosh\\left(\\right)', 'display' => 'cosh'],
                    ['label' => 'tanh', 'write' => '\\tanh\\left(\\right)', 'display' => 'tanh'],
                ],
            ],

            // ── 14. Calculus operators ───────────────────────────────
            'analysis_operators' => [
                'label'           => get_string('group_analysis_operators', $p),
                'default_enabled' => false,
                'elements'        => [
                    ['label' => '|x|', 'write' => '\\left|\\right|', 'display' => '|x|'],
                    ['label' => '∑',   'write' => '\\sum_{}^{}',     'display' => '∑'],
                    ['label' => '∏',   'write' => '\\prod_{}^{}',    'display' => '∏'],
                ],
            ],

            // ── 15. Vectors ──────────────────────────────────────────
            'vector_operators' => [
                'label'           => get_string('group_vector_operators', $p),
                'default_enabled' => false,
                'elements'        => [
                    ['label' => '\\vec{v}', 'write' => '\\vec{}',            'display' => 'v⃗'],
                    ['label' => '||v||',    'write' => '\\left\\|\\right\\|', 'display' => '‖v‖'],
                    ['label' => '·',        'cmd'   => '\\cdot',             'display' => '·'],
                    ['label' => '×',        'cmd'   => '\\times',            'display' => '×'],
                ],
            ],

            // ── 16. Differential calculus ────────────────────────────
            'differential_operators' => [
                'label'           => get_string('group_differential_operators', $p),
                'default_enabled' => false,
                'elements'        => [
                    ['label' => 'd/dx',   'write' => '\\frac{d}{dx}',                    'display' => 'd/dx'],
                    ['label' => '∂/∂x',   'write' => '\\frac{\\partial}{\\partial x}',   'display' => '∂/∂x'],
                    ['label' => '∇',      'cmd'   => '\\nabla',                           'display' => '∇'],
                    ['label' => 'Δ',      'cmd'   => '\\Delta',                           'display' => 'Δ'],
                ],
            ],

            // ── 17. Vector differential ──────────────────────────────
            'vector_differential' => [
                'label'           => get_string('group_vector_differential', $p),
                'default_enabled' => false,
                'elements'        => [
                    ['label' => 'grad', 'write' => '\\mathrm{grad}\\,', 'display' => 'grad'],
                    ['label' => 'div',  'write' => '\\mathrm{div}\\,',  'display' => 'div'],
                    ['label' => 'rot',  'write' => '\\mathrm{rot}\\,',  'display' => 'rot'],
                ],
            ],

            // ── 18. Matrices ─────────────────────────────────────────
            'matrix_operators' => [
                'label'           => get_string('group_matrix_operators', $p),
                'default_enabled' => false,
                'elements'        => [
                    ['label' => '𝟙',  'write' => '\\mathbb{1}',    'display' => '𝟙'],
                    ['label' => 'Aᵀ', 'write' => '^{\\intercal}',  'display' => 'Aᵀ'],
                    ['label' => 'A*', 'write' => '^{*}',            'display' => 'A*'],
                    ['label' => 'A†', 'write' => '^{\\dagger}',     'display' => 'A†'],
                ],
            ],

            // ── 19. Integral calculus ────────────────────────────────
            'integral_operators' => [
                'label'           => get_string('group_integral_operators', $p),
                'default_enabled' => true,
                'elements'        => [
                    ['label' => '∫',  'write' => '\\int_{}^{}',  'display' => '∫'],
                    ['label' => '∮',  'write' => '\\oint_{}^{}', 'display' => '∮'],
                ],
            ],

            // ── 20. Statistics ───────────────────────────────────────
            'statistical_operators' => [
                'label'           => get_string('group_statistical_operators', $p),
                'default_enabled' => false,
                'elements'        => [
                    ['label' => 'n!',            'write' => '!',              'display' => 'n!'],
                    ['label' => '\\binom{n}{k}', 'write' => '\\binom{}{}',    'display' => 'C(n,k)'],
                    ['label' => 'E[X]',          'write' => 'E\\left[\\right]','display' => 'E[X]'],
                    ['label' => 'σ',             'cmd'   => '\\sigma',        'display' => 'σ'],
                    ['label' => get_string('btn_logical_and', $p),
                                                  'cmd'   => '\\land',        'display' => '&'],
                    ['label' => get_string('btn_logical_or', $p),
                                                  'cmd'   => '\\lor',         'display' => '|'],
                    ['label' => 'Γ',             'cmd'   => '\\Gamma',        'display' => 'Γ'],
                ],
            ],

            // ── 21. Greek letters (lowercase) ────────────────────────
            'greek_lower' => [
                'label'           => get_string('group_greek_lower', $p),
                'default_enabled' => true,
                'elements'        => [
                    ['label' => 'α', 'cmd' => '\\alpha',   'display' => 'α'],
                    ['label' => 'β', 'cmd' => '\\beta',    'display' => 'β'],
                    ['label' => 'γ', 'cmd' => '\\gamma',   'display' => 'γ'],
                    ['label' => 'δ', 'cmd' => '\\delta',   'display' => 'δ'],
                    ['label' => 'ε', 'cmd' => '\\epsilon', 'display' => 'ε'],
                    ['label' => 'ζ', 'cmd' => '\\zeta',    'display' => 'ζ'],
                    ['label' => 'η', 'cmd' => '\\eta',     'display' => 'η'],
                    ['label' => 'θ', 'cmd' => '\\theta',   'display' => 'θ'],
                    ['label' => 'ι', 'cmd' => '\\iota',    'display' => 'ι'],
                    ['label' => 'κ', 'cmd' => '\\kappa',   'display' => 'κ'],
                    ['label' => 'λ', 'cmd' => '\\lambda',  'display' => 'λ'],
                    ['label' => 'μ', 'cmd' => '\\mu',      'display' => 'μ'],
                    ['label' => 'ν', 'cmd' => '\\nu',      'display' => 'ν'],
                    ['label' => 'ξ', 'cmd' => '\\xi',      'display' => 'ξ'],
                    ['label' => 'ο', 'write' => 'o',        'display' => 'ο'],
                    ['label' => 'π', 'cmd' => '\\pi',      'display' => 'π'],
                    ['label' => 'ρ', 'cmd' => '\\rho',     'display' => 'ρ'],
                    ['label' => 'σ', 'cmd' => '\\sigma',   'display' => 'σ'],
                    ['label' => 'τ', 'cmd' => '\\tau',     'display' => 'τ'],
                    ['label' => 'υ', 'cmd' => '\\upsilon', 'display' => 'υ'],
                    ['label' => 'φ', 'cmd' => '\\phi',     'display' => 'φ'],
                    ['label' => 'χ', 'cmd' => '\\chi',     'display' => 'χ'],
                    ['label' => 'ψ', 'cmd' => '\\psi',     'display' => 'ψ'],
                    ['label' => 'ω', 'cmd' => '\\omega',   'display' => 'ω'],
                ],
            ],

            // ── 22. Greek letters (uppercase) ────────────────────────
            'greek_upper' => [
                'label'           => get_string('group_greek_upper', $p),
                'default_enabled' => true,
                'elements'        => [
                    ['label' => 'Α', 'write' => 'A',          'display' => 'Α'],
                    ['label' => 'Β', 'write' => 'B',          'display' => 'Β'],
                    ['label' => 'Γ', 'cmd'   => '\\Gamma',    'display' => 'Γ'],
                    ['label' => 'Δ', 'cmd'   => '\\Delta',    'display' => 'Δ'],
                    ['label' => 'Ε', 'write' => 'E',          'display' => 'Ε'],
                    ['label' => 'Ζ', 'write' => 'Z',          'display' => 'Ζ'],
                    ['label' => 'Η', 'write' => 'H',          'display' => 'Η'],
                    ['label' => 'Θ', 'cmd'   => '\\Theta',    'display' => 'Θ'],
                    ['label' => 'Ι', 'write' => 'I',          'display' => 'Ι'],
                    ['label' => 'Κ', 'write' => 'K',          'display' => 'Κ'],
                    ['label' => 'Λ', 'cmd'   => '\\Lambda',   'display' => 'Λ'],
                    ['label' => 'Μ', 'write' => 'M',          'display' => 'Μ'],
                    ['label' => 'Ν', 'write' => 'N',          'display' => 'Ν'],
                    ['label' => 'Ξ', 'cmd'   => '\\Xi',       'display' => 'Ξ'],
                    ['label' => 'Ο', 'write' => 'O',          'display' => 'Ο'],
                    ['label' => 'Π', 'cmd'   => '\\Pi',       'display' => 'Π'],
                    ['label' => 'Ρ', 'write' => 'P',          'display' => 'Ρ'],
                    ['label' => 'Σ', 'cmd'   => '\\Sigma',    'display' => 'Σ'],
                    ['label' => 'Τ', 'write' => 'T',          'display' => 'Τ'],
                    ['label' => 'Υ', 'cmd'   => '\\Upsilon',  'display' => 'Υ'],
                    ['label' => 'Φ', 'cmd'   => '\\Phi',      'display' => 'Φ'],
                    ['label' => 'Χ', 'write' => 'X',          'display' => 'Χ'],
                    ['label' => 'Ψ', 'cmd'   => '\\Psi',      'display' => 'Ψ'],
                    ['label' => 'Ω', 'cmd'   => '\\Omega',    'display' => 'Ω'],
                ],
            ],

        ];
    }

    /**
     * Return the default enabled state for each group.
     *
     * @return array Group key => bool.
     */
    public static function get_default_config(): array {
        $defaults = [];
        foreach (self::get_element_groups() as $key => $group) {
            $defaults[$key] = $group['default_enabled'];
        }
        return $defaults;
    }

    /**
     * Return all known function names for tex2max/max2tex conversion.
     *
     * @return array List of function name strings.
     */
    public static function get_functions(): array {
        return [
            'sin', 'cos', 'tan',
            'arcsin', 'arccos', 'arctan',
            'asin', 'acos', 'atan',
            'sinh', 'cosh', 'tanh',
            'exp', 'log', 'ln',
            'sqrt', 'abs',
        ];
    }

    /**
     * Return all known Maxima constant names.
     *
     * @return array List of constant strings.
     */
    public static function get_constants(): array {
        return ['pi', 'inf', 'minf', 'true', 'false'];
    }

    /**
     * Return operator symbols used in tex2max conversion.
     *
     * @return array List of operator strings.
     */
    public static function get_operators(): array {
        return ['*', '/', '+', '-'];
    }

    /**
     * Return comparison operator LaTeX commands.
     *
     * @return array List of LaTeX comparison strings.
     */
    public static function get_comparison(): array {
        return ['=', '\\neq', '\\leq', '\\geq', '<', '>', '\\approx'];
    }

    /**
     * Return Greek letter names used for variable detection.
     *
     * @return array List of Greek letter name strings.
     */
    public static function get_greek(): array {
        return [
            'alpha', 'beta', 'gamma', 'delta',
            'epsilon', 'zeta', 'eta', 'theta',
            'iota', 'kappa', 'lambda', 'mu',
            'nu', 'xi', 'pi', 'rho',
            'sigma', 'tau', 'upsilon', 'phi',
            'chi', 'psi', 'omega',
            'Gamma', 'Delta', 'Theta', 'Lambda',
            'Xi', 'Pi', 'Sigma', 'Upsilon',
            'Phi', 'Psi', 'Omega',
        ];
    }

    /**
     * Return SI and common unit abbreviations for the units input type.
     *
     * @return array List of unit abbreviation strings.
     */
    public static function get_units(): array {
        return [
            'm', 'km', 'cm', 'mm', 'nm', 'um',
            'kg', 'g', 'mg', 'ug',
            's', 'ms', 'us', 'ns', 'min', 'hr',
            'N', 'kN', 'mN',
            'Pa', 'kPa', 'MPa', 'GPa', 'bar', 'mbar',
            'J', 'kJ', 'MJ', 'eV', 'keV', 'MeV',
            'W', 'kW', 'MW',
            'A', 'mA', 'uA',
            'V', 'kV', 'mV',
            'C', 'F', 'uF', 'nF', 'pF',
            'Ohm', 'kOhm', 'MOhm',
            'H', 'mH', 'uH',
            'T', 'mT', 'Hz', 'kHz', 'MHz', 'GHz',
            'mol', 'K', 'cd', 'lm', 'lx',
        ];
    }

    /**
     * Return display symbols for units (maps abbreviation to Unicode symbol).
     *
     * @return array Unit abbreviation => display symbol string.
     */
    public static function get_unit_symbols(): array {
        return [
            'm' => 'm',     'km' => 'km',   'cm' => 'cm',
            'mm' => 'mm',   'nm' => 'nm',   'um' => 'µm',
            'kg' => 'kg',   'g' => 'g',     'mg' => 'mg',
            'ug' => 'µg',
            's' => 's',     'ms' => 'ms',   'us' => 'µs',
            'ns' => 'ns',   'min' => 'min', 'hr' => 'h',
            'N' => 'N',     'kN' => 'kN',   'mN' => 'mN',
            'Pa' => 'Pa',   'kPa' => 'kPa', 'MPa' => 'MPa',
            'GPa' => 'GPa', 'bar' => 'bar', 'mbar' => 'mbar',
            'J' => 'J',     'kJ' => 'kJ',   'MJ' => 'MJ',
            'eV' => 'eV',   'keV' => 'keV', 'MeV' => 'MeV',
            'W' => 'W',     'kW' => 'kW',   'MW' => 'MW',
            'A' => 'A',     'mA' => 'mA',   'uA' => 'µA',
            'V' => 'V',     'kV' => 'kV',   'mV' => 'mV',
            'C' => 'C',
            'F' => 'F',     'uF' => 'µF',   'nF' => 'nF',
            'pF' => 'pF',
            'Ohm' => 'Ω',   'kOhm' => 'kΩ', 'MOhm' => 'MΩ',
            'H' => 'H',     'mH' => 'mH',   'uH' => 'µH',
            'T' => 'T',     'mT' => 'mT',
            'Hz' => 'Hz',   'kHz' => 'kHz', 'MHz' => 'MHz',
            'GHz' => 'GHz',
            'mol' => 'mol', 'K' => 'K',
            'cd' => 'cd',   'lm' => 'lm',   'lx' => 'lx',
        ];
    }

    /**
     * Return function names for LaTeX-to-Maxima detection.
     *
     * @return array List of function name strings.
     */
    public static function get_function_names(): array {
        return [
            'sin', 'cos', 'tan',
            'arcsin', 'arccos', 'arctan',
            'sinh', 'cosh', 'tanh',
            'exp', 'log', 'ln',
            'sqrt', 'abs', 'sgn',
        ];
    }

    /**
     * Return reserved Maxima keywords.
     *
     * @return array List of reserved word strings.
     */
    public static function get_reserved_words(): array {
        return [
            'if', 'then', 'else', 'elseif',
            'and', 'or', 'not',
            'true', 'false',
            'do', 'for', 'while', 'unless',
            'thru', 'step', 'in',
            'inf', 'minf',
        ];
    }

    /**
     * Return names treated as percent-prefixed constants in Maxima.
     *
     * @return array List of percent-constant strings (including % prefix).
     */
    public static function get_percent_constants(): array {
        return ['%pi', '%e', '%i', '%phi', '%gamma'];
    }

    /**
     * Export all definitions as a data structure for JSON encoding.
     *
     * Called by mathjax_injector to pass definitions to JavaScript modules.
     *
     * @return array Nested data structure suitable for json_encode().
     */
    public static function export_for_js(): array {
        return [
            'elementGroups'    => self::get_element_groups(),
            'functions'        => self::get_functions(),
            'constants'        => self::get_constants(),
            'operators'        => self::get_operators(),
            'comparison'       => self::get_comparison(),
            'greek'            => self::get_greek(),
            'units'            => self::get_units(),
            'unitSymbols'      => self::get_unit_symbols(),
            'functionNames'    => self::get_function_names(),
            'reservedWords'    => self::get_reserved_words(),
            'percentConstants' => self::get_percent_constants(),
        ];
    }

    /**
     * Return group labels with up to three example button faces for the settings UI.
     *
     * Used to populate the multi-select on the admin settings page and the
     * configure form, giving teachers a preview of what each group contains.
     *
     * @return array Group key => label string (with examples appended).
     */
    public static function get_group_labels_with_examples(): array {
        $groups = self::get_element_groups();
        $result = [];
        foreach ($groups as $key => $group) {
            $label    = $group['label'] ?? $key;
            $examples = [];
            $count    = 0;
            foreach (($group['elements'] ?? []) as $el) {
                if ($count >= 3) {
                    $examples[] = '…';
                    break;
                }
                $examples[] = $el['display'] ?? $el['label'] ?? '';
                $count++;
            }
            if (!empty($examples)) {
                $label .= ' (' . implode(', ', $examples) . ')';
            }
            $result[$key] = $label;
        }
        return $result;
    }

    /**
     * Return only default-enabled state for each group.
     *
     * @return array Group key => bool.
     */
    public static function get_default_enabled(): array {
        $result = [];
        foreach (self::get_element_groups() as $key => $group) {
            $result[$key] = (bool) ($group['default_enabled'] ?? false);
        }
        return $result;
    }
}

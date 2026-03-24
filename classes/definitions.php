<?php
namespace local_stackmatheditor;

defined('MOODLE_INTERNAL') || die();

/**
 * Toolbar element definitions for STACK MathEditor.
 *
 * Each group has:
 *   - label:           Human-readable name.
 *   - default_enabled: Whether enabled by default.
 *   - elements:        Array of button definitions.
 *
 * Each element has:
 *   - label:   Button tooltip / fallback text.
 *   - write:   MathQuill write() command (template with placeholders).
 *   - cmd:     MathQuill cmd() command (single symbol/command).
 *   - display: Plain-text button label (if no LaTeX rendering).
 *
 * "write" inserts a template (e.g. \frac{}{} with cursor placement).
 * "cmd" inserts a single command (e.g. \pi).
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Ralf Erlebach
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class definitions {

    /** Single-character variable mode. */
    const VAR_SINGLE = 'single';

    /** Multi-character variable mode. */
    const VAR_MULTI = 'multi';

    /**
     * Return all element group definitions.
     *
     * @return array Associative array of groups.
     */
    public static function get_element_groups(): array {
        return [

            // ── 1. Grundrechenarten ─────────────────
            'basic_operators' => [
                'label' => 'Grundrechenarten',
                'default_enabled' => true,
                'elements' => [
                    ['label' => '+',
                        'write' => '+',
                        'display' => '+'],
                    ['label' => '−',
                        'write' => '-',
                        'display' => '−'],
                    ['label' => '·',
                        'cmd' => '\\cdot',
                        'display' => '·'],
                    ['label' => '÷',
                        'cmd' => '\\div',
                        'display' => '÷'],
                    ['label' => '\\frac{a}{b}',
                        'write' => '\\frac{}{}',
                        'display' => 'a/b'],
                    ['label' => '%',
                        'write' => '\\%',
                        'display' => '%'],
                ],
            ],

            // ── 2. Potenzen und Wurzeln ─────────────
            'power_root' => [
                'label' => 'Potenzen und Wurzeln',
                'default_enabled' => true,
                'elements' => [
                    ['label' => 'x^n',
                        'write' => '^{}',
                        'display' => "x\u{207F}"],
                    ['label' => "\u{221A}x",
                        'write' => '\\sqrt{}',
                        'display' => "\u{221A}"],
                    ['label' => "\u{207F}\u{221A}x",
                        'write' => '\\nthroot{}{}',
                        'display' => "ⁿ\u{221A}"],
                ],
            ],

            // ── 3. Exponential und Logarithmus ──────
            'exponential_log' => [
                'label' => 'Exponential / Logarithmus',
                'default_enabled' => true,
                'elements' => [
                    ['label' => 'exp',
                        'write' => '\\exp\\left(\\right)',
                        'display' => 'exp'],
                    ['label' => 'log',
                        'write' => '\\log\\left(\\right)',
                        'display' => 'log'],
                    ['label' => 'ln',
                        'write' => '\\ln\\left(\\right)',
                        'display' => 'ln'],
                ],
            ],

            // ── 4. Vergleichsoperatoren ─────────────
            'comparators' => [
                'label' => 'Vergleichsoperatoren',
                'default_enabled' => false,
                'elements' => [
                    ['label' => '=',
                        'write' => '=',
                        'display' => '='],
                    ['label' => '≠',
                        'cmd' => '\\neq',
                        'display' => '≠'],
                    ['label' => '≈',
                        'cmd' => '\\approx',
                        'display' => '≈'],
                    ['label' => '<',
                        'write' => '<',
                        'display' => '<'],
                    ['label' => '>',
                        'write' => '>',
                        'display' => '>'],
                    ['label' => '≤',
                        'cmd' => '\\leq',
                        'display' => '≤'],
                    ['label' => '≥',
                        'cmd' => '\\geq',
                        'display' => '≥'],
                ],
            ],

            // ── 5. Betrag ───────────────────────────
            'absolute' => [
                'label' => 'Betrag',
                'default_enabled' => false,
                'elements' => [
                    ['label' => '|x|',
                        'write' => '\\left|\\right|',
                        'display' => '|x|'],
                ],
            ],

            // ── 6. Mengenlehre ──────────────────────
            'set_theory' => [
                'label' => 'Mengenlehre',
                'default_enabled' => false,
                'elements' => [
                    ['label' => '∈',
                        'cmd' => '\\in',
                        'display' => '∈'],
                    ['label' => '∉',
                        'cmd' => '\\notin',
                        'display' => '∉'],
                    ['label' => '∪',
                        'cmd' => '\\cup',
                        'display' => '∪'],
                    ['label' => '∩',
                        'cmd' => '\\cap',
                        'display' => '∩'],
                    ['label' => '\\',
                        'cmd' => '\\setminus',
                        'display' => '∖'],
                    ['label' => '⊂',
                        'cmd' => '\\subset',
                        'display' => '⊂'],
                    ['label' => '⊃',
                        'cmd' => '\\supset',
                        'display' => '⊃'],
                    ['label' => 'ℕ',
                        'write' => '\\mathbb{N}',
                        'display' => 'ℕ'],
                    ['label' => 'ℤ',
                        'write' => '\\mathbb{Z}',
                        'display' => 'ℤ'],
                    ['label' => 'ℚ',
                        'write' => '\\mathbb{Q}',
                        'display' => 'ℚ'],
                    ['label' => 'ℝ',
                        'write' => '\\mathbb{R}',
                        'display' => 'ℝ'],
                    ['label' => 'ℂ',
                        'write' => '\\mathbb{C}',
                        'display' => 'ℂ'],
                ],
            ],

            // ── 7. Logik ────────────────────────────
            'logic' => [
                'label' => 'Logik',
                'default_enabled' => false,
                'elements' => [
                    ['label' => '∀',
                        'cmd' => '\\forall',
                        'display' => '∀'],
                    ['label' => '∃',
                        'cmd' => '\\exists',
                        'display' => '∃'],
                    ['label' => '∄',
                        'cmd' => '\\nexists',
                        'display' => '∄'],
                    ['label' => '¬',
                        'cmd' => '\\neg',
                        'display' => '¬'],
                    ['label' => '∧',
                        'cmd' => '\\land',
                        'display' => '∧'],
                    ['label' => '∨',
                        'cmd' => '\\lor',
                        'display' => '∨'],
                    ['label' => '⇒',
                        'cmd' => '\\Rightarrow',
                        'display' => '⇒'],
                    ['label' => '⇐',
                        'cmd' => '\\Leftarrow',
                        'display' => '⇐'],
                    ['label' => '⇔',
                        'cmd' => '\\Leftrightarrow',
                        'display' => '⇔'],
                ],
            ],

            // ── 8. Klammern ─────────────────────────
            'brackets' => [
                'label' => 'Klammern',
                'default_enabled' => false,
                'elements' => [
                    ['label' => '( )',
                        'write' => '\\left(\\right)',
                        'display' => '( )'],
                    ['label' => '[ ]',
                        'write' => '\\left[\\right]',
                        'display' => '[ ]'],
                    ['label' => '{ }',
                        'write' => '\\left\\{\\right\\}',
                        'display' => '{ }'],
                ],
            ],

            // ── 9. Mathematische Konstanten ─────────
            'constants_math' => [
                'label' => 'Konstanten (Mathematik)',
                'default_enabled' => true,
                'elements' => [
                    ['label' => 'π',
                        'cmd' => '\\pi',
                        'display' => 'π'],
                    ['label' => '∞',
                        'cmd' => '\\infty',
                        'display' => '∞'],
                    ['label' => 'e',
                        'write' => 'e',
                        'display' => 'e'],
                    ['label' => 'i',
                        'write' => 'i',
                        'display' => 'i'],
                ],
            ],

            // ── 10. Naturkonstanten ─────────────────
            'constants_nature' => [
                'label' => 'Konstanten (Natur)',
                'default_enabled' => false,
                'elements' => [
                    ['label' => 'c₀',
                        'write' => 'c_0',
                        'display' => 'c₀'],
                    ['label' => 'ℏ',
                        'cmd' => '\\hbar',
                        'display' => 'ℏ'],
                    ['label' => 'γ',
                        'cmd' => '\\gamma',
                        'display' => 'γ'],
                    ['label' => 'e⁻',
                        'write' => 'e^{-}',
                        'display' => 'e⁻'],
                    ['label' => 'k_B',
                        'write' => 'k_B',
                        'display' => 'k_B'],
                    ['label' => 'ε₀',
                        'write' => '\\varepsilon_0',
                        'display' => 'ε₀'],
                    ['label' => 'μ₀',
                        'write' => '\\mu_0',
                        'display' => 'μ₀'],
                ],
            ],

            // ── 11. Geometrie ───────────────────────
            'geometry' => [
                'label' => 'Geometrie',
                'default_enabled' => false,
                'elements' => [
                    ['label' => '\\overline{AB}',
                        'write' => '\\overline{}',
                        'display' => 'AB̅'],
                    ['label' => '°',
                        'cmd' => '\\circ',
                        'display' => '°'],
                    ['label' => '∠',
                        'cmd' => '\\angle',
                        'display' => '∠'],
                    ['label' => '⊥',
                        'cmd' => '\\perp',
                        'display' => '⊥'],
                ],
            ],

            // ── 12. Trigonometrie ────────────────────
            'trigonometry' => [
                'label' => 'Trigonometrie',
                'default_enabled' => false,
                'elements' => [
                    ['label' => 'sin',
                        'write' => '\\sin\\left(\\right)',
                        'display' => 'sin'],
                    ['label' => 'cos',
                        'write' => '\\cos\\left(\\right)',
                        'display' => 'cos'],
                    ['label' => 'tan',
                        'write' => '\\tan\\left(\\right)',
                        'display' => 'tan'],
                    ['label' => 'asin',
                        'write' => '\\arcsin\\left(\\right)',
                        'display' => 'asin'],
                    ['label' => 'acos',
                        'write' => '\\arccos\\left(\\right)',
                        'display' => 'acos'],
                    ['label' => 'atan',
                        'write' => '\\arctan\\left(\\right)',
                        'display' => 'atan'],
                ],
            ],

            // ── 13. Hyperbolische Funktionen ────────
            'hyperbolic' => [
                'label' => 'Hyperbelfunktionen',
                'default_enabled' => false,
                'elements' => [
                    ['label' => 'sinh',
                        'write' => '\\sinh\\left(\\right)',
                        'display' => 'sinh'],
                    ['label' => 'cosh',
                        'write' => '\\cosh\\left(\\right)',
                        'display' => 'cosh'],
                    ['label' => 'tanh',
                        'write' => '\\tanh\\left(\\right)',
                        'display' => 'tanh'],
                ],
            ],

            // ── 14. Analysis-Operatoren ─────────────
            'analysis_operators' => [
                'label' => 'Analysis-Operatoren',
                'default_enabled' => false,
                'elements' => [
                    ['label' => '|x|',
                        'write' => '\\left|\\right|',
                        'display' => '|x|'],
                    ['label' => '∑',
                        'write' => '\\sum_{}^{}',
                        'display' => '∑'],
                    ['label' => '∏',
                        'write' => '\\prod_{}^{}',
                        'display' => '∏'],
                ],
            ],

            // ── 15. Vektor-Operatoren ───────────────
            'vector_operators' => [
                'label' => 'Vektoren',
                'default_enabled' => false,
                'elements' => [
                    ['label' => '\\vec{v}',
                        'write' => '\\vec{}',
                        'display' => 'v⃗'],
                    ['label' => '||v||',
                        'write' => '\\left\\|\\right\\|',
                        'display' => '‖v‖'],
                    ['label' => '·',
                        'cmd' => '\\cdot',
                        'display' => '·'],
                    ['label' => '×',
                        'cmd' => '\\times',
                        'display' => '×'],
                ],
            ],

            // ── 16. Differential-Operatoren ─────────
            'differential_operators' => [
                'label' => 'Differentialrechnung',
                'default_enabled' => false,
                'elements' => [
                    ['label' => 'd/dx',
                        'write' => '\\frac{d}{dx}',
                        'display' => 'd/dx'],
                    ['label' => '∂/∂x',
                        'write' => '\\frac{\\partial}{\\partial x}',
                        'display' => '∂/∂x'],
                    ['label' => '∇',
                        'cmd' => '\\nabla',
                        'display' => '∇'],
                    ['label' => 'Δ',
                        'cmd' => '\\Delta',
                        'display' => 'Δ'],
                ],
            ],

            // ── 17. Vektor-Differentialoperatoren ───
            'vector_differential' => [
                'label' => 'Vektordifferential',
                'default_enabled' => false,
                'elements' => [
                    ['label' => 'grad',
                        'write' => '\\mathrm{grad}\\,',
                        'display' => 'grad'],
                    ['label' => 'div',
                        'write' => '\\mathrm{div}\\,',
                        'display' => 'div'],
                    ['label' => 'rot',
                        'write' => '\\mathrm{rot}\\,',
                        'display' => 'rot'],
                ],
            ],

            // ── 18. Matrix-Operatoren ───────────────
            'matrix_operators' => [
                'label' => 'Matrizen',
                'default_enabled' => false,
                'elements' => [
                    ['label' => '𝟙',
                        'write' => '\\mathbb{1}',
                        'display' => '𝟙'],
                    ['label' => 'Aᵀ',
                        'write' => '^{\\intercal}',
                        'display' => 'Aᵀ'],
                    ['label' => 'A*',
                        'write' => '^{*}',
                        'display' => 'A*'],
                    ['label' => 'A†',
                        'write' => '^{\\dagger}',
                        'display' => 'A†'],
                ],
            ],

            // ── 19. Integral-Operatoren ─────────────
            'integral_operators' => [
                'label' => 'Integralrechnung',
                'default_enabled' => false,
                'elements' => [
                    ['label' => '∫',
                        'write' => '\\int_{}^{}',
                        'display' => '∫'],
                    ['label' => '∮',
                        'write' => '\\oint_{}^{}',
                        'display' => '∮'],
                ],
            ],

            // ── 20. Stochastik-Operatoren ───────────
            'statistical_operators' => [
                'label' => 'Stochastik',
                'default_enabled' => false,
                'elements' => [
                    ['label' => 'n!',
                        'write' => '!',
                        'display' => 'n!'],
                    ['label' => '\\binom{n}{k}',
                        'write' => '\\binom{}{}',
                        'display' => 'C(n,k)'],
                    ['label' => 'E[X]',
                        'write' => 'E\\left[\\right]',
                        'display' => 'E[X]'],
                    ['label' => 'σ',
                        'cmd' => '\\sigma',
                        'display' => 'σ'],
                    ['label' => '∧ (und)',
                        'cmd' => '\\land',
                        'display' => '&'],
                    ['label' => '∨ (oder)',
                        'cmd' => '\\lor',
                        'display' => '|'],
                    ['label' => 'Γ',
                        'cmd' => '\\Gamma',
                        'display' => 'Γ'],
                ],
            ],

            // ── 21. Griechisch (klein) ──────────────
            'greek_lower' => [
                'label' => 'Griechisch (klein)',
                'default_enabled' => false,
                'elements' => [
                    ['label' => 'α', 'cmd' => '\\alpha',
                        'display' => 'α'],
                    ['label' => 'β', 'cmd' => '\\beta',
                        'display' => 'β'],
                    ['label' => 'γ', 'cmd' => '\\gamma',
                        'display' => 'γ'],
                    ['label' => 'δ', 'cmd' => '\\delta',
                        'display' => 'δ'],
                    ['label' => 'ε', 'cmd' => '\\epsilon',
                        'display' => 'ε'],
                    ['label' => 'ζ', 'cmd' => '\\zeta',
                        'display' => 'ζ'],
                    ['label' => 'η', 'cmd' => '\\eta',
                        'display' => 'η'],
                    ['label' => 'θ', 'cmd' => '\\theta',
                        'display' => 'θ'],
                    ['label' => 'ι', 'cmd' => '\\iota',
                        'display' => 'ι'],
                    ['label' => 'κ', 'cmd' => '\\kappa',
                        'display' => 'κ'],
                    ['label' => 'λ', 'cmd' => '\\lambda',
                        'display' => 'λ'],
                    ['label' => 'μ', 'cmd' => '\\mu',
                        'display' => 'μ'],
                    ['label' => 'ν', 'cmd' => '\\nu',
                        'display' => 'ν'],
                    ['label' => 'ξ', 'cmd' => '\\xi',
                        'display' => 'ξ'],
                    ['label' => 'ο', 'write' => 'o',
                        'display' => 'ο'],
                    ['label' => 'π', 'cmd' => '\\pi',
                        'display' => 'π'],
                    ['label' => 'ρ', 'cmd' => '\\rho',
                        'display' => 'ρ'],
                    ['label' => 'σ', 'cmd' => '\\sigma',
                        'display' => 'σ'],
                    ['label' => 'τ', 'cmd' => '\\tau',
                        'display' => 'τ'],
                    ['label' => 'υ', 'cmd' => '\\upsilon',
                        'display' => 'υ'],
                    ['label' => 'φ', 'cmd' => '\\phi',
                        'display' => 'φ'],
                    ['label' => 'χ', 'cmd' => '\\chi',
                        'display' => 'χ'],
                    ['label' => 'ψ', 'cmd' => '\\psi',
                        'display' => 'ψ'],
                    ['label' => 'ω', 'cmd' => '\\omega',
                        'display' => 'ω'],
                ],
            ],

            // ── 22. Griechisch (groß) ───────────────
            'greek_upper' => [
                'label' => 'Griechisch (groß)',
                'default_enabled' => false,
                'elements' => [
                    ['label' => 'Α', 'write' => 'A',
                        'display' => 'Α'],
                    ['label' => 'Β', 'write' => 'B',
                        'display' => 'Β'],
                    ['label' => 'Γ', 'cmd' => '\\Gamma',
                        'display' => 'Γ'],
                    ['label' => 'Δ', 'cmd' => '\\Delta',
                        'display' => 'Δ'],
                    ['label' => 'Ε', 'write' => 'E',
                        'display' => 'Ε'],
                    ['label' => 'Ζ', 'write' => 'Z',
                        'display' => 'Ζ'],
                    ['label' => 'Η', 'write' => 'H',
                        'display' => 'Η'],
                    ['label' => 'Θ', 'cmd' => '\\Theta',
                        'display' => 'Θ'],
                    ['label' => 'Ι', 'write' => 'I',
                        'display' => 'Ι'],
                    ['label' => 'Κ', 'write' => 'K',
                        'display' => 'Κ'],
                    ['label' => 'Λ', 'cmd' => '\\Lambda',
                        'display' => 'Λ'],
                    ['label' => 'Μ', 'write' => 'M',
                        'display' => 'Μ'],
                    ['label' => 'Ν', 'write' => 'N',
                        'display' => 'Ν'],
                    ['label' => 'Ξ', 'cmd' => '\\Xi',
                        'display' => 'Ξ'],
                    ['label' => 'Ο', 'write' => 'O',
                        'display' => 'Ο'],
                    ['label' => 'Π', 'cmd' => '\\Pi',
                        'display' => 'Π'],
                    ['label' => 'Ρ', 'write' => 'P',
                        'display' => 'Ρ'],
                    ['label' => 'Σ', 'cmd' => '\\Sigma',
                        'display' => 'Σ'],
                    ['label' => 'Τ', 'write' => 'T',
                        'display' => 'Τ'],
                    ['label' => 'Υ', 'cmd' => '\\Upsilon',
                        'display' => 'Υ'],
                    ['label' => 'Φ', 'cmd' => '\\Phi',
                        'display' => 'Φ'],
                    ['label' => 'Χ', 'write' => 'X',
                        'display' => 'Χ'],
                    ['label' => 'Ψ', 'cmd' => '\\Psi',
                        'display' => 'Ψ'],
                    ['label' => 'Ω', 'cmd' => '\\Omega',
                        'display' => 'Ω'],
                ],
            ],

        ];
    }

    /**
     * Return the default config for which groups are enabled.
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
     * Return all known function names for tex2max/max2tex.
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
     * Return all known constant names.
     *
     * @return array List of constant strings.
     */
    public static function get_constants(): array {
        return ['pi', 'inf', 'minf', 'true', 'false'];
    }

    /**
     * Return operator symbols for tex2max.
     *
     * @return array List of operator strings.
     */
    public static function get_operators(): array {
        return ['*', '/', '+', '-'];
    }

    /**
     * Return comparison operator LaTeX commands.
     *
     * @return array List of comparison strings.
     */
    public static function get_comparison(): array {
        return ['=', '\\neq', '\\leq', '\\geq',
            '<', '>', '\\approx'];
    }

    /**
     * Return Greek letter names for variable detection.
     *
     * @return array List of Greek letter names.
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
     * Return unit names for units input type.
     *
     * @return array List of unit strings.
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
     * Return unit display symbols.
     *
     * @return array Unit name => display symbol.
     */
    public static function get_unit_symbols(): array {
        return [
            'm' => 'm', 'km' => 'km', 'cm' => 'cm',
            'mm' => 'mm', 'nm' => 'nm',
            'um' => 'µm',
            'kg' => 'kg', 'g' => 'g', 'mg' => 'mg',
            'ug' => 'µg',
            's' => 's', 'ms' => 'ms', 'us' => 'µs',
            'ns' => 'ns', 'min' => 'min', 'hr' => 'h',
            'N' => 'N', 'kN' => 'kN', 'mN' => 'mN',
            'Pa' => 'Pa', 'kPa' => 'kPa',
            'MPa' => 'MPa', 'GPa' => 'GPa',
            'bar' => 'bar', 'mbar' => 'mbar',
            'J' => 'J', 'kJ' => 'kJ', 'MJ' => 'MJ',
            'eV' => 'eV', 'keV' => 'keV',
            'MeV' => 'MeV',
            'W' => 'W', 'kW' => 'kW', 'MW' => 'MW',
            'A' => 'A', 'mA' => 'mA', 'uA' => 'µA',
            'V' => 'V', 'kV' => 'kV', 'mV' => 'mV',
            'C' => 'C',
            'F' => 'F', 'uF' => 'µF', 'nF' => 'nF',
            'pF' => 'pF',
            'Ohm' => 'Ω', 'kOhm' => 'kΩ',
            'MOhm' => 'MΩ',
            'H' => 'H', 'mH' => 'mH', 'uH' => 'µH',
            'T' => 'T', 'mT' => 'mT',
            'Hz' => 'Hz', 'kHz' => 'kHz',
            'MHz' => 'MHz', 'GHz' => 'GHz',
            'mol' => 'mol', 'K' => 'K',
            'cd' => 'cd', 'lm' => 'lm', 'lx' => 'lx',
        ];
    }

    /**
     * Return function names for LaTeX detection.
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
     * Return reserved Maxima words.
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
     * Return names treated as % constants in Maxima.
     *
     * @return array List of percent-prefixed names.
     */
    public static function get_percent_constants(): array {
        return ['%pi', '%e', '%i', '%phi', '%gamma'];
    }

    /**
     * Export all definitions for JavaScript modules.
     *
     * @return array Data structure for JSON encoding.
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
     * Get group labels with example elements for settings UI.
     *
     * @return array key => label string.
     */
    public static function get_group_labels_with_examples(): array {
        $groups = self::get_element_groups();
        $result = [];
        foreach ($groups as $key => $group) {
            $label = $group['label'] ?? $key;
            $examples = [];
            $elements = $group['elements'] ?? [];
            $count = 0;
            foreach ($elements as $el) {
                if ($count >= 3) {
                    $examples[] = '...';
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
}

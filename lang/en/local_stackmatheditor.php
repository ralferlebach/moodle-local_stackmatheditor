<?php
// This file is part of Moodle - http://moodle.org/
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
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * English language strings for local_stackmatheditor.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Ralf Erlebach
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

$string['pluginname'] = 'STACK MathQuill Editor';

// ── Admin settings (instance level) ─────────────────────────────────────────
$string['setting_enabled'] = 'Plugin activation (instance-wide)';
$string['setting_enabled_desc'] = 'Controls how the visual math editor is enabled across the instance.';
$string['enabled_mode_0'] = 'Completely disabled (no override at quiz or question level)';
$string['enabled_mode_1'] = 'Completely enabled (no override at quiz or question level)';
$string['enabled_mode_2'] = 'Off by default – can be enabled per quiz or question';
$string['enabled_mode_3'] = 'On by default – can be disabled per quiz or question';
$string['setting_variablemode'] = 'Variable mode (default)';
$string['setting_variablemode_desc'] = 'Determines how consecutive letters are interpreted. "Single character": ab = a×b. "Multi-character": ab = a variable named ab.';
$string['variablemode_single'] = 'Single-character variables (ab → a·b)';
$string['variablemode_multi'] = 'Multi-character variables (ab → ab)';
$string['setting_defaultgroups'] = 'Default toolbar groups';
$string['setting_defaultgroups_desc'] = 'Select the toolbar groups enabled by default. Hold Ctrl/Cmd for multi-select. Can be overridden per quiz or question.';
$string['setting_defaultgroups_help'] = 'Select which toolbar element groups are available in the MathQuill editor. Hold Ctrl (Cmd on Mac) to select multiple groups.';

// ── Configure page – question level ──────────────────────────────────────────
$string['configure'] = 'Configure MathQuill toolbar';
$string['configure_heading'] = 'MathQuill toolbar for: {$a}';
$string['configure_editor'] = 'Configure editor';
$string['config_saved'] = 'Toolbar configuration saved.';
$string['save'] = 'Save configuration';
$string['back'] = 'Back';
$string['label_variablemode'] = 'Variable mode for this question';
$string['label_variablemode_quiz'] = 'Variable mode (default for this quiz)';
$string['questionpreview'] = 'Question preview';
$string['notstackquestion'] = 'This question is not a STACK question.';
$string['cannotresolveqbeid'] = 'The question bank entry could not be resolved.';

// ── Configure page – quiz level ───────────────────────────────────────────────
$string['configure_quiz'] = 'MathQuill default settings for this quiz';
$string['configure_quiz_heading'] = 'MathQuill default settings for quiz: {$a}';
$string['configure_quiz_nav'] = 'Set up STACK MathQuill Editor';
$string['configure_quiz_note'] = 'These settings apply as defaults to all STACK questions in this quiz. They can be overridden for individual questions.';

// ── Enabled toggle ───────────────────────────────────────────────────────────
$string['configure_enabled_header'] = 'Plugin activation';
$string['configure_enabled_label'] = 'Enable MathQuill editor';
$string['configure_enabled_desc'] = 'Enable or disable the editor for this quiz or question. Overrides the parent-level setting.';
$string['configure_enabled_label_help'] = 'If the parent-level default is "enabled", you can disable the editor here for this quiz or question — and vice versa.';
$string['configure_enabled_checkboxlabel_quiz'] = 'Enable MathQuill editor for this quiz';
$string['configure_enabled_checkboxlabel_question'] = 'Enable MathQuill editor for this question';
$string['configure_enabled_locked_on'] = 'Globally enabled – this setting cannot be overridden here.';
$string['configure_enabled_locked_off'] = 'Globally disabled – this setting cannot be overridden here.';
$string['configure_enabled_parenthint_on'] = 'Parent default: enabled. The checkbox disables the editor for this quiz / question only.';
$string['configure_enabled_parenthint_off'] = 'Parent default: disabled. The checkbox enables the editor for this quiz / question.';

// ── Toolbar group names ───────────────────────────────────────────────────────
$string['group_absolute']               = 'Absolute value';
$string['group_analysis_operators']     = 'Calculus operators';
$string['group_basic_operators']        = 'Basic arithmetic';
$string['group_brackets']               = 'Brackets';
$string['group_comparators']            = 'Comparison operators';
$string['group_constants_math']         = 'Mathematical constants';
$string['group_constants_nature']       = 'Physical constants';
$string['group_differential_operators'] = 'Differential calculus';
$string['group_exponential_log']        = 'Exponential / logarithm';
$string['group_geometry']               = 'Geometry';
$string['group_greek_lower']            = 'Greek letters (lowercase)';
$string['group_greek_upper']            = 'Greek letters (uppercase)';
$string['group_hyperbolic']             = 'Hyperbolic functions';
$string['group_integral_operators']     = 'Integral calculus';
$string['group_logic']                  = 'Logic';
$string['group_matrix_operators']       = 'Matrices';
$string['group_power_root']             = 'Powers and roots';
$string['group_set_theory']             = 'Set theory';
$string['group_statistical_operators']  = 'Statistics';
$string['group_trigonometry']           = 'Trigonometry';
$string['group_vector_differential']    = 'Vector differential';
$string['group_vector_operators']       = 'Vectors';

// ── Button tooltips ───────────────────────────────────────────────────────────
$string['btn_cdot'] = 'Multiplication (·)';
$string['btn_div'] = 'Division (÷)';
$string['btn_fraction'] = 'Fraction';
$string['btn_percent'] = 'Percent (%)';
$string['btn_power'] = 'Power (xⁿ)';
$string['btn_sqrt'] = 'Square root (√)';
$string['btn_nthroot'] = 'n-th root (ⁿ√)';
$string['btn_neq'] = 'Not equal (≠)';
$string['btn_approx'] = 'Approximately equal (≈)';
$string['btn_leq'] = 'Less than or equal (≤)';
$string['btn_geq'] = 'Greater than or equal (≥)';
$string['btn_abs'] = 'Absolute value |x|';
$string['btn_in'] = 'Element of (∈)';
$string['btn_notin'] = 'Not element of (∉)';
$string['btn_cup'] = 'Union (∪)';
$string['btn_cap'] = 'Intersection (∩)';
$string['btn_setminus'] = 'Set difference (∖)';
$string['btn_subset'] = 'Subset of (⊂)';
$string['btn_supset'] = 'Superset of (⊃)';
$string['btn_naturals'] = 'Natural numbers (ℕ)';
$string['btn_integers'] = 'Integers (ℤ)';
$string['btn_rationals'] = 'Rational numbers (ℚ)';
$string['btn_reals'] = 'Real numbers (ℝ)';
$string['btn_complex'] = 'Complex numbers (ℂ)';
$string['btn_forall'] = 'For all (∀)';
$string['btn_exists'] = 'There exists (∃)';
$string['btn_nexists'] = 'There does not exist (∄)';
$string['btn_neg'] = 'Logical NOT (¬)';
$string['btn_logical_and'] = 'Logical AND (∧)';
$string['btn_logical_or'] = 'Logical OR (∨)';
$string['btn_implies'] = 'Implies (⇒)';
$string['btn_impliedby'] = 'Is implied by (⇐)';
$string['btn_iff'] = 'If and only if (⇔)';
$string['btn_round_brackets'] = 'Round brackets ( )';
$string['btn_square_brackets'] = 'Square brackets [ ]';
$string['btn_curly_brackets'] = 'Curly brackets { }';
$string['btn_pi'] = 'Pi (π = 3.14159…)';
$string['btn_infty'] = 'Infinity (∞)';
$string['btn_euler'] = 'Euler\'s number (e = 2.718…)';
$string['btn_imaginary'] = 'Imaginary unit (i)';
$string['btn_speed_of_light'] = 'Speed of light (c₀)';
$string['btn_hbar'] = 'Reduced Planck constant (ℏ)';
$string['btn_gravitational'] = 'Gravitational constant (G)';
$string['btn_electron_charge'] = 'Elementary charge (e⁻)';
$string['btn_boltzmann'] = 'Boltzmann constant (k_B)';
$string['btn_permittivity'] = 'Electric permittivity (ε₀)';
$string['btn_permeability'] = 'Magnetic permeability (μ₀)';
$string['btn_overline'] = 'Line segment (overline)';
$string['btn_degree'] = 'Degree (°)';
$string['btn_angle'] = 'Angle (∠)';
$string['btn_perp'] = 'Perpendicular (⊥)';
$string['btn_arcsin'] = 'Arcsine (asin)';
$string['btn_arccos'] = 'Arccosine (acos)';
$string['btn_arctan'] = 'Arctangent (atan)';
$string['btn_sum'] = 'Sum (∑)';
$string['btn_prod'] = 'Product (∏)';
$string['btn_vec'] = 'Vector arrow (v⃗)';
$string['btn_norm'] = 'Norm / magnitude (‖v‖)';
$string['btn_cross'] = 'Cross product (×)';
$string['btn_deriv'] = 'Derivative (d/dx)';
$string['btn_partial'] = 'Partial derivative (∂/∂x)';
$string['btn_nabla'] = 'Nabla / del operator (∇)';
$string['btn_laplacian'] = 'Laplace operator (Δ)';
$string['btn_grad'] = 'Gradient (grad)';
$string['btn_div_op'] = 'Divergence (div)';
$string['btn_rot'] = 'Curl / rotation (rot)';
$string['btn_unity_matrix'] = 'Identity matrix (𝟙)';
$string['btn_transpose'] = 'Transpose (Aᵀ)';
$string['btn_conjugate'] = 'Complex conjugate (A*)';
$string['btn_adjoint'] = 'Hermitian conjugate (A†)';
$string['btn_integral'] = 'Integral (∫)';
$string['btn_contour_integral'] = 'Contour integral (∮)';
$string['btn_factorial'] = 'Factorial (n!)';
$string['btn_binomial'] = 'Binomial coefficient C(n,k)';
$string['btn_expected_value'] = 'Expected value E[X]';
$string['btn_std_dev'] = 'Standard deviation (σ)';
$string['btn_gamma_func'] = 'Gamma function (Γ)';
$string['btn_alpha'] = 'Alpha (α)';
$string['btn_beta'] = 'Beta (β)';
$string['btn_gamma'] = 'Gamma (γ)';
$string['btn_delta'] = 'Delta (δ)';
$string['btn_epsilon'] = 'Epsilon (ε)';
$string['btn_zeta'] = 'Zeta (ζ)';
$string['btn_eta'] = 'Eta (η)';
$string['btn_theta'] = 'Theta (θ)';
$string['btn_iota'] = 'Iota (ι)';
$string['btn_kappa'] = 'Kappa (κ)';
$string['btn_lambda'] = 'Lambda (λ)';
$string['btn_mu'] = 'Mu (μ)';
$string['btn_nu'] = 'Nu (ν)';
$string['btn_xi'] = 'Xi (ξ)';
$string['btn_omicron'] = 'Omicron (ο)';
$string['btn_pi_greek'] = 'Pi (π)';
$string['btn_rho'] = 'Rho (ρ)';
$string['btn_sigma'] = 'Sigma (σ)';
$string['btn_tau'] = 'Tau (τ)';
$string['btn_upsilon'] = 'Upsilon (υ)';
$string['btn_phi'] = 'Phi (φ)';
$string['btn_chi'] = 'Chi (χ)';
$string['btn_psi'] = 'Psi (ψ)';
$string['btn_omega'] = 'Omega (ω)';
$string['btn_Alpha'] = 'Alpha (Α)';
$string['btn_Beta'] = 'Beta (Β)';
$string['btn_Gamma'] = 'Gamma (Γ)';
$string['btn_Delta'] = 'Delta (Δ)';
$string['btn_Epsilon'] = 'Epsilon (Ε)';
$string['btn_Zeta'] = 'Zeta (Ζ)';
$string['btn_Eta'] = 'Eta (Η)';
$string['btn_Theta'] = 'Theta (Θ)';
$string['btn_Iota'] = 'Iota (Ι)';
$string['btn_Kappa'] = 'Kappa (Κ)';
$string['btn_Lambda'] = 'Lambda (Λ)';
$string['btn_Mu'] = 'Mu (Μ)';
$string['btn_Nu'] = 'Nu (Ν)';
$string['btn_Xi'] = 'Xi (Ξ)';
$string['btn_Omicron'] = 'Omicron (Ο)';
$string['btn_Pi'] = 'Pi (Π)';
$string['btn_Rho'] = 'Rho (Ρ)';
$string['btn_Sigma'] = 'Sigma (Σ)';
$string['btn_Tau'] = 'Tau (Τ)';
$string['btn_Upsilon'] = 'Upsilon (Υ)';
$string['btn_Phi'] = 'Phi (Φ)';
$string['btn_Chi'] = 'Chi (Χ)';
$string['btn_Psi'] = 'Psi (Ψ)';
$string['btn_Omega'] = 'Omega (Ω)';

// ── Unit strings ─────────────────────────────────────────────────────────────────
$string['unit_a']         = 'Ampere (current)';
$string['unit_atm']       = 'Atmosphere (pressure)';
$string['unit_bar']       = 'Bar (pressure)';
$string['unit_c_coulomb'] = 'Coulomb (charge)';
$string['unit_cal']       = 'Calorie (energy)';
$string['unit_cm']        = 'Centimetre (length)';
$string['unit_dl']        = 'Decilitre (volume)';
$string['unit_ev']        = 'Electron volt (energy)';
$string['unit_f']         = 'Farad (capacitance)';
$string['unit_ft']        = 'Foot (length)';
$string['unit_g']         = 'Gram (mass)';
$string['unit_ghz']       = 'Gigahertz (frequency)';
$string['unit_h']         = 'Hour (time)';
$string['unit_hr']        = 'Hour (time)';
$string['unit_hz']        = 'Hertz (frequency)';
$string['unit_j']         = 'Joule (energy)';
$string['unit_k']         = 'Kelvin (temperature)';
$string['unit_kcal']      = 'Kilocalorie (energy)';
$string['unit_kg']        = 'Kilogram (mass)';
$string['unit_khz']       = 'Kilohertz (frequency)';
$string['unit_kj']        = 'Kilojoule (energy)';
$string['unit_km']        = 'Kilometre (length)';
$string['unit_kn']        = 'Kilonewton (force)';
$string['unit_kpa']       = 'Kilopascal (pressure)';
$string['unit_kv']        = 'Kilovolt (voltage)';
$string['unit_kw']        = 'Kilowatt (power)';
$string['unit_l']         = 'Litre (volume)';
$string['unit_lb']        = 'Pound (mass)';
$string['unit_m']         = 'Metre (length)';
$string['unit_ma']        = 'Milliampere (current)';
$string['unit_mg']        = 'Milligram (mass)';
$string['unit_mhz']       = 'Megahertz (frequency)';
$string['unit_mi']        = 'Mile (length)';
$string['unit_min']       = 'Minute (time)';
$string['unit_mj']        = 'Megajoule (energy)';
$string['unit_ml']        = 'Millilitre (volume)';
$string['unit_mm']        = 'Millimetre (length)';
$string['unit_mol']       = 'Mole (amount of substance)';
$string['unit_mpa']       = 'Megapascal (pressure)';
$string['unit_ms']        = 'Millisecond (time)';
$string['unit_mw']        = 'Megawatt (power)';
$string['unit_n']         = 'Newton (force)';
$string['unit_nm']        = 'Nanometre (length)';
$string['unit_ohm']       = 'Ohm (resistance)';
$string['unit_oz']        = 'Ounce (mass)';
$string['unit_pa']        = 'Pascal (pressure)';
$string['unit_s']         = 'Second (time)';
$string['unit_t']         = 'Tonne (mass)';
$string['unit_um']        = 'Micrometre (length)';
$string['unit_v']         = 'Volt (voltage)';
$string['unit_w']         = 'Watt (power)';
$string['unit_yd']        = 'Yard (length)';

// ── Privacy ───────────────────────────────────────────────────────────────────────
$string['privacy:metadata:allowed_elements'] = 'JSON toolbar configuration including _enabled and _variableMode flags.';
$string['privacy:metadata:cmid'] = 'The course module ID of the quiz.';
$string['privacy:metadata:local_stackmatheditor'] = 'Stores toolbar configuration per quiz and question (or as a quiz default when questionbankentryid is NULL).';
$string['privacy:metadata:questionbankentryid'] = 'The question bank entry ID (version-independent); NULL = quiz-level default.';
$string['privacy:metadata:usermodified'] = 'The person who last modified the configuration.';


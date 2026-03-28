<?php
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
 * German language strings for local_stackmatheditor.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

$string['pluginname'] = 'STACK MathQuill Editor';

// Administrationseinstellungen.
$string['setting_enabled'] = 'Plugin-Aktivierung (instanzweit)';
$string['setting_enabled_desc'] = 'Legt fest, ob und wie der visuelle Mathe-Editor instanzweit gesteuert wird.';
$string['enabled_mode_0'] = 'Komplett deaktiviert (kein Override auf Test- oder Frageebene möglich)';
$string['enabled_mode_1'] = 'Komplett aktiviert (kein Override auf Test- oder Frageebene möglich)';
$string['enabled_mode_2'] = 'Standardmäßig deaktiviert – kann in einzelnen Tests oder Fragen aktiviert werden';
$string['enabled_mode_3'] = 'Standardmäßig aktiviert – kann in einzelnen Tests oder Fragen deaktiviert werden';
$string['setting_variablemode'] = 'Umgang mit impliziter Multiplikation (Standard)';
$string['setting_variablemode_desc'] = 'Legt fest, wie implizite Multiplikation bei der Übersetzung der MathQuill-Eingabe behandelt wird.';
$string['implicitmode_explicit_single'] = 'explizit ausführen, von Einzelzeichen-Variablen ausgehen (2ab → 2*a*b)';
$string['implicitmode_explicit_multi'] = 'explizit ausführen, von Mehrzeichen-Variablen ausgehen (2ab → 2*ab)';
$string['implicitmode_space_single'] = 'Leerzeichentrennung, von Einzelzeichen-Variablen ausgehen (2ab → 2 a b)';
$string['implicitmode_space_multi'] = 'Leerzeichentrennung, von Mehrzeichen-Variablen ausgehen (2ab → 2 ab)';
$string['implicitmode_stack'] = 'unbehandelt lassen, Behandlung durch STACK ("Sternchen-Optionen")';
$string['setting_defaultgroups'] = 'Standard-Toolbar-Gruppen';
$string['setting_defaultgroups_desc'] = 'Wählen Sie die standardmäßig aktivierten Toolbar-Gruppen. Strg/Cmd gedrückt halten für Mehrfachauswahl. Kann pro Test oder Frage überschrieben werden.';
$string['setting_defaultgroups_help'] = 'Wählen Sie, welche Toolbar-Elementgruppen im MathQuill-Editor verfügbar sein sollen. Halten Sie Strg (Cmd auf Mac) gedrückt, um mehrere Gruppen auszuwählen.';

// Konfigurationsseite – Frageebene.
$string['configure'] = 'MathQuill-Toolbar konfigurieren';
$string['configure_heading'] = 'MathQuill-Toolbar für: {$a}';
$string['configure_editor'] = 'Editor einrichten';
$string['config_saved'] = 'Toolbar-Konfiguration gespeichert.';
$string['save'] = 'Konfiguration speichern';
$string['back'] = 'Zurück';
$string['label_variablemode'] = 'Umgang mit impliziter Multiplikation für diese Frage';
$string['label_variablemode_quiz'] = 'Umgang mit impliziter Multiplikation (Standard für diesen Test)';
$string['questionpreview'] = 'Fragenvorschau';
$string['notstackquestion'] = 'Diese Frage ist keine STACK-Frage.';
$string['cannotresolveqbeid'] = 'Der Fragenbank-Eintrag konnte nicht aufgelöst werden.';

// Konfigurationsseite – Testebene (mod_quiz).
$string['configure_quiz'] = 'MathQuill-Standardeinstellungen für diesen Test';
$string['configure_quiz_heading'] = 'MathQuill-Standardeinstellungen für Test: {$a}';
$string['configure_quiz_nav'] = 'STACK MathQuill-Editor einrichten';
$string['configure_quiz_note'] = 'Diese Einstellungen gelten als Voreinstellung für alle STACK-Fragen in diesem Test. Sie können für einzelne Fragen überschrieben werden.';

// Konfigurationsseite – Aktivitätsebene (mod_adaptivequiz).
$string['configure_adaptivequiz'] = 'MathQuill-Standardeinstellungen für diesen adaptiven Test';
$string['configure_adaptivequiz_heading'] = 'MathQuill-Standardeinstellungen für adaptiven Test: {$a}';
$string['configure_adaptivequiz_note'] = 'Diese Einstellungen gelten für alle STACK-Fragen in diesem adaptiven Test.';

// Aktivierungsschalter.
$string['configure_enabled_header'] = 'Plugin-Aktivierung';
$string['configure_enabled_label'] = 'MathQuill-Editor aktivieren';
$string['configure_enabled_desc'] = 'Aktivieren oder deaktivieren Sie den Editor für diesen Test bzw. diese Frage. Überschreibt die übergeordnete Einstellung.';
$string['configure_enabled_label_help'] = 'Wenn der übergeordnete Standard „aktiviert" ist, können Sie den Editor hier für diesen Test oder diese Frage deaktivieren – und umgekehrt.';
$string['configure_enabled_checkboxlabel_quiz'] = 'MathQuill-Editor für diesen Test einschalten';
$string['configure_enabled_checkboxlabel_adaptivequiz'] = 'MathQuill-Editor für diesen adaptiven Test einschalten';
$string['configure_enabled_checkboxlabel_question'] = 'MathQuill-Editor für diese Frage einschalten';
$string['configure_enabled_locked_on'] = 'Global aktiviert – diese Einstellung kann hier nicht überschrieben werden.';
$string['configure_enabled_locked_off'] = 'Global deaktiviert – diese Einstellung kann hier nicht überschrieben werden.';
$string['configure_enabled_parenthint_on'] = 'Übergeordnete Voreinstellung: aktiviert. Die Checkbox deaktiviert den Editor nur für diesen Test / diese Frage.';
$string['configure_enabled_parenthint_off'] = 'Übergeordnete Voreinstellung: deaktiviert. Die Checkbox aktiviert den Editor für diesen Test / diese Frage.';

// Toolbar-Gruppenbezeichnungen.
$string['group_absolute']               = 'Betrag';
$string['group_analysis_operators']     = 'Analysis-Operatoren';
$string['group_basic_operators']        = 'Grundrechenarten';
$string['group_brackets']               = 'Klammern';
$string['group_comparators']            = 'Vergleichsoperatoren';
$string['group_constants_math']         = 'Konstanten (Mathematik)';
$string['group_constants_nature']       = 'Konstanten (Natur)';
$string['group_differential_operators'] = 'Differentialrechnung';
$string['group_exponential_log']        = 'Exponential / Logarithmus';
$string['group_geometry']               = 'Geometrie';
$string['group_greek_lower']            = 'Griechisch (klein)';
$string['group_greek_upper']            = 'Griechisch (groß)';
$string['group_hyperbolic']             = 'Hyperbelfunktionen';
$string['group_integral_operators']     = 'Integralrechnung';
$string['group_logic']                  = 'Logik';
$string['group_matrix_operators']       = 'Matrizen';
$string['group_power_root']             = 'Potenzen und Wurzeln';
$string['group_set_theory']             = 'Mengenlehre';
$string['group_statistical_operators']  = 'Stochastik';
$string['group_trigonometry']           = 'Trigonometrie';
$string['group_vector_differential']    = 'Vektordifferential';
$string['group_vector_operators']       = 'Vektoren';

// Button-Tooltips.
$string['btn_cdot'] = 'Multiplikation (·)';
$string['btn_div'] = 'Division (÷)';
$string['btn_fraction'] = 'Bruch';
$string['btn_percent'] = 'Prozent (%)';
$string['btn_power'] = 'Potenz (xⁿ)';
$string['btn_sqrt'] = 'Quadratwurzel (√)';
$string['btn_nthroot'] = 'n-te Wurzel (ⁿ√)';
$string['btn_neq'] = 'Ungleich (≠)';
$string['btn_approx'] = 'Ungefähr gleich (≈)';
$string['btn_leq'] = 'Kleiner gleich (≤)';
$string['btn_geq'] = 'Größer gleich (≥)';
$string['btn_abs'] = 'Absolutbetrag |x|';
$string['btn_in'] = 'Element von (∈)';
$string['btn_notin'] = 'Kein Element von (∉)';
$string['btn_cup'] = 'Vereinigung (∪)';
$string['btn_cap'] = 'Schnittmenge (∩)';
$string['btn_setminus'] = 'Mengendifferenz (∖)';
$string['btn_subset'] = 'Teilmenge (⊂)';
$string['btn_supset'] = 'Obermenge (⊃)';
$string['btn_naturals'] = 'Natürliche Zahlen (ℕ)';
$string['btn_integers'] = 'Ganze Zahlen (ℤ)';
$string['btn_rationals'] = 'Rationale Zahlen (ℚ)';
$string['btn_reals'] = 'Reelle Zahlen (ℝ)';
$string['btn_complex'] = 'Komplexe Zahlen (ℂ)';
$string['btn_forall'] = 'Für alle (∀)';
$string['btn_exists'] = 'Es existiert (∃)';
$string['btn_nexists'] = 'Es existiert nicht (∄)';
$string['btn_neg'] = 'Logisches NICHT (¬)';
$string['btn_logical_and'] = 'Logisches UND (∧)';
$string['btn_logical_or'] = 'Logisches ODER (∨)';
$string['btn_implies'] = 'Implikation (⇒)';
$string['btn_impliedby'] = 'Rückimplikation (⇐)';
$string['btn_iff'] = 'Äquivalenz (⇔)';
$string['btn_round_brackets'] = 'Runde Klammern ( )';
$string['btn_square_brackets'] = 'Eckige Klammern [ ]';
$string['btn_curly_brackets'] = 'Geschweifte Klammern { }';
$string['btn_pi'] = 'Pi (π = 3,14159…)';
$string['btn_infty'] = 'Unendlich (∞)';
$string['btn_euler'] = 'Eulersche Zahl (e = 2,718…)';
$string['btn_imaginary'] = 'Imaginäre Einheit (i)';
$string['btn_speed_of_light'] = 'Lichtgeschwindigkeit (c₀)';
$string['btn_hbar'] = 'Reduziertes Plancksches Wirkungsquantum (ℏ)';
$string['btn_gravitational'] = 'Gravitationskonstante (G)';
$string['btn_electron_charge'] = 'Elementarladung (e⁻)';
$string['btn_boltzmann'] = 'Boltzmann-Konstante (k_B)';
$string['btn_permittivity'] = 'Elektrische Feldkonstante (ε₀)';
$string['btn_permeability'] = 'Magnetische Feldkonstante (μ₀)';
$string['btn_overline'] = 'Strecke (Überstrich)';
$string['btn_degree'] = 'Grad (°)';
$string['btn_angle'] = 'Winkel (∠)';
$string['btn_perp'] = 'Senkrecht (⊥)';
$string['btn_arcsin'] = 'Arkussinus (asin)';
$string['btn_arccos'] = 'Arkuskosinus (acos)';
$string['btn_arctan'] = 'Arkustangens (atan)';
$string['btn_sum'] = 'Summe (∑)';
$string['btn_prod'] = 'Produkt (∏)';
$string['btn_vec'] = 'Vektorpfeil (v⃗)';
$string['btn_norm'] = 'Norm / Betrag (‖v‖)';
$string['btn_cross'] = 'Kreuzprodukt (×)';
$string['btn_deriv'] = 'Ableitung (d/dx)';
$string['btn_partial'] = 'Partielle Ableitung (∂/∂x)';
$string['btn_nabla'] = 'Nabla-Operator (∇)';
$string['btn_laplacian'] = 'Laplace-Operator (Δ)';
$string['btn_grad'] = 'Gradient (grad)';
$string['btn_div_op'] = 'Divergenz (div)';
$string['btn_rot'] = 'Rotation (rot)';
$string['btn_unity_matrix'] = 'Einheitsmatrix (𝟙)';
$string['btn_transpose'] = 'Transponierte (Aᵀ)';
$string['btn_conjugate'] = 'Komplex Konjugierte (A*)';
$string['btn_adjoint'] = 'Hermitesch Konjugierte / Adjungierte (A†)';
$string['btn_integral'] = 'Integral (∫)';
$string['btn_contour_integral'] = 'Kurvenintegral (∮)';
$string['btn_factorial'] = 'Fakultät (n!)';
$string['btn_binomial'] = 'Binomialkoeffizient C(n,k)';
$string['btn_expected_value'] = 'Erwartungswert E[X]';
$string['btn_std_dev'] = 'Standardabweichung (σ)';
$string['btn_gamma_func'] = 'Gammafunktion (Γ)';
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
$string['btn_omicron'] = 'Omikron (ο)';
$string['btn_pi_greek'] = 'Pi (π)';
$string['btn_rho'] = 'Rho (ρ)';
$string['btn_sigma'] = 'Sigma (σ)';
$string['btn_tau'] = 'Tau (τ)';
$string['btn_upsilon'] = 'Ypsilon (υ)';
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
$string['btn_Omicron'] = 'Omikron (Ο)';
$string['btn_Pi'] = 'Pi (Π)';
$string['btn_Rho'] = 'Rho (Ρ)';
$string['btn_Sigma'] = 'Sigma (Σ)';
$string['btn_Tau'] = 'Tau (Τ)';
$string['btn_Upsilon'] = 'Ypsilon (Υ)';
$string['btn_Phi'] = 'Phi (Φ)';
$string['btn_Chi'] = 'Chi (Χ)';
$string['btn_Psi'] = 'Psi (Ψ)';
$string['btn_Omega'] = 'Omega (Ω)';

// Einheiten.
$string['unit_a']         = 'Ampere (Strom)';
$string['unit_atm']       = 'Atmosphäre (Druck)';
$string['unit_bar']       = 'Bar (Druck)';
$string['unit_c_coulomb'] = 'Coulomb (Ladung)';
$string['unit_cal']       = 'Kalorie (Energie)';
$string['unit_cm']        = 'Zentimeter (Länge)';
$string['unit_dl']        = 'Deziliter (Volumen)';
$string['unit_ev']        = 'Elektronenvolt (Energie)';
$string['unit_f']         = 'Farad (Kapazität)';
$string['unit_ft']        = 'Fuß (Länge)';
$string['unit_g']         = 'Gramm (Masse)';
$string['unit_ghz']       = 'Gigahertz (Frequenz)';
$string['unit_h']         = 'Stunde (Zeit)';
$string['unit_hr']        = 'Stunde (Zeit)';
$string['unit_hz']        = 'Hertz (Frequenz)';
$string['unit_j']         = 'Joule (Energie)';
$string['unit_k']         = 'Kelvin (Temperatur)';
$string['unit_kcal']      = 'Kilokalorie (Energie)';
$string['unit_kg']        = 'Kilogramm (Masse)';
$string['unit_khz']       = 'Kilohertz (Frequenz)';
$string['unit_kj']        = 'Kilojoule (Energie)';
$string['unit_km']        = 'Kilometer (Länge)';
$string['unit_kn']        = 'Kilonewton (Kraft)';
$string['unit_kpa']       = 'Kilopascal (Druck)';
$string['unit_kv']        = 'Kilovolt (Spannung)';
$string['unit_kw']        = 'Kilowatt (Leistung)';
$string['unit_l']         = 'Liter (Volumen)';
$string['unit_lb']        = 'Pfund (Masse)';
$string['unit_m']         = 'Meter (Länge)';
$string['unit_ma']        = 'Milliampere (Strom)';
$string['unit_mg']        = 'Milligramm (Masse)';
$string['unit_mhz']       = 'Megahertz (Frequenz)';
$string['unit_mi']        = 'Meile (Länge)';
$string['unit_min']       = 'Minute (Zeit)';
$string['unit_mj']        = 'Megajoule (Energie)';
$string['unit_ml']        = 'Milliliter (Volumen)';
$string['unit_mm']        = 'Millimeter (Länge)';
$string['unit_mol']       = 'Mol (Stoffmenge)';
$string['unit_mpa']       = 'Megapascal (Druck)';
$string['unit_ms']        = 'Millisekunde (Zeit)';
$string['unit_mw']        = 'Megawatt (Leistung)';
$string['unit_n']         = 'Newton (Kraft)';
$string['unit_nm']        = 'Nanometer (Länge)';
$string['unit_ohm']       = 'Ohm (Widerstand)';
$string['unit_oz']        = 'Unze (Masse)';
$string['unit_pa']        = 'Pascal (Druck)';
$string['unit_s']         = 'Sekunde (Zeit)';
$string['unit_t']         = 'Tonne (Masse)';
$string['unit_um']        = 'Mikrometer (Länge)';
$string['unit_v']         = 'Volt (Spannung)';
$string['unit_w']         = 'Watt (Leistung)';
$string['unit_yd']        = 'Yard (Länge)';

// Datenschutz.
$string['privacy:metadata:allowed_elements'] = 'JSON-Toolbar-Konfiguration inkl. _enabled- und _variableMode-Flag.';
$string['privacy:metadata:cmid'] = 'Die Kursmodul-ID des Quiz.';
$string['privacy:metadata:local_stackmatheditor'] = 'Speichert die Toolbar-Konfiguration pro Quiz und Frage (oder als Quiz-Standard, wenn questionbankentryid NULL ist).';
$string['privacy:metadata:questionbankentryid'] = 'Die Fragenbank-Eintrags-ID (versionsunabhängig); NULL = Quiz-Standard.';
$string['privacy:metadata:usermodified'] = 'Die Person, die die Konfiguration zuletzt geändert hat.';

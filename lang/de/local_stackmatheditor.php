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
 * German language strings for local_stackmatheditor.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Ralf Erlebach
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

$string['pluginname'] = 'STACK MathQuill Editor';

// ── Administrationseinstellungen (instanzweit) ────────────────────────────────
$string['setting_enabled']      = 'Plugin-Aktivierung (instanzweit)';
$string['setting_enabled_desc'] = 'Legt fest, ob und wie der visuelle Mathe-Editor instanzweit gesteuert wird.';
$string['enabled_mode_0'] = 'Komplett deaktiviert (kein Override auf Test- oder Frageebene möglich)';
$string['enabled_mode_1'] = 'Komplett aktiviert (kein Override auf Test- oder Frageebene möglich)';
$string['enabled_mode_2'] = 'Standardmäßig deaktiviert – kann in einzelnen Tests oder Fragen aktiviert werden';
$string['enabled_mode_3'] = 'Standardmäßig aktiviert – kann in einzelnen Tests oder Fragen deaktiviert werden';

$string['setting_variablemode']      = 'Variablenmodus (Standard)';
$string['setting_variablemode_desc'] = 'Bestimmt, wie aufeinanderfolgende Buchstaben interpretiert werden. „Einzelzeichen": ab = a×b. „Mehrere Zeichen": ab = eine Variable namens ab.';
$string['variablemode_single'] = 'Einzelzeichen-Variablen (ab → a·b)';
$string['variablemode_multi']  = 'Mehrzeichen-Variablen (ab → ab)';

$string['setting_defaultgroups']      = 'Standard-Toolbar-Gruppen';
$string['setting_defaultgroups_desc'] = 'Wählen Sie die standardmäßig aktivierten Toolbar-Gruppen. Strg/Cmd gedrückt halten für Mehrfachauswahl. Kann pro Test oder Frage überschrieben werden.';
$string['setting_defaultgroups_help'] = 'Wählen Sie, welche Toolbar-Elementgruppen im MathQuill-Editor verfügbar sein sollen. Halten Sie Strg (Cmd auf Mac) gedrückt, um mehrere Gruppen auszuwählen.';

// ── Konfigurationsseite – Frageebene ──────────────────────────────────────────
$string['configure']         = 'MathQuill-Toolbar konfigurieren';
$string['configure_heading'] = 'MathQuill-Toolbar für: {$a}';
$string['configure_editor']  = 'Editor einrichten';
$string['config_saved']      = 'Toolbar-Konfiguration gespeichert.';
$string['save']              = 'Konfiguration speichern';
$string['back']              = 'Zurück';
$string['label_variablemode']      = 'Variablenmodus für diese Frage';
$string['label_variablemode_quiz'] = 'Variablenmodus (Standard für diesen Test)';
$string['questionpreview']   = 'Fragenvorschau';
$string['notstackquestion']  = 'Diese Frage ist keine STACK-Frage.';
$string['cannotresolveqbeid'] = 'Der Fragenbank-Eintrag konnte nicht aufgelöst werden.';

// ── Konfigurationsseite – Testebene ───────────────────────────────────────────
$string['configure_quiz']         = 'MathQuill-Standardeinstellungen für diesen Test';
$string['configure_quiz_heading'] = 'MathQuill-Standardeinstellungen für Test: {$a}';
$string['configure_quiz_nav']     = 'STACK MathQuill-Editor einrichten';
$string['configure_quiz_note']    = 'Diese Einstellungen gelten als Voreinstellung für alle STACK-Fragen in diesem Test. Sie können für einzelne Fragen überschrieben werden.';

// ── Aktivierungsschalter in configure.php ─────────────────────────────────────
$string['configure_enabled_header']              = 'Plugin-Aktivierung';
$string['configure_enabled_label']               = 'MathQuill-Editor aktivieren';
$string['configure_enabled_desc']                = 'Aktivieren oder deaktivieren Sie den Editor für diesen Test bzw. diese Frage. Überschreibt die übergeordnete Einstellung.';
$string['configure_enabled_label_help']          = 'Wenn der übergeordnete Standard „aktiviert" ist, können Sie den Editor hier für diesen Test oder diese Frage deaktivieren – und umgekehrt.';
$string['configure_enabled_checkboxlabel_quiz']     = 'MathQuill-Editor für diesen Test einschalten';
$string['configure_enabled_checkboxlabel_question'] = 'MathQuill-Editor für diese Frage einschalten';
$string['configure_enabled_locked_on']           = 'Global aktiviert – diese Einstellung kann hier nicht überschrieben werden.';
$string['configure_enabled_locked_off']          = 'Global deaktiviert – diese Einstellung kann hier nicht überschrieben werden.';
$string['configure_enabled_parenthint_on']       = 'Übergeordnete Voreinstellung: aktiviert. Die Checkbox deaktiviert den Editor nur für diesen Test / diese Frage.';
$string['configure_enabled_parenthint_off']      = 'Übergeordnete Voreinstellung: deaktiviert. Die Checkbox aktiviert den Editor für diesen Test / diese Frage.';

// ── Toolbar-Gruppenbezeichnungen ──────────────────────────────────────────────
$string['group_basic_operators']         = 'Grundrechenarten';
$string['group_power_root']              = 'Potenzen und Wurzeln';
$string['group_exponential_log']         = 'Exponential / Logarithmus';
$string['group_comparators']             = 'Vergleichsoperatoren';
$string['group_absolute']                = 'Betrag';
$string['group_set_theory']              = 'Mengenlehre';
$string['group_logic']                   = 'Logik';
$string['group_brackets']                = 'Klammern';
$string['group_constants_math']          = 'Konstanten (Mathematik)';
$string['group_constants_nature']        = 'Konstanten (Natur)';
$string['group_geometry']                = 'Geometrie';
$string['group_trigonometry']            = 'Trigonometrie';
$string['group_hyperbolic']              = 'Hyperbelfunktionen';
$string['group_analysis_operators']      = 'Analysis-Operatoren';
$string['group_vector_operators']        = 'Vektoren';
$string['group_differential_operators']  = 'Differentialrechnung';
$string['group_vector_differential']     = 'Vektordifferential';
$string['group_matrix_operators']        = 'Matrizen';
$string['group_integral_operators']      = 'Integralrechnung';
$string['group_statistical_operators']   = 'Stochastik';
$string['group_greek_lower']             = 'Griechisch (klein)';
$string['group_greek_upper']             = 'Griechisch (groß)';

// ── Button-Tooltips mit natürlichsprachlichem Inhalt ──────────────────────────
$string['btn_logical_and'] = '∧ (und)';
$string['btn_logical_or']  = '∨ (oder)';

// ── Einheiten ─────────────────────────────────────────────────────────────────
$string['unit_hz']        = 'Hertz (Frequenz)';
$string['unit_khz']       = 'Kilohertz (Frequenz)';
$string['unit_mhz']       = 'Megahertz (Frequenz)';
$string['unit_ghz']       = 'Gigahertz (Frequenz)';
$string['unit_pa']        = 'Pascal (Druck)';
$string['unit_kpa']       = 'Kilopascal (Druck)';
$string['unit_mpa']       = 'Megapascal (Druck)';
$string['unit_bar']       = 'Bar (Druck)';
$string['unit_atm']       = 'Atmosphäre (Druck)';
$string['unit_j']         = 'Joule (Energie)';
$string['unit_kj']        = 'Kilojoule (Energie)';
$string['unit_mj']        = 'Megajoule (Energie)';
$string['unit_ev']        = 'Elektronenvolt (Energie)';
$string['unit_cal']       = 'Kalorie (Energie)';
$string['unit_kcal']      = 'Kilokalorie (Energie)';
$string['unit_w']         = 'Watt (Leistung)';
$string['unit_kw']        = 'Kilowatt (Leistung)';
$string['unit_mw']        = 'Megawatt (Leistung)';
$string['unit_n']         = 'Newton (Kraft)';
$string['unit_kn']        = 'Kilonewton (Kraft)';
$string['unit_v']         = 'Volt (Spannung)';
$string['unit_kv']        = 'Kilovolt (Spannung)';
$string['unit_a']         = 'Ampere (Strom)';
$string['unit_ma']        = 'Milliampere (Strom)';
$string['unit_ohm']       = 'Ohm (Widerstand)';
$string['unit_f']         = 'Farad (Kapazität)';
$string['unit_c_coulomb'] = 'Coulomb (Ladung)';
$string['unit_kg']        = 'Kilogramm (Masse)';
$string['unit_g']         = 'Gramm (Masse)';
$string['unit_mg']        = 'Milligramm (Masse)';
$string['unit_t']         = 'Tonne (Masse)';
$string['unit_lb']        = 'Pfund (Masse)';
$string['unit_oz']        = 'Unze (Masse)';
$string['unit_m']         = 'Meter (Länge)';
$string['unit_km']        = 'Kilometer (Länge)';
$string['unit_cm']        = 'Zentimeter (Länge)';
$string['unit_mm']        = 'Millimeter (Länge)';
$string['unit_nm']        = 'Nanometer (Länge)';
$string['unit_um']        = 'Mikrometer (Länge)';
$string['unit_ft']        = 'Fuß (Länge)';
$string['unit_yd']        = 'Yard (Länge)';
$string['unit_mi']        = 'Meile (Länge)';
$string['unit_s']         = 'Sekunde (Zeit)';
$string['unit_ms']        = 'Millisekunde (Zeit)';
$string['unit_min']       = 'Minute (Zeit)';
$string['unit_h']         = 'Stunde (Zeit)';
$string['unit_hr']        = 'Stunde (Zeit)';
$string['unit_l']         = 'Liter (Volumen)';
$string['unit_ml']        = 'Milliliter (Volumen)';
$string['unit_dl']        = 'Deziliter (Volumen)';
$string['unit_mol']       = 'Mol (Stoffmenge)';
$string['unit_k']         = 'Kelvin (Temperatur)';

// ── Datenschutz ───────────────────────────────────────────────────────────────
$string['privacy:metadata:local_stackmatheditor']     = 'Speichert die Toolbar-Konfiguration pro Quiz und Frage (oder als Quiz-Standard, wenn questionbankentryid NULL ist).';
$string['privacy:metadata:cmid']                      = 'Die Kursmodul-ID des Quiz.';
$string['privacy:metadata:questionbankentryid']       = 'Die Fragenbank-Eintrags-ID (versionsunabhängig); NULL = Quiz-Standard.';
$string['privacy:metadata:allowed_elements']          = 'JSON-Toolbar-Konfiguration inkl. _enabled- und _variableMode-Flag.';
$string['privacy:metadata:usermodified']              = 'Die Person, die die Konfiguration zuletzt geändert hat.';

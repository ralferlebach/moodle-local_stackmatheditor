<?php
defined('MOODLE_INTERNAL') || die();

$string['pluginname'] = 'STACK MathQuill Editor';

// ── Settings (instance level) ─────────────────────────────────────────────────
$string['setting_enabled']      = 'Plugin activation (instance-wide)';
$string['setting_enabled_desc'] = 'Controls how the visual math editor is enabled across the instance.';
$string['enabled_mode_0'] = 'Completely disabled (no override at quiz or question level)';
$string['enabled_mode_1'] = 'Completely enabled (no override at quiz or question level)';
$string['enabled_mode_2'] = 'Off by default – can be enabled per quiz or question';
$string['enabled_mode_3'] = 'On by default – can be disabled per quiz or question';

$string['setting_variablemode']      = 'Variable mode (default)';
$string['setting_variablemode_desc'] = 'Determines how consecutive letters are interpreted. "Single character": ab = a×b. "Multi-character": ab = variable named ab.';
$string['variablemode_single'] = 'Single-character variables (ab → a·b)';
$string['variablemode_multi']  = 'Multi-character variables (ab → ab)';

$string['setting_defaultgroups']      = 'Default toolbar groups';
$string['setting_defaultgroups_desc'] = 'Select the toolbar groups enabled by default. Hold Ctrl/Cmd for multi-select. Can be overridden per quiz or question.';
$string['setting_defaultgroups_help'] = 'Select which toolbar element groups are available in the MathQuill editor. Hold Ctrl (Cmd on Mac) to select multiple groups.';

// ── Configure – question level ────────────────────────────────────────────────
$string['configure']         = 'Configure MathQuill toolbar';
$string['configure_heading'] = 'MathQuill toolbar for: {$a}';
$string['configure_editor']  = 'Configure editor';
$string['config_saved']      = 'Toolbar configuration saved.';
$string['save']              = 'Save configuration';
$string['back']              = 'Back';
$string['label_variablemode']      = 'Variable mode for this question';
$string['label_variablemode_quiz'] = 'Variable mode (default for this quiz)';
$string['questionpreview']   = 'Question preview';
$string['notstackquestion']  = 'This question is not a STACK question.';
$string['cannotresolveqbeid'] = 'The question bank entry could not be resolved.';

// ── Configure – quiz level (NEW) ──────────────────────────────────────────────
$string['configure_quiz']         = 'MathQuill default settings for this quiz';
$string['configure_quiz_heading'] = 'MathQuill default settings for quiz: {$a}';
$string['configure_quiz_nav']     = 'Set up STACK MathQuill Editor';
$string['configure_quiz_note']    = 'These settings act as defaults for all STACK questions in this quiz. They can be overridden per individual question.';

// ── Enabled toggle in configure.php (mode 2 or 3 only) ───────────────────────
$string['configure_enabled_header'] = 'Plugin activation';
$string['configure_enabled_label']  = 'Enable MathQuill editor';
$string['configure_enabled_desc']   = 'Enable or disable the editor for this quiz or question. Overrides the parent-level setting.';
$string['configure_enabled_label_help'] = 'If the parent-level default is "enabled", you can disable the editor here for this quiz or question — and vice versa.';

// ── Toolbar groups ─────────────────────────────────────────────────────────────
$string['group_fractions']    = 'Fractions';
$string['group_powers']       = 'Powers';
$string['group_roots']        = 'Roots';
$string['group_trigonometry'] = 'Trigonometry';
$string['group_hyperbolic']   = 'Hyperbolic functions';
$string['group_logarithms']   = 'Logarithms';
$string['group_constants']    = 'Constants';
$string['group_comparison']   = 'Comparison operators';
$string['group_parentheses']  = 'Parentheses';
$string['group_calculus']     = 'Calculus';
$string['group_greek_lower']  = 'Greek, lowercase';
$string['group_greek_upper']  = 'Greek, uppercase';
$string['group_matrices']     = 'Matrices';

// ── Units (unchanged) ─────────────────────────────────────────────────────────
$string['unit_hz']        = 'Hertz (frequency)';
$string['unit_khz']       = 'Kilohertz (frequency)';
$string['unit_mhz']       = 'Megahertz (frequency)';
$string['unit_ghz']       = 'Gigahertz (frequency)';
$string['unit_pa']        = 'Pascal (pressure)';
$string['unit_kpa']       = 'Kilopascal (pressure)';
$string['unit_mpa']       = 'Megapascal (pressure)';
$string['unit_bar']       = 'Bar (pressure)';
$string['unit_atm']       = 'Atmosphere (pressure)';
$string['unit_j']         = 'Joule (energy)';
$string['unit_kj']        = 'Kilojoule (energy)';
$string['unit_mj']        = 'Megajoule (energy)';
$string['unit_ev']        = 'Electron volt (energy)';
$string['unit_cal']       = 'Calorie (energy)';
$string['unit_kcal']      = 'Kilocalorie (energy)';
$string['unit_w']         = 'Watt (power)';
$string['unit_kw']        = 'Kilowatt (power)';
$string['unit_mw']        = 'Megawatt (power)';
$string['unit_n']         = 'Newton (force)';
$string['unit_kn']        = 'Kilonewton (force)';
$string['unit_v']         = 'Volt (voltage)';
$string['unit_kv']        = 'Kilovolt (voltage)';
$string['unit_a']         = 'Ampere (current)';
$string['unit_ma']        = 'Milliampere (current)';
$string['unit_ohm']       = 'Ohm (resistance)';
$string['unit_f']         = 'Farad (capacitance)';
$string['unit_c_coulomb'] = 'Coulomb (charge)';
$string['unit_kg']        = 'Kilogram (mass)';
$string['unit_g']         = 'Gram (mass)';
$string['unit_mg']        = 'Milligram (mass)';
$string['unit_t']         = 'Tonne (mass)';
$string['unit_lb']        = 'Pound (mass)';
$string['unit_oz']        = 'Ounce (mass)';
$string['unit_m']         = 'Metre (length)';
$string['unit_km']        = 'Kilometre (length)';
$string['unit_cm']        = 'Centimetre (length)';
$string['unit_mm']        = 'Millimetre (length)';
$string['unit_nm']        = 'Nanometre (length)';
$string['unit_um']        = 'Micrometre (length)';
$string['unit_ft']        = 'Foot (length)';
$string['unit_yd']        = 'Yard (length)';
$string['unit_mi']        = 'Mile (length)';
$string['unit_s']         = 'Second (time)';
$string['unit_ms']        = 'Millisecond (time)';
$string['unit_min']       = 'Minute (time)';
$string['unit_h']         = 'Hour (time)';
$string['unit_hr']        = 'Hour (time)';
$string['unit_l']         = 'Litre (volume)';
$string['unit_ml']        = 'Millilitre (volume)';
$string['unit_dl']        = 'Decilitre (volume)';
$string['unit_mol']       = 'Mole (amount)';
$string['unit_k']         = 'Kelvin (temperature)';

// ── Privacy ────────────────────────────────────────────────────────────────────
$string['privacy:metadata:local_stackmatheditor']     = 'Stores toolbar configuration per quiz and question (or as a quiz default when questionbankentryid is NULL).';
$string['privacy:metadata:cmid']                      = 'The course module ID of the quiz.';
$string['privacy:metadata:questionbankentryid']       = 'The question bank entry ID (version-independent); NULL = quiz-level default.';
$string['privacy:metadata:allowed_elements']          = 'JSON toolbar configuration including _enabled and _variableMode flags.';
$string['privacy:metadata:usermodified']              = 'The person who last modified the configuration.';

// ── Enabled toggle – new strings ─────────────────────────────────────────────
$string['configure_enabled_checkboxlabel']  = 'Enable MathQuill editor for this quiz / question';
$string['configure_enabled_locked_on']      = 'Globally enabled – this setting cannot be overridden here.';
$string['configure_enabled_locked_off']     = 'Globally disabled – this setting cannot be overridden here.';
$string['configure_enabled_parenthint_on']  = 'Parent default: enabled. The checkbox disables the editor for this quiz / question only.';
$string['configure_enabled_parenthint_off'] = 'Parent default: disabled. The checkbox enables the editor for this quiz / question.';

<?php
defined('MOODLE_INTERNAL') || die();

// Plugin.
$string['pluginname'] = 'STACK MathQuill Editor';

// Settings.
$string['setting_enabled'] = 'Enable MathQuill Editor';
$string['setting_enabled_desc'] = 'Globally enable or disable the visual math editor for STACK questions.';
$string['setting_variablemode'] = 'Variable mode (default)';
$string['setting_variablemode_desc'] = 'Controls how consecutive letters are interpreted. "Single character": ab = a×b. "Multi character": ab = one variable named ab.';
$string['variablemode_single'] = 'Single character variables (ab → a·b)';
$string['variablemode_multi'] = 'Multi character variables (ab → ab)';
$string['setting_defaultgroups'] = 'Default toolbar groups';
$string['setting_defaultgroups_desc'] = 'Select which toolbar groups are enabled by default for all questions. Can be overridden per question.';

// Element groups.
$string['group_fractions'] = 'Fractions';
$string['group_powers'] = 'Powers / Exponents';
$string['group_roots'] = 'Roots';
$string['group_trigonometry'] = 'Trigonometry';
$string['group_hyperbolic'] = 'Hyperbolic functions';
$string['group_logarithms'] = 'Logarithms';
$string['group_constants'] = 'Constants';
$string['group_comparison'] = 'Comparison operators';
$string['group_parentheses'] = 'Parentheses / Brackets';
$string['group_calculus'] = 'Calculus';
$string['group_greek'] = 'Greek letters';
$string['group_matrices'] = 'Matrices';

// Configure page.
$string['configure'] = 'Configure MathQuill toolbar';
$string['configure_heading'] = 'MathQuill toolbar for: {$a}';
$string['config_saved'] = 'Toolbar configuration saved.';
$string['save'] = 'Save configuration';
$string['label_variablemode'] = 'Variable mode for this question';
$string['notstackquestion'] = 'This question is not a STACK question.';
$string['cannotresolveqbeid'] = 'Could not resolve the question bank entry for this question.';

// Units — Frequency.
$string['unit_hz'] = 'Hertz (frequency)';
$string['unit_khz'] = 'Kilohertz (frequency)';
$string['unit_mhz'] = 'Megahertz (frequency)';
$string['unit_ghz'] = 'Gigahertz (frequency)';
// Units — Pressure.
$string['unit_pa'] = 'Pascal (pressure)';
$string['unit_kpa'] = 'Kilopascal (pressure)';
$string['unit_mpa'] = 'Megapascal (pressure)';
$string['unit_bar'] = 'Bar (pressure)';
$string['unit_atm'] = 'Atmosphere (pressure)';
// Units — Energy / Power.
$string['unit_j'] = 'Joule (energy)';
$string['unit_kj'] = 'Kilojoule (energy)';
$string['unit_mj'] = 'Megajoule (energy)';
$string['unit_ev'] = 'Electronvolt (energy)';
$string['unit_cal'] = 'Calorie (energy)';
$string['unit_kcal'] = 'Kilocalorie (energy)';
$string['unit_w'] = 'Watt (power)';
$string['unit_kw'] = 'Kilowatt (power)';
$string['unit_mw'] = 'Megawatt (power)';
// Units — Force.
$string['unit_n'] = 'Newton (force)';
$string['unit_kn'] = 'Kilonewton (force)';
// Units — Electrical.
$string['unit_v'] = 'Volt (voltage)';
$string['unit_kv'] = 'Kilovolt (voltage)';
$string['unit_a'] = 'Ampere (current)';
$string['unit_ma'] = 'Milliampere (current)';
$string['unit_ohm'] = 'Ohm (resistance)';
$string['unit_f'] = 'Farad (capacitance)';
$string['unit_c_coulomb'] = 'Coulomb (charge)';
// Units — Mass.
$string['unit_kg'] = 'Kilogram (mass)';
$string['unit_g'] = 'Gram (mass)';
$string['unit_mg'] = 'Milligram (mass)';
$string['unit_t'] = 'Tonne (mass)';
$string['unit_lb'] = 'Pound (mass)';
$string['unit_oz'] = 'Ounce (mass)';
// Units — Length.
$string['unit_m'] = 'Metre (length)';
$string['unit_km'] = 'Kilometre (length)';
$string['unit_cm'] = 'Centimetre (length)';
$string['unit_mm'] = 'Millimetre (length)';
$string['unit_nm'] = 'Nanometre (length)';
$string['unit_um'] = 'Micrometre (length)';
$string['unit_ft'] = 'Foot (length)';
$string['unit_yd'] = 'Yard (length)';
$string['unit_mi'] = 'Mile (length)';
// Units — Time.
$string['unit_s'] = 'Second (time)';
$string['unit_ms'] = 'Millisecond (time)';
$string['unit_min'] = 'Minute (time)';
$string['unit_h'] = 'Hour (time)';
$string['unit_hr'] = 'Hour (time)';
// Units — Volume.
$string['unit_l'] = 'Litre (volume)';
$string['unit_ml'] = 'Millilitre (volume)';
$string['unit_dl'] = 'Decilitre (volume)';
// Units — Chemistry / Temperature.
$string['unit_mol'] = 'Mole (amount of substance)';
$string['unit_k'] = 'Kelvin (temperature)';

// Privacy.
$string['privacy:metadata:local_stackmatheditor'] = 'Stores per-quiz per-question toolbar configuration.';
$string['privacy:metadata:cmid'] = 'The course module ID of the quiz.';
$string['privacy:metadata:questionbankentryid'] = 'The question bank entry ID (version-independent).';
$string['privacy:metadata:allowed_elements'] = 'JSON toolbar configuration.';
$string['privacy:metadata:usermodified'] = 'The user who last modified the configuration.';

// Capabilities.
$string['stackmatheditor:configure'] = 'Configure STACK MathQuill Editor toolbar';

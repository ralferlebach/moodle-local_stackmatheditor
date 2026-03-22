<?php
defined('MOODLE_INTERNAL') || die();

$string['pluginname'] = 'STACK MathQuill Editor';

$string['setting_enabled'] = 'MathQuill-Editor aktivieren';
$string['setting_enabled_desc'] = 'Den visuellen Mathe-Editor für STACK-Fragen global aktivieren oder deaktivieren.';
$string['setting_variablemode'] = 'Variablenmodus (Standard)';
$string['setting_variablemode_desc'] = 'Bestimmt, wie aufeinanderfolgende Buchstaben interpretiert werden. „Einzelzeichen": ab = a×b. „Mehrere Zeichen": ab = eine Variable namens ab.';
$string['variablemode_single'] = 'Einzelzeichen-Variablen (ab → a·b)';
$string['variablemode_multi'] = 'Mehrzeichen-Variablen (ab → ab)';
$string['setting_defaultgroups'] = 'Standard-Toolbar-Gruppen';
$string['setting_defaultgroups_desc'] = 'Wählen Sie die standardmäßig aktivierten Toolbar-Gruppen. Strg/Cmd gedrückt halten für Mehrfachauswahl. Kann pro Frage überschrieben werden.';

$string['group_fractions'] = 'Brüche';
$string['group_powers'] = 'Potenzen';
$string['group_roots'] = 'Wurzeln';
$string['group_trigonometry'] = 'Trigonometrie';
$string['group_hyperbolic'] = 'Hyperbolische Funktionen';
$string['group_logarithms'] = 'Logarithmen';
$string['group_constants'] = 'Konstanten';
$string['group_comparison'] = 'Vergleichsoperatoren';
$string['group_parentheses'] = 'Klammern';
$string['group_calculus'] = 'Analysis';
$string['group_greek'] = 'Griechische Buchstaben';
$string['group_matrices'] = 'Matrizen';

$string['configure'] = 'MathQuill-Toolbar konfigurieren';
$string['configure_heading'] = 'MathQuill-Toolbar für: {$a}';
$string['config_saved'] = 'Toolbar-Konfiguration gespeichert.';
$string['save'] = 'Konfiguration speichern';
$string['label_variablemode'] = 'Variablenmodus für diese Frage';
$string['notstackquestion'] = 'Diese Frage ist keine STACK-Frage.';
$string['cannotresolveqbeid'] = 'Der Fragenbank-Eintrag konnte nicht aufgelöst werden.';

$string['unit_hz'] = 'Hertz (Frequenz)';
$string['unit_khz'] = 'Kilohertz (Frequenz)';
$string['unit_mhz'] = 'Megahertz (Frequenz)';
$string['unit_ghz'] = 'Gigahertz (Frequenz)';
$string['unit_pa'] = 'Pascal (Druck)';
$string['unit_kpa'] = 'Kilopascal (Druck)';
$string['unit_mpa'] = 'Megapascal (Druck)';
$string['unit_bar'] = 'Bar (Druck)';
$string['unit_atm'] = 'Atmosphäre (Druck)';
$string['unit_j'] = 'Joule (Energie)';
$string['unit_kj'] = 'Kilojoule (Energie)';
$string['unit_mj'] = 'Megajoule (Energie)';
$string['unit_ev'] = 'Elektronenvolt (Energie)';
$string['unit_cal'] = 'Kalorie (Energie)';
$string['unit_kcal'] = 'Kilokalorie (Energie)';
$string['unit_w'] = 'Watt (Leistung)';
$string['unit_kw'] = 'Kilowatt (Leistung)';
$string['unit_mw'] = 'Megawatt (Leistung)';
$string['unit_n'] = 'Newton (Kraft)';
$string['unit_kn'] = 'Kilonewton (Kraft)';
$string['unit_v'] = 'Volt (Spannung)';
$string['unit_kv'] = 'Kilovolt (Spannung)';
$string['unit_a'] = 'Ampere (Strom)';
$string['unit_ma'] = 'Milliampere (Strom)';
$string['unit_ohm'] = 'Ohm (Widerstand)';
$string['unit_f'] = 'Farad (Kapazität)';
$string['unit_c_coulomb'] = 'Coulomb (Ladung)';
$string['unit_kg'] = 'Kilogramm (Masse)';
$string['unit_g'] = 'Gramm (Masse)';
$string['unit_mg'] = 'Milligramm (Masse)';
$string['unit_t'] = 'Tonne (Masse)';
$string['unit_lb'] = 'Pfund (Masse)';
$string['unit_oz'] = 'Unze (Masse)';
$string['unit_m'] = 'Meter (Länge)';
$string['unit_km'] = 'Kilometer (Länge)';
$string['unit_cm'] = 'Zentimeter (Länge)';
$string['unit_mm'] = 'Millimeter (Länge)';
$string['unit_nm'] = 'Nanometer (Länge)';
$string['unit_um'] = 'Mikrometer (Länge)';
$string['unit_ft'] = 'Fuß (Länge)';
$string['unit_yd'] = 'Yard (Länge)';
$string['unit_mi'] = 'Meile (Länge)';
$string['unit_s'] = 'Sekunde (Zeit)';
$string['unit_ms'] = 'Millisekunde (Zeit)';
$string['unit_min'] = 'Minute (Zeit)';
$string['unit_h'] = 'Stunde (Zeit)';
$string['unit_hr'] = 'Stunde (Zeit)';
$string['unit_l'] = 'Liter (Volumen)';
$string['unit_ml'] = 'Milliliter (Volumen)';
$string['unit_dl'] = 'Deziliter (Volumen)';
$string['unit_mol'] = 'Mol (Stoffmenge)';
$string['unit_k'] = 'Kelvin (Temperatur)';

$string['privacy:metadata:local_stackmatheditor'] = 'Speichert die Toolbar-Konfiguration pro Quiz und Frage.';
$string['privacy:metadata:cmid'] = 'Die Kursmodul-ID des Quiz.';
$string['privacy:metadata:questionbankentryid'] = 'Die Fragenbank-Eintrags-ID (versionsunabhängig).';
$string['privacy:metadata:allowed_elements'] = 'JSON-Toolbar-Konfiguration.';
$string['privacy:metadata:usermodified'] = 'Die Person, die die Konfiguration zuletzt geändert hat.';

$string['stackmatheditor:configure'] = 'STACK MathQuill Editor Toolbar konfigurieren';

$string['questionpreview'] = 'Fragenvorschau';

$string['setting_defaultgroups_help'] = 'Wählen Sie, welche Toolbar-Elementgruppen im MathQuill-Editor für diese Frage verfügbar sein sollen. Halten Sie Strg (Cmd auf Mac) gedrückt, um mehrere Gruppen auszuwählen. Abgewählte Gruppen erscheinen nicht in der Studierenden-Toolbar.';

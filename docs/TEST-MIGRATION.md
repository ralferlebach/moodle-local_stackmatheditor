# Test migration for issue #96: from Behat to the test pyramid

Version 1.4.0 (2026100801). Every Behat scenario instance that existed before #96 is listed below with
the test that now carries its assertion. Nothing was dropped: every row names at least one test that
runs in CI. A scenario outline counts once per example row, which is how Behat counted the 92
scenarios of the baseline.

What stays in Behat is what needs a whole Moodle with a real STACK and a browser and cannot be
checked anywhere else (6 scenarios):

| Feature | Scenario | Why it stays in Behat |
|---|---|---|
| `stack_cas_init.feature` | STACK CAS connection is functional | Preflight: proves the CAS works before anything else runs. |
| `cas_contract.feature` | A matrix from the editor is interpreted by STACK | One end-to-end smoke through MathQuill, the STACK input, STACK's validation and Maxima (`browserSmoke` contract `matrix`). |
| `configure_toolbar.feature` | The quiz navigation offers the editor configuration, and the quiz page opens from it | Moodle navigation hook and page, as a teacher reaches them. |
| `configure_toolbar.feature` | The question configuration opens from the question in the quiz | The icon on the quiz edit page (JavaScript) and the question page. |
| `configure_toolbar.feature` | A saved quiz configuration is still there after reloading | The moodleform save and reload. |
| `configure_toolbar.feature` | A guest calling the configuration page directly gets the login page | Moodle's login redirect. |

Behat runs only in the two matrix cells 4.5/8.2/pgsql and 5.3/8.4/MariaDB 11.4 of the main workflow
(and in the dev workflow); the other cells run PHPUnit, Jest and the code checks.

## Runtime

Baseline from issue #96 (main CI, Behat main suite, before the change):

| Cell | Behat |
|---|---|
| Moodle 4.5 / PHP 8.2 / PostgreSQL | 26:21 min |
| Moodle 4.5 / PHP 8.3 / MariaDB | 21:57 min |
| Moodle 5.0 / PHP 8.2 / MariaDB | 21:08 min |
| Moodle 5.1 / PHP 8.3 / PostgreSQL | 20:45 min |
| Moodle 5.2 / PHP 8.3 / MariaDB | about 23 min (recorded as "22:60") |
| Moodle 5.3 / PHP 8.3 / PostgreSQL | 33:32 min |

About 24 - 25 minutes per cell and about 245 runner minutes per main run over ten cells; about
170 CAS resets with a cache purge per cell. Jest at the time: 20 suites, 1282 tests.

| | Scenarios | Steps | CAS resets per cell | Behat time per main cell |
|---|---:|---:|---:|---|
| Baseline (issue #96, before) | 92 | 1063 | about 170 | 20:45 – 33:32 min, in all ten cells |
| After (local measurement, Moodle 4.5, PHP 8.3, PostgreSQL 16) | 6 | 55 | 0 full resets (cheap repair, no cache purge) | 78.7 s in the scenarios (preflight 29.3 s, suite 49.4 s); 102 s in a second run while a Playwright suite ran on the same machine |

The local numbers come from the timing hook (`SME_BEHAT_TIMINGS`) and `.github/behat-timings.py`:

| Seconds | Feature | Scenario |
|---:|---|---|
| 29.3 | stack_cas_init.feature | STACK CAS connection is functional |
| 16.1 | cas_contract.feature | A matrix from the editor is interpreted by STACK |
| 13.2 | configure_toolbar.feature | The quiz navigation offers the editor configuration, and the quiz page opens from it |
| 12.4 | configure_toolbar.feature | The question configuration opens from the question in the quiz |
| 6.6 | configure_toolbar.feature | A saved quiz configuration is still there after reloading |
| 1.1 | configure_toolbar.feature | A guest calling the configuration page directly gets the login page |

Each CI run with Behat publishes the same table in the job summary and uploads
`behat-timings-<moodle>-<php>-<db>` (JSON, CSV, Markdown, 30 days). The first CI run of 1.4.0 is the
reference for the CI runtime after #96; the step count above is from the local run. Jest now: 28
suites, 3203 tests.

## Where the coverage went

| Layer | What it checks | Files |
|---|---|---|
| Jest (no browser) | Every conversion rule, in every variable mode; property and fuzz tests; the contract fixture through tex2max and through MathQuill in jsdom | `tests/jest/*.test.js`, `tests/fixtures/math_contracts.json` |
| PHPUnit with a real STACK and Maxima | Every contract of `math_contracts.json` through STACK's own validation and the CAS; form, access, return URL and activation logic | `tests/unit/cas_contract_test.php`, `tests/unit/configure_form_test.php` and the other unit tests |
| Playwright | MathQuill in a real attempt: typing, restoring, toolbar templates, external values, multi-line inputs | `tests/playwright/conversion-browser.spec.js`, `editor-rendering.spec.js`, `multiline.spec.js` |
| Behat | The six scenarios above | `tests/behat/*.feature` |

## Mapping of every removed scenario instance

| # | Feature (before) | Line | Scenario | Example | Now covered by |
|---:|---|---:|---|---|---|
| 1 | `tex2max_conversion.feature` | 34 | "or" is not split into o*r in explicit_single mode |  | Jest `behat_conversion.test.js` (same title); Jest `mode_matrix.test.js` |
| 2 | `tex2max_conversion.feature` | 40 | "and" is not split into a*n*d in explicit_single mode |  | Jest `behat_conversion.test.js` (same title); Jest `mode_matrix.test.js` |
| 3 | `tex2max_conversion.feature` | 46 | "not" is not split into n*o*t in explicit_single mode |  | Jest `behat_conversion.test.js` (same title); Jest `mode_matrix.test.js` |
| 4 | `tex2max_conversion.feature` | 54 | Mixed fraction 2+1/2 is grouped correctly |  | Jest `behat_conversion.test.js` (same title); Jest `contract_fixes_96.test.js` (H) |
| 5 | `tex2max_conversion.feature` | 59 | Multi-digit mixed fraction 21+3/4 is grouped correctly |  | Jest `behat_conversion.test.js` (same title) |
| 6 | `tex2max_conversion.feature` | 64 | Regular fraction is not affected by mixed-fraction fix |  | Jest `behat_conversion.test.js` (same title); Jest `contract_fixes_96.test.js` (H) |
| 7 | `tex2max_conversion.feature` | 71 | Pi is rendered as plain "pi" by default (usePercentPi off) |  | Jest `behat_conversion.test.js` (same title); Playwright `conversion-browser.spec.js` "pi is \"pi\" by default …" |
| 8 | `tex2max_conversion.feature` | 76 | Pi is rendered as "%pi" when usePercentPi is enabled |  | Jest `behat_conversion.test.js` (same title); Playwright `conversion-browser.spec.js` "… and \"%pi\" with usePercentPi" |
| 9 | `tex2max_conversion.feature` | 84 | Prefix pm produces two nounor alternatives with unary plus stripped |  | Jest `behat_conversion.test.js` (same title); Jest `plusminus.test.js` |
| 10 | `tex2max_conversion.feature` | 90 | Infix pm retains both plus and minus signs |  | Jest `behat_conversion.test.js` (same title); Jest `plusminus.test.js` |
| 11 | `tex2max_conversion.feature` | 95 | Coupled pm and mp give exactly two alternatives |  | Jest `behat_conversion.test.js` (same title); Jest `plusminus.test.js` |
| 12 | `tex2max_conversion.feature` | 100 | Minus-plus is the mirror image of plus-minus, without a unary plus (#49) |  | Jest `behat_conversion.test.js` (same title); Jest `plusminus.test.js` |
| 13 | `tex2max_conversion.feature` | 106 | A unary pm inside parentheses keeps the parentheses |  | Jest `behat_conversion.test.js` (same title); Jest `plusminus.test.js` |
| 14 | `tex2max_conversion.feature` | 115 | A square root next to plus/minus stays an atomic sqrt call |  | Jest `behat_conversion.test.js` (same title); Jest `tex2max_sqrt.test.js` |
| 15 | `tex2max_conversion.feature` | 129 | The shipped tex2max never splits sqrt, whatever the variable mode | mode=explicit_single | Jest `behat_conversion.test.js` "Square root (#39)" per mode; Jest `mode_matrix.test.js` |
| 16 | `tex2max_conversion.feature` | 130 | The shipped tex2max never splits sqrt, whatever the variable mode | mode=space_single | Jest `behat_conversion.test.js` "Square root (#39)" per mode; Jest `mode_matrix.test.js` |
| 17 | `tex2max_conversion.feature` | 131 | The shipped tex2max never splits sqrt, whatever the variable mode | mode=stack | Jest `behat_conversion.test.js` "Square root (#39)" per mode; Jest `mode_matrix.test.js` |
| 18 | `tex2max_conversion.feature` | 136 | Set membership becomes the STACK predicate elementp |  | Jest `behat_conversion.test.js` (same title); Jest `sets_logic.test.js`; PHPUnit `cas_contract_test.php` (contract `set-theory`) |
| 19 | `tex2max_conversion.feature` | 141 | Set union becomes the STACK function union |  | Jest `behat_conversion.test.js` (same title); Jest `sets_logic.test.js` |
| 20 | `tex2max_conversion.feature` | 146 | A proper subset keeps its strictness |  | Jest `behat_conversion.test.js` (same title); Jest `sets_logic.test.js` |
| 21 | `tex2max_conversion.feature` | 151 | Logic buttons write and/or, not the structural noun operators |  | Jest `behat_conversion.test.js` (same title); PHPUnit `cas_contract_test.php` (contract `logic`) |
| 22 | `tex2max_conversion.feature` | 156 | Implied-by is rewritten as a swapped implication |  | Jest `behat_conversion.test.js` (same title); Jest `sets_logic.test.js` |
| 23 | `tex2max_conversion.feature` | 169 | An operator name inside a longer identifier stays part of it | latex=U\max; expected=Umax | Jest `behat_conversion.test.js` "Identifiers containing an operator name" (each example); Jest `identifiers.test.js` |
| 24 | `tex2max_conversion.feature` | 170 | An operator name inside a longer identifier stays part of it | latex=U\min; expected=Umin | Jest `behat_conversion.test.js` "Identifiers containing an operator name" (each example); Jest `identifiers.test.js` |
| 25 | `tex2max_conversion.feature` | 171 | An operator name inside a longer identifier stays part of it | latex=\max imum; expected=maximum | Jest `behat_conversion.test.js` "Identifiers containing an operator name" (each example); Jest `identifiers.test.js` |
| 26 | `tex2max_conversion.feature` | 172 | An operator name inside a longer identifier stays part of it | latex=\arg\max; expected=argmax | Jest `behat_conversion.test.js` "Identifiers containing an operator name" (each example); Jest `identifiers.test.js` |
| 27 | `tex2max_conversion.feature` | 173 | An operator name inside a longer identifier stays part of it | latex=\log value; expected=logvalue | Jest `behat_conversion.test.js` "Identifiers containing an operator name" (each example); Jest `identifiers.test.js` |
| 28 | `tex2max_conversion.feature` | 174 | An operator name inside a longer identifier stays part of it | latex=\sin value; expected=sinvalue | Jest `behat_conversion.test.js` "Identifiers containing an operator name" (each example); Jest `identifiers.test.js` |
| 29 | `tex2max_conversion.feature` | 177 | An operator name applied to an argument is still a function |  | Jest `behat_conversion.test.js` (same title); Jest `regressions_96.test.js` (B) |
| 30 | `tex2max_conversion.feature` | 191 | A multi-character subscript is one identifier | latex=U_{max}; expected=U_max | Jest `behat_conversion.test.js` "Multi-character subscripts (#59)" (each example); Jest `regressions_96.test.js` (C) |
| 31 | `tex2max_conversion.feature` | 192 | A multi-character subscript is one identifier | latex=U_{eff}; expected=U_eff | Jest `behat_conversion.test.js` "Multi-character subscripts (#59)" (each example); Jest `regressions_96.test.js` (C) |
| 32 | `tex2max_conversion.feature` | 193 | A multi-character subscript is one identifier | latex=x_{12}; expected=x_12 | Jest `behat_conversion.test.js` "Multi-character subscripts (#59)" (each example); Jest `regressions_96.test.js` (C) |
| 33 | `tex2max_conversion.feature` | 202 | Characters after a subscript group stay separate | latex=U_{m}ax; mode=stack; expected=U_m ax | Jest `behat_conversion.test.js` "Multi-character subscripts (#59)" (each example); Jest `regressions_96.test.js` (C) |
| 34 | `tex2max_conversion.feature` | 203 | Characters after a subscript group stay separate | latex=U_{m}ax; mode=explicit_single; expected=U_m*a*x | Jest `behat_conversion.test.js` "Multi-character subscripts (#59)" (each example); Jest `regressions_96.test.js` (C) |
| 35 | `tex2max_conversion.feature` | 204 | Characters after a subscript group stay separate | latex=U_{m}ax; mode=explicit_multi; expected=U_m*ax | Jest `behat_conversion.test.js` "Multi-character subscripts (#59)" (each example); Jest `regressions_96.test.js` (C) |
| 36 | `tex2max_conversion.feature` | 205 | Characters after a subscript group stay separate | latex=U_{e}ff; mode=stack; expected=U_e ff | Jest `behat_conversion.test.js` "Multi-character subscripts (#59)" (each example); Jest `regressions_96.test.js` (C) |
| 37 | `tex2max_conversion.feature` | 219 | An identifier typed on the keyboard stays one identifier | typed=Umax; expected=Umax; latex=Umax | Playwright `conversion-browser.spec.js` "identifiers and functions typed on the keyboard stay what was typed" (each example) |
| 38 | `tex2max_conversion.feature` | 220 | An identifier typed on the keyboard stays one identifier | typed=Umin; expected=Umin; latex=Umin | Playwright `conversion-browser.spec.js` "identifiers and functions typed on the keyboard stay what was typed" (each example) |
| 39 | `tex2max_conversion.feature` | 221 | An identifier typed on the keyboard stays one identifier | typed=argmax; expected=argmax; latex=argmax | Playwright `conversion-browser.spec.js` "identifiers and functions typed on the keyboard stay what was typed" (each example) |
| 40 | `tex2max_conversion.feature` | 222 | An identifier typed on the keyboard stays one identifier | typed=maximum; expected=maximum; latex=maximum | Playwright `conversion-browser.spec.js` "identifiers and functions typed on the keyboard stay what was typed" (each example) |
| 41 | `tex2max_conversion.feature` | 223 | An identifier typed on the keyboard stays one identifier | typed=sinvalue; expected=sinvalue; latex=sinvalue | Playwright `conversion-browser.spec.js` "identifiers and functions typed on the keyboard stay what was typed" (each example) |
| 42 | `tex2max_conversion.feature` | 226 | A function typed on the keyboard is still a function |  | Playwright `conversion-browser.spec.js` "identifiers and functions typed on the keyboard stay what was typed" |
| 43 | `tex2max_conversion.feature` | 231 | A multi-character subscript typed on the keyboard stays one identifier |  | Playwright `conversion-browser.spec.js` "identifiers and functions typed on the keyboard stay what was typed" |
| 44 | `tex2max_conversion.feature` | 237 | The subscript survives being written back into the editor |  | Jest `behat_conversion.test.js` (same title); Jest `property.test.js` (round trip) |
| 45 | `tex2max_conversion.feature` | 246 | A value written from outside appears in the editor |  | Playwright `conversion-browser.spec.js` "a value written into the STACK input from outside reaches the editor and back" |
| 46 | `tex2max_conversion.feature` | 252 | The editor still writes back after an external change |  | Playwright `conversion-browser.spec.js` "a value written into the STACK input from outside reaches the editor and back" |
| 47 | `tex2max_conversion.feature` | 258 | Alternating changes do not drift |  | Playwright `conversion-browser.spec.js` "a value written into the STACK input from outside reaches the editor and back" |
| 48 | `tex2max_conversion.feature` | 270 | A root inside a root, built with the toolbar |  | Jest `behat_conversion.test.js` (same title); Jest `nesting_depth.test.js` |
| 49 | `tex2max_conversion.feature` | 275 | Three roots deep |  | Jest `behat_conversion.test.js` (same title); Jest `nesting_depth.test.js` |
| 50 | `tex2max_conversion.feature` | 280 | A nested root comes back into the editor unchanged |  | Playwright `conversion-browser.spec.js` "a nested root typed on the keyboard survives saving and reloading the attempt" |
| 51 | `tex2max_conversion.feature` | 286 | A nested absolute value keeps both bars |  | Jest `behat_conversion.test.js` (same title); Jest `nesting.test.js` |
| 52 | `editor_rendering.feature` | 25 | MathQuill editor appears on quiz attempt page |  | Playwright `editor-rendering.spec.js` "editor and toolbar appear, the original input is hidden"; Behat `cas_contract.feature` (editor in a real attempt) |
| 53 | `editor_rendering.feature` | 33 | Typing in MathQuill field populates the hidden input |  | Playwright `editor-rendering.spec.js` "typing in the editor fills the hidden STACK input" |
| 54 | `editor_rendering.feature` | 40 | Pre-fill restores previous answer on page reload |  | Playwright `editor-rendering.spec.js` "a stored answer is restored when the attempt is opened again" |
| 55 | `editor_rendering.feature` | 48 | Pre-fill restores previous answer after navigating away and back |  | Playwright `editor-rendering.spec.js` "a stored answer is restored after navigating to the next page and back" |
| 56 | `editor_rendering.feature` | 55 | Toolbar buttons insert correct LaTeX |  | Playwright `editor-rendering.spec.js` "the square root button inserts a square root", "every template button leaves the cursor in its first slot"; Jest `button_contract.test.js`, `math_contracts.test.js` |
| 57 | `editor_rendering.feature` | 63 | Editor is absent when plugin is globally disabled |  | Playwright `editor-rendering.spec.js` "no editor when the plugin is disabled globally (mode 0)"; PHPUnit `activation_matrix_test.php` |
| 58 | `editor_rendering.feature` | 71 | Editor is absent when disabled at question level in mode 3 |  | Playwright `editor-rendering.spec.js` "no editor for a question disabled at question level (mode 3)"; PHPUnit `activation_matrix_test.php::test_mode_three` |
| 59 | `multiline_editor.feature` | 32 | Clearing a line keeps it as an empty line; a second Backspace removes it |  | Playwright `multiline.spec.js` (same title) |
| 60 | `multiline_editor.feature` | 50 | Delete removes an already empty line as well |  | Playwright `multiline.spec.js` (same title) |
| 61 | `multiline_editor.feature` | 65 | The last remaining line is never removed |  | Playwright `multiline.spec.js` (same title) |
| 62 | `multiline_editor.feature` | 77 | An emptied denominator does not survive the finished fraction |  | Playwright `multiline.spec.js` (same title) |
| 63 | `configure_toolbar.feature` | 25 | Navigation selector contains MathQuill entry when STACK questions exist |  | Behat `configure_toolbar.feature` "The quiz navigation offers the editor configuration, and the quiz page opens from it"; PHPUnit `configure_capability_test.php::test_navigation_link_follows_capability` |
| 64 | `configure_toolbar.feature` | 31 | Quiz-level configure page opens without question ID |  | Behat `configure_toolbar.feature` "The quiz navigation offers the editor configuration, and the quiz page opens from it" |
| 65 | `configure_toolbar.feature` | 39 | Question-level configure page shows question preview |  | Behat `configure_toolbar.feature` "The question configuration opens from the question in the quiz"; Playwright `configure-access.spec.js` "the quiz's own question opens with its preview"; PHPUnit `preview_config_test.php` |
| 66 | `configure_toolbar.feature` | 46 | Saving quiz-level config persists across page reload |  | Behat `configure_toolbar.feature` "A saved quiz configuration is still there after reloading"; PHPUnit `config_manager_test.php::test_save_and_get_quiz_default` |
| 67 | `configure_toolbar.feature` | 55 | Question-level config overrides quiz-level default |  | PHPUnit `config_manager_test.php::test_config_priority_chain`; Playwright `settings.spec.js` "question: overrides the quiz for that question only" |
| 68 | `configure_toolbar.feature` | 64 | Enabled checkbox only appears in modes 2 and 3 |  | PHPUnit `configure_form_test.php::test_the_checkbox_follows_the_instance_mode` |
| 69 | `configure_toolbar.feature` | 72 | Enabled checkbox appears and works in mode 2 |  | PHPUnit `configure_form_test.php` (mode 2 rows), `form_persistence_test.php::test_activation`, `activation_matrix_test.php::test_mode_two` |
| 70 | `configure_toolbar.feature` | 80 | Enabled checkbox is pre-checked in mode 3 |  | PHPUnit `configure_form_test.php::test_the_checkbox_starts_with_what_the_quiz_inherits`, `activation_matrix_test.php::test_mode_three` |
| 71 | `configure_toolbar.feature` | 89 | Back returns to the quiz view page the configuration was opened from |  | PHPUnit `quiz_helper_test.php::test_get_return_url_keeps_the_calling_page`, `test_resolve_return_url_keeps_local_urls` |
| 72 | `configure_toolbar.feature` | 97 | Back returns to the quiz edit page the configuration was opened from |  | PHPUnit `quiz_helper_test.php::test_get_return_url_keeps_the_calling_page`, `test_resolve_return_url_keeps_local_urls` |
| 73 | `configure_toolbar.feature` | 104 | A direct call ignores an external return URL and falls back to the view page |  | PHPUnit `quiz_helper_test.php::test_resolve_return_url_rejects_unsafe_targets`, `test_get_return_url_without_page_url_uses_the_view_page` |
| 74 | `configure_toolbar.feature` | 122 | A guest sees the login page, never a question-specific error | question=nonexistent | Behat `configure_toolbar.feature` "A guest calling the configuration page directly gets the login page"; PHPUnit `review_2026_10_08_test.php` (require_login before the question is resolved) |
| 75 | `configure_toolbar.feature` | 123 | A guest sees the login page, never a question-specific error | question=stack | Behat `configure_toolbar.feature` "A guest calling the configuration page directly gets the login page"; PHPUnit `review_2026_10_08_test.php` (require_login before the question is resolved) |
| 76 | `configure_toolbar.feature` | 125 | A logged-in user without the manage capability is stopped before the question is resolved |  | PHPUnit `configure_capability_test.php::test_can_configure_by_role`, `test_navigation_and_page_share_the_check`; `configure_access_test.php` |
| 77 | `cas_contract.feature` | 34 | Basic arithmetic |  | Contract `basic-arithmetic` in `math_contracts.json`: PHPUnit `cas_contract_test.php` (real STACK + Maxima), Jest `math_contracts.test.js` (tex2max and MathQuill) |
| 78 | `cas_contract.feature` | 39 | Powers and roots |  | Contract `powers-and-roots` in `math_contracts.json`: PHPUnit `cas_contract_test.php` (real STACK + Maxima), Jest `math_contracts.test.js` (tex2max and MathQuill) |
| 79 | `cas_contract.feature` | 44 | Exponential and logarithm |  | Contract `exponential-and-logarithm` in `math_contracts.json`: PHPUnit `cas_contract_test.php` (real STACK + Maxima), Jest `math_contracts.test.js` (tex2max and MathQuill) |
| 80 | `cas_contract.feature` | 49 | Trigonometry |  | Contract `trigonometry` in `math_contracts.json`: PHPUnit `cas_contract_test.php` (real STACK + Maxima), Jest `math_contracts.test.js` (tex2max and MathQuill) |
| 81 | `cas_contract.feature` | 54 | Absolute value |  | Contract `absolute-value` in `math_contracts.json`: PHPUnit `cas_contract_test.php` (real STACK + Maxima), Jest `math_contracts.test.js` (tex2max and MathQuill) |
| 82 | `cas_contract.feature` | 59 | Comparators |  | Contract `comparators` in `math_contracts.json`: PHPUnit `cas_contract_test.php` (real STACK + Maxima), Jest `math_contracts.test.js` (tex2max and MathQuill) |
| 83 | `cas_contract.feature` | 64 | Set theory |  | Contract `set-theory` in `math_contracts.json`: PHPUnit `cas_contract_test.php` (real STACK + Maxima), Jest `math_contracts.test.js` (tex2max and MathQuill) |
| 84 | `cas_contract.feature` | 69 | Logic |  | Contract `logic` in `math_contracts.json`: PHPUnit `cas_contract_test.php` (real STACK + Maxima), Jest `math_contracts.test.js` (tex2max and MathQuill) |
| 85 | `cas_contract.feature` | 74 | Matrices |  | Contract `matrix` in `math_contracts.json`: PHPUnit `cas_contract_test.php` (real STACK + Maxima), Jest `math_contracts.test.js` (tex2max and MathQuill); Behat `cas_contract.feature` (browser smoke) |
| 86 | `cas_contract.feature` | 79 | Determinant and transpose |  | Contract `determinant` in `math_contracts.json`: PHPUnit `cas_contract_test.php` (real STACK + Maxima), Jest `math_contracts.test.js` (tex2max and MathQuill) |
| 87 | `cas_contract.feature` | 84 | Column vectors |  | Contract `column-vector` in `math_contracts.json`: PHPUnit `cas_contract_test.php` (real STACK + Maxima), Jest `math_contracts.test.js` (tex2max and MathQuill) |
| 88 | `cas_contract.feature` | 89 | Geometry with points as lists |  | Contract `point-2d` in `math_contracts.json`: PHPUnit `cas_contract_test.php` (real STACK + Maxima), Jest `math_contracts.test.js` (tex2max and MathQuill) |
| 89 | `cas_contract.feature` | 94 | Greek letters |  | Contract `greek-letters` in `math_contracts.json`: PHPUnit `cas_contract_test.php` (real STACK + Maxima), Jest `math_contracts.test.js` (tex2max and MathQuill) |
| 90 | `cas_contract.feature` | 99 | Mathematical constants |  | Contract `constants` in `math_contracts.json`: PHPUnit `cas_contract_test.php` (real STACK + Maxima), Jest `math_contracts.test.js` (tex2max and MathQuill) |
| 91 | `cas_contract.feature` | 104 | Integrals |  | Contract `integral-indefinite` in `math_contracts.json`: PHPUnit `cas_contract_test.php` (real STACK + Maxima), Jest `math_contracts.test.js` (tex2max and MathQuill) |
| 92 | `cas_contract.feature` | 109 | Derivatives |  | Contract `derivative-d` in `math_contracts.json`: PHPUnit `cas_contract_test.php` (real STACK + Maxima), Jest `math_contracts.test.js` (tex2max and MathQuill) |

## Kept in the Behat suite but rewritten

`configure_toolbar.feature` was rewritten from 15 scenario instances to the 4 above; its other
instances are in the table (rows marked `configure_toolbar.feature`). `stack_cas_init.feature` is
unchanged.


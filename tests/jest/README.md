# local_stackmatheditor — Jest unit tests

Unit tests for the pure conversion logic in `amd/src` (`tex2max.js`, `max2tex.js`). They run in
Node without Moodle, which makes them the fastest place for roundtrip test tables.

`amd_loader.js` evaluates the **source** module with a stub `define()` and hands it the
dependencies you pass explicitly; an undeclared dependency fails loudly instead of receiving
`undefined`. `loadDefinitions()` returns the definitions the converters get in production
(`fixtures/definitions.json`, an export of `definitions::export_for_js()`), and `VARIABLE_MODES`
lists the five variable modes every conversion rule should be tested in.

`tests/unit/jest_fixture_test.php` fails when the fixture no longer matches the PHP definitions.
Regenerate it from the Moodle root with
`php local/stackmatheditor/tests/jest/export_definitions.php`.

| Suite | Covers |
|---|---|
| `conversion.test.js` | harness smoke (fraction, pi, roundtrip) |
| `tex2max_sqrt.test.js` | #39: `\sqrt` stays atomic in every mode, no backslash in the CAS string |
| `plusminus.test.js` | #30: coupled `\pm`/`\mp` expansion with `nounor`, collapse back (incl. legacy `or`), roundtrips in every mode |
| `sets_logic.test.js` | #35: every set/logic operator of `amd/src/operator_map.js` → STACK-valid Maxima and back, precedence, legacy spellings |
| `stack_bridge.test.js` | #48/#43 (jsdom): one input/change per sync, flush before Check/Submit without extra events, stale-invalid re-validation once per value, integration events (enter, input, beforecheck, beforesubmit) |
| `greek.test.js` | #22: every Greek letter of the definitions × 5 modes (TeX → Maxima → TeX → Maxima), variants, lambda/pi/function-name collisions, Latin policy |
| `integral.test.js` | #44: integral template → integrate(...), incomplete states, all read forms, roundtrips |
| `derivative.test.js` | #46: ∂ templates → diff(...), order check, canonical ∂ on the way back, roundtrips |
| `math_contracts.test.js` | #96 (jsdom): every contract of `tests/fixtures/math_contracts.json` → exactly its `maxima` through the real tex2max (mode `stack`, default site settings), also after a round trip through the bundled MathQuill; gates: unique ids, one browser smoke, every visible button and every group has a contract |

### Math contracts (#96)

`tests/fixtures/math_contracts.json` is the single source of truth for what the toolbar promises:
`latex` → `maxima` (tex2max, variable mode `stack`) → STACK. Each contract names its `group`, the
`button` it stands for (the template as in `fixtures/buttons.json`), the `packages` the group
declares, and `cas`: `accept`, or `known-defect` with `defect` and `defectStage` (`parser` or
`cas`). A known defect is pinned, so fixing it makes the tests fail until the flag is removed. Optional:
`value` (what Maxima evaluates the answer to), `allowWords` (STACK input option the question needs),
`settings` (site settings, as in `definitions::export_for_js()`), `mathquillDefect` (MathQuill changes
the meaning; pinned the same way), `note`, `behatScenario` (the scenario of the former
`tests/behat/cas_contract.feature` it replaces) and `browserSmoke` (exactly one contract, kept in
Behat).

The STACK half is `tests/unit/cas_contract_test.php`: STACK's student-input parser (no CAS, always
runs), then STACK's CAS validation and a real Maxima evaluation. That part needs the
`QTYPE_STACK_TEST_CONFIG_*` constants in `config.php` before the `lib/setup.php` require, e.g. for
plain Maxima:

```php
define('QTYPE_STACK_TEST_CONFIG_PLATFORM', 'linux');
define('QTYPE_STACK_TEST_CONFIG_MAXIMAVERSION', 'default');
define('QTYPE_STACK_TEST_CONFIG_MAXIMACOMMAND', 'maxima');
define('QTYPE_STACK_TEST_CONFIG_MAXIMACOMMANDOPT', '');
define('QTYPE_STACK_TEST_CONFIG_MAXIMACOMMANDSERVER', '');
define('QTYPE_STACK_TEST_CONFIG_CASTIMEOUT', '300');
define('QTYPE_STACK_TEST_CONFIG_CASRESULTSCACHE', 'none');
define('QTYPE_STACK_TEST_CONFIG_CASPREPARSE', 'true');
define('QTYPE_STACK_TEST_CONFIG_MAXIMALIBRARIES', '');
define('QTYPE_STACK_TEST_CONFIG_PLOTCOMMAND', '');
define('QTYPE_STACK_TEST_CONFIG_CASDEBUGGING', '0');
```

Without them the CAS part skips; with `SME_REQUIRE_CAS=1` (set in the main CI) it fails instead.
| `behat_conversion.test.js` | #96: every pure conversion contract of the former `tests/behat/tex2max_conversion.feature` (removed in 1.4.0, see `docs/TEST-MIGRATION.md`), one test per scenario / Examples row, named after it |
| `mode_matrix.test.js` | #96: operator names in identifiers, function application, subscripts, script combinations, set/logic nesting × 5 modes with the mode-specific output and roundtrip; matrix/vector combinations (stack) |
| `nesting_depth.test.js` | #96: sqrt, abs, fractions, nth roots, functions in functions and a mix at depth 4 and 6 × 5 modes, both directions and roundtrip |
| `property.test.js` | #96: seeded generator (mulberry32, no extra dependency): fixed point after one cycle, no backslash (also for every button × 5 modes), matrix dimensions, identifier boundaries, balanced structure, `analyse()` never empty without a problem |
| `regressions_96.test.js` | #96: the four conversion defects the #96 suites found, pinned in every mode - fraction arguments at any depth, the converter's own function names never split, a new factor after a closed script group, max2tex braces exponents and nests power chains |
| `contract_fixes_96.test.js` | #96 (jsdom): the contract defects fixed instead of pinned - `50\%` → `50/100` (`%pi` stays), the norm as `\lVert…\rVert` (the button through the bundled MathQuill), the letters `rot` → the configured curl, the mixed-number guard, no ≈ button |
| `issue_followups.test.js` | open criteria of #30, #42, #45, #46 × 5 modes: unary plus optional on the way back, `nounand`/`nounor` never split, an equation system string-stable over a round trip, `mod(...)` a function call, `\nabla` one word, Δ before a bracket the Greek letter without a configured Laplace operator, Leibniz notation with the operand in the numerator (`\frac{\partial f}{\partial x}` → `diff(f,x)`) |

```bash
make jest            # from the plugin root; runs npm ci on first use
# or
cd tests/jest && npm ci && npm test
```

The package lives here, not in the plugin root, on purpose: a `package.json` in the plugin root
makes moodle-plugin-ci run an additional `npm install` inside the plugin during every install.

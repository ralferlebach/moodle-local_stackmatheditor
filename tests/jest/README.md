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

```bash
make jest            # from the plugin root; runs npm ci on first use
# or
cd tests/jest && npm ci && npm test
```

The package lives here, not in the plugin root, on purpose: a `package.json` in the plugin root
makes moodle-plugin-ci run an additional `npm install` inside the plugin during every install.

# Session 008 – Development infrastructure from moodle-plugintemplate

**Branch:** `development` (renamed from `develop` during this session)
**Date:** 2026-09-10
**Plugin version:** 2026091000 (release 1.2)
**Status:** Infrastructure delivered and verified locally; first GitHub run pending.
Issue work starts once the new pipelines are green.

---

## 1. Goal

Adopt the CI pipelines, development environment and makefile from
`ralferlebach/moodle-plugintemplate`, adapted to this plugin, with PHPUnit, Behat, Playwright,
Jest, k6 and JMeter as target tools. Playwright, k6 and JMeter start as tiny smoke tests.

## 2. Decisions

| Decision | Reason |
|---|---|
| Supported Moodle: 4.5+ only (`requires` 2024100700) | Ralf, this session |
| Development branch is `development`; `main` is the release branch | Ralf, renamed this session |
| Dev pipeline runs on every branch except `main`; main pipeline on `main` only | Template model |
| All test-site jobs on `ubuntu-24.04` | Ubuntu 22.04 ships Maxima 5.45.1, which STACK rejects |
| Grunt gate only on MOODLE_405_STABLE | `amd/build` is produced there; another branch may minify differently |
| Coverage floor 40 % (measured 42.41 %) as a ratchet | Measured before gating, per Ralf |
| Jest and Playwright in `tests/jest`, `tests/playwright` with own package.json | A root package.json triggers an extra npm install in moodle-plugin-ci |
| Playwright/k6/JMeter also triggered by path-filtered pushes | workflow_dispatch is only visible once the file is on the default branch |
| Playwright uploads videos in both outcomes | Ralf asked for video output; failures are where they help most |
| No version.php upper bound (`supported`) | Would block installation on Moodle 5.3 |

## 3. Findings

- **STACK 4.13.1 has three new hard dependencies**: `qbehaviour_dfexplicitvaildate`,
  `qbehaviour_dfcbmexplicitvaildate`, `qbank_importasversion`. `admin/cli/install.php` aborts
  without them ("Dependencies check failed for qtype_stack"); moodle-plugin-ci's PHPUnit/Behat
  initialisation does not check dependencies, which is why the old CI never noticed.
- Template defects fixed while adapting: codechecker without `<plugin>` argument before install
  ("Not enough arguments"), phpcs.xml assumed to be read by moodle-plugin-ci (it reads
  `.moodle-plugin-ci.yml`), `phpmd.xml` referenced but missing, empty `inputs.*` on push skipping
  the self-contained load steps, JMeter always exiting 0, videos deleted on failure.
- `moodle-plugin-ci behat --start-servers` is redundant: install writes
  `MOODLE_START_BEHAT_SERVERS=YES` into `ci/.env`.
- `/lib/requirejs.php/-1/local_stackmatheditor/tex2max.js` serves exactly
  `amd/build/tex2max.min.js` (404 when missing) — the smoke target for Playwright, k6 and JMeter.
  A positive revision returns the combined bundle of all AMD modules instead.
- `amd/build` is byte-identical after `grunt amd` on Moodle 4.5 / Node 22.

## 4. Changed and new files

| File | Purpose |
|---|---|
| `.github/workflows/moodle-plugin-ci-dev.yml` | new: parallel dev pipeline |
| `.github/workflows/moodle-plugin-ci-main.yml` | new: full matrix + release gates |
| `.github/workflows/playwright.yml` | new: browser smoke with videos |
| `.github/workflows/load-k6.yml`, `load-jmeter.yml` | new: load smoke |
| `.github/build-test-site.sh`, `serve-test-site.sh` | new: real test site for browser/load jobs |
| `.moodle-plugin-ci.yml`, `phpcs.xml` | new: exclusions for CI / IDE |
| `.gitattributes`, `.gitignore` | LF normalisation, export-ignore, harness artefacts |
| `makefile` | rewritten from the template: jest, behat, playwright, k6, jmeter targets |
| `tests/coverage.php`, `tools/coverage_gate.php` | new: coverage scope and floor |
| `tests/jest/*` | new: AMD loader + 4 smoke tests |
| `tests/playwright/*` | new: config, helpers, seed.php, smoke.spec.js (3 tests) |
| `tests/load/*` | new: k6 plan, JMeter plan, check_jtl.py |
| `tests/README.md` | rewritten for the six tools |
| `db/removed_files.txt` | new: old `moodle-ci.yml` and `.idea` |
| `docs/ENTWICKLUNGSUMGEBUNG.md` | new: environment setup |
| `version.php` | 2026091000 |

To delete manually (a patch ZIP cannot delete): `.github/workflows/moodle-ci.yml`, `.idea/`.
`.github/setup-stack-cas.php` is no longer referenced anywhere.

## 5. Verification (local, 2026-09-10)

Moodle 4.5.13+, PHP 8.3.6, PostgreSQL 16, Maxima 5.46.0, moodle-plugin-ci 4.5.11, STACK 4.13.1:

- moodle-plugin-ci install with all five STACK plugins: OK
- phplint, codechecker (max-warnings 0), phpdoc (max-warnings 0), validate, savepoints,
  mustache, grunt (max-lint-warnings 0): all green, new PHP files included
- PHPUnit: 57 tests, 574 assertions, `--fail-on-warning`: green
- Coverage (pcov): 42.41 %
- Jest: 4/4; Playwright: 3/3 with videos; k6: 100 % checks; JMeter: 100/100 samples
- Negative checks: missing AMD module → Playwright/k6 red (k6 exit 99), JMeter exit 0 but
  check_jtl.py exit 1
- Release artefact (`git archive`) contains no tooling and all runtime files
- actionlint + shellcheck on all workflows and scripts: clean
- `make jest`, `make phpunit`, `make amd`, `make lint-js` inside the tree: OK

**Not verified locally:** Behat (no Docker/Selenium in the sandbox). The Behat steps are the
proven ones from the old pipeline (stack-behat-init.php, @stack_init preflight,
`--auto-rerun 0`). New risks: Behat on PostgreSQL and on Moodle 5.x cells in the main matrix,
PHPUnit on PHP 8.4, and the three new STACK dependencies on Moodle 5.x.

## 6. Open items

1. First GitHub run of the dev pipeline; fix whatever is red.
2. Then issue work, priority to be agreed: #39 (sqrt), #42 (nounand/nounor), #30 (±/∓),
   #35/#34 (set/logic operators), #41, #43, #40/#44/#45/#46 (editor/operators), #23.
3. Grow the smoke tests: quiz attempt with a STACK question (Playwright), get_config web service
   (k6/JMeter), roundtrip tables (Jest).

---

## 7. Iteration 2 (2026-09-11) — 2026091100, release 1.2.0

First GitHub run of the new pipelines: all green (Ralf).

### Decisions (Ralf)

- From now on only **complete plugin ZIPs** are delivered (start prompt and docs updated).
- Release name three-part (`1.2.0`); version numbers by date, counted up per iteration.
- Playwright, k6 and JMeter are **manual-only** workflows (no push / PR / merge triggers).
- The dev pipeline gets a JavaScript/CSS department (`javascript`: ESLint + AMD build freshness,
  stylelint, Jest) that Behat depends on.

### Issue order (technical dependencies)

| # | Issue | Why at this position |
|---|---|---|
| 1 | #39 `\sqrt` → `sqrt(...)` | Converter correctness at the root of the pipeline; #30 fixtures contain roots |
| 2 | #30 `±`/`∓` grouping, `nounor`, roundtrip | Needs a correct token stream (#39); introduces `nounor` |
| 3 | #35 set/logic mapping table, `nounand`/`nounor` both ways | Builds on #30's `nounor`; central mapping table |
| 4 | #48 transient states must not survive; `syncNow()` before Check | Sync core of `textarea_fields.js`; converter output is then final |
| 5 | #43 event bridge (Enter, beforecheck/beforesubmit) | Uses `syncNow()` from #48 |
| 6 | #41 empty lines in the multiline editor | Same keydown/serialisation code; after #48/#43 have settled it |
| 7 | #47 Back button returns to the calling page | Independent PHP navigation fix |

Note: #30 and #39 expect `nounor` output; the dedicated noun-operator issue (#42) is not on the
list but is implemented as part of #30.

### #39 — root cause and fix

Converting a LaTeX control word produced a bare word that fused with whatever preceded it:
`a\sqrt{b}` became the identifier `asqrt`, and in `\pm\sqrt{…}` the `\sqrt` rule ran first, left
`\pmsqrt`, which the `\pm` rule (with its `(?![a-zA-Z])` guard) no longer matched; single-variable
mode then split it into `\p*m*s*q*r*t`. Fix in `tex2max.js`:

- a zero-width boundary (`U+E000`) in front of every control word; skipped by the tokenizer,
  resolved at the end (space only where an identifier meets a word, otherwise nothing, so
  `2sqrt(x)` in stack mode is unchanged);
- built-in function names (`sqrt`, trig, `log`, `abs`, `binomial`, …) always protected, even
  without server definitions;
- no backslash reaches the CAS string: `\{`/`\}` survive as set braces, spacing commands are
  dropped, `\text{…}` yields its content, unknown control words keep their name.

`max2tex.js`: a numeric coefficient before a function (`2sqrt(x)`) no longer blocks `\sqrt`.

Regression comparison over 52 expressions × 5 modes against the previous converter: 34
differences, all of them previously broken outputs (`alphabeta`, `x\inR`, `\1,2\`,
`b*i*n*o*m*i*a*l`, `%ipi`, …).

Tests: `tests/jest/tex2max_sqrt.test.js` (98 cases incl. all mandatory inputs × 5 modes and
roundtrips), Jest fixture of the real definitions plus `tests/unit/jest_fixture_test.php`,
two Behat scenarios in `tex2max_conversion.feature`.

Delivered as `sme_v1.2.0_01.zip` (2026091100).

## 8. Iteration 3 (2026-09-11) — 2026091101: #30 (and the nounor part of #42)

### Root causes

- `tex2max.expandPlusMinus()` joined the alternatives with a bare `or` and without brackets.
- `max2tex.collapsePlusMinus()` ran at the very end on the LaTeX output — by then
  `processLogicKeywords()` had already turned `or` into `\lor`, so the collapse never matched and
  every `±` came back as `A \lor B`.
- Found on the way: with the real definitions `pi` was replaced twice in max2tex (constants pass,
  then the bare-`pi` fallback) and rendered as `\\pi` — a LaTeX line break followed by "pi".

### Fix

- tex2max: coupled expansion `(A) nounor (B)`; a unary `+` is dropped from A after start,
  relations (`= < > #`), `(`, `,` and `[` only; binary `+` untouched; each sign replaced in
  place, so no sign changes its subtree. Spaces next to brackets/commas are removed for a stable
  output.
- max2tex: collapse on the Maxima string *before* any keyword processing. Reads `nounor` and
  legacy `or` (with or without brackets), exactly two alternatives, walks both in parallel:
  `+`/`-` → `\pm`, `-`/`+` → `\mp`, a sign missing in unary position counts as `+`. Any other
  difference leaves an ordinary disjunction (`\lor`). `nounor`/`nounand` render as `\lor`/`\land`.
- max2tex: `pi` is no longer replaced after a backslash.

### Tests

`tests/jest/plusminus.test.js` (61 cases: all eight fixtures of the issue in all five modes as
TeX → Maxima → TeX → Maxima, exact expansions, coupled signs, legacy `or`, non-sign differences);
Behat ± scenarios updated to the exact `nounor` output plus two new ones (coupled signs,
parentheses). Jest total: 163.

Delivered as `sme_v1.2.0_02.zip` (2026091101).

## 9. Iteration 4 (2026-09-11) — 2026091102: #35

### Verification against STACK 4.13.1 (security-map.json)

| Old output | STACK | Consequence |
|---|---|---|
| `x in A` | `in` is the loop keyword | rejected / wrong |
| `x notin A`, `A setdiff B`, `A superset B`, `p impliedby q`, `p iff q` | unknown | rejected |
| `A subset B` | `subset(A, pred)` filters by a predicate | wrong meaning |
| `A union B`, `A intersect B` | functions, not infix | invalid syntax |
| `p and q`, `p or q` | evaluating operators | allowed, but simplify |
| — | `nounand` (nary 65), `nounor` (nary 61), `nounnot`, `implies` | supported |

Found on the way: MathQuill writes ∨ as `\vee` (all of `\lor`, `\or`, `\vee` output `\vee `), which
the old converter did not know at all; and `\neg` became `#g` because the `\ne` rule had no
lookahead.

### Decisions

- Central table `amd/src/operator_map.js`, used by tex2max, max2tex and the tests.
- ∈ → `elementp(x,A)`, ∉ → `not elementp(x,A)`, ∪ → `union(…)` (n-ary), ∩ → `intersection(…)`,
  ∖ → `setdifference(A,B)`; precedence ∩ > ∪ > ∖ (left-associative); max2tex always brackets
  set operations next to ∖.
- ⊆ → `subsetp(A,B)`, ⊇ → `subsetp(B,A)`; ⊂ (proper) → `(subsetp(A,B) nounand A#B)`,
  ⊃ → `(subsetp(B,A) nounand B#A)`. Toolbar: new buttons ⊆/⊇, ⊂/⊃ relabelled "proper".
- ∧ → `nounand`, ∨ → `nounor` — **revised in iteration 5**, see below.
- Reading: canonical forms plus legacy `in`, `notin`, `union` … infix and `and`/`or`.
- Set literals: Maxima `{…}` is rendered as `\left\{…\right\}` (was plain grouping braces).

### Tests

`tests/jest/sets_logic.test.js` (256 cases: 15 mappings × 5 modes × exact/validity/roundtrip,
precedence, legacy reading, table coverage); Behat set/logic scenarios replaced by exact STACK
forms; `\neg` scenario guards against `#g`. Jest total 419. Built AMD modules verified in a real
browser via requirejs (production mode).

### Open

- ∀ / ∃ / ∄ (logic group) produce `forall`/`exists`/`nexists`, which STACK does not know
  either. Not part of #35; decision needed (hide buttons or map to something STACK accepts).

Delivered as `sme_v1.2.0_03.zip` (2026091102).

## 10. Iteration 5 (2026-09-11) — 2026091103: and/or vs. nounand/nounor (correction to #35)

### Ralf's clarification (binding)

- Genuine logical expressions use `and` / `or`: STACK judges the whole statement.
- `nounand` / `nounor` are markers for structures whose parts STACK evaluates one by one:
  solution sets (`x=±2` → `x=-2 nounor x=2`) and equation systems
  (`a+2b=5 nounand 2a+6b=-2`). A part-by-part evaluation of a logical statement makes no sense
  didactically.
- ⊂ / ⊃ mean **proper** subset / superset.
- Quantifier buttons (∀ ∃ ∄) are commented out for now.
- `A ⊃ B` displayed as `B ⊂ A` after a roundtrip is fine.

### Implementation

- `operator_map.js`: ∧ → `and`, ∨ → `or`; new constants `SOLUTION_JOIN = 'nounor'` and
  `SYSTEM_JOIN = 'nounand'`, used by tex2max (±, cases), input_fields and textarea_fields
  (system rows: writer and reader), max2tex (± collapse, cases rendering).
- Proper subset and ⇔ are logical statements: `(subsetp(A,B) and A#B)`,
  `(p implies q) and (q implies p)`.
- Equation systems: `\begin{cases}` rows, the system editor (input_fields) and multi-field steps
  (textarea_fields) now join with `nounand` (were `and`); only `nounand` is read back as a system.
- max2tex collapses only `nounor` into ±; a logical `or` stays `\lor` (it would otherwise turn
  into `nounor` on the next save).
- Chained set relations (`A ⊃ B ⊂ C`) become the conjunction of neighbouring relations:
  `(subsetp(B,A) and B#A) and (subsetp(B,C) and B#C)`, displayed as `B ⊂ A ∧ B ⊂ C`.
- Quantifier buttons commented out in `classes/definitions.php` (conversion rules kept).

### Consequence for existing data

Answers saved by earlier versions with `and` between system rows or `or` between ± alternatives
are shown as logical `∧` / `∨` from now on and keep that meaning when edited. New input uses the
structural operators.

### Tests

Jest 425 (new: logic vs. structure, chains, systems; legacy `or` no longer collapses). Changed
AMD modules (tex2max, max2tex, operator_map, input_fields, textarea_fields) verified in a real
browser via requirejs.

Delivered as `sme_v1.2.0_04.zip` (2026091103).

## 11. Iteration 6 (2026-09-11) — 2026091104: CI/Behat and local gherkinlint

### Behat (dev pipeline, 35 scenarios, 3 failed)

All three failures were the new Scenario Outline "The shipped tex2max never splits sqrt"
(`explicit_single`, `space_single`, `stack`), each with `tex2max result '' does not contain 'sqrt(b)'`.

Root cause in the step `the tex2max output for latex … in variableMode … is evaluated` (unused
until this session): it ran its setup script with `evaluateScript()`, which prefixes the script
with `return `. The script starts with a comment line, so `return` was followed by a line break,
automatic semicolon insertion returned `undefined`, and not a single statement ran - the result
variable was never set. Reproduced in Node (nothing executed, require never called). Fix:
`executeScript()`, which runs the script as written. Verified by running the exact generated step
script in a real browser against the built modules: result `a sqrt(b)`.

### Local gherkinlint

`make lint-gherkin` linted every feature of the whole Moodle tree, so `no-dupe-feature-names`
reported clashes between unrelated plugins (local_catquizlab vs. local_catquiz). The target now
passes `--files="local/stackmatheditor/tests/behat/*.feature"`.

Delivered as `sme_v1.2.0_05.zip` (2026091104). Ralf confirmed in the browser console:
`p\vee q → p or q`, `A\subset B → (subsetp(A,B) and A#B)`.

## 12. Iteration 7 (2026-09-11) — 2026091105: #48

CI: Ralf's `moodle-plugin-ci-dev.yml` adopted as supplied (short job names "PHP", "JS/CSS";
`javascript` no longer listed in `ci-complete.needs`). One consequential fix: the result loop
still read `needs.javascript.result`, which is empty when the job is not in `needs` - actionlint
flags it, and ci-complete would always have failed. The line was removed; a failing JS/CSS job
still turns ci-complete red through `behat`, which needs it.

### Findings (STACK 4.13.1 `amd/src/input.js`, our editors)

1. Our debounced sync (150 ms) could still be pending when Check was pressed.
2. MathQuill 0.10.1 raises `edit` only on a root reflow, not for every structural change.
3. STACK shows an "invalid" AJAX response without checking that it belongs to the current value
   (valid responses are cached per value, invalid ones are not). A slow CAS answer for the
   transient "(2)/()" can arrive after the final value was validated and overwrite the display.
4. `triggerStackValidation()` fired jQuery triggers *and* native events: native events reach
   jQuery handlers too, so jQuery listeners got input/change twice, plus a synthetic blur.

### Fix

- New `amd/src/stack_bridge.js`:
  - `triggerValidation()`: exactly one native `input` and one `change`;
  - `register(flush)` + capture listeners (`pointerdown`/Enter/Space on submit controls,
    `submit`): every editor writes its visible state silently before the form data is built;
    no preventDefault, no own submit;
  - `guardStaleValidation()`: after an "invalid" result that may be stale (≥ STACK's 1 s typing
    delay after our last change), request validation of the current value once; STACK answers
    from its cache when that value was already validated; once per value, so no loop.
- `textarea_fields.js`: sync also on keyup/paste/cut; `syncNow({silent})` cancels a pending
  debounce and converts every row afresh; bridge registration per editor.
- `input_fields.js` (single line and system editor): same bridge, silent flush.

### Verification

- Jest (jsdom) `stack_bridge.test.js`: 8 cases; total 433.
- Real end-to-end run (Playwright against Moodle 4.5 + STACK 4.13.1 + Maxima, textarea question):
  `2/12` → two Backspace → pause 2.5 s (STACK receives `(2)/()`) → `6`, ↑, Backspace, `1`
  → Check clicked immediately after the last key (inside the debounce). Posted value
  `(1)/(6)`; STACK after reload: "interpreted as \frac{1}{6}".

### Open

- No Behat scenario for a textarea/equiv question yet (the Behat context only creates algebraic
  questions); STACK's generator template `textarea_input` would be the basis.

Delivered as `sme_v1.2.0_06.zip` (2026091105).

## 13. Iteration 8 (2026-09-11) — 2026091106: #43

Issue comment (Ralf): pressing the "+" button must also raise an Enter event in the bridge.
Interpreted as the buttons that add a row - `.sme-equiv-subadd` in the textarea/equiv editor and
the "+" of the single-line system editor - not the "+" operator of the toolbar.

### Contract (documented in README.md, "Integration events")

| Event | On | When |
|---|---|---|
| `stackmatheditor:input` | original input | after each changed sync (native input + change first, once each) |
| `stackmatheditor:enter` | original input | Enter in the editor (`trigger: 'key'`), "+" buttons (`trigger: 'button'`) |
| `stackmatheditor:beforecheck` | STACK Check button | click on Check, after the flush |
| `stackmatheditor:beforesubmit` | form | submit, after the flush |

Plus a non-bubbling keydown/keyup Enter mirror (keyCode/which 13) on the original input: direct
listeners on the field see Enter, document delegation still sees exactly one (the real, trusted
key event of the editor). No stopPropagation / preventDefault on relevant events; no project-
specific code for math-digital-mentoring. Single-line fields and system rows got an `enter`
handler that only signals (no behaviour change).

### Verification

- Jest (jsdom): 5 new cases, total 438 (one bridge instance per file, as in the browser).
- Real attempt (Playwright, Moodle 4.5 + STACK 4.13.1, textarea question): Enter creates the
  second row; document keydown sees one trusted Enter; `enter:key` once, `enter:button` once
  ("+"), each with the field-level mirror; Check → `beforecheck`, `beforesubmit`, native submit,
  in that order, with the visible value already in the original textarea.

Note: the Check control in STACK 4.13 is a `<button name="…-submit">`, not an `<input>`.

### Left as is

`toolbar.js` stops propagation of mousedown/click on its own buttons (keeps focus in the
editor). These are not input or submit events and are outside the #43 contract.

Delivered as `sme_v1.2.0_07.zip` (2026091106).

## 14. Iteration 9 (2026-09-11) — 2026091107: #41 (and a #43 addition)

### Root cause

The keydown handler sat on the editor wrapper and ran in the bubbling phase, i.e. after
MathQuill had already processed the key. The Backspace that deleted the last character therefore
saw an empty line and removed the whole line at once.

### Fix (`textarea_fields.js`)

- Normal lines: a capture-phase handler on the wrapper runs before MathQuill and removes a line
  only if it was already empty before this Backspace/Delete; only then `preventDefault()`. At
  least one line remains; Backspace moves to the previous line, Delete stays in place.
- Equation-system sub-rows: unchanged (Backspace that empties a sub-row removes it).
- Serialisation already kept empty lines (`lines.join('\n')`); parsing now splits on `\r?\n`.
- #43 addition: the global "Add line" button (fa-plus) of the textarea editor now raises the
  Enter signal as well - it is the "+" button that adds a line exactly like Enter.

### Finding: STACK drops empty lines on the server

`stack_textarea_input::response_to_contents()` and `stack_equiv_input::response_to_contents()`
(STACK 4.13.1) skip every blank line and re-render the textarea as `implode("\n", contents)`.
Empty lines therefore exist in the editor and in the posted value, but not after STACK processed
a submission: acceptance criterion "load/save/load keeps inner empty lines" cannot be met by the
plugin without changing STACK (out of scope per the issue). Reproduced in a real attempt: after
Check the reloaded textarea is `x=1\nx=2`.

### Behat infrastructure

- `a STACK quiz :quizname with textarea input exists in :shortname` (STACK template
  `textarea_input`); `ensure_stack_question_in_quiz()` takes a template parameter.
- `I focus row :row of the multiline MathQuill editor for :inputname`,
  `the multiline MathQuill editor for :inputname should have :count rows`,
  `the lines of the underlying STACK input for :inputname should be :lines` ("|"-separated;
  both assertions wait up to 3 s for the debounced sync).
- New `tests/behat/multiline_editor.feature`: two-stage Backspace, Delete, last line, and the #48
  transient-fraction scenario, all with real key presses.

### Verification

All four scenarios replayed with Playwright against Moodle 4.5 + STACK 4.13.1 using the same
selectors and key sequences: green. The Behat run itself happens in CI.

Delivered as `sme_v1.2.0_08.zip` (2026091107). Decision on empty lines after STACK processing
(drop criterion / keep in plugin / ask STACK) still open with Ralf.

## 15. Iteration 10 (2026-09-11) — 2026091108: #47

### Root cause

`lib.php` built the settings-menu link without `returnurl` (comment: "breadcrumb handles it"), and
`configure.php` then assumed `/mod/quiz/edit.php` for every call without `returnurl`.

### Fix

- `quiz_helper::get_return_url($cmid, $modname)`: current page with all query parameters;
  fallback now the module's **view** page (quiz or adaptivequiz), never the edit page.
- New `quiz_helper::get_fallback_return_url()` and `resolve_return_url()`: accepts only
  root-relative paths or absolute URLs below `$CFG->wwwroot` (after `PARAM_LOCALURL`); external,
  protocol-relative (`//host`), backslash tricks, `javascript:` and directory-relative paths fall
  back to the view page - no open redirect.
- `lib.php`: the settings-menu link carries `returnurl`; on the configuration page itself the
  page's own return target is passed on, so the parameter never nests.
- `configure.php`: uses `resolve_return_url()`; Back (form cancel) and the fallback share one
  path; Save behaviour unchanged (stays on the page with the success message).
- `configure_injector.php`: passes the module name to `get_return_url()`.

### Tests

- PHPUnit (`quiz_helper_test`): current page kept incl. query; fallback view page for quiz and
  adaptivequiz; four local URLs kept exactly; six unsafe targets rejected for both module types.
- Behat (`configure_toolbar.feature`): Back from view, Back from edit, direct call with external
  `returnurl`; steps `I am on the STACK MathQuill quiz configuration page for :quizname with return
  URL :returnurl` and `I should be on the quiz :pagetype page of :quizname`.
- Real browser (Playwright, Moodle 4.5): view → configure → Back → `view.php?id=…`;
  edit → configure → Back → `edit.php?cmid=…`; `returnurl=https://example.org/` → view page;
  the settings link on the configuration page itself keeps the original return target.

Delivered as `sme_v1.2.0_09.zip` (2026091108).

Ralf's decisions: #41 criterion "empty lines survive saving" dropped (STACK strips them, the
roundtrip simply strips them too); quantifier buttons stay commented out (mostly needed for
proofs). Next: #49, then the feature issues #22, #46, #44 before the merge to main.

## 16. Iteration 11 (2026-09-11) — 2026091109: #49

`expandPlusMinus()` dropped the unary "+" only from the first alternative - correct for ±, but for
∓ the positive alternative is the second one: `x=\mp 2\sqrt{\pi}` gave `x=+2*sqrt(pi)`, which
STACK displays as "+x = ...". Now `stripUnaryPlus()` runs on both alternatives. max2tex already
merged a sign missing in either alternative (∓ when the second one lacks it), so `\mp` keeps its
orientation over the roundtrip. Reading stays `nounor`-only (a logical `or` is never a ± pair -
Ralf's decision from iteration 5; the issue text predates it).

Tests: 18 new Jest cases (all unary cases of the issue, coupled signs in both orders, every
mode, orientation roundtrip), Behat scenario `x=\mp 2 → (x=-2) nounor (x=2)`.

Delivered as `sme_v1.2.0_10.zip` (2026091109).

## 17. Iteration 12 (2026-09-11) — 2026091110: #22

### Verification (STACK 4.13.1 security map)

Every Greek name (alpha … omega, Gamma … Omega) is allowed as a student variable
(`"variable": "s"`), `lambda` included; `pi` is the constant alias of `%pi`. `varepsilon`,
`vartheta`, `varphi` are unknown to STACK. Answer to Ralf's question in the issue ("how has this
been handled so far? alpha_var?"): the editor already used the plain names, which is exactly
STACK's convention - a private form like `alpha_var` would no longer match teacher answers.

### Fixes

- Variant glyphs were split into letters in single-letter modes (`\varphi` → `v*a*r*p*h*i`) and
  never came back: they now map to their letter.
- `lambda(` (Maxima's anonymous function) can no longer arise: `\lambda\left(x\right)` →
  `lambda*(x)` also in stack mode.
- Spaces after a control word in front of anything but a letter/digit are dropped (LaTeX ignores
  them): stack mode no longer produced `gamma (x)` or `epsilon _0`.

### Tests

`tests/jest/greek.test.js`: 181 cases (all 33 letters of the definitions × 5 modes as
TeX → Maxima → TeX → Maxima without splitting; variants; lambda/pi/gamma collisions; Latin policy).
README section "Greek letters" documents the policy.

Delivered as `sme_v1.2.0_11.zip` (2026091110).

## 18. Iteration 13 (2026-09-11) — 2026091111: CI Behat preflight

The `@stack_init` preflight failed in the dev pipeline: `I navigate to the STACK healthcheck
page` ended with `WebDriverCurlException ... Operation timed out after 30001 milliseconds`.
The healthcheck runs a dozen CAS calls; with `platform=linux` (no frozen Maxima image) the page
sometimes needs longer than php-webdriver's 30 s HTTP timeout for a navigation, although STACK
itself was fine (the CLI baseline connect in `stack-behat-init.php` had just succeeded). Runner
speed decides - earlier runs passed in 39 s.

Fix: the step no longer navigates. It fetches the healthcheck with `fetch()` from within the
current page (no navigation, so every WebDriver command returns at once), waits up to 280 s
(castimeout 300 s) for the response and inserts the HTML into the current page, where the
unchanged assertion steps read it. A non-200 answer or a network error fails the step with the
status. Verified in a real browser against Moodle 4.5 + STACK 4.13.1: HTTP 200, "live connection
to the CAS" and the library version stamp found.

Delivered as `sme_v1.2.0_12.zip` (2026091111).

## 19. Iteration 14 (2026-09-11) — 2026091112: README from moodle-plugintemplate

`README.md` rewritten on the structure of `ralferlebach/moodle-plugintemplate` and filled for this
plugin: requirements (incl. STACK 4.13 dependencies and Maxima), motivation, features per version
(1.0, 1.1, 1.2) plus planned ones (#44, #46) and the disabled quantifiers, settings and
configuration pages, capabilities (none added; `mod/quiz:manage` / `mod/adaptivequiz:viewreport`),
how it works (chain, variable modes, conversion rules, pitfalls such as empty lines and legacy
`and`/`or`), Greek letters, integration events, privacy, third-party library, development pointers.

Badges: Moodle Plugin CI (`moodle-plugin-ci-main.yml` on `main` - shows a status once the new
workflow runs on main) and MDL Shield via the shields.io endpoint
`https://mdlshield.com/api/badge/local_stackmatheditor` (currently "not reviewed"), linking to
`https://mdlshield.com/dashboard/plugins/local_stackmatheditor`.

Correction to iteration 12: the uppercase Greek buttons that look like Latin letters (Α, Β, Ε, …)
are offered and write the Latin letter; the README now says so.

Delivered as `sme_v1.2.0_13.zip` (2026091112).

## 20. Iteration 15 (2026-09-11) — 2026091113: Behat fix + #44

### Behat

44 scenarios, 43 green. The non-JS scenario "A direct call ignores an external return URL" failed
with `UnsupportedDriverActionException: JS is not supported by BrowserKitDriver`: the new steps
waited for `document.readyState` unconditionally. All three config-page steps now wait only when
`running_javascript()`.

### #44 decisions (Ralf, issue comment)

Direct MathQuill template; no `integrate(expr)` for an incomplete integral - keep the editor state
and validate locally; read `integrate`, `int`, `'int`, `'integrate`; only atomic variables in V1
(`∫g(f(x))df` not serialised); hide `∮`.

STACK 4.13 check: `integrate` is a student alias of `int`; both have the noun function `nounint`
(STACK turns student `int`/`diff` into nouns) - read as well.

### Implementation

- tex2max: `extractIntegrals()` parses `\int[_a^b]` + integrand + differential on the LaTeX, with
  nesting (inner integrals consume their own `d`), `\mathrm{d}x` preferred, bare `dx` accepted
  (last candidate); parts converted recursively; the result travels as an atomic placeholder
  token through the pipeline (implicit multiplication works around it; stack mode never fuses
  `xintegrate`). New `analyse()` returns `{maxima, problems}`; problems:
  `integral_variable_missing`, `integral_limit_missing`, `integral_integrand_missing`,
  `integral_variable_composite` - then `maxima` is empty.
- max2tex: `integrate|int|'int|'integrate|nounint` with 2 or 4 arguments →
  `\int_{a}^{b} expr\mathrm{d}x` (brackets only for sums). No `\,` - MathQuill cannot parse it
  and would drop the whole pre-filled answer (found in the browser).
- New `local_validation.js` (core/str): message box below the editor, `role=status`; used by
  input_fields (single line and system rows) and textarea_fields (all rows).
- Toolbar: optional `left` on a `write` element moves the cursor back into the template;
  "Integral calculus" group active (not default) with one ∫ template
  `\int_{}^{}\left(\right)\mathrm{d}x`, cursor in the integrand; `∮` removed.
- Strings en/de for the button and the four messages.

### Verification

Jest `integral.test.js` (39 cases incl. every mode, incomplete cases, all 12 read forms,
roundtrips); total 677. Real browser (Moodle 4.5 + STACK 4.13.1): template + 5×Left → cursor in
the integrand, `x^2` → `integrate(x^2,x)`; deleting `x` → value empty + message "Incomplete
integral: the integration variable (dx) is missing."; typing `x` again → value back, message
hidden; pre-fill from `'int(x^2,x,0,1)` renders in MathQuill and yields `integrate(x^2,x,0,1)`.

### Not preserved

Noun vs. verb (`'int` vs. `integrate`) is not visible and is written as `integrate` - an explicit
option would be needed (Ralf's comment).

Delivered as `sme_v1.2.0_14.zip` (2026091113).

## 21. Iteration 16 (2026-09-11) — 2026091114: #46 + README revision

### #46 decisions (Ralf, issue comment)

Three templates (first, n-th, mixed partial), total order derived/checked, operand bracket
obligatory (no "following product term" rule), canonical ∂ on the way back (diff does not record
d vs. ∂), `'diff` read but never written, `diff(expr)` (total differential) out of scope.

### Implementation

- tex2max `extractDerivatives()`: `\frac{∂[^N]}{∂x[^n]∂y[^m]…}` (also d / \mathrm{d}) followed by
  `\left(…\right)` → `diff(E,x)`, `diff(E,x,n)`, `diff(E,x,n,y,m,…)` (orders written for every
  pair of a mixed derivative, `,1` dropped only for a single first-order variable). Problems:
  `derivative_operand_missing`, `derivative_order_mismatch`, `derivative_variable_composite`.
  Ordinary fractions are untouched.
- max2tex: `diff|'diff|noundiff` with (expr,x), (expr,x,n) or (expr,x,n,y,m,…) → ∂ template with
  computed total order; pair order kept; other forms (e.g. `diff(f)`) left as they are.
- Toolbar "Differential calculus" (not default): ∂/∂x, ∂ⁿ/∂xⁿ, ∂²/∂x∂y templates, cursor in the
  bracket; d/dx, ∇ and Δ removed (no STACK meaning / Δ is the Greek letter).
- Strings en/de for the three buttons and three messages.

### README (Ralf's feedback)

Features per version only as features, newest first (1.2: set theory, integral, differential);
"Planned" and the quantifier note removed; published at
https://marketplace.moodle.com/plugins/3697; conversion rules for integrals and derivatives added.

### Verification

Jest `derivative.test.js` (33 cases); total 711. Real browser with the actual toolbar buttons
(Moodle 4.5, site default mode "stack"): ∂/∂x + `x^2`, →, `+1` → `diff(x^2+1,x)`; mixed + `f` →
`diff(f,x,1,y,1)`; `∂³/∂x⁴(f)` → empty value + order message; ∫ button + `x^2` →
`integrate(x^2,x)`; pre-fill from `'diff(f,x,2,y,1)` → MathQuill template, `diff(f,x,2,y,1)`.
The toolbar shows exactly the four new templates (no ∮).

Delivered as `sme_v1.2.0_15.zip` (2026091114). CI green, merge to `main` done (Ralf).

## 22. Iteration 17 (2026-09-11) — 2026091115: review, load tests, settings matrix

- Review/audit of 11.09.2026: every point listed, verified against the code and recorded in
  `docs/REVIEW-2026-09-11.md` (new findings: `get_config` without explicit capability, toolbar
  buttons without `aria-label`, two hard-coded English `aria-label`s, 7 comment blocks in
  `definitions.php`).
- Evaluation of the first manual runs on main (Playwright, k6, JMeter smoke): all green; server
  log shows xdebug disabling the JIT → `coverage: none` in the three manual workflows.
- Seed: `tests/playwright/seed.php` imports STACK questions from `tests/fixtures/*.xml`
  (qformat_xml, no PHPUnit generator), creates course, teacher, 20 students, "SME Settings Quiz"
  (2 questions) and "SME Load Quiz" (8 algebraic + 2 textarea, one page); `--reset` option.
- Load: k6 `stackmatheditor-attempt.js`, JMeter `stackmatheditor-attempt.jmx` (authenticated
  students, attempt page + get_config); workflows seed the site and run them after the smoke.
- Playwright: `settings.spec.js` (6 tests, full matrix via the real UI, screenshots) and
  `performance.spec.js` (ten editors, exactly once, re-initialisation).
- Local results: see `docs/REVIEW-2026-09-11.md`, section 4.

Delivered as `sme_v1.2.0_16.zip` (2026091115).

## 23. Iteration 18 (2026-09-11) — 2026091116: accessibility, plugin-directory check

Ralf: #40 not yet; #34 as a supplementary issue comment (download
`comment-issue-34-toolbar-catalogue.md`); accessibility now.

- New `amd/src/a11y.js`: accessible names from the language pack, preloaded with the page
  (`definitions::get_js_strings()` → `definitions.strings`), fallback `core/str`.
- MathQuill's hidden textarea, the add/remove row/line/step buttons and every toolbar button
  (`aria-label` = tooltip) are named; eleven buttons got their missing tooltips; PHPUnit test:
  every offered button has a tooltip.
- `tests/playwright/a11y.spec.js` (axe-core, WCAG 2.0/2.1 A/AA): 2/2 green locally.
- Plugins directory "phplint FAIL – Log file not found": see `docs/REVIEW-2026-09-11.md`,
  section 6; `PHP Lint` next to `Validating` in the dev quality job; new main job that checks the
  exact release ZIP with PHP 8.1 and publishes it as artifact.

Delivered as `sme_v1.2.0_17.zip` (2026091116).

## 24. Iteration 19 (2026-09-11) — 2026091117: runtimes, limits, plugins-directory comparison

- Evaluation of the manual runs (Playwright, k6, JMeter; all green): they ran on `main` at
  `e55ea52` - smoke suites only; the settings matrix, performance, a11y and attempt load tests of
  `_16`/`_17` were not yet on that ref (the xdebug JIT warning is still in that server log too).
- Runtimes from the GitHub API documented in `docs/ENTWICKLUNGSUMGEBUNG.md` ("Laufzeiten und
  Höchstlaufzeiten"); `timeout-minutes` on every job; k6 thresholds (smoke p95 < 500 ms,
  max < 3 s; attempt provisional), JMeter Duration Assertions, Playwright timeouts/budgets.
- Ralf: no extra step. Plugin-directory job and extra dev `PHP Lint` step removed again.
- Comparison with FlexAccess (see `docs/REVIEW-2026-09-11.md`, section 6): `$plugin->supported`
  was missing (added `[405, 502]`); privacy metadata referenced a missing string for a dropped
  column (fixed) - new `language_strings_test`.

Delivered as `sme_v1.2.0_18.zip` (2026091117).

## 25. Iteration 20 (2026-09-11) — 2026091118: Playwright workflow environment

First GitHub run of the new Playwright suites (log `logs_93728539984`): the whole run aborted
before the first test with `Environment variable SME_SETTINGS_QBE1 is not set`. The seed printed
the variable, but the workflow copies the `export` lines into `$GITHUB_ENV` with
`sed "s/^export \([A-Z_][A-Z_]*\)=…"` - no digits allowed, so `SME_SETTINGS_QBE1/2` were
dropped (locally the file was sourced, which is why it never showed). Fixed in all three
workflows (`[A-Z_][A-Z0-9_]*`).

Hardening: `settings.spec.js` and `performance.spec.js` read their variables when the suite
starts, not when the file is loaded - a missing variable now fails only that suite (checked:
smoke still runs). `a11y.spec.js` empties the field before the keyboard check (a continued
attempt may hold an earlier answer).

Replayed locally with exactly the GitHub-style environment file (KEY=VALUE, the same sed):
settings 6/6 (3.4 min, longest test 47 s), smoke 3/3, performance 1/1, a11y 2/2.

Delivered as `sme_v1.2.0_19.zip` (2026091118).

## 26. Iteration 21 (2026-09-11) — 2026091119: README badge

- The log uploaded again (`logs_93728539984`) is byte-identical to the one analysed in
  iteration 20; its seed step still shows the old `sed` filter without digits, i.e. the run
  predates `_19`. Nothing new to fix there.
- README: MDL Shield badge now links to the public plugin page
  `https://mdlshield.com/plugins/local_stackmatheditor` (image URL unchanged; the badge
  currently shows grade "A").

Delivered as `sme_v1.2.0_20.zip` (2026091119).

## 27. Iteration 22 (2026-09-11) — 2026091120: broken STACK questions on the CI test site

Playwright run `93772663516` (with the environment fix): smoke 3/3 and the configuration-page
a11y test green; settings "admin on/off", performance and attempt a11y red - no editor appeared
at all. The screenshot shows every STACK question with "This question generated an unexpected
internal error … The question has been marked as broken during editing or import."

Root cause: STACK validates each imported question with the CAS and sets `isbroken` when it
fails. A freshly installed site (build-test-site.sh) has `qtype_stack | maximacommand` unset, so
the CAS was unreachable during the seed import. Locally the site had been configured with
`setup-stack-cas.php` before seeding - which is why it passed here.

Fix in `seed.php`: configure the CAS (platform linux, maxima, maximalocal) and require a genuine
connection before importing; after each import fail with a clear message if STACK marked the
question broken.

Verified on a freshly built site exactly like CI (`build-test-site.sh`, `maximacommand` unset):
0 of 12 STACK questions broken; Playwright with the GitHub-style environment: smoke 3/3,
settings 6/6 (2.6 min), performance 1/1, a11y 2/2.

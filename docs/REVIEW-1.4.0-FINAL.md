# 1.4.0 - final review (build 2026110300)

Answer to the critical-friend re-audits of 3 November 2026 (audited commit `7a24fc8f`, build
2026110201) and of 2 November 2026 (commit `5ed3c1eb`). Build 2026110300 changes only tests and
the Playwright workflow; the editor's code is that of 2026110201. Scope: this plugin only. StackMathGame and other
plugins are not decided here; foreign STACK components are tested only for how the editor
behaves next to them.

All runs below are local runs on the working tree of build 2026110300 - Moodle 4.5.15 and
Moodle 5.3 (PHP 8.3, PostgreSQL 16), STACK 4.13.1 with Maxima 5.46, Chromium 141. Nothing has been
pushed from this work, so there is no GitHub run on the final SHA yet; every point that requires
one is marked open. Local runs do not replace that evidence.

## Overview

| Issue | Prio | State after this work | Open until |
|---|---|---|---|
| #105 Playwright 5.3 cancelled | P1 | cause proven (job limit), the slow part removed, limits and report path fixed; 5.3 locally 110/110, 0 skips, gate green | the GitHub run on the pushed SHA (both matrix jobs green) |
| #102 / #104 foreign STACK input types | P0 | fixed in 2026110201; Jest 24/71 red before, green after | CI on the pushed SHA |
| #100 submit / switch / form | P1 | own tests green on 4.5 and 5.3 | GitHub Playwright on the SHA; StackMathGame end-to-end run (R7, scope decision) |
| #101 equiv / firstline / textarea | P1 | additionally: a wrong step gets STACK's step marks, not the first-line message | GitHub Playwright on the SHA; R7 |
| #102 GeoGebra and `mod_geogebra` | P1 | `set` proven by grading, `watch`, `remember`, two boards, blocked geogebra.org | `mod_geogebra` browser run (R5); angles (no angle object in STACK's applet) |
| #103 JSXGraph | P1 | all bindings, two-way, fast changes and typing right before the Check, replaced question | Firefox (R6); a blocked JSXGraph stops STACK's own Check (STACK) |
| #104 goodies | P1 | grading compared with the editor off and on for every question; free text with `[[ascii]]` and `[[hint]]`; delayed adapt | native drag in an iframe (Playwright limit, documented); Firefox (R6) |
| #96 test pyramid | P2 | Playwright 4.5 and 5.3 complete; migration mapping audited; numbers corrected | main CI on the SHA |
| #99 formal gates | P2 | removed; no formal gate added (the 5.3 no-skip rule is a test completeness rule of the existing gate) | first main run with the new graph |
| #97 / #98 | P3 | done in code and browser | main CI |
| #71 release | P2 | version, change log, README, AMD build agree on 2026110300 | tag, release artefact and SHA-256; decisions on R5 - R7 |

## #105: why the 5.3 job was cancelled, and what changed

Run 41585693053, job "Playwright / MOODLE_503_STABLE": set up at 05:44:53 UTC, tests from
05:50:35, `##[error]The operation was canceled.` at 06:20:07 - 35 min 14 s after the job started,
which is the job's `timeout-minutes: 35`. The 4.5 job of the same run had finished at 06:10, so
the workflow's concurrency group (`cancel-in-progress`) did not cancel it - that would have ended
both - and no infrastructure error is in the log. `run-summary.js` then found no result file,
because Playwright writes its JSON report only at the end.

Time per spec from the job log (5.3 / 4.5): `settings.spec.js` 511 s / 323 s, `interop.spec.js`
328 s / 230 s, `editor-rendering.spec.js` 188 s / 106 s, set-up about 6 minutes. The settings time
came from `seed.php --reset`, called before each of its cases and in `editor-rendering.spec.js`:
it ran the whole seed with the CAS warm-up of all 31 questions every time - 37 s per call on a
warm local Moodle 5.3. The reset now ends right after the settings quiz (3 s per call).

Changes: job limit 70 minutes (set-up 6, tests about 21 - 30, retries with video and trace);
Playwright's `globalTimeout` (55 minutes in CI) ends a run that is still too slow and writes the
report, so the gate shows what was not reached instead of "no result file"; on 5.3 the CI run
sets `SME_NO_OPTIONAL_SKIPS=1`. No test, assertion, fixture or gate was weakened.

Locally after the change, Moodle 5.3: 110 tests in 20.6 minutes (`settings.spec.js` 154 s).
One full 5.3 run before the last fixes had two failures: the keyboard Check of
`visible-value.spec.js` pressed Enter while STACK's validation still held the focus (the test now
presses Enter only once the button has the focus), and once the blocked-GeoGebra case ran into the
test timeout; it passed in eight further runs (4 repeated, 2 in the whole interop spec, the full
run), its cause is not found.

## #102 / #104: which field gets an editor

`input_fields.js::fieldKind()`: an explicit `data-stack-input-type` is authoritative - `algebraic`
and `units` get the one-line editor, everything else (geogebra, string - also Parsons and JSXGraph
custom bindings -, json, freetext, notes, numerical, singlechar, matrix, varmatrix, boolean,
dropdown, an unknown future type) stays native. Without type metadata only a text input with
STACK's class `algebraic` in a `.que.stack`, named or identified `..._ansN`, gets one.
`textarea_fields.js` already took only `equiv` and `textarea`.

Before (build 2026110200): `tests/jest/foreign_input_types_102_104.test.js` - 24 of 71 red (typed
geogebra, string, json, parsons, numerical, singlechar, matrix and an unknown type named `_ans1` or
`_ans12` got MathQuill; untyped non-algebraic fields were converted; a mixed page had three
editors instead of two). In the browser with the old AMD build on 4.5, `interop.spec.js` stopped at
the first assertion: the string field of the mixed-types question had an editor. After: 71/71 and
4/4.

## Interoperability (#102 - #104)

`docs/INTEROP.md` has the rule, the matrix and the limits. `interop.spec.js` plays each scenario
with the editor switched off for the whole site (no editor script) and on, and compares for every
answer field: value before the Check = request = stored step (`attempt-state.php`) = page after
the reload, the widgets' values between the two runs, and - after "Submit all and finish" -
STACK's grading of every question.

| Scenario | 4.5 | 5.3 |
|---|---|---|
| every STACK input type (12 inputs), free text with special characters | green | green |
| JSXGraph: all bindings of STACK's demo, two-way through the editor | green | green |
| JSXGraph: fast drags, typing right before the Check, a replaced question | green | green |
| GeoGebra: `set` (right answer built from it, graded 1), `watch`, `remember`, two boards, reload | green | green |
| GeoGebra with geogebra.org blocked | green | green |
| Parsons proof and grid, reveal, adapt (button, delay), STACK-JS, free text with `[[ascii]]` and `[[hint]]` | green | green |

Findings that are not the editor's: STACK's JSXGraph demo with `width="100%"` collapses to zero
width in a quiz without the editor (fixture uses 360px); a Parsons block takes the focus on the
first click into the page; JSXGraph serialises a restored board with a different floating-point
tail; STACK reads watched GeoGebra objects every 300 ms; with JSXGraph's script blocked, STACK's
own Check does not submit the page - all with the editor off as well.

## #98: decision for option C

The size is set on the `<select>` found by its id through PHP's DOM extension
(`admin_setting_multiselect_sized::size_select()`), instead of a string replacement of
`size="10"` (A) or a template override (B). Serialisation risks: the DOM round trip may change
attribute quoting and entity spelling of the surrounding markup; the method parses a wrapper with
an explicit UTF-8 declaration, returns the markup unchanged when the element is not found, and
PHPUnit covers three markup variants, UTF-8 labels and the missing element. A and B are
alternatives, not further requirements.

## Test runs on the final working tree

| Suite | Moodle 4.5 | Moodle 5.3 |
|---|---|---|
| Jest | 31 suites, 3393 tests, all green | - |
| PHPUnit (`SME_REQUIRE_CAS=1`) | 248 tests, 4627 assertions, all green, 1 skip (adaptivequiz installed: the "without adaptivequiz" case) | 248 tests, 4606 assertions, all green, 4 skips (adaptivequiz not installed) |
| Playwright (strict fixtures, gate) | 108 passed, 2 optional skips (dark mode: no colour modes on 4.5), gate green, 17.5 min | 110 passed, 0 skipped (`SME_NO_OPTIONAL_SKIPS=1`), gate green, 20.6 min |
| Behat | 6/6 scenarios, 55 steps | - (CI cell 5.3/MariaDB) |
| moodle-plugin-ci validate, savepoints, phpdoc, phpcs (`--max-warnings 0`) | green | - |
| AMD build | rebuilt with grunt, identical to the shipped files | - |
| `.github/ci-complete.sh --self-test` | green | - |

Not run here (GitHub only): the main CI matrix (4.5 - 5.3 x PHP x PostgreSQL/MariaDB), upgrade
from the published release, concurrency, coverage floor, NVDA, k6, JMeter, release artefact, and
any Firefox run. Local runs do not replace the GitHub evidence on the pushed SHA.

## Release decision

1.4.0 build 2026110300 is releasable for the editor's own scope once the pushed SHA has a green
main CI and a green Playwright run with both matrix jobs. No P0/P1 of the editor is open as a
defect. Three points are not proven and need the maintainer's decision before the tag
(`docs/RESIDUAL-RISKS.md`): R5 (no browser run on a `mod_geogebra` activity), R6 (Chromium only)
and R7 (no end-to-end run inside StackMathGame). Recording a risk does not tick a mandatory DoD:
the issues stay open until the decision is recorded there.

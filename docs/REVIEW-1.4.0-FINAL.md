# 1.4.0 - final review (build 2026110201)

Answer to the critical-friend re-audit of 2 November 2026 (audited commit `5ed3c1eb`, build
2026110200) and to the re-audit before it. Scope: this plugin only. StackMathGame and other
plugins are not decided here; foreign STACK components are tested only for how the editor
behaves next to them.

All runs below are local runs on the working tree of build 2026110201 - Moodle 4.5.15 and
Moodle 5.3 (PHP 8.3, PostgreSQL 16), STACK 4.13.1 with Maxima 5.46, Chromium 141. Nothing has been
pushed from this work, so there is no GitHub run on the final SHA yet; every point that requires
one is marked open. Local runs do not replace that evidence.

## Overview

| Issue | Prio | State after this work | Open until |
|---|---|---|---|
| #102 / #104 foreign STACK input types got an editor | P0 | fixed: the explicit STACK type decides, the `_ansN` name is no proof; reproduced before (Jest 24/71 red, browser), green after | CI on the pushed SHA |
| #100 submit / switch / form | P1 | fixed in 2026110200; now also: question replaced three times, Check by keyboard, revisit; widget-written values on mixed pages | GitHub Playwright 4.5/5.3 on the pushed SHA |
| #101 equiv / firstline / textarea | P1 | four-line chain validated and graded; omitted first line stays omitted; fractions, powers, an invalid line through off/on, reload, revisit; emptied textarea | GitHub Playwright 4.5/5.3 on the pushed SHA |
| #102 GeoGebra and `mod_geogebra` | P1 | STACK GeoGebra: two boards, watched number and point into editor fields, `remember` in a string and a `geogebra` input, reload - editor off and on, 4.5 and 5.3. `mod_geogebra`: no editor on its pages (PHPUnit) | a browser run with `mod_geogebra` installed (R5); GitHub run |
| #103 JSXGraph | P1 | all bindings of STACK's binding demo by mouse drag, two-way through the editor, reload; custom binding's string native | GitHub run; Firefox (R6) |
| #104 Parsons, reveal, adapt, STACK-JS, mixed types | P1 | four goodie fixtures plus a question with every STACK input type, editor off and on, 4.5 and 5.3 | GitHub run; Firefox (R6) |
| #96 test pyramid | P2 | Playwright 4.5 and 5.3 complete and green; migration mapping audited against the tests it names | main CI incl. upgrade, concurrency, coverage on the pushed SHA |
| #99 formal gates | P2 | removed (2026110200); no formal gate added since | first main run with the new graph, link in #99 |
| #97 question version | P3 | integer or escaped (PHPUnit); configuration page in the browser on 4.5/5.3 (`settings.spec.js`, `configure-access.spec.js`) | main CI |
| #98 admin multiselect | P3 | DOM sizing (option C, see below); real admin page on 4.5 and 5.3: size, label, keyboard, save, reload | main CI |
| #71 release | P2 | version, change log, README, AMD build agree on 2026110201 | tag, release artefact and its SHA-256 from the pushed commit; maintainer's decision on R5/R6 |

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
the reload, and the widgets' values between the two runs.

| Scenario | 4.5 | 5.3 |
|---|---|---|
| every STACK input type (12 inputs) | green | green |
| JSXGraph: `bind_point`, `bind_slider`, `bind_point_dual`, `bind_point_relative`, `bind_point_direction`, `bind_list_of`, `define_group`, `custom_bind`; typing `[2,-1]` into the editor moves the point | green | green |
| GeoGebra: two boards, watch (number, point), remember (string, geogebra input), reload | green | green |
| Parsons proof and grid, reveal, adapt, STACK-JS, algebraic editor on the same page | green | green |

Findings that are not the editor's, recorded so they are not mistaken for it later: STACK's
JSXGraph demo with `width="100%"` collapses to zero width in a quiz without the editor (fixture
uses 360px); a Parsons block takes the focus on the first click into the page with the editor off
as well; JSXGraph serialises a restored board again with a different floating-point tail.

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
| Playwright (strict fixtures, gate) | 105 passed, 2 optional skips (dark mode: no colour modes on 4.5), gate green | 107 passed, 0 skipped (`SME_NO_OPTIONAL_SKIPS=1`), gate green |
| Behat | 6/6 scenarios, 55 steps | - (CI cell 5.3/MariaDB) |
| moodle-plugin-ci validate, savepoints, phpdoc, phpcs (`--max-warnings 0`) | green | - |
| AMD build | rebuilt with grunt, identical to the shipped files | - |
| `.github/ci-complete.sh --self-test` | green | - |

Not run here (GitHub only): the main CI matrix (4.5 - 5.3 x PHP x PostgreSQL/MariaDB), upgrade
from the published release, concurrency, coverage floor, NVDA, k6, JMeter, release artefact, and
any Firefox run.

## Release decision

1.4.0 build 2026110201 is releasable for the editor's own scope once the pushed SHA has a green
main CI and a green Playwright run on 4.5 and 5.3. No P0/P1 of the editor is open as a defect.
Two points are not proven and need the maintainer's decision before the tag (`docs/RESIDUAL-RISKS.md`):
R5 (no browser run on a `mod_geogebra` activity) and R6 (interoperability in Chromium only).

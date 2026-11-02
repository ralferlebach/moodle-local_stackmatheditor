# 1.4.0 - final review (build 2026110200)

Answer to the re-audits of 2 November 2026 ("Nacharbeitsauftrag STACK Math Editor 1.4.0" and
"StackMathGame und StackMathEditor 1.4 - Re-Audit"). Baseline of the audit: development
`5251061e` (build 2026100801). This document lists, per issue, what was changed, how it is
proven, what is still open, and the resulting release decision.

All runs below are local runs on the working tree of build 2026110200 - Moodle 4.5.15 (PHP 8.3,
PostgreSQL 16) and Moodle 5.3 (PHP 8.3, PostgreSQL 16), STACK with Maxima 5.46, Chromium 141.
Nothing has been pushed from this work, so there is no GitHub run on the final SHA yet; every
point that requires one is marked open.

## Overview

| Issue | Prio | State after this work | Open until |
|---|---|---|---|
| #100 switched-off editor overwrote the visible answer | P1 | fixed; reproduced before, green after (Jest with the real modules, Playwright 4.5 and 5.3) | CI on the pushed SHA; StackMathGame part see below |
| #101 equivalence chains: value/default, serialisation, life cycle | P1 | fixed; firstline/mustverify fixture, chain validated and graded, omitted first line stays omitted; multi-line questions inserted later now get their editor | CI on the pushed SHA; StackMathGame part see below |
| #99 formal release gates | - | removed (`maturity-gate`, `release-guard.yml`, sign-off file and checker); `CI complete` depends on the functional jobs directly, self-test in the job | first main run with the new graph |
| #96 test pyramid acceptance | P1 | Playwright 4.5/5.3, PHPUnit 4.5/5.3 incl. CAS contracts, Behat 6/6 on the final working tree | main CI incl. upgrade, concurrency, coverage on the pushed SHA |
| #71 release documentation | P1 | version, README, change log agree; P1s fixed, not accepted | release artefact and its SHA-256 from the tag |
| #97 question version in HTML | P3 | integer or escaped; PHPUnit | main CI |
| #98 admin multiselect | P3 | DOM-based sizing by element id; PHPUnit for options, size, semantics, save/reload, markup variants | main CI |

## #100 / #101: before and after

The defect was reproduced with real interaction before it was fixed:

* `tests/jest/visible_value_100_101.test.js` loads the real `input_fields`, `textarea_fields`,
  `stack_bridge` and `editor_toggle` with the bundled MathQuill and jQuery in jsdom; only Moodle's
  string loader is stubbed. Against the sources of build 2026100801, 20 of its 28 tests fail;
  with build 2026110200 all pass.
* `tests/playwright/visible-value.spec.js` clicks the switch, types into the visible field, and
  clicks, taps or presses STACK's Check button. It compares the request form data, the stored
  question-engine step (`tests/playwright/attempt-state.php`, read-only) and the page after the
  reload. With the AMD build of 2026100801 on Moodle 4.5, 8 of its 11 tests failed then (the
  twelfth, a replaced equiv question, was added afterwards and found the missing observer):

  | Case | Visible | Sent and stored with 2026100801 |
  |---|---|---|
  | editor off, typed `2*2=4`, Check by click | `2*2=4` | `x+1` (stale editor) |
  | editor off, typed `2*2=4`, Check by tap | `2*2=4` | `x+1` |
  | on, off, typed `3 * x`, on, Check | `3 * x` | `3x` |
  | two inputs, one off | `a-1` | `z^2` |
  | textarea off, `x=1` / `y=2` | two lines | empty |

  With build 2026110200: 12 of 12 green on Moodle 4.5 and on Moodle 5.3.

The equivalence-chain fixture (`tests/fixtures/stack_equiv_chain.xml`) is a STACK equiv input
with `ta:[1+2*3^3,1+2*27,1+54,55]`, simplification off, syntax hint and option `firstline`,
`mustverify` and the answer test EquivFirst. The browser test shows the prescribed first line in
the textarea and in the editor, sends the four-line chain, sees it validated on the first Check
and graded 1 on the second. A deliberately omitted first line stays omitted - in the request, the
stored step and after the reload - and STACK answers "You have used the wrong first line in your
argument!": a rule of the question, not a transfer error. The STACK rules were not changed.

## Test runs on the final working tree

| Suite | Moodle 4.5 | Moodle 5.3 |
|---|---|---|
| Jest | 30 suites, 3322 tests, all green | - |
| PHPUnit (`SME_REQUIRE_CAS=1`) | 247 tests, 4619 assertions, 1 skip (adaptivequiz is installed: the "without adaptivequiz" case) | 247 tests, 4598 assertions, 4 skips (adaptivequiz not installed) |
| Playwright (strict fixtures) | 97 passed, 2 optional skips (dark mode, no colour modes on 4.5) | 99 passed, 0 skipped (`SME_NO_OPTIONAL_SKIPS=1`) |
| Playwright run-summary gate | green | green |
| Behat | 6/6 scenarios, 55 steps, 113.5 s in the scenarios | - (CI cell 5.3/MariaDB) |
| moodle-plugin-ci savepoints, validate, phpdoc, codechecker | green | - |
| phpcs (moodle) | 0 errors, 0 warnings | - |
| `.github/ci-complete.sh --self-test` | green; `test=success jest=failure` exits 1 | - |

Not run here (GitHub only): the main CI matrix (4.5 - 5.3 x PHP x DB), upgrade from the
published release, concurrency, coverage floor, NVDA, k6, JMeter, release artefact.

## StackMathGame (second audit, N01 - N09)

Worked in `local_stackmathgame` (build 2026090250 -> 2026090251, release 0.9.0, ALPHA) on its own
Moodle 4.5.15 site (PostgreSQL 16, PHP 8.3, Maxima 5.46, qtype_stack 4.13.1, this editor build
installed). Not pushed either.

| Item | Change | Proven by | Not proven |
|---|---|---|---|
| N01 session key in the event log | `collectAnswers()` no longer sends `sesskey`; `submit_answer` drops it and logs an allow-list of named answer fields; upgrade 2026090251 redacts old rows (idempotent, marks `sesskeyredacted`) | PHPUnit `runtime_endpoints_security_test` (written `payloadjson`, refused submit without key, key among answers does not authorise), `eventlog_redaction_test` (5), `stack_submit_test` with real STACK; Jest | a genuine answer of exactly ten alphanumerics in an old row is also removed (documented price) |
| N02 / N10 editor in the game | see #100 / #101 above | `rpg-verified-play.spec.js`: editor off stores exactly the visible value; editor on with the four-line equiv chain, omitted first line stays omitted | 1 flake in 24 runs: after a fragment swap the editor did not re-attach and the fallback reload did not fire; cause not found |
| N03 check under failure | flat submit chain; render errors caught, never resent or rewarded; no reload without a native submitter; optional bootstrap calls cannot block the start; `aria-live` status line | Jest "the check under failure" (7, real RPG mode, injected failures per stage) | - |
| N04 unsaved state | per-field baseline; newer edits carried into the swapped question; re-init reload waits and never discards unsaved values | Jest "the unsaved-changes state" (10) | Moodle 4.5 has no per-field dirty flag; form-level only |
| N05 settings and labels | `default` label created at install and by the upgrade; access check against the cmid's context; validated, transactional writes; bounded design list | PHPUnit `quiz_settings_service_test` (9 new, incl. real rollback); the two formerly red Behat scenarios green | - |
| N06 resolver, active slot, quest stages | configured wrong-answer rule executed; future quest stages not playable; server-resolved slot presented; navtiming scenarios wait for STACK validation, exclusion removed from CI | PHPUnit resolver/page-group/output-hooks/endpoint tests; Behat `branch_navigation` 5/5, new `page_groups` 3/3 | - |
| N07 HUD cache | cache keyed by user and campaign, other players' entries dropped, server state wins | Jest `rpg_hud_cache.test.js` (5; 5/5 red before) | - |
| N08 fragment endpoint | own running attempts only, same playability check as submit; now returns the question's JavaScript (STACK validation after a swap) | PHPUnit (7 fragment cases) | - |
| N09 real browser play | `rpg-verified-play.spec.js`: keyboard MathQuill, wrong then right, back/forward, reload, equiv chain, real finish checked against the database; 390 px and 200 % zoom | 4 tests, 24 runs, last 3x4 and 2x4 runs all green | Firefox; Moodle 5.x; MariaDB; a site without the editor plugin. `rpg-full-ui.spec.js` still red in its last step (core "Invalid parameter value detected" on `mod/quiz/edit.php`, aborted requests on page change), cause not investigated |
| ESLint `game_engine.js:461/482` | removed with the restructuring | ESLint `--max-warnings 0` clean; AMD build byte-identical to grunt | - |

Game totals on the final working tree: Jest 55/55; PHPUnit 309 tests, 1331 assertions, 9 skips
(block_xp/block_stash not installed, 4 existing placeholders); Behat 34 scenarios, 382 steps;
phpcs clean except one pre-existing finding in each of four unchanged `.github/*.php` scripts.
Spot-checked independently: Jest 55/55, phpcs on classes/db/amd/tests clean, the N01 security and
redaction tests 18/18.

## Release decision

1.4.0 build 2026110200 is releasable for the editor's own scope once the pushed SHA has a green
main CI and a green Playwright run on 4.5 and 5.3 - no P1 of the editor is open or accepted as a
risk. The integration with StackMathGame is released with the game's own state (alpha); what is
proven of it is listed in the game section.

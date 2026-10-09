# Test architecture

Since 1.4.0 (#96) every check runs on the cheapest layer that can still prove it. Behat is the
most expensive layer by far - a whole Moodle, a browser, STACK and Maxima for every scenario - so
it keeps only what nothing else can see. `docs/TEST-MIGRATION.md` lists where each former Behat
scenario went.

## Layers

| Layer | Runs | Proves | Does not prove |
|---|---|---|---|
| Jest (`tests/jest`) | the Jest job of the main CI, `make jest` | tex2max and max2tex rule by rule in all five variable modes; round trips; property and fuzz tests with a fixed seed; the toolbar templates (`fixtures/buttons.json`); MathQuill's own parser in jsdom (`math_contracts.test.js`, `contract_fixes_96.test.js`) | that STACK accepts the result; anything about the page |
| PHPUnit (`tests/unit`) | every CI cell | configuration storage, scopes, inheritance, activation, access, return URLs, forms, privacy, backup and restore, upgrade; `cas_contract_test.php` sends every contract through STACK's validation and Maxima | the browser |
| Playwright (`tests/playwright`) | `playwright.yml` on 4.5 and 5.3, strict fixtures | MathQuill in a real attempt: typing, restoring, toolbar templates and the cursor, external values, multi-line inputs, accessibility, dark mode, right to left, layout, performance | STACK's grading |
| Behat (`tests/behat`) | main CI cells 4.5/8.2/PostgreSQL and 5.3/8.4/MariaDB 11.4, dev workflow | the CAS works (preflight); one answer from the editor through STACK and Maxima; the configuration page reached the way a teacher reaches it, saved and reloaded; the login redirect | conversion rules (Jest), CAS contracts (PHPUnit) |

## The contract fixture

`tests/fixtures/math_contracts.json` is the single list of what each button and each formerly
Behat-tested construct means: LaTeX, the exact Maxima tex2max must write, the packages it needs,
and what STACK does with it (`accept`, optionally with a `value`, or `known-defect` with the stage
and a description). Three suites read it:

* `tests/jest/math_contracts.test.js` - tex2max gives exactly `maxima`; the same after the LaTeX
  went through the bundled MathQuill (a `mathquillDefect` is pinned the other way round: it has
  to keep failing until it is fixed); every visible button and every group has a contract.
* `tests/unit/cas_contract_test.php` - STACK's validation and Maxima accept every `accept`
  contract (and give `value` where one is set) and still reject every `known-defect`; a fixed
  defect fails until the fixture says so.
* `tests/behat/cas_contract.feature` - the one contract marked `browserSmoke` end to end.

A new button needs a contract; `math_contracts.test.js` fails without one.

## Rules for new tests

1. A conversion rule is a Jest test, in every variable mode where the mode matters.
2. Whether STACK accepts something is a contract in the fixture, checked by PHPUnit against the
   real CAS. `SME_REQUIRE_CAS=1` (main CI) turns a missing CAS into a failure.
3. Behaviour of the field, the toolbar or the page is a Playwright test. Fixtures are strict
   (`SME_STRICT_FIXTURES`); an optional skip has to be declared, and `SME_NO_OPTIONAL_SKIPS=1`
   forbids it on 5.3.
4. A Behat scenario is added only when the check needs Moodle's navigation, a moodleform round
   trip or STACK's grading in a real attempt, and none of the layers above can show it. It must
   not reset the CAS or purge caches; the step library repairs the CAS configuration cheaply.

## Timings

Each Behat run appends one JSON line per scenario to `$SME_BEHAT_TIMINGS`;
`.github/behat-timings.py` turns them into JSON, CSV and a Markdown table for the job summary and
the artefact `behat-timings-<moodle>-<php>-<db>`. The baseline before #96 and the local numbers
after it are in `docs/TEST-MIGRATION.md`.

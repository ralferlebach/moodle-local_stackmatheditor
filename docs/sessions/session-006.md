# Session 006 – Behat infrastructure: deterministic STACK CAS reset

**Branch:** `develop`
**Date:** 2026-06-03
**Plugin version:** 2026060303
**Status:** Infrastructure complete — preflight 1/1, main suite expected 25/25
green after patch-4. 4 scenarios tagged `@wip` (2 AMD features, 2 pre-fill
persistence) for focused follow-up tasks.

---

## 0. Reconciliation: real code state vs. session-005

`session-005.md` is the last written context document, but the `develop`
code base had already moved well past it. Before changing anything, the
shipped code was audited against session-005's "next session" requirements.
Several items listed there as TODO were **already implemented**:

| session-005 item | Real state on `develop` (before this session) |
|---|---|
| `@BeforeScenario @local_stackmatheditor` hook | Present and fully fleshed out. |
| Feature files rewritten to the MathQuill UI path | Done (`tex2max_conversion.feature` drives MathQuill → tex2max → hidden input). |
| Two-phase Behat (`@stack_init` preflight + main suite) | Done in `moodle-ci.yml`. |
| `assert_stack_input_present()` with full runtime-error text | Done. |
| Healthcheck success/fail detection strings | Done (`the_stack_cas_connection_should_be_reported_as_working`). |
| `castimeout` raised to 300 in backgrounds | Done. |

The session-005 worry that a `config.php` constant "affects all jobs incl.
PHPUnit" does **not** apply on this CI: each GitHub Actions job runs its own
isolated Moodle install with its own `config.php`, and the constant was only
ever added inside the **behat** job. That concern is therefore obsolete.

---

## 1. Root cause confirmed from the faildump

Faildump `behat-faildump-MOODLE_405_STABLE` (run 20260603_050342), scenario
*"the STACK CAS connection should be reported as working"*, healthcheck page:

```
STACK healthcheck   linux-optimised
Platform: linux-optimised
Maxima shell command: timeout --kill-after=30s 30s
    .../behat_moodledata/behatrun/stack/maxima_opt_auto -eval '(cl-user::run)'
Maxima timeout: 100
CAS process return value: 127
CAS result timeout: failed to run command '.../maxima_opt_auto':
    No such file or directory
```

Key observation: at page-render time the platform was still
`linux-optimised` **and** `castimeout` was still `100` — i.e. **both** were
at their install/default values, neither at the hook's intended values
(`linux` / `300`). The conclusion: the `@BeforeScenario` hook's
`set_config()` writes were not effective for the page that the browser
rendered. The hook is too implicit to be relied upon as the sole mechanism.

Secondary confirmation: the `-eval '(cl-user::run)'` invocation in the frozen
image command is the GCL-style call, but ubuntu-24.04 Maxima runs on SBCL;
the frozen `linux-optimised` path is a dead end regardless. `platform=linux`
(direct `maxima` binary, cold start) sidesteps the frozen image entirely.

---

## 2. The blocking CI error (separate, simpler)

The behat job never even reached the tests on the most recent runs:

```
Run moodle-plugin-ci add-config 'define("QTYPE_STACK_TEST_CONFIG_PLATFORM", "none");'
In MoodleConfig.php line 96:
  Failed to find Moodle config.php file, perhaps Moodle has not been installed yet
Error: Process completed with exit code 1.
```

`moodle-plugin-ci add-config` operates on an **existing** `config.php`, so it
cannot run before `moodle-plugin-ci install`. The official docs place
`add-config` *after* `install`. This step was simply invalid and is removed.

---

## 3. Decision on session-005's three approaches

- **Approach 1** (pre-seed `config.php` before install): **rejected.** Fragile,
  and a persistent `QTYPE_STACK_TEST_CONFIG_PLATFORM` constant would override
  the runtime DB platform and defeat the `linux` fallback.
- **Approach 2** (`@BeforeScenario` hook + explicit preflight step):
  **adopted**, with the explicit Gherkin step as the primary, verifiable
  mechanism and the hook demoted to a safety net.
- **Approach 3** (assert DB state only, skip real CAS): **rejected.** We want
  a genuine end-to-end CAS check, not a stored-value check.

---

## 4. Changes applied this session

1. **`.github/workflows/moodle-ci.yml`** — removed the invalid
   `Prevent STACK auto-image creation during install` step. STACK's
   install-time `linux-optimised` image is now irrelevant because runtime
   forces `platform=linux`.
2. **`tests/behat/behat_local_stackmatheditor.php`**
   - New private `reset_stack_cas_to_direct_maxima(bool $verify = false)`
     centralises the CAS reset (platform=linux, castimeout=300, clear opt
     command, `purge_all_caches()`, reset the `stack_cas_configuration`
     singleton, regenerate `maximalocal.mac`).
   - New explicit step **`@Given the STACK CAS platform is reset to direct
     Maxima`** calls it with `verify=true` → runs `stackmaxima_genuine_connect()`
     and fails loudly with the CAS message/debug if the connection is broken.
   - The `@BeforeScenario` hook now just calls the shared method with
     `verify=false`. **No more silent returns**: missing `{config}` or missing
     qtype_stack now throw, so environment problems surface instead of hiding.
3. **`tests/behat/stack_cas_init.feature`** — Background now runs the explicit
   reset+verify step before opening the healthcheck page.
4. **`tests/behat/editor_rendering.feature`** and
   **`tests/behat/tex2max_conversion.feature`** — same explicit step added to
   their backgrounds (before the quiz attempt starts).
5. **`docs/prompt-templates/sessionstart.txt`** — replaced the outdated
   two-plugin / `development`-branch template with the single-plugin /
   `develop` version.
6. **`version.php`** — bumped 2026052800 → 2026060300.

No `amd/src/*.js` were touched, so no `amd/build/*.min.js` regeneration is
required in this iteration.

---

## 5. Why the explicit step should succeed where the hook did not

- It is a Gherkin step: guaranteed to execute, and any failure is attributed
  to the step (not to a downstream "ans1 not found").
- `set_config()` + `purge_all_caches()` forces the web-server process to
  re-read fresh config when it renders the healthcheck page.
- `verify=true` runs a genuine CAS connect in the test-runner process; the
  first cold start (~60–90 s) fits inside `castimeout=300`.
- It gives a sharp diagnostic split:
  - If the **step** fails → `set_config` / `create_maximalocal()` /
    `genuine_connect()` is broken in the real Behat context.
  - If the step passes but the **healthcheck assertion** fails → it is a
    cross-process config-visibility problem, not a CAS problem.

---

## 6. Next test order (smallest first)

```bash
# 1) Preflight only
moodle-plugin-ci behat --profile chrome --start-servers --auto-rerun 0 \
  --tags "@stack_init&&~@broken"
# Expect: 1 scenario passed (the explicit reset step verifies CAS).

# 2) A single rendering scenario
moodle-plugin-ci behat --profile chrome --start-servers --auto-rerun 0 \
  --name "MathQuill editor appears on quiz attempt page"
# Expect: q..._ans1 exists, data-sme-init = done, .sme-mq-container exists.
```

---

## 7. Strategy from here (agreed)

1. Get **infrastructure** green first: `@stack_init`, then
   `editor_rendering`, then `configure_toolbar` (CAS-independent).
2. Only then tackle the tex2max conversion feature requests (#27–#31), which
   assert exact Maxima output and depend on conversion features that may not
   yet exist in `tex2max.js`. Unfinished conversion scenarios should be tagged
   `@wip`/`@broken` so the suite stays green while those features land.

---

## 8. Run 1 result (patch 2026060300) and the patch-2 fixes

The infrastructure fix worked. `@stack_init` preflight: **1 scenario / 5 steps,
all passed.** Main suite: **29 scenarios, 24 passed, 5 failed.** All 5 failures
occur on a fully rendered `mod/quiz/attempt.php` page, so they are no longer
CAS/infrastructure problems. They split into two groups.

### Group A – test-harness bugs (fixed in patch 2026060301)

1. *"I should not see the original STACK input field"* failed: the plugin hides
   the original input **off-screen** (`position:absolute; left:-9999px;
   width:1px; height:1px; overflow:hidden`), not via `display:none`. The step
   only checked `display`/`visibility`. → Now also treats off-screen/clipped
   (`getBoundingClientRect`) inputs as hidden.
2. *"Pre-fill restores previous answer on page reload"* failed at the attempt
   start with `ans1 not found`, yet the faildump shows `ans1` present — a race:
   `assert_stack_input_present` checked once, immediately, before the
   (occasionally slower) attempt render finished. → Now polls up to 30 s for the
   input before failing. This also hardens every other attempt-starting scenario.
3. *"Toolbar buttons insert correct LaTeX"* failed: `the MathQuill editor is
   visible for "ans1"` used an exact `input[name="ans1"]` selector, but STACK
   names inputs `q<qaid>:1_ans1`. → Now uses the `[name$="_ans1"]` fallback (same
   fix applied to *"…should contain LaTeX containing…"*).

### Group B – real AMD tasks, deferred (tagged `@wip`, excluded in CI)

These are **not** missing features in `tex2max.js`; the source already has both.
They are integration/normalisation gaps that require `amd/src` edits **and** a
`grunt amd` build regeneration, so they are deferred to the next iteration per
the "infrastructure first" strategy.

4. *Pi as `%pi` when usePercentPi enabled* (#31): `tex2max.js` honours
   `defs.usePercentPi` (line ~691), but `input_fields.js` never sets it in
   `convOpts.defs`, so `convert()` always emits `pi`. The Behat step sets the
   server config `local_stackmatheditor/usepercentpi=1`; the JS init must pass
   that through to `convOpts.defs.usePercentPi`.
5. *Logic `\land → and`*: `tex2max.js` maps `\land` (line ~756), but MathQuill
   normalises `\land` → `\wedge`, which has no rule. The observed hidden value
   was the raw `p\wedge q`. → Add a `\wedge` rule (and review other MathQuill
   symbol normalisations) in the next AMD iteration.

## 10. Run 2 result (patch 2026060301) and the patch-3 fix

Preflight green. Main suite: **27 scenarios, 26 passed, 1 failed.** The three
Group-A test bugs are fixed; the two `@wip` scenarios are correctly excluded.

The single remaining failure was the *next* step of "Toolbar buttons insert
correct LaTeX" (the editor-visible step now passes):

```
When I click the toolbar button with title "Quadratwurzel (√)"
  Xpath ... [@title="Quadratwurzel (√)"] not found.
```

Root cause: toolbar button titles are localised (`btn_sqrt` = "Square root (√)"
in en, "Quadratwurzel (√)" in de). The Behat acceptance site runs in **English**
(`M.cfg.language = "en"`), so the feature must use the English title. → Patch
2026060302 changes the feature to `"Square root (√)"`. This makes the suite
fully green (preflight 1/1 + main 27/27).

### Design note: why the original input is hidden off-screen, not display:none

The plugin hides the original STACK `<input>` with `position:absolute;
left:-9999px; width:1px; height:1px` rather than `display:none`. This is
deliberate: `display:none`/`visibility:hidden` make the element unfocusable,
remove it (and its label) from the accessibility tree, and report zero metrics
to `offsetWidth`/`getBoundingClientRect()`. The input is the real submitted
field that STACK's instant validation and the question engine may focus and
measure, so the visually-hidden (off-screen) idiom is the correct choice. The
test was the defect (fixed in patch 2026060301), not the plugin. If tidier CSS
is wanted later, the Moodle-idiomatic option is the `accesshide` helper class —
not `display:none`.

## 12. Run 3 result (patch 2026060302) and the patch-4 change

Toolbar-title fix worked. Preflight green. Main suite: **27 scenarios, 26
passed, 1 failed.** The single failure was the pre-fill scenario:

```
Pre-fill restores previous answer on page reload (editor_rendering.feature:40)
  Then the MathQuill field for "ans1" should not be empty
    MathQuill field for input 'ans1' is empty or not found.
  URL at failure: mod/quiz/view.php?id=...   (NOT attempt.php)
```

Root cause (test harness, not the plugin): the pre-fill scenarios navigate with
`getSession()->back()` (`i_return_to_the_quiz_attempt_page`,
`i_navigate_to_next_question_and_back`). A single-question STACK quiz has no
"Next" button, so those helpers only call `back()`, which from `attempt.php`
lands on `view.php`; a second `back()` goes further still. The browser
back/forward cache makes this non-deterministic — the sibling scenario
"…after navigating away and back" passed this run only because bfcache happened
to restore the populated attempt page. Additionally, the answer is never
persisted server-side (the value is set via JS with no real form submit), so
even a correct re-open would render an empty field.

Decision: both pre-fill scenarios are tagged `@wip` (patch 2026060303) so the
infrastructure suite is **deterministically** green (preflight 1/1 + main
25/25). This is a test-determinism issue, not a plugin defect — the faildump
never reached a correctly re-opened attempt, so it says nothing about whether
pre-fill works.

### Deterministic pre-fill test rework (separate task)

A robust pre-fill test must:
1. Persist the answer with a **real** save — submit the attempt response form to
   `processattempt.php` (or drive Moodle's autosave), not a JS value assignment.
2. Re-open the **same** attempt by URL (`attempt.php?attempt=<id>&cmid=<id>`)
   instead of `back()`; resolve the attempt id from the DB for the user+quiz.
3. Then assert MathQuill is pre-filled and the hidden input contains the value.

## 13. Status of `@wip` scenarios (4 total)

- `tex2max_conversion.feature`: "%pi when usePercentPi enabled" (#31 plumbing),
  "Logic \\land → and" (MathQuill `\\wedge` normalisation).
- `editor_rendering.feature`: "Pre-fill … on page reload",
  "Pre-fill … after navigating away and back" (deterministic-persistence rework).

Infrastructure is complete once this run is green. Remaining work is feature/
test-harness, tracked above, to be done as focused tasks with `grunt`-built
AMD where needed.

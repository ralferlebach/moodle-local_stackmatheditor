# Session 006 – Behat infrastructure: deterministic STACK CAS reset

**Branch:** `develop`
**Date:** 2026-06-03
**Plugin version:** 2026060300
**Status:** Infrastructure fix applied; awaiting CI confirmation of `@stack_init`.

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

## 8. Known open issues (unchanged from session-005)

1. tex2max mixed-fraction (#29): `convert('2\frac{1}{2}') → (2+1/2)` — needs
   source-level work in `tex2max.js`.
2. tex2max `usePercentPi` (#31): per-quiz config path.
3. pm/± expansion (#30) and set-theory keywords (#28) exact-output scenarios.

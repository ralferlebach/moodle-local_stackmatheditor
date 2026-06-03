# Session 05 – STACK Behat CAS: Root Cause, Attempts, Requirements

**Branch:** `experimental-matix&equation-systems`
**Date:** 2026-06-03
**Status:** OPEN – Behat CAS initialization not stably solved

---

## 1. The Core Problem

`moodle-plugin-ci behat --start-servers` **resets** the Behat database by calling
`admin/tool/behat/cli/util_single_run.php --enable` internally.  During this
reset, STACK's `db/install.php` runs in the `BEHAT_UTIL` context and executes:

```php
[$ok, $msg] = stack_cas_configuration::create_auto_maxima_image();
```

This writes to the Behat DB:
- `platform = linux-optimised`
- `maximacommandopt = timeout --kill-after=30s 30s .../behatrun/stack/maxima_opt_auto -eval '(cl-user::run)'`

The `maxima_opt_auto` file is created in `$CFG->dataroot/stack/` at install
time. However, `moodle-plugin-ci behat --start-servers` also **reinitialises**
parts of the Behat dataroot, deleting the file. At Behat runtime the command
in the DB points to a non-existent binary → CAS fails.

**Confirmed from Healthcheck faildump:**
```
Platform: linux-optimised
Command:  timeout ... .../behatrun/stack/maxima_opt_auto -eval '(cl-user::run)'
Result:   No such file or directory
```

---

## 2. Attempted Solutions and Why They Failed

### A. `set_config('platform', 'linux')` in `stack-behat-init.php` (CLI, BEHAT_UTIL)
Runs AFTER install, sets DB to `platform=linux`. Confirmed correct by the
script's own `genuine_connect()`.

**Why it fails:** `moodle-plugin-ci behat --start-servers` calls
`util_single_run.php --enable` which re-runs plugin install logic and resets
the Behat DB back to `linux-optimised` with the missing image path.

### B. PHP constants via `moodle-plugin-ci add-config` BEFORE install
```yaml
- run: moodle-plugin-ci add-config 'define("QTYPE_STACK_TEST_CONFIG_PLATFORM", "none");'
- run: moodle-plugin-ci install ...
```
**Why it fails:** `moodle-plugin-ci add-config` requires `config.php` to exist,
which is only created during `moodle-plugin-ci install`. Chicken-and-egg:
cannot add the constant before install without a pre-existing Moodle installation.

Error: `Failed to find Moodle config.php file, perhaps Moodle has not been installed yet`

### C. PHP constants via `add-config` AFTER install (old Strategie C)
Set `QTYPE_STACK_TEST_CONFIG_PLATFORM=linux`, `QTYPE_STACK_TEST_CONFIG_CASTIMEOUT=300`.

**Why it fails:** Constants in `config.php` affect **all** jobs, including phpunit.
When the phpunit job loads `config.php`, the constants force platform=linux and
300s timeout, which breaks phpunit's own CAS assumption or its test expectations.

### D. Creating `maxima_opt_auto` from a shell script in CI
```bash
printf 'load("%s");\n:lisp (si::save-system "%s")\nquit();\n' "$MAC" "$IMAGE" | maxima
chmod +x "$IMAGE"
```
**Why it fails:** Even when the file is created (confirmed by `is_file()` = true
in the CLI script), `moodle-plugin-ci behat --start-servers` resets the
dataroot, deleting the file before Behat tests run.

### E. Strategie A (ubuntu-22.04 + Maxima 5.42.2 GCL via SourceForge)
Attempted to use ubuntu-22.04 with Maxima 5.42.2 from SourceForge DEBs
because GCL creates standalone binaries that survive dataroot resets better.

**Why it fails:** ubuntu-22.04 GitHub Actions runners only provide Maxima 5.45.1
via `apt`. The plugin's CI requires `>= 5.46`, so the version assertion fails.
Downloading from SourceForge is fragile and slow.

---

## 3. Partial Progress Made This Session

1. **AMD state markers** (`data-sme-init`) are working — confirmed `sme:"boot"`.
2. **Healthcheck detection strings** now correctly identify STACK's actual
   English success text (`CAS returned data as expected`, `live connection`).
3. **`@BeforeScenario` hook** architecture is correct but incomplete:
   ```php
   /** @BeforeScenario @local_stackmatheditor */
   public function prepare_stack_cas_for_scenario(BeforeScenarioScope $scope): void {
       set_config('platform', 'linux', 'qtype_stack');
       set_config('maximacommandopt', '', 'qtype_stack');
       set_config('castimeout', '300', 'qtype_stack');
       stack_cas_configuration::create_maximalocal();
   }
   ```
   This runs in the Behat PHP context (correct DB prefix, correct dataroot)
   before each `@local_stackmatheditor` scenario. It **would** fix the runtime
   state — but only if STACK's own CAS connector respects the freshly-written
   DB values in the same request cycle.
4. **Two-phase Behat CI** (`@stack_init` preflight + main suite) is in place.
5. **`assert_stack_input_present()`** reports full STACK runtime error text.
6. **`input_fields.js`** extended selector (`*_ans` pattern) and filter.
7. **tex2max E2E tests** rewritten as MathQuill UI tests.
8. **`castimeout` in Backgrounds** raised from 100 s to 300 s.

---

## 4. Root Architecture Requirement for Next Session

The correct fix is **one of these two approaches**, in order of preference:

### Approach 1 (Cleanest): Write to config.php before install via a shell script

STACK's `db/install.php` respects `QTYPE_STACK_TEST_CONFIG_PLATFORM = 'none'`
to skip `create_auto_maxima_image()`. The constant must be in `config.php`
**before** `moodle-plugin-ci install` runs.

`config.php` does not exist yet at that point. However, `moodle-plugin-ci` uses
a staging config file. The correct solution:

```yaml
- name: Create config.php pre-seed with STACK=none
  run: |
    # moodle-plugin-ci install creates config.php from a template;
    # --extra-config-file can be used to append lines.
    # Alternatively, write a known-path stub:
    mkdir -p "$GITHUB_WORKSPACE/moodle"
    cat >> "$GITHUB_WORKSPACE/moodle/config.php" << 'PHP'
<?php
define('QTYPE_STACK_TEST_CONFIG_PLATFORM', 'none');
PHP
```

**BUT** this requires knowing exactly when and where `moodle-plugin-ci` creates
`config.php`, and whether appending before install works with the tool's flow.
This needs verification with `moodle-plugin-ci` source code.

An alternative: look for a `--extra-config` or `--config-append` flag in
`moodle-plugin-ci install` documentation.

### Approach 2 (Robust): `@BeforeScenario` hook PLUS patching moodle-plugin-ci install flow

The `@BeforeScenario` hook already sets the DB correctly at scenario runtime.
The remaining problem is the **preflight** (`@stack_init`) — the healthcheck
scenario runs before any `@BeforeScenario` hook resets things.

**Required addition:** The `@stack_init` scenario's Background or its first step
must also reset the platform:

```gherkin
Background:
  Given I log in as "admin"
  And the STACK CAS platform is set to "linux"
```

With a step implementation that calls `set_config('platform', 'linux', ...)`.

This separates the fix into two layers:
1. `@BeforeScenario` — runtime fix for all plugin scenarios
2. Explicit step in `@stack_init` Background — runtime fix for the preflight

### Approach 3 (Quick workaround): Rename healthcheck feature to verify only DB state

Instead of navigating to the STACK healthcheck PHP page (which renders based on
live CAS calls), assert the DB values directly:

```php
/** @Then the STACK platform setting should be :expected */
public function the_stack_platform_setting_should_be(string $expected): void {
    $actual = get_config('qtype_stack', 'platform');
    if ($actual !== $expected) {
        throw new ExpectationException("...");
    }
}
```

Then `@stack_init` just verifies config is correct, not that CAS actually works.
Faster and immune to `maxima_opt_auto` issues.

---

## 5. What Works and What To Test Next

After the `@BeforeScenario` hook is confirmed working:

```
Expected editor_rendering result:
  data-sme-init = "done"  (not "boot" or "none")
  .sme-mq-container exists
  q..._ans1 input exists

Expected tex2max result:
  I enter latex "x=3 or x=6" into MathQuill for "ans1"
  ans1 value contains "or"
  ans1 value does not contain "o*r"
```

---

## 6. Known Open Issues (non-CAS)

1. **tex2max mixed-fraction tests (#29):** `convert('2\frac{1}{2}') → (2+1/2)`.
   The `insertImplicitMultiplication` function might not implement this.
   Needs source-level analysis of `tex2max.min.js` in the branch.

2. **tex2max `usePercentPi` test:** Requires per-quiz plugin config step
   `the plugin usePercentPi setting is "1"` — step not yet implemented.

3. **AMD build files** (`amd/build/*.min.js`) need to be regenerated with
   `grunt amd` after any `amd/src/*.js` changes. Not included in patches so far.

---

## 7. Session Key Learnings

- `moodle-plugin-ci behat --start-servers` re-runs `util_single_run.php --enable`,
  which re-triggers STACK `db/install.php`, which re-creates the `linux-optimised`
  DB config with the fragile `maxima_opt_auto` path.
- The Behat dataroot (`behat_moodledata/behatrun/`) is volatile between CI steps.
- `moodle-plugin-ci add-config` requires Moodle to be installed → cannot be used
  before `moodle-plugin-ci install`.
- PHP constants in `config.php` affect ALL jobs (phpunit + behat) → dangerous.
- The `@BeforeScenario` hook is the only Behat-native mechanism that runs in the
  correct DB/dataroot context before each scenario.
- STACK's `QTYPE_STACK_TEST_CONFIG_PLATFORM = 'none'` is the documented way to
  prevent `create_auto_maxima_image()` during test installation.

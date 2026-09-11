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

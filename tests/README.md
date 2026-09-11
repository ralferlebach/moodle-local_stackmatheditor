# Tests – local_stackmatheditor

Six tools, each covering what the others cannot. The split is deliberate; see
`docs/ENTWICKLUNGSUMGEBUNG.md`, section 6, for the reasoning.

| Tool | Location | Covers | Deliberately does not cover |
|---|---|---|---|
| PHPUnit | `unit/` | definitions, config_manager priority chain, quiz/page helpers | anything that needs a browser |
| Behat | `behat/` | editor rendering in a quiz attempt, tex2max via the real STACK CAS, toolbar configuration, pre-fill | load, asset delivery details |
| Jest | `jest/` | conversion logic of `amd/src/tex2max.js` / `max2tex.js` without Moodle | DOM, MathQuill, STACK |
| Playwright | `playwright/` | live site: settings page, shipped AMD build served by `requirejs.php` (videos + traces) | CAS grading |
| k6 / JMeter | `load/` | latency and error rate of the read paths under parallel requests | functional correctness |

`coverage.php` limits PHPUnit coverage to `classes/`; the CI gate (`tools/coverage_gate.php`)
enforces the floor configured in `.github/workflows/moodle-plugin-ci-main.yml`.

## Quick start (from the plugin root, inside a Moodle tree)

```bash
make jest                                  # no Moodle needed
make phpunit                               # needs phpunit_prefix / phpunit_dataroot
make behat-stack && make behat             # needs behat_* config, Selenium, Maxima
make playwright SME_ADMIN_PASS='...'       # running dev site
make k6            # BASE_URL defaults to $CFG->wwwroot
make jmeter
```

Direct PHPUnit call from the Moodle root:

```bash
vendor/bin/phpunit --testsuite local_stackmatheditor_testsuite
vendor/bin/phpunit local/stackmatheditor/tests/unit/definitions_test.php
```

## STACK / Maxima

qtype_stack is a hard dependency, and Behat scenarios that submit answers need a working CAS.
A STACK test that "passes" without Maxima has usually skipped itself. In CI, and locally via
`make behat-stack`, `.github/stack-behat-init.php` sets `platform=linux` in the Behat database
and verifies a genuine CAS connection; the `@stack_init` preflight feature must pass before the
remaining scenarios run.

## CI

| Workflow | Trigger | Runs |
|---|---|---|
| `moodle-plugin-ci-dev.yml` | push/PR, every branch except `main` | static gates, Jest, PHPUnit (reduced matrix), Behat (4.5) |
| `moodle-plugin-ci-main.yml` | push/PR to `main` | full matrix incl. Behat + release gates |
| `playwright.yml` | manual, weekly, push touching frontend/tests | Playwright smoke with videos |
| `load-k6.yml`, `load-jmeter.yml` | manual, push touching `tests/load` | load smoke |

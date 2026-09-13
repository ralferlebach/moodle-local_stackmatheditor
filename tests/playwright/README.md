# local_stackmatheditor — Playwright browser tests

Smoke-level end-to-end tests that run against a **live Moodle site**. They cannot run inside the
static moodle-plugin-ci pipeline and have their own workflow (`.github/workflows/playwright.yml`).

| Suite | Checks |
|---|---|
| `smoke.spec.js` | the site answers, the settings page opens, `requirejs.php` serves the built `tex2max` |
| `settings.spec.js` | level (admin, quiz, question, inheritance chain) × setting (on/off, toolbar groups, implicit multiplication), changed through the real UI and verified in a student attempt, with screenshots |
| `performance.spec.js` | ten STACK editors on one page: ready in time, exactly one editor and toolbar per question, also after reloading |
| `a11y.spec.js` | axe-core (WCAG 2.0/2.1 A/AA) on editors, toolbars and the configuration page; every toolbar button named from the language pack; keyboard input |

`seed.php` (idempotent, disposable test sites only) creates course `SMETEST`, a teacher, 20
students and two quizzes from the Moodle XML fixtures in `tests/fixtures`, and prints the
`SME_*` variables; `php seed.php --reset` removes the quiz/question configuration of the settings
quiz (used between the matrix tests).

## Run locally

```bash
make playwright SME_ADMIN_PASS='<admin password>'   # from the plugin root; installs Playwright on first run
# or manually:
cd tests/playwright
npm ci && npx playwright install --with-deps chromium
eval "$(php seed.php)"                             # exports SME_BASE_URL
SME_ADMIN_PASS='<admin password>' npm test
```

| Variable | Default | Purpose |
|---|---|---|
| `SME_BASE_URL` | from `seed.php` (`$CFG->wwwroot`) | site under test |
| `SME_ADMIN_USER` | `admin` | site administrator |
| `SME_ADMIN_PASS` | — (required) | password; a missing value fails the test instead of skipping it |

Reports land in `playwright-report/` (HTML) and `test-results/` (videos, traces, screenshots).
Open a trace with `npx playwright show-trace test-results/<test>/trace.zip`.

# local_stackmatheditor — Playwright browser tests

Smoke-level end-to-end tests that run against a **live Moodle site**. They cannot run inside the
static moodle-plugin-ci pipeline and have their own workflow (`.github/workflows/playwright.yml`).

The smoke suite checks three things: the site answers, an administrator can open the plugin
settings page, and `requirejs.php` serves the shipped `amd/build` module of `tex2max`.

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

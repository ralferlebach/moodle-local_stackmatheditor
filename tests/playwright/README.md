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

## Screen reader evidence (NVDA)

Same site, same seed, same accounts - only the browser runs on Windows with NVDA listening
(#69). `a11y-nvda.spec.js` is not part of the default run; it needs a visible browser and a
worker of its own.

Once, on the Windows side:

```powershell
cd tests\playwright
npx -y @guidepup/setup@0.24.1 setup         # the foreground-window lock relaxed
npm install
npx playwright install chromium
npx -y @guidepup/setup@0.24.1 install nvda  # the NVDA build the installed Guidepup expects
```

The three Guidepup parts have to fit: the library in `package.json` (pinned), the setup tool, and
the NVDA build the setup tool fetches for that library. Change one and re-run `install nvda`.

Then, against the Moodle you already develop on - from Windows, a site in WSL is reachable at
localhost:

```powershell
$env:SME_BASE_URL  = "http://localhost/moodle45_aliseadele"
$env:SME_LOAD_CMID = "..."        # from seed.php, as for every other spec
$env:SME_USER_PASS = "..."
$env:SME_NVDA      = "1"
npx playwright test --project=nvda
```

`seed.php` is the same one the other specs use; run it in WSL and take the values it prints.

NVDA does not speak during an automated run - its output goes to the speech viewer, and from
there into `transcripts/`, one file per flow with the commit and the time at the top. Those
files are the sample the release checklist asks for.

What the run settles: the editor announces itself as a named editable field, the switch says it
is a switch and says its state when it flips, toolbar buttons are read as words, the matrix
chooser announces itself and returns the focus. What it cannot settle: whether any of that is
*understandable*, in what order it comes, whether something is read twice. Read the transcripts
and answer those yourself.

`a11y-zoom.spec.js` needs no screen reader and runs in the normal suite: 200 per cent zoom
without horizontal scrolling, a 380 pixel viewport with no button outside its toolbar and none
below 24 by 24 pixels, the keyboard reaching editor and toolbar, a visible focus everywhere.


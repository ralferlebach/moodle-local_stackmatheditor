# Screen reader evidence (NVDA)

What NVDA says about the editor, recorded rather than remembered. This is the automated half of
the manual accessibility sample the release checklist asks for (#69).

## What it does and does not settle

It settles whether something is **announced at all**: an unnamed editable field, a switch that
says nothing when it flips, a toolbar button read out as a symbol, a dialog that swallows the
focus - each of those fails the run.

It does not settle whether what NVDA says is **understandable**, whether the order matches the
task, or whether something is read twice. That is a human judgement, and the workflow prints the
questions a person still has to answer.

## Running it locally (Windows only)

```powershell
cd tests\a11y-nvda
npm install
npx playwright install chromium
npx @guidepup/setup           # installs a portable NVDA and relaxes the foreground lock

$env:SME_BASE_URL = "http://localhost/moodle45_aliseadele"
$env:SME_CMID     = "2"       # a quiz with STACK questions
$env:SME_USER     = "sme_student01"
$env:SME_USER_PASS = "..."
npx playwright test
```

NVDA does not speak during an automated run - its output goes to the speech viewer, and from
there into `transcripts/`.

## Running it in CI

The `accessibility (NVDA)` workflow, started by hand with a URL the runner can reach and the
course module id of a quiz. It does not build a site: a Windows runner cannot host Moodle with
Maxima, so it points at one that is already up - staging, or a tunnel to a local instance.

`SME_USER_PASS` comes from a repository secret.

## What comes out

`transcripts/*.txt`, one per flow, each headed with the commit, the site and the time:

* `editor-field` - tabbing to the editor
* `editor-switch` - the on/off switch and its state change
* `toolbar-buttons` - five buttons in a row
* `matrix-chooser` - opening the chooser and closing it again
* `core-flow` - thirty steps through the question, unasserted, for the person signing off

`zoom.spec.js` runs in the same job without NVDA and measures what does not need judging: 200 per
cent zoom without horizontal scrolling, a 380 pixel viewport with no button outside its toolbar
and none below 24 by 24 pixels, the keyboard reaching editor, toolbar and switch, and a visible
focus wherever it lands.

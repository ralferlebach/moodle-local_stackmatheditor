# Residual risks of 1.4.0 (build 2026110201)

This file describes every point a release of this build goes out with although it is not closed,
why it is tolerable, what limits it, and who accepted it when. It records the maintainer's
decision; since #99 it is not read by any workflow and cannot block a build. A functional
defect is not a residual risk to be accepted here: it is a failing or missing test, and those
keep the CI red.

| # | Risk | Issue | Why tolerable | What limits it | Closed by |
|---|---|---|---|---|---|
| R1 | No person has yet judged whether the NVDA output can be worked with (order, wording, nothing read twice) | #69 | Every announcement a student depends on is checked on every release candidate: `a11y-nvda.yml` fails when the field, the switch, the toolbar or the matrix chooser is silent, and axe, keyboard and zoom checks run in `playwright.yml` | The judgement is a reading of transcripts that already exist; it can be made after the release and a finding becomes a patch release | Section 1 of `docs/MANUAL-ACCEPTANCE.md`, comment in #69 |
| R2 | A release can still be made outside the gate by uploading an archive to the Moodle plugins directory by hand | #69 | `release-artefact.yml` publishes only a tested ZIP of a commit whose functional CI is green; a release published by hand on GitHub would carry an untested archive, which is why the documented way is the tag. The plugins directory has no API a workflow could check | The upload is one person's step; the evidence (`manual-checklist.txt`) asks for the SHA-256 of the uploaded archive to be compared with the one the release publishes | Accepted permanently while the plugins directory offers no upload hook |
| R3 | Android Opera and Firefox Klar have not been tried on a real device | #72 | The cause was in MathQuill's keyboard layer, shared by every engine; the fix is tested with the exact event sequence Android sends (keyCode 229, key "Unidentified") in Chromium, one-line and multi-line, Backspace included. Opera is Blink like Chrome, Firefox Klar is Gecko like Firefox, and both of those were confirmed on devices | A failure would show as the old symptom (first characters lost until Enter) with a known workaround, not as wrong answers being submitted | Section 2 of `docs/MANUAL-ACCEPTANCE.md`, comment in #72 |
| R4 | The test bed installs STACK from its moving branches, so a green run cannot be repeated exactly | #70 | Deliberate: the matrix is meant to notice when STACK changes (`docs/RELEASE-CHECKLIST.md`, section 7) | Each run writes the STACK revisions it tested into `ci-logs/dependency-revisions.txt` | Accepted permanently, 27 September 2026 |
| R5 | No browser run on a `mod_geogebra` activity | #102 | The editor loads on no `mod_geogebra` page in any activation mode (`context_resolver_test::test_geogebra_activity_pages`); the GeoGebra applet in STACK questions is tested in the browser with the editor off and on (`interop.spec.js`) | What remains unproven is a page the editor does not load on | A browser run with `mod_geogebra` installed on the test site, comment in #102 |
| R6 | The interoperability runs are Chromium only | #102 - #104 | The editor's decision which field it takes is browser-independent DOM logic, covered by Jest; the widgets are STACK's | A Gecko- or WebKit-only difference would be in STACK's widgets or in MathQuill, both used without the editor too | A Firefox run of `interop.spec.js`, comment in #104 |

## Acceptance

| Risk | Decision | Date | By |
|---|---|---|---|
| R1 | accepted for 1.4.0 | 2026-10-08 | Ralf Erlebach |
| R2 | accepted permanently | 2026-10-08 | Ralf Erlebach |
| R3 | accepted for 1.4.0 | 2026-10-08 | Ralf Erlebach |
| R4 | accepted permanently | 2026-09-27 | Ralf Erlebach |
| R5 | open - maintainer's decision for 1.4.0 | | |
| R6 | open - maintainer's decision for 1.4.0 | | |

These decisions were recorded in `docs/RELEASE-SIGNOFF.json` until build 2026100801; the file and
its checker were removed with #99, and the table above carries them over unchanged.

Closed since build 2026100800: R5 (one configuration per scope was enforced by the application
only) - the database enforces it with a unique index (`docs/DATA-INTEGRITY.md`); R6 (two builds
with the release name 1.3.0) - this release is 1.4.0.

#100 and #101 (the switched-off editor wrote a stale value over the visible answer; the editor
started from the value attribute instead of the current value) are fixed in build 2026110200,
#102 and #104 (a typed foreign STACK field named `_ansN` could get an editor) in build
2026110201; all are covered by Jest and Playwright and are not residual risks. What is not proven by this
repository's own tests is listed in `docs/REVIEW-1.4.0-FINAL.md`.

Once a risk is closed (R1 and R3 by the manual acceptance), its row moves to the change log of
the next release, and this file keeps only what is still open.

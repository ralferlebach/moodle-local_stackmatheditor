# Release checklist

What has to be true before `MATURITY_STABLE`, and where the proof comes from. The rule behind
all of it: a run is evidence only if it names the exact commit it ran against.

## 1. Code gates, automated

Run on every push and pull request (`moodle-plugin-ci-dev.yml`) and, for the release branch, in
the full matrix (`moodle-plugin-ci-main.yml`):

| Gate | Where |
| --- | --- |
| PHP lint, code analysis, PHPCS, PHPDoc, savepoints, validate, mustache, gherkin | dev + main |
| PHPUnit across the declared Moodle / PHP / database matrix | main |
| Behat, including the STACK CAS preflight | dev |
| Jest, ESLint, AMD build freshness, stylelint | dev + main |
| Coverage threshold, release artefact, stale files | main |

`ci-complete` fails if any of them does.

## 2. Release evidence for the exact artefact

`release-evidence.yml`, started by hand with the commit to certify. A manually started workflow
only appears in the Actions list once its file is on the default branch - so this one shows up
after `main` has it, and the branch to certify is then chosen in the dialog under "Use workflow
from". It records what is being
certified (commit, version, vendored MathQuill with checksums), runs a dependency audit, builds
the release archive and writes the checklist of what a human still has to confirm.

Start these on the same commit **first**; the evidence workflow now checks them and fails when
one is missing or not green, so it is run last rather than first:

* `playwright.yml` - browser path, accessibility included
* `load-k6.yml` and `load-jmeter.yml` - performance smoke

It also stops on a high or critical dependency finding. The audit itself still runs to
completion, so the evidence records what was found either way.

## 3. Branch protection: deliberately not used

`main` is not branch-protected, and that is a decision: a failing check stops the work and gets
fixed, or knowingly does not, but it does not block the merge mechanically. `ci-complete` stays
the honest signal, not a gate with a key.

What that means in practice: nothing prevents a release from being tagged on a red run, so the
evidence below is the only thing that shows a stable release was actually green. Do not skip it
on the grounds that CI "usually passes".

## 4. Screen reader evidence

`accessibility (NVDA)`, started by hand with a URL the runner can reach and a quiz's course
module id. A Windows runner cannot host Moodle with Maxima, so it points at a site that is
already up - staging, or a tunnel to a local instance - and records what NVDA actually says
about the editor, the switch, the toolbar and the matrix chooser. The transcripts come back as
an artefact, each headed with the commit and the date.

It fails when something a student depends on is silent. It cannot tell you whether what NVDA
says is understandable, in what order it comes, or whether something is read twice - those
questions are printed at the end of the run for the person signing off.

## 5. What no workflow can do for you

* The judgement half of the accessibility sample: read the transcripts from section 4 and say
  whether they describe something a person can work with. Record date, browser and NVDA version.
  Zoom, viewport width, keyboard reach and focus visibility are measured by that same run and do
  not need repeating by hand.
* The decision on every open P0 and P1: closed, or accepted as a residual risk with a reason.
  An open, unexplained P1 must not sit quietly next to a stable release.

## 6. Only then: flip the release metadata

Atomically, in one commit:

* `version.php`: `MATURITY_STABLE` and the final release string;
* `README.md`: the version heading is no longer "in development";
* release notes final;
* tag and plugin directory metadata.

Never a mixed state - `MATURITY_STABLE` next to "in development", or the other way round. The
maturity change is the last step, not the start of the stable test.

## 7. Dependency revisions: a deliberate non-pin

Confirmed again on 27 September 2026: no pinning by tag. The section below stands as the
project's position, and #70 is answered by it rather than left open.

The release lane installs STACK and its dependencies from their moving branches, not from tags.
That is a decision, not an oversight: pinning would freeze the test bed against a STACK that
keeps moving, and the value of this matrix is that it notices when STACK changes. What the run
does instead is write down which revisions it actually tested against
(`ci-logs/dependency-revisions.txt`), so a green run can be reconstructed afterwards even though
it cannot be repeated exactly.

The residual risk is stated plainly: the same plugin commit can be green today and red next week
for reasons outside this repository. The evidence file names the SHAs that were green.

## 8. Provenance

The vendored MathQuill build is identified by its fork commit, not by a branch name, and
`thirdparty/readme_moodle.txt` carries the commit, the toolchain and the checksums of the three
imported files. A rebuild from that commit has to produce them again.

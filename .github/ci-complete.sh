#!/usr/bin/env bash
# Aggregate the results of the functional CI jobs into one status (#99).
#
#     bash .github/ci-complete.sh name=result [name=result ...]
#
# Every argument is a job of moodle-plugin-ci-main.yml with its result as GitHub reports it
# (success, failure, cancelled, skipped). The status is green only if every one succeeded: a
# failing test, a cancelled or skipped job is red - fail-closed. Only jobs that test something are
# passed in; release formalities (maturity, sign-off, tag metadata) are not CI jobs any more and
# can therefore never block it.
#
# --self-test runs the cases that prove this: a real failure is red, all green is green, and no
# formal gate is among the jobs the workflow passes in.

set -uo pipefail

aggregate() {
    local rc=0 entry
    if [[ $# -eq 0 ]]; then
        echo "No job results given - nothing proves the build, so this is red."
        return 1
    fi
    for entry in "$@"; do
        echo "  ${entry%%=*}: ${entry#*=}"
        if [[ "${entry#*=}" != "success" ]]; then
            rc=1
        fi
    done
    if [[ $rc -ne 0 ]]; then
        echo "At least one functional job did not succeed (see list above)."
        return 1
    fi
    echo "All functional CI jobs succeeded."
    return 0
}

self_test() {
    local here workflow needs fail=0
    here="$(cd "$(dirname "$0")" && pwd)"
    workflow="$here/workflows/moodle-plugin-ci-main.yml"

    aggregate test=success jest=failure >/dev/null && { echo "FAIL: a failing job was green"; fail=1; }
    aggregate test=success coverage=cancelled >/dev/null && { echo "FAIL: a cancelled job was green"; fail=1; }
    aggregate test=skipped >/dev/null && { echo "FAIL: a skipped job was green"; fail=1; }
    aggregate >/dev/null && { echo "FAIL: no results was green"; fail=1; }
    aggregate test=success jest=success >/dev/null || { echo "FAIL: all green was red"; fail=1; }

    # The status check depends on the functional jobs directly, and on nothing formal.
    needs="$(awk '/^  ci-complete:/{f=1} f && /needs:/{print; exit}' "$workflow")"
    for job in test jest release-artefact coverage stale-files upgrade concurrency; do
        [[ "$needs" == *"$job"* ]] || { echo "FAIL: ci-complete does not need '$job'"; fail=1; }
    done
    if grep -qiE 'maturity-gate|check-signoff|release-guard|RELEASE-SIGNOFF' "$workflow"; then
        echo "FAIL: the main workflow still contains a formal release gate"
        fail=1
    fi
    # A missing sign-off file must not matter: the workflow does not read one.
    if [[ -e "$here/../docs/RELEASE-SIGNOFF.json" || -e "$here/check-signoff.py" ]]; then
        echo "FAIL: the formal sign-off mechanism still exists"
        fail=1
    fi
    [[ $fail -eq 0 ]] && echo "ci-complete self-test: all cases behave as intended."
    return $fail
}

if [[ "${1:-}" == "--self-test" ]]; then
    self_test
    exit $?
fi
aggregate "$@"

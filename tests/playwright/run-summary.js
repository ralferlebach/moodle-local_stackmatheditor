// This file is part of Moodle - https://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <https://www.gnu.org/licenses/>.

/**
 * Markdown summary of a Playwright run for the GitHub job summary.
 *
 * Prints the totals, every test that did not simply pass with its first error, and - for the
 * NVDA run (#69) - every transcript. The run page shows it, so a red run can be read without
 * opening the log or downloading the artefact.
 *
 *   node run-summary.js "Playwright" >> "$GITHUB_STEP_SUMMARY"
 *
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const fs = require('fs');
const path = require('path');

const out = [];
const results = path.join(__dirname, 'test-results', 'results.json');
const transcripts = path.join(__dirname, 'transcripts');

/**
 * Strip terminal colour codes and keep a message short enough for a summary.
 *
 * @param {string} text Raw error text.
 * @returns {string} Plain text.
 */
function plain(text) {
    // eslint-disable-next-line no-control-regex
    return String(text || '').replace(/\u001b\[[0-9;]*m/g, '').slice(0, 1500);
}

/**
 * Collect the specs of a suite and of everything nested in it.
 *
 * @param {Object} suite A suite from Playwright's JSON report.
 * @param {Array} into Collected specs.
 * @returns {Array} The collected specs.
 */
function specs(suite, into) {
    (suite.specs || []).forEach((spec) => into.push(spec));
    (suite.suites || []).forEach((child) => specs(child, into));
    return into;
}

out.push(`## ${process.argv[2] || 'Playwright'} run`, '', `Site: \`${process.env.SME_BASE_URL || 'not set'}\``, '');

if (fs.existsSync(results)) {
    const report = JSON.parse(fs.readFileSync(results, 'utf8'));
    const all = (report.suites || []).reduce((list, suite) => specs(suite, list), []);

    (report.errors || []).forEach((error) => {
        out.push('**Error outside a test**', '', '```', plain(error.message || error.stack), '```', '');
    });
    if (!all.length) {
        out.push('No test was collected.', '');
    }
    const stats = report.stats || {};
    out.push(`Passed ${stats.expected || 0}, failed ${stats.unexpected || 0}, `
        + `flaky ${stats.flaky || 0}, skipped ${stats.skipped || 0}.`, '');

    all.forEach((spec) => {
        (spec.tests || []).forEach((test) => {
            const runs = test.results || [];
            // "expected" is a plain pass; everything else is worth a line.
            if (test.status === 'expected') {
                return;
            }
            out.push(`### ${test.status}: ${spec.file || ''} - ${spec.title}`, '');
            runs.forEach((run, index) => {
                const error = (run.errors || [])[0] || run.error;
                if (error) {
                    out.push(`Attempt ${index + 1} (${run.status}, ${run.duration} ms)`, '',
                        '```', plain(error.message || error.stack), '```', '');
                }
            });
        });
    });
} else {
    out.push('Playwright wrote no result file: the run ended before a test started.', '');
}

if (fs.existsSync(transcripts)) {
    fs.readdirSync(transcripts).sort().forEach((file) => {
        out.push(`### Transcript: ${file}`, '', '```',
            fs.readFileSync(path.join(transcripts, file), 'utf8').slice(0, 6000), '```', '');
    });
} else if (process.env.SME_NVDA) {
    out.push('NVDA recorded no transcript.', '');
}

process.stdout.write(out.join('\n') + '\n');

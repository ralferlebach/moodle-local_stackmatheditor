<?php
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
 * CLI for the browser tests: what the question engine stored for a user's latest quiz attempt.
 *
 *     php attempt-state.php <username> <cmid>
 *
 * Prints JSON: {attempt, state, slots: {<slot>: {state, fraction, summary, vars: {name: value}}}}
 * with the last submitted value of every answer variable (ans1, ans1_val, ...). Read-only; for
 * disposable test sites only (#100, #101: the stored step is compared with the visible value
 * and the request).
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

define('CLI_SCRIPT', true);

require(__DIR__ . '/../../../../config.php');
require_once($CFG->dirroot . '/mod/quiz/locallib.php');

[$username, $cmid] = [$argv[1] ?? '', (int) ($argv[2] ?? 0)];
$user = $DB->get_record('user', ['username' => $username], '*', MUST_EXIST);
$cm = get_coursemodule_from_id('quiz', $cmid, 0, false, MUST_EXIST);
$attempts = $DB->get_records('quiz_attempts', ['quiz' => $cm->instance, 'userid' => $user->id], 'attempt DESC', '*', 0, 1);
if (!$attempts) {
    echo json_encode(['attempt' => null]) . "\n";
    exit(0);
}
$attempt = reset($attempts);
$quba = question_engine::load_questions_usage_by_activity($attempt->uniqueid);
$slots = [];
foreach ($quba->get_slots() as $slot) {
    $qa = $quba->get_question_attempt($slot);
    $vars = [];
    foreach ($qa->get_last_qt_data() as $name => $value) {
        $vars[$name] = (string) $value;
    }
    $slots[$slot] = [
        'state' => (string) $qa->get_state(),
        'fraction' => $qa->get_fraction(),
        'summary' => $qa->get_response_summary(),
        'vars' => $vars,
    ];
}
echo json_encode(['attempt' => (int) $attempt->id, 'state' => $attempt->state, 'slots' => $slots]) . "\n";

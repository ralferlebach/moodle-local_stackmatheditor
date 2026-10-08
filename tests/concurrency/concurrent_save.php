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
 * Real concurrent writes to one configuration scope, from separate PHP processes.
 *
 * The unit tests run in one process. This script starts several processes that write the same
 * two scopes (a question override and a quiz default) at the same moment, many times, and then
 * counts the rows: there must be exactly one per scope.
 *
 * Without --control the writers use the plugin's write path (lock, transaction, unique index):
 * no writer may fail.
 *
 * --control writes through a naive path instead - read, then insert, no lock, no transaction -
 * the path that left duplicates behind before the unique index existed. Now the database has to
 * refuse every second row: the writers count the refused inserts, and the run fails if a scope
 * ends with more than one row. The number of refusals shows that the load really races.
 *
 * Usage: php concurrent_save.php /path/to/moodle [--workers=8] [--rounds=25] [--control]
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// This script runs from a checkout outside the Moodle tree and is told where Moodle is, so the
// usual literal config.php path cannot be used; the sniff that expects it is off for this file.
// phpcs:disable moodle.Files.MoodleInternal.MoodleInternalGlobalState
define('CLI_SCRIPT', true);

// Absolute: Moodle changes the working directory during setup, and the writers start later.
$moodle = realpath($argv[1] ?? '') ?: ($argv[1] ?? '');
$options = [];
foreach (array_slice($argv, 2) as $arg) {
    if (preg_match('/^--([a-z]+)(?:=(.*))?$/', $arg, $m)) {
        $options[$m[1]] = $m[2] ?? true;
    }
}
$config = is_file($moodle . '/config.php') ? $moodle . '/config.php' : $moodle . '/../config.php';
require($config);

use local_stackmatheditor\config_manager;

/** Course module id of the scopes under test; no real activity uses it. */
const SME_CONCURRENCY_CMID = 990001;
/** Question bank entry id of the question scope under test. */
const SME_CONCURRENCY_QBEID = 4242;

$control = !empty($options['control']);

if (!empty($options['child'])) {
    // One writer. Waits for the common start, then writes as fast as it can.
    $start = (float) $options['start'];
    while (microtime(true) < $start) {
        usleep(1000);
    }
    $rounds = (int) ($options['rounds'] ?? 25);
    $id = (int) ($options['id'] ?? 0);
    $refused = 0;
    for ($round = 0; $round < $rounds; $round++) {
        $config = ['_enabled' => (bool) (($id + $round) % 2), 'writer' => $id, 'round' => $round];
        if ($control) {
            $refused += local_stackmatheditor_concurrency_naive_upsert(SME_CONCURRENCY_CMID, SME_CONCURRENCY_QBEID, $config);
            $refused += local_stackmatheditor_concurrency_naive_upsert(SME_CONCURRENCY_CMID, config_manager::QUIZ_DEFAULT, $config);
        } else {
            config_manager::save_config(SME_CONCURRENCY_CMID, SME_CONCURRENCY_QBEID, $config);
            config_manager::save_quiz_default(SME_CONCURRENCY_CMID, $config);
        }
    }
    echo "REFUSED {$refused}\n";
    exit(0);
}

/**
 * A naive write: read, then update or insert - no lock, no transaction.
 *
 * @param int $cmid Course module id.
 * @param int $qbeid Question bank entry id, 0 for the quiz default.
 * @param array $elements Configuration.
 * @return int 1 when the database refused the insert as a second row of the scope, else 0.
 */
function local_stackmatheditor_concurrency_naive_upsert(int $cmid, int $qbeid, array $elements): int {
    global $DB;
    $params = ['cmid' => $cmid, 'questionbankentryid' => $qbeid];
    $records = $DB->get_records('local_stackmatheditor', $params, 'timemodified DESC');
    if ($records) {
        $keep = array_shift($records);
        $keep->allowed_elements = json_encode($elements);
        $keep->timemodified = time();
        $DB->update_record('local_stackmatheditor', $keep);
        return 0;
    }
    try {
        $DB->insert_record('local_stackmatheditor', (object) [
            'cmid' => $cmid, 'questionbankentryid' => $qbeid, 'allowed_elements' => json_encode($elements),
            'usermodified' => 0, 'timecreated' => time(), 'timemodified' => time(),
        ]);
    } catch (dml_write_exception $e) {
        // Another writer inserted the row between our read and our insert.
        return 1;
    }
    return 0;
}

/**
 * Rows per scope under test.
 *
 * @return array ['question' => int, 'default' => int]
 */
function local_stackmatheditor_concurrency_count(): array {
    global $DB;
    return [
        'question' => $DB->count_records(
            'local_stackmatheditor',
            ['cmid' => SME_CONCURRENCY_CMID, 'questionbankentryid' => SME_CONCURRENCY_QBEID]
        ),
        'default' => $DB->count_records(
            'local_stackmatheditor',
            ['cmid' => SME_CONCURRENCY_CMID, 'questionbankentryid' => config_manager::QUIZ_DEFAULT]
        ),
    ];
}

$workers = max(2, (int) ($options['workers'] ?? 8));
$rounds = max(1, (int) ($options['rounds'] ?? 25));
$DB->delete_records('local_stackmatheditor', ['cmid' => SME_CONCURRENCY_CMID]);

$start = microtime(true) + 2.0;
$processes = [];
for ($i = 0; $i < $workers; $i++) {
    $command = [PHP_BINARY, __FILE__, $moodle, '--child', '--start=' . $start, '--rounds=' . $rounds, '--id=' . $i];
    if ($control) {
        $command[] = '--control';
    }
    $pipes = [];
    $process = proc_open($command, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    if (!is_resource($process)) {
        fwrite(STDERR, "Could not start writer {$i}.\n");
        exit(1);
    }
    $processes[$i] = [$process, $pipes];
}

$failed = 0;
$refused = 0;
foreach ($processes as $i => [$process, $pipes]) {
    $output = stream_get_contents($pipes[1]) . stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    $code = proc_close($process);
    if (preg_match('/^REFUSED (\d+)$/m', $output, $m)) {
        $refused += (int) $m[1];
    }
    if ($code !== 0) {
        $failed++;
        echo "Writer {$i} ended with exit code {$code}:\n" . trim($output) . "\n";
    }
}

$counts = local_stackmatheditor_concurrency_count();
$DB->delete_records('local_stackmatheditor', ['cmid' => SME_CONCURRENCY_CMID]);

$mode = $control ? 'naive write path (control: no lock, no transaction)' : 'plugin write path';
printf("%s: %d writers x %d rounds x 2 scopes on %s\n", $mode, $workers, $rounds, $DB->get_dbfamily());
printf("  rows for the question scope: %d\n  rows for the quiz default:   %d\n", $counts['question'], $counts['default']);

if ($failed) {
    echo "FAIL: {$failed} writer(s) failed.\n";
    exit(1);
}

if ($control) {
    echo $refused > 0
        ? "  the database refused {$refused} second row(s) - the race is real, the unique index stops it.\n"
        : "  no insert was refused this time - the race did not show on this machine.\n";
}

if ($counts['question'] !== 1 || $counts['default'] !== 1) {
    echo "FAIL: exactly one row per scope expected.\n";
    exit(1);
}
echo "OK: one row per scope.\n";
exit(0);

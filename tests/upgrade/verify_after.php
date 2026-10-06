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
 * Check what an upgrade from the previous release left behind (#73).
 *
 * The upgrade is the path every existing site takes, and nothing else exercised it: CI installs
 * fresh. This asserts that what the old version stored still means the same thing, and that the
 * settings 1.3 introduced arrive with the defaults that keep behaviour unchanged.
 *
 * Exits non-zero on the first failure, so the workflow step fails with it.
 *
 * Usage: php verify_after.php /path/to/moodle
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// This script runs from a checkout outside the Moodle tree and is told where Moodle is, so the
// usual literal config.php path cannot be used; the sniff that expects it is off for this file.
// phpcs:disable moodle.Files.MoodleInternal.MoodleInternalGlobalState
define('CLI_SCRIPT', true);

$moodle = $argv[1] ?? '';
$config = is_file($moodle . '/config.php') ? $moodle . '/config.php' : $moodle . '/../config.php';
require($config);

use local_stackmatheditor\config_manager;
use local_stackmatheditor\definitions;

$failures = 0;

/**
 * Report one check.
 *
 * @param bool $ok Whether it held.
 * @param string $what What was checked.
 * @return void
 */
function check(bool $ok, string $what): void {
    global $failures;
    echo ($ok ? '  ok   ' : '  FAIL ') . $what . "\n";
    if (!$ok) {
        $failures++;
    }
}

$plugin = new stdClass();
require($CFG->dirroot . '/local/stackmatheditor/version.php');
$installed = (int) get_config('local_stackmatheditor', 'version');

echo "Installed version after the upgrade: {$installed}\n";
check($installed === (int) $plugin->version, 'the upgrade reached the version on disk');

// What the old version stored still means the same.
check(config_manager::get_effective_enabled(9001), 'quiz 9001 keeps its editor');
check(!config_manager::get_effective_enabled(9001, 7001), 'its question override keeps it off');
$global = config_manager::get_config(9002, 7002);
check(!empty($global['trigonometry']), 'the global question default still reaches another quiz');
check($DB->count_records('local_stackmatheditor') === 3, 'no configuration record was lost or added');

// The 1.3 settings arrive with defaults that change nothing.
check(config_manager::get_instance_student_toggle(), 'the student switch stays allowed (#73)');
check(definitions::get_instance_max_dimension() === 5, 'the chooser limit stays at 5 (#76)');
check(config_manager::get_effective_student_toggle(9001), 'quiz 9001 offers the switch as before');

// A site that has the plugin must not have lost its activation mode.
check((int) get_config('local_stackmatheditor', 'enabled') === 2, 'the activation mode survived');

echo $failures ? "{$failures} check(s) failed.\n" : "Upgrade verified.\n";
exit($failures ? 1 : 0);

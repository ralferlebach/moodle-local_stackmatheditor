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
 * Seed a site that runs the previous release, before it is upgraded (#73).
 *
 * Writes the kind of configuration a 1.2.x site has in the wild: a quiz default, a question
 * override and a global question default, plus the instance activation mode. Straight into the
 * table rather than through config_manager, because this runs against the old plugin and must not
 * depend on an API the old version may not have.
 *
 * Usage: php seed_before.php /path/to/moodle
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

global $DB;

$before = get_config('local_stackmatheditor', 'version');
echo "Plugin version before the upgrade: {$before}\n";

set_config('enabled', 2, 'local_stackmatheditor');

$now = time();
$rows = [
    // A quiz default: editor on, two groups.
    ['cmid' => 9001, 'questionbankentryid' => null,
        'allowed_elements' => json_encode(['_enabled' => true, 'basic_operators' => true,
            'greek_lower' => true])],
    // A question override in that quiz: editor off.
    ['cmid' => 9001, 'questionbankentryid' => 7001,
        'allowed_elements' => json_encode(['_enabled' => false, 'basic_operators' => true])],
    // A global question default.
    ['cmid' => 0, 'questionbankentryid' => 7002,
        'allowed_elements' => json_encode(['trigonometry' => true])],
];

foreach ($rows as $row) {
    $record = (object) array_merge($row, [
        'usermodified' => 2,
        'timecreated' => $now,
        'timemodified' => $now,
    ]);
    $DB->insert_record('local_stackmatheditor', $record);
}

echo 'Seeded ' . count($rows) . " configuration records and enabled mode 2.\n";

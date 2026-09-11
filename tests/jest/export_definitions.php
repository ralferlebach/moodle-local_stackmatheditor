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
 * CLI: regenerate tests/jest/fixtures/definitions.json from definitions::export_for_js().
 *
 * Run from the Moodle root after a deliberate change to classes/definitions.php:
 *   php local/stackmatheditor/tests/jest/export_definitions.php
 * tests/unit/jest_fixture_test.php fails until the fixture has been regenerated.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

define('CLI_SCRIPT', true);

require(__DIR__ . '/../../../../config.php');

// Keep in sync with jest_fixture_test::KEYS.
$keys = [
    'functions',
    'constants',
    'greek',
    'units',
    'functionNames',
    'reservedWords',
    'percentConstants',
];

$exported = \local_stackmatheditor\definitions::export_for_js();
$fixture = [];
foreach ($keys as $key) {
    $fixture[$key] = $exported[$key];
}

$file = __DIR__ . '/fixtures/definitions.json';
$json = json_encode($fixture, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n";
file_put_contents($file, $json);
echo "Written: {$file}\n";

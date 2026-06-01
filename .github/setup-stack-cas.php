<?php
// This file is part of Moodle - http://moodle.org/
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
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * CI helper: verifies that qtype_stack can connect to Maxima after install.
 *
 * Run from the Moodle root directory after moodle-plugin-ci install:
 *   php "$GITHUB_WORKSPACE/plugin/.github/setup-stack-cas.php" --verify-only
 *
 * @package   local_stackmatheditor
 * @copyright 2026, Ralf Erlebach
 * @license   http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

define('CLI_SCRIPT', true);

// Working directory must be the Moodle root (working-directory in CI is moodle/).
require_once(getcwd() . '/config.php');

global $CFG, $DB;

if (!$DB->get_manager()->table_exists('config')) {
    fwrite(STDERR, "Moodle DB not installed: table {config} is missing.\n");
    fwrite(STDERR, "This step must run after moodle-plugin-ci install.\n");
    exit(1);
}

$stackroot = $CFG->dirroot . '/question/type/stack';

if (!file_exists($stackroot . '/stack/cas/installhelper.class.php')) {
    fwrite(STDERR, "qtype_stack is not installed at {$stackroot}.\n");
    exit(1);
}

require_once($stackroot . '/stack/cas/installhelper.class.php');
require_once($stackroot . '/stack/cas/connectorhelper.class.php');

set_config('platform',        'linux',   'qtype_stack');
set_config('maximacommand',   'maxima',  'qtype_stack');
set_config('maximaversion',   'default', 'qtype_stack');
set_config('casresultscache', 'db',      'qtype_stack');
set_config('casdebugging',    '0',       'qtype_stack');
set_config('castimeout',      '30',      'qtype_stack');
set_config('maximalibraries', '',        'qtype_stack');

purge_all_caches();

stack_cas_configuration::create_maximalocal();

[$message, $debug, $ok] = stack_connection_helper::stackmaxima_genuine_connect();

echo 'STACK platform: '       . get_config('qtype_stack', 'platform')      . PHP_EOL;
echo 'STACK maxima command: ' . get_config('qtype_stack', 'maximacommand') . PHP_EOL;
echo 'STACK CAS message: '    . $message                                   . PHP_EOL;

if (!$ok) {
    fwrite(STDERR, "STACK CAS connection failed:\n{$debug}\n");
    exit(1);
}

echo 'STACK CAS OK.' . PHP_EOL;

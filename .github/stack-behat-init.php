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
// along with Moodle.  If not, see <https://www.gnu.org/licenses/>.

/**
 * CI helper: verifies that STACK CAS works before the Behat suite starts.
 *
 * Run from the Moodle root after moodle-plugin-ci add-config has added the
 * QTYPE_STACK_TEST_CONFIG_* constants to config.php:
 *   working-directory: ${{ github.workspace }}/moodle
 *   run: php "$GITHUB_WORKSPACE/plugin/.github/stack-behat-init.php"
 *
 * The constants override whatever STACK install.php wrote to the DB.
 * moodle-plugin-ci behat --start-servers re-runs util_single_run.php which
 * may reset the Behat DB; the constants survive this reset because they live
 * in config.php, not in the DB.
 *
 * This script just refreshes maximalocal.mac and proves CAS works.
 *
 * @package   local_stackmatheditor
 * @copyright 2026, Ralf Erlebach
 * @license   http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

define('BEHAT_UTIL', true);
define('CLI_SCRIPT', true);

require_once(getcwd() . '/config.php');

global $CFG, $DB;

if (!$DB->get_manager()->table_exists('config')) {
    fwrite(STDERR, "ERROR: {config} table not found in Behat DB.\n");
    exit(1);
}

// Locate qtype_stack (Moodle 4.x / 5.x).
$candidates = [
    $CFG->dirroot . '/question/type/stack',
    $CFG->dirroot . '/public/question/type/stack',
];
$stackroot = null;
foreach ($candidates as $c) {
    if (file_exists($c . '/stack/cas/installhelper.class.php')) {
        $stackroot = $c;
        break;
    }
}
if (!$stackroot) {
    fwrite(STDERR, "ERROR: qtype_stack not found under {$CFG->dirroot}.\n");
    exit(1);
}

require_once($stackroot . '/stack/cas/installhelper.class.php');
require_once($stackroot . '/stack/cas/connectorhelper.class.php');

echo "STACK root:     $stackroot\n";
echo "Behat dataroot: {$CFG->dataroot}\n";
echo "platform:       " . get_config('qtype_stack', 'platform') . " (may be overridden by constant)\n";

// Refresh maximalocal.mac so Moodle/Behat CAS sessions can load library paths.
stack_cas_configuration::create_maximalocal();
echo "maximalocal.mac refreshed.\n";

// Hard verify: STACK CAS must respond.  The QTYPE_STACK_TEST_CONFIG_* constants
// loaded from config.php ensure platform=linux and castimeout=300 are used.
[$msg, $debug, $ok] = stack_connection_helper::stackmaxima_genuine_connect();

if (!$ok) {
    fwrite(STDERR, "\nSTACK CAS verification FAILED.\n");
    fwrite(STDERR, "message: $msg\n");
    fwrite(STDERR, "debug:\n$debug\n");
    exit(1);
}

echo "STACK CAS OK: $msg\n";
echo "  castimeout: " . get_config('qtype_stack', 'castimeout') . " s (may be overridden by constant)\n";

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
 * CI helper: initialises STACK CAS for the Behat test site.
 *
 * Run from the Moodle root after moodle-plugin-ci install:
 *   working-directory: ${{ github.workspace }}/moodle
 *   run: php "$GITHUB_WORKSPACE/plugin/.github/stack-behat-init.php"
 *
 * Uses platform=linux with castimeout=300 (Strategie C).  No frozen image
 * is created here: maxima_opt_auto is volatile between CI steps because
 * moodle-plugin-ci behat --start-servers resets parts of the Behat dataroot.
 * Cold-start Maxima with a 300 s timeout is safe; results are cached in the
 * DB after the first call, so subsequent scenarios run instantly.
 *
 * @package   local_stackmatheditor
 * @copyright 2026, Ralf Erlebach
 * @license   http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

define('BEHAT_UTIL', true);
define('CLI_SCRIPT', true);

// Working directory must be the Moodle root (see CI working-directory).
require_once(getcwd() . '/config.php');

global $CFG, $DB;

if (!$DB->get_manager()->table_exists('config')) {
    fwrite(STDERR, "ERROR: {config} table not found in Behat DB.\n");
    fwrite(STDERR, "Run this script after moodle-plugin-ci install.\n");
    exit(1);
}

// Locate qtype_stack (Moodle 4.x: question/type/stack; 5.x: public/...).
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

// Set a stable platform=linux baseline.  No frozen image (linux-optimised)
// because moodle-plugin-ci resets behat dataroot contents between steps.
// The first CAS call cold-starts Maxima (~60-90 s) and caches the result in
// the DB; all subsequent calls for the same question are instant.
echo "\n=== STACK CAS baseline: platform=linux, castimeout=300 ===\n";

set_config('platform', 'linux', 'qtype_stack');
set_config('maximacommand', 'maxima', 'qtype_stack');
set_config('maximacommandopt', '', 'qtype_stack');
set_config('maximaversion', 'default', 'qtype_stack');
set_config('castimeout', '300', 'qtype_stack');
set_config('casresultscache', 'db', 'qtype_stack');
set_config('casdebugging', '0', 'qtype_stack');
set_config('maximalibraries', '', 'qtype_stack');

purge_all_caches();
stack_cas_configuration::create_maximalocal();
echo "maximalocal.mac written to: {$CFG->dataroot}/stack/\n";

// Verify CAS baseline works before Behat starts.
[$msgbaseline, $debugbaseline, $okbaseline] = stack_connection_helper::stackmaxima_genuine_connect();

if (!$okbaseline) {
    fwrite(STDERR, "\nSTACK CAS baseline FAILED.\n");
    fwrite(STDERR, "platform:   " . get_config('qtype_stack', 'platform') . "\n");
    fwrite(STDERR, "castimeout: " . get_config('qtype_stack', 'castimeout') . "\n");
    fwrite(STDERR, "message:    $msgbaseline\n");
    fwrite(STDERR, "debug:\n$debugbaseline\n");
    exit(1);
}

echo "STACK CAS baseline OK: $msgbaseline\n";
echo "  platform:   " . get_config('qtype_stack', 'platform') . "\n";
echo "  castimeout: " . get_config('qtype_stack', 'castimeout') . " s\n";

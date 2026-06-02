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
 * BEHAT_UTIL must be defined before bootstrapping Moodle so that the framework
 * switches to the Behat database prefix and data root.  Both set_config() calls
 * and file writes therefore target the correct Behat-test-site context.
 *
 * Phase A: stable baseline (platform=linux, genuine connect).  Fatal on failure.
 * Phase B: frozen image (linux-optimised, fast CAS).  Also fatal: Behat must
 * not start against a broken linux-optimised state (platform points at a
 * non-existent maxima_opt_auto file).
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

echo "STACK root:      $stackroot\n";
echo "Behat dataroot:  {$CFG->dataroot}\n";

// Phase A: stable CAS baseline (platform = linux).
echo "\n=== Phase A: STACK CAS baseline (platform=linux) ===\n";

set_config('platform', 'linux', 'qtype_stack');
set_config('maximacommand', 'maxima', 'qtype_stack');
set_config('maximaversion', 'default', 'qtype_stack');
set_config('castimeout', '300', 'qtype_stack');
set_config('casresultscache', 'db', 'qtype_stack');
set_config('casdebugging', '0', 'qtype_stack');
set_config('maximalibraries', '', 'qtype_stack');

purge_all_caches();
stack_cas_configuration::create_maximalocal();
echo "maximalocal.mac written to: {$CFG->dataroot}/stack/\n";

[$msgbaseline, $debugbaseline, $okbaseline] = stack_connection_helper::stackmaxima_genuine_connect();

if (!$okbaseline) {
    fwrite(STDERR, "\nPhase A FAILED: CAS baseline not available.\n");
    fwrite(STDERR, "Message: $msgbaseline\n");
    fwrite(STDERR, "Debug:\n$debugbaseline\n");
    exit(1);
}
echo "Phase A OK: $msgbaseline\n";

// Phase B: frozen image (platform = linux-optimised).
echo "\n=== Phase B: STACK frozen Maxima image (linux-optimised) ===\n";

// Create_auto_maxima_image() runs genuine_connect with castimeout=300,
// saves the frozen image, and sets platform=linux-optimised in the DB.
[$okimage, $msgimage] = stack_cas_configuration::create_auto_maxima_image();

if (!$okimage) {
    fwrite(STDERR, "\nPhase B FAILED: create_auto_maxima_image() failed.\n");
    fwrite(STDERR, "Message: $msgimage\n");
    exit(1);
}

$image = $CFG->dataroot . '/stack/maxima_opt_auto';

if (!is_file($image)) {
    fwrite(STDERR, "\nPhase B FAILED: expected Maxima image does not exist.\n");
    fwrite(STDERR, "Expected path:    $image\n");
    fwrite(STDERR, "Current platform: " . get_config('qtype_stack', 'platform') . "\n");
    fwrite(STDERR, "maximacommandopt: " . get_config('qtype_stack', 'maximacommandopt') . "\n");
    exit(1);
}

// Ensure GCL image binary has executable bit set.
chmod($image, 0755);

if (!is_executable($image)) {
    fwrite(STDERR, "\nPhase B FAILED: Maxima image is not executable after chmod.\n");
    fwrite(STDERR, "Image: $image\n");
    exit(1);
}

if (get_config('qtype_stack', 'platform') !== 'linux-optimised') {
    fwrite(STDERR, "\nPhase B FAILED: platform is not linux-optimised after image creation.\n");
    fwrite(STDERR, "Current platform: " . get_config('qtype_stack', 'platform') . "\n");
    exit(1);
}

purge_all_caches();

// Verify the frozen image actually works with a genuine connect.
[$msgopt, $debugopt, $okopt] = stack_connection_helper::stackmaxima_genuine_connect();

if (!$okopt) {
    fwrite(STDERR, "\nPhase B FAILED: linux-optimised CAS connection failed.\n");
    fwrite(STDERR, "Message: $msgopt\n");
    fwrite(STDERR, "Debug:\n$debugopt\n");
    exit(1);
}

echo "Phase B OK: linux-optimised CAS works.\n";
echo "Image:   $image (" . filesize($image) . " bytes)\n";
echo "Command: " . get_config('qtype_stack', 'maximacommandopt') . "\n";

echo "\nSTACK init complete.\n";
echo "  platform:     " . get_config('qtype_stack', 'platform') . "\n";
echo "  castimeout:   " . get_config('qtype_stack', 'castimeout') . " s\n";

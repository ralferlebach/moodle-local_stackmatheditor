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
 * switches to the Behat database prefix and data root.
 *
 * Phase A: stable baseline with platform=linux and genuine connect.  Fatal.
 * Phase B: attempt linux-optimised frozen image.  Non-fatal: on failure the
 * script explicitly reverts to platform=linux and verifies Phase A again.
 *
 * This implements Strategie B: linux suffices for CI; linux-optimised is an
 * optimisation.  The Behat suite therefore must not assert linux-optimised.
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

// Locate qtype_stack (Moodle 4.x layout; 5.x: public/...).
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
set_config('maximacommandopt', '', 'qtype_stack');
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

// Phase B: attempt frozen image (platform = linux-optimised).
// Non-fatal: reverts to linux on any failure.
echo "\n=== Phase B: STACK frozen Maxima image attempt (linux-optimised) ===\n";

[$okimage, $msgimage] = stack_cas_configuration::create_auto_maxima_image();

$image = $CFG->dataroot . '/stack/maxima_opt_auto';
$phasebworked = false;

if (!$okimage) {
    echo "Phase B: create_auto_maxima_image() failed: $msgimage\n";
} else if (!is_file($image)) {
    echo "Phase B: image missing after creation ($image)\n";
} else {
    chmod($image, 0755);
    if (!is_executable($image)) {
        echo "Phase B: image not executable after chmod: $image\n";
    } else {
        purge_all_caches();
        [$msgopt, , $okopt] = stack_connection_helper::stackmaxima_genuine_connect();
        if (!$okopt) {
            echo "Phase B: linux-optimised connect failed: $msgopt\n";
        } else {
            $phasebworked = true;
            echo "Phase B OK: linux-optimised ($msgopt)\n";
            echo "Image: $image (" . filesize($image) . " bytes)\n";
        }
    }
}

if (!$phasebworked) {
    // Revert to safe linux baseline.
    echo "Phase B failed – reverting to platform=linux for Behat tests.\n";
    set_config('platform', 'linux', 'qtype_stack');
    set_config('maximacommand', 'maxima', 'qtype_stack');
    set_config('maximacommandopt', '', 'qtype_stack');
    purge_all_caches();
    stack_cas_configuration::create_maximalocal();

    [$msgrevert, , $okrevert] = stack_connection_helper::stackmaxima_genuine_connect();
    if (!$okrevert) {
        fwrite(STDERR, "\nRevert to platform=linux FAILED: $msgrevert\n");
        exit(1);
    }
    echo "Reverted: platform=linux, CAS OK ($msgrevert)\n";
}

$finalplatform = get_config('qtype_stack', 'platform');
echo "\nSTACK init complete.\n";
echo "  platform:     $finalplatform\n";
echo "  castimeout:   " . get_config('qtype_stack', 'castimeout') . " s\n";
echo "  maximacommandopt: " . (get_config('qtype_stack', 'maximacommandopt') ?: '(empty)') . "\n";

// Final hard check: prove CAS works in the state we leave behind.
echo "\n=== Final STACK CAS verification ===\n";
[$msgfinal, $debugfinal, $okfinal] = stack_connection_helper::stackmaxima_genuine_connect();

if (!$okfinal) {
    fwrite(STDERR, "\nFinal STACK CAS check FAILED.\n");
    fwrite(STDERR, "platform:         $finalplatform\n");
    fwrite(STDERR, "castimeout:       " . get_config('qtype_stack', 'castimeout') . "\n");
    fwrite(STDERR, "maximacommandopt: " . get_config('qtype_stack', 'maximacommandopt') . "\n");
    fwrite(STDERR, "message:          $msgfinal\n");
    fwrite(STDERR, "debug:\n$debugfinal\n");
    exit(1);
}

echo "Final CAS OK: $msgfinal\n";
echo "  platform:         $finalplatform\n";
echo "  maximacommandopt: " . (get_config('qtype_stack', 'maximacommandopt') ?: '(empty)') . "\n";

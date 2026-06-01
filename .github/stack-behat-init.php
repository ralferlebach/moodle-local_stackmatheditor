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
 * CI helper: initialises STACK CAS in the Behat site context.
 *
 * Must be run from the Moodle root directory after moodle-plugin-ci install:
 *   cd "$MOODLE_ROOT" && php "$PLUGIN/.github/stack-behat-init.php"
 *
 * Defines BEHAT_UTIL before bootstrapping Moodle so that the framework
 * switches to the Behat database prefix and Behat data root.  This
 * ensures that maximalocal.mac is written to the correct location and
 * that qtype_stack reads/writes configuration from the Behat database.
 *
 * @package   local_stackmatheditor
 * @copyright 2026, Ralf Erlebach
 * @license   http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

define('BEHAT_UTIL', true);
define('CLI_SCRIPT', true);

// Working directory must be the Moodle root (working-directory in CI is moodle/).
require_once(getcwd() . '/config.php');

global $CFG, $DB;

if (!$DB->get_manager()->table_exists('config')) {
    fwrite(STDERR, "Behat DB has no {config} table – run after moodle-plugin-ci install.\n");
    exit(1);
}

$stackroot = $CFG->dirroot . '/question/type/stack';

if (!file_exists($stackroot . '/stack/cas/installhelper.class.php')) {
    fwrite(STDERR, "qtype_stack is not installed at {$stackroot}.\n");
    exit(1);
}

require_once($stackroot . '/stack/cas/installhelper.class.php');

// Platform linux is the stable default; no optimised image required.
set_config('platform', 'linux', 'qtype_stack');
set_config('maximacommand', 'maxima', 'qtype_stack');
set_config('maximaversion', 'default', 'qtype_stack');
set_config('castimeout', '300', 'qtype_stack');
set_config('casresultscache', 'db', 'qtype_stack');
set_config('casdebugging', '0', 'qtype_stack');

purge_all_caches();

// Write maximalocal.mac into the Behat data root so STACK can start Maxima.
stack_cas_configuration::create_maximalocal();

echo 'STACK maximalocal.mac created in: ' . $CFG->dataroot . PHP_EOL;
echo 'STACK platform: '                   . get_config('qtype_stack', 'platform') . PHP_EOL;
echo 'STACK maxima command: '             . get_config('qtype_stack', 'maximacommand') . PHP_EOL;
echo 'STACK CAS timeout: '               . get_config('qtype_stack', 'castimeout') . ' s' . PHP_EOL;

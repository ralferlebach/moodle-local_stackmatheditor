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
 * CLI for the browser tests: read or set the site-wide activation of the editor.
 *
 *     php editor-switch.php            prints the current mode (0-3)
 *     php editor-switch.php <0-3>      sets it and prints the previous mode
 *
 * The interoperability tests (#102 - #104) compare a page with the editor switched off for the
 * whole site (mode 0: no editor script runs at all) with the same page with the editor on.
 * For disposable test sites only; the browser tests run with one worker, so no other test sees
 * the switched state.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

define('CLI_SCRIPT', true);

require(__DIR__ . '/../../../../config.php');

$previous = (string) get_config('local_stackmatheditor', 'enabled');
if (isset($argv[1])) {
    $mode = (int) $argv[1];
    if ($mode < 0 || $mode > 3) {
        fwrite(STDERR, "Mode must be 0-3.\n");
        exit(1);
    }
    set_config('enabled', $mode, 'local_stackmatheditor');
}
echo $previous . "\n";

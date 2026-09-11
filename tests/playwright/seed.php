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
 * CLI preflight and seed for the local_stackmatheditor Playwright tests.
 *
 * Verifies that the plugin and its hard dependency qtype_stack are installed, then prints the
 * base URL as a shell "export" line, so the CI runner and `make playwright` can source it.
 * Fails early with a clear message instead of letting the browser run into a half-built site.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

define('CLI_SCRIPT', true);

require(__DIR__ . '/../../../../config.php');

$pluginmanager = core_plugin_manager::instance();
foreach (['local_stackmatheditor', 'qtype_stack'] as $component) {
    $info = $pluginmanager->get_plugin_info($component);
    if ($info === null || empty($info->versiondb)) {
        fwrite(STDERR, "{$component} is not installed on this site - run the Moodle upgrade first.\n");
        exit(1);
    }
}

echo "export SME_BASE_URL='" . $CFG->wwwroot . "'\n";

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
 * Plugin library functions for local_stackmatheditor.
 *
 * Implements the standard Moodle extend_settings_navigation callback so that
 * a "Set up STACK MathQuill Editor" link appears in the activity settings
 * dropdown (the nav-item dropdown dropdownmoremenu) for both mod_quiz and
 * mod_adaptivequiz — provided the plugin has not been disabled system-wide
 * (enabled mode 0) and the current user holds the relevant manage capability.
 *
 * All runtime injection logic lives in hook_callbacks (db/hooks.php).
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

/**
 * Add a configure link to the activity settings navigation.
 *
 * This function is called by Moodle's navigation subsystem before the page
 * header is rendered, ensuring the link appears in the activity's settings
 * dropdown (nav-item dropdown dropdownmoremenu / "Mehr" button) for both
 * mod_quiz and mod_adaptivequiz course modules.
 *
 * The link is only inserted when:
 *   1. The plugin is not disabled system-wide (enabled mode != 0).
 *   2. The current page context is a module context.
 *   3. The course module belongs to mod_quiz or mod_adaptivequiz.
 *   4. The current user holds the relevant manage capability.
 *
 * @param settings_navigation $settingsnav The settings navigation tree.
 * @param context             $context     The current page context.
 * @return void
 */
function local_stackmatheditor_extend_settings_navigation(
    settings_navigation $settingsnav,
    context $context
): void {
    global $PAGE;

    // Hard system-wide disable: no link needed.
    if (\local_stackmatheditor\config_manager::get_instance_enabled_mode() === 0) {
        return;
    }

    // Only inject on module-context pages.
    if (!($context instanceof context_module)) {
        return;
    }

    $cm = $PAGE->cm;
    if (!$cm) {
        return;
    }

    // Only for the supported activity modules.
    if (!in_array($cm->modname, ['quiz', 'adaptivequiz'])) {
        return;
    }

    // Require the module-specific management capability.
    // Mod_adaptivequiz does not define a :manage capability; :viewreport is
    // granted to editingteacher and manager and is the closest equivalent.
    $capname = ($cm->modname === 'adaptivequiz')
        ? 'mod/adaptivequiz:viewreport'
        : 'mod/quiz:manage';

    if (!has_capability($capname, $context)) {
        return;
    }

    // For mod_adaptivequiz: skip the link when the configured question categories
    // Hold no STACK questions.
    if ($cm->modname === 'adaptivequiz') {
        try {
            $instanceid = (int) $cm->instance;
            if (
                !$instanceid
                || !\local_stackmatheditor\quiz_helper::adaptivequiz_has_stack_questions($instanceid)
            ) {
                return;
            }
        } catch (\Throwable $e) {
            // Suppress the link on any DB or class-loading error.
            \local_stackmatheditor\quiz_helper::dbg(
                'extend_settings_navigation: adaptivequiz STACK check failed: ' . $e->getMessage()
            );
            return;
        }
    }

    // Locate the module settings node.
    // In Moodle 4.x Boost this is the "dropdownmoremenu" (More) button.
    $modulenode = $settingsnav->find('modulesettings', navigation_node::TYPE_SETTING);
    if (!$modulenode) {
        return;
    }

    $cmid = (int) $cm->id;

    // No returnurl is passed when opened from the settings navigation.
    // Breadcrumb handles back-navigation in that case.
    // Configure.php renders the "Back" button only when returnurl is present.

    $url = new moodle_url('/local/stackmatheditor/configure.php', [
        'cmid' => $cmid,
    ]);

    // Build the navigation node (not yet attached to the tree).
    $newnode = navigation_node::create(
        get_string('configure_quiz_nav', 'local_stackmatheditor'),
        $url,
        navigation_node::TYPE_SETTING,
        null,
        'stackmatheditor_configure',
        new pix_icon('i/settings', '')
    );

    // Insert before the "Restore" entry to sit near the backup/restore group.
    // Method navigation_node::add_node($node, $beforekey) places the new node
    // Before the child whose key matches $beforekey; null means append.
    $beforekey = local_stackmatheditor_find_restore_key($modulenode);

    $modulenode->add_node($newnode, $beforekey);
}

/**
 * Return the key of the "Restore" child node within $modulenode, or null.
 *
 * Moodle's backup subsystem adds the restore navigation entry in
 * settings_navigation::load_module_settings() without an explicit string key,
 * so the key is an auto-incremented integer.  We therefore locate the node by
 * its action URL path rather than by key name.
 *
 * Patterns matched (all Moodle 3.x / 4.x variants):
 *   /backup/restorefile.php
 *   /backup/restore.php
 *
 * @param navigation_node $modulenode The parent modulesettings node.
 * @return int|string|null Key of the restore child node, or null if not found.
 */
function local_stackmatheditor_find_restore_key(navigation_node $modulenode) {
    foreach ($modulenode->children as $child) {
        if (!($child->action instanceof moodle_url)) {
            continue;
        }
        $path = $child->action->get_path();
        if (strpos($path, '/backup/restore') !== false) {
            return $child->key;
        }
    }
    return null;
}

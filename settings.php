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
 * Plugin settings for local_stackmatheditor.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

if ($hassiteconfig) {
    $settings = new admin_settingpage(
        'local_stackmatheditor',
        get_string('pluginname', 'local_stackmatheditor')
    );

    // Global enabled mode (0-3).
    $settings->add(new admin_setting_configselect(
        'local_stackmatheditor/enabled',
        get_string('setting_enabled', 'local_stackmatheditor'),
        get_string('setting_enabled_desc', 'local_stackmatheditor'),
        1,
        [
            0 => get_string('enabled_mode_0', 'local_stackmatheditor'),
            1 => get_string('enabled_mode_1', 'local_stackmatheditor'),
            2 => get_string('enabled_mode_2', 'local_stackmatheditor'),
            3 => get_string('enabled_mode_3', 'local_stackmatheditor'),
        ]
    ));

    // Variable mode default.


    // Use percent-pi notation (%pi) instead of plain pi.
    $settings->add(new admin_setting_configcheckbox(
        'local_stackmatheditor/usepercentpi',
        get_string('setting_usepercentpi', 'local_stackmatheditor'),
        get_string('setting_usepercentpi_desc', 'local_stackmatheditor'),
        0
    ));

    // How a one-row or one-column matrix is written to Maxima.
    $settings->add(new admin_setting_configselect(
        'local_stackmatheditor/vectorformat',
        get_string('setting_vectorformat', 'local_stackmatheditor'),
        get_string('setting_vectorformat_desc', 'local_stackmatheditor'),
        'matrix',
        [
            'matrix' => get_string('setting_vectorformat_matrix', 'local_stackmatheditor'),
            'list'   => get_string('setting_vectorformat_list', 'local_stackmatheditor'),
        ]
    ));

    // Maxima function a norm is written to.
    $settings->add(new admin_setting_configtext(
        'local_stackmatheditor/normfunction',
        get_string('setting_normfunction', 'local_stackmatheditor'),
        get_string('setting_normfunction_desc', 'local_stackmatheditor'),
        'norm',
        PARAM_ALPHANUMEXT
    ));

    // Default element groups multiselect.
    $grouplabels = \local_stackmatheditor\definitions::get_group_labels_with_examples();
    $groups      = \local_stackmatheditor\definitions::get_element_groups();

    $defaultselected = [];
    foreach ($groups as $key => $group) {
        if ($group['default_enabled']) {
            $defaultselected[] = $key;
        }
    }

    $settings->add(new \local_stackmatheditor\admin_setting_multiselect_sized(
        'local_stackmatheditor/default_groups',
        get_string('setting_defaultgroups', 'local_stackmatheditor'),
        get_string('setting_defaultgroups_desc', 'local_stackmatheditor'),
        $defaultselected,
        $grouplabels
    ));

    $ADMIN->add('localplugins', $settings);
}

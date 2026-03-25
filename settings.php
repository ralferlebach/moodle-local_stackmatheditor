<?php
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
    $settings->add(new admin_setting_configselect(
        'local_stackmatheditor/variablemode',
        get_string('setting_variablemode', 'local_stackmatheditor'),
        get_string('setting_variablemode_desc', 'local_stackmatheditor'),
        \local_stackmatheditor\definitions::IMPLICIT_STACK,
        [
            \local_stackmatheditor\definitions::IMPLICIT_EXPLICIT_SINGLE =>
                get_string('implicitmode_explicit_single', 'local_stackmatheditor'),
            \local_stackmatheditor\definitions::IMPLICIT_EXPLICIT_MULTI =>
                get_string('implicitmode_explicit_multi', 'local_stackmatheditor'),
            \local_stackmatheditor\definitions::IMPLICIT_SPACE_SINGLE =>
                get_string('implicitmode_space_single', 'local_stackmatheditor'),
            \local_stackmatheditor\definitions::IMPLICIT_SPACE_MULTI =>
                get_string('implicitmode_space_multi', 'local_stackmatheditor'),
            \local_stackmatheditor\definitions::IMPLICIT_STACK =>
                get_string('implicitmode_stack', 'local_stackmatheditor'),
        ]
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

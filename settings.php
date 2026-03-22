<?php
defined('MOODLE_INTERNAL') || die();

if ($hassiteconfig) {
    $settings = new admin_settingpage(
        'local_stackmatheditor',
        get_string('pluginname', 'local_stackmatheditor')
    );

    // Global enable/disable.
    $settings->add(new admin_setting_configcheckbox(
        'local_stackmatheditor/enabled',
        get_string('setting_enabled', 'local_stackmatheditor'),
        get_string('setting_enabled_desc', 'local_stackmatheditor'),
        1
    ));

    // Variable mode default.
    $settings->add(new admin_setting_configselect(
        'local_stackmatheditor/variablemode',
        get_string('setting_variablemode', 'local_stackmatheditor'),
        get_string('setting_variablemode_desc', 'local_stackmatheditor'),
        \local_stackmatheditor\definitions::VAR_SINGLE,
        [
            \local_stackmatheditor\definitions::VAR_SINGLE =>
                get_string('variablemode_single', 'local_stackmatheditor'),
            \local_stackmatheditor\definitions::VAR_MULTI =>
                get_string('variablemode_multi', 'local_stackmatheditor'),
        ]
    ));

    // Default element groups multiselect.
    $grouplabels = \local_stackmatheditor\definitions::get_group_labels_with_examples();

    $groups = \local_stackmatheditor\definitions::get_element_groups();
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

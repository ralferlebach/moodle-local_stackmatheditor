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

    // Default element groups heading.
    $settings->add(new admin_setting_heading(
        'local_stackmatheditor/defaultgroups_heading',
        get_string('setting_defaultgroups', 'local_stackmatheditor'),
        get_string('setting_defaultgroups_desc', 'local_stackmatheditor')
    ));

    // One toggle per element group.
    $groups = \local_stackmatheditor\definitions::get_element_groups();
    foreach ($groups as $key => $group) {
        $settings->add(new admin_setting_configcheckbox(
            'local_stackmatheditor/default_' . $key,
            get_string($group['langkey'], 'local_stackmatheditor'),
            '',
            $group['default_enabled'] ? 1 : 0
        ));
    }

    $ADMIN->add('localplugins', $settings);
}

<?php
defined('MOODLE_INTERNAL') || die();

$callbacks = [
    [
        'hook'     => 'core\hook\output\before_standard_top_of_body_html_generation',
        'callback' => 'local_stackmatheditor\hook_callbacks::before_top_of_body',
    ],
    [
        'hook'     => 'core\hook\output\before_footer_html_generation',
        'callback' => 'local_stackmatheditor\hook_callbacks::before_footer',
    ],
];

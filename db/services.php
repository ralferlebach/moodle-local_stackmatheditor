<?php
defined('MOODLE_INTERNAL') || die();

$functions = [
    'local_stackmatheditor_get_config' => [
        'classname'     => 'local_stackmatheditor\\external\\get_config',
        'methodname'    => 'execute',
        'description'   => 'Returns MathQuill toolbar config for given question IDs.',
        'type'          => 'read',
        'ajax'          => true,
        'loginrequired' => true,
    ],
];

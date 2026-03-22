<?php
defined('MOODLE_INTERNAL') || die();

$plugin->version      = 2026032208;
$plugin->requires     = 2022112800;
$plugin->component    = 'local_stackmatheditor';
$plugin->maturity     = MATURITY_ALPHA;
$plugin->release      = '0.2.2';
$plugin->dependencies = [
    'qtype_stack' => ANY_VERSION,
];

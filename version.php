<?php
defined('MOODLE_INTERNAL') || die();

$plugin->version      = 2026032302;
$plugin->requires     = 2022112800;
$plugin->component    = 'local_stackmatheditor';
$plugin->maturity     = MATURITY_ALPHA;
$plugin->release      = '0.81';
$plugin->dependencies = [
    'qtype_stack' => ANY_VERSION,
];

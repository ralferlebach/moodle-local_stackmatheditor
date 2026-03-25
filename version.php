<?php
defined('MOODLE_INTERNAL') || die();

$plugin->version      = 2026032600;
$plugin->requires     = 2022112800;
$plugin->component    = 'local_stackmatheditor';
$plugin->maturity     = MATURITY_BETA;
$plugin->release      = '0.97';
$plugin->dependencies = [
    'qtype_stack' => ANY_VERSION,
];

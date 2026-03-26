<?php
defined('MOODLE_INTERNAL') || die();

$plugin->version      = 2026032601;
$plugin->requires     = 2024042200;  // Moodle 4.4 minimum (tested up to 4.5+).
$plugin->component    = 'local_stackmatheditor';
$plugin->maturity     = MATURITY_ALPHA;
$plugin->release      = '0.97';
$plugin->dependencies = [
    // Requires STACK 4.6 or later (supports Maxima 5.46+ and PHP 8.x).
    'qtype_stack' => 2024010400,
];

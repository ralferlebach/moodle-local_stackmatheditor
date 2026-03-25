<?php
defined('MOODLE_INTERNAL') || die();

/**
 * Web service definitions for local_stackmatheditor.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Ralf Erlebach
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
$functions = [
    'local_stackmatheditor_get_config' => [
        'classname'     => 'local_stackmatheditor\\external\\get_config',
        'methodname'    => 'execute',
        'description'   => 'Returns MathQuill toolbar config for given question IDs within a quiz.',
        'type'          => 'read',
        'ajax'          => true,
        'loginrequired' => true,
    ],
];

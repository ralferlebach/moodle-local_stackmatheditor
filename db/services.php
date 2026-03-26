<?php
// This file is part of Moodle - https://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <https://www.gnu.org/licenses/>.

defined('MOODLE_INTERNAL') || die();

/**
 * Web service definitions for local_stackmatheditor.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
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

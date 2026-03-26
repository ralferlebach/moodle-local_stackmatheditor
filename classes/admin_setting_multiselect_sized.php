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

namespace local_stackmatheditor;

defined('MOODLE_INTERNAL') || die();

/**
 * Multiselect admin setting that auto-sizes to the number of choices.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class admin_setting_multiselect_sized extends \admin_setting_configmultiselect {
    /**
     * Render HTML output with size matching the number of choices.
     *
     * @param mixed $data Current setting data.
     * @param string $query Search query for highlighting.
     * @return string HTML output.
     */
    public function output_html($data, $query = '') {
        $html = parent::output_html($data, $query);
        $size = count($this->choices);
        if ($size > 0) {
            $html = str_replace('size="10"', 'size="' . $size . '"', $html);
        }
        return $html;
    }
}

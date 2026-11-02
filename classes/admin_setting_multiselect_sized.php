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

/**
 * Multiselect admin setting that shows all of its choices at once.
 *
 * Core caps the list at ten rows, and the toolbar has more groups than that. The row count is set
 * on the rendered select element through the DOM, by its id - not by replacing the text
 * size="10" in core's markup, which breaks silently as soon as core writes the attribute
 * differently (#98). Everything else is core's own rendering: the native select multiple with its
 * keyboard and screen reader behaviour, the hidden marker input, defaults and saving.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class admin_setting_multiselect_sized extends \admin_setting_configmultiselect {
    /**
     * Render core's setting, with the list as tall as the number of choices.
     *
     * @param mixed $data Current setting data.
     * @param string $query Search query for highlighting.
     * @return string HTML output.
     */
    public function output_html($data, $query = '') {
        $html = parent::output_html($data, $query);
        // Core loads the choices while rendering; an empty list renders nothing at all.
        $size = is_array($this->choices) ? count($this->choices) : 0;
        if ($html === '' || $size <= 0) {
            return $html;
        }
        return self::size_select($html, $this->get_id(), $size);
    }

    /**
     * Set the size attribute of the select element with the given id.
     *
     * The markup is parsed and written back with the DOM extension. When the element is not found
     * the markup is returned unchanged: the setting then shows core's default height, and nothing
     * else changes.
     *
     * @param string $html Rendered setting.
     * @param string $id Id of the select element.
     * @param int $size Number of visible rows.
     * @return string Markup with the size set.
     */
    public static function size_select(string $html, string $id, int $size): string {
        if (!class_exists('DOMDocument')) {
            return $html;
        }
        $doc = new \DOMDocument();
        $previous = libxml_use_internal_errors(true);
        // A wrapper element keeps the fragment together; the encoding declaration keeps UTF-8.
        $loaded = $doc->loadHTML(
            '<?xml encoding="utf-8"?><div id="sme-size-select-root">' . $html . '</div>',
            LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD
        );
        libxml_clear_errors();
        libxml_use_internal_errors($previous);
        if (!$loaded) {
            return $html;
        }
        $target = null;
        foreach ($doc->getElementsByTagName('select') as $select) {
            if ($select->getAttribute('id') === $id) {
                $target = $select;
                break;
            }
        }
        if (!$target) {
            return $html;
        }
        $target->setAttribute('size', (string) $size);

        $root = null;
        foreach ($doc->getElementsByTagName('div') as $div) {
            if ($div->getAttribute('id') === 'sme-size-select-root') {
                $root = $div;
                break;
            }
        }
        if (!$root) {
            return $html;
        }
        $out = '';
        foreach ($root->childNodes as $child) {
            $out .= $doc->saveHTML($child);
        }
        return $out;
    }
}

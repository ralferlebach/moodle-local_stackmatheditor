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
 * #98: the toolbar group setting shows every group, through core's own rendering.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 * @covers     \local_stackmatheditor\admin_setting_multiselect_sized
 */
final class admin_setting_multiselect_sized_test extends \advanced_testcase {
    /**
     * The setting as settings.php builds it.
     *
     * @return admin_setting_multiselect_sized
     */
    private function setting(): admin_setting_multiselect_sized {
        global $CFG;
        require_once($CFG->libdir . '/adminlib.php');
        $labels = definitions::get_group_labels_with_examples();
        $default = [];
        foreach (definitions::get_element_groups() as $key => $group) {
            if ($group['default_enabled']) {
                $default[] = $key;
            }
        }
        return new admin_setting_multiselect_sized(
            'local_stackmatheditor/default_groups',
            get_string('setting_defaultgroups', 'local_stackmatheditor'),
            get_string('setting_defaultgroups_desc', 'local_stackmatheditor'),
            $default,
            $labels
        );
    }

    /**
     * Parse the rendered setting.
     *
     * @param string $html Markup.
     * @return \DOMDocument Document.
     */
    private function dom(string $html): \DOMDocument {
        $doc = new \DOMDocument();
        libxml_use_internal_errors(true);
        $doc->loadHTML('<?xml encoding="utf-8"?><div>' . $html . '</div>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
        libxml_clear_errors();
        return $doc;
    }

    /**
     * Every group is an option, the list is as tall as the number of groups, and it is still
     * core's native multiple select with its hidden marker input.
     *
     * @return void
     */
    public function test_all_groups_are_visible_in_the_native_select(): void {
        $this->resetAfterTest();
        $setting = $this->setting();
        $labels = definitions::get_group_labels_with_examples();
        $this->assertGreaterThan(10, count($labels), 'more groups than core shows by default');

        $html = $setting->output_html($setting->get_setting());
        $doc = $this->dom($html);
        $select = null;
        foreach ($doc->getElementsByTagName('select') as $candidate) {
            if ($candidate->getAttribute('id') === $setting->get_id()) {
                $select = $candidate;
            }
        }
        $this->assertNotNull($select, 'the select element is there');
        $this->assertSame((string) count($labels), $select->getAttribute('size'));
        $this->assertTrue($select->hasAttribute('multiple'));
        $this->assertSame($setting->get_full_name() . '[]', $select->getAttribute('name'));

        $values = [];
        foreach ($select->getElementsByTagName('option') as $option) {
            $values[] = $option->getAttribute('value');
        }
        $this->assertSame(array_keys($labels), $values);

        $marker = false;
        foreach ($doc->getElementsByTagName('input') as $input) {
            $marker = $marker || ($input->getAttribute('type') === 'hidden'
                && $input->getAttribute('name') === $setting->get_full_name() . '[xxxxx]');
        }
        $this->assertTrue($marker, 'core\'s hidden marker input is kept');
        // The label points at the select: the screen reader name is core's.
        $this->assertStringContainsString('for="' . $setting->get_id() . '"', $html);
    }

    /**
     * Saving and reading back: the selection is stored and shown selected again.
     *
     * @return void
     */
    public function test_selection_is_saved_and_shown_again(): void {
        $this->resetAfterTest();
        $setting = $this->setting();
        $keys = array_keys(definitions::get_group_labels_with_examples());
        $chosen = [$keys[0], end($keys)];

        $this->assertSame('', $setting->write_setting($chosen));
        $this->assertSame($chosen, array_values($setting->get_setting()));

        $doc = $this->dom($setting->output_html($setting->get_setting()));
        $selected = [];
        foreach ($doc->getElementsByTagName('option') as $option) {
            if ($option->hasAttribute('selected')) {
                $selected[] = $option->getAttribute('value');
            }
        }
        $this->assertSame($chosen, $selected);
    }

    /**
     * The sizing does not depend on how core spells the attribute, and leaves markup without the
     * element alone.
     *
     * @return void
     */
    public function test_sizing_does_not_depend_on_core_markup(): void {
        $variants = [
            '<select id="id_x" name="x[]" size="10" multiple><option value="a">Ä</option></select>',
            "<select size='7' multiple id='id_x'><option value='a'>Ä</option></select>",
            '<div class="form-select"><select class="form-control" id="id_x" multiple><option>Ä</option></select></div>',
        ];
        foreach ($variants as $html) {
            $out = admin_setting_multiselect_sized::size_select($html, 'id_x', 14);
            $doc = $this->dom($out);
            $select = $doc->getElementsByTagName('select')->item(0);
            $this->assertSame('14', $select->getAttribute('size'), $html);
            $this->assertTrue($select->hasAttribute('multiple'), $html);
            $this->assertStringContainsString('Ä', $out, 'UTF-8 survives');
        }
        $other = '<select id="other" size="10"></select>';
        $this->assertSame($other, admin_setting_multiselect_sized::size_select($other, 'id_x', 14));
    }
}

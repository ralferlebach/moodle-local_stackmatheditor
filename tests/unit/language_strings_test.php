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
 * Every language string the plugin refers to exists - in English and German.
 *
 * The Moodle plugins directory checks this on upload ("Missing language string definitions");
 * core's own privacy test does not run in the plugin's testsuite, so the plugin checks itself:
 * privacy metadata, get_string() calls in PHP and JavaScript, and completeness of the German pack.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 * @covers     \local_stackmatheditor\privacy\provider
 */
final class language_strings_test extends \advanced_testcase {
    /**
     * Every privacy metadata string exists and every described field exists in the table.
     *
     * @return void
     */
    public function test_privacy_metadata_strings_and_fields(): void {
        global $DB;
        $collection = new \core_privacy\local\metadata\collection('local_stackmatheditor');
        $collection = privacy\provider::get_metadata($collection);
        $columns = array_keys($DB->get_columns('local_stackmatheditor'));
        foreach ($collection->get_collection() as $item) {
            $this->assertTrue(
                get_string_manager()->string_exists($item->get_summary(), 'local_stackmatheditor'),
                'Missing string ' . $item->get_summary()
            );
            foreach ($item->get_privacy_fields() as $field => $key) {
                $this->assertContains($field, $columns, "Privacy field '{$field}' is not a column.");
                $this->assertTrue(
                    get_string_manager()->string_exists($key, 'local_stackmatheditor'),
                    'Missing string ' . $key
                );
            }
        }
    }

    /**
     * Every string key used by the plugin's PHP and JavaScript code exists.
     *
     * @return void
     */
    public function test_every_referenced_string_exists(): void {
        global $CFG;
        $root = $CFG->dirroot . '/local/stackmatheditor';
        $files = array_merge(
            glob($root . '/*.php'),
            glob($root . '/classes/*.php'),
            glob($root . '/classes/*/*.php'),
            glob($root . '/db/*.php'),
            glob($root . '/amd/src/*.js')
        );
        $keys = [];
        foreach ($files as $file) {
            $code = file_get_contents($file);
            preg_match_all(
                "~(?:get_string|string_exists)\\(\\s*'([a-z0-9_:]+)'\\s*,\\s*['\"](?:local_stackmatheditor)['\"]~",
                $code,
                $matches
            );
            $keys = array_merge($keys, $matches[1]);
            preg_match_all("~A11y\\.label\\([^,]+,\\s*'([a-z0-9_]+)'~", $code, $matches);
            $keys = array_merge($keys, $matches[1]);
        }
        $keys = array_unique($keys);
        $this->assertNotEmpty($keys);
        foreach ($keys as $key) {
            $this->assertTrue(
                get_string_manager()->string_exists($key, 'local_stackmatheditor'),
                "Missing string '{$key}'"
            );
        }
    }

    /**
     * The German language pack has exactly the keys of the English one.
     *
     * @return void
     */
    public function test_german_pack_is_complete(): void {
        global $CFG;
        $load = function (string $lang) use ($CFG): array {
            $string = [];
            include($CFG->dirroot . "/local/stackmatheditor/lang/{$lang}/local_stackmatheditor.php");
            return $string;
        };
        $en = array_keys($load('en'));
        $de = array_keys($load('de'));
        $this->assertSame([], array_values(array_diff($en, $de)), 'Keys missing in German');
        $this->assertSame([], array_values(array_diff($de, $en)), 'Keys only in German');
    }
}

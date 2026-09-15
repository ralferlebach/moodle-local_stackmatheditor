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
 * Documentation must describe the product that exists.
 *
 * #71. The README once documented a setting for implicit multiplication that #65 had removed, and
 * described the correct behaviour a few sections further down - the same document contradicting
 * itself. This test is the cheap guard against that: every setting the plugin defines has a
 * title, every title appears in the README, and settings that were removed are not described as
 * if they were still there.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 * @coversNothing
 */
final class documentation_test extends \advanced_testcase {
    /**
     * Setting names as settings.php registers them.
     *
     * @return array Setting names without the component prefix.
     */
    private function settings_in_code(): array {
        global $CFG;

        $source = file_get_contents($CFG->dirroot . '/local/stackmatheditor/settings.php');
        $this->assertNotFalse($source, 'settings.php must be readable');

        preg_match_all("#'local_stackmatheditor/([a-z_]+)'#", $source, $matches);
        $names = array_values(array_unique($matches[1]));

        // One setting is registered in a loop over the operator names.
        if (in_array('diffop', $names, true)) {
            $names = array_diff($names, ['diffop']);
            foreach (['gradient', 'divergence', 'curl', 'laplacian'] as $operator) {
                $names[] = 'diffop_' . $operator;
            }
        }

        sort($names);

        return $names;
    }

    /**
     * Every setting has a title and a description in both language packs.
     *
     * @return void
     */
    public function test_every_setting_has_strings(): void {
        foreach ($this->settings_in_code() as $name) {
            $identifier = $name === 'default_groups' ? 'setting_defaultgroups' : 'setting_' . $name;

            $this->assertTrue(
                get_string_manager()->string_exists($identifier, 'local_stackmatheditor'),
                "setting '$name' has no title string ($identifier)"
            );
            $this->assertTrue(
                get_string_manager()->string_exists(
                    $identifier . '_desc',
                    'local_stackmatheditor'
                ),
                "setting '$name' has no description string"
            );
        }
    }

    /**
     * Every setting the plugin has is described in the README.
     *
     * @return void
     */
    public function test_the_readme_describes_every_setting(): void {
        global $CFG;

        $readme = file_get_contents($CFG->dirroot . '/local/stackmatheditor/README.md');
        $this->assertNotFalse($readme, 'README.md must be readable');

        foreach ($this->settings_in_code() as $name) {
            $identifier = $name === 'default_groups' ? 'setting_defaultgroups' : 'setting_' . $name;
            $title = get_string($identifier, 'local_stackmatheditor');

            if (str_starts_with($name, 'diffop_')) {
                // The four operator settings share one entry in the README.
                $title = 'Maxima function for the';
            }

            $this->assertStringContainsString(
                $title,
                $readme,
                "the README does not describe the setting '$name' ($title)"
            );
        }
    }

    /**
     * The README must not describe settings that no longer exist.
     *
     * @return void
     */
    public function test_the_readme_does_not_describe_removed_settings(): void {
        global $CFG;

        $readme = file_get_contents($CFG->dirroot . '/local/stackmatheditor/README.md');

        // Removed by #65: implicit multiplication is STACK's decision, not a setting here.
        foreach (
            [
            'Handling of implicit multiplication',
            'the variable mode',
            'variablemode',
            ] as $gone
        ) {
            $this->assertStringNotContainsString(
                $gone,
                $readme,
                "the README still describes the removed setting: '$gone'"
            );
        }
    }

    /**
     * A setting that was removed leaves no strings behind either.
     *
     * @return void
     */
    public function test_removed_settings_leave_no_strings(): void {
        foreach (['setting_variablemode', 'label_variablemode'] as $gone) {
            $this->assertFalse(
                get_string_manager()->string_exists($gone, 'local_stackmatheditor'),
                "the string '$gone' belongs to a setting that no longer exists"
            );
        }
    }

    /**
     * English and German describe the same set of strings.
     *
     * @return void
     */
    public function test_both_language_packs_have_the_same_keys(): void {
        global $CFG;

        $english = $this->string_keys($CFG->dirroot . '/local/stackmatheditor/lang/en/local_stackmatheditor.php');
        $german = $this->string_keys($CFG->dirroot . '/local/stackmatheditor/lang/de/local_stackmatheditor.php');

        $this->assertSame(
            [],
            array_values(array_diff($english, $german)),
            'strings missing from the German language pack'
        );
        $this->assertSame(
            [],
            array_values(array_diff($german, $english)),
            'strings only in the German language pack'
        );
    }

    /**
     * Read the string identifiers of a language file.
     *
     * @param string $path Language file.
     * @return array Identifiers.
     */
    private function string_keys(string $path): array {
        $source = file_get_contents($path);
        $this->assertNotFalse($source, "$path must be readable");

        preg_match_all("#\\\$string\\['([a-zA-Z0-9_]+)'\\]#", $source, $matches);
        $keys = array_unique($matches[1]);
        sort($keys);

        return $keys;
    }
}

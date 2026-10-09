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

use local_stackmatheditor\form\configure_form;

/**
 * The activation part of the configuration form in every instance mode.
 *
 * Replaces the Behat scenarios "Enabled checkbox only appears in modes 2 and 3", "... appears and
 * works in mode 2" and "... is pre-checked in mode 3" (#96): the form decides what is shown,
 * config_manager what is pre-set; neither needs a browser.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 * @covers     \local_stackmatheditor\form\configure_form
 */
final class configure_form_test extends \advanced_testcase {
    /**
     * Build the form as configure.php does, and return its HTML and its element names.
     *
     * @param string $mode 'quiz' or 'question'.
     * @param int $instancemode Instance activation mode 0-3.
     * @param array $semantics STACK input semantics as stack_inputs::get_semantics_summary() returns them.
     * @return array [html, element names]
     */
    private function form(string $mode, int $instancemode, array $semantics = ['inputs' => [], 'editurl' => null]): array {
        $course = $this->getDataGenerator()->create_course();
        $quiz = $this->getDataGenerator()->create_module('quiz', ['course' => $course->id, 'name' => 'Test Quiz']);
        $form = new configure_form('/local/stackmatheditor/configure.php', [
            'mode' => $mode,
            'modname' => 'quiz',
            'questionrecord' => (object) ['id' => 1, 'name' => 'My STACK Q', 'version' => 1],
            'activity' => $quiz,
            'grouplabels' => definitions::get_group_labels_with_examples(),
            'previewhtml' => '',
            'returnurl' => '',
            'instancemode' => $instancemode,
            'dependencies' => [],
            'stacksemantics' => $semantics,
        ]);
        $mform = (new \ReflectionProperty($form, '_form'))->getValue($form);
        $names = array_map(fn($element) => $element->getName(), $mform->_elements);
        ob_start();
        $form->display();
        return [ob_get_clean(), $names];
    }

    /**
     * Data for the activation section: mode, instance mode, checkbox expected, locked text.
     *
     * @return array
     */
    public static function mode_provider(): array {
        return [
            'quiz, mode 0' => ['quiz', 0, false, 'configure_enabled_locked_off'],
            'quiz, mode 1' => ['quiz', 1, false, 'configure_enabled_locked_on'],
            'quiz, mode 2' => ['quiz', 2, true, null],
            'quiz, mode 3' => ['quiz', 3, true, null],
            'question, mode 1' => ['question', 1, false, 'configure_enabled_locked_on'],
            'question, mode 2' => ['question', 2, true, null],
            'question, mode 3' => ['question', 3, true, null],
        ];
    }

    /**
     * The checkbox id_sme_enabled exists in modes 2 and 3 only; modes 0 and 1 show the locked state.
     *
     * @dataProvider mode_provider
     * @param string $mode Form mode.
     * @param int $instancemode Instance activation mode.
     * @param bool $checkbox Whether the checkbox is expected.
     * @param string|null $locked String key of the locked text, when expected.
     * @return void
     */
    public function test_the_checkbox_follows_the_instance_mode(
        string $mode,
        int $instancemode,
        bool $checkbox,
        ?string $locked
    ): void {
        $this->resetAfterTest();
        $this->setAdminUser();
        [$html, $names] = $this->form($mode, $instancemode);

        $this->assertSame($checkbox, in_array('enabled', $names, true));
        $this->assertSame($checkbox, str_contains($html, 'id="id_sme_enabled"'));
        if ($locked !== null) {
            $this->assertStringContainsString(get_string($locked, 'local_stackmatheditor'), $html);
        }
    }

    /**
     * What the checkbox starts with: unchecked in mode 2, checked in mode 3 - what a quiz without
     * a configuration of its own inherits.
     *
     * @return void
     */
    public function test_the_checkbox_starts_with_what_the_quiz_inherits(): void {
        $this->resetAfterTest();
        $course = $this->getDataGenerator()->create_course();
        $quiz = $this->getDataGenerator()->create_module('quiz', ['course' => $course->id]);
        $cmid = (int) get_coursemodule_from_instance('quiz', $quiz->id)->id;

        set_config('enabled', 2, 'local_stackmatheditor');
        $this->assertFalse(config_manager::get_effective_enabled($cmid));
        set_config('enabled', 3, 'local_stackmatheditor');
        $this->assertTrue(config_manager::get_effective_enabled($cmid));
    }

    /**
     * An input that does not allow the words the toolbar writes gets a warning with those words;
     * one that allows them gets none (#96).
     *
     * @return void
     */
    public function test_missing_allowed_words_are_shown_per_input(): void {
        $this->resetAfterTest();
        $this->setAdminUser();
        $semantics = ['editurl' => null, 'inputs' => [
            ['name' => 'ans1', 'value' => 0, 'label' => 'No', 'missingwords' => ['Angle', 'Distance']],
            ['name' => 'ans2', 'value' => 0, 'label' => 'No', 'missingwords' => []],
        ]];
        [$html, $names] = $this->form('question', 2, $semantics);

        $this->assertContains('stackmissingwords0', $names);
        $this->assertNotContains('stackmissingwords1', $names);
        $this->assertStringContainsString(
            get_string('stacksemantics_missingwords', 'local_stackmatheditor', 'Angle, Distance'),
            $html
        );
    }
}

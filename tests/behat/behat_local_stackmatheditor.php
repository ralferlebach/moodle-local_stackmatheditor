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

use Behat\Mink\Exception\ExpectationException;

/**
 * Behat step definitions for local_stackmatheditor.
 *
 * @package    local_stackmatheditor
 * @category   test
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class behat_local_stackmatheditor extends behat_base {
    /**
     * Set the plugin enabled mode in Moodle config.
     *
     * @Given the plugin enabled mode is set to :mode
     * @param string $mode One of "0", "1", "2", "3".
     */
    public function the_plugin_enabled_mode_is_set_to(string $mode): void {
        set_config('enabled', $mode, 'local_stackmatheditor');
        purge_all_caches();
    }

    /**
     * Navigate to the STACK MathQuill quiz-level configuration page via the nav selector.
     *
     * @When I navigate to the STACK MathQuill quiz configuration
     */
    public function i_navigate_to_quiz_configuration(): void {
        $select = $this->find('css', 'form[action*="jumpto.php"] select[name="jump"]');
        $select->selectOption('STACK MathQuill-Editor einrichten');
        $this->getSession()->wait(3000, "document.readyState === 'complete'");
    }

    /**
     * Open the question-level configure page via the icon link next to a question.
     *
     * @When I click the MathQuill configure icon next to :questionname
     * @param string $questionname Question name.
     */
    public function i_click_configure_icon_next_to(string $questionname): void {
        $link = $this->find(
            'xpath',
            '//a[contains(@class,"sme-configure-edit-link")]'
                . '[ancestor::*[contains(.,"' . $questionname . '")]]'
        );
        $link->click();
        $this->getSession()->wait(2000, "document.readyState === 'complete'");
    }

    /**
     * Open the STACK MathQuill quiz configuration page directly by quiz name.
     *
     * @Given I am on the STACK MathQuill quiz configuration page for :quizname
     * @param string $quizname Quiz name.
     */
    public function i_am_on_quiz_config_page(string $quizname): void {
        global $DB;
        $quiz = $DB->get_record('quiz', ['name' => $quizname], '*', MUST_EXIST);
        $cm = get_coursemodule_from_instance('quiz', $quiz->id, 0, false, MUST_EXIST);
        $url = new \moodle_url(
            '/local/stackmatheditor/configure.php',
            ['cmid' => $cm->id]
        );
        $this->getSession()->visit($url->out(false));
        $this->getSession()->wait(2000, "document.readyState === 'complete'");
    }

    /**
     * Assert that an element with the given CSS class exists on the page.
     *
     * @Then I should see the class :cssclass
     * @param string $cssclass CSS class name without the leading dot.
     */
    public function i_should_see_the_class(string $cssclass): void {
        $el = $this->find('css', '.' . $cssclass);
        if (!$el) {
            throw new ExpectationException(
                "Expected element with class '$cssclass' not found.",
                $this->getSession()
            );
        }
    }

    /**
     * Assert that no element with the given CSS class exists on the page.
     *
     * @Then I should not see the class :cssclass
     * @param string $cssclass CSS class name without the leading dot.
     */
    public function i_should_not_see_the_class(string $cssclass): void {
        $elements = $this->getSession()->getPage()->findAll('css', '.' . $cssclass);
        if (!empty($elements)) {
            throw new ExpectationException(
                "Element with class '$cssclass' should not be present on the page.",
                $this->getSession()
            );
        }
    }

    /**
     * Assert that a specific option text exists in the quiz navigation select element.
     *
     * @Then I should see :text in the quiz navigation select
     * @param string $text Option label to look for.
     */
    public function i_should_see_option_in_nav_select(string $text): void {
        $select = $this->find('css', 'form[action*="jumpto.php"] select[name="jump"]');
        if (!$select) {
            throw new ExpectationException(
                'Quiz navigation select not found.',
                $this->getSession()
            );
        }
        $option = $select->find('xpath', './/option[contains(text(),"' . $text . '")]');
        if (!$option) {
            throw new ExpectationException(
                "Option '$text' not found in quiz navigation select.",
                $this->getSession()
            );
        }
    }

    /**
     * Assert that a checkbox with the given id exists on the page.
     *
     * @Then I should see a checkbox with id :id
     * @param string $id Element id attribute value.
     */
    public function i_should_see_checkbox_with_id(string $id): void {
        $el = $this->find('css', '#' . $id . '[type="checkbox"]');
        if (!$el) {
            throw new ExpectationException(
                "Checkbox '#$id' not found.",
                $this->getSession()
            );
        }
    }

    /**
     * Assert that no checkbox with the given id exists on the page.
     *
     * @Then I should not see a checkbox with id :id
     * @param string $id Element id attribute value.
     */
    public function i_should_not_see_checkbox_with_id(string $id): void {
        $elements = $this->getSession()->getPage()->findAll(
            'css',
            '#' . $id . '[type="checkbox"]'
        );
        if (!empty($elements)) {
            throw new ExpectationException(
                "Checkbox '#$id' should not be present.",
                $this->getSession()
            );
        }
    }

    /**
     * Assert that a checkbox is in the checked state.
     *
     * @Then the checkbox :id should be checked
     * @param string $id Element id attribute value.
     */
    public function the_checkbox_should_be_checked(string $id): void {
        $el = $this->find('css', '#' . $id);
        if (!$el || !$el->isChecked()) {
            throw new ExpectationException(
                "Checkbox '#$id' should be checked.",
                $this->getSession()
            );
        }
    }

    /**
     * Assert that a checkbox is in the unchecked state.
     *
     * @Then the checkbox :id should be unchecked
     * @param string $id Element id attribute value.
     */
    public function the_checkbox_should_be_unchecked(string $id): void {
        $el = $this->find('css', '#' . $id);
        if (!$el || $el->isChecked()) {
            throw new ExpectationException(
                "Checkbox '#$id' should be unchecked.",
                $this->getSession()
            );
        }
    }

    /**
     * Assert that the MathQuill field associated with a named input is not empty.
     *
     * The MathQuill editor inserts an sme-input-wrap div immediately before
     * the hidden input in the DOM. An empty MathQuill field has the mq-empty
     * CSS class on its .mq-root-block span.
     *
     * @Then the MathQuill field for :inputname should not be empty
     * @param string $inputname Name attribute of the hidden input element.
     */
    public function the_mathquill_field_should_not_be_empty(string $inputname): void {
        $js = <<<JS
            (function() {
                var input = document.querySelector('input[name="{$inputname}"]');
                if (!input) { return false; }
                var wrap = input.previousElementSibling;
                if (!wrap) { return false; }
                var mqroot = wrap.querySelector('.mq-root-block');
                if (!mqroot) { return false; }
                return !mqroot.classList.contains('mq-empty');
            })()
JS;
        $result = $this->getSession()->evaluateScript($js);
        if (!$result) {
            throw new ExpectationException(
                "MathQuill field for input '$inputname' is empty or not found.",
                $this->getSession()
            );
        }
    }

    /**
     * Assert that a hidden input element contains a specific Maxima value.
     *
     * @Then the hidden input :inputname should contain :value
     * @param string $inputname Name attribute.
     * @param string $value     Expected value.
     */
    public function the_hidden_input_should_contain(
        string $inputname,
        string $value
    ): void {
        $js = "return document.querySelector('input[name=\"{$inputname}\"]').value;";
        $actual = $this->getSession()->evaluateScript($js);
        if ($actual !== $value) {
            throw new ExpectationException(
                "Input '$inputname' contains '$actual', expected '$value'.",
                $this->getSession()
            );
        }
    }

    /**
     * Assert that a hidden input element contains any non-empty value.
     *
     * @Then the hidden input :inputname should contain a non-empty Maxima value
     * @param string $inputname Name attribute.
     */
    public function the_hidden_input_should_be_nonempty(string $inputname): void {
        $js = "return document.querySelector('input[name=\"{$inputname}\"]').value;";
        $actual = $this->getSession()->evaluateScript($js);
        if (empty($actual)) {
            throw new ExpectationException(
                "Input '$inputname' is empty; expected a Maxima expression.",
                $this->getSession()
            );
        }
    }

    /**
     * Simulate keyboard input into a MathQuill field by focusing its internal textarea.
     *
     * @When I type :text into the MathQuill field for :inputname
     * @param string $text      Text to type (LaTeX-style shorthand, e.g. "x^2").
     * @param string $inputname Name attribute of the corresponding hidden input.
     */
    public function i_type_into_mathquill_field(
        string $text,
        string $inputname
    ): void {
        $js = <<<JS
            (function() {
                var input = document.querySelector('input[name="{$inputname}"]');
                if (!input) { return false; }
                var container = input.previousElementSibling;
                if (!container) { return false; }
                var ta = container.querySelector('.mq-textarea textarea');
                if (!ta) { return false; }
                ta.focus();
                return true;
            })()
JS;
        $this->getSession()->evaluateScript($js);
        $this->getSession()->getDriver()->keyDown('//body', $text);
    }
    // Quiz / question creation.

    /**
     * Create a minimal STACK algebraic-input quiz and question in a course.
     *
     * @Given a STACK quiz :quizname with algebraic input exists in :shortname
     * @param string $quizname  Quiz name to create.
     * @param string $shortname Course shortname.
     */
    public function a_stack_quiz_with_algebraic_input_exists_in(
        string $quizname,
        string $shortname
    ): void {
        global $DB, $CFG;
        require_once($CFG->dirroot . '/mod/quiz/locallib.php');

        $course = $DB->get_record('course', ['shortname' => $shortname], '*', MUST_EXIST);

        // Create quiz if it does not already exist.
        $quiz = $DB->get_record('quiz', ['name' => $quizname, 'course' => $course->id]);
        if (!$quiz) {
            $gen      = testing_util::get_data_generator();
            $quizdata = $gen->create_module('quiz', [
                'course'    => $course->id,
                'name'      => $quizname,
                'grade'     => 10,
                'sumgrades' => 1,
            ]);
            $quiz = $DB->get_record('quiz', ['id' => $quizdata->id], '*', MUST_EXIST);
        }

        // Create a STACK question and add it to the quiz.
        $this->ensure_stack_question_in_quiz($quizname, 'Test STACK Q');
    }

    /**
     * Create a STACK question (any name) and add it to the named quiz.
     *
     * @Given a STACK question exists in quiz :quizname
     * @param string $quizname Quiz name.
     */
    public function a_stack_question_exists_in_quiz(string $quizname): void {
        $this->ensure_stack_question_in_quiz($quizname, 'Test STACK Q');
    }

    /**
     * Create a named STACK question and add it to the named quiz.
     *
     * @Given a STACK question :questionname exists in quiz :quizname
     * @param string $questionname Question name.
     * @param string $quizname     Quiz name.
     */
    public function a_named_stack_question_exists_in_quiz(
        string $questionname,
        string $quizname
    ): void {
        $this->ensure_stack_question_in_quiz($quizname, $questionname);
    }

    /**
     * Internal helper: find-or-create a STACK question in a quiz.
     *
     * Uses qtype_stack's 'algebraic' generator template.
     *
     * @param string $quizname     Quiz name.
     * @param string $questionname Question name.
     * @return stdClass The question record.
     */
    protected function ensure_stack_question_in_quiz(
        string $quizname,
        string $questionname
    ): stdClass {
        global $DB, $CFG;
        require_once($CFG->dirroot . '/mod/quiz/locallib.php');

        $quiz = $DB->get_record('quiz', ['name' => $quizname], '*', MUST_EXIST);
        $cm   = get_coursemodule_from_instance('quiz', $quiz->id, 0, false, MUST_EXIST);

        // Check whether question already exists.
        $existing = $DB->get_record('question', [
            'name'  => $questionname,
            'qtype' => 'stack',
        ]);
        if ($existing) {
            return $existing;
        }

        // Resolve question category.
        $ctx = context_module::instance($cm->id);
        $cat = $DB->get_record('question_categories', ['contextid' => $ctx->id]);
        if (!$cat) {
            $coursecontext = context_course::instance($quiz->course);
            $cat = $DB->get_record('question_categories', ['contextid' => $coursecontext->id]);
        }
        if (!$cat) {
            $gen  = testing_util::get_data_generator();
            $qgen = $gen->get_plugin_generator('core_question');
            $cat  = $qgen->create_question_category(['contextid' => $ctx->id]);
        }

        // Create STACK question via the plugin generator.
        $gen      = testing_util::get_data_generator();
        $qgen     = $gen->get_plugin_generator('core_question');
        $question = $qgen->create_question('stack', 'algebraic', [
            'name'     => $questionname,
            'category' => $cat->id,
        ]);

        // Add question to the quiz.
        quiz_add_quiz_question($question->id, $quiz, 0, 1);

        if (function_exists('quiz_update_sumgrades')) {
            quiz_update_sumgrades($quiz);
        } else {
            // Moodle 5.x: quiz_update_sumgrades was removed.
            $quizobj = mod_quiz\quiz_settings::create($quiz->id);
            $quizobj->get_grade_calculator()->recompute_quiz_sumgrades();
        }

        return $DB->get_record('question', ['id' => $question->id], '*', MUST_EXIST);
    }

    // Navigation helpers.

    /**
     * Open the STACK MathQuill quiz configuration page directly by quiz name.
     *
     * @Given I am on the STACK MathQuill quiz configuration page for :quizname
     * @param string $quizname Quiz name.
     */
    public function i_am_on_quiz_config_page(string $quizname): void {
        global $DB;
        $quiz = $DB->get_record('quiz', ['name' => $quizname], '*', MUST_EXIST);
        $cm   = get_coursemodule_from_instance('quiz', $quiz->id, 0, false, MUST_EXIST);
        $url  = new moodle_url(
            '/local/stackmatheditor/configure.php',
            ['cmid' => $cm->id]
        );
        $this->getSession()->visit($url->out(false));
        $this->getSession()->wait(2000, "document.readyState === 'complete'");
    }

    /**
     * Open the MathQuill configuration page for a specific question inside a quiz.
     *
     * @Given I am on the MathQuill configuration page for question :questionname in :quizname
     * @param string $questionname Question name.
     * @param string $quizname     Quiz name.
     */
    public function i_am_on_question_config_page(
        string $questionname,
        string $quizname
    ): void {
        global $DB;

        $quiz     = $DB->get_record('quiz', ['name' => $quizname], '*', MUST_EXIST);
        $cm       = get_coursemodule_from_instance('quiz', $quiz->id, 0, false, MUST_EXIST);
        $question = $DB->get_record(
            'question',
            ['name' => $questionname, 'qtype' => 'stack'],
            '*',
            MUST_EXIST
        );

        // Resolve question bank entry id (Moodle 4.1+).
        $qbe = $DB->get_record('question_bank_entries', ['questionid' => $question->id]);
        if (!$qbe) {
            throw new ExpectationException(
                "No question_bank_entry found for question '$questionname'.",
                $this->getSession()
            );
        }

        $url = new moodle_url(
            '/local/stackmatheditor/configure.php',
            ['cmid' => $cm->id, 'qbeid' => $qbe->id]
        );
        $this->getSession()->visit($url->out(false));
        $this->getSession()->wait(2000, "document.readyState === 'complete'");
    }

    /**
     * Start a quiz attempt as the currently logged-in user.
     *
     * @Given I attempt the quiz :quizname
     * @When I attempt the quiz :quizname
     * @param string $quizname Quiz name.
     */
    public function i_attempt_the_quiz(string $quizname): void {
        global $DB;
        $quiz = $DB->get_record('quiz', ['name' => $quizname], '*', MUST_EXIST);
        $cm   = get_coursemodule_from_instance('quiz', $quiz->id, 0, false, MUST_EXIST);
        $url  = new moodle_url('/mod/quiz/view.php', ['id' => $cm->id]);
        $this->getSession()->visit($url->out(false));
        $this->getSession()->wait(2000, "document.readyState === 'complete'");

        // Click "Attempt quiz now" button (text varies by Moodle version / language).
        $page   = $this->getSession()->getPage();
        $button = $page->find(
            'xpath',
            '//button[contains(@class,"mod_quiz-start-attempt-button")]'
            . ' | //input[@type="submit"][contains(@value,"Attempt")]'
            . ' | //button[contains(text(),"Attempt")]'
            . ' | //button[contains(text(),"Quiz starten")]'
        );
        if ($button) {
            $button->click();
            $this->getSession()->wait(3000, "document.readyState === 'complete'");
        }
    }

    /**
     * Alias for i_attempt_the_quiz for use in Given context.
     *
     * @Given I am attempting the quiz :quizname
     * @param string $quizname Quiz name.
     */
    public function i_am_attempting_the_quiz(string $quizname): void {
        $this->i_attempt_the_quiz($quizname);
    }

    /**
     * Return to the quiz attempt page (re-open the current attempt).
     *
     * @When I return to the quiz attempt page
     */
    public function i_return_to_the_quiz_attempt_page(): void {
        $this->getSession()->back();
        $this->getSession()->wait(2000, "document.readyState === 'complete'");
    }

    /**
     * Navigate to next quiz page and back to simulate saving progress.
     *
     * @When I navigate to the next question and back
     */
    public function i_navigate_to_next_question_and_back(): void {
        $page = $this->getSession()->getPage();
        $next = $page->find(
            'xpath',
            '//input[@type="submit"][@name="next"]'
            . ' | //button[@name="next"]'
            . ' | //input[@type="submit"][contains(@value,"Next")]'
        );
        if ($next) {
            $next->click();
            $this->getSession()->wait(2000, "document.readyState === 'complete'");
        }
        $this->getSession()->back();
        $this->getSession()->wait(2000, "document.readyState === 'complete'");
    }

    /**
     * Enter an answer in a quiz, then navigate away and back to simulate persistence.
     *
     * @When I have previously answered :answer in the quiz :quizname
     * @param string $answer   Maxima expression to set as the input value.
     * @param string $quizname Quiz name.
     */
    public function i_have_previously_answered(
        string $answer,
        string $quizname
    ): void {
        $this->i_attempt_the_quiz($quizname);

        // Set the first visible STACK algebraic input value via JS.
        $safeanswer = addslashes($answer);
        $js = <<<JS
            (function() {
                var input = document.querySelector('input[name*="ans"]');
                if (!input) { return false; }
                input.value = '{$safeanswer}';
                input.dispatchEvent(new Event('change', {bubbles: true}));
                return true;
            })()
JS;
        $this->getSession()->evaluateScript($js);
        $this->getSession()->wait(1000, 'true');

        // Submit via the "Next" or save-without-submitting button.
        $this->i_navigate_to_next_question_and_back();
    }

    // Configure form assertions.

    /**
     * Deselect a toolbar group option in the configure form select element.
     *
     * @When I deselect the :groupname toolbar group
     * @param string $groupname Label text (or partial) of the group option to deselect.
     */
    public function i_deselect_the_toolbar_group(string $groupname): void {
        $safegroup = addslashes($groupname);
        $js = <<<JS
            (function() {
                var select = document.querySelector('select[name="groups"]');
                if (!select) { return 'no-select'; }
                var options = select.options;
                for (var i = 0; i < options.length; i++) {
                    if (options[i].text.indexOf('{$safegroup}') !== -1) {
                        options[i].selected = false;
                        return 'ok';
                    }
                }
                return 'not-found';
            })()
JS;
        $result = $this->getSession()->evaluateScript($js);
        if ($result !== 'ok') {
            throw new ExpectationException(
                "Toolbar group '$groupname' not found in select (result: $result).",
                $this->getSession()
            );
        }
    }

    /**
     * Assert that a toolbar group option is currently not selected.
     *
     * @Then the :groupname toolbar group should be deselected
     * @param string $groupname Label text (or partial) of the group option.
     */
    public function the_toolbar_group_should_be_deselected(string $groupname): void {
        $safegroup = addslashes($groupname);
        $js = <<<JS
            (function() {
                var select = document.querySelector('select[name="groups"]');
                if (!select) { return 'no-select'; }
                var options = select.options;
                for (var i = 0; i < options.length; i++) {
                    if (options[i].text.indexOf('{$safegroup}') !== -1) {
                        return options[i].selected ? 'selected' : 'deselected';
                    }
                }
                return 'not-found';
            })()
JS;
        $result = $this->getSession()->evaluateScript($js);
        if ($result !== 'deselected') {
            throw new ExpectationException(
                "Expected toolbar group '$groupname' to be deselected, but got: $result",
                $this->getSession()
            );
        }
    }

    /**
     * Set the quiz-level config so that a specific toolbar group is enabled.
     *
     * @Given the quiz-level config has :groupname enabled for :quizname
     * @param string $groupname Group label or key to enable.
     * @param string $quizname  Quiz name.
     */
    public function the_quiz_level_config_has_enabled_for(
        string $groupname,
        string $quizname
    ): void {
        global $DB;

        $quiz = $DB->get_record('quiz', ['name' => $quizname], '*', MUST_EXIST);
        $cm   = get_coursemodule_from_instance('quiz', $quiz->id, 0, false, MUST_EXIST);

        // Find group key by label substring match.
        $groups   = local_stackmatheditor\definitions::get_element_groups();
        $groupkey = null;
        foreach ($groups as $key => $group) {
            if (
                $key === $groupname
                || strpos((string)($group['label'] ?? ''), $groupname) !== false
            ) {
                $groupkey = $key;
                break;
            }
        }
        if (!$groupkey) {
            throw new ExpectationException(
                "Unknown toolbar group: '$groupname'",
                $this->getSession()
            );
        }

        // Persist quiz-level config.
        $existing = $DB->get_record(
            'local_stackmatheditor_config',
            ['cmid' => $cm->id, 'qbeid' => null]
        );
        if ($existing) {
            $config = json_decode($existing->config ?? '{}', true) ?: [];
            $config['groups'][$groupkey] = true;
            $existing->config = json_encode($config);
            $DB->update_record('local_stackmatheditor_config', $existing);
        } else {
            $record         = new stdClass();
            $record->cmid   = $cm->id;
            $record->qbeid  = null;
            $record->config = json_encode(['groups' => [$groupkey => true]]);
            $DB->insert_record('local_stackmatheditor_config', $record);
        }
    }

    /**
     * Assert that a question-level config override exists in the DB.
     *
     * @Then the question-level config for :questionname should override the quiz default
     * @param string $questionname Question name.
     */
    public function the_question_level_config_should_override(string $questionname): void {
        global $DB;

        $question = $DB->get_record(
            'question',
            ['name' => $questionname, 'qtype' => 'stack'],
            '*',
            MUST_EXIST
        );
        $qbe = $DB->get_record(
            'question_bank_entries',
            ['questionid' => $question->id],
            '*',
            MUST_EXIST
        );
        $override = $DB->record_exists(
            'local_stackmatheditor_config',
            ['qbeid' => $qbe->id]
        );
        if (!$override) {
            throw new ExpectationException(
                "No question-level config override found for '$questionname'.",
                $this->getSession()
            );
        }
    }

    /**
     * Mark a quiz STACK question slot as having the editor disabled.
     *
     * @Given the STACK question :inputname in :quizname has editor disabled
     * @param string $inputname  Input name (e.g. "ans1") used to locate the question slot.
     * @param string $quizname   Quiz name.
     */
    public function the_stack_question_has_editor_disabled(
        string $inputname,
        string $quizname
    ): void {
        global $DB;

        $quiz = $DB->get_record('quiz', ['name' => $quizname], '*', MUST_EXIST);
        $cm   = get_coursemodule_from_instance('quiz', $quiz->id, 0, false, MUST_EXIST);

        // Find the question containing the given input name.
        $slots = $DB->get_records('quiz_slots', ['quizid' => $quiz->id]);
        foreach ($slots as $slot) {
            $question = question_bank::load_question($slot->questionid, false);
            if (!empty($question->inputs[$inputname])) {
                $qbe = $DB->get_record(
                    'question_bank_entries',
                    ['questionid' => $slot->questionid]
                );
                if ($qbe) {
                    $record         = new stdClass();
                    $record->cmid   = $cm->id;
                    $record->qbeid  = $qbe->id;
                    $record->config = json_encode(['enabled' => 0]);
                    $existing = $DB->get_record('local_stackmatheditor_config', [
                        'cmid'  => $cm->id,
                        'qbeid' => $qbe->id,
                    ]);
                    if ($existing) {
                        $record->id = $existing->id;
                        $DB->update_record('local_stackmatheditor_config', $record);
                    } else {
                        $DB->insert_record('local_stackmatheditor_config', $record);
                    }
                }
                return;
            }
        }
        throw new ExpectationException(
            "Could not find STACK input '$inputname' in quiz '$quizname'.",
            $this->getSession()
        );
    }

    // MathQuill editor assertions.

    /**
     * Assert that the MathQuill editor container is visible for an input.
     *
     * @Then the MathQuill editor is visible for :inputname
     * @param string $inputname Name attribute of the hidden input element.
     */
    public function the_mathquill_editor_is_visible_for(string $inputname): void {
        $js = <<<JS
            (function() {
                var input = document.querySelector('input[name="{$inputname}"]');
                if (!input) { return false; }
                var wrap = input.previousElementSibling;
                if (!wrap) { return false; }
                return wrap.classList.contains('sme-input-wrap')
                    || wrap.classList.contains('sme-mq-container');
            })()
JS;
        $result = $this->getSession()->evaluateScript($js);
        if (!$result) {
            throw new ExpectationException(
                "MathQuill editor is not visible for input '$inputname'.",
                $this->getSession()
            );
        }
    }

    /**
     * Assert that the original STACK input field is hidden.
     *
     * @Then I should not see the original STACK input field
     */
    public function i_should_not_see_the_original_stack_input_field(): void {
        $js = <<<JS
            (function() {
                var inputs = document.querySelectorAll(
                    '.stackinputfeedback, .que.stack input[type="text"]'
                );
                for (var i = 0; i < inputs.length; i++) {
                    var style = window.getComputedStyle(inputs[i]);
                    if (style.display !== 'none' && style.visibility !== 'hidden') {
                        return false;
                    }
                }
                return true;
            })()
JS;
        $result = $this->getSession()->evaluateScript($js);
        if (!$result) {
            throw new ExpectationException(
                "Original STACK input field is still visible.",
                $this->getSession()
            );
        }
    }

    /**
     * Assert that the MathQuill LaTeX content for an input contains a fragment.
     *
     * @Then the MathQuill field for :inputname should contain LaTeX containing :fragment
     * @param string $inputname Name attribute of the hidden input.
     * @param string $fragment  Expected LaTeX fragment.
     */
    public function the_mathquill_field_should_contain_latex(
        string $inputname,
        string $fragment
    ): void {
        $safefragment = addslashes($fragment);
        $js = <<<JS
            (function() {
                var input = document.querySelector('input[name="{$inputname}"]');
                if (!input) { return null; }
                var wrap = input.previousElementSibling;
                if (!wrap) { return null; }
                if (window.MathQuill) {
                    var mq = MathQuill.getInterface(2);
                    var field = mq(wrap.querySelector('.mq-editable-field'));
                    if (field) { return field.latex(); }
                }
                var mqroot = wrap.querySelector('.mq-root-block');
                return mqroot ? mqroot.getAttribute('aria-label') : null;
            })()
JS;
        $actual = $this->getSession()->evaluateScript($js);
        if ($actual === null || strpos($actual, $fragment) === false) {
            throw new ExpectationException(
                "MathQuill field for '$inputname' LaTeX '$actual'"
                    . " does not contain '$fragment'.",
                $this->getSession()
            );
        }
    }

    /**
     * Click a toolbar button that has the given title attribute.
     *
     * @When I click the toolbar button with title :title
     * @param string $title Title attribute of the toolbar button.
     */
    public function i_click_the_toolbar_button_with_title(string $title): void {
        $safetitle = addslashes($title);
        $btn = $this->find(
            'xpath',
            '//button[contains(@class,"sme-tb-btn")][@title="' . $safetitle . '"]'
        );
        if (!$btn) {
            throw new ExpectationException(
                "Toolbar button with title '$title' not found.",
                $this->getSession()
            );
        }
        $btn->click();
    }

    // Tex2max JavaScript evaluation.

    /**
     * Evaluate a tex2max conversion in the browser AMD context and store the result.
     *
     * @When the tex2max output for latex :latex in variableMode :mode is evaluated
     * @param string $latex LaTeX input string.
     * @param string $mode  Variable mode string (e.g. "explicit_single").
     */
    public function the_tex2max_output_is_evaluated(
        string $latex,
        string $mode
    ): void {
        // Escape for safe embedding in a JS single-quoted string.
        $jslatex = str_replace(['\\', "'", "\n"], ['\\\\', "\\'", '\\n'], $latex);
        $jsmode  = str_replace("'", "\\'", $mode);

        $js = <<<JS
            window.__sme_t2m_result = null;
            require(['local_stackmatheditor/tex2max'], function(t2m) {
                window.__sme_t2m_result = t2m.convert('{$jslatex}', {variableMode: '{$jsmode}'});
            });
JS;
        $this->getSession()->evaluateScript($js);
        // Wait up to 5 s for the AMD callback to fire.
        $this->getSession()->wait(5000, "window.__sme_t2m_result !== null");
    }

    /**
     * Assert the tex2max result equals an expected string exactly.
     *
     * @Then the tex2max result should be :expected
     * @param string $expected Expected Maxima output.
     */
    public function the_tex2max_result_should_be(string $expected): void {
        $actual = $this->getSession()->evaluateScript(
            'return window.__sme_t2m_result;'
        );
        if ($actual !== $expected) {
            throw new ExpectationException(
                "tex2max result '$actual' does not equal expected '$expected'.",
                $this->getSession()
            );
        }
    }

    /**
     * Assert the tex2max result contains a substring.
     *
     * @Then the tex2max result should contain :text
     * @param string $text Expected substring.
     */
    public function the_tex2max_result_should_contain(string $text): void {
        $actual = $this->getSession()->evaluateScript(
            'return window.__sme_t2m_result;'
        );
        if ($actual === null || strpos($actual, $text) === false) {
            throw new ExpectationException(
                "tex2max result '$actual' does not contain '$text'.",
                $this->getSession()
            );
        }
    }

    /**
     * Assert the tex2max result does not contain a substring.
     *
     * @Then the tex2max result should not contain :text
     * @param string $text String that must not appear in the result.
     */
    public function the_tex2max_result_should_not_contain(string $text): void {
        $actual = $this->getSession()->evaluateScript(
            'return window.__sme_t2m_result;'
        );
        if ($actual !== null && strpos($actual, $text) !== false) {
            throw new ExpectationException(
                "tex2max result '$actual' should not contain '$text'.",
                $this->getSession()
            );
        }
    }
}

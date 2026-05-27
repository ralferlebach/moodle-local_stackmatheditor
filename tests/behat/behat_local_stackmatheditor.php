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
    // Internal helpers.
    /**
     * Create a minimal STACK question and add it to the named quiz.
     *
     * @param string $quizname     Quiz display name (unique in the test site).
     * @param string $questionname Name for the new question.
     * @return stdClass The created question record.
     */
    protected function create_stack_question_in_quiz(
        string $quizname,
        string $questionname = 'STACK question'
    ): stdClass {
        global $DB;

        $quiz = $DB->get_record('quiz', ['name' => $quizname], '*', MUST_EXIST);
        $cm = get_coursemodule_from_instance('quiz', $quiz->id, 0, false, MUST_EXIST);
        $coursecontext = context_course::instance($cm->course);

        $generator  = testing_util::get_data_generator();
        $qgenerator = $generator->get_plugin_generator('core_question');
        $cat = $qgenerator->create_question_category(
            ['contextid' => $coursecontext->id]
        );
        $question = $qgenerator->create_question(
            'stack',
            null,
            ['name' => $questionname, 'category' => $cat->id]
        );

        quiz_add_quiz_question($question->id, $quiz, 1, 1);
        quiz_repaginate_questions($quiz->id, 0);

        return $question;
    }

    /**
     * Return quiz record and course module for the given quiz display name.
     *
     * @param string $quizname Quiz display name.
     * @return array [$quiz, $cm]
     */
    protected function get_quiz_and_cm(string $quizname): array {
        global $DB;
        $quiz = $DB->get_record('quiz', ['name' => $quizname], '*', MUST_EXIST);
        $cm   = get_coursemodule_from_instance('quiz', $quiz->id, 0, false, MUST_EXIST);
        return [$quiz, $cm];
    }

    /**
     * Navigate to a quiz view page and click the attempt-start button if present.
     *
     * @param string $quizname Quiz display name.
     */
    protected function start_quiz_attempt(string $quizname): void {
        [$quiz, $cm] = $this->get_quiz_and_cm($quizname);
        $url = new moodle_url('/mod/quiz/view.php', ['id' => $cm->id]);
        $this->getSession()->visit($url->out(false));
        $this->getSession()->wait(2000, "document.readyState === 'complete'");
        $btn = $this->getSession()->getPage()->find(
            'css',
            'button[type="submit"], input[type="submit"]'
        );
        if ($btn) {
            $btn->click();
            $this->getSession()->wait(3000, "document.readyState === 'complete'");
        }
    }

    // Data-setup steps.
    /**
     * Create a minimal STACK question and add it to the given quiz.
     *
     * @Given a STACK question exists in quiz :quizname
     * @param string $quizname Quiz display name.
     */
    public function a_stack_question_exists_in_quiz(string $quizname): void {
        $this->create_stack_question_in_quiz($quizname);
    }

    /**
     * Create a named STACK question and add it to the given quiz.
     *
     * @Given a STACK question :questionname exists in quiz :quizname
     * @param string $questionname Question display name.
     * @param string $quizname     Quiz display name.
     */
    public function a_named_stack_question_exists_in_quiz(
        string $questionname,
        string $quizname
    ): void {
        $this->create_stack_question_in_quiz($quizname, $questionname);
    }

    /**
     * Create a quiz with a STACK question in the given course.
     *
     * @Given a STACK quiz :quizname with algebraic input exists in :courseshortname
     * @param string $quizname        Display name for the quiz to create.
     * @param string $courseshortname Short name of an existing course.
     */
    public function a_stack_quiz_with_algebraic_input_exists(
        string $quizname,
        string $courseshortname
    ): void {
        global $DB;
        $course    = $DB->get_record('course', ['shortname' => $courseshortname], '*', MUST_EXIST);
        $generator = testing_util::get_data_generator();
        $generator->create_module('quiz', ['course' => $course->id, 'name' => $quizname]);
        $this->create_stack_question_in_quiz($quizname);
    }

    /**
     * Set the plugin enabled mode in Moodle config.
     *
     * @Given the plugin enabled mode is set to :mode
     * @param string $mode Numeric mode string: "0", "1", "2", or "3".
     */
    public function the_plugin_enabled_mode_is_set_to(string $mode): void {
        set_config('enabled', $mode, 'local_stackmatheditor');
        purge_all_caches();
    }

    /**
     * Record that a specific toolbar group should be enabled at quiz level.
     *
     * @Given the quiz-level config has :groupname enabled
     * @param string $groupname Display name of the toolbar group.
     */
    public function the_quiz_level_config_has_group_enabled(string $groupname): void {
        $this->getSession()->executeScript(
            "window._sme_test_group = '" . addslashes($groupname) . "';"
        );
    }

    /**
     * Persist a disabled-editor flag for the named STACK question inside a quiz.
     *
     * @Given the STACK question :inputname in :quizname has editor disabled
     * @param string $inputname Question name or input identifier.
     * @param string $quizname  Quiz display name.
     */
    public function the_stack_question_has_editor_disabled(
        string $inputname,
        string $quizname
    ): void {
        global $DB;
        [$quiz, $cm] = $this->get_quiz_and_cm($quizname);
        $existing = $DB->get_record('local_stackmatheditor', ['cmid' => $cm->id]);
        $config = $existing ? json_decode($existing->config, true) : [];
        $config['_enabled'] = false;
        $configjson = json_encode($config);
        if ($existing) {
            $DB->update_record('local_stackmatheditor', (object)[
                'id'           => $existing->id,
                'config'       => $configjson,
                'usermodified' => 2,
                'timemodified' => time(),
            ]);
        } else {
            $DB->insert_record('local_stackmatheditor', (object)[
                'cmid'                => $cm->id,
                'questionbankentryid' => null,
                'config'              => $configjson,
                'usermodified'        => 2,
                'timemodified'        => time(),
            ]);
        }
    }

    /**
     * Start a quiz attempt and populate the first STACK input with the given answer.
     *
     * @Given I have previously answered :answer in the quiz :quizname
     * @param string $answer   Maxima expression to submit.
     * @param string $quizname Quiz display name.
     */
    public function i_have_previously_answered_in_quiz(
        string $answer,
        string $quizname
    ): void {
        $this->start_quiz_attempt($quizname);
        $js = <<<JS
            (function() {
                var inputs = document.querySelectorAll('input[type="text"],input[type="hidden"]');
                for (var i = 0; i < inputs.length; i++) {
                    if (inputs[i].name.match(/q\d+:.*_ans/)) {
                        inputs[i].value = '{$answer}';
                        break;
                    }
                }
            })();
JS;
        $this->getSession()->executeScript($js);
    }

    // Navigation steps.
    /**
     * Navigate to the quiz view page and click the start-attempt button.
     *
     * @When I attempt the quiz :quizname
     * @Given I attempt the quiz :quizname
     * @param string $quizname Quiz display name.
     */
    public function i_attempt_the_quiz(string $quizname): void {
        $this->start_quiz_attempt($quizname);
    }

    /**
     * Navigate to the quiz view page and click the start-attempt button (alternative phrasing).
     *
     * @Given I am attempting the quiz :quizname
     * @param string $quizname Quiz display name.
     */
    public function i_am_attempting_the_quiz(string $quizname): void {
        $this->start_quiz_attempt($quizname);
    }

    /**
     * Select the MathQuill editor option in the quiz navigation jump selector.
     *
     * @When I navigate to the STACK MathQuill quiz configuration
     */
    public function i_navigate_to_quiz_configuration(): void {
        $select = $this->find('css', 'form[action*="jumpto.php"] select[name="jump"]');
        $select->selectOption('STACK MathQuill-Editor einrichten');
        $this->getSession()->wait(3000, "document.readyState === 'complete'");
    }

    /**
     * Click the MathQuill configure icon link adjacent to the named question.
     *
     * @When I click the MathQuill configure icon next to :questionname
     * @param string $questionname Question display name.
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
     * Open the STACK MathQuill quiz configuration page for the named quiz.
     *
     * @Given I am on the STACK MathQuill quiz configuration page for :quizname
     * @param string $quizname Quiz display name.
     */
    public function i_am_on_quiz_config_page(string $quizname): void {
        [$quiz, $cm] = $this->get_quiz_and_cm($quizname);
        $url = new moodle_url('/local/stackmatheditor/configure.php', ['cmid' => $cm->id]);
        $this->getSession()->visit($url->out(false));
        $this->getSession()->wait(2000, "document.readyState === 'complete'");
    }

    /**
     * Open the MathQuill configuration page for a specific question inside a quiz.
     *
     * @Given I am on the MathQuill configuration page for question :questionname in :quizname
     * @param string $questionname Question display name.
     * @param string $quizname     Quiz display name.
     */
    public function i_am_on_mathquill_config_page_for_question(
        string $questionname,
        string $quizname
    ): void {
        global $DB;
        [$quiz, $cm] = $this->get_quiz_and_cm($quizname);
        $question = $DB->get_record('question', ['name' => $questionname], '*', MUST_EXIST);
        $qbe = $DB->get_field(
            'question_versions',
            'questionbankentryid',
            ['questionid' => $question->id],
            MUST_EXIST
        );
        $url = new moodle_url(
            '/local/stackmatheditor/configure.php',
            ['cmid' => $cm->id, 'qbeid' => $qbe]
        );
        $this->getSession()->visit($url->out(false));
        $this->getSession()->wait(2000, "document.readyState === 'complete'");
    }

    /**
     * Click the next-question navigation link and then navigate back.
     *
     * @When I navigate to the next question and back
     */
    public function i_navigate_to_next_question_and_back(): void {
        $next = $this->getSession()->getPage()->find(
            'css',
            '[data-action="next-page"], .mod_quiz-next-nav'
        );
        if ($next) {
            $next->click();
            $this->getSession()->wait(2000, "document.readyState === 'complete'");
            $this->getSession()->back();
            $this->getSession()->wait(2000, "document.readyState === 'complete'");
        }
    }

    /**
     * Return to the quiz attempt page by navigating back in browser history.
     *
     * @When I return to the quiz attempt page
     */
    public function i_return_to_quiz_attempt_page(): void {
        $this->getSession()->back();
        $this->getSession()->wait(2000, "document.readyState === 'complete'");
    }

    // Toolbar-group interaction steps.
    /**
     * Deselect a named toolbar group from the multiselect on the config page.
     *
     * @When I deselect the :groupname toolbar group
     * @param string $groupname Display name of the group (e.g. "Trigonometrie").
     */
    public function i_deselect_toolbar_group(string $groupname): void {
        $js = <<<JS
            (function() {
                var sel = document.getElementById('id_sme_groups');
                if (!sel) { return false; }
                for (var i = 0; i < sel.options.length; i++) {
                    if (sel.options[i].text === '{$groupname}') {
                        sel.options[i].selected = false;
                        return true;
                    }
                }
                return false;
            })()
JS;
        $result = $this->getSession()->evaluateScript($js);
        if (!$result) {
            throw new ExpectationException(
                "Toolbar group '$groupname' not found in the multiselect.",
                $this->getSession()
            );
        }
    }

    /**
     * Click the toolbar button identified by its title attribute.
     *
     * @When I click the toolbar button with title :title
     * @param string $title Value of the button's title attribute.
     */
    public function i_click_toolbar_button_with_title(string $title): void {
        $escaped = addslashes($title);
        $btn = $this->find(
            'css',
            'button[title="' . $escaped . '"], .sme-tb-btn[title="' . $escaped . '"]'
        );
        if (!$btn) {
            throw new ExpectationException(
                "Toolbar button with title '$title' not found.",
                $this->getSession()
            );
        }
        $btn->click();
        $this->getSession()->wait(500, "document.readyState === 'complete'");
    }

    // Assertion steps.
    /**
     * Assert that a specific toolbar group is deselected in the multiselect.
     *
     * @Then the :groupname toolbar group should be deselected
     * @param string $groupname Display name of the group.
     */
    public function the_toolbar_group_should_be_deselected(string $groupname): void {
        $js = <<<JS
            (function() {
                var sel = document.getElementById('id_sme_groups');
                if (!sel) { return null; }
                for (var i = 0; i < sel.options.length; i++) {
                    if (sel.options[i].text === '{$groupname}') {
                        return sel.options[i].selected;
                    }
                }
                return null;
            })()
JS;
        $selected = $this->getSession()->evaluateScript($js);
        if ($selected === null) {
            throw new ExpectationException(
                "Toolbar group '$groupname' not found in multiselect.",
                $this->getSession()
            );
        }
        if ($selected) {
            throw new ExpectationException(
                "Toolbar group '$groupname' is selected but should be deselected.",
                $this->getSession()
            );
        }
    }

    /**
     * Assert that a question-level config record exists for the named question.
     *
     * @Then the question-level config for :questionname should override the quiz default
     * @param string $questionname Question display name.
     */
    public function the_question_level_config_should_override_quiz_default(
        string $questionname
    ): void {
        global $DB;
        $question = $DB->get_record('question', ['name' => $questionname], '*', MUST_EXIST);
        $qbe = $DB->get_field(
            'question_versions',
            'questionbankentryid',
            ['questionid' => $question->id]
        );
        $record = $DB->get_record('local_stackmatheditor', ['questionbankentryid' => $qbe]);
        if (!$record) {
            throw new ExpectationException(
                "No question-level config found for '$questionname'.",
                $this->getSession()
            );
        }
    }

    /**
     * Assert that the MathQuill editor wrapper is present for the named input.
     *
     * @Given the MathQuill editor is visible for :inputname
     * @Then the MathQuill editor is visible for :inputname
     * @param string $inputname Name attribute of the hidden input element.
     */
    public function the_mathquill_editor_is_visible_for(string $inputname): void {
        $js = <<<JS
            (function() {
                var input = document.querySelector('input[name="{$inputname}"]');
                if (!input) { return false; }
                var wrap = input.previousElementSibling;
                return wrap && wrap.classList.contains('sme-input-wrap');
            })()
JS;
        if (!$this->getSession()->evaluateScript($js)) {
            throw new ExpectationException(
                "MathQuill editor wrapper not found for input '$inputname'.",
                $this->getSession()
            );
        }
    }

    /**
     * Assert that all elements with a STACK input type attribute are hidden.
     *
     * @Then I should not see the original STACK input field
     */
    public function i_should_not_see_original_stack_input(): void {
        $js = <<<JS
            (function() {
                var inputs = document.querySelectorAll('input[data-stack-input-type]');
                for (var i = 0; i < inputs.length; i++) {
                    var style = window.getComputedStyle(inputs[i]);
                    if (style.display !== 'none' && style.visibility !== 'hidden') {
                        return false;
                    }
                }
                return true;
            })()
JS;
        if (!$this->getSession()->evaluateScript($js)) {
            throw new ExpectationException(
                'Original STACK input field is still visible; expected it to be hidden.',
                $this->getSession()
            );
        }
    }

    /**
     * Assert that the Maxima value of the hidden input contains the given LaTeX substring.
     *
     * @Then the MathQuill field for :inputname should contain LaTeX containing :latex
     * @param string $inputname Name attribute of the hidden input element.
     * @param string $latex     Expected LaTeX substring.
     */
    public function the_mathquill_field_should_contain_latex(
        string $inputname,
        string $latex
    ): void {
        $js = <<<JS
            (function() {
                var input = document.querySelector('input[name="{$inputname}"]');
                return input ? input.value : '';
            })()
JS;
        $value = $this->getSession()->evaluateScript($js);
        if (strpos($value, $latex) === false) {
            throw new ExpectationException(
                "MathQuill field for '$inputname' does not contain '$latex'. Value: '$value'.",
                $this->getSession()
            );
        }
    }

    /**
     * Assert that an element with the given CSS class exists on the page.
     *
     * @Then I should see the class :cssclass
     * @param string $cssclass CSS class name without leading dot.
     */
    public function i_should_see_the_class(string $cssclass): void {
        $el = $this->find('css', '.' . $cssclass);
        if (!$el) {
            throw new ExpectationException(
                "Element with class '$cssclass' not found.",
                $this->getSession()
            );
        }
    }

    /**
     * Assert that no element with the given CSS class exists on the page.
     *
     * @Then I should not see the class :cssclass
     * @param string $cssclass CSS class name without leading dot.
     */
    public function i_should_not_see_the_class(string $cssclass): void {
        $elements = $this->getSession()->getPage()->findAll('css', '.' . $cssclass);
        if (!empty($elements)) {
            throw new ExpectationException(
                "Element with class '$cssclass' should not be present.",
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
            throw new ExpectationException('Quiz navigation select not found.', $this->getSession());
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
     * Assert that a checkbox element with the given id exists on the page.
     *
     * @Then I should see a checkbox with id :id
     * @param string $id Element id attribute value.
     */
    public function i_should_see_checkbox_with_id(string $id): void {
        $el = $this->find('css', '#' . $id . '[type="checkbox"]');
        if (!$el) {
            throw new ExpectationException("Checkbox '#$id' not found.", $this->getSession());
        }
    }

    /**
     * Assert that no checkbox element with the given id exists on the page.
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
     * Assert that the checkbox with the given id is in the checked state.
     *
     * @Then the checkbox :id should be checked
     * @param string $id Element id attribute value.
     */
    public function the_checkbox_should_be_checked(string $id): void {
        $el = $this->find('css', '#' . $id);
        if (!$el || !$el->isChecked()) {
            throw new ExpectationException("Checkbox '#$id' should be checked.", $this->getSession());
        }
    }

    /**
     * Assert that the checkbox with the given id is in the unchecked state.
     *
     * @Then the checkbox :id should be unchecked
     * @param string $id Element id attribute value.
     */
    public function the_checkbox_should_be_unchecked(string $id): void {
        $el = $this->find('css', '#' . $id);
        if (!$el || $el->isChecked()) {
            throw new ExpectationException("Checkbox '#$id' should be unchecked.", $this->getSession());
        }
    }

    /**
     * Assert that the MathQuill field for the named input is not empty.
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
        if (!$this->getSession()->evaluateScript($js)) {
            throw new ExpectationException(
                "MathQuill field for '$inputname' is empty or not found.",
                $this->getSession()
            );
        }
    }

    /**
     * Assert that a hidden input element contains the expected value.
     *
     * @Then the hidden input :inputname should contain :value
     * @param string $inputname Name attribute.
     * @param string $value     Expected value.
     */
    public function the_hidden_input_should_contain(string $inputname, string $value): void {
        $js     = "return document.querySelector('input[name=\"{$inputname}\"]').value;";
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
        $js     = "return document.querySelector('input[name=\"{$inputname}\"]').value;";
        $actual = $this->getSession()->evaluateScript($js);
        if (empty($actual)) {
            throw new ExpectationException(
                "Input '$inputname' is empty; expected a Maxima expression.",
                $this->getSession()
            );
        }
    }

    /**
     * Type a sequence of characters into the MathQuill textarea for the named input.
     *
     * @When I type :text into the MathQuill field for :inputname
     * @param string $text      LaTeX-style shorthand to type (e.g. "x^2").
     * @param string $inputname Name attribute of the corresponding hidden input.
     */
    public function i_type_into_mathquill_field(string $text, string $inputname): void {
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
        foreach (str_split($text) as $char) {
            $this->getSession()->getDriver()->keyDown('//body', $char);
            $this->getSession()->getDriver()->keyUp('//body', $char);
        }
    }
}

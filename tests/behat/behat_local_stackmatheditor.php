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

    // Data-setup steps.

    /**
     * Create a quiz containing a minimal STACK algebraic-input question.
     *
     * The quiz is created in the specified course. A STACK question with one
     * algebraic input named 'ans1' is generated and added as slot 1.
     *
     * @Given a STACK quiz :quizname with algebraic input exists in :shortname
     * @param string $quizname  Name of the quiz to create.
     * @param string $shortname Course shortname.
     */
    public function a_stack_quiz_with_algebraic_input_exists(
        string $quizname,
        string $shortname
    ): void {
        global $DB;

        $course = $DB->get_record('course', ['shortname' => $shortname], '*', MUST_EXIST);
        $qcat   = question_get_default_category(\context_course::instance($course->id)->id, true);

        // Create a minimal STACK algebraic-input question.
        $qdata = $this->make_stack_algebraic_question_data('Test STACK question', $qcat->id);
        $question = question_bank::get_qtype('stack')->save_question(
            (object) ['id' => 0, 'qtype' => 'stack', 'category' => $qcat->id],
            $qdata
        );

        // Create the quiz activity.
        $generator = $this->get_data_generator();
        $quiz = $generator->create_module('quiz', [
            'course'     => $course->id,
            'name'       => $quizname,
            'preferredbehaviour' => 'adaptive',
        ]);

        // Add the question to the quiz.
        quiz_add_quiz_question($question->id, $quiz, 0, 1);
        \mod_quiz\quiz_settings::create($quiz->id)
            ->get_grade_calculator()
            ->recompute_quiz_sumgrades();
    }

    /**
     * Create a minimal STACK question in an existing quiz (unnamed).
     *
     * @Given a STACK question exists in quiz :quizname
     * @param string $quizname Quiz name.
     */
    public function a_stack_question_exists_in_quiz(string $quizname): void {
        $this->a_named_stack_question_exists_in_quiz('Test STACK question', $quizname);
    }

    /**
     * Create a minimal STACK question with a specific name in an existing quiz.
     *
     * @Given a STACK question :questionname exists in quiz :quizname
     * @param string $questionname Question name.
     * @param string $quizname     Quiz name.
     */
    public function a_named_stack_question_exists_in_quiz(
        string $questionname,
        string $quizname
    ): void {
        global $DB;

        $quiz = $DB->get_record('quiz', ['name' => $quizname], '*', MUST_EXIST);
        $cm   = get_coursemodule_from_instance('quiz', $quiz->id, 0, false, MUST_EXIST);
        $qcat = question_get_default_category(\context_module::instance($cm->id)->id, true);

        $qdata    = $this->make_stack_algebraic_question_data($questionname, $qcat->id);
        $question = question_bank::get_qtype('stack')->save_question(
            (object) ['id' => 0, 'qtype' => 'stack', 'category' => $qcat->id],
            $qdata
        );

        quiz_add_quiz_question($question->id, $quiz, 0, 1);
        \mod_quiz\quiz_settings::create($quiz->id)
            ->get_grade_calculator()
            ->recompute_quiz_sumgrades();
    }

    // Navigation and interaction steps.

    /**
     * Start a new attempt on a quiz as the current user (When variant).
     *
     * @When I attempt the quiz :quizname
     * @param string $quizname Quiz name.
     */
    public function i_attempt_the_quiz(string $quizname): void {
        $this->i_am_attempting_the_quiz($quizname);
    }

    /**
     * Start a new attempt on a quiz as the current user (Given variant).
     *
     * @Given I am attempting the quiz :quizname
     * @param string $quizname Quiz name.
     */
    public function i_am_attempting_the_quiz(string $quizname): void {
        global $DB;

        $quiz = $DB->get_record('quiz', ['name' => $quizname], '*', MUST_EXIST);
        $cm   = get_coursemodule_from_instance('quiz', $quiz->id, 0, false, MUST_EXIST);

        // Navigate to quiz view page and start attempt.
        $url = new \moodle_url('/mod/quiz/view.php', ['id' => $cm->id]);
        $this->getSession()->visit($this->locate_path($url->out_as_local_url(false)));
        $this->find_button('Quizversuch starten')->press();
        // If attempt already in progress, the button may not appear; navigate directly.
        $this->getSession()->wait(3000, 'document.readyState === "complete"');
    }

    /**
     * Submit an answer to the first question and leave the attempt open.
     *
     * @Given I have previously answered :answer in the quiz :quizname
     * @param string $answer   Maxima-format answer string.
     * @param string $quizname Quiz name.
     */
    public function i_have_previously_answered_in_quiz(
        string $answer,
        string $quizname
    ): void {
        global $DB;

        $quiz = $DB->get_record('quiz', ['name' => $quizname], '*', MUST_EXIST);
        $cm   = get_coursemodule_from_instance('quiz', $quiz->id, 0, false, MUST_EXIST);

        $url = new \moodle_url('/mod/quiz/view.php', ['id' => $cm->id]);
        $this->getSession()->visit($this->locate_path($url->out_as_local_url(false)));

        // Start or resume attempt.
        try {
            $this->find_button('Quizversuch starten')->press();
        } catch (\Exception $e) {
            $this->find_button('Versuch fortsetzen')->press();
        }

        $this->getSession()->wait(3000, 'document.readyState === "complete"');

        // Inject the answer directly into the hidden input.
        $js = <<<JS
            (function() {
                var inputs = document.querySelectorAll('input[type="hidden"][name$="ans1"]');
                if (!inputs.length) {
                    inputs = document.querySelectorAll('input[name*="ans1"]');
                }
                inputs.forEach(function(el) { el.value = '{$answer}'; });
            })();
JS;
        $this->getSession()->executeScript($js);

        // Save without submitting so the attempt stays open.
        try {
            $this->find_button('Speichern, aber noch nicht abschicken')->press();
        } catch (\Exception $e) {
            // Already on the attempt page without a save button.
            unset($e);
        }
        $this->getSession()->wait(2000, 'document.readyState === "complete"');
    }

    /**
     * Navigate to the next question page and back to question 1.
     *
     * @When I navigate to the next question and back
     */
    public function i_navigate_to_next_question_and_back(): void {
        $this->find_button('Nächste Seite')->press();
        $this->getSession()->wait(2000, 'document.readyState === "complete"');
        $this->find_button('Vorherige Seite')->press();
        $this->getSession()->wait(2000, 'document.readyState === "complete"');
    }

    /**
     * Return to the quiz attempt page (reload current URL).
     *
     * @When I return to the quiz attempt page
     */
    public function i_return_to_quiz_attempt_page(): void {
        $this->getSession()->reload();
        $this->getSession()->wait(3000, 'document.readyState === "complete"');
    }

    // Assertion steps.

    /**
     * Assert the original (non-MathQuill) STACK input field is hidden.
     *
     * The editor wraps the STACK input and hides it. After injection the
     * wrapper class 'sme-mq-container' is present and the original input
     * carries a hidden attribute or is inside a visually-hidden wrapper.
     *
     * @Then I should not see the original STACK input field
     */
    public function i_should_not_see_original_stack_input(): void {
        // The original input is hidden by the editor. Check it has the
        // CSS class that the editor adds to mark it as replaced.
        $hidden = $this->getSession()->evaluateScript(
            "return !!(document.querySelector('.sme-original-hidden')" .
            "       || document.querySelector('.sme-mq-container'));"
        );
        if (!$hidden) {
            throw new ExpectationException(
                'Original STACK input is still visible (MathQuill editor not injected)',
                $this->getSession()
            );
        }
    }

    /**
     * Assert the MathQuill editor is visible for the given input name.
     *
     * @Given the MathQuill editor is visible for :inputname
     * @param string $inputname STACK input name, e.g. "ans1".
     */
    public function the_mathquill_editor_is_visible_for(string $inputname): void {
        $this->getSession()->wait(
            5000,
            "document.querySelector('.sme-mq-container[data-input=\"{$inputname}\"]"
            . ", .sme-mq-container') !== null"
        );
        $visible = $this->getSession()->evaluateScript(
            "return !!(document.querySelector('.sme-mq-container'));"
        );
        if (!$visible) {
            throw new ExpectationException(
                "MathQuill editor not visible for input '$inputname'",
                $this->getSession()
            );
        }
    }

    /**
     * Click a toolbar button identified by its title attribute.
     *
     * @When I click the toolbar button with title :title
     * @param string $title The title attribute of the button to click.
     */
    public function i_click_toolbar_button_with_title(string $title): void {
        $title   = addslashes($title);
        $clicked = $this->getSession()->evaluateScript(
            "var btn = document.querySelector('.sme-tb-btn[title=\"{$title}\"]');" .
            "if (btn) { btn.click(); return true; } return false;"
        );
        if (!$clicked) {
            throw new ExpectationException(
                "Toolbar button with title '$title' not found",
                $this->getSession()
            );
        }
        $this->getSession()->wait(1000, 'true');
    }

    /**
     * Assert the MathQuill field contains LaTeX that includes a given fragment.
     *
     * @Then the MathQuill field for :inputname should contain LaTeX containing :fragment
     * @param string $inputname STACK input name, e.g. "ans1".
     * @param string $fragment  LaTeX fragment that should appear in the content.
     */
    public function the_mathquill_field_should_contain_latex(
        string $inputname,
        string $fragment
    ): void {
        $latex = $this->getSession()->evaluateScript(
            "(function() {" .
            "  var c = document.querySelector('.sme-mq-container');" .
            "  if (!c) { return ''; }" .
            "  var mq = c.__mq;" .
            "  return mq ? mq.latex() : c.getAttribute('data-latex') || '';" .
            "})()"
        );
        if (strpos((string) $latex, $fragment) === false) {
            throw new ExpectationException(
                "MathQuill field for '$inputname' contains '$latex',"
                . " expected to contain '$fragment'",
                $this->getSession()
            );
        }
    }

    // Config-write steps.

    /**
     * Disable the editor at question-slot level for a given input/quiz pair.
     *
     * @Given the STACK question :inputname in :quizname has editor disabled
     * @param string $inputname STACK input name (ignored, first question used).
     * @param string $quizname  Quiz name.
     */
    public function the_stack_question_has_editor_disabled(
        string $inputname,
        string $quizname
    ): void {
        global $DB;

        $quiz  = $DB->get_record('quiz', ['name' => $quizname], '*', MUST_EXIST);
        $cm    = get_coursemodule_from_instance('quiz', $quiz->id, 0, false, MUST_EXIST);
        $qbeid = $this->get_first_stack_qbeid($quiz->id);

        \local_stackmatheditor\config_manager::save_config(
            (int) $cm->id,
            (int) $qbeid,
            ['_enabled' => false]
        );
    }

    /**
     * Enable a toolbar group at the quiz-level config.
     *
     * @Given the quiz-level config has :groupname enabled
     * @param string $groupname Toolbar group name, e.g. "Trigonometrie".
     */
    public function the_quiz_level_config_has_group_enabled(string $groupname): void {
        global $DB;

        // Resolve quiz from current URL.
        $cmid = $this->resolve_current_quiz_cmid();

        // Map display name to group key.
        $key  = $this->resolve_group_key_from_label($groupname);

        \local_stackmatheditor\config_manager::save_quiz_default(
            $cmid,
            [$key => true]
        );
    }

    /**
     * Navigate to the question-level configure.php page.
     *
     * @When I am on the MathQuill configuration page for question :questionname in :quizname
     * @param string $questionname Question name.
     * @param string $quizname     Quiz name.
     */
    public function i_am_on_mathquill_config_page_for_question(
        string $questionname,
        string $quizname
    ): void {
        global $DB;

        $quiz  = $DB->get_record('quiz', ['name' => $quizname], '*', MUST_EXIST);
        $cm    = get_coursemodule_from_instance('quiz', $quiz->id, 0, false, MUST_EXIST);
        $qbeid = $this->get_qbeid_by_name($quiz->id, $questionname);

        $url = new \moodle_url('/local/stackmatheditor/configure.php', [
            'cmid'  => $cm->id,
            'qbeid' => $qbeid,
        ]);
        $this->getSession()->visit($this->locate_path($url->out_as_local_url(false)));
        $this->getSession()->wait(3000, 'document.readyState === "complete"');
    }

    /**
     * Assert that the question-level config overrides the quiz default for
     * the named question.
     *
     * @Then the question-level config for :questionname should override the quiz default
     * @param string $questionname Question name.
     */
    public function the_question_level_config_should_override_quiz_default(
        string $questionname
    ): void {
        global $DB;

        // Resolve quiz from current URL.
        $cmid  = $this->resolve_current_quiz_cmid();
        $quiz  = $DB->get_record(
            'quiz',
            ['id' => $DB->get_field('course_modules', 'instance', ['id' => $cmid])],
            '*',
            MUST_EXIST
        );
        $qbeid = $this->get_qbeid_by_name($quiz->id, $questionname);

        $config = \local_stackmatheditor\config_manager::get_config($cmid, $qbeid);

        // A question-level record exists when there is at least one key that
        // differs from the raw quiz default (the merged config contains slot data).
        $slotrecord = $DB->get_record(
            'local_stackmatheditor',
            ['cmid' => $cmid, 'questionbankentryid' => $qbeid]
        );
        if (!$slotrecord) {
            throw new ExpectationException(
                "No slot-level config record found for question '$questionname'",
                $this->getSession()
            );
        }
    }

    /**
     * Deselect a toolbar group checkbox by its visible label.
     *
     * @When I deselect the :groupname toolbar group
     * @param string $groupname Visible group label, e.g. "Trigonometrie".
     */
    public function i_deselect_toolbar_group(string $groupname): void {
        $key = $this->resolve_group_key_from_label($groupname);
        $this->getSession()->executeScript(
            "var el = document.querySelector(" .
            "  'input[type=checkbox][name*=\"{$key}\"]," .
            "   input[type=checkbox][id*=\"{$key}\"]'" .
            "); if (el && el.checked) { el.click(); }"
        );
    }

    /**
     * Assert a toolbar group checkbox is unchecked.
     *
     * @Then the :groupname toolbar group should be deselected
     * @param string $groupname Visible group label, e.g. "Trigonometrie".
     */
    public function the_toolbar_group_should_be_deselected(string $groupname): void {
        $key     = $this->resolve_group_key_from_label($groupname);
        $checked = $this->getSession()->evaluateScript(
            "var el = document.querySelector(" .
            "  'input[type=checkbox][name*=\"{$key}\"]," .
            "   input[type=checkbox][id*=\"{$key}\"]'" .
            "); return el ? el.checked : null;"
        );
        if ($checked !== false) {
            throw new ExpectationException(
                "Toolbar group '$groupname' (key: $key) should be deselected",
                $this->getSession()
            );
        }
    }

    // Private helpers.

    /**
     * Build the minimal qtype_stack question data object for a single algebraic input.
     *
     * @param string $name       Question name.
     * @param int    $categoryid Question category ID.
     * @return object            Data suitable for question_bank::get_qtype('stack')->save_question().
     */
    private function make_stack_algebraic_question_data(string $name, int $categoryid): object {
        return (object) [
            'category'          => $categoryid,
            'name'              => $name,
            'questiontext'      => ['text' => '<p>Enter [[input:ans1]]</p><p>[[validation:ans1]]</p>', 'format' => FORMAT_HTML],
            'questiontextformat' => FORMAT_HTML,
            'generalfeedback'   => ['text' => '', 'format' => FORMAT_HTML],
            'defaultmark'       => 1.0,
            'penalty'           => 0.1,
            'hidden'            => 0,
            'questionvariables' => '',
            'questionnote'      => ['text' => '{@ans1@}', 'format' => FORMAT_HTML],
            'questiondescription' => ['text' => '', 'format' => FORMAT_HTML],
            'specificfeedback'  => ['text' => '[[feedback:prt1]]', 'format' => FORMAT_HTML],
            'markmode'          => \qtype_stack\question_definition::MARK_MODE_PENALTY,
            'variantsselectionseed' => '',
            'options'           => (object) [
                'decimals'          => '.',
                'scientificnotation' => '*10',
                'multiplicationsign' => 'dot',
                'complexno'          => 'i',
                'inversetrig'        => 'cos-1',
                'logicsymbol'        => 'lang',
                'matrixparens'       => '[',
                'simplify'           => 1,
                'assumepositive'     => 0,
                'assumereal'         => 0,
                'sqrtsign'           => 1,
                'floatprecision'     => 5,
                'usecontextsession'  => 1,
                'displayoptions'     => '',
            ],
            'inputs'            => [
                'ans1' => (object) [
                    'name'                => 'ans1',
                    'type'                => 'algebraic',
                    'tans'                => 'x^2',
                    'boxsize'             => 15,
                    'strictsyntax'        => 1,
                    'insertstars'         => 0,
                    'syntaxhint'          => '',
                    'syntaxattribute'     => 0,
                    'forbidwords'         => '',
                    'allowwords'          => '',
                    'forbidfloat'         => 1,
                    'requirelowestterms'  => 0,
                    'checkanswertype'     => 0,
                    'mustverify'          => 1,
                    'showvalidation'      => 1,
                    'options'             => '',
                ],
            ],
            'prts'              => [
                'prt1' => (object) [
                    'name'              => 'prt1',
                    'value'             => 1.0,
                    'autosimplify'      => 1,
                    'feedbackstyle'     => 1,
                    'feedbackvariables' => '',
                    'firstnodename'     => '0',
                    'nodes'             => [
                        '0' => (object) [
                            'nodename'         => '0',
                            'description'      => '',
                            'answertest'       => 'AlgEquiv',
                            'sans'             => 'ans1',
                            'tans'             => 'x^2',
                            'testoptions'      => '',
                            'quiet'            => 0,
                            'truescoremode'    => '=',
                            'truescore'        => 1.0,
                            'truepenalty'      => null,
                            'truenextnode'     => '-1',
                            'trueanswernote'   => 'prt1-1-T',
                            'truefeedback'     => ['text' => '<p>Correct.</p>', 'format' => FORMAT_HTML],
                            'falsescoremode'   => '=',
                            'falsescore'       => 0.0,
                            'falsepenalty'     => null,
                            'falsenextnode'    => '-1',
                            'falseanswernote'  => 'prt1-1-F',
                            'falsefeedback'    => ['text' => '<p>Incorrect.</p>', 'format' => FORMAT_HTML],
                        ],
                    ],
                ],
            ],
        ];
    }

    /**
     * Return the question bank entry ID of the first STACK question in a quiz.
     *
     * @param  int $quizid Quiz instance ID.
     * @return int Question bank entry ID.
     */
    private function get_first_stack_qbeid(int $quizid): int {
        global $DB;

        $sql = 'SELECT qbe.id
                  FROM {quiz_slots} qs
                  JOIN {question_references} qr
                       ON qr.component = \'mod_quiz\'
                      AND qr.questionarea = \'slot\'
                      AND qr.itemid = qs.id
                  JOIN {question_bank_entries} qbe ON qbe.id = qr.questionbankentryid
                  JOIN {question_versions} qv ON qv.questionbankentryid = qbe.id
                  JOIN {question} q ON q.id = qv.questionid
                 WHERE qs.quizid = :quizid AND q.qtype = \'stack\'
              ORDER BY qs.slot ASC
                 LIMIT 1';

        $id = $DB->get_field_sql($sql, ['quizid' => $quizid]);
        if (!$id) {
            throw new \coding_exception("No STACK question found in quiz $quizid");
        }
        return (int) $id;
    }

    /**
     * Return the question bank entry ID for a named question in a quiz.
     *
     * @param  int    $quizid       Quiz instance ID.
     * @param  string $questionname Question name.
     * @return int Question bank entry ID.
     */
    private function get_qbeid_by_name(int $quizid, string $questionname): int {
        global $DB;

        $sql = 'SELECT qbe.id
                  FROM {quiz_slots} qs
                  JOIN {question_references} qr
                       ON qr.component = \'mod_quiz\'
                      AND qr.questionarea = \'slot\'
                      AND qr.itemid = qs.id
                  JOIN {question_bank_entries} qbe ON qbe.id = qr.questionbankentryid
                  JOIN {question_versions} qv ON qv.questionbankentryid = qbe.id
                  JOIN {question} q ON q.id = qv.questionid
                 WHERE qs.quizid = :quizid AND q.name = :name
              ORDER BY qs.slot ASC
                 LIMIT 1';

        $id = $DB->get_field_sql($sql, ['quizid' => $quizid, 'name' => $questionname]);
        if (!$id) {
            throw new \coding_exception("Question '$questionname' not found in quiz $quizid");
        }
        return (int) $id;
    }

    /**
     * Resolve the cmid from the current page URL.
     *
     * @return int Course-module ID.
     */
    private function resolve_current_quiz_cmid(): int {
        $url = $this->getSession()->getCurrentUrl();
        if (preg_match('/[?&](?:id|cmid)=(\d+)/', $url, $m)) {
            return (int) $m[1];
        }
        throw new ExpectationException(
            'Cannot determine cmid from URL: ' . $url,
            $this->getSession()
        );
    }

    /**
     * Map a visible toolbar-group label to its internal key.
     *
     * The configure page uses the label returned by definitions::get_element_groups()
     * for display. This helper does a reverse lookup. Falls back to the input
     * string as-is when no match is found (allows passing the key directly).
     *
     * @param  string $label Visible label, e.g. "Trigonometrie".
     * @return string Group key, e.g. "trigonometry".
     */
    private function resolve_group_key_from_label(string $label): string {
        $groups = \local_stackmatheditor\definitions::get_element_groups();
        foreach ($groups as $key => $group) {
            if (isset($group['label']) && $group['label'] === $label) {
                return $key;
            }
        }
        // Label not matched — assume the caller passed the key directly.
        return $label;
    }
}

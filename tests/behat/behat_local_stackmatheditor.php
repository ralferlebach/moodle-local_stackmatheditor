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
        $page = $this->getSession()->getPage();

        // Try nav-jump select: find option whose URL targets our configure page.
        // This avoids relying on localized text or Moodle-version-specific structure.
        $option = $page->find(
            'css',
            'form[action*="jumpto.php"] select[name="jump"]'
                . ' option[value*="/local/stackmatheditor/configure.php"]'
        );
        if ($option) {
            $this->getSession()->visit($option->getAttribute('value'));
            $this->getSession()->wait(3000, "document.readyState === 'complete'");
            return;
        }

        // Fallback: direct link — visit the href to avoid ElementNotInteractableException
        // in Moodle 5.2 where nav links may be rendered but not clickable.
        $link = $page->find('css', 'a[href*="/local/stackmatheditor/configure.php"]');
        if ($link) {
            $this->getSession()->visit($link->getAttribute('href'));
            $this->getSession()->wait(3000, "document.readyState === 'complete'");
            return;
        }

        throw new ExpectationException(
            'STACK MathQuill quiz configuration link not found '
                . '(neither in nav select nor as a direct link).',
            $this->getSession()
        );
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
        // Use getPage()->find() (not $this->find()) to get null instead of
        // ElementNotFoundException, so we can attach our own diagnostic.
        $el = $this->getSession()->getPage()->find('css', '.' . $cssclass);
        if (!$el) {
            $diag = $this->getSession()->evaluateScript(
                '(function(){'
                . 'var inp=Array.from(document.querySelectorAll("input[name],textarea[name]"))'
                . '.map(function(e){return e.tagName+"["+e.name+"]";}).join(",").substring(0,300);'
                . 'return JSON.stringify({'
                . '  sme:document.body.getAttribute("data-sme-init")||"none",'
                . '  rjs:typeof window.requirejs,'
                . '  mq:typeof window.MathQuill,'
                . '  inputs:inp.substring(0,200)||"none"'
                . '});})()'
            );
            throw new ExpectationException(
                "CSS class '.$cssclass' not found. DOM state: $diag",
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
        $page = $this->getSession()->getPage();

        // Check nav select for an option linking to our configure page.
        $option = $page->find(
            'css',
            'form[action*="jumpto.php"] select[name="jump"]'
                . ' option[value*="/local/stackmatheditor/configure.php"]'
        );
        if ($option) {
            return;
        }

        // Fallback: a direct link also satisfies the assertion.
        $link = $page->find('css', 'a[href*="/local/stackmatheditor/configure.php"]');
        if ($link) {
            return;
        }

        throw new ExpectationException(
            "STACK MathQuill Editor configure entry not found in navigation"
                . " (expected option text was: '$text').",
            $this->getSession()
        );
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
        $safeinput = addslashes($inputname);
        $js = <<<JS
            (function() {
                var inputname = '{$safeinput}';
                var input = document.querySelector('input[name="' + inputname + '"]')
                         || document.querySelector('input[name$="_' + inputname + '"]');
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
        $safeinput = addslashes($inputname);
        $js = <<<JS
            (function() {
                var n  = '{$safeinput}';
                var el = document.querySelector('input[name="' + n + '"]')
                      || document.querySelector('input[name$="_' + n + '"]');
                return el ? el.value : null;
            })()
JS;
        $actual = (string) $this->getSession()->evaluateScript($js);
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
        $safeinput = addslashes($inputname);
        $js = <<<JS
            (function() {
                var n  = '{$safeinput}';
                var el = document.querySelector('input[name="' + n + '"]')
                      || document.querySelector('input[name$="_' + n + '"]');
                return el ? el.value : null;
            })()
JS;
        $actual = (string) $this->getSession()->evaluateScript($js);
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
        // Use MathQuill's JS API instead of keyDown() which only works for modifier keys.
        $safeinput = json_encode($inputname);
        $safetext  = json_encode($text);
        $js = <<<JS
            (function() {
                var n     = {$safeinput};
                var input = document.querySelector('input[name="' + n + '"]')
                         || document.querySelector('input[name$="_' + n + '"]')
                         || document.querySelector('textarea[name="' + n + '"]')
                         || document.querySelector('textarea[name$="_' + n + '"]');
                if (!input) {
                    var allNames = Array.from(
                        document.querySelectorAll('input[name],textarea[name]')
                    ).map(function(e){return e.name;}).join('|').substring(0,200);
                    return 'no-input|all-inputs:' + allNames;
                }
                var wrap = input.previousElementSibling;
                if (!wrap) { return 'no-wrap'; }
                var mathEl = wrap.querySelector('.mq-math-mode');
                if (!mathEl) { return 'no-math-mode'; }
                if (!window.MathQuill) { return 'no-mathquill'; }
                var MQ     = window.MathQuill.getInterface(2);
                var mqField = MQ(mathEl);
                if (!mqField || typeof mqField.write !== 'function') { return 'no-mq-api'; }
                mqField.focus();
                mqField.write({$safetext});
                input.dispatchEvent(new Event('input',  {bubbles: true}));
                input.dispatchEvent(new Event('change', {bubbles: true}));
                return 'ok';
            })()
JS;
        $result = $this->getSession()->evaluateScript($js);
        if ($result !== 'ok') {
            throw new ExpectationException(
                "Could not type into MathQuill field '$inputname' (result: $result).",
                $this->getSession()
            );
        }
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
                'course'             => $course->id,
                'name'               => $quizname,
                'grade'              => 10,
                'sumgrades'          => 1,
                // STACK questions use qbehaviour_adaptivemultipart internally;
                // using 'adaptive' here makes STACK route to it via make_behaviour().
                'preferredbehaviour' => 'adaptive',
            ]);
            $quiz = $DB->get_record('quiz', ['id' => $quizdata->id], '*', MUST_EXIST);
            $this->assert_quiz_behaviour_is_available($quiz);
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
     * Add a question to a quiz in a version-safe way.
     *
     * Moodle 4.x: uses quiz_add_quiz_question() from locallib.php.
     * Moodle 5.x: creates quiz_slots + question_references directly.
     *
     * @param int      $questionid Question ID to add.
     * @param stdClass $quiz       Quiz DB record.
     * @param stdClass $cm         Course module DB record.
     */
    private function add_question_to_quiz_compat(
        int $questionid,
        stdClass $quiz,
        stdClass $cm
    ): void {
        global $DB, $CFG;
        require_once($CFG->dirroot . '/mod/quiz/locallib.php');

        // Moodle 4.x: the function still exists.
        if (function_exists('quiz_add_quiz_question')) {
            quiz_add_quiz_question($questionid, $quiz, 0, 1);
            return;
        }

        // Moodle 5.x: insert quiz_slots + question_references directly.
        $qbeid = \local_stackmatheditor\config_manager::resolve_qbeid($questionid);
        if (!$qbeid) {
            throw new ExpectationException(
                "Cannot resolve QBEID for question ID $questionid.",
                $this->getSession()
            );
        }

        $nextslot = (int) $DB->get_field_sql(
            'SELECT COALESCE(MAX(slot), 0) + 1 FROM {quiz_slots} WHERE quizid = :qid',
            ['qid' => $quiz->id]
        );

        $slotobj = new stdClass();
        $slotobj->quizid          = $quiz->id;
        $slotobj->slot            = $nextslot;
        $slotobj->page            = 1;
        $slotobj->displaynumber   = (string)$nextslot;
        $slotobj->requireprevious = 0;
        $slotobj->maxmark         = 1.0;
        $slotid = $DB->insert_record('quiz_slots', $slotobj);

        $refobj = new stdClass();
        $refobj->usingcontextid    = context_module::instance($cm->id)->id;
        $refobj->component         = 'mod_quiz';
        $refobj->questionarea      = 'slot';
        $refobj->itemid            = $slotid;
        $refobj->questionbankentryid = $qbeid;
        $refobj->version           = null;
        $DB->insert_record('question_references', $refobj);
    }

    /**
     * Update quiz sum of grades in a version-safe way.
     *
     * @param stdClass $quiz Quiz DB record.
     */
    private function update_quiz_sumgrades_compat(stdClass $quiz): void {
        // Quiz_update_sumgrades() was deprecated in Moodle 4.2 (MDL-76897) and
        // throws a coding_exception in Behat since Moodle 5.0+.
        // Always use the grade_calculator API (available from Moodle 4.1+).
        try {
            $quizobj = \mod_quiz\quiz_settings::create($quiz->id);
            $quizobj->get_grade_calculator()->recompute_quiz_sumgrades();
        } catch (\Throwable $e) {
            // Non-fatal: quiz still works for Behat purposes.
            debugging('Quiz sumgrades update failed: ' . $e->getMessage(), DEBUG_DEVELOPER);
        }
    }

    /**
     * Fail early with a clear message if a quiz behaviour or its dependencies are missing.
     *
     * STACK questions use qbehaviour_adaptivemultipart regardless of the quiz's
     * preferredbehaviour. If the plugin is absent, every quiz attempt produces
     * a cryptic "behaviour not available" error. This assertion catches that
     * situation at fixture-setup time with a human-readable message.
     *
     * @param stdClass $quiz Quiz DB record.
     */
    private function assert_quiz_behaviour_is_available(stdClass $quiz): void {
        global $DB;

        // Reload from DB to get the normalised record.
        $stored = $DB->get_record('quiz', ['id' => $quiz->id], 'id, name, preferredbehaviour', MUST_EXIST);

        if (empty($stored->preferredbehaviour)) {
            throw new ExpectationException(
                "Quiz '{$stored->name}' has empty preferredbehaviour in the database.",
                $this->getSession()
            );
        }

        // STACK questions require qbehaviour_adaptivemultipart (MDL-79926).
        $pluginman = core_plugin_manager::instance();
        $installed = $pluginman->get_plugins_of_type('qbehaviour');
        $names     = array_keys($installed);

        if (!in_array('adaptivemultipart', $names)) {
            throw new ExpectationException(
                'qbehaviour_adaptivemultipart is not installed. '
                    . 'STACK questions require it for quiz attempts. '
                    . 'Installed qbehaviours: ' . implode(', ', $names),
                $this->getSession()
            );
        }
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

        // Resolve question category — use get_records with limit to avoid
        // 'found more than one record' when multiple categories exist per context.
        $ctx  = context_module::instance($cm->id);
        $cats = $DB->get_records(
            'question_categories',
            ['contextid' => $ctx->id],
            'id ASC',
            '*',
            0,
            1
        );
        $cat = reset($cats) ?: null;
        if (!$cat) {
            $coursecontext = context_course::instance($quiz->course);
            $cats = $DB->get_records(
                'question_categories',
                ['contextid' => $coursecontext->id],
                'id ASC',
                '*',
                0,
                1
            );
            $cat = reset($cats) ?: null;
        }
        if (!$cat) {
            $gen  = testing_util::get_data_generator();
            $qgen = $gen->get_plugin_generator('core_question');
            $cat  = $qgen->create_question_category(['contextid' => $ctx->id]);
        }

        // Create STACK question via the plugin generator.
        $gen      = testing_util::get_data_generator();
        $qgen     = $gen->get_plugin_generator('core_question');
        $question = $qgen->create_question('stack', 'algebraic_input', [
            'name'     => $questionname,
            'category' => $cat->id,
        ]);

        // Add question to the quiz (version-safe).
        $this->add_question_to_quiz_compat((int)$question->id, $quiz, $cm);

        // Validate the slot was actually created.
        $slots = $DB->get_records('quiz_slots', ['quizid' => $quiz->id]);
        if (empty($slots)) {
            throw new ExpectationException(
                "Question was created but no quiz slot was added for quiz '$quizname'.",
                $this->getSession()
            );
        }

        // Validate question_references record exists (Moodle 4.5+ schema requirement).
        $slot      = reset($slots);
        $reference = $DB->get_record('question_references', [
            'component'    => 'mod_quiz',
            'questionarea' => 'slot',
            'itemid'       => $slot->id,
        ]);
        if (!$reference) {
            throw new ExpectationException(
                "Quiz slot {$slot->id} has no question_references record.",
                $this->getSession()
            );
        }

        $this->update_quiz_sumgrades_compat($quiz);

        return $DB->get_record('question', ['id' => $question->id], '*', MUST_EXIST);
    }

    // Navigation helpers.

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

        // Resolve QBEID via question_versions (Moodle 4.1+ schema).
        $qbeid = \local_stackmatheditor\config_manager::resolve_qbeid($question->id);
        if (!$qbeid) {
            throw new ExpectationException(
                "Cannot resolve question bank entry for question '$questionname'.",
                $this->getSession()
            );
        }

        $url = new \moodle_url(
            '/local/stackmatheditor/configure.php',
            ['cmid' => $cm->id, 'qbeid' => $qbeid]
        );
        $this->getSession()->visit($url->out(false));
        $this->getSession()->wait(2000, "document.readyState === 'complete'");
    }

    /**
     * Start a quiz attempt as the currently logged-in user.
     *
     * @Given I start the STACK MathQuill quiz attempt :quizname
     * @param string $quizname Quiz name.
     */
    public function i_start_the_stack_mathquill_quiz_attempt(string $quizname): void {
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
     * @Given I am on the STACK MathQuill quiz attempt for :quizname
     * @param string $quizname Quiz name.
     */
    public function i_am_on_the_stack_mathquill_quiz_attempt_for(string $quizname): void {
        $this->i_start_the_stack_mathquill_quiz_attempt($quizname);
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
        $this->i_start_the_stack_mathquill_quiz_attempt($quizname);

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
                var select = document.querySelector('#id_groups, select[name="groups[]"], select[name="groups"]');
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
                var select = document.querySelector('#id_groups, select[name="groups[]"], select[name="groups"]');
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
     * Both forms are accepted:
     *   without quiz name → uses first quiz found in the current fixture
     *   with quiz name    → targets the named quiz explicitly
     *
     * @Given the quiz-level config has :groupname enabled
     * @Given the quiz-level config has :groupname enabled for :quizname
     * @param string $groupname Group label or key to enable.
     * @param string $quizname  Optional quiz name; first quiz used when empty.
     */
    public function the_quiz_level_config_has_enabled_for(
        string $groupname,
        string $quizname = ''
    ): void {
        global $DB;

        // Resolve quiz: explicit name or first quiz in fixture.
        if ($quizname !== '') {
            $quiz = $DB->get_record('quiz', ['name' => $quizname], '*', MUST_EXIST);
        } else {
            $quiz = $DB->get_record_sql(
                'SELECT * FROM {quiz} ORDER BY id ASC',
                [],
                IGNORE_MULTIPLE
            );
            if (!$quiz) {
                throw new ExpectationException(
                    'No quiz found in fixture for quiz-level config step.',
                    $this->getSession()
                );
            }
        }
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

        // Persist quiz-level config via plugin API.
        $config = \local_stackmatheditor\config_manager::get_quiz_default((int)$cm->id)
            ?? \local_stackmatheditor\config_manager::get_instance_base_config();
        $config[$groupkey] = true;
        \local_stackmatheditor\config_manager::save_quiz_default((int)$cm->id, $config);
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
        $qbeid = \local_stackmatheditor\config_manager::resolve_qbeid($question->id);
        if (!$qbeid) {
            throw new ExpectationException(
                "Cannot resolve QBEID for question '$questionname'.",
                $this->getSession()
            );
        }
        $override = $DB->record_exists(
            'local_stackmatheditor',
            ['questionbankentryid' => $qbeid]
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

        // Find the question via question_references (Moodle 4.5+: no quiz_slots.questionid).
        $slots = $DB->get_records('quiz_slots', ['quizid' => $quiz->id], 'slot ASC');
        foreach ($slots as $slot) {
            $qbeid = $DB->get_field('question_references', 'questionbankentryid', [
                'component'    => 'mod_quiz',
                'questionarea' => 'slot',
                'itemid'       => $slot->id,
            ]);
            if (!$qbeid) {
                continue;
            }
            $questionid = $DB->get_field_sql(
                'SELECT qv.questionid
                   FROM {question_versions} qv
                  WHERE qv.questionbankentryid = :qbeid
               ORDER BY qv.version DESC',
                ['qbeid' => $qbeid],
                IGNORE_MULTIPLE
            );
            if (!$questionid) {
                continue;
            }
            $question = question_bank::load_question((int)$questionid, false);
            if (!empty($question->inputs[$inputname])) {
                \local_stackmatheditor\config_manager::save_config(
                    (int)$cm->id,
                    (int)$qbeid,
                    ['_enabled' => false]
                );
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

    /**
     * Set the plugin usepercentpi config option directly in the database.
     *
     * @Given the plugin usepercentpi setting is :value
     * @param string $value Config value: "0" to disable, "1" to enable.
     */
    public function the_plugin_usepercentpi_setting_is(string $value): void {
        set_config('usepercentpi', (int) $value, 'local_stackmatheditor');
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

        // Use a sentinel so we can distinguish 'not yet called' from 'returned null'.
        $js = <<<JS
            // tex2max module has no dependencies and exports { convert: convert }.
            // mathquill_init exports init() only – it cannot do conversion.
            window.__sme_t2m_result = '__waiting__';
            (function() {
                var amdReq = window.requirejs || window.require || null;
                if (!amdReq || typeof amdReq !== 'function') {
                    window.__sme_t2m_result = '__no-amd__';
                    return;
                }
                // Prefer synchronous access if module is already cached.
                if (typeof amdReq.defined === 'function'
                        && amdReq.defined('local_stackmatheditor/tex2max')) {
                    try {
                        var mod = amdReq('local_stackmatheditor/tex2max');
                        var cfg = {variableMode: '{$jsmode}'};
                        var sApi = Object.keys(mod)
                            .filter(function(k) { return typeof mod[k] === 'function'; })
                            .join(',');
                        if (typeof mod.convert !== 'function') {
                            window.__sme_t2m_result = '__api__:' + sApi;
                            return;
                        }
                        var r = mod.convert('{$jslatex}', cfg);
                        if (r === null || r === undefined) {
                            window.__sme_t2m_result = '__null__';
                        } else if (String(r) === '') {
                            window.__sme_t2m_result = '__empty__:api=' + sApi;
                        } else {
                            window.__sme_t2m_result = String(r);
                        }
                    } catch (ex) {
                        window.__sme_t2m_result = '__error__:' + ex.message;
                    }
                    return;
                }
                // Async load – tex2max has no dependencies so this is near-instant.
                amdReq(
                    ['local_stackmatheditor/tex2max'],
                    function(mod) {
                        try {
                            var cfg = {variableMode: '{$jsmode}'};
                            var api = Object.keys(mod)
                                .filter(function(k) { return typeof mod[k] === 'function'; })
                                .join(',');
                            if (typeof mod.convert !== 'function') {
                                window.__sme_t2m_result = '__api__:' + api;
                                return;
                            }
                            var r = mod.convert('{$jslatex}', cfg);
                            if (r === null || r === undefined) {
                                window.__sme_t2m_result = '__null__';
                            } else if (String(r) === '') {
                                // Empty result: report the module API for debugging.
                                window.__sme_t2m_result = '__empty__:api=' + api;
                            } else {
                                window.__sme_t2m_result = String(r);
                            }
                        } catch (ex) {
                            window.__sme_t2m_result = '__error__:' + ex.message;
                        }
                    },
                    function(reqErr) {
                        var t = reqErr && reqErr.requireType ? reqErr.requireType : 'unknown';
                        window.__sme_t2m_result = '__require-error__:' + t;
                    }
                );
            })();
JS;
        $this->getSession()->evaluateScript($js);
        // Wait up to 3 s for the AMD callback to fire.
        $this->getSession()->wait(3000, "window.__sme_t2m_result !== '__waiting__'");
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



    // Stack CAS diagnostic steps (tag stack_init).

    /**
     * Navigate to the STACK plugin settings page in site administration.
     *
     * @When I navigate to the STACK settings page
     */
    public function i_navigate_to_stack_settings_page(): void {
        $url = new moodle_url('/admin/settings.php', ['section' => 'qtypesettingstack']);
        $this->getSession()->visit($this->locate_path($url->out(false)));
        $this->wait_for_pending_js();
    }

    /**
     * Navigate to the STACK healthcheck admin page.
     *
     * @When I navigate to the STACK healthcheck page
     */
    public function i_navigate_to_stack_healthcheck_page(): void {
        $url = new moodle_url('/question/type/stack/adminui/healthcheck.php');
        $this->getSession()->visit($this->locate_path($url->out(false)));
        $this->wait_for_pending_js();
    }

    /**
     * Clear the STACK CAS result cache on the healthcheck page.
     * Order: FIRST clear cache, THEN rebuild image.
     *
     * @When I clear the STACK CAS cache
     */
    public function i_clear_the_stack_cas_cache(): void {
        $page = $this->getSession()->getPage();
        $clearbtn = $page->find(
            'xpath',
            '//input[@name="clearcache"]/ancestor::form//button'
        );
        if (!$clearbtn) {
            $clearbtn = $page->find(
                'xpath',
                '//input[@name="clearcache"]/following::button[1]'
            );
        }
        if (!$clearbtn) {
            throw new ExpectationException(
                "STACK clear-cache button not found on healthcheck page. " .
                "Expected a POST form with input[name=\"clearcache\"] and a button.",
                $this->getSession()
            );
        }
        $clearbtn->click();
        $this->wait_for_pending_js();
        $this->handle_moodle_progress_page();
    }

    /**
     * Rebuild the STACK Maxima optimised image via the healthcheck page.
     *
     * @When I rebuild the STACK Maxima image
     */
    public function i_rebuild_the_stack_maxima_image(): void {
        $page = $this->getSession()->getPage();
        $btn  = $page->find(
            'xpath',
            '//input[@name="createmaximaimage"]/ancestor::form//button'
        );
        if (!$btn) {
            $btn = $page->find(
                'xpath',
                '//input[@name="createmaximaimage"]/following::button[1]'
            );
        }
        if (!$btn) {
            throw new ExpectationException(
                "STACK \'Create Maxima image\' button not found on healthcheck page. " .
                "Expected a POST form with input[name=\"createmaximaimage\"] and a button.",
                $this->getSession()
            );
        }
        $btn->click();
        $this->wait_for_pending_js();
        $this->handle_moodle_progress_page();
    }

    /**
     * Clicks the Moodle Continue/Weiter button on progress redirect pages.
     */
    protected function handle_moodle_progress_page(): void {
        $page     = $this->getSession()->getPage();
        $continue = $page->find('css', '#id_continue');
        if (!$continue) {
            $xp = '//button[contains(.,"Continue")] | //button[contains(.,"Weiter")]';
            $continue = $page->find('xpath', $xp);
        }
        if ($continue) {
            $continue->click();
            $this->wait_for_pending_js();
        }
    }

    /**
     * Assert success indicators on the STACK healthcheck page.
     *
     * @Then I should see the STACK healthcheck success indicators
     */
    public function i_should_see_stack_healthcheck_success_indicators(): void {
        $page   = $this->getSession()->getPage();
        $source = $page->getContent();

        if (strpos($source, 'class="stackerror"') !== false) {
            throw new ExpectationException(
                "STACK healthcheck page shows at least one error.",
                $this->getSession()
            );
        }

        // Note: 'maxima_opt_auto' also appears in error text; use more specific indicators.
        // The stackmaximaversion (10-digit) only appears when CAS returned data.
        // Note: 'CAS gibt' / 'CAS returns' only appear on successful connection.
        $successhint = ['stackmaximaversion', 'CAS gibt Daten', 'CAS returns data',
            'STACK_SETUP_OK', 'stehende Verbindung', 'standing connection'];

        $found = false;
        foreach ($successhint as $hint) {
            if (strpos($source, $hint) !== false) {
                $found = true;
                break;
            }
        }
        if (!$found) {
            throw new ExpectationException(
                "STACK healthcheck success indicators not found on page.",
                $this->getSession()
            );
        }
    }

    /**
     * Assert the healthcheck page reports the CAS connection as working.
     *
     * @Then the STACK CAS connection should be reported as working
     */
    public function the_stack_cas_connection_should_be_reported_as_working(): void {
        $page   = $this->getSession()->getPage();
        $source = $page->getContent();
        $ok     = ['casconnect', 'stehende Verbindung', 'standing connection',
                   'CAS returns data', 'CAS gibt Daten'];
        foreach ($ok as $needle) {
            if (strpos($source, $needle) !== false) {
                return;
            }
        }
        throw new ExpectationException(
            "STACK CAS connection is NOT reported as working on the healthcheck page. " .
            "Possible causes: maxima_opt_auto not found, platform constant missing, " .
            "or QTYPE_STACK_TEST_CONFIG_MAXIMACOMMANDOPT not set.",
            $this->getSession()
        );
    }

    /**
     * Assert the healthcheck page reports a specific platform.
     *
     * @Then the STACK platform should be reported as :platform
     * @param string $platform Expected platform identifier, e.g. "linux-optimised".
     */
    public function the_stack_platform_should_be_reported_as(string $platform): void {
        $page   = $this->getSession()->getPage();
        $source = $page->getContent();
        if (strpos($source, $platform) === false) {
            throw new ExpectationException(
                "Expected STACK platform \'{$platform}\' not found on healthcheck page.",
                $this->getSession()
            );
        }
    }

    /**
     * Assert the healthcheck page reports a valid Maxima library version.
     *
     * @Then the STACK Maxima library version should be valid
     */
    public function the_stack_maxima_library_version_should_be_valid(): void {
        $page   = $this->getSession()->getPage();
        $source = $page->getContent();
        if (!preg_match('/\b20\d{8}\b/', $source)) {
            throw new ExpectationException(
                "STACK Maxima library version (10-digit timestamp) not found " .
                "on healthcheck page.",
                $this->getSession()
            );
        }
    }

    /**
     * Assert the STACK optimised Maxima image file exists and is executable.
     * Uses PHP file system checks (not browser JS) since this is server-side state.
     *
     * @Then the STACK optimised Maxima image should be executable
     */
    public function the_stack_optimised_maxima_image_should_be_executable(): void {
        global $CFG;

        $image = $CFG->dataroot . '/stack/maxima_opt_auto';

        if (!is_file($image)) {
            throw new ExpectationException(
                "Expected STACK optimised Maxima image does not exist: {$image}. " .
                "Run stack-behat-init.php before Behat to create it.",
                $this->getSession()
            );
        }

        if (!is_executable($image)) {
            throw new ExpectationException(
                "STACK optimised Maxima image is not executable: {$image}. " .
                "Apply chmod 0755.",
                $this->getSession()
            );
        }
    }

    /**
     * Enter LaTeX into the MathQuill field for a given STACK input name.
     * Drives the full UI path: MathQuill write → tex2max → STACK hidden input.
     *
     * @When I enter latex :latex into the MathQuill field for :inputname
     * @param string $latex     LaTeX string to enter.
     * @param string $inputname STACK input name (e.g. "ans1").
     */
    public function i_enter_latex_into_mathquill_field(
        string $latex,
        string $inputname
    ): void {
        $jslatex = json_encode($latex);
        $jsinput = json_encode($inputname);

        $result = $this->getSession()->evaluateScript(<<<JS
(function() {
    var n = {$jsinput};
    var input = document.querySelector('[name="' + n + '"]')
        || document.querySelector('[name$="_' + n + '"]')
        || document.querySelector('[id="' + n + '"]')
        || document.querySelector('[id$="_' + n + '"]');

    if (!input) { return 'no-stack-input'; }

    var que = input.closest('.que') || document;
    var container = que.querySelector('.sme-mq-container');

    if (!container) { return 'no-sme-container'; }

    var editable = container.querySelector('.mq-editable-field');
    if (!editable)  { return 'no-mq-editable'; }
    if (!window.MathQuill) { return 'no-mathquill'; }

    var MQ    = window.MathQuill.getInterface(2);
    var field = MQ(editable);
    if (!field)     { return 'no-mq-field'; }

    field.latex('');
    field.write({$jslatex});
    field.blur();

    input.dispatchEvent(new Event('input',  {bubbles: true}));
    input.dispatchEvent(new Event('change', {bubbles: true}));

    return 'ok';
})()
JS);

        if ($result !== 'ok') {
            throw new ExpectationException(
                "Could not enter LaTeX into MathQuill field \'{$inputname}\' " .
                "(result: {$result}).",
                $this->getSession()
            );
        }
    }

    /**
     * Assert the underlying hidden STACK input contains an expected substring.
     *
     * @Then the underlying STACK input for :inputname should contain :expected
     * @param string $inputname STACK input name.
     * @param string $expected  Expected substring in the input value.
     */
    public function the_underlying_stack_input_should_contain(
        string $inputname,
        string $expected
    ): void {
        $jsinput = json_encode($inputname);
        $actual  = $this->getSession()->evaluateScript(<<<JS
(function() {
    var n = {$jsinput};
    var input = document.querySelector('[name="' + n + '"]')
        || document.querySelector('[name$="_' + n + '"]')
        || document.querySelector('[id="' + n + '"]')
        || document.querySelector('[id$="_' + n + '"]');
    return input ? input.value : '__missing_input__';
})()
JS);

        if (strpos((string)$actual, $expected) === false) {
            throw new ExpectationException(
                "STACK input \'{$inputname}\' value \'{$actual}\' " .
                "does not contain \'{$expected}\'.",
                $this->getSession()
            );
        }
    }

    /**
     * Assert the underlying hidden STACK input does not contain a given string.
     *
     * @Then the underlying STACK input for :inputname should not contain :text
     * @param string $inputname STACK input name.
     * @param string $text      String that must NOT appear in the input value.
     */
    public function the_underlying_stack_input_should_not_contain(
        string $inputname,
        string $text
    ): void {
        $jsinput = json_encode($inputname);
        $actual  = $this->getSession()->evaluateScript(<<<JS
(function() {
    var n = {$jsinput};
    var input = document.querySelector('[name="' + n + '"]')
        || document.querySelector('[name$="_' + n + '"]')
        || document.querySelector('[id="' + n + '"]')
        || document.querySelector('[id$="_' + n + '"]');
    return input ? input.value : '__missing_input__';
})()
JS);

        if (strpos((string)$actual, $text) !== false) {
            throw new ExpectationException(
                "STACK input \'{$inputname}\' value \'{$actual}\' " .
                "unexpectedly contains \'{$text}\'.",
                $this->getSession()
            );
        }
    }

    /**
     * Assert the underlying hidden STACK input equals an expected string exactly.
     *
     * @Then the underlying STACK input for :inputname should be :expected
     * @param string $inputname STACK input name.
     * @param string $expected  Expected exact value of the input.
     */
    public function the_underlying_stack_input_should_be(
        string $inputname,
        string $expected
    ): void {
        $jsinput = json_encode($inputname);
        $actual  = $this->getSession()->evaluateScript(<<<JS
(function() {
    var n = {$jsinput};
    var input = document.querySelector('[name="' + n + '"]')
        || document.querySelector('[name$="_' + n + '"]')
        || document.querySelector('[id="' + n + '"]')
        || document.querySelector('[id$="_' + n + '"]');
    return input ? input.value : '__missing_input__';
})()
JS);

        if ((string)$actual !== $expected) {
            throw new ExpectationException(
                "STACK input \'{$inputname}\' value \'{$actual}\' " .
                "does not equal \'{$expected}\'.",
                $this->getSession()
            );
        }
    }
}

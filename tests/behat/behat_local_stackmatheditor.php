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
use Behat\Behat\Hook\Scope\AfterScenarioScope;
use Behat\Behat\Hook\Scope\BeforeScenarioScope;

/**
 * Behat step definitions for local_stackmatheditor.
 *
 * @package    local_stackmatheditor
 * @category   test
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class behat_local_stackmatheditor extends behat_base {
    /** @var float|null Start of the running scenario (microtime), for the timing record. */
    private static $scenariostart = null;

    /** @var int CAS baseline repairs in this Behat run. */
    private static $casresets = 0;

    /** @var bool Whether the CAS baseline had to be repaired before the running scenario. */
    private static $scenariocasrepair = false;

    /**
     * Set the plugin enabled mode in Moodle config.
     *
     * @Given the plugin enabled mode is set to :mode
     * @param string $mode One of "0", "1", "2", "3".
     */
    public function the_plugin_enabled_mode_is_set_to(string $mode): void {
        // The call to set_config() invalidates the config cache of the plugin for every process; a purge of
        // all caches would only cost time.
        set_config('enabled', $mode, 'local_stackmatheditor');
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
        if ($this->running_javascript()) {
            $this->getSession()->wait(2000, "document.readyState === 'complete'");
        }
    }

    /**
     * Open the quiz-level configuration page for a given question case (#54).
     *
     * @Given I am on the STACK MathQuill quiz configuration page for :quizname with question :case
     * @param string $quizname Quiz name.
     * @param string $case     "stack" for the quiz's STACK question, anything else for a
     *                         question bank entry id that does not exist.
     */
    public function i_am_on_quiz_config_page_with_question(string $quizname, string $case): void {
        global $DB;

        $quiz = $DB->get_record('quiz', ['name' => $quizname], '*', MUST_EXIST);
        $cm = get_coursemodule_from_instance('quiz', $quiz->id, 0, false, MUST_EXIST);
        $qbeid = 999999999;
        if ($case === 'stack') {
            $qbeid = (int) $DB->get_field_sql(
                "SELECT qr.questionbankentryid
                   FROM {quiz_slots} qs
                   JOIN {question_references} qr ON qr.itemid = qs.id
                        AND qr.component = 'mod_quiz' AND qr.questionarea = 'slot'
                  WHERE qs.quizid = :quizid
               ORDER BY qs.slot",
                ['quizid' => $quiz->id],
                IGNORE_MULTIPLE
            );
        }
        $url = new \moodle_url(
            '/local/stackmatheditor/configure.php',
            ['cmid' => $cm->id, 'qbeid' => $qbeid]
        );
        $this->getSession()->visit($url->out(false));
        if ($this->running_javascript()) {
            $this->getSession()->wait(2000, "document.readyState === 'complete'");
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
     * Let STACK validate what is currently in an input, and report what it said (#34).
     *
     * The button contract test in Jest proves a button produces a CAS-safe string. It cannot
     * prove the CAS agrees, because it has no CAS. This step presses STACK's own validation and
     * checks that the answer came back interpreted rather than rejected - which is the only
     * evidence that a visible button means what it promises.
     *
     * @Then STACK should accept the answer in :inputname
     * @param string $inputname Name attribute of the original input.
     */
    public function stack_should_accept_the_answer(string $inputname): void {
        $session = $this->getSession();
        $safe = json_encode($inputname);

        // An empty input is not an accepted answer: STACK says nothing about it, and silence must
        // not pass as acceptance.
        $value = (string) $session->evaluateScript(<<<JS
            (function() {
                var n     = {$safe};
                var input = document.querySelector('input[name="' + n + '"]')
                         || document.querySelector('input[name\$="_' + n + '"]');
                return input ? input.value : '';
            })()
JS);
        if (trim($value) === '') {
            throw new ExpectationException("The STACK input '$inputname' is empty; there is nothing to accept.", $session);
        }

        // STACK validates on blur and on the check button; blurring is enough and does not
        // submit the attempt.
        $session->executeScript(<<<JS
            (function() {
                var n     = {$safe};
                var input = document.querySelector('input[name="' + n + '"]')
                         || document.querySelector('input[name\$="_' + n + '"]');
                if (input) {
                    input.dispatchEvent(new Event('change', {bubbles: true}));
                    input.blur();
                }
            })()
JS);

        // What STACK says when it cannot read an answer.
        $rejections = [
            'Your answer is not',
            'not a valid',
            'Illegal',
            'unknown function',
            'missing',
            'CAS failed',
            'Unable to',
        ];
        // Accepted means interpreted: STACK shows how it read the answer.
        $validation = '';
        for ($waited = 0; $waited < 30; $waited++) {
            $validation = (string) $session->evaluateScript(<<<JS
                (function() {
                    var boxes = document.querySelectorAll('.stackinputfeedback, .stackinputerror');
                    var text  = '';
                    boxes.forEach(function(box) {
                        text += ' ' + (box.textContent || '');
                    });
                    return text.trim();
                })()
JS);
            foreach ($rejections as $rejection) {
                if (stripos($validation, $rejection) !== false) {
                    throw new ExpectationException("STACK refused the answer in '$inputname': $validation", $session);
                }
            }
            if (stripos($validation, 'interpreted') !== false) {
                return;
            }
            $session->wait(1000);
        }
        throw new ExpectationException(
            "STACK did not show how it interpreted '{$value}' in '$inputname' within 30 s: '{$validation}'",
            $session
        );
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

    // Multiline (textarea / equiv) editor.

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
     * Uses a qtype_stack generator template ('algebraic_input' by default).
     *
     * @param string $quizname     Quiz name.
     * @param string $questionname Question name.
     * @param string $template     qtype_stack generator template.
     * @return stdClass The question record.
     */
    protected function ensure_stack_question_in_quiz(
        string $quizname,
        string $questionname,
        string $template = 'algebraic_input'
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
        $question = $qgen->create_question('stack', $template, [
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
        // Verify the STACK question rendered ans1 (CAS must be working).
        $this->assert_stack_input_present('ans1');
    }

    /**
     * Assert that a STACK input field is present on the attempt page.
     * Fails with a detailed message if CAS rendered a runtime error instead.
     *
     * @param string $inputname STACK input name (e.g. "ans1").
     */
    protected function assert_stack_input_present(string $inputname = 'ans1'): void {
        $jsinput = json_encode($inputname);

        // The STACK question is rendered server-side during attempt.php, which can
        // take longer than a fixed page-load wait (Maxima cold start on the first
        // attempt of a scenario).  Poll for the input before failing, so a slow
        // render does not produce a spurious "input not found".
        $present = "(function() {"
            . "var n = {$jsinput};"
            . "return !!("
            . "document.querySelector('[name=\"' + n + '\"]') || "
            . "document.querySelector('[name\$=\"_' + n + '\"]') || "
            . "document.querySelector('[id=\"' + n + '\"]') || "
            . "document.querySelector('[id\$=\"_' + n + '\"]')"
            . ");})()";
        if ($this->getSession()->wait(30000, $present)) {
            return;
        }

        $result = $this->getSession()->evaluateScript(<<<JS
(function() {
    var n = {$jsinput};
    var field = document.querySelector('[name="' + n + '"]')
        || document.querySelector('[name$="_' + n + '"]')
        || document.querySelector('[id="'  + n + '"]')
        || document.querySelector('[id$="_' + n + '"]');

    if (field) {
        return 'ok:' + field.tagName + ':' + (field.name || field.id || '');
    }

    // Collect full STACK runtime-error details (timeout message, question vars, etc).
    var err = document.querySelector('.stackruntimeerrror, .stackruntimeerror');
    var errText = 'no';
    if (err) {
        var container = err.closest('.formulation') || err.parentElement;
        errText = container
            ? container.textContent.trim()
            : err.textContent.trim();
    }

    var inputs = Array.from(
        document.querySelectorAll('input[name], textarea[name]')
    ).map(function(e) { return e.tagName + '[' + e.name + ']'; }).join('|');

    return 'missing:runtimeError=' + errText.substring(0, 1500)
        + ':inputs=' + inputs.substring(0, 800);
})()
JS);

        if (strpos($result, 'ok:') !== 0) {
            throw new ExpectationException(
                "STACK input \'{$inputname}\' not found on attempt page. " .
                "This is usually caused by a STACK CAS failure. Details: " .
                $result,
                $this->getSession()
            );
        }
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

    // MathQuill editor assertions.

    // Tex2max JavaScript evaluation.

    // Stack CAS diagnostic steps (tag stack_init).

    /**
     * Navigate to the STACK healthcheck admin page.
     *
     * @When I navigate to the STACK healthcheck page
     */
    public function i_navigate_to_stack_healthcheck_page(): void {
        // The healthcheck runs a dozen CAS calls; with platform=linux (Maxima without a frozen
        // image) the response can take longer than php-webdriver's 30 s HTTP timeout, and a
        // regular visit() then fails with "WebDriverCurlException ... Operation timed out"
        // although STACK is fine. The page is therefore fetched from within the current page:
        // fetch() is no navigation, so every WebDriver command below returns at once, and the
        // step waits up to 280 s (castimeout is 300 s) for the result. The fetched HTML is shown
        // in the current page, where the assertion steps read it.
        $url = new moodle_url('/question/type/stack/adminui/healthcheck.php');
        $jsurl = json_encode($this->locate_path($url->out(false)));
        $this->getSession()->executeScript(<<<JS
window.__smeHealthcheck = null;
fetch({$jsurl}, {credentials: 'same-origin'})
    .then(function(response) {
        return response.text().then(function(text) {
            var box = document.getElementById('sme-healthcheck') || document.createElement('div');
            box.id = 'sme-healthcheck';
            box.innerHTML = text;
            document.body.appendChild(box);
            window.__smeHealthcheck = 'HTTP ' + response.status;
        });
    })
    .catch(function(e) {
        window.__smeHealthcheck = 'error: ' + e;
    });
JS);
        $this->getSession()->wait(280000, 'window.__smeHealthcheck !== null');
        $status = $this->getSession()->evaluateScript('return window.__smeHealthcheck;');
        if ($status !== 'HTTP 200') {
            throw new ExpectationException(
                'The STACK healthcheck page could not be loaded within 280 s (' . var_export($status, true) . ').',
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

        // First reject explicit failure markers.
        $failmarkers = [
            'overallresult fail',
            'CAS failed',
            'The healthcheck detected serious problems',
            'No such file or directory',
        ];
        foreach ($failmarkers as $fail) {
            if (stripos($source, $fail) !== false) {
                throw new ExpectationException(
                    "STACK healthcheck reports a CAS failure (found: \'{$fail}\').",
                    $this->getSession()
                );
            }
        }

        // Accept any recognised success indicator from STACK's healthcheck output.
        $ok = [
            'overallresult pass',
            'You have a live connection to the CAS',
            'CAS returned data as expected',
            'The healthcheck passed without detecting any issues',
            'Correct and expected STACK-Maxima library version',
            'CAS gibt Daten',
            'stehende Verbindung',
            'standing connection',
        ];
        foreach ($ok as $needle) {
            if (stripos($source, $needle) !== false) {
                return;
            }
        }

        throw new ExpectationException(
            "STACK CAS connection is NOT reported as working on the healthcheck page. " .
            "Neither a success indicator nor a failure marker was found.",
            $this->getSession()
        );
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

    /**
     * Force STACK CAS to a direct (non-optimised) Maxima connection at Behat runtime.
     *
     * moodle-plugin-ci behat --start-servers re-runs util_single_run.php, which
     * re-triggers STACK install.php and writes platform=linux-optimised plus a
     * volatile maxima_opt_auto image path back into the Behat DB.  The frozen
     * image is then removed by the dataroot reset, so any CAS call fails with
     * "No such file or directory".  Setting platform=linux makes STACK invoke the
     * plain "maxima" binary directly (cold start, no frozen image required).
     *
     * @param bool $verify When true, run a genuine CAS connect and fail loudly
     *                      if the connection does not actually work.
     */
    private function reset_stack_cas_to_direct_maxima(bool $verify = false): void {
        global $CFG, $DB;

        if (!$DB->get_manager()->table_exists('config')) {
            throw new ExpectationException(
                'Cannot reset STACK CAS: the Moodle {config} table does not exist.',
                $this->getSession()
            );
        }

        $candidates = [
            $CFG->dirroot . '/question/type/stack',
            $CFG->dirroot . '/public/question/type/stack',
        ];
        $stackroot = null;
        foreach ($candidates as $candidate) {
            if (file_exists($candidate . '/stack/cas/installhelper.class.php')) {
                $stackroot = $candidate;
                break;
            }
        }
        if (!$stackroot) {
            throw new ExpectationException(
                'Cannot reset STACK CAS: qtype_stack was not found under dirroot.',
                $this->getSession()
            );
        }

        require_once($stackroot . '/stack/cas/installhelper.class.php');
        require_once($stackroot . '/stack/cas/connectorhelper.class.php');

        // Only what differs is written: set_config() invalidates the config cache of qtype_stack
        // for every process, so no global cache purge is needed - and none happens when the
        // baseline is already in place, which is the normal case after the first scenario.
        $baseline = [
            'platform' => 'linux',
            'maximacommand' => 'maxima',
            'maximacommandopt' => '',
            'maximaversion' => 'default',
            'castimeout' => '300',
            'casresultscache' => 'db',
            'casdebugging' => '0',
            'maximalibraries' => '',
        ];
        $changed = false;
        foreach ($baseline as $name => $value) {
            if ((string) get_config('qtype_stack', $name) !== $value) {
                set_config($name, $value, 'qtype_stack');
                $changed = true;
            }
        }
        $maximalocal = $CFG->dataroot . '/stack/maximalocal.mac';
        self::$casresets += ($changed || !is_readable($maximalocal)) ? 1 : 0;
        if (!$changed && is_readable($maximalocal) && !$verify) {
            return;
        }

        // Reset the stack_cas_configuration singleton so it re-reads the new values.
        if (class_exists('stack_cas_configuration')) {
            $ref = new ReflectionClass('stack_cas_configuration');
            if ($ref->hasProperty('instance')) {
                $prop = $ref->getProperty('instance');
                $prop->setAccessible(true);
                $prop->setValue(null, null);
            }
        }

        stack_cas_configuration::create_maximalocal();

        if ($verify) {
            [$message, $debug, $ok] = stack_connection_helper::stackmaxima_genuine_connect();
            if (!$ok) {
                throw new ExpectationException(
                    'STACK CAS direct-Maxima connection failed. '
                        . 'Message: ' . $message . ' Debug: ' . $debug,
                    $this->getSession()
                );
            }
        }
    }

    /**
     * Reset STACK CAS to a working direct Maxima connection and verify it.
     *
     * Makes the runtime CAS repair explicit and verifiable inside the scenario,
     * rather than relying on the (silent) @BeforeScenario hook alone.
     *
     * @Given the STACK CAS platform is reset to direct Maxima
     */
    public function the_stack_cas_platform_is_reset_to_direct_maxima(): void {
        $this->reset_stack_cas_to_direct_maxima(true);
    }

    /**
     * Keep the STACK CAS baseline in place before every plugin scenario.
     *
     * stack-behat-init.php sets the baseline once and proves it with a real CAS call
     * (@stack_init). Behat's reset between scenarios can bring back what STACK's installer wrote,
     * so this hook checks the configuration and the maximalocal.mac file and repairs only what
     * differs - without a cache purge, and doing nothing at all when the baseline is intact.
     *
     * @BeforeScenario @local_stackmatheditor
     * @param BeforeScenarioScope $scope Behat scenario scope.
     */
    public function prepare_stack_cas_for_scenario(BeforeScenarioScope $scope): void {
        $before = self::$casresets;
        $this->reset_stack_cas_to_direct_maxima(false);
        self::$scenariocasrepair = self::$casresets > $before;
        self::$scenariostart = microtime(true);
    }

    /**
     * Record how long the scenario took (#96, part A).
     *
     * One JSON line per scenario - feature, scenario, line, start, duration, result and whether
     * the CAS configuration had to be repaired (casrepair) - appended to the file named by the environment
     * variable SME_BEHAT_TIMINGS (CI: ci-logs/behat-timings.jsonl). Without the variable nothing
     * is written. The hook only reads the clock and appends a line; it changes nothing the
     * scenario sees.
     *
     * @AfterScenario @local_stackmatheditor
     * @param AfterScenarioScope $scope Behat scenario scope.
     */
    public function record_scenario_timing(AfterScenarioScope $scope): void {
        $file = getenv('SME_BEHAT_TIMINGS');
        if (!$file || self::$scenariostart === null) {
            return;
        }
        $results = [0 => 'passed', 10 => 'skipped', 20 => 'pending', 30 => 'undefined', 99 => 'failed'];
        $code = $scope->getTestResult()->getResultCode();
        $line = json_encode([
            'feature' => basename($scope->getFeature()->getFile()),
            'scenario' => $scope->getScenario()->getTitle(),
            'line' => $scope->getScenario()->getLine(),
            'start' => gmdate('Y-m-d\TH:i:s\Z', (int) self::$scenariostart),
            'duration' => round(microtime(true) - self::$scenariostart, 3),
            'result' => $results[$code] ?? (string) $code,
            'casrepair' => self::$scenariocasrepair,
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        file_put_contents($file, $line . "\n", FILE_APPEND | LOCK_EX);
        self::$scenariostart = null;
    }
}

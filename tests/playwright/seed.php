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

/**
 * CLI seed for the local_stackmatheditor browser and load tests (disposable test sites only).
 *
 * Verifies that the plugin and qtype_stack are installed, then creates - idempotently - a course
 * with a teacher, students and two quizzes whose STACK questions are imported from the Moodle XML
 * fixtures in tests/fixtures (no PHPUnit generator needed):
 * - "SME Settings Quiz": two algebraic questions on one page (settings matrix);
 * - "SME Load Quiz": eight algebraic and two textarea questions on one page (load tests and
 *   many editors on one page).
 * Prints the values as shell "export" lines, so the CI runner and the make targets can source them.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

define('CLI_SCRIPT', true);

require(__DIR__ . '/../../../../config.php');
require_once($CFG->libdir . '/testing/generator/lib.php');
require_once($CFG->dirroot . '/mod/quiz/locallib.php');
require_once($CFG->dirroot . '/question/format/xml/format.php');
require_once($CFG->libdir . '/questionlib.php');

$pluginmanager = core_plugin_manager::instance();
foreach (['local_stackmatheditor', 'qtype_stack'] as $component) {
    $info = $pluginmanager->get_plugin_info($component);
    if ($info === null || empty($info->versiondb)) {
        fwrite(STDERR, "{$component} is not installed on this site - run the Moodle upgrade first.\n");
        exit(1);
    }
}

// Enrolment notifications would try to send mail on a site without a mail setup.
$CFG->noemailever = true;

$students = (int) (getenv('SME_STUDENTS') ?: 20);
$password = 'Test!2345';
$gen = new testing_data_generator();

/**
 * Import one question from a Moodle XML fixture into a category.
 *
 * @param string $file Fixture file name in tests/fixtures.
 * @param stdClass $category Question category.
 * @param stdClass $course Course.
 * @param string $name Question name.
 * @return int Question id.
 */
function local_stackmatheditor_seed_import(string $file, stdClass $category, stdClass $course, string $name): int {
    $xml = file_get_contents(__DIR__ . '/../fixtures/' . $file);
    $xml = preg_replace('~<name>\s*<text>[^<]*</text>~', '<name><text>' . $name . '</text>', $xml, 1);
    $tmp = make_request_directory() . '/' . $file;
    file_put_contents($tmp, $xml);
    $format = new qformat_xml();
    $format->setCategory($category);
    $format->setContexts([context_course::instance($course->id)]);
    $format->setCourse($course);
    $format->setFilename($tmp);
    $format->setMatchgrades('nearest');
    $format->setStoponerror(true);
    ob_start();
    $ok = $format->importpreprocess() && $format->importprocess() && $format->importpostprocess();
    ob_end_clean();
    if (!$ok || empty($format->questionids)) {
        throw new moodle_exception('Import of ' . $file . ' failed.');
    }
    return (int) reset($format->questionids);
}

/**
 * Create a quiz with the given questions on one page, unless it exists already.
 *
 * @param testing_data_generator $gen Generator.
 * @param stdClass $course Course.
 * @param stdClass $category Question category.
 * @param string $name Quiz name.
 * @param string[] $fixtures Fixture per question.
 * @return int Course module id.
 */
function local_stackmatheditor_seed_quiz(
    testing_data_generator $gen,
    stdClass $course,
    stdClass $category,
    string $name,
    array $fixtures
): int {
    global $DB;
    $quiz = $DB->get_record('quiz', ['course' => $course->id, 'name' => $name]);
    if (!$quiz) {
        $created = $gen->create_module('quiz', [
            'course' => $course->id,
            'name' => $name,
            'preferredbehaviour' => 'adaptive',
            'questionsperpage' => 0,
            'grade' => 10,
        ]);
        $quiz = $DB->get_record('quiz', ['id' => $created->id], '*', MUST_EXIST);
        foreach ($fixtures as $i => $fixture) {
            $qid = local_stackmatheditor_seed_import($fixture, $category, $course, $name . ' Q' . ($i + 1));
            quiz_add_quiz_question($qid, $quiz, 1, 1);
        }
    }
    // Every question worth one mark, and the quiz total recomputed - otherwise no attempt can start.
    $DB->set_field('quiz_slots', 'maxmark', 1, ['quizid' => $quiz->id]);
    \mod_quiz\quiz_settings::create($quiz->id)->get_grade_calculator()->recompute_quiz_sumgrades();
    return (int) get_coursemodule_from_instance('quiz', $quiz->id, $course->id, false, MUST_EXIST)->id;
}

$course = $DB->get_record('course', ['shortname' => 'SMETEST']);
if (!$course) {
    $course = $gen->create_course(['shortname' => 'SMETEST', 'fullname' => 'STACK MathQuill Editor tests']);
}
$context = context_course::instance($course->id);
$category = question_make_default_categories([$context]);

$users = ['sme_teacher' => 'editingteacher'];
for ($i = 1; $i <= $students; $i++) {
    $users[sprintf('sme_student%02d', $i)] = 'student';
}
foreach ($users as $username => $role) {
    $user = $DB->get_record('user', ['username' => $username]);
    if (!$user) {
        $user = $gen->create_user(['username' => $username, 'password' => $password,
            'firstname' => $username, 'lastname' => 'SME']);
    }
    $gen->enrol_user($user->id, $course->id, $role);
}

$settingscm = local_stackmatheditor_seed_quiz(
    $gen,
    $course,
    $category,
    'SME Settings Quiz',
    ['stack_algebraic.xml', 'stack_algebraic.xml']
);
$loadcm = local_stackmatheditor_seed_quiz(
    $gen,
    $course,
    $category,
    'SME Load Quiz',
    array_merge(array_fill(0, 8, 'stack_algebraic.xml'), array_fill(0, 2, 'stack_textarea.xml'))
);

// Question bank entry ids of the settings quiz, in slot order (question-level configuration).
$qbeids = $DB->get_fieldset_sql(
    "SELECT qr.questionbankentryid
       FROM {quiz_slots} qs
       JOIN {question_references} qr ON qr.itemid = qs.id
            AND qr.component = 'mod_quiz' AND qr.questionarea = 'slot'
      WHERE qs.quizid = :quizid
   ORDER BY qs.slot",
    ['quizid' => get_coursemodule_from_id('quiz', $settingscm, 0, false, MUST_EXIST)->instance]
);

// Option --reset removes every quiz- and question-level configuration of the settings quiz, so each
// browser test starts from the admin settings alone.
if (in_array('--reset', $argv ?? [], true)) {
    $DB->delete_records('local_stackmatheditor', ['cmid' => $settingscm]);
    echo "reset cmid {$settingscm}\n";
    exit(0);
}

$exports = [
    'SME_BASE_URL' => $CFG->wwwroot,
    'SME_SETTINGS_QBE1' => $qbeids[0] ?? 0,
    'SME_SETTINGS_QBE2' => $qbeids[1] ?? 0,
    'SME_COURSE_ID' => $course->id,
    'SME_SETTINGS_CMID' => $settingscm,
    'SME_LOAD_CMID' => $loadcm,
    'SME_USER_PASS' => $password,
    'SME_STUDENTS' => $students,
];
foreach ($exports as $key => $value) {
    echo "export {$key}='{$value}'\n";
}

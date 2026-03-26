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

require_once(__DIR__ . '/../../config.php');
require_once($CFG->libdir . '/formslib.php');
require_once($CFG->dirroot . '/question/engine/lib.php');
require_once($CFG->dirroot . '/question/engine/bank.php');

use local_stackmatheditor\config_manager;
use local_stackmatheditor\definitions;
use local_stackmatheditor\form\configure_form;

// Parameters.
$cmid       = required_param('cmid', PARAM_INT);
$questionid = optional_param('questionid', 0, PARAM_INT);
$qbeid      = optional_param('qbeid', 0, PARAM_INT);
$returnurl  = optional_param('returnurl', '', PARAM_LOCALURL);

// Determine operating mode.
// Quiz-mode  → neither qbeid nor questionid supplied (or both 0).
// Question-mode → at least one of qbeid / questionid is set.
$quizmode = ($qbeid <= 0 && $questionid <= 0);

// Load quiz / course.
$cm     = get_coursemodule_from_id('quiz', $cmid, 0, false, MUST_EXIST);
$course = get_course($cm->course);
$quiz   = $DB->get_record('quiz', ['id' => $cm->instance], '*', MUST_EXIST);

// Question resolution (question-mode only).
$questionrecord = null;
if (!$quizmode) {
    if ($qbeid <= 0 && $questionid > 0) {
        $qbeid = config_manager::resolve_qbeid($questionid);
    }
    if (!$qbeid) {
        throw new \moodle_exception('cannotresolveqbeid', 'local_stackmatheditor');
    }

    $questionsql = "
        SELECT q.id, q.name, q.qtype, qv.version
          FROM {question} q
          JOIN {question_versions} qv ON qv.questionid = q.id
         WHERE qv.questionbankentryid = :qbeid
      ORDER BY qv.version DESC";
    $questionversions = $DB->get_records_sql($questionsql, ['qbeid' => $qbeid], 0, 1);
    $questionrecord   = $questionversions ? reset($questionversions) : null;

    if (!$questionrecord) {
        throw new \moodle_exception('cannotresolveqbeid', 'local_stackmatheditor');
    }
    if ($questionrecord->qtype !== 'stack') {
        throw new \moodle_exception('notstackquestion', 'local_stackmatheditor');
    }
    $questionid = (int) $questionrecord->id;
}

// Context and permissions.
$context = \context_module::instance($cmid);
require_login($course, false, $cm);
require_capability('mod/quiz:manage', $context);

// Return URL.
if (empty($returnurl)) {
    $returnurl = (new \moodle_url('/mod/quiz/edit.php', ['cmid' => $cmid]))->out(false);
}

// Page setup.
$pageparams = ['cmid' => $cmid];
if (!$quizmode) {
    $pageparams['qbeid'] = $qbeid;
}
if (!empty($returnurl)) {
    $pageparams['returnurl'] = $returnurl;
}
$pageurl = new \moodle_url('/local/stackmatheditor/configure.php', $pageparams);

$PAGE->set_url($pageurl);
$PAGE->set_context($context);
$PAGE->set_pagelayout('admin');

if ($quizmode) {
    $PAGE->set_title(get_string('configure_quiz', 'local_stackmatheditor'));
    $PAGE->set_heading($course->fullname);
    $PAGE->navbar->add($quiz->name,
        new \moodle_url('/mod/quiz/edit.php', ['cmid' => $cmid]));
    $PAGE->navbar->add(get_string('configure_quiz', 'local_stackmatheditor'));
} else {
    $PAGE->set_title(get_string('configure', 'local_stackmatheditor'));
    $PAGE->set_heading($course->fullname);
    $PAGE->navbar->add($quiz->name,
        new \moodle_url('/mod/quiz/edit.php', ['cmid' => $cmid]));
    $PAGE->navbar->add(get_string('configure', 'local_stackmatheditor'));
}

// Instance enabled mode.
$instancemode = config_manager::get_instance_enabled_mode();

// Question preview (question-mode only).
$questionpreviewhtml = '';
if (!$quizmode && $questionrecord) {
    try {
        $question = question_bank::load_question($questionid);
        $quba     = question_engine::make_questions_usage_by_activity(
            'local_stackmatheditor', $context);
        $quba->set_preferred_behaviour('deferredfeedback');
        $slot = $quba->add_question($question);
        $quba->start_question($slot);

        $options                   = new question_display_options();
        $options->readonly         = true;
        $options->flags            = question_display_options::HIDDEN;
        $options->marks            = question_display_options::HIDDEN;
        $options->rightanswer      = question_display_options::HIDDEN;
        $options->manualcomment    = question_display_options::HIDDEN;
        $options->history          = question_display_options::HIDDEN;
        $options->feedback         = question_display_options::HIDDEN;
        $options->numpartscorrect  = question_display_options::HIDDEN;
        $options->generalfeedback  = question_display_options::HIDDEN;
        $options->correctness      = question_display_options::HIDDEN;

        $questionpreviewhtml = $quba->render_question($slot, $options);
    } catch (\Throwable $e) {
        $questionpreviewhtml = '';
    }
}

// Definitions.
$groups      = definitions::get_element_groups();
$grouplabels = definitions::get_group_labels_with_examples();

// Load current config.
if ($quizmode) {
    $existingquizdefault = config_manager::get_quiz_default($cmid);
    if ($existingquizdefault !== null) {
        $config = $existingquizdefault;
    } else {
        // No quiz-level record yet → start from instance defaults.
        $config = config_manager::get_instance_defaults();
    }
} else {
    $config = config_manager::get_config($cmid, $qbeid, $questionid);
}

// Build selected group keys.
$selectedkeys = [];
foreach (array_keys($groups) as $key) {
    if (!empty($config[$key])) {
        $selectedkeys[] = $key;
    }
}

$currentvarmode = $config['_variableMode']
    ?? config_manager::get_instance_variable_mode();

// Determine initial enabled state.
// Always computed so the form can show the correct badge / checkbox value.
//
// Mode 0 → false  (locked off, badge only)
// Mode 1 → true   (locked on,  badge only)
// Mode 2 → derive from stored _enabled, fallback: false  (override allowed)
// Mode 3 → derive from stored _enabled, fallback: true   (override allowed)
//
// For mode 2/3 in question-mode: inherit quiz-level default if no question.
// Record exists yet, then fall back to instance default.
if ($instancemode === 0) {
    $current_enabled = false;
} else if ($instancemode === 1) {
    $current_enabled = true;
} else {
    // Modes 2 and 3 – check stored value first.
    if (isset($config['_enabled'])) {
        $current_enabled = (bool) $config['_enabled'];
    } else if ($quizmode) {
        // Quiz-level, no stored record yet → instance default.
        $current_enabled = ($instancemode === 3);
    } else {
        // Question-level → try quiz-level default, then instance default.
        $quizdefault    = config_manager::get_quiz_default($cmid);
        if ($quizdefault !== null && isset($quizdefault['_enabled'])) {
            $current_enabled = (bool) $quizdefault['_enabled'];
        } else {
            $current_enabled = ($instancemode === 3);
        }
    }
}

// Create form.
$mform = new configure_form($pageurl->out(false), [
    'mode'           => $quizmode ? 'quiz' : 'question',
    'questionrecord' => $questionrecord,
    'quiz'           => $quiz,
    'grouplabels'    => $grouplabels,
    'previewhtml'    => $questionpreviewhtml,
    'returnurl'      => $returnurl,
    'instancemode'   => $instancemode,
]);

// Set current values.
$formdata = [
    'groups'       => $selectedkeys,
    'variablemode' => $currentvarmode,
    'enabled'      => (int) $current_enabled,  // always set; form ignores for mode 0/1
];
$mform->set_data($formdata);

// Process form.
if ($mform->is_cancelled()) {
    redirect(new \moodle_url($returnurl));
} else if ($data = $mform->get_data()) {
    $selectedgroups = $data->groups ?? [];
    $elements       = [];
    foreach (array_keys($groups) as $key) {
        $elements[$key] = in_array($key, $selectedgroups);
    }

    $varmode = $data->variablemode ?? definitions::IMPLICIT_STACK;
    $varmode = definitions::normalise_implicit_mode((string) $varmode);
    $elements['_variableMode'] = $varmode;

    // Store enabled flag when instance mode allows overrides.
    if ($instancemode === 2 || $instancemode === 3) {
        $elements['_enabled'] = isset($data->enabled) ? (bool) $data->enabled : ($instancemode === 3);
    }

    if ($quizmode) {
        config_manager::save_quiz_default($cmid, $elements);
    } else {
        config_manager::save_config($cmid, $qbeid, $elements);
    }

    redirect(
        $pageurl,
        get_string('config_saved', 'local_stackmatheditor'),
        null,
        \core\output\notification::NOTIFY_SUCCESS
    );
}

// Output.
echo $OUTPUT->header();

if ($quizmode) {
    echo $OUTPUT->heading(get_string(
        'configure_quiz_heading', 'local_stackmatheditor', $quiz->name));
} else {
    echo $OUTPUT->heading(get_string(
        'configure_heading', 'local_stackmatheditor', $questionrecord->name));
}

$mform->display();

echo $OUTPUT->footer();

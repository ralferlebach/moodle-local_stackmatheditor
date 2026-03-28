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
 * STACK MathQuill toolbar configuration page.
 *
 * Handles quiz-level configuration for both mod_quiz and mod_adaptivequiz,
 * as well as question-level configuration for mod_quiz.
 *
 * Operating modes
 * ---------------
 * Quiz-mode    : neither qbeid nor questionid supplied (or both 0).
 *                Supported by both mod_quiz and mod_adaptivequiz.
 * Question-mode: at least one of qbeid / questionid is set.
 *                Supported by mod_quiz only; mod_adaptivequiz always uses quiz-mode.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

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

// Resolve the course module without committing to a specific modname yet.
// This allows the page to serve both mod_quiz and mod_adaptivequiz.
$cm = get_coursemodule_from_id(null, $cmid, 0, false, MUST_EXIST);

$modname = $cm->modname;
$isadaptivequiz = ($modname === 'adaptivequiz');
$isquiz         = ($modname === 'quiz');

if (!$isquiz && !$isadaptivequiz) {
    throw new \moodle_exception('invalidcoursemodule');
}

$course = get_course($cm->course);

// Load the activity record.
$activity = $DB->get_record($modname, ['id' => $cm->instance], '*', MUST_EXIST);

// Determine operating mode.
// mod_adaptivequiz always uses quiz-mode (no per-question configuration).
$quizmode = $isadaptivequiz || ($qbeid <= 0 && $questionid <= 0);

// Question resolution (mod_quiz question-mode only).
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

// mod_adaptivequiz does not define a :manage capability; :viewreport is
// granted to editingteacher and manager and is the closest equivalent.
$capname = $isadaptivequiz ? 'mod/adaptivequiz:viewreport' : 'mod/quiz:manage';
require_capability($capname, $context);

// Return URL: used only when the page was opened with an explicit returnurl
// parameter (e.g. from the quiz edit page or an attempt page).
// When called from the standard settings navigation no returnurl is supplied,
// which suppresses the "Back" button in the form and the is_cancelled redirect.

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

// Page title, heading, and breadcrumb.
if ($quizmode) {
    if ($isadaptivequiz) {
        $PAGE->set_title(get_string('configure_adaptivequiz', 'local_stackmatheditor'));
        $PAGE->set_heading($course->fullname);
        $PAGE->navbar->add(
            $activity->name,
            new \moodle_url('/mod/adaptivequiz/view.php', ['id' => $cmid])
        );
        $PAGE->navbar->add(get_string('configure_adaptivequiz', 'local_stackmatheditor'));
    } else {
        $PAGE->set_title(get_string('configure_quiz', 'local_stackmatheditor'));
        $PAGE->set_heading($course->fullname);
        $PAGE->navbar->add(
            $activity->name,
            new \moodle_url('/mod/quiz/edit.php', ['cmid' => $cmid])
        );
        $PAGE->navbar->add(get_string('configure_quiz', 'local_stackmatheditor'));
    }
} else {
    $PAGE->set_title(get_string('configure', 'local_stackmatheditor'));
    $PAGE->set_heading($course->fullname);
    $PAGE->navbar->add(
        $activity->name,
        new \moodle_url('/mod/quiz/edit.php', ['cmid' => $cmid])
    );
    $PAGE->navbar->add(get_string('configure', 'local_stackmatheditor'));
}

// Instance enabled mode.
$instancemode = config_manager::get_instance_enabled_mode();

// Question preview (mod_quiz question-mode only).
$questionpreviewhtml = '';
if (!$quizmode && $questionrecord) {
    try {
        $question = question_bank::load_question($questionid);
        $quba = question_engine::make_questions_usage_by_activity(
            'local_stackmatheditor',
            $context
        );
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
if ($instancemode === 0) {
    $currentenabled = false;
} else if ($instancemode === 1) {
    $currentenabled = true;
} else {
    // Modes 2 and 3 – check stored value first.
    if (isset($config['_enabled'])) {
        $currentenabled = (bool) $config['_enabled'];
    } else if ($quizmode) {
        // Quiz-level, no stored record yet → instance default.
        $currentenabled = ($instancemode === 3);
    } else {
        // Question-level → try quiz-level default, then instance default.
        $quizdefault    = config_manager::get_quiz_default($cmid);
        if ($quizdefault !== null && isset($quizdefault['_enabled'])) {
            $currentenabled = (bool) $quizdefault['_enabled'];
        } else {
            $currentenabled = ($instancemode === 3);
        }
    }
}

// Create form.
$mform = new configure_form($pageurl->out(false), [
    'mode'           => $quizmode ? 'quiz' : 'question',
    'modname'        => $modname,
    'questionrecord' => $questionrecord,
    'activity'       => $activity,
    'grouplabels'    => $grouplabels,
    'previewhtml'    => $questionpreviewhtml,
    'returnurl'      => $returnurl,
    'instancemode'   => $instancemode,
]);

// Set current values.
$formdata = [
    'groups'       => $selectedkeys,
    'variablemode' => $currentvarmode,
    'enabled'      => (int) $currentenabled,
];
$mform->set_data($formdata);

// Process form.
// is_cancelled() is only meaningful when there is a "Back" button, which is
// rendered only when $returnurl is non-empty.  Without a returnurl the form
// has no cancel button, so this branch is never reached; the guard prevents
// a redirect to an empty URL if the form is somehow submitted cancelled.
if ($mform->is_cancelled()) {
    if (!empty($returnurl)) {
        redirect(new \moodle_url($returnurl));
    }
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
        $elements['_enabled'] = isset($data->enabled)
            ? (bool) $data->enabled
            : ($instancemode === 3);
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
    if ($isadaptivequiz) {
        echo $OUTPUT->heading(
            get_string('configure_adaptivequiz_heading', 'local_stackmatheditor', $activity->name)
        );
    } else {
        echo $OUTPUT->heading(
            get_string('configure_quiz_heading', 'local_stackmatheditor', $activity->name)
        );
    }
} else {
    echo $OUTPUT->heading(
        get_string('configure_heading', 'local_stackmatheditor', $questionrecord->name)
    );
}

$mform->display();

echo $OUTPUT->footer();

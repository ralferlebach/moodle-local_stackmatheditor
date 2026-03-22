<?php
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

// Resolve qbeid.
if ($qbeid <= 0 && $questionid > 0) {
    $qbeid = config_manager::resolve_qbeid($questionid);
}
if (!$qbeid) {
    throw new \moodle_exception(
        'cannotresolveqbeid', 'local_stackmatheditor');
}

// Load quiz.
$cm = get_coursemodule_from_id(
    'quiz', $cmid, 0, false, MUST_EXIST);
$course = get_course($cm->course);
$quiz = $DB->get_record(
    'quiz', ['id' => $cm->instance], '*', MUST_EXIST);

// Load latest question version.
$questionsql = "
    SELECT q.id, q.name, q.qtype, qv.version
      FROM {question} q
      JOIN {question_versions} qv ON qv.questionid = q.id
     WHERE qv.questionbankentryid = :qbeid
  ORDER BY qv.version DESC";
$questionversions = $DB->get_records_sql(
    $questionsql, ['qbeid' => $qbeid], 0, 1);
$questionrecord = $questionversions
    ? reset($questionversions) : null;

if (!$questionrecord) {
    throw new \moodle_exception(
        'cannotresolveqbeid', 'local_stackmatheditor');
}
if ($questionrecord->qtype !== 'stack') {
    throw new \moodle_exception(
        'notstackquestion', 'local_stackmatheditor');
}

$questionid = (int) $questionrecord->id;

// Context and permissions.
$context = \context_module::instance($cmid);
require_login($course, false, $cm);
require_capability('mod/quiz:manage', $context);

// Default return URL.
if (empty($returnurl)) {
    $returnurl = (new \moodle_url(
        '/mod/quiz/view.php', ['id' => $cmid]
    ))->out(false);
}

// Page setup.
$pageparams = [
    'cmid'  => $cmid,
    'qbeid' => $qbeid,
];
if (!empty($returnurl)) {
    $pageparams['returnurl'] = $returnurl;
}
$pageurl = new \moodle_url(
    '/local/stackmatheditor/configure.php', $pageparams);

$PAGE->set_url($pageurl);
$PAGE->set_context($context);
$PAGE->set_pagelayout('admin');
$PAGE->set_title(
    get_string('configure', 'local_stackmatheditor'));
$PAGE->set_heading($course->fullname);
$PAGE->navbar->add($quiz->name,
    new \moodle_url('/mod/quiz/view.php', ['id' => $cmid]));
$PAGE->navbar->add(
    get_string('configure', 'local_stackmatheditor'));

// Render question preview.
$questionpreviewhtml = '';
try {
    $question = question_bank::load_question($questionid);
    $quba = question_engine::make_questions_usage_by_activity(
        'local_stackmatheditor', $context);
    $quba->set_preferred_behaviour('deferredfeedback');
    $slot = $quba->add_question($question);
    $quba->start_question($slot);

    $options = new question_display_options();
    $options->readonly = true;
    $options->flags = question_display_options::HIDDEN;
    $options->marks = question_display_options::HIDDEN;
    $options->rightanswer = question_display_options::HIDDEN;
    $options->manualcomment = question_display_options::HIDDEN;
    $options->history = question_display_options::HIDDEN;
    $options->feedback = question_display_options::HIDDEN;
    $options->numpartscorrect = question_display_options::HIDDEN;
    $options->generalfeedback = question_display_options::HIDDEN;
    $options->correctness = question_display_options::HIDDEN;

    $questionpreviewhtml = $quba->render_question(
        $slot, $options);
} catch (\Throwable $e) {
    $questionpreviewhtml = '';
}

// Definitions.
$groups = definitions::get_element_groups();
$grouplabels = definitions::get_group_labels_with_examples();

// Load current config.
$config = config_manager::get_config(
    $cmid, $qbeid, $questionid);

// Build currently selected group keys.
$selectedkeys = [];
foreach (array_keys($groups) as $key) {
    if (!empty($config[$key])) {
        $selectedkeys[] = $key;
    }
}

$currentvarmode = $config['_variableMode']
    ?? config_manager::get_instance_variable_mode();

// Create form.
$mform = new configure_form($pageurl->out(false), [
    'questionrecord' => $questionrecord,
    'quiz'           => $quiz,
    'grouplabels'    => $grouplabels,
    'previewhtml'    => $questionpreviewhtml,
    'returnurl'      => $returnurl,
]);

// Set current values.
$mform->set_data([
    'groups'       => $selectedkeys,
    'variablemode' => $currentvarmode,
]);

// Process form.
if ($mform->is_cancelled()) {
    redirect(new \moodle_url($returnurl));
} else if ($data = $mform->get_data()) {
    $selectedgroups = $data->groups ?? [];

    $elements = [];
    foreach (array_keys($groups) as $key) {
        $elements[$key] = in_array($key, $selectedgroups);
    }

    $varmode = $data->variablemode ?? definitions::VAR_SINGLE;
    if ($varmode !== definitions::VAR_SINGLE
        && $varmode !== definitions::VAR_MULTI) {
        $varmode = definitions::VAR_SINGLE;
    }
    $elements['_variableMode'] = $varmode;

    config_manager::save_config($cmid, $qbeid, $elements);

    redirect(
        $pageurl,
        get_string('config_saved', 'local_stackmatheditor'),
        null,
        \core\output\notification::NOTIFY_SUCCESS
    );
}

// Output.
echo $OUTPUT->header();
echo $OUTPUT->heading(get_string('configure_heading',
    'local_stackmatheditor', $questionrecord->name));

$mform->display();

echo $OUTPUT->footer();

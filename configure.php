<?php
require_once(__DIR__ . '/../../config.php');

use local_stackmatheditor\config_manager;
use local_stackmatheditor\definitions;

// ---------- Parameters ----------
// cmid is required (identifies the quiz).
$cmid = required_param('cmid', PARAM_INT);

// Accept EITHER questionid OR qbeid (or both).
$questionid = optional_param('questionid', 0, PARAM_INT);
$qbeid      = optional_param('qbeid', 0, PARAM_INT);

// ---------- Resolve qbeid ----------
// Always work with qbeid. If questionid is given, resolve it.
if ($qbeid <= 0 && $questionid > 0) {
    $qbeid = config_manager::resolve_qbeid($questionid);
}
if (!$qbeid) {
    throw new \moodle_exception('cannotresolveqbeid', 'local_stackmatheditor');
}

// ---------- Load quiz ----------
$cm     = get_coursemodule_from_id('quiz', $cmid, 0, false, MUST_EXIST);
$course = get_course($cm->course);
$quiz   = $DB->get_record('quiz', ['id' => $cm->instance], '*', MUST_EXIST);

// ---------- Load question info for display ----------
// Find the latest question version for this qbeid (for name/title display).
$questionsql = "SELECT q.id, q.name, q.qtype, qv.version
                  FROM {question} q
                  JOIN {question_versions} qv ON qv.questionid = q.id
                 WHERE qv.questionbankentryid = :qbeid
              ORDER BY qv.version DESC";
$questionversions = $DB->get_records_sql($questionsql, ['qbeid' => $qbeid], 0, 1);
$questionrecord = $questionversions ? reset($questionversions) : null;

if (!$questionrecord) {
    throw new \moodle_exception('cannotresolveqbeid', 'local_stackmatheditor');
}
if ($questionrecord->qtype !== 'stack') {
    throw new \moodle_exception('notstackquestion', 'local_stackmatheditor');
}

// For legacy compatibility: store the resolved questionid.
$questionid = (int) $questionrecord->id;

// ---------- Context and permissions ----------
$context = \context_module::instance($cmid);
require_login($course, false, $cm);
require_capability('local/stackmatheditor:configure', $context);

// ---------- Page setup ----------
// URL always uses qbeid as canonical identifier.
$pageurl = new \moodle_url('/local/stackmatheditor/configure.php', [
    'cmid'  => $cmid,
    'qbeid' => $qbeid,
]);
$PAGE->set_url($pageurl);
$PAGE->set_context($context);
$PAGE->set_title(get_string('configure', 'local_stackmatheditor'));
$PAGE->set_heading(get_string('configure_heading', 'local_stackmatheditor',
    $questionrecord->name));

// Breadcrumb.
$PAGE->navbar->add($quiz->name,
    new \moodle_url('/mod/quiz/view.php', ['id' => $cmid]));
$PAGE->navbar->add(get_string('configure', 'local_stackmatheditor'));

// ---------- Element group definitions ----------
$groups = definitions::get_element_groups();

// ---------- Process form submission ----------
if ($_SERVER['REQUEST_METHOD'] === 'POST' && confirm_sesskey()) {
    $elements = [];
    foreach (array_keys($groups) as $key) {
        $elements[$key] = !empty(optional_param($key, 0, PARAM_BOOL));
    }

    // Variable mode.
    $varmode = optional_param('variablemode', definitions::VAR_SINGLE, PARAM_ALPHA);
    if ($varmode !== definitions::VAR_SINGLE && $varmode !== definitions::VAR_MULTI) {
        $varmode = definitions::VAR_SINGLE;
    }
    $elements['_variableMode'] = $varmode;

    // Save: always uses cmid + qbeid.
    config_manager::save_config($cmid, $qbeid, $elements);

    redirect(
        $pageurl,
        get_string('config_saved', 'local_stackmatheditor'),
        null,
        \core\output\notification::NOTIFY_SUCCESS
    );
}

// ---------- Load current configuration ----------
$config = config_manager::get_config($cmid, $qbeid, $questionid);

// ---------- Output ----------
echo $OUTPUT->header();
echo $OUTPUT->heading(get_string('configure_heading', 'local_stackmatheditor',
    $questionrecord->name));

// Info box.
echo html_writer::start_div('alert alert-secondary mb-3');
echo html_writer::tag('strong', get_string('modulename', 'quiz') . ': ');
echo format_string($quiz->name);
echo html_writer::empty_tag('br');
echo html_writer::tag('strong', get_string('question') . ': ');
echo format_string($questionrecord->name);
echo html_writer::tag('span',
    ' (v' . $questionrecord->version . ')',
    ['class' => 'text-muted']);
echo html_writer::end_div();

// Debug info for admins.
if (is_siteadmin()) {
    $col = config_manager::get_config_column_public();
    $rawrecord = $DB->get_records_select(
        config_manager::TABLE,
        "cmid = :cmid AND questionbankentryid = :qbeid",
        ['cmid' => $cmid, 'qbeid' => $qbeid],
        'timemodified DESC',
        '*', 0, 1
    );
    $rawrecord = $rawrecord ? reset($rawrecord) : null;

    // Also check for any legacy/global records.
    $anyrecords = $DB->get_records_select(
        config_manager::TABLE,
        "questionbankentryid = :qbeid",
        ['qbeid' => $qbeid],
        'timemodified DESC'
    );

    echo html_writer::start_div('alert alert-info');
    echo html_writer::tag('strong', 'Debug Info:');
    echo html_writer::empty_tag('br');
    echo "cmid: {$cmid} | qbeid: {$qbeid} | questionid (latest version): {$questionid}";
    echo html_writer::empty_tag('br');

    // List all question versions for this qbeid.
    $allversions = $DB->get_records_sql(
        "SELECT qv.questionid, qv.version FROM {question_versions} qv
          WHERE qv.questionbankentryid = :qbeid ORDER BY qv.version DESC",
        ['qbeid' => $qbeid]
    );
    echo 'Question versions: ';
    $vstrings = [];
    foreach ($allversions as $v) {
        $vstrings[] = "v{$v->version} (qid={$v->questionid})";
    }
    echo implode(', ', $vstrings);
    echo html_writer::empty_tag('br');

    if ($rawrecord) {
        echo html_writer::tag('strong', 'Exact DB record (cmid+qbeid):');
        echo html_writer::empty_tag('br');
        echo "  id={$rawrecord->id}, modified=" . userdate($rawrecord->timemodified);
    } else {
        echo html_writer::tag('strong', 'No exact DB record for cmid+qbeid.');
    }
    echo html_writer::empty_tag('br');

    echo 'All records for qbeid=' . $qbeid . ': ' . count($anyrecords);
    foreach ($anyrecords as $ar) {
        $arcol = $ar->$col ?? 'NULL';
        echo html_writer::empty_tag('br');
        echo "  id={$ar->id} cmid={$ar->cmid} qid={$ar->questionid} " .
            "config=" . s(mb_substr($arcol, 0, 80)) . '...';
    }
    echo html_writer::empty_tag('br');

    echo html_writer::tag('strong', 'Active config (merged):');
    echo '<pre style="font-size:0.8em;max-height:200px;overflow:auto;">'
        . s(json_encode($config, JSON_PRETTY_PRINT)) . '</pre>';
    echo html_writer::end_div();
}

// ---------- Form ----------
echo html_writer::start_tag('form', [
    'method' => 'post',
    'action' => $pageurl->out(false),
    'class'  => 'sme-config-form',
]);
echo html_writer::empty_tag('input', [
    'type' => 'hidden', 'name' => 'sesskey', 'value' => sesskey(),
]);

// Element group toggles.
echo html_writer::tag('h4',
    get_string('setting_defaultgroups', 'local_stackmatheditor'),
    ['class' => 'mt-3']);

echo html_writer::start_div('container-fluid mt-2');
foreach ($groups as $key => $group) {
    $checked = isset($config[$key]) ? (bool) $config[$key] : $group['default_enabled'];

    echo html_writer::start_div('form-check form-switch mb-2');
    $attrs = [
        'type'  => 'checkbox',
        'name'  => $key,
        'value' => '1',
        'id'    => 'sme_' . $key,
        'class' => 'form-check-input',
    ];
    if ($checked) {
        $attrs['checked'] = 'checked';
    }
    echo html_writer::empty_tag('input', $attrs);
    echo html_writer::tag('label',
        get_string($group['langkey'], 'local_stackmatheditor'),
        ['class' => 'form-check-label', 'for' => 'sme_' . $key]);
    echo html_writer::end_div();
}
echo html_writer::end_div();

// Variable mode selector.
echo html_writer::tag('h4',
    get_string('label_variablemode', 'local_stackmatheditor'),
    ['class' => 'mt-4']);

$currentvarmode = $config['_variableMode']
    ?? config_manager::get_instance_variable_mode();

echo html_writer::start_div('mb-3');
echo html_writer::select(
    [
        definitions::VAR_SINGLE =>
            get_string('variablemode_single', 'local_stackmatheditor'),
        definitions::VAR_MULTI =>
            get_string('variablemode_multi', 'local_stackmatheditor'),
    ],
    'variablemode',
    $currentvarmode,
    null,
    ['class' => 'form-select w-auto', 'id' => 'sme_varmode']
);
echo html_writer::end_div();

// Submit.
echo html_writer::tag('button',
    get_string('save', 'local_stackmatheditor'),
    ['type' => 'submit', 'class' => 'btn btn-primary mt-3']);
echo html_writer::end_tag('form');

echo $OUTPUT->footer();

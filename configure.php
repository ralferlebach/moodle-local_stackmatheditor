<?php
require_once(__DIR__ . '/../../config.php');

use local_stackmatheditor\config_manager;
use local_stackmatheditor\definitions;

// Parameters.
$cmid       = required_param('cmid', PARAM_INT);
$questionid = optional_param('questionid', 0, PARAM_INT);
$qbeid      = optional_param('qbeid', 0, PARAM_INT);

// Resolve qbeid.
if ($qbeid <= 0 && $questionid > 0) {
    $qbeid = config_manager::resolve_qbeid($questionid);
}
if (!$qbeid) {
    throw new \moodle_exception('cannotresolveqbeid', 'local_stackmatheditor');
}

// Load quiz.
$cm     = get_coursemodule_from_id('quiz', $cmid, 0, false, MUST_EXIST);
$course = get_course($cm->course);
$quiz   = $DB->get_record('quiz', ['id' => $cm->instance], '*', MUST_EXIST);

// Load latest question version.
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

$questionid = (int) $questionrecord->id;

// Context and permissions.
$context = \context_module::instance($cmid);
require_login($course, false, $cm);
require_capability('local/stackmatheditor:configure', $context);

// Page setup — URL always uses qbeid.
$pageurl = new \moodle_url('/local/stackmatheditor/configure.php', [
    'cmid'  => $cmid,
    'qbeid' => $qbeid,
]);
$PAGE->set_url($pageurl);
$PAGE->set_context($context);
$PAGE->set_title(get_string('configure', 'local_stackmatheditor'));
$PAGE->set_heading(get_string('configure_heading', 'local_stackmatheditor',
    $questionrecord->name));
$PAGE->navbar->add($quiz->name,
    new \moodle_url('/mod/quiz/view.php', ['id' => $cmid]));
$PAGE->navbar->add(get_string('configure', 'local_stackmatheditor'));

// Definitions.
$groups = definitions::get_element_groups();
$grouplabels = definitions::get_group_labels_with_examples();

// Process form.
if ($_SERVER['REQUEST_METHOD'] === 'POST' && confirm_sesskey()) {
    $selectedgroups = optional_param_array('groups', [], PARAM_ALPHA);

    $elements = [];
    foreach (array_keys($groups) as $key) {
        $elements[$key] = in_array($key, $selectedgroups);
    }

    $varmode = optional_param('variablemode', definitions::VAR_SINGLE, PARAM_ALPHA);
    if ($varmode !== definitions::VAR_SINGLE && $varmode !== definitions::VAR_MULTI) {
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

// Load current config.
$config = config_manager::get_config($cmid, $qbeid, $questionid);

// Build selected keys list.
$selectedkeys = [];
foreach (array_keys($groups) as $key) {
    if (!empty($config[$key])) {
        $selectedkeys[] = $key;
    }
}

// Output.
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
echo html_writer::tag('span', ' (v' . $questionrecord->version . ')',
    ['class' => 'text-muted']);
echo html_writer::end_div();

// Debug for admins.
if (is_siteadmin() && false) {
    $col = config_manager::get_config_column_public();
    $anyrecords = $DB->get_records_select(
        config_manager::TABLE,
        "questionbankentryid = :qbeid",
        ['qbeid' => $qbeid],
        'timemodified DESC'
    );
    $exactrecord = $DB->get_records_select(
        config_manager::TABLE,
        "cmid = :cmid AND questionbankentryid = :qbeid",
        ['cmid' => $cmid, 'qbeid' => $qbeid],
        'timemodified DESC', '*', 0, 1
    );
    $exactrecord = $exactrecord ? reset($exactrecord) : null;

    $allversions = $DB->get_records_sql(
        "SELECT qv.questionid, qv.version FROM {question_versions} qv
          WHERE qv.questionbankentryid = :qbeid ORDER BY qv.version DESC",
        ['qbeid' => $qbeid]
    );

    echo html_writer::start_div('alert alert-info');
    echo html_writer::tag('strong', 'Debug Info:');
    echo html_writer::empty_tag('br');
    echo "cmid: {$cmid} | qbeid: {$qbeid} | questionid (latest): {$questionid}";
    echo html_writer::empty_tag('br');
    echo 'Versions: ';
    $vstrings = [];
    foreach ($allversions as $v) {
        $vstrings[] = "v{$v->version} (qid={$v->questionid})";
    }
    echo implode(', ', $vstrings);
    echo html_writer::empty_tag('br');

    if ($exactrecord) {
        echo "Exact record: id={$exactrecord->id}, modified="
            . userdate($exactrecord->timemodified);
    } else {
        echo 'No exact record for cmid+qbeid.';
    }
    echo html_writer::empty_tag('br');
    echo 'All records for qbeid: ' . count($anyrecords);
    echo html_writer::empty_tag('br');
    echo html_writer::tag('strong', 'Active config:');
    echo '<pre style="font-size:0.8em;max-height:150px;overflow:auto;">'
        . s(json_encode($config, JSON_PRETTY_PRINT)) . '</pre>';
    echo html_writer::end_div();
}

// Form.
echo html_writer::start_tag('form', [
    'method' => 'post',
    'action' => $pageurl->out(false),
    'class'  => 'sme-config-form',
]);
echo html_writer::empty_tag('input', [
    'type' => 'hidden', 'name' => 'sesskey', 'value' => sesskey(),
]);

// Element groups multiselect.
echo html_writer::tag('h4',
    get_string('setting_defaultgroups', 'local_stackmatheditor'),
    ['class' => 'mt-3']);
echo html_writer::tag('p',
    get_string('setting_defaultgroups_desc', 'local_stackmatheditor'),
    ['class' => 'text-muted small']);

$selectsize = count($grouplabels);
echo html_writer::start_div('mb-3');
echo '<select name="groups[]" id="sme_groups" class="form-select"'
    . ' multiple="multiple" size="' . $selectsize . '">';
foreach ($grouplabels as $key => $label) {
    $selected = in_array($key, $selectedkeys) ? ' selected="selected"' : '';
    echo '<option value="' . s($key) . '"' . $selected . '>'
        . s($label) . '</option>';
}
echo '</select>';
echo html_writer::end_div();

// Variable mode.
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

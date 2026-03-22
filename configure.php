<?php
require_once(__DIR__ . '/../../config.php');

use local_stackmatheditor\config_manager;
use local_stackmatheditor\definitions;

$cmid       = required_param('cmid', PARAM_INT);
$questionid = required_param('questionid', PARAM_INT);

$cm     = get_coursemodule_from_id('quiz', $cmid, 0, false, MUST_EXIST);
$course = get_course($cm->course);
$quiz   = $DB->get_record('quiz', ['id' => $cm->instance], '*', MUST_EXIST);

$questionrecord = $DB->get_record('question', ['id' => $questionid], '*', MUST_EXIST);
if ($questionrecord->qtype !== 'stack') {
    throw new \moodle_exception('notstackquestion', 'local_stackmatheditor');
}

$qbeid = config_manager::resolve_qbeid($questionid);
if (!$qbeid) {
    throw new \moodle_exception('cannotresolveqbeid', 'local_stackmatheditor');
}

$context = \context_module::instance($cmid);
require_login($course, false, $cm);
require_capability('local/stackmatheditor:configure', $context);

$pageurl = new \moodle_url('/local/stackmatheditor/configure.php', [
    'cmid' => $cmid, 'questionid' => $questionid,
]);
$PAGE->set_url($pageurl);
$PAGE->set_context($context);
$PAGE->set_title(get_string('configure', 'local_stackmatheditor'));
$PAGE->set_heading(get_string('configure_heading', 'local_stackmatheditor',
    $questionrecord->name));
$PAGE->navbar->add($quiz->name, new \moodle_url('/mod/quiz/view.php', ['id' => $cmid]));
$PAGE->navbar->add(get_string('configure', 'local_stackmatheditor'));

// Process form.
if ($_SERVER['REQUEST_METHOD'] === 'POST' && confirm_sesskey()) {
    $groups = definitions::get_element_groups();
    $elements = [];
    foreach (array_keys($groups) as $key) {
        $elements[$key] = !empty(optional_param($key, 0, PARAM_BOOL));
    }
    // Variable mode for this question.
    $varmode = optional_param('variablemode', definitions::VAR_SINGLE, PARAM_ALPHA);
    $elements['_variableMode'] = $varmode;

    config_manager::save_config($cmid, $qbeid, $elements);
    redirect($pageurl,
        get_string('config_saved', 'local_stackmatheditor'),
        null, \core\output\notification::NOTIFY_SUCCESS);
}

// Load current config.
$config = config_manager::get_config($cmid, $qbeid, $questionid);
$groups = definitions::get_element_groups();

// Output.
echo $OUTPUT->header();
echo $OUTPUT->heading(get_string('configure_heading', 'local_stackmatheditor',
    $questionrecord->name));

echo html_writer::start_div('alert alert-secondary mb-3');
echo html_writer::tag('strong', get_string('quiz', 'quiz') . ': ');
echo format_string($quiz->name);
echo html_writer::empty_tag('br');
echo html_writer::tag('strong', get_string('question', 'question') . ': ');
echo format_string($questionrecord->name);
echo html_writer::end_div();

echo html_writer::start_tag('form', [
    'method' => 'post', 'action' => $pageurl->out(false), 'class' => 'sme-config-form',
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
    $checked = $config[$key] ?? $group['default_enabled'];
    echo html_writer::start_div('form-check form-switch mb-2');
    $attrs = [
        'type' => 'checkbox', 'name' => $key, 'value' => '1',
        'id' => 'sme_' . $key, 'class' => 'form-check-input',
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

$currentvarmode = $config['_variableMode'] ?? config_manager::get_instance_variable_mode();
echo html_writer::start_div('mb-3');
echo html_writer::select([
    definitions::VAR_SINGLE =>
        get_string('variablemode_single', 'local_stackmatheditor'),
    definitions::VAR_MULTI =>
        get_string('variablemode_multi', 'local_stackmatheditor'),
], 'variablemode', $currentvarmode, null,
    ['class' => 'form-select w-auto', 'id' => 'sme_varmode']);
echo html_writer::end_div();

echo html_writer::tag('button',
    get_string('save', 'local_stackmatheditor'),
    ['type' => 'submit', 'class' => 'btn btn-primary mt-3']);
echo html_writer::end_tag('form');

echo $OUTPUT->footer();

<?php
require_once(__DIR__ . '/../../config.php');

use local_stackmatheditor\config_manager;

$questionid = required_param('questionid', PARAM_INT);

$questionrecord = $DB->get_record('question', ['id' => $questionid], '*', MUST_EXIST);

if ($questionrecord->qtype !== 'stack') {
    throw new \moodle_exception('notstackquestion', 'local_stackmatheditor');
}

$context = \context_system::instance();
require_login();
require_capability('local/stackmatheditor:configure', $context);

$pageurl = new \moodle_url('/local/stackmatheditor/configure.php', ['questionid' => $questionid]);
$PAGE->set_url($pageurl);
$PAGE->set_context($context);
$PAGE->set_title(get_string('configure', 'local_stackmatheditor'));
$PAGE->set_heading(get_string('configure_heading', 'local_stackmatheditor', $questionrecord->name));

if ($_SERVER['REQUEST_METHOD'] === 'POST' && confirm_sesskey()) {
    $elements = [];
    foreach (array_keys(config_manager::DEFAULT_ELEMENTS) as $key) {
        $elements[$key] = !empty(optional_param($key, 0, PARAM_BOOL));
    }
    config_manager::save_config($questionid, $elements);
    redirect(
        $pageurl,
        get_string('config_saved', 'local_stackmatheditor'),
        null,
        \core\output\notification::NOTIFY_SUCCESS
    );
}

$config = config_manager::get_config($questionid);

echo $OUTPUT->header();
echo $OUTPUT->heading(get_string('configure_heading', 'local_stackmatheditor', $questionrecord->name));

echo html_writer::start_tag('form', [
    'method' => 'post',
    'action' => $pageurl->out(false),
    'class'  => 'sme-config-form',
]);
echo html_writer::empty_tag('input', [
    'type' => 'hidden', 'name' => 'sesskey', 'value' => sesskey(),
]);

echo html_writer::start_div('container-fluid mt-3');
foreach (config_manager::DEFAULT_ELEMENTS as $key => $default) {
    $checked = $config[$key] ?? $default;
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
        get_string('element_' . $key, 'local_stackmatheditor'),
        ['class' => 'form-check-label', 'for' => 'sme_' . $key]
    );
    echo html_writer::end_div();
}
echo html_writer::end_div();

echo html_writer::tag('button',
    get_string('save', 'local_stackmatheditor'),
    ['type' => 'submit', 'class' => 'btn btn-primary mt-3']
);
echo html_writer::end_tag('form');

echo $OUTPUT->footer();

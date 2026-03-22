<?php
namespace local_stackmatheditor\form;

defined('MOODLE_INTERNAL') || die();

use local_stackmatheditor\definitions;

/**
 * Form for configuring MathQuill toolbar per question.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Your Name
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class configure_form extends \moodleform {

    /**
     * Form definition.
     */
    protected function definition() {
        $mform = $this->_form;
        $customdata = $this->_customdata;

        $questionrecord = $customdata['questionrecord'];
        $quiz           = $customdata['quiz'];
        $grouplabels    = $customdata['grouplabels'];
        $previewhtml    = $customdata['previewhtml'] ?? '';
        $returnurl      = $customdata['returnurl'] ?? '';

        // Hidden return URL.
        $mform->addElement('hidden', 'returnurl', $returnurl);
        $mform->setType('returnurl', PARAM_LOCALURL);

        // Info section.
        $mform->addElement('header', 'infosection',
            get_string('configure', 'local_stackmatheditor'));

        $mform->addElement('static', 'quizname',
            get_string('modulename', 'quiz'),
            format_string($quiz->name));

        $mform->addElement('static', 'questionname',
            get_string('question'),
            format_string($questionrecord->name)
            . ' <span class="text-muted">(v'
            . $questionrecord->version . ')</span>');

        if (!empty($previewhtml)) {
            $collapseid = 'sme-question-preview';
            $previewbutton = '<a class="btn btn-outline-secondary btn-sm"'
                . ' data-toggle="collapse" href="#' . $collapseid . '"'
                . ' role="button" aria-expanded="false"'
                . ' aria-controls="' . $collapseid . '">'
                . get_string('questionpreview', 'local_stackmatheditor')
                . '</a>';
            $previewcontent = '<div class="collapse mt-2" id="'
                . $collapseid . '">'
                . '<div class="card card-body">'
                . $previewhtml . '</div></div>';

            $mform->addElement('static', 'preview',
                get_string('questionpreview', 'local_stackmatheditor'),
                $previewbutton . $previewcontent);
        }

        // Toolbar groups section.
        $mform->addElement('header', 'toolbarsection',
            get_string('setting_defaultgroups',
                'local_stackmatheditor'));
        $mform->setExpanded('toolbarsection', true);

        $select = $mform->addElement('select', 'groups',
            get_string('setting_defaultgroups',
                'local_stackmatheditor'),
            $grouplabels);
        $select->setMultiple(true);
        $select->setSize(count($grouplabels));
        $mform->addHelpButton('groups', 'setting_defaultgroups',
            'local_stackmatheditor');

        // Variable mode section.
        $mform->addElement('header', 'variablesection',
            get_string('label_variablemode',
                'local_stackmatheditor'));
        $mform->setExpanded('variablesection', true);

        $mform->addElement('select', 'variablemode',
            get_string('label_variablemode',
                'local_stackmatheditor'),
            [
                definitions::VAR_SINGLE =>
                    get_string('variablemode_single',
                        'local_stackmatheditor'),
                definitions::VAR_MULTI =>
                    get_string('variablemode_multi',
                        'local_stackmatheditor'),
            ]);
        $mform->setDefault('variablemode', definitions::VAR_SINGLE);

        // Action buttons.
        $this->add_action_buttons(true,
            get_string('save', 'local_stackmatheditor'));
    }
}

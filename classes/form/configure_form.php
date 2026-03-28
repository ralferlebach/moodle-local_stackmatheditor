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

namespace local_stackmatheditor\form;

use local_stackmatheditor\definitions;

/**
 * Form for configuring MathQuill toolbar per question or per quiz/activity.
 *
 * Operates in two modes depending on $customdata['mode']:
 *   'question' – configure a single STACK question (cmid + qbeid)
 *                (mod_quiz only)
 *   'quiz'     – configure activity-level defaults  (cmid only, qbeid IS NULL)
 *                (mod_quiz and mod_adaptivequiz)
 *
 * The 'modname' customdata value distinguishes the parent activity:
 *   'quiz'         – standard mod_quiz
 *   'adaptivequiz' – mod_adaptivequiz
 *
 * The 'instancemode' customdata value (0-3) controls the enabled section:
 *   0 – globally off, no override: shows locked-off badge (read-only)
 *   1 – globally on,  no override: shows locked-on  badge (read-only)
 *   2 – default off, override allowed: shows checkbox, default unchecked
 *   3 – default on,  override allowed: shows checkbox, default checked
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class configure_form extends \moodleform {
    /**
     * Build the form elements.
     *
     * @return void
     */
    protected function definition(): void {
        $mform      = $this->_form;
        $customdata = $this->_customdata;

        $mode           = $customdata['mode'] ?? 'question';
        $modname        = $customdata['modname'] ?? 'quiz';
        $questionrecord = $customdata['questionrecord'] ?? null;
        // Backwards-compatible: callers may pass 'quiz' or 'activity'.
        $activity       = $customdata['activity'] ?? ($customdata['quiz'] ?? null);
        $grouplabels    = $customdata['grouplabels'];
        $previewhtml    = $customdata['previewhtml'] ?? '';
        $returnurl      = $customdata['returnurl'] ?? '';
        $instancemode   = (int) ($customdata['instancemode'] ?? 1);
        $isadaptivequiz = ($modname === 'adaptivequiz');

        // Info section.
        $mform->addElement(
            'header',
            'infosection',
            get_string('configure', 'local_stackmatheditor')
        );

        // Activity name row: use the correct module string for the label.
        $activitylabelstr = $isadaptivequiz
            ? get_string('modulename', 'adaptivequiz')
            : get_string('modulename', 'quiz');

        $mform->addElement(
            'static',
            'activityname',
            $activitylabelstr,
            format_string($activity->name)
        );

        if ($mode === 'question' && $questionrecord) {
            $mform->addElement(
                'static',
                'questionname',
                get_string('question'),
                format_string($questionrecord->name)
                    . ' <span class="text-muted">(v'
                    . $questionrecord->version . ')</span>'
            );

            if (!empty($previewhtml)) {
                $collapseid    = 'sme-question-preview';
                $previewbutton =
                    '<a class="btn btn-outline-secondary btn-sm"'
                    . ' data-toggle="collapse"'
                    . ' href="#' . $collapseid . '"'
                    . ' role="button" aria-expanded="false"'
                    . ' aria-controls="' . $collapseid . '">'
                    . get_string('questionpreview', 'local_stackmatheditor')
                    . '</a>';
                $previewcontent =
                    '<div class="collapse mt-2" id="' . $collapseid . '">'
                    . '<div class="card card-body">'
                    . $previewhtml
                    . '</div></div>';

                $mform->addElement(
                    'static',
                    'preview',
                    get_string('questionpreview', 'local_stackmatheditor'),
                    $previewbutton . $previewcontent
                );
            }
        } else {
            // Quiz/activity mode: display a scope note.
            $notemsgkey = $isadaptivequiz
                ? 'configure_adaptivequiz_note'
                : 'configure_quiz_note';

            $mform->addElement(
                'static',
                'activitymodenote',
                '',
                '<div class="alert alert-info mb-0">'
                    . get_string($notemsgkey, 'local_stackmatheditor')
                    . '</div>'
            );
        }

        // Enabled section – always visible.
        $mform->addElement(
            'header',
            'enabledsection',
            get_string('configure_enabled_header', 'local_stackmatheditor')
        );
        $mform->setExpanded('enabledsection', true);

        if ($instancemode === 0) {
            // Globally forced off – read-only info, no checkbox.
            $mform->addElement(
                'static',
                'enabled_info',
                '',
                '<span class="badge badge-secondary px-2 py-1">'
                    . '<i class="fa fa-lock mr-1" aria-hidden="true"></i>'
                    . get_string('configure_enabled_locked_off', 'local_stackmatheditor')
                    . '</span>'
            );
        } else if ($instancemode === 1) {
            // Globally forced on – read-only info, no checkbox.
            $mform->addElement(
                'static',
                'enabled_info',
                '',
                '<span class="badge badge-success px-2 py-1">'
                    . '<i class="fa fa-lock mr-1" aria-hidden="true"></i>'
                    . get_string('configure_enabled_locked_on', 'local_stackmatheditor')
                    . '</span>'
            );
        } else {
            // Modes 2 and 3: override allowed – show editable checkbox.
            if ($mode === 'quiz') {
                $checkboxlabelkey = $isadaptivequiz
                    ? 'configure_enabled_checkboxlabel_adaptivequiz'
                    : 'configure_enabled_checkboxlabel_quiz';
            } else {
                $checkboxlabelkey = 'configure_enabled_checkboxlabel_question';
            }

            $mform->addElement(
                'advcheckbox',
                'enabled',
                get_string('configure_enabled_label', 'local_stackmatheditor'),
                get_string($checkboxlabelkey, 'local_stackmatheditor'),
                ['id' => 'id_sme_enabled'],
                [0, 1]
            );
            $mform->setType('enabled', PARAM_INT);
            $mform->addHelpButton(
                'enabled',
                'configure_enabled_label',
                'local_stackmatheditor'
            );

            // Context hint: show what the parent default is.
            $parenthint = ($instancemode === 3)
                ? get_string('configure_enabled_parenthint_on', 'local_stackmatheditor')
                : get_string('configure_enabled_parenthint_off', 'local_stackmatheditor');
            $mform->addElement(
                'static',
                'enabled_hint',
                '',
                '<small class="text-muted">'
                    . '<i class="fa fa-info-circle mr-1" aria-hidden="true"></i>'
                    . $parenthint
                    . '</small>'
            );
        }

        // Toolbar groups section.
        $mform->addElement(
            'header',
            'toolbarsection',
            get_string('setting_defaultgroups', 'local_stackmatheditor')
        );
        $mform->setExpanded('toolbarsection', true);

        $select = $mform->addElement(
            'select',
            'groups',
            get_string('setting_defaultgroups', 'local_stackmatheditor'),
            $grouplabels
        );
        $select->setMultiple(true);
        $select->setSize(count($grouplabels));
        $mform->addHelpButton(
            'groups',
            'setting_defaultgroups',
            'local_stackmatheditor'
        );

        // Variable mode section.
        $mform->addElement(
            'header',
            'variablesection',
            get_string('label_variablemode', 'local_stackmatheditor')
        );
        $mform->setExpanded('variablesection', true);

        $varmodelabel = ($mode === 'quiz')
            ? get_string('label_variablemode_quiz', 'local_stackmatheditor')
            : get_string('label_variablemode', 'local_stackmatheditor');

        $mform->addElement('select', 'variablemode', $varmodelabel, [
            definitions::IMPLICIT_EXPLICIT_SINGLE =>
                get_string('implicitmode_explicit_single', 'local_stackmatheditor'),
            definitions::IMPLICIT_EXPLICIT_MULTI =>
                get_string('implicitmode_explicit_multi', 'local_stackmatheditor'),
            definitions::IMPLICIT_SPACE_SINGLE =>
                get_string('implicitmode_space_single', 'local_stackmatheditor'),
            definitions::IMPLICIT_SPACE_MULTI =>
                get_string('implicitmode_space_multi', 'local_stackmatheditor'),
            definitions::IMPLICIT_STACK =>
                get_string('implicitmode_stack', 'local_stackmatheditor'),
        ]);
        $mform->setDefault('variablemode', definitions::IMPLICIT_STACK);

        // Buttons.
        // Render the "Back" cancel button only when a returnurl was supplied.
        // Without one the form has no cancel action.
        $buttons   = [];
        $buttons[] = $mform->createElement(
            'submit',
            'submitbutton',
            get_string('save', 'local_stackmatheditor')
        );
        if (!empty($returnurl)) {
            $buttons[] = $mform->createElement(
                'cancel',
                'cancel',
                get_string('back', 'local_stackmatheditor')
            );
        }
        $mform->addGroup($buttons, 'buttonar', '', ' ', false);
        $mform->closeHeaderBefore('buttonar');
    }
}

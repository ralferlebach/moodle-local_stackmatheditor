<?php
namespace local_stackmatheditor;

defined('MOODLE_INTERNAL') || die();

class hook_callbacks {

    /**
     * Injiziert MathQuill auf Quiz-Seiten mit STACK-Fragen.
     * Wird über die Hooks API aufgerufen (Moodle 4.4+).
     *
     * @param \core\hook\output\before_footer_html_generation $hook
     */
    public static function before_footer(
        \core\hook\output\before_footer_html_generation $hook
    ): void {
        global $PAGE;

        if (!get_config('local_stackmatheditor', 'enabled')) {
            return;
        }

        $allowed = [
            'mod-quiz-attempt',
            'mod-quiz-review',
            'question-preview',
            'question-bank-previewquestion',
        ];
        if (!in_array($PAGE->pagetype, $allowed)) {
            return;
        }

        $PAGE->requires->css(
            new \moodle_url('/local/stackmatheditor/thirdparty/mathquill/mathquill.css')
        );

        $mqurl = (new \moodle_url(
            '/local/stackmatheditor/thirdparty/mathquill/mathquill.min.js'
        ))->out(false);

        $PAGE->requires->js_call_amd(
            'local_stackmatheditor/mathquill_init',
            'init',
            [['mathquillJsUrl' => $mqurl]]
        );
    }
}

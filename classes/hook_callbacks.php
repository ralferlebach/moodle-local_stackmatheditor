<?php
namespace local_stackmatheditor;

defined('MOODLE_INTERNAL') || die();

/**
 * Hook callbacks for local_stackmatheditor.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Your Name
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class hook_callbacks {

    /**
     * Injects MathQuill on quiz pages containing STACK questions.
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

        // Detect which JS file exists: .min.js or .js
        $plugindir = __DIR__ . '/../thirdparty/mathquill/';
        if (file_exists($plugindir . 'mathquill.min.js')) {
            $jsfile = 'mathquill.min.js';
        } else {
            $jsfile = 'mathquill.js';
        }

        $mqjsurl = (new \moodle_url(
            '/local/stackmatheditor/thirdparty/mathquill/' . $jsfile
        ))->out(false);

        $mqcssurl = (new \moodle_url(
            '/local/stackmatheditor/thirdparty/mathquill/mathquill.css'
        ))->out(false);

        $PAGE->requires->js_call_amd(
            'local_stackmatheditor/mathquill_init',
            'init',
            [[
                'mathquillJsUrl'  => $mqjsurl,
                'mathquillCssUrl' => $mqcssurl,
            ]]
        );
    }
}

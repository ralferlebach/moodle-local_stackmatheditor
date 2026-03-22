<?php
namespace local_stackmatheditor;

defined('MOODLE_INTERNAL') || die();

use local_stackmatheditor\output\mathjax_injector;
use local_stackmatheditor\output\editor_injector;
use local_stackmatheditor\output\configure_injector;

/**
 * Thin hook dispatcher.
 *
 * Delegates to dedicated injector classes. Registered via db/hooks.php.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Your Name
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class hook_callbacks {

    /** @var string[] Pages where the editor is injected. */
    private const EDITOR_PAGES = [
        'mod-quiz-attempt',
        'mod-quiz-review',
        'question-preview',
        'question-bank-previewquestion',
    ];

    /** @var string[] Pages where configure links are injected. */
    private const CONFIGURE_PAGES = [
        'mod-quiz-attempt',
        'mod-quiz-review',
        'mod-quiz-edit',
    ];

    /**
     * Should the MathQuill editor be injected?
     *
     * @return bool
     */
    private static function should_inject_editor(): bool {
        global $PAGE;
        if (!get_config('local_stackmatheditor', 'enabled')) {
            return false;
        }
        return in_array($PAGE->pagetype, self::EDITOR_PAGES);
    }

    /**
     * Should configure links be injected?
     *
     * @return bool
     */
    private static function should_inject_configure(): bool {
        global $PAGE;
        if (!get_config('local_stackmatheditor', 'enabled')) {
            return false;
        }
        if (!in_array($PAGE->pagetype, self::CONFIGURE_PAGES)) {
            return false;
        }
        $cmid = quiz_helper::get_cmid();
        if (!$cmid) {
            quiz_helper::dbg('configure guard: no cmid');
            return false;
        }
        $ok = quiz_helper::can_manage_quiz($cmid);
        quiz_helper::dbg('configure guard: can_manage='
            . ($ok ? 'true' : 'false'));
        return $ok;
    }

    /**
     * Hook: Inject MathJax shim and definitions before body.
     *
     * @param \core\hook\output\before_standard_top_of_body_html_generation $hook
     * @return void
     */
    public static function before_top_of_body(
        \core\hook\output\before_standard_top_of_body_html_generation $hook
    ): void {
        if (!self::should_inject_editor()) {
            return;
        }
        mathjax_injector::inject($hook);
    }

    /**
     * Hook: Inject editor runtime and configure links before footer.
     *
     * @param \core\hook\output\before_footer_html_generation $hook
     * @return void
     */
    public static function before_footer(
        \core\hook\output\before_footer_html_generation $hook
    ): void {
        global $PAGE;

        $wantEditor = self::should_inject_editor();
        $wantConfigure = self::should_inject_configure();

        quiz_helper::dbg(
            'before_footer: page=' . $PAGE->pagetype
            . ' editor=' . ($wantEditor ? 'Y' : 'N')
            . ' configure=' . ($wantConfigure ? 'Y' : 'N')
        );

        if (!$wantEditor && !$wantConfigure) {
            return;
        }

        $cmid = quiz_helper::get_cmid();

        if ($wantEditor) {
            editor_injector::inject($cmid);
        }

        if ($wantConfigure) {
            configure_injector::inject($cmid);
        }
    }
}

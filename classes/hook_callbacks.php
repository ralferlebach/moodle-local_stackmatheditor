<?php
namespace local_stackmatheditor;

defined('MOODLE_INTERNAL') || die();

use local_stackmatheditor\output\mathjax_injector;
use local_stackmatheditor\output\editor_injector;
use local_stackmatheditor\output\configure_injector;

/**
 * Hook callbacks for local_stackmatheditor.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Ralf Erlebach
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class hook_callbacks {

    /** @var string[] Pages where the MathQuill editor is active. */
    private const EDITOR_PAGES = [
        'mod-quiz-attempt',
        'mod-quiz-review',
        'question-preview',
        'question-bank-previewquestion',
    ];

    /** @var string[] Pages where configure links appear. */
    private const CONFIGURE_PAGES = [
        'mod-quiz-edit',
        'mod-quiz-attempt',
        'mod-quiz-review',
    ];

    /**
     * Return true if the plugin could ever be active (mode != 0).
     *
     * Mode 0 is a hard instance-wide disable with no overrides possible,
     * so we can skip all further processing entirely.
     *
     * @return bool
     */
    private static function plugin_could_be_active(): bool {
        return config_manager::get_instance_enabled_mode() !== 0;
    }

    /**
     * Return true if the current page is one where the editor should run.
     *
     * @return bool
     */
    private static function is_editor_page(): bool {
        global $PAGE;
        return in_array($PAGE->pagetype, self::EDITOR_PAGES);
    }

    /**
     * Return true if the current page is one where configure links appear.
     *
     * @return bool
     */
    private static function is_configure_page(): bool {
        global $PAGE;
        return in_array($PAGE->pagetype, self::CONFIGURE_PAGES);
    }

    /**
     * Inject the MathJax v2 compatibility shim before page content is rendered.
     *
     * The shim (js/mathjax_shim.js) must load before MathQuill because MathQuill
     * reads window.MathJax.Hub at parse time. The <script> tag is added via
     * add_html() so it lands in the standard top-of-body HTML output, before
     * AMD modules initialise.
     *
     * @param \core\hook\output\before_standard_top_of_body_html_generation $hook
     */
    public static function before_top_of_body(
        \core\hook\output\before_standard_top_of_body_html_generation $hook
    ): void {
        if (!self::plugin_could_be_active()) {
            return;
        }

        if (!self::is_editor_page()) {
            return;
        }

        // Serve the MathJax v2 shim from the static js/ directory.
        // This replaces the previous inline heredoc and keeps PHP files
        // free of embedded JavaScript.
        $shimurl = new \moodle_url('/local/stackmatheditor/js/mathjax_shim.js');
        $hook->add_html(
            '<script type="text/javascript" src="' . $shimurl->out(false) . '"></script>'
        );
    }

    /**
     * Main injection: toolbar definitions, editor runtime, and configure links.
     *
     * @param \core\hook\output\before_footer_html_generation $hook
     */
    public static function before_footer(
        \core\hook\output\before_footer_html_generation $hook
    ): void {
        global $PAGE;

        if (!self::plugin_could_be_active()) {
            return;
        }

        $isEditor    = self::is_editor_page();
        $isConfigure = self::is_configure_page();

        quiz_helper::dbg(
            'before_footer: page=' . $PAGE->pagetype
            . ' editor=' . ($isEditor ? 'Y' : 'N')
            . ' configure=' . ($isConfigure ? 'Y' : 'N')
        );

        if (!$isEditor && !$isConfigure) {
            return;
        }

        $cmid = quiz_helper::get_cmid();

        // ── Editor injection ──────────────────────────────────────────────────
        if ($isEditor) {
            if (!config_manager::get_effective_enabled($cmid)) {
                quiz_helper::dbg('editor: disabled for cmid=' . $cmid . ', skipping');
            } else {
                try {
                    mathjax_injector::inject();
                    editor_injector::inject($cmid);
                    quiz_helper::dbg('editor injected: cmid=' . $cmid);
                } catch (\Throwable $e) {
                    quiz_helper::dbg('editor injection error: ' . $e->getMessage());
                }
            }
        }

        // ── Configure links injection ─────────────────────────────────────────
        // Always inject configure links when the user can manage the quiz,
        // regardless of the enabled mode — the configure page handles the toggle.
        if ($isConfigure) {
            try {
                if ($cmid <= 0) {
                    quiz_helper::dbg('configure: no cmid, skipping');
                    return;
                }

                quiz_helper::dbg(
                    'configure guard: can_manage='
                    . (quiz_helper::can_manage_quiz($cmid) ? 'true' : 'false')
                );

                if (quiz_helper::can_manage_quiz($cmid)) {
                    configure_injector::inject($cmid);
                }
            } catch (\Throwable $e) {
                quiz_helper::dbg('configure injection error: ' . $e->getMessage());
            }
        }
    }
}

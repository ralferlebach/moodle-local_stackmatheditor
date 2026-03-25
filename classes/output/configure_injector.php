<?php
namespace local_stackmatheditor\output;

defined('MOODLE_INTERNAL') || die();

use local_stackmatheditor\config_manager;
use local_stackmatheditor\quiz_helper;

// Shared page output utilities.
use local_stackmatheditor\output\page_helper;

/**
 * Injects configure links for STACK questions on quiz pages.
 *
 * On mod-quiz-edit, also supplies a quiz-level configure URL so the JS
 * can insert a "STACK MathQuill-Editor einrichten" option into the
 * quiz navigation selector (Anforderung B).
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Ralf Erlebach
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class configure_injector {

    public static function inject(int $cmid): void {
        global $PAGE;

        quiz_helper::dbg(
            'configure_injector: cmid=' . $cmid
            . ' pagetype=' . $PAGE->pagetype
        );

        $configureurl    = (new \moodle_url('/local/stackmatheditor/configure.php'))->out(false);
        $linktext        = get_string('configure_editor', 'local_stackmatheditor');
        $quizlinktextraw = get_string('configure_quiz_nav', 'local_stackmatheditor');
        $returnurl       = quiz_helper::get_return_url($cmid);

        $linkdata = self::build_link_data(
            $cmid, $configureurl, $returnurl, $linktext, $quizlinktextraw);

        if (empty($linkdata)) {
            quiz_helper::dbg('configure_injector: no data, skipping');
            return;
        }

        quiz_helper::dbg('configure_injector: injecting, mode=' . $linkdata['mode']);

        page_helper::inject_json_element('sme-configure-data', $linkdata);

        $PAGE->requires->js_call_amd(
            'local_stackmatheditor/configure_links',
            'init',
            []
        );
    }

    private static function build_link_data(
        int $cmid,
        string $configureurl,
        string $returnurl,
        string $linktext,
        string $quizlinktext): array {
        global $PAGE;

        if (in_array($PAGE->pagetype, ['mod-quiz-attempt', 'mod-quiz-review'])) {
            return self::build_attempt_data($cmid, $configureurl, $returnurl, $linktext);
        }

        if ($PAGE->pagetype === 'mod-quiz-edit') {
            return self::build_edit_data(
                $cmid, $configureurl, $returnurl, $linktext, $quizlinktext);
        }

        return [];
    }

    private static function build_attempt_data(
        int $cmid, string $configureurl,
        string $returnurl, string $linktext): array {
        $attemptid = optional_param('attempt', 0, PARAM_INT);
        if (!$attemptid) {
            return [];
        }

        $stackdata = quiz_helper::load_attempt_stack_slots($attemptid);
        if (empty($stackdata['slotmap'])) {
            return [];
        }

        $slots = [];
        foreach ($stackdata['slotmap'] as $slot => $qid) {
            $slots[$slot] = [
                'questionid' => $qid,
                'qbeid'      => $stackdata['qbeids'][$slot] ?? 0,
            ];
        }

        return [
            'mode'         => 'attempt',
            'cmid'         => $cmid,
            'configureUrl' => $configureurl,
            'returnUrl'    => $returnurl,
            'slots'        => $slots,
            'linkText'     => $linktext,
        ];
    }

    private static function build_edit_data(
        int $cmid, string $configureurl,
        string $returnurl, string $linktext,
        string $quizlinktext): array {
        $instanceid = quiz_helper::get_quiz_instance_id($cmid);
        if (!$instanceid) {
            return [];
        }

        $questions = quiz_helper::load_quiz_stack_questions($instanceid);
        if (empty($questions)) {
            return [];
        }

        // Quiz-level configure URL: cmid only, no qbeid → quiz-mode.
        $quizconfigureurl = (new \moodle_url(
            '/local/stackmatheditor/configure.php',
            ['cmid' => $cmid, 'returnurl' => $returnurl]
        ))->out(false);

        return [
            'mode'             => 'edit',
            'cmid'             => $cmid,
            'configureUrl'     => $configureurl,
            'quizConfigureUrl' => $quizconfigureurl,   // NEW: quiz-level entry
            'quizLinkText'     => $quizlinktext,        // NEW: label for selector
            'returnUrl'        => $returnurl,
            'questions'        => $questions,
            'linkText'         => $linktext,
        ];
    }
}

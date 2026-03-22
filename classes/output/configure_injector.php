<?php
namespace local_stackmatheditor\output;

defined('MOODLE_INTERNAL') || die();

use local_stackmatheditor\config_manager;
use local_stackmatheditor\quiz_helper;

/**
 * Injects configure links for STACK questions on quiz pages.
 *
 * Data is passed via a JSON script element to avoid the 1024-char
 * limit of js_call_amd() arguments.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Ralf Erlebach
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class configure_injector {

    /**
     * Inject configure links via AMD module.
     *
     * @param int $cmid Course module ID.
     * @return void
     */
    public static function inject(int $cmid): void {
        global $PAGE;

        quiz_helper::dbg(
            'configure_injector: cmid=' . $cmid
            . ' pagetype=' . $PAGE->pagetype
        );

        $configureurl = (new \moodle_url(
            '/local/stackmatheditor/configure.php'
        ))->out(false);

        $linktext = get_string(
            'configure_editor', 'local_stackmatheditor');
        $returnurl = quiz_helper::get_return_url($cmid);

        $linkdata = self::build_link_data(
            $cmid, $configureurl, $returnurl, $linktext);

        if (empty($linkdata)) {
            quiz_helper::dbg(
                'configure_injector: no data, skipping');
            return;
        }

        quiz_helper::dbg(
            'configure_injector: injecting, mode='
            . $linkdata['mode']
        );

        // Pass data via JSON script element (no size limit).
        $json = json_encode(
            $linkdata,
            JSON_UNESCAPED_UNICODE | JSON_HEX_TAG
        );

        $PAGE->requires->js_amd_inline("
            (function() {
                var el = document.createElement('script');
                el.type = 'application/json';
                el.id = 'sme-configure-data';
                el.textContent = "
            . json_encode($json) . ";
                document.body.appendChild(el);
            })();
        ");

        // Init call with no data arguments.
        $PAGE->requires->js_call_amd(
            'local_stackmatheditor/configure_links',
            'init',
            []
        );
    }

    /**
     * Build link data based on page type.
     *
     * @param int $cmid Course module ID.
     * @param string $configureurl Configure page URL.
     * @param string $returnurl Return URL.
     * @param string $linktext Link label.
     * @return array Link data for JS or empty.
     */
    private static function build_link_data(
        int $cmid,
        string $configureurl,
        string $returnurl,
        string $linktext): array {
        global $PAGE;

        if (in_array($PAGE->pagetype,
            ['mod-quiz-attempt', 'mod-quiz-review'])) {
            return self::build_attempt_data(
                $cmid, $configureurl, $returnurl, $linktext);
        }

        if ($PAGE->pagetype === 'mod-quiz-edit') {
            return self::build_edit_data(
                $cmid, $configureurl, $returnurl, $linktext);
        }

        return [];
    }

    /**
     * Build data for attempt/review pages.
     *
     * @param int $cmid Course module ID.
     * @param string $configureurl Configure URL.
     * @param string $returnurl Return URL.
     * @param string $linktext Link text.
     * @return array Link data or empty.
     */
    private static function build_attempt_data(
        int $cmid,
        string $configureurl,
        string $returnurl,
        string $linktext): array {
        $attemptid = optional_param('attempt', 0, PARAM_INT);
        if (!$attemptid) {
            return [];
        }

        $stackdata = quiz_helper::load_attempt_stack_slots(
            $attemptid);
        if (empty($stackdata['slotmap'])) {
            return [];
        }

        $slots = [];
        foreach ($stackdata['slotmap'] as $slot => $qid) {
            $slots[$slot] = [
                'questionid' => $qid,
                'qbeid' => $stackdata['qbeids'][$slot] ?? 0,
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

    /**
     * Build data for quiz edit page.
     *
     * @param int $cmid Course module ID.
     * @param string $configureurl Configure URL.
     * @param string $returnurl Return URL.
     * @param string $linktext Link text.
     * @return array Link data or empty.
     */
    private static function build_edit_data(
        int $cmid,
        string $configureurl,
        string $returnurl,
        string $linktext): array {
        $instanceid = quiz_helper::get_quiz_instance_id($cmid);
        if (!$instanceid) {
            return [];
        }

        $questions = quiz_helper::load_quiz_stack_questions(
            $instanceid);
        if (empty($questions)) {
            return [];
        }

        return [
            'mode'         => 'edit',
            'cmid'         => $cmid,
            'configureUrl' => $configureurl,
            'returnUrl'    => $returnurl,
            'questions'    => $questions,
            'linkText'     => $linktext,
        ];
    }
}

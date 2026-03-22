<?php
namespace local_stackmatheditor;

defined('MOODLE_INTERNAL') || die();

/**
 * Shared helper for quiz/question DB lookups.
 *
 * Provides reusable methods used by both the editor injector
 * and the configure link injector.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Your Name
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class quiz_helper {

    /** @var bool Enable debug logging. */
    private const DEBUG = true;

    /**
     * Debug log helper.
     *
     * @param string $msg Message.
     * @return void
     */
    public static function dbg(string $msg): void {
        if (self::DEBUG) {
            error_log('[SME-HOOK] ' . $msg);
        }
    }

    /**
     * Get the course module ID from PAGE or URL parameters.
     *
     * @return int Course module ID or 0.
     */
    public static function get_cmid(): int {
        global $PAGE;
        if ($PAGE->cm) {
            return (int) $PAGE->cm->id;
        }
        $cmid = optional_param('cmid', 0, PARAM_INT);
        if (!$cmid) {
            $cmid = optional_param('id', 0, PARAM_INT);
        }
        return $cmid;
    }

    /**
     * Get quiz instance ID from PAGE or cmid.
     *
     * @param int $cmid Course module ID.
     * @return int Quiz instance ID or 0.
     */
    public static function get_quiz_instance_id(int $cmid): int {
        global $PAGE;
        if ($PAGE->cm && (int) $PAGE->cm->id === $cmid) {
            return (int) $PAGE->cm->instance;
        }
        $cm = get_coursemodule_from_id('quiz', $cmid);
        return $cm ? (int) $cm->instance : 0;
    }

    /**
     * Load question_attempts for a quiz attempt, filtered to STACK questions.
     *
     * Returns a structured array with:
     *  - slotmap:  slot => questionid
     *  - qbeids:   slot => questionbankentryid
     *  - qbeidmap: questionbankentryid => questionid
     *
     * @param int $attemptid Quiz attempt ID.
     * @return array{slotmap: array, qbeids: array, qbeidmap: array}
     */
    public static function load_attempt_stack_slots(
        int $attemptid): array {
        global $DB;

        $result = [
            'slotmap'  => [],
            'qbeids'   => [],
            'qbeidmap' => [],
        ];

        try {
            $attempt = $DB->get_record(
                'quiz_attempts', ['id' => $attemptid]);
            if (!$attempt) {
                self::dbg('load_attempt_stack_slots: '
                    . 'attempt not found id=' . $attemptid);
                return $result;
            }

            $qas = $DB->get_records(
                'question_attempts',
                ['questionusageid' => $attempt->uniqueid],
                'slot ASC'
            );
            if (empty($qas)) {
                return $result;
            }

            // Build slot → questionid and collect all question IDs.
            $rawslotmap = [];
            $questionids = [];
            foreach ($qas as $qa) {
                $qid = (int) $qa->questionid;
                $slot = (int) $qa->slot;
                $rawslotmap[$slot] = $qid;
                if (!in_array($qid, $questionids)) {
                    $questionids[] = $qid;
                }
            }
            if (empty($questionids)) {
                return $result;
            }

            // Filter to STACK questions only.
            list($insql, $params) = $DB->get_in_or_equal(
                $questionids, SQL_PARAMS_NAMED, 'qid');
            $questions = $DB->get_records_select(
                'question',
                "id {$insql}", $params, '', 'id, qtype'
            );

            foreach ($rawslotmap as $slot => $qid) {
                if (!isset($questions[$qid])) {
                    continue;
                }
                if ($questions[$qid]->qtype !== 'stack') {
                    continue;
                }
                $result['slotmap'][$slot] = $qid;
                $qbeid = config_manager::resolve_qbeid($qid);
                if ($qbeid) {
                    $result['qbeids'][$slot] = $qbeid;
                    if (!isset($result['qbeidmap'][$qbeid])) {
                        $result['qbeidmap'][$qbeid] = $qid;
                    }
                }
            }

            self::dbg('load_attempt_stack_slots: '
                . count($result['slotmap']) . ' STACK slots');
        } catch (\Throwable $e) {
            self::dbg('load_attempt_stack_slots: '
                . $e->getMessage());
        }

        return $result;
    }

    /**
     * Load STACK question data from quiz_slots for the edit page.
     *
     * @param int $quizinstanceid Quiz instance ID.
     * @return array List of {questionid, qbeid, name, slot}.
     */
    public static function load_quiz_stack_questions(
        int $quizinstanceid): array {
        global $DB;
        $data = [];

        try {
            $slots = $DB->get_records(
                'quiz_slots',
                ['quizid' => $quizinstanceid],
                'slot ASC'
            );
            self::dbg('load_quiz_stack_questions: '
                . count($slots) . ' total slots');

            foreach ($slots as $slot) {
                $qref = $DB->get_record_sql(
                    "SELECT qv.questionid,
                            qv.questionbankentryid,
                            q.qtype, q.name
                       FROM {question_versions} qv
                       JOIN {question} q
                            ON q.id = qv.questionid
                      WHERE qv.questionbankentryid = :qbeid
                   ORDER BY qv.version DESC",
                    ['qbeid' => $slot->questionbankentryid],
                    IGNORE_MULTIPLE
                );

                if (!$qref || $qref->qtype !== 'stack') {
                    continue;
                }

                $data[] = [
                    'questionid' => (int) $qref->questionid,
                    'qbeid' => (int) $qref->questionbankentryid,
                    'name' => $qref->name,
                    'slot' => (int) $slot->slot,
                ];
            }

            self::dbg('load_quiz_stack_questions: '
                . count($data) . ' STACK questions');
        } catch (\Throwable $e) {
            self::dbg('load_quiz_stack_questions: '
                . $e->getMessage());
        }

        return $data;
    }

    /**
     * Check if current user has mod/quiz:manage for a given cmid.
     *
     * @param int $cmid Course module ID.
     * @return bool True if user can manage.
     */
    public static function can_manage_quiz(int $cmid): bool {
        try {
            $context = \context_module::instance($cmid);
            return has_capability('mod/quiz:manage', $context);
        } catch (\Throwable $e) {
            return false;
        }
    }

    /**
     * Build a safe return URL from PAGE or fallback.
     *
     * @param int $cmid Course module ID for fallback.
     * @return string URL string.
     */
    public static function get_return_url(int $cmid): string {
        global $PAGE;
        try {
            return $PAGE->url->out(false);
        } catch (\Throwable $e) {
            return (new \moodle_url(
                '/mod/quiz/view.php', ['id' => $cmid]
            ))->out(false);
        }
    }
}

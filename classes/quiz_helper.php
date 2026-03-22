<?php
namespace local_stackmatheditor;

defined('MOODLE_INTERNAL') || die();

/**
 * Shared helper for quiz/question DB lookups.
 *
 * Results are cached per-request to avoid duplicate queries
 * when multiple injectors need the same data.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Ralf Erlebach
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class quiz_helper {

    /** @var bool Enable debug logging. */
    private const DEBUG = true;

    /** @var array Per-request cache for attempt slot data. */
    private static array $attemptcache = [];

    /** @var array Per-request cache for quiz question data. */
    private static array $quizcache = [];

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
     * Check if quiz_slots has questionbankentryid column.
     *
     * @return bool True if direct column exists.
     */
    private static function slots_have_qbeid(): bool {
        global $DB;
        static $result = null;
        if ($result !== null) {
            return $result;
        }
        try {
            $cols = $DB->get_columns('quiz_slots');
            $result = isset($cols['questionbankentryid']);
        } catch (\Throwable $e) {
            $result = false;
        }
        return $result;
    }

    /**
     * Load STACK question data from quiz slots.
     * Results are cached per quiz instance ID.
     *
     * @param int $quizinstanceid Quiz instance ID.
     * @return array List of {questionid, qbeid, name, slot}.
     */
    public static function load_quiz_stack_questions(
        int $quizinstanceid): array {
        if (isset(self::$quizcache[$quizinstanceid])) {
            self::dbg('load_quiz_stack_questions: '
                . 'cache hit quiz=' . $quizinstanceid);
            return self::$quizcache[$quizinstanceid];
        }

        $data = [];
        try {
            if (self::slots_have_qbeid()) {
                $data = self::load_questions_direct(
                    $quizinstanceid);
            } else {
                $data = self::load_questions_via_refs(
                    $quizinstanceid);
            }
        } catch (\Throwable $e) {
            self::dbg('load_quiz_stack_questions: '
                . $e->getMessage());
        }

        self::dbg('load_quiz_stack_questions: '
            . count($data) . ' STACK questions');

        self::$quizcache[$quizinstanceid] = $data;
        return $data;
    }

    /**
     * Load via direct column (Moodle 4.2+).
     *
     * @param int $quizid Quiz instance ID.
     * @return array Question data.
     */
    private static function load_questions_direct(
        int $quizid): array {
        global $DB;
        $data = [];

        $slots = $DB->get_records(
            'quiz_slots',
            ['quizid' => $quizid],
            'slot ASC'
        );

        foreach ($slots as $slot) {
            $qbeid = (int) ($slot->questionbankentryid ?? 0);
            if (!$qbeid) {
                continue;
            }

            $qref = $DB->get_record_sql(
                "SELECT qv.questionid, q.qtype, q.name
                   FROM {question_versions} qv
                   JOIN {question} q ON q.id = qv.questionid
                  WHERE qv.questionbankentryid = :qbeid
               ORDER BY qv.version DESC",
                ['qbeid' => $qbeid],
                IGNORE_MULTIPLE
            );

            if (!$qref || $qref->qtype !== 'stack') {
                continue;
            }

            $data[] = [
                'questionid' => (int) $qref->questionid,
                'qbeid' => $qbeid,
                'name' => $qref->name,
                'slot' => (int) $slot->slot,
            ];
        }

        return $data;
    }

    /**
     * Load via question_references table (Moodle 4.0-4.1).
     *
     * @param int $quizid Quiz instance ID.
     * @return array Question data.
     */
    private static function load_questions_via_refs(
        int $quizid): array {
        global $DB;
        $data = [];

        $sql = "
            SELECT qs.slot AS slotnum,
                   qs.id AS slotid,
                   qr.questionbankentryid AS qbeid
              FROM {quiz_slots} qs
              JOIN {question_references} qr
                   ON qr.itemid = qs.id
                   AND qr.component = 'mod_quiz'
                   AND qr.questionarea = 'slot'
             WHERE qs.quizid = :quizid
          ORDER BY qs.slot ASC";

        $rows = $DB->get_records_sql(
            $sql, ['quizid' => $quizid]);

        foreach ($rows as $row) {
            $qbeid = (int) $row->qbeid;
            if (!$qbeid) {
                continue;
            }

            $qref = $DB->get_record_sql(
                "SELECT qv.questionid, q.qtype, q.name
                   FROM {question_versions} qv
                   JOIN {question} q ON q.id = qv.questionid
                  WHERE qv.questionbankentryid = :qbeid
               ORDER BY qv.version DESC",
                ['qbeid' => $qbeid],
                IGNORE_MULTIPLE
            );

            if (!$qref || $qref->qtype !== 'stack') {
                continue;
            }

            $data[] = [
                'questionid' => (int) $qref->questionid,
                'qbeid' => $qbeid,
                'name' => $qref->name,
                'slot' => (int) $row->slotnum,
            ];
        }

        return $data;
    }

    /**
     * Load STACK slots for a quiz attempt.
     * Results are cached per attempt ID.
     *
     * @param int $attemptid Quiz attempt ID.
     * @return array{slotmap: array, qbeids: array, qbeidmap: array}
     */
    public static function load_attempt_stack_slots(
        int $attemptid): array {
        if (isset(self::$attemptcache[$attemptid])) {
            self::dbg('load_attempt_stack_slots: '
                . 'cache hit attempt=' . $attemptid);
            return self::$attemptcache[$attemptid];
        }

        $result = [
            'slotmap'  => [],
            'qbeids'   => [],
            'qbeidmap' => [],
        ];

        try {
            $result = self::do_load_attempt_slots($attemptid);
        } catch (\Throwable $e) {
            self::dbg('load_attempt_stack_slots: '
                . $e->getMessage());
        }

        self::$attemptcache[$attemptid] = $result;
        return $result;
    }

    /**
     * Internal: Load attempt slots from DB.
     *
     * @param int $attemptid Attempt ID.
     * @return array Slot data.
     */
    private static function do_load_attempt_slots(
        int $attemptid): array {
        global $DB;

        $result = [
            'slotmap'  => [],
            'qbeids'   => [],
            'qbeidmap' => [],
        ];

        $attempt = $DB->get_record(
            'quiz_attempts', ['id' => $attemptid]);
        if (!$attempt) {
            self::dbg('do_load_attempt_slots: '
                . 'not found id=' . $attemptid);
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

        self::dbg('do_load_attempt_slots: '
            . count($result['slotmap']) . ' STACK slots');

        return $result;
    }

    /**
     * Check if current user has mod/quiz:manage.
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
     * Build a safe return URL.
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

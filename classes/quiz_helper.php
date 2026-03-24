<?php
namespace local_stackmatheditor;

defined('MOODLE_INTERNAL') || die();

/**
 * Shared helper for quiz/question DB lookups.
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

    public static function dbg(string $msg): void {
        if (self::DEBUG) {
            error_log('[SME-HOOK] ' . $msg);
        }
    }

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

    public static function get_quiz_instance_id(int $cmid): int {
        global $PAGE;
        if ($PAGE->cm && (int) $PAGE->cm->id === $cmid) {
            return (int) $PAGE->cm->instance;
        }
        $cm = get_coursemodule_from_id('quiz', $cmid);
        return $cm ? (int) $cm->instance : 0;
    }

    private static function slots_have_qbeid(): bool {
        global $DB;
        static $result = null;
        if ($result !== null) {
            return $result;
        }
        try {
            $cols   = $DB->get_columns('quiz_slots');
            $result = isset($cols['questionbankentryid']);
        } catch (\Throwable $e) {
            $result = false;
        }
        return $result;
    }

    public static function load_quiz_stack_questions(int $quizinstanceid): array {
        if (isset(self::$quizcache[$quizinstanceid])) {
            self::dbg('load_quiz_stack_questions: cache hit quiz=' . $quizinstanceid);
            return self::$quizcache[$quizinstanceid];
        }

        $data = [];
        try {
            $data = self::slots_have_qbeid()
                ? self::load_questions_direct($quizinstanceid)
                : self::load_questions_via_refs($quizinstanceid);
        } catch (\Throwable $e) {
            self::dbg('load_quiz_stack_questions: ' . $e->getMessage());
        }

        self::dbg('load_quiz_stack_questions: ' . count($data) . ' STACK questions');
        self::$quizcache[$quizinstanceid] = $data;
        return $data;
    }

    private static function load_questions_direct(int $quizid): array {
        global $DB;
        $data  = [];
        $slots = $DB->get_records('quiz_slots', ['quizid' => $quizid], 'slot ASC');

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
                'qbeid'      => $qbeid,
                'name'       => $qref->name,
                'slot'       => (int) $slot->slot,
            ];
        }
        return $data;
    }

    private static function load_questions_via_refs(int $quizid): array {
        global $DB;
        $data = [];
        $sql  = "
            SELECT qs.slot AS slotnum,
                   qs.id   AS slotid,
                   qr.questionbankentryid AS qbeid
              FROM {quiz_slots} qs
              JOIN {question_references} qr
                   ON qr.itemid = qs.id
                   AND qr.component = 'mod_quiz'
                   AND qr.questionarea = 'slot'
             WHERE qs.quizid = :quizid
          ORDER BY qs.slot ASC";
        $rows = $DB->get_records_sql($sql, ['quizid' => $quizid]);

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
                'qbeid'      => $qbeid,
                'name'       => $qref->name,
                'slot'       => (int) $row->slotnum,
            ];
        }
        return $data;
    }

    public static function load_attempt_stack_slots(int $attemptid): array {
        if (isset(self::$attemptcache[$attemptid])) {
            return self::$attemptcache[$attemptid];
        }
        $result = ['slotmap' => [], 'qbeids' => [], 'qbeidmap' => []];
        try {
            $result = self::do_load_attempt_slots($attemptid);
        } catch (\Throwable $e) {
            self::dbg('load_attempt_stack_slots: ' . $e->getMessage());
        }
        self::$attemptcache[$attemptid] = $result;
        return $result;
    }

    private static function do_load_attempt_slots(int $attemptid): array {
        global $DB;
        $result = ['slotmap' => [], 'qbeids' => [], 'qbeidmap' => []];

        $attempt = $DB->get_record('quiz_attempts', ['id' => $attemptid]);
        if (!$attempt) {
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

        $rawslotmap  = [];
        $questionids = [];
        foreach ($qas as $qa) {
            $qid              = (int) $qa->questionid;
            $slot             = (int) $qa->slot;
            $rawslotmap[$slot] = $qid;
            if (!in_array($qid, $questionids)) {
                $questionids[] = $qid;
            }
        }

        list($insql, $params) = $DB->get_in_or_equal($questionids, SQL_PARAMS_NAMED, 'qid');
        $questions = $DB->get_records_select('question', "id {$insql}", $params, '', 'id, qtype');

        foreach ($rawslotmap as $slot => $qid) {
            if (!isset($questions[$qid]) || $questions[$qid]->qtype !== 'stack') {
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
        return $result;
    }

    public static function can_manage_quiz(int $cmid): bool {
        try {
            $context = \context_module::instance($cmid);
            return has_capability('mod/quiz:manage', $context);
        } catch (\Throwable $e) {
            return false;
        }
    }

    public static function get_return_url(int $cmid): string {
        global $PAGE;
        try {
            return $PAGE->url->out(false);
        } catch (\Throwable $e) {
            return (new \moodle_url('/mod/quiz/view.php', ['id' => $cmid]))->out(false);
        }
    }

    /**
     * Check whether STACK questions exist in a quiz (PHP-backend check for Req. B).
     *
     * @param int $cmid Course module ID.
     * @return bool
     */
    public static function quiz_has_stack_questions(int $cmid): bool {
        $instanceid = self::get_quiz_instance_id($cmid);
        if (!$instanceid) {
            return false;
        }
        $questions = self::load_quiz_stack_questions($instanceid);
        return !empty($questions);
    }
}

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

namespace local_stackmatheditor;

/**
 * Shared helper for quiz/question DB lookups.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class quiz_helper {
    /** @var array Per-request cache for attempt slot data. */
    private static array $attemptcache = [];

    /** @var array Per-request cache for quiz question data. */
    private static array $quizcache = [];

    /**
     * Write a developer-level debug message to the PHP error log.
     *
     * Only emitted when Moodle developer debug mode is active
     * ($CFG->debug >= DEBUG_DEVELOPER). Silent on production sites.
     *
     * @param string $msg Message to log.
     * @return void
     */
    /**
     * Write a silent developer trace message to the PHP error log.
     *
     * Uses error_log() so output never appears in the browser or disrupts
     * normal page rendering. Only visible in the server error log.
     *
     * @param string $msg Message to log.
     * @return void
     */
    public static function dbg(string $msg): void {
        // phpcs:ignore moodle.PHP.ForbiddenFunctions.FoundWithAlternative
        error_log('[SME-HOOK] ' . $msg);
    }

    /**
     * Return the course module ID for the current page.
     *
     * Reads from $PAGE->cm if available, then falls back to the
     * cmid or id URL parameter.
     *
     * @return int Course module ID, or 0 if not determinable.
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
     * Return the quiz instance ID for a given course module ID.
     *
     * @param int $cmid Course module ID.
     * @return int Quiz instance ID, or 0 if not found.
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
     * Check whether the quiz_slots table has a questionbankentryid column.
     *
     * The column was added in Moodle 4.x. Result is cached per request.
     *
     * @return bool True if the column exists.
     */
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

    /**
     * Load all STACK question records for a quiz instance.
     *
     * Returns an array of associative arrays with keys:
     *   questionid, qbeid, name, slot.
     * Result is cached per request.
     *
     * @param int $quizinstanceid Quiz instance ID (not cmid).
     * @return array List of STACK question data.
     */
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

    /**
     * Load STACK questions via the quiz_slots.questionbankentryid column.
     *
     * Used on Moodle 4.x where the column is present.
     *
     * @param int $quizid Quiz instance ID.
     * @return array List of STACK question data.
     */
    private static function load_questions_direct(int $quizid): array {
        global $DB;

        $slots = $DB->get_records('quiz_slots', ['quizid' => $quizid], 'slot ASC');
        if (empty($slots)) {
            return [];
        }

        // Collect unique qbeids from all slots first.
        $qbeids = [];
        foreach ($slots as $slot) {
            $qbeid = (int) ($slot->questionbankentryid ?? 0);
            if ($qbeid) {
                $qbeids[] = $qbeid;
            }
        }
        if (empty($qbeids)) {
            return [];
        }

        // Bulk-load the latest question version for every qbeid in one query,
        // eliminating the previous per-slot DB call inside the loop.
        $uniqueqbeids = array_unique($qbeids);
        [$insql, $params] = $DB->get_in_or_equal($uniqueqbeids, SQL_PARAMS_NAMED, 'qbeid');
        $sql = "SELECT qv.questionbankentryid, qv.questionid, q.qtype, q.name
                  FROM {question_versions} qv
                  JOIN {question} q ON q.id = qv.questionid
                 WHERE qv.questionbankentryid {$insql}
                   AND qv.version = (
                       SELECT MAX(qv2.version)
                         FROM {question_versions} qv2
                        WHERE qv2.questionbankentryid = qv.questionbankentryid
                   )";
        $qrefs = $DB->get_records_sql($sql, $params);

        // Index by qbeid for O(1) lookup while iterating slots.
        $qrefbyqbeid = [];
        foreach ($qrefs as $qref) {
            $qrefbyqbeid[(int) $qref->questionbankentryid] = $qref;
        }

        $data = [];
        foreach ($slots as $slot) {
            $qbeid = (int) ($slot->questionbankentryid ?? 0);
            if (!$qbeid || !isset($qrefbyqbeid[$qbeid])) {
                continue;
            }
            $qref = $qrefbyqbeid[$qbeid];
            if ($qref->qtype !== 'stack') {
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

    /**
     * Load STACK questions via the question_references table.
     *
     * Used as fallback when quiz_slots lacks questionbankentryid.
     *
     * @param int $quizid Quiz instance ID.
     * @return array List of STACK question data.
     */
    private static function load_questions_via_refs(int $quizid): array {
        global $DB;
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
        if (empty($rows)) {
            return [];
        }

        // Collect unique qbeids before any further queries.
        $qbeids = [];
        foreach ($rows as $row) {
            $qbeid = (int) $row->qbeid;
            if ($qbeid) {
                $qbeids[] = $qbeid;
            }
        }
        if (empty($qbeids)) {
            return [];
        }

        // Bulk-load the latest question version for every qbeid in one query,
        // eliminating the previous per-row DB call inside the loop.
        $uniqueqbeids = array_unique($qbeids);
        [$insql, $params] = $DB->get_in_or_equal($uniqueqbeids, SQL_PARAMS_NAMED, 'qbeid');
        $versql = "SELECT qv.questionbankentryid, qv.questionid, q.qtype, q.name
                     FROM {question_versions} qv
                     JOIN {question} q ON q.id = qv.questionid
                    WHERE qv.questionbankentryid {$insql}
                      AND qv.version = (
                          SELECT MAX(qv2.version)
                            FROM {question_versions} qv2
                           WHERE qv2.questionbankentryid = qv.questionbankentryid
                      )";
        $qrefs = $DB->get_records_sql($versql, $params);

        // Index by qbeid for O(1) lookup while iterating rows.
        $qrefbyqbeid = [];
        foreach ($qrefs as $qref) {
            $qrefbyqbeid[(int) $qref->questionbankentryid] = $qref;
        }

        $data = [];
        foreach ($rows as $row) {
            $qbeid = (int) $row->qbeid;
            if (!$qbeid || !isset($qrefbyqbeid[$qbeid])) {
                continue;
            }
            $qref = $qrefbyqbeid[$qbeid];
            if ($qref->qtype !== 'stack') {
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

    /**
     * Load slot-to-STACK-question mapping for a quiz attempt.
     *
     * Returns an array with keys:
     *   slotmap  (slot => questionid),
     *   qbeids   (slot => qbeid),
     *   qbeidmap (qbeid => questionid).
     * Result is cached per request.
     *
     * @param int $attemptid Quiz attempt ID.
     * @return array Slot mapping data.
     */
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

    /**
     * Internal implementation for load_attempt_stack_slots().
     *
     * @param int $attemptid Quiz attempt ID.
     * @return array Slot mapping data.
     */
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

        [$insql, $params] = $DB->get_in_or_equal($questionids, SQL_PARAMS_NAMED, 'qid');
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

    /**
     * Check whether the current user has quiz management capability.
     *
     * @param int $cmid Course module ID.
     * @return bool True if the user can manage the quiz.
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
     * Return the URL to redirect to after saving configuration.
     *
     * Falls back to the quiz view page if $PAGE->url is not set.
     *
     * @param int $cmid Course module ID.
     * @return string Absolute URL string.
     */
    public static function get_return_url(int $cmid): string {
        global $PAGE;
        $fallback = (new \moodle_url('/mod/quiz/view.php', ['id' => $cmid]))->out(false);
        // Accessing $PAGE->url before set_url() triggers debugging() in Moodle 4.x.
        // The has_set_url() check prevents that in both production and test context.
        if (!$PAGE->has_set_url()) {
            return $fallback;
        }
        try {
            $url = $PAGE->url->out(false);
            return ($url !== '') ? $url : $fallback;
        } catch (\Throwable $e) {
            return $fallback;
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

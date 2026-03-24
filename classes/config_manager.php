<?php
namespace local_stackmatheditor;

defined('MOODLE_INTERNAL') || die();

/**
 * Manages per-quiz per-question toolbar configuration.
 *
 * Cascade: instance defaults -> quiz-level (qbeid=0) -> question-level.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Ralf Erlebach
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class config_manager {

    /** @var string Database table name. */
    const TABLE = 'local_stackmatheditor';

    /**
     * Returns instance-wide default enabled state for all element groups.
     *
     * @return array Group key => bool.
     */
    public static function get_instance_defaults(): array {
        $groups = definitions::get_element_groups();

        // 1. New format: single comma-separated setting.
        $enabledstr = get_config('local_stackmatheditor', 'default_groups');
        if ($enabledstr !== false && $enabledstr !== '') {
            $enabled = array_map('trim', explode(',', $enabledstr));
            $result = [];
            foreach ($groups as $key => $group) {
                $result[$key] = in_array($key, $enabled);
            }
            return $result;
        }

        // 2. Old format: individual settings.
        $hasoldformat = false;
        $result = [];
        foreach ($groups as $key => $group) {
            $setting = get_config('local_stackmatheditor', 'default_' . $key);
            if ($setting !== false) {
                $hasoldformat = true;
                $result[$key] = (bool) $setting;
            } else {
                $result[$key] = $group['default_enabled'];
            }
        }
        if ($hasoldformat) {
            return $result;
        }

        // 3. Fallback: hardcoded defaults.
        return definitions::get_default_enabled();
    }

    /**
     * Returns instance-wide variable mode.
     *
     * @return string 'single' or 'multi'.
     */
    public static function get_instance_variable_mode(): string {
        $mode = get_config('local_stackmatheditor', 'variablemode');
        if ($mode === definitions::VAR_MULTI) {
            return definitions::VAR_MULTI;
        }
        return definitions::VAR_SINGLE;
    }

    /**
     * Returns the instance-wide enabled mode (0-3).
     *
     * 0 = disabled globally, no override
     * 1 = enabled globally, no override
     * 2 = default off, quiz/question may enable
     * 3 = default on,  quiz/question may disable
     *
     * @return int
     */
    public static function get_instance_enabled_mode(): int {
        $val = get_config('local_stackmatheditor', 'enabled');
        $int = (int) $val;
        if ($int < 0 || $int > 3) {
            return 1; // safe default: enabled.
        }
        return $int;
    }

    // ------------------------------------------------------------------
    // DB column helpers
    // ------------------------------------------------------------------

    /**
     * Detect which column stores the JSON config.
     *
     * @return string Column name.
     */
    private static function get_config_column(): string {
        global $DB;
        static $col = null;
        if ($col !== null) {
            return $col;
        }
        $columns = $DB->get_columns(self::TABLE);
        $col     = isset($columns['allowed_elements']) ? 'allowed_elements' : 'config';
        return $col;
    }

    /**
     * Public accessor for the config column name.
     *
     * @return string Column name.
     */
    public static function get_config_column_public(): string {
        return self::get_config_column();
    }

    /**
     * Safe single-record fetch: returns newest matching record.
     *
     * @param string $where SQL WHERE clause.
     * @param array $params Query parameters.
     * @return \stdClass|null Record or null.
     */
    private static function get_one(string $where, array $params): ?\stdClass {
        global $DB;
        $sql = "SELECT * FROM {" . self::TABLE . "} WHERE {$where}"
            . " ORDER BY timemodified DESC";
        $records = $DB->get_records_sql($sql, $params, 0, 1);
        return $records ? reset($records) : null;
    }

    /**
     * Resolve any question ID to its question bank entry ID.
     *
     * @param int $questionid Any version-specific question ID.
     * @return int|null The question bank entry ID, or null.
     */
    public static function resolve_qbeid(int $questionid): ?int {
        global $DB;
        $sql = "SELECT qbe.id
                  FROM {question_bank_entries} qbe
                  JOIN {question_versions} qv ON qv.questionbankentryid = qbe.id
                 WHERE qv.questionid = :questionid
              ORDER BY qv.version DESC";
        $records = $DB->get_records_sql($sql, ['questionid' => $questionid], 0, 1);
        $record = reset($records);
        return $record ? (int) $record->id : null;
    }

    /**
     * Ensure we have a qbeid. Resolves from questionid if needed.
     *
     * @param int $qbeid Question bank entry ID (may be 0).
     * @param int $questionid Question ID (fallback, may be 0).
     * @return int|null Resolved qbeid or null.
     */
    public static function ensure_qbeid(int $qbeid, int $questionid = 0): ?int {
        if ($qbeid > 0) {
            return $qbeid;
        }
        if ($questionid > 0) {
            return self::resolve_qbeid($questionid);
        }
        return null;
    }

    // ------------------------------------------------------------------
    // Decode helpers
    // ------------------------------------------------------------------

    /**
     * Decode a config JSON string and merge with defaults.
     *
     * @param string|null $json
     * @param array       $defaults
     * @return array|null
     */
    private static function decode_config(?string $json, array $defaults): ?array {
        if (empty($json)) {
            return null;
        }
        $decoded = json_decode($json, true);
        if (!is_array($decoded)) {
            return null;
        }
        return array_merge($defaults, $decoded);
    }

    /**
     * Load config for a quiz + question with cascade.
     *
     * Cascade: instance defaults -> quiz-level (qbeid=0) -> question-level.
     *
     * @param int $cmid Course module ID (0 for global).
     * @param int $qbeid Question bank entry ID (0 for quiz-level).
     * @param int $questionid Question ID (for resolving qbeid and legacy).
     * @return array Merged config array.
     */
    public static function get_config(int $cmid, int $qbeid = 0,
                                      int $questionid = 0): array {
        $col = self::get_config_column();
        $defaults = self::get_instance_defaults();

        // Always resolve to qbeid.
        $qbeid = self::ensure_qbeid($qbeid, $questionid) ?? 0;

        // 0. Quiz-level defaults (cmid + qbeid=0).
        $quizdefaults = $defaults;
        if ($cmid > 0) {
            $quizrec = self::get_one(
                "cmid = :cmid AND questionbankentryid = 0",
                ['cmid' => $cmid]
            );
            if ($quizrec) {
                $qd = self::decode_config($quizrec->$col, $defaults);
                if ($qd !== null) {
                    $quizdefaults = $qd;
                }
            }
        }

        // Quiz-level request: return quiz defaults directly.
        if ($qbeid <= 0) {
            return $quizdefaults;
        }

        // Question-level: use quiz defaults as base.
        $defaults = $quizdefaults;

        // 1. Exact: cmid + qbeid.
        if ($cmid > 0 && $qbeid > 0) {
            $rec = self::get_one(
                "cmid = :cmid AND questionbankentryid = :qbeid",
                ['cmid' => $cmid, 'qbeid' => $qbeid]
            );
            if ($rec) {
                $result = self::decode_config($rec->$col, $defaults);
                if ($result !== null) {
                    return $result;
                }
            }
        }

        // 2. Quiz-level default: cmid + qbeid IS NULL.
        if ($cmid > 0) {
            $rec = self::get_one(
                "cmid = :cmid AND questionbankentryid IS NULL",
                ['cmid' => $cmid]
            );
            if ($rec) {
                $result = self::decode_config($rec->$col, $defaults);
                if ($result !== null) {
                    return $result;
                }
            }
        }

        // 3. Global: cmid=0 + qbeid.
        if ($qbeid > 0) {
            $rec = self::get_one(
                "cmid = 0 AND questionbankentryid = :qbeid",
                ['qbeid' => $qbeid]
            );
            if ($rec) {
                $result = self::decode_config($rec->$col, $defaults);
                if ($result !== null) {
                    return $result;
                }
            }
        }

        // 4. Any record with matching qbeid.
        if ($qbeid > 0) {
            $rec = self::get_one(
                "questionbankentryid = :qbeid",
                ['qbeid' => $qbeid]
            );
            if ($rec) {
                $result = self::decode_config($rec->$col, $defaults);
                if ($result !== null) {
                    return $result;
                }
            }
        }

        // 5. Legacy: questionid field.
        if ($questionid > 0) {
            global $DB;
            $columns = $DB->get_columns(self::TABLE);
            if (isset($columns['questionid'])) {
                $rec = self::get_one(
                    "questionid = :qid AND questionid > 0",
                    ['qid' => $questionid]
                );
                if ($rec) {
                    $result = self::decode_config($rec->$col, $defaults);
                    if ($result !== null) {
                        return $result;
                    }
                }
            }
        }

        return $defaults;
    }

    /**
     * Batch-load configs for multiple questions in one quiz.
     * Includes quiz-level cascade.
     *
     * @param int $cmid Course module ID.
     * @param array $qbeids Question bank entry IDs.
     * @param array $questionids Optional qbeid => questionid map for legacy.
     * @return array Map of qbeid => config.
     */
    public static function get_configs(int $cmid, array $qbeids,
                                       array $questionids = []): array {
        global $DB;
        $col = self::get_config_column();
        $defaults = self::get_instance_defaults();

        // Quiz-level cascade: use quiz defaults as base if available.
        if ($cmid > 0) {
            $quizrec = self::get_one(
                "cmid = :cmid AND questionbankentryid = 0",
                ['cmid' => $cmid]
            );
            if ($quizrec) {
                $qd = self::decode_config($quizrec->$col, $defaults);
                if ($qd !== null) {
                    $defaults = $qd;
                }
            }
        }

        $configs = [];
        $qbeids = array_values(array_unique(array_filter($qbeids)));
        foreach ($qbeids as $qbeid) {
            $configs[$qbeid] = $defaults;
        }
        if (empty($qbeids)) {
            return $configs;
        }

        // 1. Exact: cmid + qbeids.
        if ($cmid > 0) {
            list($insql, $params) = $DB->get_in_or_equal($qbeids, SQL_PARAMS_NAMED);
            $params['cmid']       = $cmid;
            $records              = $DB->get_records_select(
                self::TABLE,
                "cmid = :cmid AND questionbankentryid {$insql}",
                $params
            );
            foreach ($records as $rec) {
                $result = self::decode_config($rec->$col, $defaults);
                if ($result !== null) {
                    $configs[$rec->questionbankentryid] = $result;
                }
            }
        }

        // 2. Quiz-level default for all still-at-instance-default entries.
        $stilldefault = array_keys(array_filter(
            $configs,
            fn($cfg) => $cfg === $defaults
        ));
        if (!empty($stilldefault) && $cmid > 0) {
            $quizrec = self::get_one(
                "cmid = :cmid AND questionbankentryid IS NULL",
                ['cmid' => $cmid]
            );
            if ($quizrec) {
                $quizresult = self::decode_config($quizrec->$col, $defaults);
                if ($quizresult !== null) {
                    foreach ($stilldefault as $qbeid) {
                        $configs[$qbeid] = $quizresult;
                    }
                }
            }
        }

        // 3. Global fallback: cmid=0 + qbeid.
        $stilldefault = array_keys(array_filter(
            $configs,
            fn($cfg) => $cfg === $defaults
        ));
        if (!empty($stilldefault)) {
            list($insql, $params) = $DB->get_in_or_equal($stilldefault, SQL_PARAMS_NAMED);
            $params['cmid']       = 0;
            $records              = $DB->get_records_select(
                self::TABLE,
                "cmid = :cmid AND questionbankentryid {$insql}",
                $params
            );
            foreach ($records as $rec) {
                $result = self::decode_config($rec->$col, $defaults);
                if ($result !== null) {
                    $configs[$rec->questionbankentryid] = $result;
                }
            }
        }

        // 4. Any qbeid match.
        $stilldefault = array_keys(array_filter(
            $configs,
            fn($cfg) => $cfg === $defaults
        ));
        if (!empty($stilldefault)) {
            list($insql, $params) = $DB->get_in_or_equal($stilldefault, SQL_PARAMS_NAMED);
            $records              = $DB->get_records_select(
                self::TABLE,
                "questionbankentryid {$insql}",
                $params
            );
            foreach ($records as $rec) {
                $result = self::decode_config($rec->$col, $defaults);
                if ($result !== null && ($configs[$rec->questionbankentryid] ?? null) === $defaults) {
                    $configs[$rec->questionbankentryid] = $result;
                }
            }
        }

        // 5. Legacy: questionid field.
        if (!empty($questionids)) {
            $columns = $DB->get_columns(self::TABLE);
            if (isset($columns['questionid'])) {
                foreach ($configs as $qbeid => $cfg) {
                    if ($cfg === $defaults && isset($questionids[$qbeid])) {
                        $rec = self::get_one(
                            "questionid = :qid AND questionid > 0",
                            ['qid' => $questionids[$qbeid]]
                        );
                        if ($rec) {
                            $result = self::decode_config($rec->$col, $defaults);
                            if ($result !== null) {
                                $configs[$qbeid] = $result;
                            }
                        }
                    }
                }
            }
        }

        return $configs;
    }

    /**
     * Save config. Uses cmid + qbeid. Cleans duplicates.
     * For quiz-level config, pass qbeid=0 and questionid=0.
     *
     * @param int $cmid Course module ID.
     * @param int $qbeid Question bank entry ID (0 for quiz-level).
     * @param array $elements Config array.
     * @param int $questionid Optional questionid to resolve qbeid.
     * @throws \moodle_exception If qbeid cannot be determined for question-level.
     */
    public static function save_config(int $cmid, int $qbeid, array $elements,
                                       int $questionid = 0): void {
        global $DB, $USER;

        // For quiz-level (qbeid=0, questionid=0): allow saving with qbeid=0.
        if ($qbeid <= 0 && $questionid > 0) {
            $qbeid = self::resolve_qbeid($questionid);
            if (!$qbeid) {
                throw new \moodle_exception('cannotresolveqbeid', 'local_stackmatheditor');
            }
        } else if ($qbeid <= 0 && $questionid <= 0) {
            $qbeid = 0; // Quiz-level config.
        }

        $col = self::get_config_column();
        $now = time();
        $json = json_encode($elements, JSON_THROW_ON_ERROR);

        // Find ALL matching records (may be duplicates).
        $records = $DB->get_records_select(
            self::TABLE,
            "cmid = :cmid AND questionbankentryid = :qbeid",
            ['cmid' => $cmid, 'qbeid' => $qbeid],
            'timemodified DESC'
        );

        if (!empty($records)) {
            // Update newest, delete rest.
            $keeprecord = array_shift($records);
            $keeprecord->$col = $json;
            if (isset($keeprecord->questionid)) {
                $keeprecord->questionid = 0;
            }
            $keeprecord->usermodified = $USER->id;
            $keeprecord->timemodified = $now;
            $DB->update_record(self::TABLE, $keeprecord);

            foreach ($records as $dupe) {
                $DB->delete_records(self::TABLE, ['id' => $dupe->id]);
            }
        } else {
            $record = new \stdClass();
            $record->cmid = $cmid;
            $record->questionbankentryid = $qbeid;
            $record->$col = $json;
            $record->usermodified = $USER->id;
            $record->timecreated = $now;
            $record->timemodified = $now;
            $DB->insert_record(self::TABLE, $record);
        }
    }

    /**
     * Get admin mode (0=off, 1=on, 2=default-off, 3=default-on).
     *
     * @return int
     */
    public static function get_admin_mode(): int {
        return (int) get_config('local_stackmatheditor', 'enabled');
    }

    /**
     * Check if editor is enabled for a given quiz/question (cascade).
     *
     * @param int $cmid Course module ID.
     * @param int $qbeid Question bank entry ID (0 = quiz-level).
     * @return bool
     */
    public static function is_enabled_for(int $cmid, int $qbeid = 0): bool {
        $mode = self::get_admin_mode();
        if ($mode === 0) {
            return false;
        }
        if ($mode === 1) {
            return true;
        }

        // Mode 2 (default off) or 3 (default on).
        $default = ($mode === 3);

        // Quiz-level override.
        $quizraw = self::get_raw_config($cmid, 0);
        $effective = $default;
        if ($quizraw !== null && array_key_exists('_enabled', $quizraw)) {
            $effective = (bool) $quizraw['_enabled'];
        }

        if ($qbeid <= 0) {
            return $effective;
        }

        // Question-level override.
        $qraw = self::get_raw_config($cmid, $qbeid);
        if ($qraw !== null && array_key_exists('_enabled', $qraw)) {
            return (bool) $qraw['_enabled'];
        }

        return $effective;
    }

    /**
     * Get raw config at exactly one level (no cascade).
     *
     * @param int $cmid Course module ID.
     * @param int $qbeid Question bank entry ID (0 = quiz-level).
     * @return array|null Null if no record exists.
     */
    public static function get_raw_config(int $cmid, int $qbeid): ?array {
        $col = self::get_config_column();
        $rec = self::get_one(
            "cmid = :cmid AND questionbankentryid = :qbeid",
            ['cmid' => $cmid, 'qbeid' => $qbeid]
        );
        if (!$rec) {
            return null;
        }
        $json = $rec->$col ?? null;
        if (empty($json)) {
            return null;
        }
        $decoded = json_decode($json, true);
        return is_array($decoded) ? $decoded : null;
    }

    /**
     * Check if a quiz contains STACK questions.
     *
     * @param int $quizid Quiz instance ID.
     * @return bool
     */
    public static function quiz_has_stack_questions(int $quizid): bool {
        global $DB;
        $sql = "SELECT 1
                  FROM {quiz_slots} qs
                  JOIN {question_references} qr
                       ON qr.itemid = qs.id
                       AND qr.component = 'mod_quiz'
                       AND qr.questionarea = 'slot'
                  JOIN {question_bank_entries} qbe
                       ON qbe.id = qr.questionbankentryid
                  JOIN {question_versions} qv
                       ON qv.questionbankentryid = qbe.id
                  JOIN {question} q
                       ON q.id = qv.questionid
                 WHERE qs.quizid = :quizid
                   AND q.qtype = 'stack'";
        return $DB->record_exists_sql($sql, ['quizid' => $quizid]);
    }
}
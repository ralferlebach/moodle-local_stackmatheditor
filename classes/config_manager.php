<?php
namespace local_stackmatheditor;

defined('MOODLE_INTERNAL') || die();

/**
 * Manages per-quiz per-question toolbar configuration.
 *
 * All operations use cmid + questionbankentryid as the canonical key.
 * If a questionid is provided, it is first resolved to a qbeid.
 * All versions of a question share the same configuration.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Your Name
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class config_manager {

    /** @var string Database table name. */
    const TABLE = 'local_stackmatheditor';

    /**
     * Returns instance-wide default enabled state for all element groups.
     *
     * Reads from:
     * 1. New format: 'default_groups' (comma-separated enabled keys)
     * 2. Old format: individual 'default_X' settings (backward compat)
     * 3. Fallback: hardcoded defaults from definitions.php
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
        if (isset($columns['allowed_elements'])) {
            $col = 'allowed_elements';
        } else if (isset($columns['config'])) {
            $col = 'config';
        } else {
            $col = 'allowed_elements';
        }
        return $col;
    }

    /**
     * Public accessor for the config column name (for debug display).
     *
     * @return string Column name.
     */
    public static function get_config_column_public(): string {
        return self::get_config_column();
    }

    /**
     * Safe single-record fetch: returns newest matching record.
     * Prevents "found more than one record" errors from duplicates.
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
     * All versions of the same question return the same qbeid.
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

    /**
     * Decode a config JSON string and merge with defaults.
     *
     * @param string|null $json JSON string.
     * @param array $defaults Default values.
     * @return array|null Merged config or null if invalid.
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
     * Load config for a quiz + question.
     *
     * Accepts EITHER qbeid OR questionid (or both).
     * If only questionid is given, it is resolved to qbeid first.
     *
     * Lookup order:
     * 1. Exact: cmid + qbeid
     * 2. Global: cmid=0 + qbeid
     * 3. Any record with matching qbeid
     * 4. Legacy: questionid field in DB
     * 5. Instance defaults
     *
     * @param int $cmid Course module ID (0 for global).
     * @param int $qbeid Question bank entry ID (0 to auto-resolve).
     * @param int $questionid Question ID (for resolving qbeid and legacy lookup).
     * @return array Merged config array.
     */
    public static function get_config(int $cmid, int $qbeid = 0,
                                      int $questionid = 0): array {
        $col = self::get_config_column();
        $defaults = self::get_instance_defaults();

        // Always resolve to qbeid.
        $qbeid = self::ensure_qbeid($qbeid, $questionid) ?? 0;

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

        // 2. Global: cmid=0 + qbeid.
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

        // 3. Any record with matching qbeid.
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

        // 4. Legacy: questionid.
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
            $params['cmid'] = $cmid;
            $records = $DB->get_records_select(
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

        // 2. Global fallback.
        $stilldefault = [];
        foreach ($configs as $qbeid => $cfg) {
            if ($cfg === $defaults) {
                $stilldefault[] = $qbeid;
            }
        }
        if (!empty($stilldefault)) {
            list($insql, $params) = $DB->get_in_or_equal($stilldefault, SQL_PARAMS_NAMED);
            $params['cmid'] = 0;
            $records = $DB->get_records_select(
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

        // 3. Any qbeid match.
        $stilldefault = [];
        foreach ($configs as $qbeid => $cfg) {
            if ($cfg === $defaults) {
                $stilldefault[] = $qbeid;
            }
        }
        if (!empty($stilldefault)) {
            list($insql, $params) = $DB->get_in_or_equal($stilldefault, SQL_PARAMS_NAMED);
            $records = $DB->get_records_select(
                self::TABLE,
                "questionbankentryid {$insql}",
                $params
            );
            foreach ($records as $rec) {
                $result = self::decode_config($rec->$col, $defaults);
                if ($result !== null &&
                    ($configs[$rec->questionbankentryid] ?? null) === $defaults) {
                    $configs[$rec->questionbankentryid] = $result;
                }
            }
        }

        // 4. Legacy: questionid.
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
     * Save config. Always uses cmid + qbeid. Cleans duplicates.
     *
     * @param int $cmid Course module ID.
     * @param int $qbeid Question bank entry ID (0 to auto-resolve).
     * @param array $elements Config array.
     * @param int $questionid Optional questionid to resolve qbeid.
     * @throws \moodle_exception If qbeid cannot be determined.
     */
    public static function save_config(int $cmid, int $qbeid, array $elements,
                                       int $questionid = 0): void {
        global $DB, $USER;

        $qbeid = self::ensure_qbeid($qbeid, $questionid);
        if (!$qbeid) {
            throw new \moodle_exception('cannotresolveqbeid', 'local_stackmatheditor');
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
            $keeprecord->questionid = 0;
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
            $record->questionid = 0;
            $record->$col = $json;
            $record->usermodified = $USER->id;
            $record->timecreated = $now;
            $record->timemodified = $now;
            $DB->insert_record(self::TABLE, $record);
        }
    }
}

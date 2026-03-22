<?php
namespace local_stackmatheditor;

defined('MOODLE_INTERNAL') || die();

/**
 * Manages per-quiz per-question toolbar configuration.
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
     * Reads from plugin settings, falls back to definitions.php defaults.
     *
     * @return array Group key => bool.
     */
    public static function get_instance_defaults(): array {
        $groups = definitions::get_element_groups();
        $result = [];
        foreach ($groups as $key => $group) {
            $setting = get_config('local_stackmatheditor', 'default_' . $key);
            if ($setting !== false) {
                $result[$key] = (bool) $setting;
            } else {
                $result[$key] = $group['default_enabled'];
            }
        }
        return $result;
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
     * Resolve question ID to question bank entry ID.
     *
     * @param int $questionid Version-specific question ID.
     * @return int|null Question bank entry ID or null.
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
     * Load config for a quiz + question combination.
     * Lookup: exact cmid+qbeid -> global qbeid -> legacy questionid -> defaults.
     *
     * @param int $cmid Course module ID.
     * @param int $qbeid Question bank entry ID.
     * @param int $questionid Legacy question ID for fallback.
     * @return array Merged config.
     */
    public static function get_config(int $cmid, int $qbeid, int $questionid = 0): array {
        global $DB;
        $col = self::get_config_column();
        $defaults = self::get_instance_defaults();

        // 1. Exact: cmid + qbeid.
        if ($cmid > 0 && $qbeid > 0) {
            $rec = $DB->get_record(self::TABLE, [
                'cmid' => $cmid,
                'questionbankentryid' => $qbeid,
            ]);
            if ($rec && !empty($rec->$col)) {
                $decoded = json_decode($rec->$col, true);
                if (is_array($decoded)) {
                    return array_merge($defaults, $decoded);
                }
            }
        }

        // 2. Global: cmid=0 + qbeid.
        if ($qbeid > 0) {
            $rec = $DB->get_record(self::TABLE, [
                'cmid' => 0,
                'questionbankentryid' => $qbeid,
            ]);
            if ($rec && !empty($rec->$col)) {
                $decoded = json_decode($rec->$col, true);
                if (is_array($decoded)) {
                    return array_merge($defaults, $decoded);
                }
            }
        }

        // 3. Legacy: questionid.
        if ($questionid > 0) {
            $columns = $DB->get_columns(self::TABLE);
            if (isset($columns['questionid'])) {
                $rec = $DB->get_record(self::TABLE, ['questionid' => $questionid]);
                if ($rec && !empty($rec->$col)) {
                    $decoded = json_decode($rec->$col, true);
                    if (is_array($decoded)) {
                        return array_merge($defaults, $decoded);
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
     * @param array $questionids Map qbeid => questionid for legacy fallback.
     * @return array Map qbeid => config.
     */
    public static function get_configs(int $cmid, array $qbeids,
                                       array $questionids = []): array {
        global $DB;
        $col = self::get_config_column();
        $defaults = self::get_instance_defaults();
        $configs = [];

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
                if (!empty($rec->$col)) {
                    $decoded = json_decode($rec->$col, true);
                    if (is_array($decoded)) {
                        $configs[$rec->questionbankentryid] =
                            array_merge($defaults, $decoded);
                    }
                }
            }
        }

        // 2. Global fallback for still-default entries.
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
                if (!empty($rec->$col)) {
                    $decoded = json_decode($rec->$col, true);
                    if (is_array($decoded)) {
                        $configs[$rec->questionbankentryid] =
                            array_merge($defaults, $decoded);
                    }
                }
            }
        }

        // 3. Legacy fallback by questionid.
        if (!empty($questionids)) {
            $columns = $DB->get_columns(self::TABLE);
            if (isset($columns['questionid'])) {
                foreach ($configs as $qbeid => $cfg) {
                    if ($cfg === $defaults && isset($questionids[$qbeid])) {
                        $rec = $DB->get_record(self::TABLE,
                            ['questionid' => $questionids[$qbeid]]);
                        if ($rec && !empty($rec->$col)) {
                            $decoded = json_decode($rec->$col, true);
                            if (is_array($decoded)) {
                                $configs[$qbeid] =
                                    array_merge($defaults, $decoded);
                            }
                        }
                    }
                }
            }
        }

        return $configs;
    }

    /**
     * Save or update config for a quiz + question combination.
     *
     * @param int $cmid Course module ID.
     * @param int $qbeid Question bank entry ID.
     * @param array $elements Config array (may include _variableMode).
     */
    public static function save_config(int $cmid, int $qbeid, array $elements): void {
        global $DB, $USER;
        $col = self::get_config_column();
        $now = time();
        $json = json_encode($elements, JSON_THROW_ON_ERROR);

        $existing = $DB->get_record(self::TABLE, [
            'cmid' => $cmid,
            'questionbankentryid' => $qbeid,
        ]);

        if ($existing) {
            $existing->$col = $json;
            $existing->usermodified = $USER->id;
            $existing->timemodified = $now;
            $DB->update_record(self::TABLE, $existing);
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
}

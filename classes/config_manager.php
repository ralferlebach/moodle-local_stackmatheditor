<?php
namespace local_stackmatheditor;

defined('MOODLE_INTERNAL') || die();

/**
 * Manages per-quiz per-question toolbar configuration.
 *
 * Uses the existing table 'local_stackmatheditor' with added
 * cmid and questionbankentryid columns.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Your Name
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class config_manager {

    /** @var string Database table name. */
    const TABLE = 'local_stackmatheditor';

    /** @var string Config column name — detected at runtime. */
    private static $configcol = null;

    /** @var array Default toolbar element configuration. */
    const DEFAULT_ELEMENTS = [
        'fractions'    => true,
        'powers'       => true,
        'roots'        => true,
        'trigonometry' => true,
        'logarithms'   => true,
        'constants'    => true,
        'comparison'   => true,
        'parentheses'  => true,
        'calculus'     => false,
        'greek'        => false,
        'matrices'     => false,
    ];

    /**
     * Detect which column name is used for the JSON config.
     * Could be 'allowed_elements' or 'config' depending on when the table was created.
     *
     * @return string Column name.
     */
    private static function get_config_column(): string {
        global $DB;

        if (self::$configcol !== null) {
            return self::$configcol;
        }

        $columns = $DB->get_columns(self::TABLE);
        if (isset($columns['allowed_elements'])) {
            self::$configcol = 'allowed_elements';
        } else if (isset($columns['config'])) {
            self::$configcol = 'config';
        } else {
            // Fallback — try allowed_elements.
            self::$configcol = 'allowed_elements';
        }

        return self::$configcol;
    }

    /**
     * Resolve a version-specific question ID to the question bank entry ID.
     *
     * @param int $questionid The version-specific question ID.
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
     * Load configuration for a single quiz + question combination.
     *
     * Lookup priority:
     * 1. Exact match: cmid + questionbankentryid
     * 2. Fallback: questionbankentryid with cmid=0 (global)
     * 3. Legacy fallback: questionid (old records before migration)
     * 4. Default config
     *
     * @param int $cmid Course module ID of the quiz.
     * @param int $qbeid Question bank entry ID.
     * @param int $questionid Optional legacy question ID for fallback.
     * @return array Merged configuration array.
     */
    public static function get_config(int $cmid, int $qbeid, int $questionid = 0): array {
        global $DB;

        $col = self::get_config_column();

        // 1. Try exact match: cmid + qbeid.
        if ($cmid > 0 && $qbeid > 0) {
            $rec = $DB->get_record(self::TABLE, [
                'cmid' => $cmid,
                'questionbankentryid' => $qbeid,
            ]);
            if ($rec && !empty($rec->$col)) {
                $decoded = json_decode($rec->$col, true);
                if (is_array($decoded)) {
                    return array_merge(self::DEFAULT_ELEMENTS, $decoded);
                }
            }
        }

        // 2. Fallback: qbeid with cmid=0 (global config).
        if ($qbeid > 0) {
            $rec = $DB->get_record(self::TABLE, [
                'cmid' => 0,
                'questionbankentryid' => $qbeid,
            ]);
            if ($rec && !empty($rec->$col)) {
                $decoded = json_decode($rec->$col, true);
                if (is_array($decoded)) {
                    return array_merge(self::DEFAULT_ELEMENTS, $decoded);
                }
            }
        }

        // 3. Legacy fallback: questionid (old records).
        if ($questionid > 0) {
            $columns = $DB->get_columns(self::TABLE);
            if (isset($columns['questionid'])) {
                $rec = $DB->get_record(self::TABLE, ['questionid' => $questionid]);
                if ($rec && !empty($rec->$col)) {
                    $decoded = json_decode($rec->$col, true);
                    if (is_array($decoded)) {
                        return array_merge(self::DEFAULT_ELEMENTS, $decoded);
                    }
                }
            }
        }

        return self::DEFAULT_ELEMENTS;
    }

    /**
     * Load configurations for multiple questions in one quiz (batch).
     *
     * @param int $cmid Course module ID.
     * @param array $qbeids Array of question bank entry IDs.
     * @param array $questionids Optional map of qbeid => questionid for legacy fallback.
     * @return array Map of qbeid => config array.
     */
    public static function get_configs(int $cmid, array $qbeids,
                                       array $questionids = []): array {
        global $DB;

        $configs = [];
        if (empty($qbeids)) {
            return $configs;
        }

        $col = self::get_config_column();

        // Initialize all with defaults.
        foreach ($qbeids as $qbeid) {
            $configs[$qbeid] = self::DEFAULT_ELEMENTS;
        }

        // 1. Try exact match: cmid + qbeids.
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
                            array_merge(self::DEFAULT_ELEMENTS, $decoded);
                    }
                }
            }
        }

        // 2. For any still-default, try cmid=0 (global).
        $stilldefault = [];
        foreach ($configs as $qbeid => $cfg) {
            if ($cfg === self::DEFAULT_ELEMENTS) {
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
                            array_merge(self::DEFAULT_ELEMENTS, $decoded);
                    }
                }
            }
        }

        // 3. Legacy fallback for any still-default: try by questionid.
        if (!empty($questionids)) {
            $columns = $DB->get_columns(self::TABLE);
            if (isset($columns['questionid'])) {
                foreach ($configs as $qbeid => $cfg) {
                    if ($cfg === self::DEFAULT_ELEMENTS && isset($questionids[$qbeid])) {
                        $rec = $DB->get_record(self::TABLE, [
                            'questionid' => $questionids[$qbeid],
                        ]);
                        if ($rec && !empty($rec->$col)) {
                            $decoded = json_decode($rec->$col, true);
                            if (is_array($decoded)) {
                                $configs[$qbeid] =
                                    array_merge(self::DEFAULT_ELEMENTS, $decoded);
                            }
                        }
                    }
                }
            }
        }

        return $configs;
    }

    /**
     * Save or update configuration for a quiz + question combination.
     *
     * @param int $cmid Course module ID.
     * @param int $qbeid Question bank entry ID.
     * @param array $elements Configuration array.
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

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
 * Manages per-quiz per-question toolbar configuration.
 *
 * Lookup priority for get_config():
 *   1. Exact:      cmid + qbeid          (question-level)
 *   2. Quiz-def.:  cmid + qbeid IS NULL  (quiz-level default)  ← NEW
 *   3. Global:     cmid=0 + qbeid        (cross-quiz question default)
 *   4. Any qbeid   match                 (legacy fallback)
 *   5. Legacy:     questionid field      (very old records)
 *   6. Instance defaults                 (settings.php)
 *
 * Quiz-level defaults are stored with questionbankentryid = NULL.
 * Question-level configs use a concrete questionbankentryid integer.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class config_manager {
    /** @var string Database table name. */
    const TABLE = 'local_stackmatheditor';


    // Instance-level helpers.


    /**
     * Returns instance-wide default enabled state for all element groups.
     *
     * @return array Group key => bool.
     */
    public static function get_instance_defaults(): array {
        $groups = definitions::get_element_groups();

        $enabledstr = get_config('local_stackmatheditor', 'default_groups');
        if ($enabledstr !== false && $enabledstr !== '') {
            $enabled = array_map('trim', explode(',', $enabledstr));
            $result  = [];
            foreach ($groups as $key => $group) {
                $result[$key] = in_array($key, $enabled);
            }
            return $result;
        }

        $hasoldformat = false;
        $result       = [];
        foreach ($groups as $key => $group) {
            $setting = get_config('local_stackmatheditor', 'default_' . $key);
            if ($setting !== false) {
                $hasoldformat  = true;
                $result[$key]  = (bool) $setting;
            } else {
                $result[$key]  = $group['default_enabled'];
            }
        }
        if ($hasoldformat) {
            return $result;
        }

        return definitions::get_default_enabled();
    }


    /**
     * Returns the full instance-level base config used for inheritance.
     *
     * This includes the toolbar defaults plus non-toolbar keys that must also
     * inherit cleanly across instance → quiz → question levels.
     *
     * @return array
     */
    public static function get_instance_base_config(): array {
        $config = self::get_instance_defaults();
        $config['_variableMode'] = self::get_instance_variable_mode();
        return $config;
    }

    /**
     * Returns instance-wide implicit multiplication mode.
     *
     * @return string Normalised implicit multiplication mode.
     */
    public static function get_instance_variable_mode(): string {
        $mode = get_config('local_stackmatheditor', 'variablemode');
        return definitions::normalise_implicit_mode((string) $mode);
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
            return 1; // Safe default: enabled.
        }
        return $int;
    }


    // DB column helpers.


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
     * Public accessor for the config column name (for debug display).
     *
     * @return string Column name.
     */
    public static function get_config_column_public(): string {
        return self::get_config_column();
    }


    // Low-level DB fetch.


    /**
     * Safe single-record fetch: returns newest matching record.
     *
     * @param string $where SQL WHERE clause.
     * @param array  $params Query parameters.
     * @return \stdClass|null
     */
    private static function get_one(string $where, array $params): ?\stdClass {
        global $DB;
        $sql     = "SELECT * FROM {" . self::TABLE . "} WHERE {$where}"
                 . " ORDER BY timemodified DESC";
        $records = $DB->get_records_sql($sql, $params, 0, 1);
        return $records ? reset($records) : null;
    }


    // Qbeid resolution.


    /**
     * Resolve any question ID to its question bank entry ID.
     *
     * @param int $questionid
     * @return int|null
     */
    public static function resolve_qbeid(int $questionid): ?int {
        global $DB;
        $sql     = "SELECT qbe.id
                      FROM {question_bank_entries} qbe
                      JOIN {question_versions} qv ON qv.questionbankentryid = qbe.id
                     WHERE qv.questionid = :questionid
                  ORDER BY qv.version DESC";
        $records = $DB->get_records_sql($sql, ['questionid' => $questionid], 0, 1);
        $record  = reset($records);
        return $record ? (int) $record->id : null;
    }

    /**
     * Ensure we have a qbeid.
     *
     * @param int $qbeid
     * @param int $questionid
     * @return int|null
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


    // Decode helpers.


    /**
     * Decode a raw config JSON string.
     *
     * IMPORTANT: do not merge defaults here. Effective inheritance must be
     * resolved across instance → quiz → question by layering partial records.
     * Merging defaults at this stage would make an early match shadow higher
     * and lower precedence sources for keys it does not even contain.
     *
     * @param string|null $json
     * @return array|null
     */
    private static function decode_raw_config(?string $json): ?array {
        if (empty($json)) {
            return null;
        }
        $decoded = json_decode($json, true);
        if (!is_array($decoded)) {
            return null;
        }
        return $decoded;
    }

    /**
     * Merge a raw config layer into an effective config.
     *
     * @param array $base
     * @param array|null $layer
     * @return array
     */
    private static function merge_config_layer(array $base, ?array $layer): array {
        if ($layer === null) {
            return $base;
        }
        return array_merge($base, $layer);
    }


    // Public read API.


    /**
     * Load effective config for a quiz + question.
     *
     * Lookup order:
     *   1. cmid + qbeid          (question-level)
     *   2. cmid + NULL           (quiz-level default)
     *   3. cmid=0 + qbeid        (global question default)
     *   4. any qbeid match       (legacy)
     *   5. questionid field      (very old records)
     *   6. instance defaults     (settings.php)
     *
     * @param int $cmid       Course module ID (0 for global).
     * @param int $qbeid      Question bank entry ID (0 to auto-resolve).
     * @param int $questionid Question ID (for resolving qbeid and legacy lookup).
     * @return array Merged config array.
     */
    public static function get_config(
        int $cmid,
        int $qbeid = 0,
        int $questionid = 0
    ): array {
        global $DB;

        $col    = self::get_config_column();
        $result = self::get_instance_base_config();

        $qbeid = self::ensure_qbeid($qbeid, $questionid) ?? 0;

        // Lowest-priority legacy/global fallbacks first.
        if ($questionid > 0) {
            $columns = $DB->get_columns(self::TABLE);
            if (isset($columns['questionid'])) {
                $rec = self::get_one(
                    "questionid = :qid AND questionid > 0",
                    ['qid' => $questionid]
                );
                if ($rec) {
                    $result = self::merge_config_layer(
                        $result,
                        self::decode_raw_config($rec->$col)
                    );
                }
            }
        }

        if ($qbeid > 0) {
            $rec = self::get_one(
                "questionbankentryid = :qbeid",
                ['qbeid' => $qbeid]
            );
            if ($rec) {
                $result = self::merge_config_layer(
                    $result,
                    self::decode_raw_config($rec->$col)
                );
            }

            $rec = self::get_one(
                "cmid = 0 AND questionbankentryid = :qbeid",
                ['qbeid' => $qbeid]
            );
            if ($rec) {
                $result = self::merge_config_layer(
                    $result,
                    self::decode_raw_config($rec->$col)
                );
            }
        }

        // Quiz-level defaults override instance/global fallbacks.
        if ($cmid > 0) {
            $rec = self::get_one(
                "cmid = :cmid AND questionbankentryid IS NULL",
                ['cmid' => $cmid]
            );
            if ($rec) {
                $result = self::merge_config_layer(
                    $result,
                    self::decode_raw_config($rec->$col)
                );
            }
        }

        // Most specific question-level config wins last.
        if ($cmid > 0 && $qbeid > 0) {
            $rec = self::get_one(
                "cmid = :cmid AND questionbankentryid = :qbeid",
                ['cmid' => $cmid, 'qbeid' => $qbeid]
            );
            if ($rec) {
                $result = self::merge_config_layer(
                    $result,
                    self::decode_raw_config($rec->$col)
                );
            }
        }

        return $result;
    }

    /**
     * Load the quiz-level default config for a given cmid.
     * Returns null if no quiz-level record exists yet.
     *
     * @param int $cmid
     * @return array|null Decoded config or null.
     */
    public static function get_quiz_default(int $cmid): ?array {
        $col = self::get_config_column();

        $rec = self::get_one(
            "cmid = :cmid AND questionbankentryid IS NULL",
            ['cmid' => $cmid]
        );
        if (!$rec) {
            return null;
        }

        return self::merge_config_layer(
            self::get_instance_base_config(),
            self::decode_raw_config($rec->$col)
        );
    }

    /**
     * Batch-load configs for multiple questions in one quiz.
     *
     * @param int   $cmid
     * @param array $qbeids
     * @param array $questionids Optional qbeid => questionid map for legacy.
     * @return array Map of qbeid => config.
     */
    public static function get_configs(
        int $cmid,
        array $qbeids,
        array $questionids = []
    ): array {
        global $DB;
        $col      = self::get_config_column();
        $configs  = [];
        $base     = self::get_instance_base_config();
        $columns  = null;

        $qbeids = array_values(array_unique(array_filter($qbeids)));
        foreach ($qbeids as $qbeid) {
            $configs[$qbeid] = $base;
        }
        if (empty($qbeids)) {
            return $configs;
        }

        // 1. Legacy questionid layer (lowest fallback).
        if (!empty($questionids)) {
            $columns = $DB->get_columns(self::TABLE);
            if (isset($columns['questionid'])) {
                foreach ($qbeids as $qbeid) {
                    if (!isset($questionids[$qbeid])) {
                        continue;
                    }
                    $rec = self::get_one(
                        "questionid = :qid AND questionid > 0",
                        ['qid' => $questionids[$qbeid]]
                    );
                    if ($rec) {
                        $configs[$qbeid] = self::merge_config_layer(
                            $configs[$qbeid],
                            self::decode_raw_config($rec->$col)
                        );
                    }
                }
            }
        }

        // 2. Any qbeid match fallback.
        [$insql, $params] = $DB->get_in_or_equal($qbeids, SQL_PARAMS_NAMED);
        $records = $DB->get_records_select(
            self::TABLE,
            "questionbankentryid {$insql}",
            $params
        );
        foreach ($records as $rec) {
            $qbeid = (int) $rec->questionbankentryid;
            if (isset($configs[$qbeid])) {
                $configs[$qbeid] = self::merge_config_layer(
                    $configs[$qbeid],
                    self::decode_raw_config($rec->$col)
                );
            }
        }

        // 3. Global question defaults (cmid=0 + qbeid).
        $params['cmid'] = 0;
        $records = $DB->get_records_select(
            self::TABLE,
            "cmid = :cmid AND questionbankentryid {$insql}",
            $params
        );
        foreach ($records as $rec) {
            $qbeid = (int) $rec->questionbankentryid;
            if (isset($configs[$qbeid])) {
                $configs[$qbeid] = self::merge_config_layer(
                    $configs[$qbeid],
                    self::decode_raw_config($rec->$col)
                );
            }
        }

        // 4. Quiz-level default overrides lower layers for all slots.
        if ($cmid > 0) {
            $quizrec = self::get_one(
                "cmid = :cmid AND questionbankentryid IS NULL",
                ['cmid' => $cmid]
            );
            if ($quizrec) {
                $quizlayer = self::decode_raw_config($quizrec->$col);
                foreach ($configs as $qbeid => $cfg) {
                    $configs[$qbeid] = self::merge_config_layer($cfg, $quizlayer);
                }
            }
        }

        // 5. Exact question-level configs win last.
        if ($cmid > 0) {
            [$insql, $params] = $DB->get_in_or_equal($qbeids, SQL_PARAMS_NAMED);
            $params['cmid'] = $cmid;
            $records = $DB->get_records_select(
                self::TABLE,
                "cmid = :cmid AND questionbankentryid {$insql}",
                $params
            );
            foreach ($records as $rec) {
                $qbeid = (int) $rec->questionbankentryid;
                if (isset($configs[$qbeid])) {
                    $configs[$qbeid] = self::merge_config_layer(
                        $configs[$qbeid],
                        self::decode_raw_config($rec->$col)
                    );
                }
            }
        }

        return $configs;
    }


    // Public write API.


    /**
     * Save question-level config (cmid + qbeid).
     *
     * @param int   $cmid
     * @param int   $qbeid      Question bank entry ID (>0).
     * @param array $elements   Config array.
     * @param int   $questionid Optional questionid to resolve qbeid.
     * @throws \moodle_exception If qbeid cannot be determined.
     */
    public static function save_config(
        int $cmid,
        int $qbeid,
        array $elements,
        int $questionid = 0
    ): void {
        global $DB, $USER;

        $qbeid = self::ensure_qbeid($qbeid, $questionid);
        if (!$qbeid) {
            throw new \moodle_exception('cannotresolveqbeid', 'local_stackmatheditor');
        }

        self::upsert_record($cmid, $qbeid, $elements, $USER->id);
    }

    /**
     * Save quiz-level default config (cmid, questionbankentryid IS NULL).
     *
     * @param int   $cmid
     * @param array $elements Config array.
     */
    public static function save_quiz_default(int $cmid, array $elements): void {
        global $USER;
        self::upsert_record($cmid, null, $elements, $USER->id);
    }

    /**
     * Internal upsert. Handles both question-level (qbeid int) and
     * quiz-level (qbeid null) records. Removes duplicates on update.
     *
     * @param int      $cmid
     * @param int|null $qbeid  null for quiz-level default.
     * @param array    $elements
     * @param int      $userid
     */
    private static function upsert_record(
        int $cmid,
        ?int $qbeid,
        array $elements,
        int $userid
    ): void {
        global $DB;

        $col  = self::get_config_column();
        $now  = time();
        $json = json_encode($elements, JSON_THROW_ON_ERROR);

        if ($qbeid === null) {
            $where  = "cmid = :cmid AND questionbankentryid IS NULL";
            $params = ['cmid' => $cmid];
        } else {
            $where  = "cmid = :cmid AND questionbankentryid = :qbeid";
            $params = ['cmid' => $cmid, 'qbeid' => $qbeid];
        }

        $records = $DB->get_records_select(
            self::TABLE,
            $where,
            $params,
            'timemodified DESC'
        );

        if (!empty($records)) {
            $keep               = array_shift($records);
            $keep->$col         = $json;
            $keep->usermodified = $userid;
            $keep->timemodified = $now;
            $DB->update_record(self::TABLE, $keep);

            foreach ($records as $dupe) {
                $DB->delete_records(self::TABLE, ['id' => $dupe->id]);
            }
        } else {
            $record                      = new \stdClass();
            $record->cmid                = $cmid;
            $record->questionbankentryid = $qbeid; // Null for quiz-level defaults.
            $record->$col                = $json;
            $record->usermodified        = $userid;
            $record->timecreated         = $now;
            $record->timemodified        = $now;
            $DB->insert_record(self::TABLE, $record);
        }
    }


    // Enabled-flag helpers.


    /**
     * Determine whether the editor is effectively enabled for a given context.
     *
     * Mode semantics:
     *   0 = always off,  no override possible
     *   1 = always on,   no override possible
     *   2 = default off, quiz/question _enabled=true activates it
     *   3 = default on,  quiz/question _enabled=false deactivates it
     *
     * When $cmid=0 and $qbeid=0, only the instance mode is considered.
     *
     * @param int $cmid   Course module ID (0 = ignore quiz/question level).
     * @param int $qbeid  Question bank entry ID (0 = ignore question level).
     * @return bool
     */
    public static function get_effective_enabled(
        int $cmid = 0,
        int $qbeid = 0
    ): bool {
        $mode = self::get_instance_enabled_mode();

        if ($mode === 0) {
            return false;
        }
        if ($mode === 1) {
            return true;
        }

        // Mode 2 or 3 – check quiz then question level.
        $defaultenabled = ($mode === 3);

        // Load the most specific applicable config.
        if ($cmid > 0 && $qbeid > 0) {
            $cfg = self::get_config($cmid, $qbeid);
        } else if ($cmid > 0) {
            $cfg = self::get_quiz_default($cmid) ?? [];
        } else {
            return $defaultenabled;
        }

        if (isset($cfg['_enabled'])) {
            return (bool) $cfg['_enabled'];
        }

        return $defaultenabled;
    }
}

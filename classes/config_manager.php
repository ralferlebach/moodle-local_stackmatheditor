<?php
namespace local_stackmatheditor;

defined('MOODLE_INTERNAL') || die();

class config_manager {

    /** Standard-Konfiguration – alle Basis-Kategorien aktiv. */
    const DEFAULT_ELEMENTS = [
        'fractions'    => true,
        'powers'       => true,
        'roots'        => true,
        'trigonometry'  => true,
        'logarithms'   => true,
        'constants'    => true,
        'comparison'   => true,
        'parentheses'  => true,
        'calculus'     => false,
        'greek'        => false,
        'matrices'     => false,
    ];

    /**
     * Konfiguration für eine einzelne Frage laden.
     */
    public static function get_config(int $questionid): array {
        global $DB;
        $rec = $DB->get_record('local_stackmatheditor', ['questionid' => $questionid]);
        if ($rec && !empty($rec->allowed_elements)) {
            $decoded = json_decode($rec->allowed_elements, true);
            if (is_array($decoded)) {
                return array_merge(self::DEFAULT_ELEMENTS, $decoded);
            }
        }
        return self::DEFAULT_ELEMENTS;
    }

    /**
     * Konfigurationen für mehrere Fragen laden (Batch).
     */
    public static function get_configs(array $questionids): array {
        global $DB;
        $configs = [];
        if (empty($questionids)) {
            return $configs;
        }
        list($insql, $params) = $DB->get_in_or_equal($questionids, SQL_PARAMS_NAMED);
        $records = $DB->get_records_select('local_stackmatheditor', "questionid {$insql}", $params);

        foreach ($questionids as $qid) {
            $configs[$qid] = self::DEFAULT_ELEMENTS;
        }
        foreach ($records as $rec) {
            if (!empty($rec->allowed_elements)) {
                $decoded = json_decode($rec->allowed_elements, true);
                if (is_array($decoded)) {
                    $configs[$rec->questionid] = array_merge(self::DEFAULT_ELEMENTS, $decoded);
                }
            }
        }
        return $configs;
    }

    /**
     * Konfiguration speichern / aktualisieren.
     */
    public static function save_config(int $questionid, array $elements): void {
        global $DB, $USER;
        $now  = time();
        $json = json_encode($elements, JSON_THROW_ON_ERROR);

        $existing = $DB->get_record('local_stackmatheditor', ['questionid' => $questionid]);
        if ($existing) {
            $existing->allowed_elements = $json;
            $existing->usermodified     = $USER->id;
            $existing->timemodified     = $now;
            $DB->update_record('local_stackmatheditor', $existing);
        } else {
            $record = (object) [
                'questionid'       => $questionid,
                'allowed_elements' => $json,
                'usermodified'     => $USER->id,
                'timecreated'      => $now,
                'timemodified'     => $now,
            ];
            $DB->insert_record('local_stackmatheditor', $record);
        }
    }
}

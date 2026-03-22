<?php
namespace local_stackmatheditor;

defined('MOODLE_INTERNAL') || die();

/**
 * Manages per-question toolbar configuration.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Your Name
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class config_manager {

    /** @var string Database table name. */
    const TABLE = 'local_stackmatheditor';

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
     * Load configuration for a single question.
     *
     * @param int $questionid The question ID.
     * @return array Merged configuration array.
     */
    public static function get_config(int $questionid): array {
        global $DB;

        $rec = $DB->get_record(self::TABLE, ['questionid' => $questionid]);
        if ($rec && !empty($rec->allowed_elements)) {
            $decoded = json_decode($rec->allowed_elements, true);
            if (is_array($decoded)) {
                return array_merge(self::DEFAULT_ELEMENTS, $decoded);
            }
        }
        return self::DEFAULT_ELEMENTS;
    }

    /**
     * Load configurations for multiple questions (batch).
     *
     * @param array $questionids Array of question IDs.
     * @return array Map of questionid => config array.
     */
    public static function get_configs(array $questionids): array {
        global $DB;

        $configs = [];
        if (empty($questionids)) {
            return $configs;
        }

        list($insql, $params) = $DB->get_in_or_equal($questionids, SQL_PARAMS_NAMED);
        $records = $DB->get_records_select(self::TABLE, "questionid {$insql}", $params);

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
     * Save or update configuration for a question.
     *
     * @param int $questionid The question ID.
     * @param array $elements Configuration array.
     */
    public static function save_config(int $questionid, array $elements): void {
        global $DB, $USER;

        $now  = time();
        $json = json_encode($elements, JSON_THROW_ON_ERROR);

        $existing = $DB->get_record(self::TABLE, ['questionid' => $questionid]);
        if ($existing) {
            $existing->allowed_elements = $json;
            $existing->usermodified     = $USER->id;
            $existing->timemodified     = $now;
            $DB->update_record(self::TABLE, $existing);
        } else {
            $record = (object) [
                'questionid'       => $questionid,
                'allowed_elements' => $json,
                'usermodified'     => $USER->id,
                'timecreated'      => $now,
                'timemodified'     => $now,
            ];
            $DB->insert_record(self::TABLE, $record);
        }
    }
}

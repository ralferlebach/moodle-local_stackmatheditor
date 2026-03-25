<?php
namespace local_stackmatheditor\external;

defined('MOODLE_INTERNAL') || die();

use core_external\external_api;
use core_external\external_function_parameters;
use core_external\external_multiple_structure;
use core_external\external_single_structure;
use core_external\external_value;
use local_stackmatheditor\config_manager;

/**
 * External API: retrieve MathQuill toolbar configuration for a set of questions.
 *
 * Intended for future AJAX use (e.g. lazy-loading per-question config on the
 * quiz attempt page). Currently the editor_injector injects all configs server-
 * side; this endpoint provides a fallback for dynamic scenarios.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Ralf Erlebach
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class get_config extends external_api {

    /**
     * Describe the parameters accepted by execute().
     *
     * @return external_function_parameters
     */
    public static function execute_parameters(): external_function_parameters {
        return new external_function_parameters([
            'cmid' => new external_value(
                PARAM_INT,
                'Course module ID of the quiz'
            ),
            'questionids' => new external_multiple_structure(
                new external_value(PARAM_INT, 'Question ID')
            ),
        ]);
    }

    /**
     * Return toolbar configs for the given question IDs within a quiz.
     *
     * Each question ID is resolved to its question bank entry ID, then the
     * full config lookup chain (question → quiz-default → instance-default)
     * is applied via config_manager::get_configs().
     *
     * @param int   $cmid        Course module ID of the quiz.
     * @param int[] $questionids List of question IDs (version-specific).
     * @return array List of {questionid, config (JSON string)} objects.
     */
    public static function execute(int $cmid, array $questionids): array {
        $params = self::validate_parameters(
            self::execute_parameters(),
            ['cmid' => $cmid, 'questionids' => $questionids]
        );

        $context = \context_module::instance($params['cmid']);
        self::validate_context($context);

        // Resolve question IDs to question bank entry IDs.
        $qbeids     = [];
        $qbeidmap   = [];
        foreach ($params['questionids'] as $qid) {
            $qbeid = config_manager::resolve_qbeid($qid);
            if ($qbeid) {
                $qbeids[]          = $qbeid;
                $qbeidmap[$qbeid]  = $qid;
            }
        }

        $configs = config_manager::get_configs(
            $params['cmid'],
            $qbeids,
            $qbeidmap
        );

        $result = [];
        foreach ($qbeidmap as $qbeid => $qid) {
            $result[] = [
                'questionid' => (int) $qid,
                'config'     => json_encode(
                    $configs[$qbeid] ?? [],
                    JSON_UNESCAPED_UNICODE | JSON_HEX_TAG
                ),
            ];
        }
        return $result;
    }

    /**
     * Describe the return value of execute().
     *
     * @return external_multiple_structure
     */
    public static function execute_returns(): external_multiple_structure {
        return new external_multiple_structure(
            new external_single_structure([
                'questionid' => new external_value(
                    PARAM_INT,
                    'Question ID'
                ),
                'config'     => new external_value(
                    PARAM_RAW,
                    'JSON-encoded toolbar configuration'
                ),
            ])
        );
    }
}

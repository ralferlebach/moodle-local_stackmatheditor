<?php
namespace local_stackmatheditor\external;

defined('MOODLE_INTERNAL') || die();

use core_external\external_api;
use core_external\external_function_parameters;
use core_external\external_multiple_structure;
use core_external\external_single_structure;
use core_external\external_value;
use local_stackmatheditor\config_manager;

class get_config extends external_api {

    public static function execute_parameters(): external_function_parameters {
        return new external_function_parameters([
            'questionids' => new external_multiple_structure(
                new external_value(PARAM_INT, 'Question ID')
            ),
        ]);
    }

    public static function execute(array $questionids): array {
        $params = self::validate_parameters(
            self::execute_parameters(),
            ['questionids' => $questionids]
        );

        $context = \context_system::instance();
        self::validate_context($context);

        $configs = config_manager::get_configs($params['questionids']);

        $result = [];
        foreach ($configs as $qid => $config) {
            $result[] = [
                'questionid' => (int) $qid,
                'config'     => json_encode($config),
            ];
        }
        return $result;
    }

    public static function execute_returns(): external_multiple_structure {
        return new external_multiple_structure(
            new external_single_structure([
                'questionid' => new external_value(PARAM_INT, 'Question ID'),
                'config'     => new external_value(PARAM_RAW, 'JSON toolbar config'),
            ])
        );
    }
}

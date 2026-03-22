<?php
namespace local_stackmatheditor\privacy;

defined('MOODLE_INTERNAL') || die();

use core_privacy\local\metadata\collection;
use core_privacy\local\metadata\provider as metadata_provider;

class provider implements metadata_provider {

    public static function get_metadata(collection $collection): collection {
        $collection->add_database_table('local_stackmatheditor', [
            'questionid'       => 'privacy:metadata:questionid',
            'allowed_elements' => 'privacy:metadata:allowed_elements',
            'usermodified'     => 'privacy:metadata:usermodified',
        ], 'privacy:metadata:local_stackmatheditor');
        return $collection;
    }
}

<?php
namespace local_stackmatheditor\privacy;

defined('MOODLE_INTERNAL') || die();

use core_privacy\local\metadata\collection;
use core_privacy\local\metadata\provider as metadata_provider;

/**
 * Privacy subsystem implementation for local_stackmatheditor.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Your Name
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class provider implements metadata_provider {

    /**
     * Describe the metadata stored by this plugin.
     *
     * @param collection $collection The collection to add metadata to.
     * @return collection The updated collection.
     */
    public static function get_metadata(collection $collection): collection {
        $collection->add_database_table('local_stackmatheditor', [
            'questionid'       => 'privacy:metadata:questionid',
            'allowed_elements' => 'privacy:metadata:allowed_elements',
            'usermodified'     => 'privacy:metadata:usermodified',
        ], 'privacy:metadata:local_stackmatheditor');
        return $collection;
    }
}

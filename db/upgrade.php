<?php
defined('MOODLE_INTERNAL') || die();

/**
 * Upgrade steps for local_stackmatheditor.
 *
 * @param int $oldversion The old version of the plugin.
 * @return bool
 */
function xmldb_local_stackmatheditor_upgrade($oldversion) {
    global $DB;

    $dbman = $DB->get_manager();

    if ($oldversion < 2026032202) {

        $newtable = new xmldb_table('local_stackmatheditor');

        if (!$dbman->table_exists($newtable)) {

            // Try migrating from previous table names.
            $oldnames = ['local_stackmatheditor_cfg', 'local_sme_config'];
            $migrated = false;

            foreach ($oldnames as $oldname) {
                $oldtable = new xmldb_table($oldname);
                if ($dbman->table_exists($oldtable)) {
                    $dbman->rename_table($oldtable, 'local_stackmatheditor');
                    $migrated = true;
                    break;
                }
            }

            if (!$migrated) {
                // No previous table found — create fresh.
                $newtable->add_field('id', XMLDB_TYPE_INTEGER, '10',
                    null, XMLDB_NOTNULL, XMLDB_SEQUENCE, null);
                $newtable->add_field('questionid', XMLDB_TYPE_INTEGER, '10',
                    null, XMLDB_NOTNULL, null, null);
                $newtable->add_field('allowed_elements', XMLDB_TYPE_TEXT,
                    null, null, null, null, null);
                $newtable->add_field('usermodified', XMLDB_TYPE_INTEGER, '10',
                    null, XMLDB_NOTNULL, null, '0');
                $newtable->add_field('timecreated', XMLDB_TYPE_INTEGER, '10',
                    null, XMLDB_NOTNULL, null, '0');
                $newtable->add_field('timemodified', XMLDB_TYPE_INTEGER, '10',
                    null, XMLDB_NOTNULL, null, '0');

                $newtable->add_key('primary', XMLDB_KEY_PRIMARY, ['id']);
                $newtable->add_index('questionid_uix', XMLDB_INDEX_UNIQUE, ['questionid']);

                $dbman->create_table($newtable);
            }
        }

        upgrade_plugin_savepoint(true, 2026032202, 'local', 'stackmatheditor');
    }

    return true;
}

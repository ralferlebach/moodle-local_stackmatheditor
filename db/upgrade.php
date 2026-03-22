<?php
defined('MOODLE_INTERNAL') || die();

/**
 * Upgrade steps for local_stackmatheditor.
 *
 * Handles all possible starting states:
 * - Old table 'local_sme_config' with questionid + allowed_elements
 * - Old table 'local_stackmatheditor_cfg' with questionid + allowed_elements
 * - Old table 'local_stackmatheditor_quid' with cmid + questionbankentryid
 * - Current table 'local_stackmatheditor' with only questionid
 * - Current table 'local_stackmatheditor' with questionid + config column
 * - Current table 'local_stackmatheditor' already fully migrated
 *
 * Target state:
 *   Table 'local_stackmatheditor' with columns:
 *     id, cmid, questionbankentryid, questionid, allowed_elements,
 *     usermodified, timecreated, timemodified
 *
 * @param int $oldversion The previously installed version.
 * @return bool
 */
function xmldb_local_stackmatheditor_upgrade($oldversion) {
    global $DB;

    $dbman = $DB->get_manager();
    $targettable = new xmldb_table('local_stackmatheditor');

    // =========================================================================
    // STEP 1: Migrate data from any old alternative table names into the
    //         target table. Then drop the old tables.
    // =========================================================================
    if ($oldversion < 2026032200) {

        $oldtablenames = ['local_sme_config', 'local_stackmatheditor_cfg',
            'local_stackmatheditor_quid'];

        foreach ($oldtablenames as $oldname) {
            $oldtable = new xmldb_table($oldname);
            if (!$dbman->table_exists($oldtable)) {
                continue;
            }

            // Only migrate if target table exists and old table has records.
            if ($dbman->table_exists($targettable)) {
                $oldrecords = $DB->get_records($oldname);
                $oldcolumns = $DB->get_columns($oldname);

                foreach ($oldrecords as $oldrec) {
                    // Determine the config JSON value from whichever column exists.
                    $configjson = '';
                    if (isset($oldcolumns['allowed_elements']) &&
                        !empty($oldrec->allowed_elements)) {
                        $configjson = $oldrec->allowed_elements;
                    } else if (isset($oldcolumns['config']) &&
                        !empty($oldrec->config)) {
                        $configjson = $oldrec->config;
                    }

                    if (empty($configjson)) {
                        continue;
                    }

                    // Build a record for the target table.
                    $newrec = new \stdClass();
                    $newrec->cmid = 0;
                    $newrec->questionbankentryid = 0;
                    $newrec->questionid = 0;
                    $newrec->usermodified = $oldrec->usermodified ?? 0;
                    $newrec->timecreated = $oldrec->timecreated ?? time();
                    $newrec->timemodified = $oldrec->timemodified ?? time();

                    // Copy cmid if the old table had it.
                    if (isset($oldcolumns['cmid']) && !empty($oldrec->cmid)) {
                        $newrec->cmid = (int) $oldrec->cmid;
                    }

                    // Copy questionbankentryid if the old table had it.
                    if (isset($oldcolumns['questionbankentryid']) &&
                        !empty($oldrec->questionbankentryid)) {
                        $newrec->questionbankentryid = (int) $oldrec->questionbankentryid;
                    }

                    // Copy questionid if the old table had it.
                    if (isset($oldcolumns['questionid']) && !empty($oldrec->questionid)) {
                        $newrec->questionid = (int) $oldrec->questionid;
                    }

                    // Determine correct config column in target.
                    $targetcolumns = $DB->get_columns('local_stackmatheditor');
                    if (isset($targetcolumns['allowed_elements'])) {
                        $newrec->allowed_elements = $configjson;
                    } else if (isset($targetcolumns['config'])) {
                        $newrec->config = $configjson;
                    }

                    // Avoid duplicates.
                    $exists = false;
                    if ($newrec->questionid > 0) {
                        $exists = $DB->record_exists('local_stackmatheditor',
                            ['questionid' => $newrec->questionid]);
                    }
                    if (!$exists && $newrec->cmid > 0 &&
                        $newrec->questionbankentryid > 0) {
                        $exists = $DB->record_exists('local_stackmatheditor', [
                            'cmid' => $newrec->cmid,
                            'questionbankentryid' => $newrec->questionbankentryid,
                        ]);
                    }

                    if (!$exists) {
                        $DB->insert_record('local_stackmatheditor', $newrec);
                    }
                }
            }

            // Drop the old table.
            $dbman->drop_table($oldtable);
        }
    }

    // =========================================================================
    // STEP 2: Ensure the target table has all required columns.
    // =========================================================================
    if ($oldversion < 2026032200) {

        if (!$dbman->table_exists($targettable)) {
            // Table doesn't exist at all — should not happen (install.xml
            // creates it on fresh install), but handle it defensively.
            $targettable->add_field('id', XMLDB_TYPE_INTEGER, '10',
                null, XMLDB_NOTNULL, XMLDB_SEQUENCE, null);
            $targettable->add_field('cmid', XMLDB_TYPE_INTEGER, '10',
                null, XMLDB_NOTNULL, null, '0');
            $targettable->add_field('questionbankentryid', XMLDB_TYPE_INTEGER, '10',
                null, XMLDB_NOTNULL, null, '0');
            $targettable->add_field('questionid', XMLDB_TYPE_INTEGER, '10',
                null, XMLDB_NOTNULL, null, '0');
            $targettable->add_field('allowed_elements', XMLDB_TYPE_TEXT,
                null, null, null, null, null);
            $targettable->add_field('usermodified', XMLDB_TYPE_INTEGER, '10',
                null, XMLDB_NOTNULL, null, '0');
            $targettable->add_field('timecreated', XMLDB_TYPE_INTEGER, '10',
                null, XMLDB_NOTNULL, null, '0');
            $targettable->add_field('timemodified', XMLDB_TYPE_INTEGER, '10',
                null, XMLDB_NOTNULL, null, '0');
            $targettable->add_key('primary', XMLDB_KEY_PRIMARY, ['id']);
            $targettable->add_index('cmid_qbeid_ix', XMLDB_INDEX_NOTUNIQUE,
                ['cmid', 'questionbankentryid']);
            $targettable->add_index('questionid_ix', XMLDB_INDEX_NOTUNIQUE,
                ['questionid']);
            $dbman->create_table($targettable);

        } else {
            // Table exists — add any missing columns.

            // cmid.
            $field = new xmldb_field('cmid', XMLDB_TYPE_INTEGER, '10',
                null, XMLDB_NOTNULL, null, '0', 'id');
            if (!$dbman->field_exists($targettable, $field)) {
                $dbman->add_field($targettable, $field);
            }

            // questionbankentryid.
            $field = new xmldb_field('questionbankentryid', XMLDB_TYPE_INTEGER, '10',
                null, XMLDB_NOTNULL, null, '0', 'cmid');
            if (!$dbman->field_exists($targettable, $field)) {
                $dbman->add_field($targettable, $field);
            }

            // questionid (legacy — might already exist).
            $field = new xmldb_field('questionid', XMLDB_TYPE_INTEGER, '10',
                null, XMLDB_NOTNULL, null, '0', 'questionbankentryid');
            if (!$dbman->field_exists($targettable, $field)) {
                $dbman->add_field($targettable, $field);
            }

            // allowed_elements — the standard config column.
            $field = new xmldb_field('allowed_elements', XMLDB_TYPE_TEXT,
                null, null, null, null, null, 'questionid');
            if (!$dbman->field_exists($targettable, $field)) {
                // Maybe the column is called 'config' instead.
                $oldconfigfield = new xmldb_field('config');
                if ($dbman->field_exists($targettable, $oldconfigfield)) {
                    // Rename 'config' to 'allowed_elements'.
                    $dbman->rename_field($targettable, $oldconfigfield, 'allowed_elements');
                } else {
                    // Neither exists — create it.
                    $dbman->add_field($targettable, $field);
                }
            }

            // usermodified.
            $field = new xmldb_field('usermodified', XMLDB_TYPE_INTEGER, '10',
                null, XMLDB_NOTNULL, null, '0');
            if (!$dbman->field_exists($targettable, $field)) {
                $dbman->add_field($targettable, $field);
            }

            // timecreated.
            $field = new xmldb_field('timecreated', XMLDB_TYPE_INTEGER, '10',
                null, XMLDB_NOTNULL, null, '0');
            if (!$dbman->field_exists($targettable, $field)) {
                $dbman->add_field($targettable, $field);
            }

            // timemodified.
            $field = new xmldb_field('timemodified', XMLDB_TYPE_INTEGER, '10',
                null, XMLDB_NOTNULL, null, '0');
            if (!$dbman->field_exists($targettable, $field)) {
                $dbman->add_field($targettable, $field);
            }

            // Add indexes if missing.
            $index = new xmldb_index('cmid_qbeid_ix', XMLDB_INDEX_NOTUNIQUE,
                ['cmid', 'questionbankentryid']);
            if (!$dbman->index_exists($targettable, $index)) {
                $dbman->add_index($targettable, $index);
            }

            $index = new xmldb_index('questionid_ix', XMLDB_INDEX_NOTUNIQUE,
                ['questionid']);
            if (!$dbman->index_exists($targettable, $index)) {
                $dbman->add_index($targettable, $index);
            }

            // Drop old unique indexes that may conflict.
            // These were created by earlier versions of the plugin.
            $olduniqueindexes = [
                new xmldb_index('questionid_uix', XMLDB_INDEX_UNIQUE, ['questionid']),
                new xmldb_index('cmid_qbeid_uix', XMLDB_INDEX_UNIQUE,
                    ['cmid', 'questionbankentryid']),
            ];
            foreach ($olduniqueindexes as $oldidx) {
                if ($dbman->index_exists($targettable, $oldidx)) {
                    $dbman->drop_index($targettable, $oldidx);
                }
            }
        }
    }

    // =========================================================================
    // STEP 3: Migrate legacy data — fill in questionbankentryid from questionid
    //         for any records that have questionid but no questionbankentryid.
    // =========================================================================
    if ($oldversion < 2026032200) {

        $legacyrecords = $DB->get_records_select(
            'local_stackmatheditor',
            'questionid > 0 AND questionbankentryid = 0'
        );

        foreach ($legacyrecords as $rec) {
            $sql = "SELECT qbe.id
                      FROM {question_bank_entries} qbe
                      JOIN {question_versions} qv ON qv.questionbankentryid = qbe.id
                     WHERE qv.questionid = :questionid
                  ORDER BY qv.version DESC";

            $qberecs = $DB->get_records_sql($sql, ['questionid' => $rec->questionid], 0, 1);
            $qberec = reset($qberecs);

            if ($qberec) {
                $rec->questionbankentryid = (int) $qberec->id;
                $rec->timemodified = time();
                $DB->update_record('local_stackmatheditor', $rec);
            }
        }
    }

    // =========================================================================
    // STEP 4: Save upgrade point.
    // =========================================================================
    if ($oldversion < 2026032200) {
        upgrade_plugin_savepoint(true, 2026032200, 'local', 'stackmatheditor');
    }

    return true;
}

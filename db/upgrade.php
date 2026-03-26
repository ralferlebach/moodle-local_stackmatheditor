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

/**
 * Upgrade script for local_stackmatheditor.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
function xmldb_local_stackmatheditor_upgrade(int $oldversion): bool {
    global $DB;
    $dbman = $DB->get_manager();
    $targettable = new xmldb_table('local_stackmatheditor');

    // STEP 1: Ensure base table exists (initial install path).

    if ($oldversion < 2024010100) {
        if (!$dbman->table_exists($targettable)) {
            $table = new xmldb_table('local_stackmatheditor');
            $table->add_field('id', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, XMLDB_SEQUENCE);
            $table->add_field('cmid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('questionid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('config', XMLDB_TYPE_TEXT, null, null, null, null);
            $table->add_field('usermodified', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('timecreated', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('timemodified', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_key('primary', XMLDB_KEY_PRIMARY, ['id']);
            $dbman->create_table($table);
        }
        upgrade_plugin_savepoint(true, 2024010100, 'local', 'stackmatheditor');
    }

    // STEP 2: Add questionbankentryid + allowed_elements; clean up schema.

    if ($oldversion < 2026032200) {
        if ($dbman->table_exists($targettable)) {
            // Questionbankentryid (nullable from the start; NULL = quiz-level default).
            $field = new xmldb_field('questionbankentryid', XMLDB_TYPE_INTEGER, '10',
                null, null, null, null);
            if (!$dbman->field_exists($targettable, $field)) {
                $dbman->add_field($targettable, $field);
            }

            // Allowed_elements (replaces legacy 'config' column).
            $field = new xmldb_field('allowed_elements', XMLDB_TYPE_TEXT,
                null, null, null, null);
            if (!$dbman->field_exists($targettable, $field)) {
                $dbman->add_field($targettable, $field);
                // Copy data from old 'config' column if it exists.
                $columns = $DB->get_columns('local_stackmatheditor');
                if (isset($columns['config'])) {
                    $DB->execute(
                        "UPDATE {local_stackmatheditor}
                            SET allowed_elements = config
                          WHERE allowed_elements IS NULL AND config IS NOT NULL"
                    );
                }
            }

            // Usermodified.
            $field = new xmldb_field('usermodified', XMLDB_TYPE_INTEGER, '10',
                null, XMLDB_NOTNULL, null, '0');
            if (!$dbman->field_exists($targettable, $field)) {
                $dbman->add_field($targettable, $field);
            }

            // Timecreated.
            $field = new xmldb_field('timecreated', XMLDB_TYPE_INTEGER, '10',
                null, XMLDB_NOTNULL, null, '0');
            if (!$dbman->field_exists($targettable, $field)) {
                $dbman->add_field($targettable, $field);
            }

            // Timemodified.
            $field = new xmldb_field('timemodified', XMLDB_TYPE_INTEGER, '10',
                null, XMLDB_NOTNULL, null, '0');
            if (!$dbman->field_exists($targettable, $field)) {
                $dbman->add_field($targettable, $field);
            }

            // Index.
            $index = new xmldb_index('cmid_qbeid_ix', XMLDB_INDEX_NOTUNIQUE,
                ['cmid', 'questionbankentryid']);
            if (!$dbman->index_exists($targettable, $index)) {
                $dbman->add_index($targettable, $index);
            }

            // Drop old unique indexes.
            foreach ([
                new xmldb_index('questionid_uix', XMLDB_INDEX_UNIQUE, ['questionid']),
                new xmldb_index('cmid_qbeid_uix', XMLDB_INDEX_UNIQUE, ['cmid', 'questionbankentryid']),
                new xmldb_index('questionid_ix', XMLDB_INDEX_NOTUNIQUE, ['questionid']),
            ] as $oldidx) {
                if ($dbman->index_exists($targettable, $oldidx)) {
                    $dbman->drop_index($targettable, $oldidx);
                }
            }
        }
        upgrade_plugin_savepoint(true, 2026032200, 'local', 'stackmatheditor');
    }

    // STEP 3: Migrate legacy data – fill questionbankentryid from questionid.

    if ($oldversion < 2026032201) {
        $columns = $DB->get_columns('local_stackmatheditor');
        if (isset($columns['questionid'])) {
            $legacyrecords = $DB->get_records_select(
                'local_stackmatheditor',
                'questionid > 0 AND questionbankentryid IS NULL'
            );
            foreach ($legacyrecords as $rec) {
                $sql = "SELECT qbe.id
                          FROM {question_bank_entries} qbe
                          JOIN {question_versions} qv ON qv.questionbankentryid = qbe.id
                         WHERE qv.questionid = :questionid
                      ORDER BY qv.version DESC";
                $qberecs = $DB->get_records_sql($sql, ['questionid' => $rec->questionid], 0, 1);
                $qberec  = reset($qberecs);
                if ($qberec) {
                    $rec->questionbankentryid = (int) $qberec->id;
                    $rec->timemodified        = time();
                    $DB->update_record('local_stackmatheditor', $rec);
                }
            }
        }
        upgrade_plugin_savepoint(true, 2026032201, 'local', 'stackmatheditor');
    }

    // STEP 4: Make questionbankentryid nullable (supports quiz-level defaults).
    //
    // Quiz-level defaults are stored as:.
    // Cmid = <quiz cmid>,  questionbankentryid IS NULL.
    // Question-level configs remain:.
    // Cmid = <quiz cmid>,  questionbankentryid = <qbeid>

    if ($oldversion < 2026032400) {
        $columns = $DB->get_columns('local_stackmatheditor');
        if (isset($columns['questionbankentryid'])) {
            $col = $columns['questionbankentryid'];
            // Only alter if currently NOT NULL (has_default '0').
            if (!empty($col->not_null) || $col->not_null === true) {
                $field = new xmldb_field('questionbankentryid', XMLDB_TYPE_INTEGER, '10',
                    null, null, null, null);
                // Drop old cmid_qbeid_ix before altering (some DBs require it).
                $index = new xmldb_index('cmid_qbeid_ix', XMLDB_INDEX_NOTUNIQUE,
                    ['cmid', 'questionbankentryid']);
                if ($dbman->index_exists($targettable, $index)) {
                    $dbman->drop_index($targettable, $index);
                }
                $dbman->change_field_notnull($targettable, $field);
                // Recreate index.
                if (!$dbman->index_exists($targettable, $index)) {
                    $dbman->add_index($targettable, $index);
                }
            }
        }
        upgrade_plugin_savepoint(true, 2026032400, 'local', 'stackmatheditor');
    }

    return true;
}

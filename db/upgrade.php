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

/**
 * Upgrade the plugin from an older version.
 *
 * @param int $oldversion The version the plugin is upgrading from.
 * @return bool True on success.
 */
function xmldb_local_stackmatheditor_upgrade(int $oldversion): bool {
    global $DB;

    // A fresh install comes from db/install.xml.

    if ($oldversion < 2026100800) {
        // Data the versions before 2026100800 could leave behind, brought to the state a fresh
        // install of this version keeps by itself. The step is written against the
        // table, not against the plugin's classes, so a later change to them cannot change what
        // this step did. Running it twice changes nothing the second time.
        $table = 'local_stackmatheditor';

        // 1. Rows of course modules that no longer exist. Before 2026100800 nothing removed them
        // when a quiz or a course was deleted; they configure nothing and still name the user
        // who last changed them.
        $orphans = $DB->get_fieldset_sql(
            "SELECT sme.id
               FROM {" . $table . "} sme
              WHERE sme.cmid > 0
                    AND NOT EXISTS (SELECT 1
                                      FROM {context} ctx
                                     WHERE ctx.contextlevel = :modulelevel
                                           AND ctx.instanceid = sme.cmid)",
            ['modulelevel' => CONTEXT_MODULE]
        );
        foreach (array_chunk($orphans, 500) as $chunk) {
            $DB->delete_records_list($table, 'id', $chunk);
        }

        // 2. More than one row for one scope (cmid, questionbankentryid). Every read returns the
        // newest row (timemodified, then id); that is the one kept, so nothing a site shows
        // changes.
        // Read completely before deleting: some drivers do not allow writing to a table while a
        // recordset over it is open.
        $scopes = $DB->get_records_sql(
            "SELECT " . $DB->sql_concat('cmid', "'/'", 'COALESCE(questionbankentryid, 0)') . " AS scopekey,
                    cmid, questionbankentryid
               FROM {" . $table . "}
           GROUP BY cmid, questionbankentryid
             HAVING COUNT(1) > 1"
        );
        foreach ($scopes as $scope) {
            if ($scope->questionbankentryid === null) {
                $where = 'cmid = :cmid AND questionbankentryid IS NULL';
                $params = ['cmid' => $scope->cmid];
            } else {
                $where = 'cmid = :cmid AND questionbankentryid = :qbeid';
                $params = ['cmid' => $scope->cmid, 'qbeid' => $scope->questionbankentryid];
            }
            $ids = $DB->get_fieldset_sql(
                "SELECT id FROM {" . $table . "} WHERE {$where} ORDER BY timemodified DESC, id DESC",
                $params
            );
            $surplus = array_slice($ids, 1);
            if ($surplus) {
                $DB->delete_records_list($table, 'id', $surplus);
            }
        }

        upgrade_plugin_savepoint(true, 2026100800, 'local', 'stackmatheditor');
    }

    if ($oldversion < 2026100801) {
        // One configuration per scope, enforced by the database: the quiz-level default is stored
        // with questionbankentryid = 0 instead of NULL, the column becomes NOT NULL, and the index
        // on (cmid, questionbankentryid) becomes unique. With NULL the index could not be unique
        // in a portable way - PostgreSQL and MariaDB never treat two NULLs as equal. Written
        // against the table; every part checks the state first, so running it again changes
        // nothing.
        $dbman = $DB->get_manager();
        $table = new xmldb_table('local_stackmatheditor');
        $tablename = 'local_stackmatheditor';
        $unique = new xmldb_index('cmid_qbeid_uix', XMLDB_INDEX_UNIQUE, ['cmid', 'questionbankentryid']);

        // The non-unique index of earlier versions goes; a column with an index cannot change.
        $oldindex = new xmldb_index('cmid_qbeid_ix', XMLDB_INDEX_NOTUNIQUE, ['cmid', 'questionbankentryid']);
        if ($dbman->index_exists($table, $oldindex)) {
            $dbman->drop_index($table, $oldindex);
        }

        // 1. NULL becomes 0, the value of the quiz-level default from now on; then the column
        // gets default 0 and NOT NULL.
        $column = $DB->get_columns($tablename, false)['questionbankentryid'];
        if (!$column->not_null) {
            if ($dbman->index_exists($table, $unique)) {
                $dbman->drop_index($table, $unique);
            }
            $DB->execute("UPDATE {" . $tablename . "} SET questionbankentryid = 0 WHERE questionbankentryid IS NULL");
            $field = new xmldb_field('questionbankentryid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0', 'cmid');
            $dbman->change_field_default($table, $field);
            $dbman->change_field_notnull($table, $field);
        }

        // 2. A scope with more than one row - from the conversion (a NULL and a 0 row of the same
        // activity) or left over - keeps the row every read returned: newest, then highest id.
        $scopes = $DB->get_records_sql(
            "SELECT " . $DB->sql_concat('cmid', "'/'", 'questionbankentryid') . " AS scopekey,
                    cmid, questionbankentryid
               FROM {" . $tablename . "}
           GROUP BY cmid, questionbankentryid
             HAVING COUNT(1) > 1"
        );
        foreach ($scopes as $scope) {
            // One line per literal with a brace: the savepoint check of moodle-plugin-ci reads
            // string literals line by line and loses the block structure otherwise.
            $ids = $DB->get_fieldset_sql(
                "SELECT id FROM {" . $tablename . "} WHERE cmid = :cmid AND questionbankentryid = :qbeid" .
                    " ORDER BY timemodified DESC, id DESC",
                ['cmid' => $scope->cmid, 'qbeid' => $scope->questionbankentryid]
            );
            $surplus = array_slice($ids, 1);
            if ($surplus) {
                $DB->delete_records_list($tablename, 'id', $surplus);
            }
        }

        // 3. The unique index.
        if (!$dbman->index_exists($table, $unique)) {
            $dbman->add_index($table, $unique);
        }

        upgrade_plugin_savepoint(true, 2026100801, 'local', 'stackmatheditor');
    }

    return true;
}

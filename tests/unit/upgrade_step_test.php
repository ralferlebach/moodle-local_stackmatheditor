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

namespace local_stackmatheditor;

/**
 * The upgrade from the published 1.3.0 (2026100700): orphans and duplicate scopes go, the
 * quiz-level default moves from NULL to 0, the column becomes NOT NULL and the scope index unique;
 * everything else stays, and a second run changes nothing.
 *
 * The test puts the table back into the shape 2026100700 had (nullable column, non-unique index)
 * before it inserts the old data, and restores the current shape in any case afterwards.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 * @covers     ::xmldb_local_stackmatheditor_upgrade
 */
final class upgrade_step_test extends \advanced_testcase {
    /**
     * Insert one raw row.
     *
     * @param int $cmid Course module id.
     * @param int|null $qbeid Question bank entry id or null.
     * @param int $time timemodified.
     * @return int Record id.
     */
    private function row(int $cmid, ?int $qbeid, int $time): int {
        global $DB;
        return (int) $DB->insert_record(config_manager::TABLE, (object)[
            'cmid' => $cmid,
            'questionbankentryid' => $qbeid,
            'allowed_elements' => '{"_enabled":true}',
            'usermodified' => 2,
            'timecreated' => $time,
            'timemodified' => $time,
        ]);
    }

    /**
     * The table as 2026100700 created it: questionbankentryid nullable, the scope index not unique.
     *
     * @return void
     */
    private function old_schema(): void {
        global $DB;
        $dbman = $DB->get_manager();
        $table = new \xmldb_table(config_manager::TABLE);
        $unique = new \xmldb_index('cmid_qbeid_uix', XMLDB_INDEX_UNIQUE, ['cmid', 'questionbankentryid']);
        if ($dbman->index_exists($table, $unique)) {
            $dbman->drop_index($table, $unique);
        }
        $field = new \xmldb_field('questionbankentryid', XMLDB_TYPE_INTEGER, '10', null, null, null, null, 'cmid');
        $dbman->change_field_notnull($table, $field);
        $dbman->change_field_default($table, $field);
        $dbman->add_index($table, new \xmldb_index('cmid_qbeid_ix', XMLDB_INDEX_NOTUNIQUE, ['cmid', 'questionbankentryid']));
    }

    /**
     * Whether the table has the shape of a fresh install of this version.
     *
     * @return bool
     */
    private function current_schema(): bool {
        global $DB;
        $table = new \xmldb_table(config_manager::TABLE);
        $unique = new \xmldb_index('cmid_qbeid_uix', XMLDB_INDEX_UNIQUE, ['cmid', 'questionbankentryid']);
        $column = $DB->get_columns(config_manager::TABLE, false)['questionbankentryid'];
        return $DB->get_manager()->index_exists($table, $unique) && $column->not_null;
    }

    /**
     * Data a previous release leaves behind is repaired, the schema is the one of a fresh
     * install, and running the steps again is harmless.
     *
     * @return void
     */
    public function test_upgrade_repairs_and_is_idempotent(): void {
        global $CFG, $DB;
        require_once($CFG->dirroot . '/local/stackmatheditor/db/upgrade.php');
        require_once($CFG->libdir . '/upgradelib.php');
        $this->resetAfterTest();

        $course = $this->getDataGenerator()->create_course();
        $quiz = $this->getDataGenerator()->create_module('quiz', ['course' => $course->id]);
        $cmid = (int) get_coursemodule_from_instance('quiz', $quiz->id)->id;
        $quiz2 = $this->getDataGenerator()->create_module('quiz', ['course' => $course->id]);
        $cmid2 = (int) get_coursemodule_from_instance('quiz', $quiz2->id)->id;

        $this->old_schema();
        try {
            $default = $this->row($cmid, null, 100);
            $olddefault = $this->row($cmid, null, 50);
            $tieloser = $this->row($cmid, 11, 200);
            $tiewinner = $this->row($cmid, 11, 200);
            $global = $this->row(0, 12, 100);
            $globaldupe = $this->row(0, 12, 90);
            $orphan = $this->row(987654, null, 100);
            // Quiz 2 has its default both as NULL and as 0 - the conversion merges them, newest wins.
            $nulldefault = $this->row($cmid2, null, 100);
            $zerodefault = $this->row($cmid2, 0, 150);

            // The site is on the published release; the savepoints move it to this build.
            set_config('version', 2026100700, 'local_stackmatheditor');
            $this->assertTrue(xmldb_local_stackmatheditor_upgrade(2026100700));
            $this->assertSame('2026100801', (string) get_config('local_stackmatheditor', 'version'));
            $this->assertTrue($this->current_schema(), 'NOT NULL column and unique scope index');
            $this->assertSame(0, $DB->count_records_select(config_manager::TABLE, 'questionbankentryid IS NULL'));

            $remaining = array_map('intval', $DB->get_fieldset_select(config_manager::TABLE, 'id', '1 = 1'));
            sort($remaining);
            $expected = [$default, $tiewinner, $global, $zerodefault];
            sort($expected);
            $this->assertSame($expected, $remaining);
            $this->assertSame(0, (int) $DB->get_field(config_manager::TABLE, 'questionbankentryid', ['id' => $default]));
            foreach ([$olddefault, $tieloser, $globaldupe, $orphan, $nulldefault] as $gone) {
                $this->assertFalse($DB->record_exists(config_manager::TABLE, ['id' => $gone]), "row {$gone}");
            }
            $this->assertSame([], data_maintenance::find_orphans());
            $this->assertSame([], data_maintenance::find_duplicate_scopes());
            $this->assertSame(['_enabled' => true], config_manager::get_own_config($cmid));

            // A second run, from either earlier build, changes nothing.
            foreach ([2026100700, 2026100800] as $from) {
                set_config('version', $from, 'local_stackmatheditor');
                $this->assertTrue(xmldb_local_stackmatheditor_upgrade($from));
                $again = array_map('intval', $DB->get_fieldset_select(config_manager::TABLE, 'id', '1 = 1'));
                sort($again);
                $this->assertSame($expected, $again, "second run from {$from}");
                $this->assertTrue($this->current_schema());
            }
            $this->assertTrue(xmldb_local_stackmatheditor_upgrade(2026100801));
        } finally {
            if (!$this->current_schema()) {
                set_config('version', 2026100800, 'local_stackmatheditor');
                xmldb_local_stackmatheditor_upgrade(2026100800);
            }
        }
    }
}

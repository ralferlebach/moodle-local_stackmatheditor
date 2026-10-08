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
 * One configuration row per scope, enforced by the database, and the lock that makes writers wait.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 * @covers     \local_stackmatheditor\config_manager
 * @covers     \local_stackmatheditor\data_maintenance
 */
final class config_scope_integrity_test extends \advanced_testcase {
    /**
     * Insert one raw row, bypassing the application write path.
     *
     * @param int $cmid Course module id.
     * @param int $qbeid Question bank entry id, 0 for the quiz-level default.
     * @return int Record id.
     */
    private function raw(int $cmid, int $qbeid): int {
        global $DB;
        return (int) $DB->insert_record(config_manager::TABLE, (object)[
            'cmid'                => $cmid,
            'questionbankentryid' => $qbeid,
            'allowed_elements'    => '{}',
            'usermodified'        => 2,
            'timecreated'         => 100,
            'timemodified'        => 100,
        ]);
    }

    /**
     * The schema carries the invariant: questionbankentryid is NOT NULL with default 0, and
     * (cmid, questionbankentryid) is a unique index.
     *
     * @return void
     */
    public function test_schema_enforces_one_row_per_scope(): void {
        global $DB;
        $column = $DB->get_columns(config_manager::TABLE)['questionbankentryid'];
        $this->assertTrue($column->not_null);
        $this->assertSame('0', (string) $column->default_value);

        $table = new \xmldb_table(config_manager::TABLE);
        $index = new \xmldb_index('cmid_qbeid_uix', XMLDB_INDEX_UNIQUE, ['cmid', 'questionbankentryid']);
        $this->assertTrue($DB->get_manager()->index_exists($table, $index));
    }

    /**
     * The database refuses a second row for a scope - the quiz-level default included, which a
     * nullable column could not protect - and keeps different scopes apart.
     *
     * @return void
     */
    public function test_database_refuses_a_second_row(): void {
        global $DB;
        $this->resetAfterTest();
        $this->raw(500, 0);
        $this->raw(500, 77);
        $this->raw(0, 77);
        $this->raw(501, 0);
        $this->assertSame(4, $DB->count_records(config_manager::TABLE));

        foreach ([[500, 0], [500, 77], [0, 77]] as [$cmid, $qbeid]) {
            try {
                $this->raw($cmid, $qbeid);
                $this->fail("a second row for ({$cmid}, {$qbeid}) was accepted");
            } catch (\dml_write_exception $e) {
                $this->assertSame(4, $DB->count_records(config_manager::TABLE), "({$cmid}, {$qbeid})");
            }
        }
        $this->assertSame([], data_maintenance::find_duplicate_scopes());
        $this->assertSame(0, data_maintenance::repair_duplicates());
    }

    /**
     * Repeated saves update the one row of each scope; the quiz-level default is stored as 0.
     *
     * @return void
     */
    public function test_saves_keep_one_row_per_scope(): void {
        global $DB;
        $this->resetAfterTest();
        $this->setAdminUser();

        for ($i = 0; $i < 3; $i++) {
            config_manager::save_config(500, 77, ['_enabled' => (bool) ($i % 2)]);
            config_manager::save_quiz_default(500, ['_enabled' => (bool) ($i % 2)]);
        }
        $this->assertSame(1, $DB->count_records(config_manager::TABLE, ['cmid' => 500, 'questionbankentryid' => 77]));
        $this->assertSame(1, $DB->count_records(
            config_manager::TABLE,
            ['cmid' => 500, 'questionbankentryid' => config_manager::QUIZ_DEFAULT]
        ));
        $this->assertSame(2, $DB->count_records(config_manager::TABLE));
        $this->assertSame(['_enabled' => false], config_manager::get_own_config(500));
        $this->assertSame(['_enabled' => false], config_manager::get_own_config(500, 77));
    }

    /**
     * A writer waits for the scope lock and gives up with an exception instead of writing a
     * second row while another writer holds it.
     *
     * Runs with the database lock factory: it is the factory available on every database, and,
     * unlike PostgreSQL advisory locks, it is not re-entrant within one process, so the held lock
     * blocks the writer in this single-process test exactly as it blocks a parallel request.
     *
     * @return void
     */
    public function test_writer_respects_scope_lock(): void {
        global $CFG, $DB;
        $this->resetAfterTest();
        $this->setAdminUser();
        $CFG->lock_factory = '\\core\\lock\\db_record_lock_factory';
        set_config('locktimeout', 1, 'local_stackmatheditor');

        $holder = \core\lock\lock_config::get_lock_factory('local_stackmatheditor');
        $lock = $holder->get_lock(config_manager::scope_lock_key(900, 5), 0);
        $this->assertNotFalse($lock);
        try {
            config_manager::save_config(900, 5, ['_enabled' => true]);
            $this->fail('The writer must not pass a held scope lock.');
        } catch (\moodle_exception $e) {
            $this->assertSame('locktimeout', $e->errorcode);
        } finally {
            $lock->release();
        }
        $this->assertSame(0, $DB->count_records(config_manager::TABLE, ['cmid' => 900]));

        // Once the lock is free the same write goes through.
        config_manager::save_config(900, 5, ['_enabled' => true]);
        $this->assertSame(1, $DB->count_records(config_manager::TABLE, ['cmid' => 900]));
    }
}

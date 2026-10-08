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
 * Configuring is authorised by one write capability per module, everywhere (#86, #90).
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 * @covers     \local_stackmatheditor\quiz_helper::configure_capability
 * @covers     \local_stackmatheditor\quiz_helper::can_configure
 * @covers     ::local_stackmatheditor_extend_settings_navigation
 */
final class configure_capability_test extends \advanced_testcase {
    /** @var \stdClass Course. */
    private $course;

    /** @var \stdClass Quiz course module. */
    private $cm;

    /**
     * A course with one quiz.
     *
     * @return void
     */
    protected function setUp(): void {
        parent::setUp();
        $this->resetAfterTest();
        $this->course = $this->getDataGenerator()->create_course();
        $quiz = $this->getDataGenerator()->create_module('quiz', ['course' => $this->course->id]);
        $this->cm = get_coursemodule_from_instance('quiz', $quiz->id);
    }

    /**
     * A user enrolled with the given role.
     *
     * @param string $role Role shortname.
     * @return \stdClass User.
     */
    private function enrol(string $role): \stdClass {
        $user = $this->getDataGenerator()->create_user();
        $this->getDataGenerator()->enrol_user($user->id, $this->course->id, $role);
        return $user;
    }

    /**
     * The mapping: quiz and adaptive quiz have a write capability, other modules none.
     *
     * @return void
     */
    public function test_capability_mapping(): void {
        $this->assertSame('mod/quiz:manage', quiz_helper::configure_capability('quiz'));
        $this->assertSame('moodle/course:manageactivities', quiz_helper::configure_capability('adaptivequiz'));
        $this->assertNull(quiz_helper::configure_capability('forum'));
        $this->assertNull(quiz_helper::configure_capability(''));
    }

    /**
     * Both capabilities are write capabilities of module context or above, granted to editing
     * teachers and managers and not to non-editing teachers.
     *
     * @return void
     */
    public function test_capabilities_are_write_capabilities(): void {
        foreach (['quiz', 'adaptivequiz'] as $modname) {
            $capability = quiz_helper::configure_capability($modname);
            $info = get_capability_info($capability);
            $this->assertNotEmpty($info, $capability);
            $this->assertSame('write', $info->captype, $capability);
            $this->assertLessThanOrEqual(CONTEXT_MODULE, (int) $info->contextlevel, $capability);
            $this->assertSame(CAP_ALLOW, get_default_capabilities('editingteacher')[$capability] ?? null, $capability);
            $this->assertSame(CAP_ALLOW, get_default_capabilities('manager')[$capability] ?? null, $capability);
            $this->assertArrayNotHasKey($capability, get_default_capabilities('teacher'), $capability);
            $this->assertArrayNotHasKey($capability, get_default_capabilities('student'), $capability);
        }
    }

    /**
     * Editing teacher may, non-editing teacher (who can see the reports) may not, and a prohibit
     * on the module takes the right away again.
     *
     * @return void
     */
    public function test_can_configure_by_role(): void {
        $context = \context_module::instance($this->cm->id);

        $this->setUser($this->enrol('editingteacher'));
        $this->assertTrue(quiz_helper::can_configure((int) $this->cm->id));

        $teacher = $this->enrol('teacher');
        $this->setUser($teacher);
        $this->assertTrue(has_capability('mod/quiz:viewreports', $context), 'precondition: report access');
        $this->assertFalse(quiz_helper::can_configure((int) $this->cm->id));

        $editor = $this->enrol('editingteacher');
        $roleid = (int) $this->getDataGenerator()->create_role();
        $this->getDataGenerator()->role_assign($roleid, $editor->id, $context->id);
        assign_capability('mod/quiz:manage', CAP_PROHIBIT, $roleid, $context->id, true);
        $this->setUser($editor);
        $this->assertFalse(quiz_helper::can_configure((int) $this->cm->id));

        $this->setAdminUser();
        $this->assertFalse(quiz_helper::can_configure(0));
        $this->assertFalse(quiz_helper::can_configure(PHP_INT_MAX));
        $this->assertTrue(quiz_helper::can_manage_quiz((int) $this->cm->id), 'the old name follows');
    }

    /**
     * Build the settings navigation of the quiz page as the current user.
     *
     * The page becomes the global $PAGE: the callback and other plugins' callbacks read it.
     *
     * @return \settings_navigation Initialised settings navigation.
     */
    private function settings_navigation(): \settings_navigation {
        global $PAGE;
        $PAGE = new \moodle_page();
        $page = $PAGE;
        $page->set_url('/mod/quiz/view.php', ['id' => $this->cm->id]);
        $page->set_cm($this->cm, $this->course);
        $page->set_context(\context_module::instance($this->cm->id));
        $page->set_pagelayout('incourse');
        $nav = new \settings_navigation($page);
        $nav->initialise();
        return $nav;
    }

    /**
     * The real navigation callback: the link exists exactly for users who may configure.
     *
     * @return void
     */
    public function test_navigation_link_follows_capability(): void {
        set_config('enabled', 3, 'local_stackmatheditor');

        $this->setUser($this->enrol('editingteacher'));
        $nav = $this->settings_navigation();
        $node = $nav->find('stackmatheditor_configure', \navigation_node::TYPE_SETTING);
        $this->assertNotFalse($node, 'editing teacher sees the link');
        $this->assertTrue($node->action->compare(
            new \moodle_url('/local/stackmatheditor/configure.php'),
            URL_MATCH_BASE
        ));
        $this->assertEquals($this->cm->id, $node->action->get_param('cmid'));

        $this->setUser($this->enrol('teacher'));
        $nav = $this->settings_navigation();
        $this->assertFalse(
            $nav->find('stackmatheditor_configure', \navigation_node::TYPE_SETTING),
            'non-editing teacher does not'
        );
    }

    /**
     * Navigation and configuration page take the capability from the same helper; the report
     * capability is gone from both.
     *
     * @return void
     */
    public function test_navigation_and_page_share_the_check(): void {
        global $CFG;
        $root = $CFG->dirroot . '/local/stackmatheditor/';
        foreach (['lib.php', 'configure.php'] as $file) {
            $source = file_get_contents($root . $file);
            $this->assertStringContainsString('quiz_helper::configure_capability(', $source, $file);
            $this->assertStringNotContainsString('adaptivequiz:viewreport', $source, $file);
            $this->assertStringNotContainsString("'mod/quiz:manage'", $source, $file);
        }
        $hooks = file_get_contents($root . 'classes/hook_callbacks.php');
        $this->assertStringContainsString('quiz_helper::can_configure(', $hooks);
    }
}

@local @local_stackmatheditor
Feature: MathQuill toolbar configuration in a real Moodle
  As a course teacher
  I want to reach and use the editor configuration from the quiz pages
  So that students see only the relevant toolbar buttons

  # The Moodle stories only: navigation, the pages opening from where a teacher starts, saving and
  # reloading, and one direct-access security smoke. The access matrix, the inheritance, the
  # activation modes and the return URL rules are PHPUnit tests (docs/TEST-MIGRATION.md).

  Background:
    Given the following "users" exist:
      | username | firstname | lastname | email                |
      | teacher1 | Teacher   | One      | teacher@example.com  |
    And the following "courses" exist:
      | fullname | shortname |
      | Course 1 | C1        |
    And the following "course enrolments" exist:
      | user     | course | role           |
      | teacher1 | C1     | editingteacher |
    And the following "activities" exist:
      | activity | course | name      | idnumber |
      | quiz     | C1     | Test Quiz | quiz1    |

  @javascript
  Scenario: The quiz navigation offers the editor configuration, and the quiz page opens from it
    Given a STACK question exists in quiz "Test Quiz"
    And I log in as "teacher1"
    When I am on the "Test Quiz" "mod_quiz > Edit" page
    Then I should see "Set up STACK MathQuill Editor" in the quiz navigation select
    When I navigate to the STACK MathQuill quiz configuration
    Then I should see "MathQuill default settings for quiz: Test Quiz"
    And I should see "Default toolbar groups"

  @javascript
  Scenario: The question configuration opens from the question in the quiz
    Given a STACK question "My STACK Q" exists in quiz "Test Quiz"
    And I log in as "teacher1"
    And I am on the "Test Quiz" "mod_quiz > Edit" page
    When I click the MathQuill configure icon next to "My STACK Q"
    Then I should see "MathQuill toolbar for: My STACK Q"

  @javascript
  Scenario: A saved quiz configuration is still there after reloading
    Given a STACK question exists in quiz "Test Quiz"
    And I log in as "teacher1"
    And I am on the STACK MathQuill quiz configuration page for "Test Quiz"
    When I deselect the "Trigonometry" toolbar group
    And I press "Save configuration"
    And I reload the page
    Then the "Trigonometry" toolbar group should be deselected

  Scenario: A guest calling the configuration page directly gets the login page
    Given a STACK question exists in quiz "Test Quiz"
    When I am on the STACK MathQuill quiz configuration page for "Test Quiz" with question "stack"
    Then I should see "Log in"
    And I should not see "not a STACK question"
    And I should not see "Cannot resolve the question"

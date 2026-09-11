@local @local_stackmatheditor
Feature: Multiline MathQuill editor for STACK textarea inputs
  As a student
  I want the multiline editor to keep exactly the lines I see
  So that STACK receives my answer line by line, including intended empty lines

  # Real key presses into MathQuill (Selenium), no LaTeX injection: MathQuill's own key
  # handling is part of what is tested.

  Background:
    Given the following "users" exist:
      | username | firstname | lastname | email                |
      | student1 | Student   | One      | student1@example.com |
    And the following "courses" exist:
      | fullname | shortname |
      | Course 1 | C1        |
    And the following "course enrolments" exist:
      | user     | course | role    |
      | student1 | C1     | student |
    And the following config values are set as admin:
      | maximacommand | maxima | qtype_stack |
      | castimeout    | 300    | qtype_stack |
    And the STACK CAS platform is reset to direct Maxima
    And the plugin enabled mode is set to "1"
    And a STACK quiz "Multiline Quiz" with textarea input exists in "C1"
    And I log in as "student1"
    And I start the STACK MathQuill quiz attempt "Multiline Quiz"

  # ── Empty lines (#41) ───────────────────────────────────────────────────────────

  @javascript
  Scenario: Clearing a line keeps it as an empty line; a second Backspace removes it
    When I focus row 1 of the multiline MathQuill editor for "ans1"
    And I type "x=1"
    And I press the enter key
    And I type "y"
    And I press the enter key
    And I type "x=2"
    Then the multiline MathQuill editor for "ans1" should have 3 rows
    And the lines of the underlying STACK input for "ans1" should be "x=1|y|x=2"
    When I focus row 2 of the multiline MathQuill editor for "ans1"
    And I press the backspace key
    Then the multiline MathQuill editor for "ans1" should have 3 rows
    And the lines of the underlying STACK input for "ans1" should be "x=1||x=2"
    When I press the backspace key
    Then the multiline MathQuill editor for "ans1" should have 2 rows
    And the lines of the underlying STACK input for "ans1" should be "x=1|x=2"

  @javascript
  Scenario: Delete removes an already empty line as well
    When I focus row 1 of the multiline MathQuill editor for "ans1"
    And I type "a"
    And I press the enter key
    And I type "b"
    And I press the enter key
    And I type "c"
    And I focus row 2 of the multiline MathQuill editor for "ans1"
    And I press the backspace key
    Then the multiline MathQuill editor for "ans1" should have 3 rows
    When I press the delete key
    Then the multiline MathQuill editor for "ans1" should have 2 rows
    And the lines of the underlying STACK input for "ans1" should be "a|c"

  @javascript
  Scenario: The last remaining line is never removed
    When I focus row 1 of the multiline MathQuill editor for "ans1"
    And I type "a"
    And I press the backspace key
    And I press the backspace key
    And I press the delete key
    Then the multiline MathQuill editor for "ans1" should have 1 rows
    And the lines of the underlying STACK input for "ans1" should be ""

  # ── Transient states (#48) ─────────────────────────────────────────────────────

  @javascript
  Scenario: An emptied denominator does not survive the finished fraction
    When I focus row 1 of the multiline MathQuill editor for "ans1"
    And I type "2/12"
    Then the lines of the underlying STACK input for "ans1" should be "(2)/(12)"
    When I press the backspace key
    And I press the backspace key
    Then the lines of the underlying STACK input for "ans1" should be "(2)/()"
    When I type "6"
    And I press the up key
    And I press the backspace key
    And I type "1"
    Then the lines of the underlying STACK input for "ans1" should be "(1)/(6)"

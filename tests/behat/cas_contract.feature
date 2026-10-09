@local @local_stackmatheditor @local_stackmatheditor_cas
Feature: An answer written in the editor is read by STACK
  In order to trust the toolbar
  As a question author
  I need STACK to read what the editor writes into a real attempt

  # One browser smoke. The full contract - every button, against the real STACK parser and a real
  # Maxima - is tests/fixtures/math_contracts.json, run by tests/jest/math_contracts.test.js and
  # tests/unit/cas_contract_test.php; this is the contract marked "browserSmoke" there.

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
    And the plugin enabled mode is set to "1"
    And a STACK quiz "Contract Quiz" with algebraic input exists in "C1"
    And I log in as "student1"
    And I start the STACK MathQuill quiz attempt "Contract Quiz"

  @javascript
  Scenario: A matrix from the editor is interpreted by STACK
    When I enter latex "\begin{bmatrix}1&2\\3&4\end{bmatrix}" into the MathQuill field for "ans1"
    Then the underlying STACK input for "ans1" should be "matrix([1,2],[3,4])"
    And STACK should accept the answer in "ans1"

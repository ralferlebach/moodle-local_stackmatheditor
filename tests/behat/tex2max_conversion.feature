@local @local_stackmatheditor
Feature: tex2max conversion produces correct Maxima output
  As a student
  I want mathematical expressions I type to be correctly converted to Maxima
  So that STACK can evaluate my answers properly

  Background:
    Given the following "users" exist:
      | username | firstname | lastname | email               |
      | student1 | Student   | One      | student@example.com |
    And the following "courses" exist:
      | fullname | shortname |
      | Course 1 | C1        |
    And the following "course enrolments" exist:
      | user     | course | role    |
      | student1 | C1     | student |
    And a STACK quiz "Conversion Quiz" with algebraic input exists in "C1"
    And the plugin enabled mode is set to "1"

  # ── Issue #27: Maxima operator keywords not treated as implicit multiplication

  @javascript
  Scenario: "or" keyword is passed through as logical operator, not o*r
    Given I log in as "student1"
    And I am attempting the quiz "Conversion Quiz"
    When the tex2max output for latex "x=3 or x=6" in variableMode "explicit_single" is evaluated
    Then the tex2max result should contain "or"
    And the tex2max result should not contain "o*r"
    And the tex2max result should not contain "o r"

  @javascript
  Scenario: "and" keyword is passed through as logical operator, not a*n*d
    Given I log in as "student1"
    And I am attempting the quiz "Conversion Quiz"
    When the tex2max output for latex "x>0 and x<5" in variableMode "explicit_single" is evaluated
    Then the tex2max result should contain "and"
    And the tex2max result should not contain "a*n*d"

  @javascript
  Scenario: "not" keyword is passed through as logical operator, not n*o*t
    Given I log in as "student1"
    And I am attempting the quiz "Conversion Quiz"
    When the tex2max output for latex "not p" in variableMode "explicit_single" is evaluated
    Then the tex2max result should contain "not"
    And the tex2max result should not contain "n*o*t"

  @javascript
  Scenario: Logical LaTeX operators \lor and \land convert to spaced Maxima keywords
    Given I log in as "student1"
    And I am attempting the quiz "Conversion Quiz"
    When the tex2max output for latex "x=3\lor x=6" in variableMode "stack" is evaluated
    Then the tex2max result should contain " or "
    And the tex2max result should not contain "lor"

  @javascript
  Scenario: Set theory LaTeX operators convert to correct Maxima keywords
    Given I log in as "student1"
    And I am attempting the quiz "Conversion Quiz"
    When the tex2max output for latex "x\in A\cup B" in variableMode "stack" is evaluated
    Then the tex2max result should contain " in "
    And the tex2max result should contain " union "

  # ── Issue #29: Mixed fractions produce implicit addition, not multiplication

  @javascript
  Scenario: Mixed fraction 2 3/4 converts to addition not multiplication
    Given I log in as "student1"
    And I am attempting the quiz "Conversion Quiz"
    When the tex2max output for latex "2\frac{3}{4}" in variableMode "stack" is evaluated
    Then the tex2max result should be "(2+(3)/(4))"

  @javascript
  Scenario: Mixed fraction 1 1/2 converts to 1+(1)/(2)
    Given I log in as "student1"
    And I am attempting the quiz "Conversion Quiz"
    When the tex2max output for latex "1\frac{1}{2}" in variableMode "stack" is evaluated
    Then the tex2max result should be "(1+(1)/(2))"

  @javascript
  Scenario: Regular fraction without leading integer is unaffected
    Given I log in as "student1"
    And I am attempting the quiz "Conversion Quiz"
    When the tex2max output for latex "\frac{3}{4}" in variableMode "stack" is evaluated
    Then the tex2max result should be "(3)/(4)"

  @javascript
  Scenario: Algebraic fraction with variable numerator is unaffected by mixed-fraction guard
    Given I log in as "student1"
    And I am attempting the quiz "Conversion Quiz"
    When the tex2max output for latex "2\frac{x}{4}" in variableMode "stack" is evaluated
    Then the tex2max result should contain "2"
    And the tex2max result should not contain "2+(x)"

  # ── Issue #31: \pi converts to plain "pi" by default

  @javascript
  Scenario: Pi converts to plain "pi" with default plugin setting
    Given the plugin "usepercentpi" setting is "0"
    And I log in as "student1"
    And I am attempting the quiz "Conversion Quiz"
    When the tex2max output for latex "\pi" in variableMode "stack" is evaluated
    Then the tex2max result should be "pi"

  @javascript
  Scenario: Pi converts to "%pi" when usepercentpi setting is enabled
    Given the plugin "usepercentpi" setting is "1"
    And I log in as "student1"
    And I am attempting the quiz "Conversion Quiz"
    When the tex2max output for latex "\pi" in variableMode "stack" is evaluated
    Then the tex2max result should be "%pi"

  @javascript
  Scenario: Pi in expression converts to plain "pi" by default
    Given the plugin "usepercentpi" setting is "0"
    And I log in as "student1"
    And I am attempting the quiz "Conversion Quiz"
    When the tex2max output for latex "2\pi r" in variableMode "stack" is evaluated
    Then the tex2max result should contain "pi"
    And the tex2max result should not contain "%pi"

  # Section: mixed fraction adjacent to variable (issue #29 follow-up)

  @javascript
  Scenario: Mixed fraction followed by variable wraps entire mixed fraction
    Given I log in as "student1"
    And I am attempting the quiz "Conversion Quiz"
    When the tex2max output for latex "2\\frac{1}{2}a" in variableMode "stack" is evaluated
    Then the tex2max result should be "(2+(1)/(2))*a"

  @javascript
  Scenario: Mixed fraction preceded by variable wraps entire mixed fraction
    Given I log in as "student1"
    And I am attempting the quiz "Conversion Quiz"
    When the tex2max output for latex "a 2\\frac{1}{2}" in variableMode "stack" is evaluated
    Then the tex2max result should be "a*(2+(1)/(2))"

  @javascript
  Scenario: Mixed fraction between two variables wraps entire mixed fraction
    Given I log in as "student1"
    And I am attempting the quiz "Conversion Quiz"
    When the tex2max output for latex "a 2\\frac{1}{2} b" in variableMode "stack" is evaluated
    Then the tex2max result should be "a*(2+(1)/(2))*b"

  @javascript
  Scenario: Standalone mixed fraction is always wrapped in parentheses
    Given I log in as "student1"
    And I am attempting the quiz "Conversion Quiz"
    When the tex2max output for latex "2\\frac{1}{2}" in variableMode "stack" is evaluated
    Then the tex2max result should be "(2+(1)/(2))"

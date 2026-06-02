@local @local_stackmatheditor
Feature: tex2max converts LaTeX to Maxima notation correctly
  As a plugin developer
  I want the MathQuill editor to produce correct Maxima output for all supported constructs
  So that STACK questions receive syntactically valid CAS expressions

  # Tests drive the full UI path: MathQuill input -> tex2max -> hidden STACK input.
  # Requires a working STACK CAS (for quiz attempt rendering) and MathQuill init.
  # The plugin variableMode is configured per-quiz; tests use the default "explicit_single"
  # for operator-protection tests and "stack" for symbol/fraction tests.

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
    And the plugin enabled mode is set to "1"
    And a STACK quiz "Conversion Quiz" with algebraic input exists in "C1"
    And I log in as "student1"
    And I start the STACK MathQuill quiz attempt "Conversion Quiz"

  # ── Operator keyword protection (#27) ────────────────────────────────────────

  @javascript
  Scenario: "or" is not split into o*r in explicit_single mode
    When I enter latex "x=3 or x=6" into the MathQuill field for "ans1"
    Then the underlying STACK input for "ans1" should contain "or"
    And the underlying STACK input for "ans1" should not contain "o*r"

  @javascript
  Scenario: "and" is not split into a*n*d in explicit_single mode
    When I enter latex "x>0 and x<5" into the MathQuill field for "ans1"
    Then the underlying STACK input for "ans1" should contain "and"
    And the underlying STACK input for "ans1" should not contain "a*n*d"

  @javascript
  Scenario: "not" is not split into n*o*t in explicit_single mode
    When I enter latex "\neg (x=0)" into the MathQuill field for "ans1"
    Then the underlying STACK input for "ans1" should not contain "n*o*t"

  # ── Mixed-fraction fix (#29) ──────────────────────────────────────────────────

  @javascript
  Scenario: Mixed fraction 2+1/2 is grouped correctly
    When I enter latex "2\frac{1}{2}" into the MathQuill field for "ans1"
    Then the underlying STACK input for "ans1" should be "(2+1/2)"

  @javascript
  Scenario: Multi-digit mixed fraction 21+3/4 is grouped correctly
    When I enter latex "21\frac{3}{4}" into the MathQuill field for "ans1"
    Then the underlying STACK input for "ans1" should be "(21+3/4)"

  @javascript
  Scenario: Regular fraction is not affected by mixed-fraction fix
    When I enter latex "\frac{1}{2}" into the MathQuill field for "ans1"
    Then the underlying STACK input for "ans1" should be "(1)/(2)"

  # ── Pi notation (#31) ─────────────────────────────────────────────────────────

  @javascript
  Scenario: Pi is rendered as plain "pi" by default (usePercentPi off)
    When I enter latex "\pi" into the MathQuill field for "ans1"
    Then the underlying STACK input for "ans1" should be "pi"

  @javascript
  Scenario: Pi is rendered as "%pi" when usePercentPi is enabled
    Given the plugin usePercentPi setting is "1"
    When I enter latex "\pi" into the MathQuill field for "ans1"
    Then the underlying STACK input for "ans1" should be "%pi"

  # ── pm / ± expansion (#30) ────────────────────────────────────────────────────

  @javascript
  Scenario: Prefix pm produces two variants with unary plus stripped
    When I enter latex "x=\pm 2" into the MathQuill field for "ans1"
    Then the underlying STACK input for "ans1" should contain "or"
    And the underlying STACK input for "ans1" should contain "x=2"
    And the underlying STACK input for "ans1" should contain "x=-2"
    And the underlying STACK input for "ans1" should not contain "x=+2"

  @javascript
  Scenario: Infix pm retains both plus and minus signs
    When I enter latex "a\pm b" into the MathQuill field for "ans1"
    Then the underlying STACK input for "ans1" should contain "a+b or a-b"

  # ── Set-theory (#28) ─────────────────────────────────────────────────────────

  @javascript
  Scenario: Set-theory notin converts to Maxima keyword
    When I enter latex "x\notin A" into the MathQuill field for "ans1"
    Then the underlying STACK input for "ans1" should contain "notin"

  @javascript
  Scenario: Set-theory union converts to Maxima keyword
    When I enter latex "A\cup B" into the MathQuill field for "ans1"
    Then the underlying STACK input for "ans1" should contain "union"

  # ── Logic operators ───────────────────────────────────────────────────────────

  @javascript
  Scenario: Logic "and" from \land converts correctly
    When I enter latex "p\land q" into the MathQuill field for "ans1"
    Then the underlying STACK input for "ans1" should contain "and"

  @javascript
  Scenario: Logic "implies" from \Rightarrow converts correctly
    When I enter latex "p\Rightarrow q" into the MathQuill field for "ans1"
    Then the underlying STACK input for "ans1" should contain "implies"

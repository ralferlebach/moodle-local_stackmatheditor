@local @local_stackmatheditor
Feature: tex2max converts LaTeX to Maxima notation correctly
  As a plugin developer
  I want tex2max to produce correct Maxima output for all supported constructs
  So that STACK questions receive syntactically valid CAS expressions

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
      | platform      | linux  | qtype_stack |
      | maximacommand | maxima | qtype_stack |
      | castimeout    | 30     | qtype_stack |
    And the plugin enabled mode is set to "1"
    And a STACK quiz "Conversion Quiz" with algebraic input exists in "C1"
    And I log in as "student1"
    And I start the STACK MathQuill quiz attempt "Conversion Quiz"

  # ── Operator keyword protection (#27) ─────────────────────────────────────

  @javascript
  Scenario: "or" is not split into o*r in explicit_single mode
    When the tex2max output for latex "x=3 or x=6" in variableMode "explicit_single" is evaluated
    Then the tex2max result should not contain "*"
    And  the tex2max result should contain "or"

  @javascript
  Scenario: "and" is not split into a*n*d in explicit_single mode
    When the tex2max output for latex "x>0 and x<5" in variableMode "explicit_single" is evaluated
    Then the tex2max result should not contain "a*n*d"
    And  the tex2max result should contain "and"

  @javascript
  Scenario: "not" is not split into n*o*t in explicit_single mode
    When the tex2max output for latex "\\neg (x=0)" in variableMode "explicit_single" is evaluated
    Then the tex2max result should not contain "n*o*t"

  # ── Mixed-fraction fix (#29) ───────────────────────────────────────────────

  @javascript
  Scenario: Mixed fraction 2+1/2 is grouped correctly
    When the tex2max output for latex "2\\frac{1}{2}" in variableMode "stack" is evaluated
    Then the tex2max result should be "(2+1/2)"

  @javascript
  Scenario: Multi-digit mixed fraction 21+3/4 is grouped correctly
    When the tex2max output for latex "21\\frac{3}{4}" in variableMode "stack" is evaluated
    Then the tex2max result should be "(21+3/4)"

  @javascript
  Scenario: Regular fraction is not affected by mixed-fraction fix
    When the tex2max output for latex "\\frac{1}{2}" in variableMode "stack" is evaluated
    Then the tex2max result should be "(1)/(2)"

  # ── Pi notation (#31) ─────────────────────────────────────────────────────

  @javascript
  Scenario: Pi is rendered as plain "pi" by default (usePercentPi off)
    Given the plugin usepercentpi setting is "0"
    When the tex2max output for latex "\\pi" in variableMode "stack" is evaluated
    Then the tex2max result should be "pi"

  @javascript
  Scenario: Pi is rendered as "%pi" when usePercentPi is enabled
    Given the plugin usepercentpi setting is "1"
    When the tex2max output for latex "\\pi" in variableMode "stack" is evaluated
    Then the tex2max result should be "%pi"

  # ── Plus-minus expansion (Issue #30) ──────────────────────────────────────

  @javascript
  Scenario: Prefix pm produces two variants with unary plus stripped
    When the tex2max output for latex "x=\\pm 2" in variableMode "stack" is evaluated
    Then the tex2max result should contain "or"
    And  the tex2max result should contain "x=2"
    And  the tex2max result should contain "x=-2"
    And  the tex2max result should not contain "x=+2"

  @javascript
  Scenario: Infix pm retains both plus and minus signs
    When the tex2max output for latex "a\\pm b" in variableMode "stack" is evaluated
    Then the tex2max result should contain "a+b or a-b"

  # ── Set-theory keywords ────────────────────────────────────────────────────

  @javascript
  Scenario: Set-theory notin converts to Maxima keyword
    When the tex2max output for latex "x\\notin A" in variableMode "stack" is evaluated
    Then the tex2max result should contain "notin"

  @javascript
  Scenario: Set-theory union converts to Maxima keyword
    When the tex2max output for latex "A\\cup B" in variableMode "stack" is evaluated
    Then the tex2max result should contain "union"

  # ── Logic keywords ────────────────────────────────────────────────────────

  @javascript
  Scenario: Logic "and" from \\land converts correctly
    When the tex2max output for latex "p\\land q" in variableMode "stack" is evaluated
    Then the tex2max result should contain "and"

  @javascript
  Scenario: Logic "implies" from \\Rightarrow converts correctly
    When the tex2max output for latex "p\\Rightarrow q" in variableMode "stack" is evaluated
    Then the tex2max result should contain "implies"

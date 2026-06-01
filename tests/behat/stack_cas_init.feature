@local @local_stackmatheditor @stack_init
Feature: STACK CAS is configured and operational
  As a CI diagnostic check
  I want to verify that STACK CAS is correctly initialised
  So that failures in other tests can be attributed to the right cause

  # This feature is purely diagnostic – it reads and validates the STACK
  # configuration that was set up by moodle-plugin-ci install + add-config.
  # It never sets values; it only asserts expected states.
  #
  # Correct execution order matters:
  #   1. Clear the CAS result cache  (stale results removed)
  #   2. Rebuild the Maxima image    (fresh frozen image created)
  #   3. Verify the CAS connection   (smoke test)
  #
  # If this scenario fails, all STACK-dependent tests will fail too.
  # The error messages here pinpoint whether the problem is:
  #   - platform not linux-optimised  → QTYPE_STACK_TEST_CONFIG_PLATFORM missing
  #   - CAS not connected             → maxima_opt_auto not found / wrong path
  #   - version mismatch              → Maxima version changed

  Background:
    Given I log in as "admin"

  @javascript
  Scenario: STACK settings show linux-optimised platform
    When I navigate to the STACK settings page
    Then the STACK "platform" setting should contain "linux-optimised"
    And the STACK "maximacommand" setting should not be empty

  @javascript
  Scenario: STACK CAS cache cleared and Maxima image rebuilt successfully
    When I navigate to the STACK healthcheck page
    And I clear the STACK CAS cache
    And I rebuild the STACK Maxima image
    Then I should see the STACK healthcheck success indicators

  @javascript
  Scenario: STACK CAS connection is functional after init
    When I navigate to the STACK healthcheck page
    Then the STACK CAS connection should be reported as working
    And the STACK platform should be reported as "linux-optimised"
    And the STACK Maxima library version should be valid

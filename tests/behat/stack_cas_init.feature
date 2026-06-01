@local @local_stackmatheditor @stack_init
Feature: STACK CAS is configured and operational
  As a CI diagnostic check
  I want to verify that STACK CAS is correctly initialised
  So that failures in other tests can be attributed to the right cause

  # Execution order matters:
  #   1. Verify platform is linux-optimised  (runtime constant check)
  #   2. Clear cache, then rebuild image     (cache before image, not vice versa)
  #   3. Verify CAS connection works
  #
  # Note: the admin settings form shows database values, not PHP constants.
  # install.php sets maximacommand='' (empty) in the DB by design; the constant
  # QTYPE_STACK_TEST_CONFIG_MAXIMACOMMAND overrides this at runtime only.
  # The healthcheck page reflects the actual runtime configuration.

  Background:
    Given I log in as "admin"

  @javascript
  Scenario: STACK is running with linux-optimised platform at runtime
    When I navigate to the STACK healthcheck page
    Then the STACK platform should be reported as "linux-optimised"

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
    And the STACK Maxima library version should be valid

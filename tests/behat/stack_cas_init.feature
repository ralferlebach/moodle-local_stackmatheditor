@local @local_stackmatheditor @stack_init
Feature: STACK CAS is configured and operational
  As a CI diagnostic check
  I want to verify that STACK CAS is correctly initialised
  So that failures in other tests can be attributed to the right cause

  # Scenario order matters:
  #   1. Clear cache   (remove stale entries before rebuilding)
  #   2. Rebuild image (creates linux-optimised if not yet done)
  #   3. Baseline CAS  (verify the CAS connection actually works)
  #   4. linux-optimised (only meaningful AFTER image creation in step 2)
  #
  # stack-behat-init.php (run from CI before Behat) already tries Phase A + B.
  # These scenarios verify the result and repair it when possible.

  Background:
    Given I log in as "admin"

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

  @javascript
  Scenario: STACK is running with linux-optimised platform after image creation
    When I navigate to the STACK healthcheck page
    Then the STACK platform should be reported as "linux-optimised"

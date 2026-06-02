@local @local_stackmatheditor @stack_init
Feature: STACK CAS is configured and operational
  As a CI diagnostic check
  I want to verify that STACK CAS is correctly initialised
  So that failures in other tests can be attributed to the right cause

  # These scenarios are independent diagnostic checks.
  # stack-behat-init.php (run by CI before Behat) establishes a working CAS
  # state: linux-optimised if the frozen image could be created, otherwise linux.
  # Scenarios must not assume a specific platform: only that CAS works.

  Background:
    Given I log in as "admin"

  @javascript
  Scenario: STACK CAS connection is functional
    When I navigate to the STACK healthcheck page
    Then the STACK CAS connection should be reported as working
    And the STACK Maxima library version should be valid

  @javascript
  Scenario: STACK CAS cache can be cleared and Maxima image rebuilt
    When I navigate to the STACK healthcheck page
    And I clear the STACK CAS cache
    And I rebuild the STACK Maxima image
    Then I should see the STACK healthcheck success indicators
    And the STACK CAS connection should be reported as working

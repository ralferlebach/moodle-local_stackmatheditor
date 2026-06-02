@local @local_stackmatheditor @stack_init
Feature: STACK CAS is configured and operational
  As a CI diagnostic check
  I want to verify that STACK CAS is correctly initialised
  So that failures in other tests can be attributed to the right cause

  # These scenarios are INDEPENDENT diagnostic checks, not a setup sequence.
  # stack-behat-init.php (run by CI before Behat) establishes the linux-optimised
  # state.  Each scenario verifies one aspect of that state in isolation.
  #
  # Behat resets DB/dataroot state between scenarios; never rely on a previous
  # scenario having prepared state for the next one.

  Background:
    Given I log in as "admin"

  @javascript
  Scenario: STACK CAS connection is functional
    When I navigate to the STACK healthcheck page
    Then the STACK CAS connection should be reported as working
    And the STACK Maxima library version should be valid

  @javascript
  Scenario: STACK optimised Maxima image is present and executable
    When I navigate to the STACK healthcheck page
    Then the STACK platform should be reported as "linux-optimised"
    And the STACK optimised Maxima image should be executable

  @javascript
  Scenario: STACK CAS cache can be cleared and Maxima image rebuilt
    When I navigate to the STACK healthcheck page
    And I clear the STACK CAS cache
    And I rebuild the STACK Maxima image
    Then I should see the STACK healthcheck success indicators
    And the STACK CAS connection should be reported as working

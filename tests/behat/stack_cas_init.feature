@local @local_stackmatheditor @stack_init
Feature: STACK CAS is configured and operational
  As a CI diagnostic check
  I want to verify that STACK CAS is correctly initialised
  So that failures in other tests can be attributed to the right cause

  # Preflight gate: must pass before the main plugin Behat suite starts.
  # Uses platform=linux (Strategie C): stable, no frozen image required.
  # The first CAS call cold-starts Maxima (~60-90 s, within castimeout=300);
  # subsequent calls use the DB result cache and are instant.

  Background:
    Given I log in as "admin"
    And the STACK CAS platform is reset to direct Maxima

  @javascript
  Scenario: STACK CAS connection is functional
    When I navigate to the STACK healthcheck page
    Then the STACK CAS connection should be reported as working
    And the STACK Maxima library version should be valid

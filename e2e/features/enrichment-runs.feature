Feature: Enrichment runs
  An administrator re-enriches the whole catalog, which spends provider quota, so starting a run takes two steps
  and only an administrator reaches it.

  Scenario: A visitor who opens enrichment runs is sent to sign in
    Given I am a visitor
    When I open enrichment runs
    Then I am sent to sign in

  Scenario: A signed-in member is turned away from enrichment runs
    Given I am signed in
    When I open enrichment runs
    Then I am back on the home page
    And I am offered no way to start a run

  Scenario: An administrator the catalog service does not recognise is told so
    Given I am signed in as an administrator the catalog service does not recognise
    When I open enrichment runs
    Then I am told the runs could not be loaded
    And I am not told that no run has been started

  Scenario: Backing out of the confirmation starts nothing
    Given I am signed in as an administrator
    When I start a run and back out of the confirmation
    Then I am offered to start a run again
    And no run was started, even after a reload

  Scenario: Confirming starts one run and follows it to success
    Given I am signed in as an administrator
    When I start a run and confirm it
    Then I see the run succeeded
    And exactly one run was started and followed while it ran

  Scenario: A run that fails is followed to its failure
    Given I am signed in as an administrator
    And the next run will fail
    When I start a run and confirm it
    Then I see the run failed, with its error
    And the run was followed while it ran

  Scenario: A cancelled run explains what it left behind
    Given I am signed in as an administrator
    And the latest enrichment run was cancelled
    When I open enrichment runs
    Then I see that run was cancelled, and what it left behind

  Scenario: A failed run shows the error the catalog service recorded
    Given I am signed in as an administrator
    And the latest enrichment run failed
    When I open enrichment runs
    Then I see that run failed, with its error

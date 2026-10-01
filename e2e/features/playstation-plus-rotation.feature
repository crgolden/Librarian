Feature: The PlayStation Plus rotation
  An owner sees which Game Catalog titles they have not claimed and which are leaving.

  Scenario: A visitor who opens the rotation is sent to sign in
    Given I am a visitor
    When I open the PlayStation Plus rotation
    Then I am sent to sign in

  Scenario: An unlinked owner is asked to link an account rather than shown an error
    Given I am signed in
    When I open the PlayStation Plus rotation
    Then I am asked to link a PlayStation account
    And I am shown no error

  Scenario: The rotation lists what is unclaimed and what is leaving, linking each where it can be reached
    Given I am signed in
    And my PlayStation account is linked
    And the rotation has an unclaimed title in the Store and a leaving title in the catalog
    When I open the PlayStation Plus rotation
    Then I see when the Game Catalog was last walked and its size per tier
    And the unclaimed title links to the Store
    And the leaving title links to its catalog page
    And I am told nothing was added

  Scenario: An unwalked catalog is reported as not walked yet, not as four empty lists
    Given I am signed in
    And my PlayStation account is linked
    When I open the PlayStation Plus rotation
    Then I am told the Game Catalog has not been walked yet

  Scenario: A catalogued title in the rotation opens its catalog page
    Given I am signed in
    And my PlayStation account is linked
    And the rotation has an unclaimed title in the catalog
    When I open that title from the rotation
    Then I see that game's page

  Scenario: The library summarises the rotation when my schedule watches it
    Given I am signed in
    And my PlayStation account is linked
    And my refresh schedule watches the rotation
    And the rotation has an unclaimed title in the Store and a leaving title in the catalog
    When I open my library
    Then I see how many titles are unclaimed and how many are leaving
    And the summary links to the rotation

  Scenario: The library's rotation summary opens the rotation
    Given I am signed in
    And my PlayStation account is linked
    And my refresh schedule watches the rotation
    And the rotation has an unclaimed title in the Store and a leaving title in the catalog
    When I follow the rotation summary from my library
    Then I see the rotation's unclaimed list

  Scenario: The library stays silent about the rotation when my schedule does not watch it
    Given I am signed in
    And my PlayStation account is linked
    And my refresh schedule does not watch the rotation
    And the rotation has an unclaimed title in the Store and a leaving title in the catalog
    When I open my library
    Then I see no rotation summary

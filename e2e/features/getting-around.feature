Feature: Getting around
  The side rail on a wide screen and the tab bar and More sheet on a phone take the reader to every page
  they can use.

  Scenario: Consoles and storage is reachable from the side rail
    Given I am signed in
    And I am on a wide screen
    When I choose consoles and storage from the side rail
    Then I am on my consoles and storage

  Scenario: My profile is reachable from the side rail
    Given I am signed in
    And I am on a wide screen
    When I choose my profile from the side rail
    Then I am on my own profile

  Scenario: The catalog is reachable from the tab bar on a phone
    Given I am signed in
    And I am on a phone
    When I choose the catalog from the tab bar
    Then I am on the catalog

  Scenario: The More sheet closes when one of its links takes me somewhere
    Given I am signed in
    And I am on a phone
    When I choose my profile from the More sheet
    Then I am on my own profile
    And the More sheet is closed

  Scenario: A visitor reaches the catalog from the side rail without an account
    Given I am a visitor
    And I am on a wide screen
    When I choose the catalog from the side rail
    Then I am on the catalog
    And I am invited to sign in from the navigation

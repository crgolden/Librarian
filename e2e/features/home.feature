Feature: The home page
  The home page invites a visitor to sign in, and shows a signed-in owner how much they have catalogued.

  Scenario: A visitor is invited to sign in
    Given I am a visitor
    When I open the home page
    Then I am invited to sign in
    And I am offered no owner actions

  Scenario: A signed-in owner is offered their PlayStation settings
    Given I am signed in
    When I open the home page
    Then I am offered my account settings first

  Scenario: A linked owner sees what they have catalogued
    Given I am signed in
    And my PlayStation account is linked
    And I have games in my library and saved collections
    When I open the home page
    Then I see my library and collection totals
    And I am not told my account is unlinked

  Scenario: An unlinked owner is told nothing has been catalogued yet
    Given I am signed in
    When I open the home page
    Then I am told my account is unlinked

  Scenario: Linking my account clears the unlinked notice without a reload
    Given I am signed in
    And I am told on the home page that my account is unlinked
    When I link my PlayStation account and return home
    Then I see my library totals
    And I am not told my account is unlinked

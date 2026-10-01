Feature: Returning to the catalog
  Going back from a game to the catalog puts the reader where they were, not at the top.

  Background:
    Given I am a visitor
    And the catalog holds a full page of games
    And I have scrolled down the catalog on a short screen

  Scenario: Going back to the catalog keeps my place
    When I open a game from the catalog and go back
    Then I am where I was in the catalog

  Scenario: Going back after the game opened as a new page keeps my place
    When I open a game from the catalog as a new page and go back
    Then I am where I was in the catalog

Feature: Server-rendered pages
  A page the server rendered becomes interactive without fetching its data a second time, while moving on
  to another page still fetches that page's data.

  Background:
    Given I am a visitor
    And the catalog holds a game

  Scenario: A server-rendered page does not fetch its data again
    When I open the catalog and the page becomes interactive
    Then the page is complete without asking the server for its data again

  Scenario: Moving to another page fetches that page's data
    Given I have opened the catalog and the page has become interactive
    When I open that game from the catalog
    Then the page has asked the server for that game

Feature: Sharing a collection
  An owner can share a collection by link; anyone with the link can see it, and a signed-in user can follow it.

  Background:
    Given I am signed in
    And the catalog holds a game in a genre I choose
    And I have saved a collection of that genre and shared it by link

  Scenario: A visitor with the link sees the collection without an account
    When a visitor opens the share link
    Then the visitor sees my collection and its games
    And the visitor is invited to sign in rather than to follow it

  Scenario: A signed-in user can follow a shared collection
    When another signed-in user opens the share link and follows the collection
    Then the collection is among the collections they follow

  Scenario: A follower can stop following a shared collection
    Given another signed-in user follows my shared collection
    When they stop following it from their collections
    Then they follow no collections

  Scenario: Making a shared collection private breaks its old link
    When I make the collection private
    Then I am no longer offered a share link
    And a visitor opening the old share link is told it was not found

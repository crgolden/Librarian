Feature: Reading about Librarian
  A visitor can read how Librarian works and what it keeps about them, without an account.

  Background:
    Given I am a visitor

  Scenario: A visitor reads the FAQ and moves on to the privacy policy
    When I read the FAQ
    And I follow its link to the privacy policy
    Then I am reading the privacy policy

  Scenario: The FAQ contents take me to a question
    Given I have the FAQ open
    When I jump to a question from the contents
    Then that question is on screen

  Scenario: Back to top returns me to the start of the FAQ
    Given I have jumped to a question in the FAQ
    When I go back to the top
    Then the page heading is on screen

  Scenario: A visitor reads the privacy policy and moves on to the FAQ
    When I read the privacy policy
    And I follow its link to the FAQ
    Then I am reading the FAQ

Feature: Consoles and storage
  An owner records their consoles and storage drives, and which drive is attached to which console.

  Scenario: A visitor who opens consoles and storage is sent to sign in
    Given I am a visitor
    When I open my consoles and storage
    Then I am sent to sign in

  Scenario: An owner with nothing recorded is shown empty lists
    Given I am signed in
    When I open my consoles and storage
    Then I am told I have no consoles and no storage drives

  Scenario: Adding a console records it with a default capacity
    Given I am signed in
    When I add a PlayStation 5 console
    Then I see that console
    And I am told it was given a default capacity

  Scenario: A console can be added on an older PlayStation
    Given I am signed in
    When I add a console on an older PlayStation
    Then I see that console on that PlayStation

  Scenario: A stale PlayStation device link is reported in words, with the page that manages it
    Given I am signed in
    And I have a console whose PlayStation device link is deactivated
    When I open my consoles and storage
    Then I am told the console's device link is deactivated
    And I am offered my account page to manage it

  Scenario: A console with no device link says nothing about one
    Given I am signed in
    And I have a console with no device link
    When I open my consoles and storage
    Then I see that console
    And I am told nothing about a device link

  Scenario: A storage drive can be attached to a console
    Given I am signed in
    And I have added a PlayStation 5 console
    When I add a storage drive and attach it to that console
    Then the drive is attached to that console

  Scenario: A storage drive can be detached from its console
    Given I am signed in
    And I have added a PlayStation 5 console
    And I have added a storage drive attached to that console
    When I detach the drive
    Then the drive is attached to no console

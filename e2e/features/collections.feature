Feature: Collections
  An owner builds collections of games, by filter or by filling a console's capacity, and manages them.

  Scenario: A visitor who opens collections is sent to sign in
    Given I am a visitor
    When I open my collections
    Then I am sent to sign in

  Scenario: An owner with no collections is told so and offered to create one
    Given I am signed in
    When I open my collections
    Then I am told I have no collections
    And I am offered to create one

  Scenario: A filtered collection is previewed, saved and listed
    Given I am signed in
    And the catalog holds a game in a genre I choose
    When I preview a collection of that genre and save it
    Then my collections list that one collection

  Scenario: A preview says where each included title's size came from
    Given I am signed in
    And the catalog holds games whose sizes were measured, estimated and never measured
    When I preview a new collection
    Then each included title says where its size came from, in words that tell them apart
    And I am told how many sizes were never measured

  Scenario: A capacity fill with no console is refused before anything is previewed
    Given I am signed in
    When I preview a capacity fill without choosing a console
    Then I am told to choose a console
    And no preview was requested

  Scenario: A title in a capacity fill can be marked installed
    Given I am signed in
    And I have saved a capacity fill for one of my consoles and opened it
    When I mark its title installed
    Then the title is marked installed

  Scenario: Marking a title installed after its console is gone shows an inline error
    Given I am signed in
    And I have saved a capacity fill for one of my consoles and opened it
    And that console is no longer mine
    When I mark its title installed
    Then I am told the title could not be marked installed
    And the title is not marked installed

  Scenario: A collection can be renamed
    Given I am signed in
    And the catalog holds a game in a genre I choose
    And I have saved a collection of that genre and opened it
    When I rename the collection
    Then the new name is stored and the collection is shown under it

  Scenario: Making a collection unlisted offers its share link
    Given I am signed in
    And the catalog holds a game in a genre I choose
    And I have saved a collection of that genre and opened it
    When I make the collection unlisted
    Then I am offered its share link

  Scenario: A collection can be deleted
    Given I am signed in
    And the catalog holds a game in a genre I choose
    And I have saved a collection of that genre and opened it
    When I delete the collection
    Then I am told I have no collections

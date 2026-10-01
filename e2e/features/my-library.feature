Feature: My library
  An owner sees every game they own with its ratings, refreshes it from PlayStation, narrows and orders it,
  hides what they do not want to see, and adds games PlayStation did not report.

  Scenario: A visitor who opens the library is sent to sign in
    Given I am a visitor
    When I open my library
    Then I am sent to sign in

  Scenario: An owner with an empty library is told so
    Given I am signed in
    When I open my library
    Then I am told my library is empty

  Scenario: Refreshing the library reports success
    Given I am signed in
    When I refresh my library
    Then I am told the library was catalogued

  Scenario: A failed refresh reports its error
    Given I am signed in
    And the next library refresh will fail
    When I refresh my library
    Then I am told the refresh failed

  Scenario: A refresh summarises what it enriched, capping the list of titles
    Given I am signed in
    And the next library refresh will enrich more titles than the summary lists
    When I refresh my library
    Then the summary lists as many titles as it shows and counts the rest
    And I am told the OpenCritic top-up is incomplete

  Scenario: A RAWG-enriched library links to RAWG, as RAWG's terms require
    Given I am signed in
    And my library holds a game RAWG enriched
    When I open my library
    Then the page links to RAWG, as RAWG's terms require

  Scenario: A library nothing RAWG enriched claims no RAWG data
    Given I am signed in
    And my library holds a game only OpenCritic enriched
    When I open my library
    Then I see that game in my library
    And the page claims no RAWG data

  Scenario: Each game shows its ratings, genre and catalog link, with a dash where nothing is known
    Given I am signed in
    And my library holds a fully rated game and one nothing matched
    When I open my library
    Then the rated game shows its genre, each rating and its catalog link
    And the unmatched game shows a dash for each rating and still links to the catalog

  Scenario: Each game shows every platform it is owned on
    Given I am signed in
    And my library holds a game owned on several platforms and one on none
    When I open my library
    Then the first game shows each of its platforms
    And the other shows no platform

  Scenario: Each game shows its trophy completion, with a dash when no trophy list matched
    Given I am signed in
    And my library holds a partly completed game, an untouched one and one with no trophy match
    When I open my library
    Then each game shows its completion, and the unmatched one a dash

  Scenario: Searching by title narrows the library
    Given I am signed in
    And my library holds a game with a title I search for and one without
    When I search my library for that title
    Then only that game is listed

  Scenario: Filtering by genre narrows the library
    Given I am signed in
    And my library holds a game in a genre I choose and one outside it
    When I filter my library by that genre
    Then only that game is listed

  Scenario: The library lists titles in order
    Given I am signed in
    And my library holds two games whose titles sort in a known order
    When I open my library
    Then they are listed in title order

  Scenario: Sorting by title reverses the order
    Given I am signed in
    And my library holds two games whose titles sort in a known order
    And I am looking at my library in title order
    When I sort by title
    Then they are listed in reverse title order

  Scenario: Sorting by title again restores the order
    Given I am signed in
    And my library holds two games whose titles sort in a known order
    And I have sorted my library by title
    When I sort by title again
    Then they are listed in title order

  Scenario: The first library page can only go forward
    Given I am signed in
    And my library holds more games than fit on one page
    When I open my library
    Then I see a full first page and can only go forward

  Scenario: The next library page shows the rest
    Given I am signed in
    And my library holds more games than fit on one page
    And I am on the first library page
    When I go to the next library page
    Then I see the rest and can only go back

  Scenario: Going back returns to the full first page
    Given I am signed in
    And my library holds more games than fit on one page
    And I am on the second library page
    When I go to the previous library page
    Then I see a full first page and can only go forward

  Scenario: Choosing how many per page resizes the library
    Given I am signed in
    And my library holds enough games to fill either page size
    When I open my library and choose another page size
    Then the library shows that many games

  Scenario: A chosen library page size survives a reload
    Given I am signed in
    And my library holds enough games to fill either page size
    And I have chosen another library page size
    When I reload my library
    Then the library still shows that many games

  Scenario: Resizing the library returns to its first page
    Given I am signed in
    And my library holds enough games to fill either page size
    And I have moved to the next page of my library
    When I choose another library page size
    Then I am back on the first library page, showing that many games

  Scenario: Searching and sorting together order the matches
    Given I am signed in
    And my library holds more games sharing a word than fit on one page, and others
    When I search for that word and sort by title in reverse
    Then the first page holds the matches from the end of the title order

  Scenario: Paging keeps the search and the sort
    Given I am signed in
    And my library holds more games sharing a word than fit on one page, and others
    And I have searched for that word, sorted by title in reverse
    When I go to the next library page
    Then the next page holds the rest of the matches and I cannot go further

  Scenario: A new search returns to the first page
    Given I am signed in
    And my library holds more games sharing a word than fit on one page, and others
    And I have searched for that word, sorted by title in reverse
    And I have gone on to the next page of those matches
    When I search for one of the matches by its whole title
    Then only that game is listed, on the first page

  Scenario: Hiding a game takes it out of my library
    Given I am signed in
    And my library holds two games
    When I hide one of them
    Then only the other is listed
    And I am offered the one hidden game

  Scenario: A hidden game is shown in the hidden view, without a hide control
    Given I am signed in
    And my library holds two games
    And I have hidden one of them
    When I show my hidden games
    Then only the hidden game is listed, and it offers no hide control

  Scenario: Showing a hidden game again brings it back
    Given I am signed in
    And my library holds two games
    And I have hidden one of them and opened my hidden games
    When I show that game again
    Then I am told nothing is hidden

  Scenario: A hidden game stays hidden after a reload
    Given I am signed in
    And my library holds a game I have hidden
    When I open my library
    Then that game is not listed
    And I am offered the one hidden game

  Scenario: Another user's library offers no hide control
    Given I am signed in
    And my library is public and holds a game
    When another signed-in user opens my library
    Then they see that game
    And they are offered no way to hide it or see what I hid

  Scenario: The library offers the trophy setting when nothing harvests trophies
    Given I am signed in
    And my library holds a game
    When I open my library
    Then the completion column offers the account's trophy setting

  Scenario: The trophy setting link goes once trophies are harvested and matched
    Given I am signed in
    And my PlayStation account is linked and harvests trophies
    And my library holds a game with a matched trophy list
    When I open my library
    Then the game shows its completion
    And the completion column offers no trophy setting

  Scenario: The library reads the next scheduled refresh, not the last one
    Given I am signed in
    And my refresh schedule runs daily and has run before
    When I open my library
    Then I see when the next refresh runs
    And I am offered my account page to change the schedule

  Scenario: A paused schedule is reported as paused, not as a due date
    Given I am signed in
    And my refresh schedule is paused
    When I open my library
    Then I am told the schedule is paused, and why
    And I am offered my account page to change the schedule

  Scenario: An owner with no schedule is invited to set one up
    Given I am signed in
    When I open my library
    Then I am invited to set up a refresh schedule
    And I am offered my account page to change the schedule

  Scenario: A catalog miss proposes a Store match, and accepting it adds the game
    Given I am signed in
    And my PlayStation account is linked
    And the Store holds games the catalog does not
    When I search to add one of those games and accept the Store's first proposal
    Then that game is in my library, marked as added by hand

  Scenario: Adding by hand offers only the games I do not already own
    Given I am signed in
    And the catalog holds two games sharing a word, one of which I own
    When I search to add a game by that word
    Then I am offered only the one I do not own

  Scenario: Adding by hand says every match is owned instead of searching the Store
    Given I am signed in
    And my PlayStation account is linked
    And the catalog holds a game I already own
    When I search to add a game by its title
    Then I am told I already own every match
    And I am offered to check the Store instead

  Scenario: Declining the Store's proposal adds nothing
    Given I am signed in
    And my PlayStation account is linked
    And the Store holds games the catalog does not
    When I search to add one of those games and decline the Store's proposal
    Then my library is still empty

  Scenario: Adding by hand says the Store cannot be checked without a linked account
    Given I am signed in
    And the Store holds games the catalog does not
    When I search to add one of those games
    Then I am told the Store cannot be checked without a linked account

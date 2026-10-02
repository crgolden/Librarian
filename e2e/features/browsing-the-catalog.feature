Feature: Browsing the catalog
  Anyone can browse the shared catalog of games, filter and sort it, and open a game's own page.

  Rule: A visitor needs no account

    Background:
      Given I am a visitor

    Scenario: A visitor browses the catalog without signing in
      Given the catalog holds a game
      When I open the catalog
      Then I see that game in the catalog
      And I am not sent to sign in

    Scenario: Each rating is shown, and a missing score reads as a dash
      Given the catalog holds a game with a RAWG and an OpenCritic score but no PlayStation rating
      When I open the catalog
      Then I see its RAWG and OpenCritic scores
      And its PlayStation rating reads as a dash

    Scenario: The catalog links to RAWG when it shows a RAWG score
      Given the catalog holds a game with a RAWG score
      When I open the catalog
      Then the page links to RAWG, as RAWG's terms require

    Scenario: A game's page links to RAWG when it shows a RAWG score
      Given the catalog holds a game with a RAWG score
      When I open that game's page
      Then the page links to RAWG, as RAWG's terms require

    Scenario: The catalog claims no RAWG data when it shows no RAWG score
      Given the catalog holds a game with only an OpenCritic score
      When I open the catalog
      Then I see its OpenCritic score
      And the page claims no RAWG data

    Scenario: A game's page claims no RAWG data when the game has no RAWG score
      Given the catalog holds a game with only an OpenCritic score
      When I open that game's page
      Then I see that game's ratings
      And the page claims no RAWG data

    Scenario: A catalog title opens that game's page
      Given the catalog holds a game
      When I open that game from the catalog list
      Then I see that game's page

    Scenario: An unknown game shows a not-found page rather than an error
      When I open a game that is not in the catalog
      Then I am told the game was not found

  Rule: A signed-in owner narrows and orders what they see

    Background:
      Given I am signed in

    Scenario: A signed-in owner browses the catalog
      Given the catalog holds a game
      When I open the catalog
      Then I see that game in the catalog

    Scenario: Filtering by genre narrows the results
      Given the catalog holds a game in a genre I choose and one outside it
      When I filter the catalog by that genre
      Then only the game in that genre is listed

    Scenario: A raw PlayStation genre filters on the whole token
      Given the catalog holds a game whose genre is a raw PlayStation token and one outside it
      When I filter the catalog by that genre
      Then only the game in that genre is listed

    Scenario: The catalog lists games, not media apps
      Given the catalog holds a game and a media app
      When I open the catalog
      Then only the game is listed

    Scenario: Asking for media apps lists only them
      Given the catalog holds a game and a media app
      And I am browsing the catalog, which lists only the game
      When I ask for media apps
      Then only the media app is listed, labelled as not a game

    Scenario: A kind chosen before the page is interactive still applies
      Given the catalog holds a game and a media app
      And the catalog has rendered but the app's scripts have not loaded yet
      When I ask for media apps before the page is interactive
      Then only the media app is listed, labelled as not a game

    Scenario: A sort chosen before the page is interactive still applies
      Given the catalog holds a cheap game and a dear one
      And the catalog has rendered but the app's scripts have not loaded yet
      When I sort the catalog by price, dearest first, before the page is interactive
      Then the dear game is listed first

    Scenario: Filters entered before the page is interactive are still there to apply
      Given the catalog holds a game I can name by title and genre, and one that matches neither
      And the catalog has rendered but the app's scripts have not loaded yet
      When I enter its title and genre before the page is interactive, then apply them once it is
      Then only the game in that genre is listed

    Scenario: Sorting by price orders the page by what the store charges
      Given the catalog holds a cheap game and a dear one
      When I sort the catalog by price, dearest first
      Then the dear game is listed first

    Scenario: A game's page states its price and the public collections holding it
      Given the catalog holds a game free with a subscription, in one public and one private collection
      When I open that game's page
      Then I see it is free with a subscription
      And I see only the public collection holding it

    Scenario: A game no public collection holds shows no collections section
      Given the catalog holds a game
      When I open that game's page
      Then I see no collections section and no price

    Scenario: The first catalog page can only go forward
      Given the catalog holds more games than fit on one page
      When I open the catalog
      Then I can go to the next page but not the previous one

    Scenario: The next catalog page can go back
      Given the catalog holds more games than fit on one page
      And I am on the first catalog page
      When I go to the next page
      Then I can go back to the previous page

    Scenario: Choosing how many per page resizes the page
      Given the catalog holds enough games to fill either page size
      When I open the catalog and choose another page size
      Then the page shows that many games

    Scenario: A chosen catalog page size survives a reload
      Given the catalog holds enough games to fill either page size
      And I have chosen another catalog page size
      When I reload the catalog
      Then the page still shows that many games

    Scenario: Resizing the page returns to the first page
      Given the catalog holds enough games to fill either page size
      And I have moved to the next page of the catalog
      When I choose another page size
      Then I am back on the first page, showing that many games

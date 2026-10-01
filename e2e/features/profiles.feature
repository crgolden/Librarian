Feature: Profiles
  Every owner has a profile. What another user sees on it is what the owner chose to make public, and a
  PlayStation account id is never shown to anyone.

  Scenario: A visitor who opens a profile is sent to sign in
    Given I am a visitor
    When I open my profile
    Then I am sent to sign in

  Scenario: An owner sees their own profile with their library and collections, and no way to follow themselves
    Given I am signed in
    And my PlayStation account is linked under an account id
    When I open my profile
    Then my profile says I have a PlayStation account without showing its id
    And I am offered my library and my collections
    And I am offered no way to follow myself

  Scenario: An owner with no PlayStation account sees a profile that says so
    Given I am signed in
    When I open my profile
    Then my profile says I have no PlayStation account

  Scenario: Another user sees only my follower count on a private profile
    Given I am signed in
    And my PlayStation account is linked under an account id
    When another signed-in user opens my profile
    Then they see my follower count and nothing I have not made public

  Scenario: Another user sees every section of a fully public profile, but never my account id
    Given I am signed in
    And my profile is fully public, with my online id, trophies and library
    When another signed-in user with a linked account opens my profile
    Then they see my online id, trophies, library, collections and membership
    And my account id appears nowhere on the page

  Scenario: A viewer with no linked account sees no trophies, and no error
    Given I am signed in
    And my profile publicly shows my trophies
    When another signed-in user opens my profile
    Then they see I have a PlayStation account, without its id
    And they see no trophies and no error

  Scenario: Asking to send a friend request asks for confirmation first
    Given I am signed in
    And my profile discloses my online id
    And another signed-in user has allowed friend requests to be sent from their account
    When they ask to add me as a PlayStation friend
    Then they are asked to confirm, and nothing is sent yet

  Scenario: Confirming sends the friend request
    Given I am signed in
    And my profile discloses my online id
    And another signed-in user has allowed friend requests to be sent from their account
    And they have asked to add me as a PlayStation friend
    When they confirm
    Then they are told the request was sent

  Scenario: No friend request is offered to a viewer who never allowed them
    Given I am signed in
    And my profile discloses my online id
    And another signed-in user has not allowed friend requests to be sent from their account
    When they open my profile
    Then they see my online id
    And they are offered no friend request

  Scenario: No friend request is offered where the online id was never disclosed
    Given I am signed in
    And my profile is public without my online id
    And another signed-in user has allowed friend requests to be sent from their account
    When they open my profile
    Then they see I have a PlayStation account, without its id
    And they are offered no friend request

  Scenario: No friend request is offered on your own profile
    Given I am signed in
    And my PlayStation account is linked and allows friend requests
    When I open my profile
    Then my profile says I have a PlayStation account
    And I am offered no friend request

  Scenario: Following a user counts me among their followers
    Given I am signed in
    When another signed-in user follows me
    Then they are following me and I have one follower

  Scenario: Unfollowing a user takes me off their followers
    Given I am signed in
    And another signed-in user already follows me
    When they stop following me
    Then they are not following me and I have no followers

  Scenario: No follow control on your own profile
    Given I am signed in
    When I open my profile
    Then I am offered no way to follow myself

  Scenario: My followers page lists each follower and links to their profile
    Given I am signed in
    And another signed-in user already follows me
    When I open my followers and follow the first one
    Then I am on their profile

  Scenario: My following page lists who I follow
    Given I am signed in
    And I follow another signed-in user
    When I open who I follow
    Then I see one user I follow

  Scenario: My followers page says when I have no followers yet
    Given I am signed in
    When I open my followers
    Then I am told I have no followers yet

  Scenario: A profile setting survives a reload
    Given I am signed in
    When I make my profile public and reload the settings
    Then my profile is still public

  Scenario: Profile settings point to the account page for what PlayStation shares
    Given I am signed in
    When I open my profile settings
    Then I am offered my account page to change what PlayStation shares

  Scenario: A PlayStation profile handle is saved and links to that site
    Given I am signed in
    When I save a PlayStation profile handle and reload the settings
    Then the handle is kept and links to that site, marked as user content

  Scenario: Removing a PlayStation profile handle takes its link away
    Given I am signed in
    And I have saved a PlayStation profile handle
    When I remove the handle
    Then the settings offer no link and the handle is empty

  Scenario: A handle the service would refuse cannot be saved
    Given I am signed in
    When I type a handle with a space in it
    Then I cannot save it and I am told why

  Scenario: Correcting a refused handle lets it be saved
    Given I am signed in
    And I have typed a handle with a space in it
    When I type a handle without one
    Then I can save it

  Scenario: My saved PlayStation profile link shows on my own profile
    Given I am signed in
    And I have saved a PlayStation profile handle
    When I open my profile
    Then my profile links to that PlayStation profile

  Scenario: A private profile shows its PlayStation profile links to no one else
    Given I am signed in
    And I have saved a PlayStation profile handle
    When another signed-in user opens my profile
    Then they see no PlayStation profile links

  Scenario: A public profile shows its PlayStation profile links to others
    Given I am signed in
    And I have saved a PlayStation profile handle
    And my profile is public
    When another signed-in user opens my profile
    Then they see a link to my PlayStation profile

  Scenario: The account page points to profile settings for what the public profile shows
    Given I am signed in
    And my PlayStation account is linked and discloses my online id
    When I open my account
    Then I am told the public profile is set on the profile settings page
    And my identity card shows my online id

  Scenario: My own library and collections have owner controls; another user sees them read-only
    Given I am signed in
    And my library and collections are public and hold one game and one collection
    When I open my library and my collections, and another signed-in user opens them too
    Then I see my game and collection with owner controls
    And they see the same game and collection without owner controls

  Scenario: Another user opening a library I have not made public is told so
    Given I am signed in
    When another signed-in user opens my library
    Then they are told the library is not public, and shown no table

  Scenario Outline: A page addressed to myself by my own id opens my own page
    Given I am signed in
    When I open my <page> by my own id
    Then I am on my own <page>

    Examples:
      | page        |
      | profile     |
      | followers   |
      | following   |
      | library     |
      | collections |

  Scenario: Another user's profile opens in viewer mode
    Given I am signed in
    And another user has signed in
    When I open that user's profile
    Then I stay on their profile and am offered to follow them

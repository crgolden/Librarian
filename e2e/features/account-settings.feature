Feature: Account settings
  An owner links their PlayStation account, chooses what Librarian may read and write, schedules refreshes,
  keeps their own enrichment keys, reviews what was done on their behalf, and can delete their data.

  Scenario: A visitor who opens the account page is sent to sign in
    Given I am a visitor
    When I open my account
    Then I am sent to sign in

  Scenario: An old PlayStation settings bookmark opens the account page
    Given I am signed in
    When I open my old PlayStation settings bookmark
    Then I am on my account page

  Scenario: A visitor's old PlayStation settings bookmark is sent to sign in
    Given I am a visitor
    When I open my old PlayStation settings bookmark
    Then I am sent to sign in

  Scenario: An unlinked owner is offered the link form
    Given I am signed in
    When I open my account
    Then I am offered the PlayStation link form
    And I am not shown as linked

  Scenario: Enrichment keys and scheduling are offered without a linked account
    Given I am signed in
    When I open my account
    Then I am offered the PlayStation link form
    And I am offered enrichment keys and scheduling, but no data-sharing preferences

  Scenario: An owner with no schedule is told so
    Given I am signed in
    When I open my account
    Then I am told there is no refresh schedule yet

  Scenario: An owner with a schedule sees it
    Given I am signed in
    And my refresh schedule runs daily
    When I open my account
    Then I see my refresh schedule and can cancel it

  Scenario: Enrichment keys and scheduling stay after unlinking
    Given I am signed in
    And my PlayStation account is linked
    When I unlink my PlayStation account and reload
    Then I am offered the PlayStation link form
    And I am offered enrichment keys and scheduling, but no data-sharing preferences

  Scenario: A linked owner is shown as linked, with a way to unlink
    Given I am signed in
    And my PlayStation account is linked
    When I open my account
    Then I am shown as linked, with a way to unlink

  Scenario: Linking with a sign-in token shows the account as linked
    Given I am signed in
    When I link my PlayStation account with a sign-in token
    Then I am offered a way to unlink

  Scenario: A link without a refresh token is warned about
    Given I am signed in
    And my PlayStation account is linked without a refresh token
    When I open my account
    Then I am shown as linked, with a way to unlink
    And I am warned there is no refresh token

  Scenario: Unlinking offers the link form again
    Given I am signed in
    And my PlayStation account is linked
    When I unlink my PlayStation account
    Then I am offered the PlayStation link form

  Scenario: An empty account history is reported as empty
    Given I am signed in
    When I open my account history
    Then I am told there is no history yet

  Scenario: Linking and unlinking are recorded in the account history
    Given I am signed in
    And I have linked and then unlinked my PlayStation account
    When I open my account history
    Then it lists the link and the unlink, and the latest completed

  Scenario: The account history can be downloaded
    Given I am signed in
    And I have linked and then unlinked my PlayStation account
    When I open my account history and download it
    Then I receive the history file

  Scenario: Asking to delete my data asks for confirmation first
    Given I am signed in
    And my PlayStation account is linked
    When I ask to delete my data
    Then I am asked to confirm, and nothing is deleted yet

  Scenario: Confirming the deletion deletes my data
    Given I am signed in
    And my PlayStation account is linked
    And I have asked to delete my data
    When I confirm the deletion
    Then I am told my data was deleted

  Scenario: Backing out of deleting my data leaves the account as it was
    Given I am signed in
    And my PlayStation account is linked
    When I ask to delete my data and back out
    Then I am no longer asked to confirm
    And I am shown as linked, with a way to unlink

  Scenario: Every data-sharing preference starts off, and shows no data
    Given I am signed in
    And my PlayStation account is linked
    When I open my account
    Then every data-sharing preference is off
    And no shared data is shown

  Scenario: Turning trophies on shows the trophy summary
    Given I am signed in
    And my PlayStation account is linked and has a trophy summary
    When I turn trophy sharing on
    Then I see my trophy level and platinum count

  Scenario: Trophy sharing stays on after a reload
    Given I am signed in
    And my PlayStation account is linked and has a trophy summary
    And I have turned trophy sharing on
    When I reload my account
    Then trophy sharing is still on and the summary is shown

  Scenario: The two write permissions start off and are kept independently
    Given I am signed in
    And my PlayStation account is linked
    When I allow friend requests to be sent and reload my account
    Then friend requests are allowed and chat messages are not

  Scenario: Allowing a write shows no data, unlike a read preference
    Given I am signed in
    And my PlayStation account is linked
    When I allow chat messages to be sent
    Then chat messages are allowed
    And no shared data is shown

  Scenario: A shared preference shows its data
    Given I am signed in
    And my PlayStation account is linked and shares my identity
    When I open my account
    Then I see my identity card with my online id

  Scenario: Turning a preference off hides its data at once
    Given I am signed in
    And my PlayStation account is linked and shares my identity
    And I am looking at my identity card
    When I turn identity sharing off
    Then my identity card is hidden

  Scenario: A preference turned off stays off after a reload
    Given I am signed in
    And my PlayStation account is linked and shares my identity
    And I have turned identity sharing off
    When I reload my account
    Then identity sharing is still off and no identity card is shown

  Scenario: A received friend request is listed with its sender
    Given I am signed in
    And my account shares my identity, allows friend requests and has received one
    When I open my account
    Then I see the friend request from its sender

  Scenario: Accepting a friend request clears it
    Given I am signed in
    And my account shares my identity, allows friend requests and has received one
    And I am looking at a friend request
    When I accept it
    Then I am told it was accepted and have no requests left

  Scenario: Friend requests are not listed while identity sharing is off
    Given I am signed in
    And my PlayStation account is linked and has received a friend request
    When I open my account
    Then I am shown as linked
    And I see no friend requests

  Scenario: A friend request cannot be accepted until friend requests are allowed
    Given I am signed in
    And my account shares my identity, does not allow friend requests and has received one
    When I open my account
    Then I cannot accept the request, and I am told what would allow it

  Scenario: Linking says that every data-sharing preference is still off, and where to turn each on
    Given I am signed in
    When I link my PlayStation account with a sign-in token
    Then I am told every data-sharing preference is still off
    And I am offered where to turn trophies on

  Scenario: Neither enrichment key is set by default
    Given I am signed in
    And my PlayStation account is linked
    When I open my account
    Then I am offered to save a RAWG key and an OpenCritic key, and to remove neither

  Scenario: A saved RAWG key is kept, apart from OpenCritic
    Given I am signed in
    And my PlayStation account is linked
    When I save a RAWG key and reload my account
    Then my RAWG key is set and the OpenCritic key is still offered

  Scenario: A saved key is never shown again
    Given I am signed in
    And my PlayStation account is linked
    When I save a RAWG key
    Then my RAWG key is set
    And the key appears nowhere on the page

  Scenario: Removing a key offers its input again
    Given I am signed in
    And my PlayStation account is linked and has an OpenCritic key set
    When I remove my OpenCritic key
    Then I am offered to save an OpenCritic key

  Scenario: An empty key is refused without being sent
    Given I am signed in
    And my PlayStation account is linked
    When I save an empty RAWG key
    Then I am told the key is required
    And no RAWG key was sent

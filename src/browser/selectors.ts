/**
 * Centralised Teams DOM selectors.
 *
 * ALL Teams-specific selectors live here. Microsoft updates the Teams web UI
 * frequently — keeping selectors in one place makes maintenance feasible.
 *
 * Selector preference order:
 *   1. data-tid attributes (most stable)
 *   2. aria-label
 *   3. role + text content
 *   4. CSS class (last resort — classes are hashed/randomised)
 */

export const selectors = {
  // --- Landing / pre-join flow ---
  /** "Continue on this browser" or "Use web app instead" link */
  useWebAppButton: '[data-tid="joinOnWeb"]',
  /** Fallback: link with text matching "continue on this browser" */
  continueOnBrowserLink: 'a:has-text("Continue on this browser"), a:has-text("Use web app instead"), a:has-text("Join on the web instead")',

  // --- Cookie / consent banners ---
  cookieAcceptButton: '#acceptButton, button:has-text("Accept")',

  // --- Pre-join screen ---
  /** Display name input on the pre-join screen */
  nameInput: '[data-tid="prejoin-display-name-input"], input[placeholder="Type your name"]',
  /** Microphone toggle button */
  micToggle: '[data-tid="toggle-mute"], [data-tid="prejoin-audio-toggle"]',
  /** Camera toggle button */
  cameraToggle: '[data-tid="toggle-video"], [data-tid="prejoin-video-toggle"]',
  /** Join now / join meeting button */
  joinButton: '[data-tid="prejoin-join-button"], button:has-text("Join now")',

  // --- Lobby ---
  /** Indicator that we're waiting in the lobby */
  lobbyWaitMessage: '[data-tid="lobby-wait-message"], :has-text("Someone in the meeting should let you in soon")',

  // --- In-meeting controls ---
  /** The main meeting toolbar/controls bar */
  meetingControls: '[data-tid="meeting-controls"], [data-tid="calling-controls"]',
  /** Leave / hang up button */
  leaveButton: '[data-tid="hangup-button"], [data-tid="call-hangup"]',

  // --- Chat panel ---
  /** Button to open the chat panel */
  chatButton: '[data-tid="chat-button"], button[aria-label="Chat"]',
  /** The chat compose/input box */
  chatComposeBox: '[data-tid="ckeditor-replyConversation"], [data-tid="chat-compose-box"], div[role="textbox"][aria-label*="chat"]',
  /** Send button in chat */
  chatSendButton: '[data-tid="newMessageCommands-send"], button[aria-label="Send"]',
  /** Individual chat message containers */
  chatMessages: '[data-tid="chat-pane-message"], .message-body',
  /** Chat message sender name */
  chatMessageSender: '[data-tid="message-author-name"], .message-author',
  /** Chat message text content */
  chatMessageText: '[data-tid="message-body-content"], .message-body-content',

  // --- Participants panel ---
  /** Button to open the participants/people panel */
  participantsButton: '[data-tid="people-button"], button[aria-label="People"]',
  /** Individual participant entries in the roster */
  participantEntries: '[data-tid="roster-participant"], [data-tid="people-panel-participant"]',
  /** Participant display name within an entry */
  participantName: '[data-tid="roster-participant-name"], .participant-name',
};

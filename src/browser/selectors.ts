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
  /** The main meeting toolbar/controls bar — #hangup-button is the most reliable indicator we're in the meeting */
  meetingControls: '#hangup-button, [data-tid="meeting-controls"], [data-tid="calling-controls"]',
  /** Leave / hang up button */
  leaveButton: '#hangup-button, [data-tid="hangup-button"], [data-tid="call-hangup"]',
  /** In-meeting microphone toggle (for TTS unmute/mute cycle) */
  inMeetingMicToggle: '#microphone-button, [data-tid="toggle-mute"]',

  // --- Chat panel ---
  /** Button to open the chat panel */
  chatButton: '[data-tid="chat-button"], button[aria-label="Chat"]',
  /** The chat compose/input box */
  chatComposeBox: '[data-tid="ckeditor"][role="textbox"], [data-tid="ckeditor-replyConversation"], div[role="textbox"][aria-label*="chat"]',
  /** Send button in chat */
  chatSendButton: '[data-tid="newMessageCommands-send"], button[aria-label="Send"]',
  /** Individual chat message containers (only real messages, not system/control messages) */
  chatMessages: '[data-tid="chat-pane-item"]:has([data-tid="chat-pane-message"])',
  /** Control/system messages to ignore */
  chatControlMessage: '[data-tid="control-message-renderer"]',
  /** Chat message sender name */
  chatMessageSender: '[data-tid="message-author-name"]',
  /** Chat message text content */
  chatMessageText: '[data-tid="chat-pane-message"]',

  // --- Participants panel ---
  /** Button to open/close the participants/people panel */
  participantsButton: "#roster-button",
  /** Individual participant entries in the roster tree */
  participantEntries: '[role="tree"] [role="treeitem"]',
  /** Clean display name within a participant entry (avoids "Organiser"/"Unverified" suffixes) */
  participantName: 'span[dir="auto"]',
};

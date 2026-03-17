# Clive: Standup AI — User Stories

## Phase 0 — Join Meeting POC

### Story 0.1: Project Scaffolding
**As a** developer
**I want** a Node.js + TypeScript project with Playwright installed
**So that** I have a working foundation to build on

**Acceptance Criteria:**
- `npm install` succeeds
- `npm run dev` compiles TypeScript and runs
- Playwright Chromium browser launches successfully
- `.env.example` exists with all required variables documented
- `tsconfig.json` configured for modern Node.js + ESM

---

### Story 0.2: Navigate to Teams Meeting
**As a** bot
**I want** to open a Teams meeting URL in the browser and reach the pre-join screen
**So that** I can prepare to enter the meeting

**Acceptance Criteria:**
- Browser navigates to the configured `TEAMS_MEETING_URL`
- Handles "Continue on this browser" / "Use the web app" prompt (dismisses app install prompts)
- Handles cookie consent banners if present
- Arrives at the pre-join screen where name and A/V options are shown
- Console logs progress at each step

---

### Story 0.3: Enter Name and Join Meeting
**As a** bot
**I want** to enter my display name, disable mic/camera, and join the meeting
**So that** I appear as a participant called "Clive: Standup AI"

**Acceptance Criteria:**
- Display name field is populated with `BOT_DISPLAY_NAME` from config
- Microphone is toggled OFF before joining
- Camera is toggled OFF before joining
- "Join now" button is clicked
- Bot waits in lobby if applicable (logs "Waiting in lobby...")
- Bot detects when it has entered the meeting (e.g., meeting controls visible)
- Console logs: "Successfully joined meeting"

---

### Story 0.4: Send a Chat Message
**As a** bot in a meeting
**I want** to send a message in the meeting chat
**So that** I can confirm chat interaction works

**Acceptance Criteria:**
- Bot opens the chat panel if not already open
- Bot types "Hello! Clive is online." into the chat compose box
- Message is sent and visible to other meeting participants
- Console logs: "Chat message sent: Hello! Clive is online."

---

### Story 0.5: Graceful Shutdown
**As a** developer
**I want** the bot to leave the meeting cleanly when I press Ctrl+C
**So that** it doesn't leave ghost participants or orphaned browser processes

**Acceptance Criteria:**
- SIGINT handler registered on process
- On Ctrl+C: bot clicks "Leave" / hangup button in Teams
- Browser is closed
- Process exits cleanly
- Console logs: "Leaving meeting... Goodbye!"

---

## Phase 1 — Chat-Based Standup Flow

### Story 1.1: Chat Monitoring
**As a** bot in a meeting
**I want** to continuously monitor the meeting chat for new messages
**So that** I can react to commands from participants

**Acceptance Criteria:**
- Bot reads existing chat messages on the chat panel
- Bot detects new messages as they appear (polling or MutationObserver via page.evaluate)
- Each detected message includes: sender name, message text, timestamp (if available)
- Bot ignores its own messages
- Duplicate messages are not processed
- Console logs each new message: "[Chat] {sender}: {text}"

---

### Story 1.2: Welcome Message and Start Trigger
**As a** bot that has joined a meeting
**I want** to greet the team and wait for "start daily"
**So that** the standup begins when the team is ready

**Acceptance Criteria:**
- Immediately after joining (Story 0.4 complete), bot sends: "Good morning team! Type **start daily** when you're ready."
- Bot monitors chat (Story 1.1) for a message containing "start daily" (case-insensitive, substring match)
- "start daily" can come from any participant
- Once detected, bot transitions to standup mode
- If "start daily" is received while a standup is already running, it is ignored
- Console logs: "Standup triggered by {sender}"

---

### Story 1.3: Read Participant List
**As a** bot starting a standup
**I want** to read the current meeting participants
**So that** I know who to prompt for updates

**Acceptance Criteria:**
- Bot opens the participant/people panel in Teams
- Bot reads all participant display names
- Bot removes itself ("Clive: Standup AI" or matching `BOT_DISPLAY_NAME`) from the list
- Returns an array of participant name strings
- Console logs: "Participants: [Alice, Bob, Peter Kinder]"

---

### Story 1.4: Randomise Order with Kinder Last
**As a** bot with a participant list
**I want** to randomise the speaking order but put anyone named "Kinder" last
**So that** the standup has variety but Peter always goes last

**Acceptance Criteria:**
- All participants whose display name contains "Kinder" (case-insensitive) are separated out
- Remaining participants are shuffled randomly
- "Kinder" participants are appended at the end (in random order among themselves if multiple)
- The `LAST_SPEAKER_NAME` config value is used for the match pattern (not hardcoded)
- Unit testable as a pure function

---

### Story 1.5: Prompt Each Participant
**As a** bot running a standup
**I want** to prompt each participant in order and wait for "done"
**So that** everyone gives their update one at a time

**Acceptance Criteria:**
- For each participant in the ordered list:
  - Bot sends chat message: "**{Name}**, you're up! Give us your update."
  - Bot waits for any participant to type "done" or "next" (case-insensitive) in chat
  - On receiving "done"/"next", bot sends: "Thanks {Name}! ✓"
  - Bot moves to the next participant
- If the current participant has left the meeting (no longer in participant list), skip them with message: "{Name} has left — skipping. 👋"
- Console logs state transitions

---

### Story 1.6: Standup Complete
**As a** bot that has prompted all participants
**I want** to wrap up the standup
**So that** the team knows the daily is finished

**Acceptance Criteria:**
- After the last participant's "done", bot sends: "That's everyone! Thanks team, have a great day. 👋"
- Bot returns to idle state (listening for another "start daily" — allows re-running if needed)
- Console logs: "Standup complete"

---

## Phase 1.5 — REST API for Multi-Meeting Control

### Story 1.5.1: Session Manager
**As a** developer
**I want** a session manager that can track multiple bot instances
**So that** the API can manage concurrent meetings

**Acceptance Criteria:**
- `SessionManager` class that creates, tracks, and destroys sessions
- Each session has: `id` (uuid), `meetingUrl`, `botName`, `status`, `createdAt`
- Status lifecycle: `joining` → `in-lobby` → `in-meeting` → `idle` / `standup-active` → `disconnected`
- Sessions can be listed, retrieved by ID, and destroyed
- Destroying a session triggers the graceful leave flow (Story 0.5)
- Existing Phase 0/1 code is refactored so a single meeting run is wrapped in a session

---

### Story 1.5.2: REST API Server
**As a** developer
**I want** HTTP endpoints to control Clive remotely
**So that** I can join/leave meetings without restarting the process

**Acceptance Criteria:**
- Fastify server starts on `API_PORT` (default 3002)
- Endpoints:
  - `POST /sessions` — body: `{ meetingUrl, botName?, lastSpeaker? }` → returns `{ sessionId, status }`
  - `GET /sessions` — returns array of all active sessions
  - `GET /sessions/:id` — returns single session detail
  - `DELETE /sessions/:id` — leaves meeting, closes browser, removes session
  - `GET /health` — returns `{ status: "ok", activeSessions: n }`
- Input validation on POST (meetingUrl required, must be a URL)
- Proper HTTP status codes (201 created, 404 not found, 400 bad request)
- Console logs all API requests

---

### Story 1.5.3: Dual Mode Entry Point
**As a** developer
**I want** to run Clive in either "direct" or "api" mode
**So that** I can use the simple .env approach for testing or the API for production

**Acceptance Criteria:**
- `MODE=direct` (default): behaves like Phase 0/1 — reads `TEAMS_MEETING_URL` from env, joins one meeting
- `MODE=api`: starts the REST API server, waits for requests
- `npm run dev` defaults to direct mode
- `npm run api` starts in API mode
- Console logs which mode is active on startup

---

### Story 1.5.4: PowerShell Reference Doc
**As a** Windows user
**I want** a reference document with PowerShell commands for all API endpoints
**So that** I can control Clive from my Windows machine without building a UI

**Acceptance Criteria:**
- `POWERSHELL.md` in project root
- Includes `Invoke-RestMethod` examples for every endpoint
- Includes a "Quick Start" section: start the bot, join a meeting, check status, leave
- Includes example for joining multiple meetings
- All examples use `localhost:3002` as default with a note to change for remote server
- Copy-paste ready — each snippet works standalone

---

## Phase 2 — Text-to-Speech (Future Stories)

### Story 2.1: TTS Engine Integration
**As a** developer
**I want** to generate speech audio from text
**So that** Clive can speak in the meeting

**Acceptance Criteria:**
- A `speak(text: string)` function that produces an audio buffer/file
- Configurable TTS backend (local piper/espeak, cloud API, or pre-recorded files)
- Returns a promise that resolves when audio is ready

---

### Story 2.2: Virtual Audio Device Setup
**As a** developer
**I want** to route audio into the browser's microphone input
**So that** the meeting hears Clive speak

**Acceptance Criteria:**
- PulseAudio virtual sink configured (Linux/Docker) or BlackHole (macOS)
- Playwright browser launched with the virtual device as microphone input
- Audio played to the virtual sink is picked up by Teams as microphone input
- Bot can unmute → play audio → re-mute

---

### Story 2.3: Speak All Bot Messages
**As a** bot in a meeting
**I want** to speak aloud every message I send in chat
**So that** participants can hear Clive's prompts

**Acceptance Criteria:**
- Every chat message sent by the bot is also spoken via TTS
- Chat message is sent first, then audio plays
- Mute/unmute cycle happens around each speech event
- If TTS fails, chat message still works (graceful degradation)

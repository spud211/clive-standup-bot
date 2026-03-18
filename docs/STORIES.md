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

### Story 1.7: Language / Internationalisation Support
**As a** team lead running standups for multilingual teams
**I want** to switch Clive between English and French
**So that** I can run one standup in French and the next in English

**Acceptance Criteria:**
- New config variable `LANGUAGE` — accepts `en` (default) or `fr`
- All bot chat messages are defined in a centralised locale file (e.g. `src/i18n/messages.ts`) rather than hardcoded inline
- English messages (existing):
  - `"Good morning team! Type **start daily** when you're ready."`
  - `"**{name}**, you're up! Give us your update."`
  - `"Thanks {name}! ✓"`
  - `"{name} has left — skipping. 👋"`
  - `"That's everyone! Thanks team, have a great day. 👋"`
- French equivalents:
  - `"Bonjour l'équipe ! Tapez **commencer daily** quand vous êtes prêts."`
  - `"**{name}**, c'est à toi ! Donne-nous ton update."`
  - `"Merci {name} ! ✓"`
  - `"{name} est parti(e) — on passe. 👋"`
  - `"C'est tout le monde ! Merci l'équipe, bonne journée. 👋"`
- Chat trigger phrases are also language-aware:
  - English: "start daily", "done", "next"
  - French: "commencer daily", "fini", "suivant", "terminé"
- TTS voice selection is language-aware: use `LANGUAGE` to pick an appropriate voice (e.g. `say -v "Thomas"` or `say -v "Audrey"` for French on macOS, French espeak voice on Linux)
- Add `TTS_VOICE_FR` env variable (optional — default to a sensible French voice)
- In API mode (Phase 1.5), `language` can be passed per-session in the `POST /sessions` body, overriding the default
- Console logs: "[Config] Language: fr"

**Technical Notes:**
- Keep it simple — a messages object keyed by language code, not a full i18n framework
- Structure: `messages['en'].welcome`, `messages['fr'].welcome` etc.
- The locale file should be easy to extend with more languages later
- All existing hardcoded strings in the standup flow must be moved to the locale file (even English ones)

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

---

### Story 2.4: Virtual Camera — Clive's Face
**As a** team member in a meeting
**I want** to see Clive's avatar as a camera feed
**So that** Clive feels like a real participant, not a blank tile

**Approach:** Use a static image looped as a fake video stream fed into the browser.

**macOS (dev):**
- Use `ffmpeg` to convert the static avatar image into a short looping video file (e.g. 5-second MP4)
- Inject the video as the camera feed using Playwright's `navigator.mediaDevices` override via `page.addInitScript` — create a `MediaStream` from a `<video>` element playing the loop
- Alternatively, use `page.evaluate` to replace `getUserMedia` so when Teams requests camera access, it receives the looped video stream

**Linux (prod):**
- Same `getUserMedia` override approach (simplest, no v4l2 dependency)

**Acceptance Criteria:**
- A static image file (e.g. `assets/clive-avatar.png`) is used as Clive's camera feed
- When Clive's camera is turned ON in Teams, participants see the avatar image
- Camera should be turned ON after joining the meeting
- Config: `AVATAR_IMAGE_PATH` env variable, optional — if not set, camera stays off
- Image file is committed to the repo in `assets/` directory

---

## Phase 3A — Audio Capture + Continuous Transcription

### Story 3A.1: Audio Capture from Browser Tab
**As a** developer
**I want** to capture the meeting audio from the Playwright browser tab
**So that** I have a raw audio stream to send to STT

**Acceptance Criteria:**
- Audio is captured from the browser tab using WebRTC audio track interception or `getDisplayMedia` audio capture via `page.evaluate`
- Captured audio is available as a stream of PCM/WAV chunks
- Capture starts when the bot enters the meeting and stops when it leaves
- Clive's own TTS playback timestamps are tracked so consumers can filter echo
- Console logs: "Audio capture started" / "Audio capture stopped"
- No audible side effects — capturing does not affect what meeting participants hear

**Technical Notes:**
- Approach: inject JS via `page.evaluate` / `page.addInitScript` that hooks into the `RTCPeerConnection` to access incoming audio tracks, or use `navigator.mediaDevices.getDisplayMedia({ audio: true })` to capture tab audio
- Audio should be chunked into small buffers (e.g. 100-250ms) suitable for streaming to STT
- Output format: 16-bit PCM, 16kHz mono (Deepgram's preferred format)

---

### Story 3A.2: Deepgram Streaming Integration
**As a** developer
**I want** to stream captured audio to Deepgram for real-time transcription
**So that** I get a continuous text transcript of the meeting

**Acceptance Criteria:**
- WebSocket connection established to Deepgram's streaming API on meeting join
- Audio chunks from Story 3A.1 are sent to Deepgram in real time
- Deepgram responses are parsed into transcript segments
- Speaker diarisation enabled — each segment includes a speaker label
- Connection handles reconnection on failure (with backoff)
- Console logs each transcript segment: "[STT] Speaker 0: 'I finished the API work yesterday'"
- Connection closed cleanly on meeting leave

**Technical Notes:**
- Deepgram streaming endpoint: `wss://api.deepgram.com/v1/listen`
- Parameters: `model=nova-2`, `diarize=true`, `language=en-GB`, `punctuate=true`, `interim_results=false` (only final results to avoid noise)
- Use `@deepgram/sdk` npm package or raw WebSocket

---

### Story 3A.3: Transcript Buffer and Event System
**As a** developer
**I want** a transcript buffer that stores segments and emits events
**So that** multiple consumers (turn detection, contextual chat) can subscribe independently

**Acceptance Criteria:**
- `TranscriptBuffer` class that extends `EventEmitter`
- Stores transcript segments as `{ speaker: string, text: string, timestamp: number, isBotSpeech: boolean }`
- Emits `'segment'` event when a new transcript segment arrives
- Emits `'silence'` event when no speech detected for a configurable duration
- `isBotSpeech` flag is set by comparing segment timestamp against known Clive speech windows (from TTS playback tracking in Story 3A.1)
- Provides methods: `getRecent(seconds)` — returns transcript from last N seconds, `getFullTranscript()` — returns everything, `getCurrentSpeakerText()` — returns all text from the most recent continuous speaker
- Rolling buffer — keeps last 30 minutes, discards older segments
- Unit testable — no browser dependency

---

### Story 3A.4: Speaker-to-Participant Name Mapping
**As a** developer
**I want** to map Deepgram's speaker labels to actual participant names
**So that** the transcript shows "Peter Kinder" not "Speaker 0"

**Acceptance Criteria:**
- Initial mapping built by correlating speaker labels with the standup flow: when Clive prompts "{Name}, you're up!", the next speaker label is mapped to that name
- Mapping stored in a `SpeakerMap` that persists for the session
- Unmapped speakers show as "Unknown Speaker" rather than "Speaker 2"
- Mapping can be manually overridden via an API endpoint (future, not required for POC)
- If only one unknown speaker is talking and only one participant hasn't been mapped yet, auto-map them
- Console logs mapping events: "[SpeakerMap] Mapped Speaker 2 → Peter Kinder"

---

## Phase 3B — LLM-Based Turn Detection

### Story 3B.1: Fast-Path Keyword Detection
**As a** bot running a standup
**I want** to detect obvious "I'm done" phrases directly from the transcript
**So that** I can advance quickly without an LLM call for obvious cases

**Acceptance Criteria:**
- Subscribes to transcript `'segment'` events
- Maintains a list of trigger phrases: "done", "that's me", "that's it", "next", "I'm done", "that's my update", "nothing else", "that's all", "over to you"
- When the current speaker's text contains a trigger phrase (fuzzy/substring match, case-insensitive), emit a `'turn-complete'` event
- Only active during a standup, only evaluates the current speaker's segments
- Ignores trigger phrases from other speakers (someone saying "done" to mean something else)
- Console logs: "[TurnDetect] Fast-path trigger: 'that's me' from Peter Kinder"
- Unit testable with mock transcript segments

---

### Story 3B.2: LLM Intent Detection
**As a** bot running a standup
**I want** to use an LLM to detect when someone has finished their update even if they don't use a trigger phrase
**So that** the standup flows naturally

**Acceptance Criteria:**
- Evaluates every 4 seconds during an active standup turn (debounced, not on every segment)
- Sends the current speaker's recent transcript (last 30-60 seconds) to Claude Haiku
- Prompt asks: given this is a standup update from {Name}, have they clearly finished? Respond with JSON `{ "finished": true/false, "confidence": 0.0-1.0, "reason": "brief explanation" }`
- Only advances if `finished: true` AND `confidence >= 0.8`
- Does NOT evaluate if the current speaker has said fewer than 2 sentences (too early to tell)
- Does NOT evaluate during Clive's own speech
- If API call fails, falls back to waiting for fast-path keywords or chat "done"
- Console logs: "[TurnDetect] LLM evaluation: finished=true, confidence=0.92, reason='speaker wrapped up with future plans'"
- Rate limited: max 4 evaluations per turn to control costs

---

### Story 3B.3: Silence Detection
**As a** bot running a standup
**I want** to detect prolonged silence during someone's turn
**So that** I can gently prompt them or move on

**Acceptance Criteria:**
- Subscribes to transcript `'silence'` events from the TranscriptBuffer
- If silence exceeds `TURN_SILENCE_TIMEOUT` (default 10 seconds) during an active turn:
  - If the current speaker has said at least 2 sentences: send chat message "Sounds like you're done, {Name} — moving on! Say **wait** if you need more time."
  - If the current speaker hasn't said anything yet: send chat message "We can't hear you, {Name} — are you there? Type **skip** in chat to pass."
- A "wait" message in chat within 5 seconds cancels the auto-advance and resets the silence timer
- Console logs silence events and actions taken

---

### Story 3B.4: Integrate Turn Detection with Standup Flow
**As a** developer
**I want** to wire the turn detection system into the existing standup orchestrator
**So that** the standup can advance via voice OR chat

**Acceptance Criteria:**
- Standup flow (Story 1.5) now listens for turn-complete events from THREE sources: fast-path keywords (3B.1), LLM detection (3B.2), and chat "done"/"next" (existing Phase 1)
- First signal wins — whichever source fires first advances the turn
- `TURN_DETECTION_ENABLED` config flag: when `false`, only chat-based detection is active (Phase 1 behaviour)
- When `true`, all three sources are active simultaneously
- Console logs which source triggered the advance: "[Standup] Turn complete for Peter Kinder (source: llm-detection)"

---

## Phase 3C — Contextual Chat

### Story 3C.1: Team Knowledge Base
**As a** team lead
**I want** to maintain a file of team-specific knowledge
**So that** Clive has context about our projects, acronyms, and conventions

**Acceptance Criteria:**
- A markdown file at `TEAM_KNOWLEDGE_PATH` (default `./config/team-knowledge.md`)
- Loaded at startup, reloaded if the file changes (watch for file changes)
- Included in LLM prompts for contextual analysis
- Example structure:
  ```markdown
  # Team Knowledge Base
  
  ## Team Members
  - Peter Kinder (Pete) — Tech Lead, works on API platform
  - Alice — Frontend, React specialist
  - Steve — Backend, data pipeline
  
  ## Acronyms
  - OKR: Objectives and Key Results
  - PRD: Product Requirements Document
  - BAU: Business As Usual
  
  ## Active Projects
  - Project Phoenix: API migration to GraphQL (deadline: April 2026)
  - Project Hydra: New data pipeline (in discovery)
  
  ## Links
  - JIRA: https://company.atlassian.net/browse/
  - Confluence: https://company.atlassian.net/wiki/
  ```
- If file doesn't exist, contextual chat still works but with no team-specific context
- Console logs: "[Knowledge] Loaded team knowledge base (24 lines)"

---

### Story 3C.2: Contextual Analysis Engine
**As a** developer
**I want** an LLM-powered engine that analyses transcript segments for helpful context
**So that** Clive can contribute useful information to the chat

**Acceptance Criteria:**
- Subscribes to transcript `'segment'` events
- Batches segments: evaluates every 10 seconds during a participant's turn (not on every segment)
- Sends to Claude (model from `CONTEXTUAL_CHAT_MODEL` config) with:
  - Current speaker's transcript so far
  - Team knowledge base
  - Previous contextual messages sent this turn (to avoid repetition)
- Prompt asks the LLM to identify opportunities for helpful context: acronym explanations, relevant links, corrections, or cross-references to other team members' updates
- LLM responds with JSON: `{ "messages": [{ "text": "...", "type": "acronym|link|correction|cross-reference", "confidence": 0.0-1.0 }] }` or `{ "messages": [] }` if nothing useful
- Only posts messages with confidence >= 0.7
- Maximum `MAX_CONTEXT_PER_TURN` messages per speaker turn
- Does NOT evaluate during Clive's own speech
- If API call fails, silently skips — no error shown in chat

---

### Story 3C.3: Post Contextual Messages to Chat
**As a** bot in a meeting
**I want** to post contextual messages to the meeting chat
**So that** participants see helpful information in real time

**Acceptance Criteria:**
- Contextual messages from Story 3C.2 are posted to meeting chat
- Format: "💡 {message text}" — the lightbulb emoji distinguishes these from standup flow messages
- Messages are posted with a short delay (2 seconds after analysis completes) to avoid appearing before the speaker has finished their thought
- No contextual messages during the first 10 seconds of someone's turn
- No contextual messages posted while Clive is speaking via TTS
- Console logs: "[Context] Posted: 💡 OKR = Objectives and Key Results"

---

### Story 3C.4: Standup Summary
**As a** team member
**I want** Clive to post a summary after the standup finishes
**So that** we have a quick reference of what everyone said

**Acceptance Criteria:**
- After "That's everyone!" message, Clive waits 5 seconds then posts a summary to chat
- Summary is generated by sending the full standup transcript to the LLM
- Prompt asks for a concise summary: each person's key points, any blockers mentioned, any action items
- Format in chat:
  ```
  📋 **Standup Summary**
  
  **Alice:** Finished the login page, starting on dashboard today. Blocked on API access.
  **Steve:** Data pipeline tests passing, deploying to staging.
  **Pete:** Sprint planning, 1:1s, reviewing Alice's PR.
  
  **Blockers:** Alice needs API access from Steve.
  **Actions:** Steve to grant Alice API access by EOD.
  ```
- Summary also logged to console for potential export later
- If transcription wasn't active (Phase 3A not configured), skip the summary
- Uses `CONTEXTUAL_CHAT_MODEL` for generation
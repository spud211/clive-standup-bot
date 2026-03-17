# Clive: Standup AI — Project Specification

## Overview

Clive is a bot that joins Microsoft Teams meetings as a guest participant and facilitates daily standup meetings. It joins via the Teams web client in an automated browser (Playwright), interacts through meeting chat, and eventually speaks using TTS.

## Architecture

- **Runtime:** Node.js + TypeScript
- **Browser Automation:** Playwright (Chromium)
- **Audio (Phase 2):** PulseAudio virtual sink + TTS engine
- **Deployment:** Docker container on Linux server
- **Local Dev:** Runs on macOS, Playwright in headed mode for visual debugging

## Phases

### Phase 0 — Join Meeting POC

**Goal:** Prove that an automated browser can join a Teams meeting as a guest.

**Scope:**
- Launch Playwright Chromium (headed mode for local dev)
- Navigate to a Teams meeting join URL (provided via config/env)
- Enter display name "Clive: Standup AI"
- Click through the "Join on the web" flow
- Successfully appear as a participant in the meeting
- Send a single chat message: "Hello! Clive is online."
- Remain in the call until manually terminated (Ctrl+C)
- Gracefully leave the call on termination

**Success Criteria:**
- Clive appears in the participant list of an active Teams meeting
- A chat message from Clive is visible to other participants
- No Teams admin/IT involvement required

**Technical Notes:**
- Teams web join flow may include: landing page → "Continue on this browser" → pre-join screen (name entry, mic/camera toggle) → lobby → meeting
- Mic and camera should be OFF on join
- Must handle the lobby wait (host may need to admit)
- Selectors will be fragile — use `data-tid` attributes where possible, fall back to aria labels and text content
- May need to dismiss cookie banners, "use the app" prompts, etc.

---

### Phase 1 — Chat-Based Standup Flow

**Goal:** Run a full standup via meeting chat.

**Scope:**
- On join, send chat message: "Good morning team! Type **start daily** when you're ready."
- Monitor chat for the message "start daily" (case-insensitive) from any participant
- On trigger:
  1. Read the current participant list from the meeting
  2. Remove "Clive: Standup AI" (self) from the list
  3. Randomise the order, BUT always place any participant whose name contains "Kinder" (case-insensitive) last
  4. For each participant in order:
     - Send chat message: "**{Name}**, you're up! Give us your update."
     - Wait for that participant (or anyone) to type "done" or "next" (case-insensitive) in chat
     - Send chat message: "Thanks {Name}! ✓"
  5. After all participants have spoken:
     - Send chat message: "That's everyone! Thanks team, have a great day. 👋"
- Remain in call until manually terminated or kicked

**Participant Detection:**
- Read from the Teams meeting participant panel/roster
- Use display names as shown in Teams
- Re-read participant list at the moment "start daily" is triggered (not at join time), so latecomers are included

**Edge Cases (POC scope):**
- If someone leaves mid-standup, skip them when their turn comes (check participant list again)
- No timeout — wait indefinitely for "done"/"next"
- If "start daily" is sent again during a standup, ignore it
- Bot does not give itself an update turn

**Chat Monitoring:**
- Poll or observe the chat panel in the browser DOM
- Track which messages are new (by index/count) to avoid re-processing old messages
- Chat input: type into the chat compose box and send

---

### Phase 1.5 — REST API for Multi-Meeting Control

**Goal:** Allow Clive to be controlled via HTTP endpoints so it can join/leave multiple meetings without restarting.

**Scope:**
- Lightweight HTTP server (Fastify) running alongside the bot logic
- Each "join" request spawns a new browser context (isolated session)
- Multiple meetings can run concurrently
- Server runs on a configurable port (default 3002, since 3000/3001 are taken)

**Endpoints:**

| Method | Path | Body | Description |
|---|---|---|---|
| `POST` | `/sessions` | `{ meetingUrl, botName?, lastSpeaker? }` | Join a meeting. Returns `{ sessionId, status }` |
| `GET` | `/sessions` | — | List all active sessions with status |
| `GET` | `/sessions/:id` | — | Get status of a specific session |
| `DELETE` | `/sessions/:id` | — | Leave meeting and close browser for session |
| `GET` | `/health` | — | Health check |

**Session Lifecycle:**
- `POST /sessions` → status: `joining` → `in-lobby` → `in-meeting` → `standup-active` → `idle`
- `DELETE /sessions/:id` → bot leaves meeting, browser closes, session removed
- If bot is kicked from meeting, session status becomes `disconnected`

**Defaults:**
- `botName` defaults to `BOT_DISPLAY_NAME` from env (i.e. "Clive: Standup AI")
- `lastSpeaker` defaults to `LAST_SPEAKER_NAME` from env (i.e. "Kinder")
- These can be overridden per-session via the POST body

**Configuration:**

| Variable | Description | Example |
|---|---|---|
| `API_PORT` | Port for the REST API | `3002` |
| `API_HOST` | Bind address | `0.0.0.0` |

**Deliverables:**
- Working REST API
- `POWERSHELL.md` — a reference doc with PowerShell snippets for all endpoints (Invoke-RestMethod examples)
- Console logging for all API requests and session state changes

---

### Phase 2 — Text-to-Speech (Bot Speaks)

**Goal:** Clive speaks its prompts aloud in the meeting, in addition to chat messages.

**Scope:**
- All chat messages from Phase 1 are ALSO spoken aloud via TTS
- Audio is routed into the meeting via a virtual microphone
- Chat messages remain as a fallback/log

**Technical Approach:**
- PulseAudio virtual sink inside Docker container (or on macOS for dev)
- TTS engine options (to evaluate):
  - **Local:** piper, espeak-ng, say (macOS only)
  - **Cloud:** Azure TTS, Google TTS, ElevenLabs
  - **Pre-recorded audio files** as a simpler alternative for fixed phrases
- Generate audio → play into virtual sink → Playwright browser picks up virtual sink as microphone input → meeting hears the audio

**Notes:**
- The bot's mic must be unmuted in Teams before speaking, then re-muted
- Latency matters — TTS should be fast enough to feel natural
- For POC, pre-recorded files or a fast local TTS are fine
- macOS dev may use BlackHole or similar virtual audio device

---

### Phase 3 — Speech Recognition (Future)

**Goal:** Detect "and that's my update" (or similar) via speech recognition to auto-advance.

**Not in scope for current build.** Placeholder for future work.

**Approach would be:**
- Capture meeting audio from browser
- Stream to STT engine (Whisper, Deepgram, Azure Speech)
- Detect trigger phrases
- Replace the "done"/"next" chat trigger from Phase 1

---

## Configuration

All config via environment variables or a `.env` file:

| Variable | Description | Example |
|---|---|---|
| `TEAMS_MEETING_URL` | Full Teams meeting join URL (direct mode only) | `https://teams.microsoft.com/l/meetup-join/...` |
| `BOT_DISPLAY_NAME` | Default name shown in meeting | `Clive: Standup AI` |
| `HEADLESS` | Run browser headless (true for prod) | `false` |
| `LAST_SPEAKER_NAME` | Name pattern to always go last | `Kinder` |
| `API_PORT` | Port for REST API (Phase 1.5+) | `3002` |
| `API_HOST` | Bind address for REST API | `0.0.0.0` |
| `MODE` | `direct` (single meeting via env) or `api` (REST server) | `direct` |

---

## Project Structure

```
clive-standup-bot/
├── src/
│   ├── index.ts              # Entry point (direct mode or API mode)
│   ├── config.ts             # Env/config loading
│   ├── api/
│   │   ├── server.ts         # Fastify HTTP server
│   │   └── routes.ts         # Session endpoints
│   ├── browser/
│   │   ├── launch.ts         # Playwright browser setup
│   │   └── teams-join.ts     # Teams meeting join flow
│   ├── meeting/
│   │   ├── chat.ts           # Chat send/receive/monitor
│   │   ├── participants.ts   # Read participant list
│   │   ├── session.ts        # Session manager (tracks active sessions)
│   │   └── standup.ts        # Standup orchestration logic
│   └── tts/                  # Phase 2
│       └── speak.ts          # TTS + audio routing
├── .env.example
├── package.json
├── tsconfig.json
├── Dockerfile                # Phase 2+
├── SPEC.md                   # This file
├── STORIES.md                # User stories
└── POWERSHELL.md             # PowerShell reference for API calls
```

---

## Development Workflow

- **Local dev:** `npm run dev` — launches headed Chromium, joins meeting, visible on screen
- **Debug:** Watch the browser do its thing, check console output for chat monitoring
- **Test:** Create a Teams meeting with yourself, run the bot, interact via Teams on your phone or another browser

---

## Risks & Assumptions

1. **Teams web UI changes** — Microsoft can change the DOM at any time. Selectors will need maintenance. Mitigate by using stable attributes (`data-tid`, `aria-label`) and keeping selector definitions centralised.
2. **Guest join policy** — Assumed enabled based on Fathom being able to join. If it breaks, IT involvement becomes necessary.
3. **Chat DOM structure** — Need to reverse-engineer how chat messages appear in the Teams web client. May differ between "new Teams" and classic Teams web.
4. **Lobby admission** — Someone may need to manually admit Clive from the lobby. Could be automated if the meeting organiser sets "everyone can bypass lobby".
5. **Rate limiting / anti-bot** — Microsoft could theoretically detect automated browser usage. Low risk for a single bot joining one meeting a day.
6. **Participant name matching** — Display names in Teams may include titles, suffixes, or be truncated. The "Kinder" match is substring-based to handle variations.
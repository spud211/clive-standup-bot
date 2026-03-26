# Clive: Standup AI — Project Specification

## Overview

Clive is a bot that joins Microsoft Teams meetings as a guest participant and facilitates daily standup meetings. It joins via the Teams web client in an automated browser (Playwright), interacts through meeting chat, and speaks using TTS. Clive has personality — IRC-style commands, banter, and fun utilities.

## Architecture

- **Runtime:** Node.js + TypeScript
- **Browser Automation:** Playwright (Chromium)
- **Audio:** macOS `say` command → BlackHole 2ch virtual audio device → browser mic input
- **Virtual Camera:** getUserMedia override with canvas stream (static image or looping video)
- **Deployment:** Docker container on Linux server (future), macOS for dev
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
- Mic and camera should be OFF on join (unless avatar is configured)
- Must handle the lobby wait (host may need to admit)
- Selectors will be fragile — use `data-tid` attributes where possible, fall back to aria labels and text content
- May need to dismiss cookie banners, "use the app" prompts, etc.

---

### Phase 1 — Chat-Based Standup Flow

**Goal:** Run a full standup via meeting chat.

**Scope:**
- On join, send chat message (randomly selected from pool): "Good morning team! Type **start daily** when you're ready."
- Monitor chat for trigger phrases (language-aware, case-insensitive)
- On trigger:
  1. Read the current participant list from the meeting roster
  2. Remove bot (self) from the list
  3. Randomise the order, BUT always place any participant matching `LAST_SPEAKER_NAME` last
  4. Post ops ceremony: "⚡ Mode +o {name} — you have the conn today"
  5. Optionally prompt lead to share scrum board (10s skippable wait)
  6. For each participant in order:
     - Send chat message: "**{Name}**, you're up! Give us your update."
     - Wait for "done"/"next" (case-insensitive) in chat
     - Send chat message: "Thanks {Name}! ✓"
  7. After all participants: randomly selected sign-off message
- All bot messages also spoken via TTS (fire-and-forget, non-blocking)
- Supports English and French (configurable per-session)
- Remain in call until manually terminated or kicked

**Participant Detection:**
- Read from the Teams meeting roster panel (`#roster-button` to open)
- Use `[role="treeitem"] span[dir="auto"]` for clean display names
- Filter out section headers and the bot itself
- Re-read participant list at trigger time (not at join time)

**Edge Cases (POC scope):**
- If someone leaves mid-standup, skip them
- No timeout — wait indefinitely for "done"/"next"
- If "start daily" is sent again during a standup, ignore it
- Bot does not give itself an update turn

---

### Phase 1.5 — REST API for Multi-Meeting Control

**Goal:** Allow Clive to be controlled via HTTP endpoints so it can join/leave multiple meetings without restarting.

**Scope:**
- Lightweight HTTP server (Fastify) running alongside the bot logic
- Each "join" request spawns a new browser context (isolated session)
- Multiple meetings can run concurrently
- Server runs on a configurable port (default 3002)

**Endpoints:**

| Method | Path | Body | Description |
|---|---|---|---|
| `POST` | `/sessions` | `{ meetingUrl, botName?, lastSpeaker?, language? }` | Join a meeting. Returns `{ sessionId, status }` |
| `GET` | `/sessions` | — | List all active sessions with status |
| `GET` | `/sessions/:id` | — | Get status of a specific session |
| `DELETE` | `/sessions/:id` | — | Leave meeting and close browser for session |
| `GET` | `/health` | — | Health check |

**Session Lifecycle:**
- `POST /sessions` → status: `joining` → `in-lobby` → `in-meeting` → `standup-active` → `idle`
- `DELETE /sessions/:id` → bot leaves meeting, browser closes, session removed
- If bot is kicked from meeting, session status becomes `disconnected`

---

### Phase 2 — Text-to-Speech & Virtual Camera

**Goal:** Clive speaks its prompts aloud and shows a video avatar.

**Scope:**
- All chat messages are ALSO spoken aloud via TTS (fire-and-forget, non-blocking)
- Audio routed via BlackHole 2ch virtual audio device (macOS)
- `say -a "BlackHole 2ch"` speaks directly to the virtual device
- Browser picks up BlackHole as mic input (set as system default via SwitchAudioSource)
- Virtual camera via getUserMedia override: static image (5fps) or looping video (30fps)
- TTS serialised via promise queue to prevent overlapping speech
- Language-aware voice selection (English/French)
- Mic stays unmuted throughout — no mute/unmute cycling

---

### Phase 2.5 — Clive's Personality (IRC Bot Mode & Fun)

**Goal:** Give Clive personality through commands, banter, and utilities.

**Scope:**
- Pluggable `CommandRegistry` with pattern matching and `allowDuringStandup`/`speakResponse` flags
- IRC classics: `/slap`, `/me`, ops ceremony on standup start
- Banter: responds to greetings and thanks directed at Clive
- Fun commands: `/timer`, `/poll`, `/quote`, `/8ball`, `/flip`, `/help`
- Conversate mode: `/conversate {topic}` for timed open discussions
- Dynamic welcome/sign-off messages with day-of-week specials

---

### Phase 2.6 — Scrum Board Prompt

**Goal:** Remind the team lead to share their screen with the board.

**Scope:**
- After ops ceremony, before first speaker, Clive prompts lead to share board
- 10-second skippable wait (type "go" or "skip")
- Optional `SCRUM_BOARD_URL` includes a link in the prompt
- Configurable via `SCRUM_BOARD_PROMPT` (default true)

---

### Phase 3 — Speech Recognition (Future)

**Goal:** Detect "and that's my update" (or similar) via speech recognition to auto-advance.

**Not in scope for current build.** See STORIES.md for detailed stories (Phase 3A, 3B, 3C).

---

## Configuration

All config via environment variables or a `.env` file:

| Variable | Description | Example |
|---|---|---|
| `TEAMS_MEETING_URL` | Full Teams meeting join URL (direct mode only) | `https://teams.microsoft.com/l/...` |
| `BOT_DISPLAY_NAME` | Default name shown in meeting | `Clive: Standup AI` |
| `HEADLESS` | Run browser headless (true for prod) | `false` |
| `LAST_SPEAKER_NAME` | Name pattern to always go last | `Kinder` |
| `MODE` | `direct` (single meeting via env) or `api` (REST server) | `direct` |
| `LANGUAGE` | Bot language: `en` or `fr` | `en` |
| `API_PORT` | Port for REST API (Phase 1.5+) | `3002` |
| `API_HOST` | Bind address for REST API | `0.0.0.0` |
| `TTS_ENABLED` | Enable/disable TTS | `true` |
| `TTS_VOICE` | macOS `say` voice for English | `Jamie (Enhanced)` |
| `TTS_VOICE_FR` | macOS `say` voice for French | `Thomas` |
| `TTS_RATE` | Speech rate (words per minute) | `` |
| `AUDIO_DEVICE` | Virtual audio device name | `BlackHole 2ch` |
| `AVATAR_IMAGE_PATH` | Static avatar image (camera off if unset) | `assets/clive-avatar.png` |
| `AVATAR_VIDEO_PATH` | Looping video avatar (takes priority over image) | `assets/clive-avatar.mp4` |
| `SCRUM_BOARD_PROMPT` | Prompt lead to share board | `true` |
| `SCRUM_BOARD_URL` | Optional URL for board prompt | `` |

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
│   │   ├── launch.ts         # Playwright browser setup + audio device
│   │   ├── selectors.ts      # Centralised Teams DOM selectors
│   │   ├── teams-join.ts     # Teams meeting join flow
│   │   └── virtual-camera.ts # getUserMedia override (image/video)
│   ├── commands/
│   │   ├── registry.ts       # CommandRegistry + CommandDef interface
│   │   ├── index.ts          # Register all commands (single browse point)
│   │   ├── irc.ts            # /slap, /me
│   │   ├── banter.ts         # Greetings, thanks responses
│   │   ├── fun.ts            # /timer, /poll, /quote, /8ball, /flip, /help
│   │   └── conversate.ts     # /conversate, /end, /extend
│   ├── i18n/
│   │   └── messages.ts       # All bot messages (en/fr), triggers, voices
│   ├── meeting/
│   │   ├── chat.ts           # Chat send/receive/monitor
│   │   ├── participants.ts   # Read participant list from roster
│   │   ├── ordering.ts       # Participant ordering (random, last speaker)
│   │   ├── session.ts        # Session manager (tracks active sessions)
│   │   └── standup.ts        # Standup orchestration logic
│   └── tts/
│       └── audio.ts          # TTS audio playback via BlackHole
├── assets/
│   ├── clive-avatar.png      # Static avatar image
│   └── clive-avatar.mp4      # Looping video avatar (4s, 640x640)
├── .env.example
├── package.json
├── tsconfig.json
├── CLAUDE.md                 # Instructions for Claude Code
├── CURL.md                   # curl reference for API calls
├── POWERSHELL.md             # PowerShell reference for API calls
└── docs/
    ├── SPEC.md               # This file
    └── STORIES.md            # User stories
```

---

## Development Workflow

- **Local dev:** `npm run dev` — launches headed Chromium, joins meeting, visible on screen
- **API mode:** `npm run api` — starts REST server on port 3002
- **Debug:** Watch the browser do its thing, check console output for chat monitoring
- **Test:** Create a Teams meeting, run the bot, interact via Teams on phone or another browser
- **Unit tests:** `npm test` — Vitest for pure logic (ordering, config)

---

## Risks & Assumptions

1. **Teams web UI changes** — Microsoft can change the DOM at any time. Selectors will need maintenance. Mitigate by using stable attributes (`data-tid`, `aria-label`) and keeping selector definitions centralised.
2. **Guest join policy** — Assumed enabled based on Fathom being able to join. If it breaks, IT involvement becomes necessary.
3. **Chat DOM structure** — Need to reverse-engineer how chat messages appear in the Teams web client. May differ between "new Teams" and classic Teams web.
4. **Lobby admission** — Someone may need to manually admit Clive from the lobby. Could be automated if the meeting organiser sets "everyone can bypass lobby".
5. **Rate limiting / anti-bot** — Microsoft could theoretically detect automated browser usage. Low risk for a single bot joining one meeting a day.
6. **Participant name matching** — Display names in Teams may include titles, suffixes, or be truncated. The "Kinder" match is substring-based to handle variations.

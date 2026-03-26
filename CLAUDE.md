# CLAUDE.md — Project Instructions for Claude Code

## Project Overview

This is **Clive: Standup AI** — a bot that joins Microsoft Teams meetings as a guest participant via an automated browser (Playwright), facilitates daily standup meetings through chat interaction, speaks via TTS, and has IRC-style personality commands.

Read `docs/SPEC.md` for full technical specification and `docs/STORIES.md` for user stories broken into phases.

## Tech Stack

- **Runtime:** Node.js 20+ with TypeScript (strict mode)
- **Modules:** ESM (`"type": "module"` in package.json)
- **Browser Automation:** Playwright (Chromium only)
- **HTTP Server (Phase 1.5):** Fastify
- **TTS:** macOS `say` command → BlackHole 2ch virtual audio device
- **Testing:** Vitest for unit tests
- **Package Manager:** npm

## Architecture Principles

- **One session = one browser context.** Each meeting the bot joins gets its own isolated Playwright browser context.
- **All Teams DOM selectors live in one centralised file** (`src/browser/selectors.ts`). Never scatter selectors across the codebase. They WILL break when Microsoft updates Teams — keeping them in one place makes maintenance feasible.
- **All bot messages live in one centralised locale file** (`src/i18n/messages.ts`). Never hardcode user-facing strings. Supports `en` and `fr`.
- **All commands registered in one file** (`src/commands/index.ts`). Single place to browse all available commands.
- **Log everything to console.** Every state transition, every chat message detected, every action taken. This is a bot that runs headless in production — logs are our eyes.
- **Graceful degradation.** If something fails (chat send, participant read, TTS), log the error and continue. Don't crash the whole session.
- **TTS is fire-and-forget.** Chat messages are sent immediately. TTS plays in the background and never blocks the standup flow. TTS calls are serialised via a promise queue to prevent overlapping speech.
- **Commands declare behaviour.** Each command has `allowDuringStandup` (blocked during standup if false) and `speakResponse` (chat-only if false, spoken if true). Most fun/utility commands are chat-only.

## Project Structure

Follow the structure defined in SPEC.md. Key directories:

```
src/
  api/          — Fastify REST server (Phase 1.5)
  browser/      — Playwright launch + Teams join flow + selectors + virtual camera
  commands/     — Pluggable chat command system (IRC, banter, fun, conversate)
  i18n/         — Locale messages, triggers, voice config (en/fr)
  meeting/      — Chat, participants, session management, standup logic
  tts/          — TTS audio playback via BlackHole
```

## Code Style & Conventions

- TypeScript strict mode, no `any` types unless absolutely unavoidable (and commented why)
- Async/await everywhere, no raw promises or callbacks
- Use named exports, not default exports
- Error handling: try/catch with meaningful error messages logged to console
- Config loaded from environment variables via `src/config.ts` — never hardcode config values
- Use `const` by default, `let` only when reassignment is needed

## Working with Teams Web UI

The Teams web client is the hardest part of this project. Key guidance:

- **The join flow changes.** Microsoft updates Teams regularly. The sequence of screens (landing → "use web" → pre-join → lobby → meeting) may vary. Code defensively with timeouts and fallbacks.
- **Selectors are fragile.** Prefer in this order: `data-tid` attributes → `aria-label` → `role` + text content → CSS class (last resort, classes are hashed/randomised).
- **Always wait for elements** before interacting. Use Playwright's `waitForSelector` or `locator.waitFor()` with reasonable timeouts.
- **Dismiss interruptions.** Cookie banners, "use the app" prompts, notification permission dialogs — handle these early in the join flow.
- **Chat panel** may need to be explicitly opened. Don't assume it's visible by default.
- **Key selectors** (see `src/browser/selectors.ts` for full list):
  - Meeting entry: `#hangup-button`
  - Chat compose: `[data-tid="ckeditor"][role="textbox"]`
  - Chat messages: `[data-tid="chat-pane-item"]`
  - Roster: `#roster-button`, `[role="treeitem"] span[dir="auto"]`
  - Camera: `#video-button` (aria-label toggles state)
  - Mic: `#mic-button` (aria-label toggles state)

## Development Workflow

- `npm run dev` — compiles and runs in direct mode (single meeting from .env)
- `npm run api` — compiles and runs in API mode (REST server, Phase 1.5)
- `npm run build` — TypeScript compilation only
- `npm test` — run unit tests (Vitest)

For local development, Playwright runs in **headed mode** (visible browser window) so the developer can watch the bot interact with Teams. Set `HEADLESS=true` for production/Docker.

## Phased Development

Work is organised into phases. **Complete one phase fully before starting the next.** Within a phase, work through stories in numerical order — each builds on the previous.

- **Phase 0:** Join meeting POC (Stories 0.1–0.5) ✅
- **Phase 1:** Chat-based standup flow (Stories 1.1–1.7) ✅
- **Phase 1.5:** REST API for multi-meeting control (Stories 1.5.1–1.5.4) ✅
- **Phase 2:** TTS + virtual camera (Stories 2.1–2.6) ✅
- **Phase 2.5:** Personality & commands (Stories 2.5.1–2.5.5) ✅
- **Phase 2.6:** Scrum board prompt (Story 2.6.1) ✅
- **Phase 2.7:** TTS quality upgrade (Stories 2.7.1–2.7.2) — future
- **Phase 3A:** Audio capture + transcription — future
- **Phase 3B:** LLM-based turn detection — future
- **Phase 3C:** Contextual chat — future

## Git Conventions

- Commit after each completed story
- Commit message format: `feat: story X.Y - brief description`
- Don't squash — keep the story-by-story history
- Branch strategy: work on `main` for now (solo developer)

## Testing

- **Unit tests** (Vitest) for pure logic: participant ordering (Story 1.4), config parsing, message detection
- **Manual testing** for browser automation: create a Teams meeting, run the bot, interact via Teams on phone or second browser
- No E2E test framework for the browser automation — it's too dependent on live Teams infrastructure

## Environment Variables

See `.env.example` for all required/optional variables. Key ones:

- `TEAMS_MEETING_URL` — the meeting to join (direct mode)
- `BOT_DISPLAY_NAME` — defaults to "Clive: Standup AI"
- `HEADLESS` — false for dev, true for prod
- `MODE` — "direct" or "api"
- `LANGUAGE` — "en" or "fr"
- `API_PORT` — defaults to 3002
- `LAST_SPEAKER_NAME` — name pattern for who goes last (default: "Kinder")
- `AUDIO_DEVICE` — virtual audio device (default: "BlackHole 2ch")
- `AVATAR_VIDEO_PATH` — looping video avatar (takes priority over image)
- `AVATAR_IMAGE_PATH` — static avatar image
- `SCRUM_BOARD_PROMPT` — prompt lead to share board (default: true)

## What NOT To Do

- **Don't use the Microsoft Graph API or Azure Communication Services.** This bot joins as a web guest, not via any Microsoft API. No Azure AD app registration, no admin consent, no Teams SDK.
- **Don't try to install or use the Teams desktop app.** Everything goes through the browser web client.
- **Don't hardcode selectors inline.** Always reference the centralised selectors file.
- **Don't hardcode user-facing strings.** Always use `src/i18n/messages.ts`.
- **Don't add a database.** Sessions live in memory. This is a POC.
- **Don't over-engineer.** This is a working POC, not a product. Favour simplicity and readability over abstraction.
- **Don't block the standup flow with TTS.** Chat message first, TTS is fire-and-forget.
- **Don't speak command responses via TTS** unless `speakResponse: true`. Most commands are chat-only.

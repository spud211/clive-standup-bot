# CLAUDE.md — Project Instructions for Claude Code

## Project Overview

This is **Clive: Standup AI** — a bot that joins Microsoft Teams meetings as a guest participant via an automated browser (Playwright) and facilitates daily standup meetings through chat interaction.

Read `SPEC.md` for full technical specification and `STORIES.md` for user stories broken into phases.

## Tech Stack

- **Runtime:** Node.js 20+ with TypeScript (strict mode)
- **Modules:** ESM (`"type": "module"` in package.json)
- **Browser Automation:** Playwright (Chromium only)
- **HTTP Server (Phase 1.5):** Fastify
- **Testing:** Vitest for unit tests
- **Package Manager:** npm

## Architecture Principles

- **One session = one browser context.** Each meeting the bot joins gets its own isolated Playwright browser context.
- **All Teams DOM selectors live in one centralised file** (`src/browser/selectors.ts`). Never scatter selectors across the codebase. They WILL break when Microsoft updates Teams — keeping them in one place makes maintenance feasible.
- **Log everything to console.** Every state transition, every chat message detected, every action taken. This is a bot that runs headless in production — logs are our eyes.
- **Graceful degradation.** If something fails (chat send, participant read, TTS), log the error and continue. Don't crash the whole session.

## Project Structure

Follow the structure defined in SPEC.md. Key directories:

```
src/
  api/          — Fastify REST server (Phase 1.5)
  browser/      — Playwright launch + Teams join flow + selectors
  meeting/      — Chat, participants, session management, standup logic
  tts/          — Text-to-speech (Phase 2)
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

## Development Workflow

- `npm run dev` — compiles and runs in direct mode (single meeting from .env)
- `npm run api` — compiles and runs in API mode (REST server, Phase 1.5)
- `npm run build` — TypeScript compilation only
- `npm test` — run unit tests (Vitest)

For local development, Playwright runs in **headed mode** (visible browser window) so the developer can watch the bot interact with Teams. Set `HEADLESS=true` for production/Docker.

## Phased Development

Work is organised into phases. **Complete one phase fully before starting the next.** Within a phase, work through stories in numerical order — each builds on the previous.

- **Phase 0:** Join meeting POC (Stories 0.1–0.5)
- **Phase 1:** Chat-based standup flow (Stories 1.1–1.6)
- **Phase 1.5:** REST API for multi-meeting control (Stories 1.5.1–1.5.4)
- **Phase 2:** Text-to-speech (Stories 2.1–2.3)
- **Phase 3:** Speech recognition (future, not yet specced)

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
- `API_PORT` — defaults to 3002
- `LAST_SPEAKER_NAME` — name pattern for who goes last (default: "Kinder")

## What NOT To Do

- **Don't use the Microsoft Graph API or Azure Communication Services.** This bot joins as a web guest, not via any Microsoft API. No Azure AD app registration, no admin consent, no Teams SDK.
- **Don't try to install or use the Teams desktop app.** Everything goes through the browser web client.
- **Don't hardcode selectors inline.** Always reference the centralised selectors file.
- **Don't add a database.** Sessions live in memory. This is a POC.
- **Don't over-engineer.** This is a working POC, not a product. Favour simplicity and readability over abstraction.

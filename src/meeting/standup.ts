import { type Page } from "playwright";
import { sendAndSpeak } from "./chat.js";
import { getParticipants } from "./participants.js";
import { orderParticipants } from "./ordering.js";
import { type Language, getMessages, fmt, pickComplete } from "../i18n/messages.js";
import { config } from "../config.js";

const BOARD_PROMPT_TIMEOUT_MS = 10_000;

/**
 * Orchestrates a single standup round.
 *
 * Flow:
 *  1. Read participants
 *  2. Order them (random, with lastSpeaker pattern at the end)
 *  3. Prompt each one, wait for "done"/"next"
 *  4. Wrap up
 */
export class Standup {
  private page: Page;
  private botName: string;
  private lastSpeakerPattern: string;
  private lang: Language;

  private _running = false;
  private advanceResolve: (() => void) | null = null;
  private boardSkipResolve: (() => void) | null = null;

  constructor(page: Page, botName: string, lastSpeakerPattern: string, lang: Language = "en") {
    this.page = page;
    this.botName = botName;
    this.lastSpeakerPattern = lastSpeakerPattern;
    this.lang = lang;
  }

  get isRunning(): boolean {
    return this._running;
  }

  /** Signal that the current speaker is done. */
  advance(): void {
    if (this.advanceResolve) {
      this.advanceResolve();
      this.advanceResolve = null;
    }
  }

  /** Signal to skip the board prompt wait. */
  skipBoard(): void {
    if (this.boardSkipResolve) {
      this.boardSkipResolve();
      this.boardSkipResolve = null;
    }
  }

  /** Run a full standup cycle. */
  async run(): Promise<void> {
    if (this._running) return;
    this._running = true;
    const msg = getMessages(this.lang);

    try {
      // Story 1.3: Read participant list
      const participants = await getParticipants(this.page, this.botName);

      if (participants.length === 0) {
        await sendAndSpeak(this.page, msg.noParticipants, this.lang);
        console.log("[Standup] No participants found.");
        return;
      }

      // Story 1.4: Randomise with last-speaker pattern
      const ordered = orderParticipants(participants, this.lastSpeakerPattern);
      console.log(`[Standup] Order: [${ordered.join(", ")}]`);

      // Story 2.5.2: Ops ceremony — give the conn to the last speaker (team lead)
      const lastSpeaker = ordered[ordered.length - 1];
      if (lastSpeaker) {
        await sendAndSpeak(this.page, fmt(msg.ops, lastSpeaker), this.lang);
      }

      // Story 2.6.1: Scrum board prompt
      if (config.scrumBoardPrompt && lastSpeaker) {
        const boardMsg = config.scrumBoardUrl
          ? fmt(msg.boardPromptWithUrl, lastSpeaker, { url: config.scrumBoardUrl })
          : fmt(msg.boardPrompt, lastSpeaker);
        await sendAndSpeak(this.page, boardMsg, this.lang);
        console.log("[Standup] Waiting for board share or 'go'/'skip'...");
        await this.waitForBoardSkip(BOARD_PROMPT_TIMEOUT_MS);
      }

      // Story 1.5: Prompt each participant
      for (const name of ordered) {
        await sendAndSpeak(this.page, fmt(msg.prompt, name), this.lang);

        // Wait for "done" or "next" via advance()
        console.log(`[Standup] Waiting for ${name} to finish...`);
        await this.waitForAdvance();

        await sendAndSpeak(this.page, fmt(msg.thanks, name), this.lang);
      }

      // Story 1.6: Standup complete
      await sendAndSpeak(this.page, pickComplete(msg), this.lang);
      console.log("[Standup] Standup complete.");
    } catch (err) {
      console.error("[Standup] Error during standup:", err);
    } finally {
      this._running = false;
      this.advanceResolve = null;
    }
  }

  /**
   * Returns a promise that resolves when advance() is called.
   * Intentionally has no timeout — spec says wait indefinitely (POC scope).
   * Phase 3B will add voice-based turn detection as an alternative.
   */
  private waitForAdvance(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.advanceResolve = resolve;
    });
  }

  /** Wait for board skip signal or timeout, whichever comes first. */
  private waitForBoardSkip(timeoutMs: number): Promise<void> {
    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        this.boardSkipResolve = null;
        console.log("[Standup] Board prompt timed out — continuing.");
        resolve();
      }, timeoutMs);

      this.boardSkipResolve = () => {
        clearTimeout(timer);
        console.log("[Standup] Board prompt skipped.");
        resolve();
      };
    });
  }
}

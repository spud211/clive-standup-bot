import { type Page } from "playwright";
import { sendAndSpeak } from "./chat.js";
import { getParticipants } from "./participants.js";
import { orderParticipants } from "./ordering.js";

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

  private _running = false;
  private advanceResolve: (() => void) | null = null;

  constructor(page: Page, botName: string, lastSpeakerPattern: string) {
    this.page = page;
    this.botName = botName;
    this.lastSpeakerPattern = lastSpeakerPattern;
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

  /** Run a full standup cycle. */
  async run(): Promise<void> {
    if (this._running) return;
    this._running = true;

    try {
      // Story 1.3: Read participant list
      const participants = await getParticipants(this.page, this.botName);

      if (participants.length === 0) {
        await sendAndSpeak(this.page, "No participants found — skipping standup.");
        console.log("[Standup] No participants found.");
        return;
      }

      // Story 1.4: Randomise with last-speaker pattern
      const ordered = orderParticipants(participants, this.lastSpeakerPattern);
      console.log(`[Standup] Order: [${ordered.join(", ")}]`);

      // Story 1.5: Prompt each participant
      for (const name of ordered) {
        await sendAndSpeak(
          this.page,
          `**${name}**, you're up! Give us your update.`
        );

        // Wait for "done" or "next" via advance()
        console.log(`[Standup] Waiting for ${name} to finish...`);
        await this.waitForAdvance();

        await sendAndSpeak(this.page, `Thanks ${name}! ✓`);
      }

      // Story 1.6: Standup complete
      await sendAndSpeak(
        this.page,
        "That's everyone! Thanks team, have a great day. 👋"
      );
      console.log("[Standup] Standup complete.");
    } catch (err) {
      console.error("[Standup] Error during standup:", err);
    } finally {
      this._running = false;
      this.advanceResolve = null;
    }
  }

  /** Returns a promise that resolves when advance() is called. */
  private waitForAdvance(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.advanceResolve = resolve;
    });
  }
}

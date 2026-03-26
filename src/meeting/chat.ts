import { type Page } from "playwright";
import { selectors } from "../browser/selectors.js";
import { playAudioInMeeting } from "../tts/audio.js";
import { config } from "../config.js";
import { type Language } from "../i18n/messages.js";

/** A parsed chat message from the Teams meeting chat. */
export interface ChatMessage {
  sender: string;
  text: string;
}

/** Callback invoked for each new chat message. */
export type ChatMessageHandler = (message: ChatMessage) => void;

/**
 * ChatMonitor polls the Teams chat DOM for new messages and invokes a callback
 * for each one. It tracks how many messages it has already seen to avoid
 * re-processing.
 */
export class ChatMonitor {
  private page: Page;
  private botName: string;
  private seenCount = 0;
  private handler: ChatMessageHandler | null = null;
  private polling = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(page: Page, botName: string) {
    this.page = page;
    this.botName = botName;
  }

  /** Register a handler for new messages. */
  onMessage(handler: ChatMessageHandler): void {
    this.handler = handler;
  }

  /** Start polling the chat panel for new messages. */
  start(intervalMs = 1500): void {
    if (this.polling) return;
    this.polling = true;
    console.log(`[ChatMonitor] Started polling every ${intervalMs}ms.`);
    this.poll(intervalMs);
  }

  /** Stop polling. */
  stop(): void {
    this.polling = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    console.log("[ChatMonitor] Stopped.");
  }

  private poll(intervalMs: number): void {
    if (!this.polling) return;

    this.readNewMessages()
      .catch((err) => console.error("[ChatMonitor] Error reading messages:", err))
      .finally(() => {
        if (this.polling) {
          this.pollTimer = setTimeout(() => this.poll(intervalMs), intervalMs);
        }
      });
  }

  private async readNewMessages(): Promise<void> {
    // Grab all message containers currently in the DOM
    const messageEls = this.page.locator(selectors.chatMessages);
    const count = await messageEls.count();

    if (count <= this.seenCount) return;

    // Process only the new ones
    for (let i = this.seenCount; i < count; i++) {
      const msg = messageEls.nth(i);

      const sender = await msg
        .locator(selectors.chatMessageSender)
        .first()
        .textContent()
        .then((t) => t?.trim() ?? "Unknown")
        .catch(() => "Unknown");

      const text = await msg
        .locator(selectors.chatMessageText)
        .first()
        .textContent()
        .then((t) => t?.trim() ?? "")
        .catch(() => "");

      if (!text) continue;

      // Skip our own messages
      if (sender === this.botName || sender.includes(this.botName)) {
        continue;
      }

      console.log(`[Chat] ${sender}: ${text}`);

      if (this.handler) {
        // IMPORTANT: fire-and-forget — do NOT await. The standup flow
        // blocks inside run() waiting for advance(), which is called by
        // a subsequent onMessage invocation. Awaiting here deadlocks.
        void this.handler({ sender, text });
      }
    }

    this.seenCount = count;
  }
}

// ---------------------------------------------------------------------------
// Standalone helpers (from Phase 0)
// ---------------------------------------------------------------------------

/**
 * Open the chat panel if it isn't already visible.
 * In some Teams layouts the chat is already integrated in the meeting view,
 * so we try finding the compose box directly first before clicking a button.
 */
export async function openChatPanel(page: Page): Promise<void> {
  console.log("[Chat] Ensuring chat panel is open...");

  const composeBox = page.locator(selectors.chatComposeBox);

  // First: check if compose box is already visible (chat integrated in view)
  try {
    await composeBox.waitFor({ state: "visible", timeout: 5000 });
    console.log("[Chat] Chat compose box already visible.");
    return;
  } catch {
    // Not immediately visible — try opening the chat panel
  }

  // Second: try clicking the chat button to open the panel
  try {
    const chatBtn = page.locator(selectors.chatButton);
    await chatBtn.waitFor({ state: "visible", timeout: 5000 });
    await chatBtn.click();
    console.log("[Chat] Clicked chat button.");
    await composeBox.waitFor({ state: "visible", timeout: 10000 });
    console.log("[Chat] Chat panel is now open.");
  } catch {
    // Chat button not found either — last resort, just wait longer for compose box
    console.log("[Chat] No chat button found, waiting for compose box to appear...");
    await composeBox.waitFor({ state: "visible", timeout: 30000 });
    console.log("[Chat] Chat compose box appeared.");
  }
}

/**
 * Send a message in the meeting chat.
 */
export async function sendChatMessage(page: Page, message: string): Promise<void> {
  await openChatPanel(page);

  console.log(`[Chat] Typing message: "${message}"`);
  const composeBox = page.locator(selectors.chatComposeBox);
  await composeBox.waitFor({ state: "visible", timeout: 10000 });
  await composeBox.click();
  await composeBox.fill(message);

  // Try clicking the send button; fall back to pressing Enter
  try {
    const sendBtn = page.locator(selectors.chatSendButton);
    const sendVisible = await sendBtn.isVisible().catch(() => false);
    if (sendVisible) {
      await sendBtn.click();
    } else {
      await page.keyboard.press("Enter");
    }
  } catch {
    await page.keyboard.press("Enter");
  }

  console.log(`[Chat] Chat message sent: ${message}`);
}

/**
 * Send a chat message and fire-and-forget TTS in the background.
 * The chat message is sent immediately and the function returns without
 * waiting for audio — the standup flow is never blocked by TTS.
 */
export async function sendAndSpeak(page: Page, message: string, lang?: Language): Promise<void> {
  await sendChatMessage(page, message);

  if (!config.ttsEnabled) return;

  // Fire-and-forget — don't await
  // Strip markdown bold and emojis so TTS doesn't try to read them
  const plainText = message.replace(/\*\*/g, "").replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "").trim();
  playAudioInMeeting(plainText, lang)
    .catch((err: unknown) => console.error("[Chat] TTS failed (chat was still sent):", err));
}

import { type Page } from "playwright";
import { selectors } from "../browser/selectors.js";

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
        this.handler({ sender, text });
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
 */
export async function openChatPanel(page: Page): Promise<void> {
  console.log("[Chat] Ensuring chat panel is open...");

  const composeBox = page.locator(selectors.chatComposeBox);
  const isVisible = await composeBox.isVisible().catch(() => false);

  if (isVisible) {
    console.log("[Chat] Chat panel already open.");
    return;
  }

  try {
    const chatBtn = page.locator(selectors.chatButton);
    await chatBtn.waitFor({ state: "visible", timeout: 10000 });
    await chatBtn.click();
    console.log("[Chat] Clicked chat button.");

    await composeBox.waitFor({ state: "visible", timeout: 10000 });
    console.log("[Chat] Chat panel is now open.");
  } catch (err) {
    console.error("[Chat] Failed to open chat panel:", err);
    throw err;
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

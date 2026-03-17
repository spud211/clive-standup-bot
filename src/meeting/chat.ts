import { type Page } from "playwright";
import { selectors } from "../browser/selectors.js";

/**
 * Open the chat panel if it isn't already visible.
 */
export async function openChatPanel(page: Page): Promise<void> {
  console.log("[Chat] Ensuring chat panel is open...");

  // Check if the chat compose box is already visible
  const composeBox = page.locator(selectors.chatComposeBox);
  const isVisible = await composeBox.isVisible().catch(() => false);

  if (isVisible) {
    console.log("[Chat] Chat panel already open.");
    return;
  }

  // Click the chat button to open it
  try {
    const chatBtn = page.locator(selectors.chatButton);
    await chatBtn.waitFor({ state: "visible", timeout: 10000 });
    await chatBtn.click();
    console.log("[Chat] Clicked chat button.");

    // Wait for compose box to appear
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

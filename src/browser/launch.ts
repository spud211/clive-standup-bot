import { chromium, type Browser, type BrowserContext } from "playwright";
import { config } from "../config.js";

/**
 * Launch a Playwright Chromium browser instance.
 * Each meeting session gets its own browser context.
 */
export async function launchBrowser(): Promise<{ browser: Browser; context: BrowserContext }> {
  console.log(`[Browser] Launching Chromium (headless: ${config.headless})...`);

  const browser = await chromium.launch({
    headless: config.headless,
    args: [
      "--use-fake-ui-for-media-stream",  // Auto-allow mic/camera permissions
      "--use-fake-device-for-media-stream", // Use fake devices so Teams doesn't complain
      "--disable-notifications",          // Block notification prompts
    ],
  });

  const context = await browser.newContext({
    permissions: ["microphone", "camera"],
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  console.log("[Browser] Chromium launched successfully.");
  return { browser, context };
}

import { chromium, type Browser, type BrowserContext } from "playwright";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config } from "../config.js";

const execFileAsync = promisify(execFile);

/**
 * Set BlackHole 2ch as the system default input device so Chromium uses it as mic.
 */
async function setAudioInputDevice(device: string): Promise<void> {
  try {
    await execFileAsync("SwitchAudioSource", ["-t", "input", "-s", device]);
    console.log(`[Browser] Set default audio input to "${device}".`);
  } catch (err) {
    console.warn(`[Browser] Could not set audio input device — SwitchAudioSource failed:`, err);
    console.warn("[Browser] Ensure BlackHole 2ch is set as default input in System Settings → Sound → Input.");
  }
}

/**
 * Launch a Playwright Chromium browser instance.
 * Each meeting session gets its own browser context.
 */
export async function launchBrowser(): Promise<{ browser: Browser; context: BrowserContext }> {
  console.log(`[Browser] Launching Chromium (headless: ${config.headless})...`);

  // Set BlackHole as default input so Chromium picks it up as mic
  if (config.audioDevice) {
    await setAudioInputDevice(config.audioDevice);
  }

  const browser = await chromium.launch({
    headless: config.headless,
    args: [
      "--use-fake-ui-for-media-stream",    // Auto-allow mic/camera permissions
      "--disable-notifications",           // Block notification prompts
      "--autoplay-policy=no-user-gesture-required",
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

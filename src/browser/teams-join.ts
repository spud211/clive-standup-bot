import { type Page } from "playwright";
import { selectors } from "./selectors.js";
import { config } from "../config.js";

/**
 * Navigate to a Teams meeting URL and get through to the pre-join screen.
 * Handles cookie banners, "use web app" prompts, and other interruptions.
 */
export async function navigateToMeeting(page: Page, meetingUrl: string): Promise<void> {
  console.log(`[Teams] Navigating to meeting URL: ${meetingUrl}`);
  await page.goto(meetingUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  console.log("[Teams] Page loaded.");

  // Dismiss cookie consent banner if present
  await dismissCookieBanner(page);

  // Handle "Continue on this browser" / "Use web app instead" prompt
  await clickUseWebApp(page);

  // Wait for the pre-join screen to appear
  await waitForPreJoinScreen(page);

  console.log("[Teams] Arrived at pre-join screen.");
}

/**
 * Enter display name, disable mic/camera, and click Join.
 * Waits for lobby if applicable, then confirms we're in the meeting.
 */
export async function joinMeeting(page: Page, displayName: string): Promise<void> {
  console.log(`[Teams] Entering display name: "${displayName}"`);

  // Fill in the display name
  const nameInput = page.locator(selectors.nameInput);
  await nameInput.waitFor({ state: "visible", timeout: 15000 });
  await nameInput.clear();
  await nameInput.fill(displayName);

  // Ensure mic is off
  await toggleOffDevice(page, selectors.micToggle, "Microphone");

  // Ensure camera is off
  await toggleOffDevice(page, selectors.cameraToggle, "Camera");

  // Click Join now
  console.log("[Teams] Clicking Join now...");
  const joinBtn = page.locator(selectors.joinButton);
  await joinBtn.waitFor({ state: "visible", timeout: 10000 });
  await joinBtn.click();
  console.log("[Teams] Join button clicked.");

  // Wait: either we land in lobby or go straight into the meeting
  await waitForMeetingEntry(page);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function dismissCookieBanner(page: Page): Promise<void> {
  try {
    const cookie = page.locator(selectors.cookieAcceptButton);
    await cookie.waitFor({ state: "visible", timeout: 3000 });
    await cookie.click();
    console.log("[Teams] Dismissed cookie banner.");
  } catch {
    // No cookie banner — that's fine
    console.log("[Teams] No cookie banner detected.");
  }
}

async function clickUseWebApp(page: Page): Promise<void> {
  console.log('[Teams] Looking for "Use web app" / "Continue on this browser" link...');

  // Try the primary data-tid selector first
  try {
    const webAppBtn = page.locator(selectors.useWebAppButton);
    await webAppBtn.waitFor({ state: "visible", timeout: 10000 });
    await webAppBtn.click();
    console.log("[Teams] Clicked web app button (data-tid).");
    return;
  } catch {
    // Fall through to text-based fallback
  }

  // Fallback: text-based selectors
  try {
    const fallback = page.locator(selectors.continueOnBrowserLink).first();
    await fallback.waitFor({ state: "visible", timeout: 10000 });
    await fallback.click();
    console.log("[Teams] Clicked web app link (text fallback).");
    return;
  } catch {
    console.log("[Teams] No web app prompt found — may already be on pre-join screen.");
  }
}

async function waitForPreJoinScreen(page: Page): Promise<void> {
  console.log("[Teams] Waiting for pre-join screen...");
  // The pre-join screen has the name input and join button
  const nameInput = page.locator(selectors.nameInput);
  await nameInput.waitFor({ state: "visible", timeout: 30000 });
  console.log("[Teams] Pre-join screen detected (name input visible).");
}

async function toggleOffDevice(page: Page, selector: string, label: string): Promise<void> {
  try {
    const toggle = page.locator(selector);
    await toggle.waitFor({ state: "visible", timeout: 5000 });

    // Check if the device is currently on by looking at aria-pressed or similar
    const ariaChecked = await toggle.getAttribute("aria-checked");
    const ariaPressed = await toggle.getAttribute("aria-pressed");
    const dataIsOn = await toggle.getAttribute("data-is-muted");

    // If mic/camera appears to be ON, click to turn it OFF
    // The logic here is intentionally defensive — we click if the state looks "on"
    if (ariaChecked === "true" || ariaPressed === "true" || dataIsOn === "false") {
      await toggle.click();
      console.log(`[Teams] ${label} toggled OFF.`);
    } else {
      console.log(`[Teams] ${label} appears to already be OFF.`);
    }
  } catch {
    console.log(`[Teams] Could not find ${label} toggle — skipping.`);
  }
}

async function waitForMeetingEntry(page: Page): Promise<void> {
  console.log("[Teams] Waiting to enter meeting (may be in lobby)...");

  // Race between lobby and direct meeting entry
  const meetingControls = page.locator(selectors.meetingControls);
  const lobbyMessage = page.locator(selectors.lobbyWaitMessage);

  // Wait for either lobby or meeting controls to appear
  const result = await Promise.race([
    meetingControls
      .waitFor({ state: "visible", timeout: 60000 })
      .then(() => "in-meeting" as const),
    lobbyMessage
      .waitFor({ state: "visible", timeout: 60000 })
      .then(() => "in-lobby" as const),
  ]);

  if (result === "in-lobby") {
    console.log("[Teams] Waiting in lobby... Someone needs to admit us.");
    // Now wait for meeting controls (admitted from lobby)
    await meetingControls.waitFor({ state: "visible", timeout: 300000 }); // 5 min timeout
    console.log("[Teams] Admitted from lobby!");
  }

  console.log("[Teams] Successfully joined meeting.");
}

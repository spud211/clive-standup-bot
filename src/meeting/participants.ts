import { type Page } from "playwright";
import { selectors } from "../browser/selectors.js";

/** Section headers in the roster tree that should be skipped */
const SECTION_HEADER_PREFIXES = ["In this meeting", "In the lobby"];

/**
 * Read the current participant list from the Teams meeting roster.
 * Opens the roster panel, reads names from treeitems, filters out
 * section headers and the bot itself, then closes the panel.
 */
export async function getParticipants(page: Page, botName: string): Promise<string[]> {
  console.log("[Participants] Reading participant list...");

  // Open the roster panel
  try {
    const rosterBtn = page.locator(selectors.participantsButton);
    await rosterBtn.waitFor({ state: "visible", timeout: 10000 });
    await rosterBtn.click();
    console.log("[Participants] Opened roster panel.");
    await page.waitForTimeout(2000);
  } catch {
    console.log("[Participants] Roster panel may already be open or button not found.");
  }

  // Read all treeitem entries
  const entries = page.locator(selectors.participantEntries);
  const count = await entries.count();
  const names: string[] = [];

  for (let i = 0; i < count; i++) {
    const name = await entries
      .nth(i)
      .locator(selectors.participantName)
      .first()
      .textContent()
      .then((t) => t?.trim() ?? "")
      .catch(() => "");

    if (!name) continue;

    // Skip section headers like "In this meeting (3)" or "In the lobby"
    if (SECTION_HEADER_PREFIXES.some((prefix) => name.startsWith(prefix))) continue;

    // Skip the bot itself
    if (name === botName || name.includes(botName)) continue;

    names.push(name);
  }

  // Close the roster panel
  try {
    const rosterBtn = page.locator(selectors.participantsButton);
    await rosterBtn.click();
    console.log("[Participants] Closed roster panel.");
  } catch {
    // Not critical
  }

  console.log(`[Participants] Participants: [${names.join(", ")}]`);
  return names;
}

/**
 * Check if a specific participant is still in the meeting.
 * Opens and closes the roster panel to get a fresh read.
 */
export async function isParticipantPresent(page: Page, name: string): Promise<boolean> {
  try {
    // Open roster
    const rosterBtn = page.locator(selectors.participantsButton);
    await rosterBtn.waitFor({ state: "visible", timeout: 5000 });
    await rosterBtn.click();
    await page.waitForTimeout(1500);

    const entries = page.locator(selectors.participantEntries);
    const count = await entries.count();

    let found = false;
    for (let i = 0; i < count; i++) {
      const entryName = await entries
        .nth(i)
        .locator(selectors.participantName)
        .first()
        .textContent()
        .then((t) => t?.trim() ?? "")
        .catch(() => "");

      if (entryName === name) {
        found = true;
        break;
      }
    }

    // Close roster
    try { await rosterBtn.click(); } catch { /* not critical */ }

    return found;
  } catch {
    // If we can't read, assume present to avoid skipping
    return true;
  }
}

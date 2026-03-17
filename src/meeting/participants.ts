import { type Page } from "playwright";
import { selectors } from "../browser/selectors.js";

/**
 * Read the current participant list from the Teams meeting roster.
 * Opens the participants panel if needed, reads names, then returns them.
 */
export async function getParticipants(page: Page, botName: string): Promise<string[]> {
  console.log("[Participants] Reading participant list...");

  // Open the people panel
  try {
    const peopleBtn = page.locator(selectors.participantsButton);
    await peopleBtn.waitFor({ state: "visible", timeout: 10000 });
    await peopleBtn.click();
    console.log("[Participants] Opened people panel.");

    // Give it a moment to populate
    await page.waitForTimeout(2000);
  } catch {
    console.log("[Participants] People panel may already be open or button not found.");
  }

  // Read all participant entries
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

    if (name && !name.includes(botName)) {
      names.push(name);
    }
  }

  // Close the people panel by clicking the button again
  try {
    const peopleBtn = page.locator(selectors.participantsButton);
    await peopleBtn.click();
  } catch {
    // Not critical
  }

  console.log(`[Participants] Participants: [${names.join(", ")}]`);
  return names;
}

/**
 * Check if a specific participant is still in the meeting.
 */
export async function isParticipantPresent(page: Page, name: string): Promise<boolean> {
  try {
    const entries = page.locator(selectors.participantEntries);
    const count = await entries.count();

    for (let i = 0; i < count; i++) {
      const entryName = await entries
        .nth(i)
        .locator(selectors.participantName)
        .first()
        .textContent()
        .then((t) => t?.trim() ?? "")
        .catch(() => "");

      if (entryName === name) return true;
    }
  } catch {
    // If we can't read, assume present to avoid skipping
    return true;
  }

  return false;
}

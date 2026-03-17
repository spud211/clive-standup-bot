import { config } from "./config.js";
import { launchBrowser } from "./browser/launch.js";
import { navigateToMeeting, joinMeeting } from "./browser/teams-join.js";
import { sendChatMessage } from "./meeting/chat.js";

async function main(): Promise<void> {
  console.log("=== Clive: Standup AI ===");
  console.log(`Mode: ${config.mode}`);
  console.log(`Bot name: ${config.botDisplayName}`);
  console.log(`Headless: ${config.headless}`);

  if (config.mode === "direct") {
    if (!config.teamsUrl) {
      console.error("[Main] TEAMS_MEETING_URL is not set. Add it to your .env file.");
      process.exit(1);
    }

    console.log(`Meeting URL: ${config.teamsUrl}`);
    console.log("\n[Main] Launching browser...");

    const { browser, context } = await launchBrowser();
    const page = await context.newPage();

    // Story 0.2: Navigate to Teams meeting and reach pre-join screen
    await navigateToMeeting(page, config.teamsUrl);

    // Story 0.3: Enter name, disable A/V, join the meeting
    await joinMeeting(page, config.botDisplayName);

    // Story 0.4: Send a chat message to confirm interaction works
    await sendChatMessage(page, "Hello! Clive is online.");

    console.log("[Main] Bot is in the meeting. Press Ctrl+C to leave.\n");

    // Keep the process alive until Ctrl+C
    process.on("SIGINT", async () => {
      console.log("\n[Main] Shutting down...");
      await context.close();
      await browser.close();
      console.log("[Main] Browser closed. Goodbye!");
      process.exit(0);
    });
  } else {
    console.log("[Main] API mode — not yet implemented (Phase 1.5)");
  }
}

main().catch((err) => {
  console.error("[Main] Fatal error:", err);
  process.exit(1);
});

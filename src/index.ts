import { config } from "./config.js";
import { launchBrowser } from "./browser/launch.js";
import { navigateToMeeting, joinMeeting, leaveMeeting } from "./browser/teams-join.js";
import { ChatMonitor, sendChatMessage } from "./meeting/chat.js";
import { Standup } from "./meeting/standup.js";
import { startApiServer } from "./api/server.js";

async function main(): Promise<void> {
  console.log("=== Clive: Standup AI ===");
  console.log(`Mode: ${config.mode}`);
  console.log(`Bot name: ${config.botDisplayName}`);
  console.log(`Headless: ${config.headless}`);

  if (config.mode === "api") {
    console.log("\n[Main] Starting in API mode...");
    await startApiServer();
    return;
  }

  // Direct mode — single meeting from .env
  if (!config.teamsUrl) {
    console.error("[Main] TEAMS_MEETING_URL is not set. Add it to your .env file.");
    process.exit(1);
  }

  console.log(`Meeting URL: ${config.teamsUrl}`);
  console.log("\n[Main] Launching browser...");

  const { browser, context } = await launchBrowser();
  const page = await context.newPage();

  // Navigate and join
  await navigateToMeeting(page, config.teamsUrl);
  await joinMeeting(page, config.botDisplayName);

  // Send welcome message and start listening for "start daily"
  await sendChatMessage(
    page,
    "Good morning team! Type **start daily** when you're ready."
  );

  // Set up chat monitoring
  const chatMonitor = new ChatMonitor(page, config.botDisplayName);
  const standup = new Standup(page, config.botDisplayName, config.lastSpeakerName);

  chatMonitor.onMessage(async (msg) => {
    if (msg.text.toLowerCase().includes("start daily")) {
      if (standup.isRunning) {
        console.log("[Main] Standup already running — ignoring 'start daily'.");
        return;
      }
      console.log(`[Main] Standup triggered by ${msg.sender}`);
      await standup.run();
    }

    if (standup.isRunning) {
      const lower = msg.text.toLowerCase().trim();
      if (lower === "done" || lower === "next") {
        standup.advance();
      }
    }
  });

  chatMonitor.start();

  console.log("[Main] Bot is in the meeting, listening for commands. Press Ctrl+C to leave.\n");

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\n[Main] Leaving meeting... Goodbye!");
    chatMonitor.stop();
    try {
      await leaveMeeting(page);
    } catch (err) {
      console.error("[Main] Error leaving meeting (continuing shutdown):", err);
    }
    await context.close();
    await browser.close();
    console.log("[Main] Browser closed. Clean exit.");
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[Main] Fatal error:", err);
  process.exit(1);
});

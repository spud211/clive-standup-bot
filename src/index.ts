import { config } from "./config.js";
import { launchBrowser } from "./browser/launch.js";
import { navigateToMeeting, joinMeeting, leaveMeeting } from "./browser/teams-join.js";
import { ChatMonitor, sendAndSpeak } from "./meeting/chat.js";
import { Standup } from "./meeting/standup.js";
import { startApiServer } from "./api/server.js";
import { installVirtualCamera, enableCamera } from "./browser/virtual-camera.js";
import { getMessages, startTriggers, advanceTriggers, pickWelcome } from "./i18n/messages.js";
import { CommandRegistry } from "./commands/registry.js";
import { registerAllCommands } from "./commands/index.js";

async function main(): Promise<void> {
  console.log("=== Clive: Standup AI ===");
  console.log(`Mode: ${config.mode}`);
  console.log(`Bot name: ${config.botDisplayName}`);
  console.log(`Headless: ${config.headless}`);
  console.log(`[Config] Language: ${config.language}`);

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

  // Install virtual camera override BEFORE navigation (needs to be in place when Teams requests camera)
  const hasAvatar = !!(config.avatarVideoPath || config.avatarImagePath);
  if (hasAvatar) {
    await installVirtualCamera(page, {
      videoPath: config.avatarVideoPath || undefined,
      imagePath: config.avatarImagePath || undefined,
    });
  }

  // Navigate and join
  await navigateToMeeting(page, config.teamsUrl);
  await joinMeeting(page, config.botDisplayName);

  // Enable camera after joining so participants see the avatar
  if (hasAvatar) {
    await enableCamera(page);
  }

  // Send welcome message and start listening for trigger
  const lang = config.language;
  const msg = getMessages(lang);
  await sendAndSpeak(page, pickWelcome(msg), lang);

  // Set up chat monitoring
  const chatMonitor = new ChatMonitor(page, config.botDisplayName);
  const standup = new Standup(page, config.botDisplayName, config.lastSpeakerName, lang);
  const commands = new CommandRegistry();
  registerAllCommands(commands);

  const starts = startTriggers[lang];
  const advances = advanceTriggers[lang];

  chatMonitor.onMessage(async (chatMsg) => {
    const lower = chatMsg.text.toLowerCase().replace(/\s+/g, " ").trim();

    // Try commands first
    const handled = await commands.tryHandle(chatMsg.text, {
      sender: chatMsg.sender,
      participants: [],
      page,
      lang,
    }, standup.isRunning);
    if (handled) return;

    if (starts.some((t) => lower.includes(t))) {
      if (standup.isRunning) {
        console.log("[Main] Standup already running — ignoring start trigger.");
        return;
      }
      console.log(`[Main] Standup triggered by ${chatMsg.sender}`);
      await standup.run();
    }

    if (standup.isRunning) {
      if (lower === "go" || lower === "skip") {
        standup.skipBoard();
      }
      if (advances.some((t) => lower.includes(t))) {
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

import { config } from "./config.js";
import { launchBrowser } from "./browser/launch.js";

async function main(): Promise<void> {
  console.log("=== Clive: Standup AI ===");
  console.log(`Mode: ${config.mode}`);
  console.log(`Bot name: ${config.botDisplayName}`);
  console.log(`Headless: ${config.headless}`);

  if (config.mode === "direct") {
    console.log(`Meeting URL: ${config.teamsUrl || "(not set)"}`);
    console.log("\n[Main] Launching browser...");

    const { browser, context } = await launchBrowser();
    const page = await context.newPage();

    console.log("[Main] Browser is ready. Opening blank page to confirm Playwright works.");
    await page.goto("https://www.google.com");
    console.log(`[Main] Page title: "${await page.title()}"`);
    console.log("[Main] Playwright is working! Browser will stay open.");
    console.log("[Main] Press Ctrl+C to close.\n");

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

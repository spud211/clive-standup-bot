import { type CommandDef, type CommandContext } from "./registry.js";
import { type Language, startTriggers, advanceTriggers } from "../i18n/messages.js";
import { type Standup } from "../meeting/standup.js";

/**
 * Creates the standup trigger commands (/start, "start daily", "done", "next", "go", "skip").
 * These need a reference to the Standup instance so are created via factory.
 */
export function createStandupCommands(standup: Standup): CommandDef[] {
  const startCommand: CommandDef = {
    name: "/start",
    allowDuringStandup: false,
    speakResponse: false,
    match: (text, lang) => {
      if (text === "/start" || text === "/daily") return true;
      const triggers = startTriggers[lang];
      return triggers.some((t) => text.includes(t));
    },
    async handle(ctx: CommandContext) {
      if (standup.isRunning) {
        console.log("[Command] Standup already running — ignoring start trigger.");
        return;
      }
      console.log(`[Command] Standup triggered by ${ctx.sender}`);
      // Fire-and-forget — standup.run() blocks until complete
      void standup.run();
    },
  };

  const advanceCommand: CommandDef = {
    name: "advance",
    allowDuringStandup: true,
    speakResponse: false,
    match: (text, lang) => {
      if (!standup.isRunning) return false;
      const triggers = advanceTriggers[lang];
      return triggers.some((t) => text.includes(t));
    },
    async handle() {
      standup.advance();
    },
  };

  const skipBoardCommand: CommandDef = {
    name: "skip-board",
    allowDuringStandup: true,
    speakResponse: false,
    match: (text) => {
      if (!standup.isRunning) return false;
      return text === "go" || text === "skip";
    },
    async handle() {
      standup.skipBoard();
    },
  };

  return [startCommand, advanceCommand, skipBoardCommand];
}

import { type CommandRegistry } from "./registry.js";
import { type Standup } from "../meeting/standup.js";
import { slapCommand, meCommand } from "./irc.js";
import { greetingCommand, thanksCommand } from "./banter.js";
import {
  createTimerCommand,
  createPollCommands,
  quoteCommand,
  eightBallCommand,
  flipCommand,
  helpCommand,
} from "./fun.js";
import { createDiscussionCommands } from "./conversate.js";
import { createStandupCommands } from "./standup-trigger.js";

/**
 * Register all commands with the given registry.
 * Factory functions are called here so each registry gets its own state
 * (safe for multi-session API mode).
 * Add new commands here — this is the single place to browse all available commands.
 */
export function registerAllCommands(registry: CommandRegistry, standup: Standup): void {
  // Standup triggers — /start, done/next, go/skip
  for (const cmd of createStandupCommands(standup)) {
    registry.register(cmd);
  }

  // IRC classics (Story 2.5.2)
  registry.register(slapCommand);
  registry.register(meCommand);

  // Greetings & banter (Story 2.5.3)
  registry.register(greetingCommand);
  registry.register(thanksCommand);

  // Fun commands (Story 2.5.4) — stateful commands use factories
  registry.register(createTimerCommand());
  const [pollCmd, pollVoteCmd] = createPollCommands();
  registry.register(pollCmd);
  registry.register(pollVoteCmd);
  registry.register(quoteCommand);
  registry.register(eightBallCommand);
  registry.register(flipCommand);
  registry.register(helpCommand);

  // Conversate mode (Story 2.5.5)
  const [conversateCmd, endCmd, extendCmd] = createDiscussionCommands();
  registry.register(conversateCmd);
  registry.register(endCmd);
  registry.register(extendCmd);
}
